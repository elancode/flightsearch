"""flightcore — the reusable core of the flight-decomposition search.

This is the "single module, deliberately liftable into a product backend"
that CLAUDE.md anticipates: schema, provider interface, planner and ranking,
with NO CLI / no YAML / no argparse. Both the CLI (`../../flightarb.py`) and
the Vercel serverless function (`search.py`) import from here so there is a
single source of truth for the search behavior.

Kept dependency-light: standard library + `requests` only. YAML loading and
markdown reporting stay in the CLI, which is the only place that needs them.
"""

from __future__ import annotations

import hashlib
import itertools
import json
import os
import random
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

# ---------------------------------------------------------------------------
# Constraint schema (this is the product spec)
# ---------------------------------------------------------------------------

CABIN_ORDER = ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]
DUFFEL_CABIN = {"economy": "ECONOMY", "premium_economy": "PREMIUM_ECONOMY",
                "business": "BUSINESS", "first": "FIRST"}


def cabin_rank(cabin: str) -> int:
    return CABIN_ORDER.index(cabin) if cabin in CABIN_ORDER else -1


_ISO_DUR = re.compile(
    r"^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$")


def parse_iso_duration(s: Optional[str]) -> Optional[int]:
    """ISO-8601 duration (e.g. 'PT15H5M', 'P1DT4H') -> minutes.

    Duffel gives per-slice/segment durations that are timezone-correct, unlike
    subtracting its naive local `departing_at`/`arriving_at` across airports.
    """
    if not s:
        return None
    m = _ISO_DUR.match(s)
    if not m:
        return None
    d, h, mi, se = (int(x) if x else 0 for x in m.groups())
    return d * 1440 + h * 60 + mi + (1 if se >= 30 else 0)


@dataclass
class LegSpec:
    origin: str
    destination: str
    date: str                                  # YYYY-MM-DD
    cabins_acceptable: list[str]               # ordered by preference
    comfort_value: dict[str, float] = field(default_factory=dict)
    date_flex_days: int = 0                    # reserved for --flex sweep
    via: list[str] = field(default_factory=list)  # preferred stopover airports

    def preferred_cabin(self) -> str:
        return max(self.cabins_acceptable, key=cabin_rank)


@dataclass
class TripSpec:
    name: str
    legs: list[LegSpec]
    passengers: int = 1
    max_stops: int = 1
    max_layover_minutes: int = 240
    currency: str = "USD"          # informational; Duffel prices in your
                                   # org's settlement currency


# ---------------------------------------------------------------------------
# Priced-offer model
# ---------------------------------------------------------------------------

@dataclass
class Segment:
    carrier: str
    number: str
    origin: str
    destination: str
    depart: str
    arrive: str
    cabin: str
    duration: Optional[str] = None  # Duffel per-segment ISO-8601 duration
    carrier_name: Optional[str] = None  # marketing airline name


@dataclass
class PricedItinerary:
    segments: list[Segment]
    duration_iso: Optional[str] = None  # Duffel slice duration (tz-correct)

    def stops(self) -> int:
        return len(self.segments) - 1

    def layovers_minutes(self) -> list[int]:
        # Layovers are between two segments at the SAME airport, so subtracting
        # their local times is correct (no timezone crossing).
        outs = []
        for a, b in zip(self.segments, self.segments[1:]):
            t1 = datetime.fromisoformat(a.arrive)
            t2 = datetime.fromisoformat(b.depart)
            outs.append(int((t2 - t1).total_seconds() // 60))
        return outs

    def min_cabin(self) -> str:
        return min((s.cabin for s in self.segments), key=cabin_rank)

    def route_str(self) -> str:
        pts = [self.segments[0].origin] + [s.destination for s in self.segments]
        return "-".join(pts)

    def path_str(self) -> str:
        """Full routing incl. connections, e.g. 'SFO → EWR → TLV'."""
        pts = [self.segments[0].origin] + [s.destination for s in self.segments]
        return " → ".join(pts)

    def stop_codes(self) -> list[str]:
        """Connecting airport codes (empty for a nonstop)."""
        return [s.destination for s in self.segments[:-1]]

    def airlines(self) -> list[str]:
        """Distinct marketing airline names (falling back to IATA code)."""
        out: list[str] = []
        for s in self.segments:
            name = s.carrier_name or s.carrier
            if name not in out:
                out.append(name)
        return out

    def flights_str(self) -> str:
        return ", ".join(f"{s.carrier}{s.number}" for s in self.segments)

    def duration_minutes(self) -> Optional[int]:
        # Prefer Duffel's timezone-correct duration. Fall back to segment
        # durations + layovers (also tz-safe), then to a naive timestamp diff
        # (only correct within one timezone, e.g. the mock provider).
        iso = parse_iso_duration(self.duration_iso)
        if iso is not None:
            return iso
        seg_durs = [parse_iso_duration(s.duration) for s in self.segments]
        if all(d is not None for d in seg_durs):
            return sum(seg_durs) + sum(self.layovers_minutes())  # type: ignore[arg-type]
        try:
            t1 = datetime.fromisoformat(self.segments[0].depart)
            t2 = datetime.fromisoformat(self.segments[-1].arrive)
            return int((t2 - t1).total_seconds() // 60)
        except (ValueError, IndexError):
            return None

    def overnight(self) -> bool:
        """Red-eye heuristic from the origin-local departure time only.

        (Departure local time is reliable; a cross-timezone arrival is not.)
        """
        try:
            dep = datetime.fromisoformat(self.segments[0].depart)
            return dep.hour >= 18 or dep.hour < 6
        except (ValueError, IndexError):
            return False


@dataclass
class Offer:
    price: float
    currency: str
    itineraries: list[PricedItinerary]
    leg_indices: list[int]
    source: str = "duffel"

    def passes(self, trip: TripSpec) -> bool:
        for itin in self.itineraries:
            if itin.stops() > trip.max_stops:
                return False
            if any(m > trip.max_layover_minutes for m in itin.layovers_minutes()):
                return False
        return True

    def cabins_tuple(self) -> tuple[str, ...]:
        return tuple(itin.min_cabin() for itin in self.itineraries)


# ---------------------------------------------------------------------------
# Duffel provider
# ---------------------------------------------------------------------------

class DuffelProvider:
    """search(trip, leg_indices, cabin) -> offers.

    cabin=None means unfiltered: Duffel returns offers across all cabins and
    fare-brand combinations — that one response is then post-bucketed by
    per-slice cabin for the MIXED_RT strategy.

    Thread-safe: the response cache and the calls_made counter are guarded so
    the planner can fan searches out concurrently (needed to fit a live
    multi-call search inside a serverless time budget).
    """

    BASE = "https://api.duffel.com"

    def __init__(self, token: Optional[str] = None, sleep_s: float = 0.5,
                 supplier_timeout_ms: int = 15000):
        self.token = token or os.environ.get("DUFFEL_ACCESS_TOKEN", "")
        if not self.token:
            raise RuntimeError("DUFFEL_ACCESS_TOKEN is not set.")
        self.sleep_s = sleep_s
        self.supplier_timeout_ms = supplier_timeout_ms
        self._cache: dict[str, list[Offer]] = {}
        self._lock = threading.Lock()
        self.calls_made = 0

    def search(self, trip: TripSpec, leg_indices: list[int],
               cabin: Optional[str]) -> list[Offer]:
        body = {"data": {
            "slices": [{
                "origin": trip.legs[i].origin,
                "destination": trip.legs[i].destination,
                "departure_date": trip.legs[i].date,
            } for i in leg_indices],
            "passengers": [{"type": "adult"}] * trip.passengers,
            "max_connections": trip.max_stops,
        }}
        if cabin:
            body["data"]["cabin_class"] = cabin.lower()

        key = hashlib.sha256(
            json.dumps(body, sort_keys=True).encode()).hexdigest()
        with self._lock:
            if key in self._cache:
                return self._cache[key]

        if self.sleep_s:
            time.sleep(self.sleep_s)
        url = (f"{self.BASE}/air/offer_requests"
               f"?return_offers=true&supplier_timeout={self.supplier_timeout_ms}")
        # Stdlib urllib (no third-party deps) so the serverless bundle needs
        # nothing pip-installed. No Accept-Encoding: gzip — keep the response
        # plain so we don't have to decompress.
        req = urllib.request.Request(
            url, data=json.dumps(body).encode(), method="POST", headers={
                "Authorization": f"Bearer {self.token}",
                "Duffel-Version": "v2",
                "Content-Type": "application/json",
                "Accept": "application/json",
            })
        with self._lock:
            self.calls_made += 1
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                data = json.loads(resp.read())
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:300]
            print(f"    ! Duffel {e.code}: {detail}", file=sys.stderr)
            with self._lock:
                self._cache[key] = []
            return []
        except urllib.error.URLError as e:
            print(f"    ! Duffel request failed: {e}", file=sys.stderr)
            with self._lock:
                self._cache[key] = []
            return []
        offers = self._parse(data, leg_indices)
        with self._lock:
            self._cache[key] = offers
        return offers

    @staticmethod
    def _parse(resp: dict, leg_indices: list[int]) -> list[Offer]:
        offers = []
        for o in (resp.get("data") or {}).get("offers", []) or []:
            itins = []
            ok = True
            for sl in o.get("slices", []):
                segs = []
                for s in sl.get("segments", []):
                    pax = s.get("passengers") or [{}]
                    cab = DUFFEL_CABIN.get(
                        (pax[0].get("cabin_class") or "economy"), "ECONOMY")
                    mkt = s.get("marketing_carrier") or {}
                    carrier = (mkt.get("iata_code")
                               or (s.get("operating_carrier") or {})
                               .get("iata_code") or "??")
                    carrier_name = (mkt.get("name")
                                    or (s.get("operating_carrier") or {})
                                    .get("name"))
                    try:
                        segs.append(Segment(
                            carrier=carrier,
                            number=str(s.get("marketing_carrier_flight_number")
                                       or ""),
                            origin=s["origin"]["iata_code"],
                            destination=s["destination"]["iata_code"],
                            depart=s["departing_at"],
                            arrive=s["arriving_at"],
                            cabin=cab,
                            duration=s.get("duration"),
                            carrier_name=carrier_name,
                        ))
                    except (KeyError, TypeError):
                        ok = False
                        break
                if not ok:
                    break
                itins.append(PricedItinerary(segments=segs,
                                             duration_iso=sl.get("duration")))
            if not ok or len(itins) != len(leg_indices):
                continue
            try:
                price = float(o["total_amount"])
            except (KeyError, TypeError, ValueError):
                continue
            offers.append(Offer(
                price=price,
                currency=o.get("total_currency", "USD"),
                itineraries=itins,
                leg_indices=list(leg_indices),
            ))
        offers.sort(key=lambda x: x.price)
        return offers


# ---------------------------------------------------------------------------
# Mock provider — validates planner/ranking with no token.
# ---------------------------------------------------------------------------

MOCK_BASE_ONEWAY_ECON = 480.0
MOCK_CABIN_MULT = {"ECONOMY": 1.0, "PREMIUM_ECONOMY": 2.1,
                   "BUSINESS": 4.6, "FIRST": 8.0}
MOCK_ONEWAY_PENALTY = {"ECONOMY": 1.05, "PREMIUM_ECONOMY": 1.35,
                       "BUSINESS": 1.55, "FIRST": 1.7}


class MockProvider:
    def __init__(self, seed: int = 42):
        self.rng = random.Random(seed)
        self.calls_made = 0

    def search(self, trip: TripSpec, leg_indices: list[int],
               cabin: Optional[str]) -> list[Offer]:
        self.calls_made += 1
        n = len(leg_indices)
        # cabin=None (unfiltered) -> emit offers across all combos of each
        # leg's acceptable cabins, mimicking Duffel's fare-brand explosion.
        if cabin is None:
            spaces = [trip.legs[i].cabins_acceptable for i in leg_indices]
            combos = list(itertools.product(*spaces))
        else:
            combos = [tuple([cabin] * n)]
        offers = []
        for combo in combos:
            for k in range(3):
                itins, total = [], 0.0
                for (leg_idx, cab) in zip(leg_indices, combo):
                    leg = trip.legs[leg_idx]
                    base = MOCK_BASE_ONEWAY_ECON * MOCK_CABIN_MULT[cab]
                    base *= MOCK_ONEWAY_PENALTY[cab] if n == 1 else 1.0
                    base *= self.rng.uniform(0.85, 1.25) * (1 + 0.08 * k)
                    total += base
                    dep = datetime.fromisoformat(leg.date + "T18:40:00")
                    if self.rng.random() < 0.4:
                        segs = [Segment("UA", str(self.rng.randint(1, 999)),
                                        leg.origin, leg.destination,
                                        dep.isoformat(),
                                        (dep + timedelta(hours=13)).isoformat(),
                                        cab)]
                    else:
                        a1 = dep + timedelta(hours=5, minutes=30)
                        d2 = a1 + timedelta(
                            minutes=self.rng.choice([75, 110, 150, 300]))
                        segs = [
                            Segment("UA", str(self.rng.randint(1, 999)),
                                    leg.origin, "EWR", dep.isoformat(),
                                    a1.isoformat(), cab),
                            Segment("UA", str(self.rng.randint(1000, 1999)),
                                    "EWR", leg.destination, d2.isoformat(),
                                    (d2 + timedelta(hours=9)).isoformat(),
                                    cab),
                        ]
                    itins.append(PricedItinerary(segments=segs))
                if n > 1:
                    total *= 0.86
                offers.append(Offer(price=round(total, 2),
                                    currency=trip.currency,
                                    itineraries=itins,
                                    leg_indices=list(leg_indices),
                                    source="mock"))
        offers.sort(key=lambda x: x.price)
        return offers


# ---------------------------------------------------------------------------
# Planner: enumerate strategies, price, rank
# ---------------------------------------------------------------------------

@dataclass
class RankedOption:
    strategy: str
    label: str
    offers: list[Offer]
    total_price: float
    comfort_credit: float
    effective_cost: float
    flags: list[str]
    links: list[str]

    def cabins_by_leg(self, n_legs: int) -> list[str]:
        cabins = ["-"] * n_legs
        for off in self.offers:
            for itin, leg_idx in zip(off.itineraries, off.leg_indices):
                cabins[leg_idx] = itin.min_cabin()
        return cabins

    def single_pnr(self) -> bool:
        return any("single PNR" in f for f in self.flags)


def google_flights_link(leg: LegSpec, cabin: str) -> str:
    q = (f"Flights from {leg.origin} to {leg.destination} on {leg.date} "
         f"{cabin.replace('_', ' ').lower()} class")
    return "https://www.google.com/travel/flights?q=" + urllib.parse.quote(q)


def comfort_credit(trip: TripSpec, offers: list[Offer]) -> float:
    credit = 0.0
    for off in offers:
        for itin, leg_idx in zip(off.itineraries, off.leg_indices):
            credit += trip.legs[leg_idx].comfort_value.get(
                itin.min_cabin(), 0.0)
    return credit


def cabin_combos(trip: TripSpec) -> tuple[list[tuple[str, ...]],
                                          list[tuple[str, ...]],
                                          str]:
    """Returns (uniform_combos, mixed_combos, baseline_cabin)."""
    n = len(trip.legs)
    combos = set(itertools.product(*[l.cabins_acceptable for l in trip.legs]))
    baseline = max((l.preferred_cabin() for l in trip.legs), key=cabin_rank)
    combos.add(tuple([baseline] * n))   # naive baseline is always priced
    uniform = sorted({c for c in combos if len(set(c)) == 1},
                     key=lambda c: -cabin_rank(c[0]))
    mixed = sorted({c for c in combos if len(set(c)) > 1},
                   key=lambda c: [-cabin_rank(x) for x in c])
    return uniform, mixed, baseline


def plan_searches(trip: TripSpec) -> list[dict]:
    """Distinct provider calls needed (for --dry-run and execution)."""
    n = len(trip.legs)
    uniform, mixed, _ = cabin_combos(trip)
    searches = []
    if n >= 2:
        for combo in uniform:
            searches.append({"kind": "UNIFORM_RT",
                             "leg_indices": list(range(n)),
                             "cabin": combo[0]})
        if mixed:
            searches.append({"kind": "MIXED_RT (unfiltered, post-bucketed)",
                             "leg_indices": list(range(n)),
                             "cabin": None})
    for i, leg in enumerate(trip.legs):
        for cabin in leg.cabins_acceptable:
            searches.append({"kind": "ONEWAY", "leg_indices": [i],
                             "cabin": cabin})
    return searches


def make_option(trip: TripSpec, strategy: str, offers: list[Offer],
                flags: list[str]) -> RankedOption:
    total = round(sum(o.price for o in offers), 2)
    cc = comfort_credit(trip, offers)
    cabins = ["-"] * len(trip.legs)
    links = []
    for off in offers:
        for itin, leg_idx in zip(off.itineraries, off.leg_indices):
            cabins[leg_idx] = itin.min_cabin()
            links.append(google_flights_link(trip.legs[leg_idx],
                                             itin.min_cabin()))
    return RankedOption(
        strategy=strategy,
        label=f"{strategy}: " + "/".join(c[:4] for c in cabins),
        offers=offers, total_price=total, comfort_credit=cc,
        effective_cost=round(total - cc, 2), flags=flags, links=links)


def fetch_offers(provider, trip: TripSpec, searches: list[dict],
                 parallel: bool) -> list[list[Offer]]:
    """Price every planned search, returning RAW offers aligned to `searches`.

    Constraint filtering (`Offer.passes`) is applied by the caller so it can
    tell "the provider returned nothing" from "constraints filtered them all".
    When parallel, searches fan out over a thread pool — the DuffelProvider is
    thread-safe — so wall-clock is roughly one slow call, not the sum.
    """
    def do(s: dict) -> list[Offer]:
        return provider.search(trip, s["leg_indices"], s["cabin"])

    if parallel and len(searches) > 1:
        with ThreadPoolExecutor(max_workers=min(8, len(searches))) as ex:
            return list(ex.map(do, searches))
    return [do(s) for s in searches]


def run_trip(trip: TripSpec, provider, top_k: int = 3,
             parallel: bool = False, verbose: bool = True,
             stats: Optional[dict] = None) -> list[RankedOption]:
    n = len(trip.legs)
    uniform, mixed, _ = cabin_combos(trip)
    options: list[RankedOption] = []
    oneway_offers: dict[int, list[Offer]] = {i: [] for i in range(n)}

    searches = plan_searches(trip)
    offers_by_search = fetch_offers(provider, trip, searches, parallel)
    raw_total = passed_total = 0

    for s, raw in zip(searches, offers_by_search):
        offers = [o for o in raw if o.passes(trip)]
        raw_total += len(raw)
        passed_total += len(offers)
        idxs, cabin = s["leg_indices"], s["cabin"]
        if verbose:
            desc = " + ".join(
                f"{trip.legs[i].origin}-{trip.legs[i].destination}"
                for i in idxs)
            print(f"  pricing {s['kind']:<34} {desc} [{cabin or 'ALL CABINS'}]")

        if s["kind"] == "ONEWAY":
            oneway_offers[idxs[0]].extend(offers[:top_k])
        elif cabin is not None:  # UNIFORM_RT
            for off in offers[:top_k]:
                if set(off.cabins_tuple()) == {cabin}:
                    options.append(make_option(trip, "UNIFORM_RT", [off],
                                               ["single PNR"]))
        else:  # unfiltered search -> bucket by per-slice cabins
            buckets: dict[tuple, list[Offer]] = {}
            for off in offers:
                buckets.setdefault(off.cabins_tuple(), []).append(off)
            for combo in mixed:
                for off in buckets.get(combo, [])[:top_k]:
                    options.append(make_option(trip, "MIXED_RT", [off],
                                               ["single PNR"]))
            if verbose:
                found = sorted(buckets.keys())
                print(f"    -> {len(offers)} offers across "
                      f"{len(buckets)} cabin combos: {found}")

    if n == 1:
        # Single leg: no round-trip or split to compose — just rank the
        # one-way fares (dedup below keeps the cheapest per cabin).
        for off in oneway_offers[0]:
            options.append(make_option(trip, "ONEWAY", [off], ["single PNR"]))
    elif all(oneway_offers[i] for i in range(n)):
        for combo in itertools.product(*[oneway_offers[i] for i in range(n)]):
            options.append(make_option(
                trip, "SPLIT_ONEWAY", list(combo),
                ["separate PNRs — no misconnect protection",
                 f"{n} bookings"]))

    if stats is not None:
        stats["raw"] = raw_total
        stats["passed"] = passed_total

    # Keep cheapest per (strategy, cabin signature).
    best: dict[str, RankedOption] = {}
    for opt in options:
        sig = opt.strategy + "|" + "/".join(opt.cabins_by_leg(n))
        if sig not in best or opt.effective_cost < best[sig].effective_cost:
            best[sig] = opt
    return sorted(best.values(), key=lambda o: o.effective_cost)


def naive_baseline(trip: TripSpec,
                   ranked: list[RankedOption]) -> Optional[RankedOption]:
    _, _, target = cabin_combos(trip)
    # Round-trip baseline is the uniform highest-cabin RT; for a one-way it's
    # the highest-cabin single fare (strategy ONEWAY).
    base_strats = {"UNIFORM_RT"} if len(trip.legs) >= 2 else {"ONEWAY"}
    candidates = [o for o in ranked if o.strategy in base_strats
                  and set(o.cabins_by_leg(len(trip.legs))) == {target}]
    return min(candidates, key=lambda o: o.total_price) if candidates else None


# ---------------------------------------------------------------------------
# JSON result builder — the shape the web UI consumes
# ---------------------------------------------------------------------------

def _fmt_duration(mins: Optional[int]) -> str:
    if mins is None:
        return ""
    return f"{mins // 60}h {mins % 60:02d}m"


def _segments_json(trip: TripSpec, opt: RankedOption) -> list[dict]:
    segs = []
    for off in opt.offers:
        for itin, leg_idx in zip(off.itineraries, off.leg_indices):
            leg = trip.legs[leg_idx]
            dur = itin.duration_minutes()
            kind = "overnight" if itin.overnight() else "daytime"
            note = _fmt_duration(dur)
            note = f"{kind} · {note}" if note else kind
            segs.append({
                "leg_index": leg_idx,
                "leg": f"Leg {leg_idx + 1}",
                "origin": leg.origin,
                "destination": leg.destination,
                "route": f"{leg.origin} → {leg.destination}",
                "path": itin.path_str(),
                "stops_codes": itin.stop_codes(),
                "airlines": itin.airlines(),
                "date": leg.date,
                "cabin": itin.min_cabin(),
                "flights": itin.flights_str(),
                "stops": itin.stops(),
                "note": note,
            })
    segs.sort(key=lambda s: s["leg_index"])
    return segs


def _option_json(trip: TripSpec, opt: RankedOption,
                 baseline_price: Optional[float]) -> dict:
    n = len(trip.legs)
    save = round(baseline_price - opt.total_price, 2) if baseline_price else None
    return {
        "strategy": opt.strategy,
        "cabins": opt.cabins_by_leg(n),
        "price": opt.total_price,
        "comfort_credit": opt.comfort_credit,
        "effective": opt.effective_cost,
        "save": save,
        "single_pnr": opt.single_pnr(),
        "flags": opt.flags,
        "links": opt.links,
        "segments": _segments_json(trip, opt),
    }


def _log_lines(trip: TripSpec, searches: list[dict], calls_made: int,
               mode: str) -> list[dict]:
    lines = []
    for s in searches:
        desc = " + ".join(f"{trip.legs[i].origin}-{trip.legs[i].destination}"
                          for i in s["leg_indices"])
        kind = s["kind"].split(" ")[0]
        cab = s["cabin"] or "ALL CABINS"
        lines.append({"t": f"pricing {kind:<12} {desc:<20} [{cab}]", "k": "call"})
    lines.append({
        "t": f"Provider calls made: {calls_made}   ·   ranked "
             f"by effective cost",
        "k": "done",
    })
    return lines


def run_trip_result(trip: TripSpec, provider, top_k: int = 3,
                    parallel: bool = True, mode: str = "live") -> dict:
    """Run a trip and return a JSON-serializable result for the web UI."""
    stats: dict = {}
    ranked = run_trip(trip, provider, top_k, parallel=parallel,
                      verbose=False, stats=stats)
    base = naive_baseline(trip, ranked)
    base_price = base.total_price if base else None
    currency = ranked[0].offers[0].currency if ranked else trip.currency

    options = [_option_json(trip, o, base_price) for o in ranked]

    # Diagnostic when nothing ranked: distinguish "provider returned nothing"
    # from "constraints filtered everything out".
    warning = None
    if not options:
        raw, passed = stats.get("raw", 0), stats.get("passed", 0)
        if raw == 0:
            warning = (
                "No offers came back for these routes/dates. A Duffel test "
                "token only has data for a few sandbox routes — use a live "
                "read-write token for real routes, or try a different date.")
        elif passed == 0:
            warning = (
                f"Found {raw} candidate offers, but all were filtered out by "
                f"your constraints (max {trip.max_stops} "
                f"stop{'s' if trip.max_stops != 1 else ''}, layover "
                f"≤ {trip.max_layover_minutes}m). Loosen them and re-run.")
        else:
            warning = "No combinations ranked for this trip."

    # Recommended = lowest effective-cost single-PNR option (the "best pick
    # you can book on one ticket"). Matches the design's RECOMMENDED row.
    recommended_index = None
    best_eff = None
    for i, (o, oj) in enumerate(zip(ranked, options)):
        if oj["single_pnr"] and (best_eff is None or o.effective_cost < best_eff):
            best_eff, recommended_index = o.effective_cost, i

    baseline_json = None
    if base:
        baseline_json = {
            "cabins": base.cabins_by_leg(len(trip.legs)),
            "price": base.total_price,
            "comfort_credit": base.comfort_credit,
            "effective": base.effective_cost,
        }

    searches = plan_searches(trip)
    return {
        "ok": True,
        "mode": mode,
        "currency": currency,
        "trip_name": trip.name,
        "baseline": baseline_json,
        "options": options,
        "recommended_index": recommended_index,
        "warning": warning,
        "calls_made": getattr(provider, "calls_made", 0),
        "log": _log_lines(trip, searches, getattr(provider, "calls_made", 0), mode),
    }
