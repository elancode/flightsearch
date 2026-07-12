#!/usr/bin/env python3
"""
flightarb.py — validation script for constraint-based flight search decomposition.
Pricing backend: Duffel (Amadeus self-service was decommissioned July 2026).

Answers one question: for real trips, how often (and by how much) do
split tickets, mixed cabins, and per-leg cabin choice beat the naive
round-trip search that Kayak/Google/united.com perform?

Strategies per trip:
  1. UNIFORM_RT   — round-trip search per cabin (what every OTA does today).
                    The highest-cabin uniform RT is the naive baseline.
  2. MIXED_RT     — one PNR, different cabin per slice. Duffel has no
                    per-slice cabin filter, but unfiltered RT searches return
                    offers spanning all cabin/fare-brand combinations, so we
                    run ONE unfiltered search and post-bucket offers by their
                    actual per-slice cabins. One call covers every combo.
  3. SPLIT_ONEWAY — separate one-way tickets, cabin chosen per leg, all
                    combinations reassembled.

Ranking: effective cost = total price − Σ comfort_value(cabin obtained per
leg). "Business is worth $1500 to me on the overnight" is a first-class
input, not an afterthought.

Usage:
  export DUFFEL_ACCESS_TOKEN=duffel_test_...   # or duffel_live_...
  python flightarb.py trips.yaml               # live pricing
  python flightarb.py trips.yaml --dry-run     # show planned API calls
  python flightarb.py trips.yaml --mock        # synthetic prices, no token

Test-mode tokens hit airline sandboxes + Duffel Airways (synthetic but
reliable) — good for verifying mechanics, not for real fare numbers.
Live-mode tokens return real fares; searching is free, you only pay to book
(which this tool never does).

Output: ranked table per trip on stdout + report.md + results.json.
"""

from __future__ import annotations

import argparse
import hashlib
import itertools
import json
import os
import random
import sys
import time
import urllib.parse
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Optional

import requests
import yaml

# ---------------------------------------------------------------------------
# Constraint schema (this is the product spec)
# ---------------------------------------------------------------------------

CABIN_ORDER = ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]
DUFFEL_CABIN = {"economy": "ECONOMY", "premium_economy": "PREMIUM_ECONOMY",
                "business": "BUSINESS", "first": "FIRST"}


def cabin_rank(cabin: str) -> int:
    return CABIN_ORDER.index(cabin) if cabin in CABIN_ORDER else -1


@dataclass
class LegSpec:
    origin: str
    destination: str
    date: str                                  # YYYY-MM-DD
    cabins_acceptable: list[str]               # ordered by preference
    comfort_value: dict[str, float] = field(default_factory=dict)
    date_flex_days: int = 0                    # reserved for --flex sweep

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


def load_trips(path: str) -> list[TripSpec]:
    with open(path) as f:
        doc = yaml.safe_load(f)
    trips = []
    for t in doc["trips"]:
        c = t.get("constraints", {})
        legs = [
            LegSpec(
                origin=l["origin"].upper(),
                destination=l["destination"].upper(),
                date=str(l["date"]),
                cabins_acceptable=[x.upper() for x in l["cabins_acceptable"]],
                comfort_value={k.upper(): float(v)
                               for k, v in (l.get("comfort_value") or {}).items()},
                date_flex_days=int(l.get("date_flex_days", 0)),
            )
            for l in t["legs"]
        ]
        trips.append(TripSpec(
            name=t["name"],
            legs=legs,
            passengers=int(c.get("passengers", 1)),
            max_stops=int(c.get("max_stops", 1)),
            max_layover_minutes=int(c.get("max_layover_minutes", 240)),
            currency=c.get("currency", "USD"),
        ))
    return trips


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


@dataclass
class PricedItinerary:
    segments: list[Segment]

    def stops(self) -> int:
        return len(self.segments) - 1

    def layovers_minutes(self) -> list[int]:
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

    def flights_str(self) -> str:
        return ", ".join(f"{s.carrier}{s.number}" for s in self.segments)


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
    fare-brand combinations (its own docs note a single popular-route RT can
    return thousands of combinable itineraries) — that one response is then
    post-bucketed by per-slice cabin for the MIXED_RT strategy.
    """

    BASE = "https://api.duffel.com"

    def __init__(self, token: Optional[str] = None, sleep_s: float = 0.5,
                 supplier_timeout_ms: int = 15000):
        self.token = token or os.environ.get("DUFFEL_ACCESS_TOKEN", "")
        if not self.token:
            sys.exit("Set DUFFEL_ACCESS_TOKEN (dashboard at duffel.com), "
                     "or use --mock/--dry-run.")
        self.sleep_s = sleep_s
        self.supplier_timeout_ms = supplier_timeout_ms
        self._cache: dict[str, list[Offer]] = {}
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
        if key in self._cache:
            return self._cache[key]

        time.sleep(self.sleep_s)
        url = (f"{self.BASE}/air/offer_requests"
               f"?return_offers=true&supplier_timeout={self.supplier_timeout_ms}")
        r = requests.post(url, json=body, timeout=90, headers={
            "Authorization": f"Bearer {self.token}",
            "Duffel-Version": "v2",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
        })
        self.calls_made += 1
        if r.status_code >= 400:
            print(f"    ! Duffel {r.status_code}: {r.text[:300]}",
                  file=sys.stderr)
            self._cache[key] = []
            return []
        offers = self._parse(r.json(), leg_indices)
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
                    carrier = ((s.get("marketing_carrier") or {})
                               .get("iata_code")
                               or (s.get("operating_carrier") or {})
                               .get("iata_code") or "??")
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
                        ))
                    except (KeyError, TypeError):
                        ok = False
                        break
                if not ok:
                    break
                itins.append(PricedItinerary(segments=segs))
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


def run_trip(trip: TripSpec, provider, top_k: int = 3) -> list[RankedOption]:
    n = len(trip.legs)
    uniform, mixed, _ = cabin_combos(trip)
    options: list[RankedOption] = []
    oneway_offers: dict[int, list[Offer]] = {i: [] for i in range(n)}

    for s in plan_searches(trip):
        idxs, cabin = s["leg_indices"], s["cabin"]
        desc = " + ".join(f"{trip.legs[i].origin}-{trip.legs[i].destination}"
                          for i in idxs)
        print(f"  pricing {s['kind']:<34} {desc}"
              f" [{cabin or 'ALL CABINS'}]")
        offers = [o for o in provider.search(trip, idxs, cabin)
                  if o.passes(trip)]

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
            found = sorted(buckets.keys())
            print(f"    -> {len(offers)} offers across "
                  f"{len(buckets)} cabin combos: {found}")

    if all(oneway_offers[i] for i in range(n)) and n >= 2:
        for combo in itertools.product(*[oneway_offers[i] for i in range(n)]):
            options.append(make_option(
                trip, "SPLIT_ONEWAY", list(combo),
                ["separate PNRs — no misconnect protection",
                 f"{n} bookings"]))

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
    candidates = [o for o in ranked if o.strategy == "UNIFORM_RT"
                  and set(o.cabins_by_leg(len(trip.legs))) == {target}]
    return min(candidates, key=lambda o: o.total_price) if candidates else None


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

def fmt_money(x: float, cur: str) -> str:
    return f"{cur} {x:,.0f}"


def report_trip(trip: TripSpec, ranked: list[RankedOption]) -> str:
    n = len(trip.legs)
    cur = ranked[0].offers[0].currency if ranked else trip.currency
    lines = [f"## {trip.name}", ""]
    base = naive_baseline(trip, ranked)
    if base:
        lines.append(f"**Naive baseline** (uniform RT, "
                     f"{'/'.join(base.cabins_by_leg(n))}): "
                     f"{fmt_money(base.total_price, cur)}")
    else:
        lines.append("**Naive baseline unavailable** (no uniform-RT offers "
                     "at target cabin survived constraints — common in "
                     "Duffel test mode; use a live token for real numbers).")
    lines.append("")
    lines.append("| # | Strategy | Cabins (per leg) | Price | Comfort credit "
                 "| Effective cost | vs baseline | Flags |")
    lines.append("|---|----------|------------------|-------|----------------"
                 "|----------------|-------------|-------|")
    for i, opt in enumerate(ranked[:12], 1):
        vs = (fmt_money(base.total_price - opt.total_price, cur)
              if base else "—")
        lines.append(
            f"| {i} | {opt.strategy} | {'/'.join(opt.cabins_by_leg(n))} "
            f"| {fmt_money(opt.total_price, cur)} "
            f"| {fmt_money(opt.comfort_credit, cur)} "
            f"| {fmt_money(opt.effective_cost, cur)} "
            f"| {vs} | {'; '.join(opt.flags)} |")
    lines.append("")
    if ranked:
        top = ranked[0]
        lines.append(f"**Top option detail** — {top.label}:")
        for off in top.offers:
            for itin, leg_idx in zip(off.itineraries, off.leg_indices):
                leg = trip.legs[leg_idx]
                lines.append(
                    f"- Leg {leg_idx + 1} {leg.origin}→{leg.destination} "
                    f"{leg.date}: {itin.route_str()} ({itin.flights_str()}), "
                    f"cabin {itin.min_cabin()}, stops {itin.stops()}")
        lines.append("")
        lines.append("Booking links (search handoff):")
        for link in top.links:
            lines.append(f"- {link}")
        lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(
        description="Flight decomposition validation (Duffel backend)")
    ap.add_argument("trips_file")
    ap.add_argument("--dry-run", action="store_true",
                    help="print planned API calls, don't execute")
    ap.add_argument("--mock", action="store_true",
                    help="synthetic prices; no token needed")
    ap.add_argument("--top-k", type=int, default=3)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--supplier-timeout-ms", type=int, default=15000)
    ap.add_argument("--out", default="report.md")
    args = ap.parse_args()

    trips = load_trips(args.trips_file)

    if args.dry_run:
        total = 0
        for trip in trips:
            searches = plan_searches(trip)
            print(f"\n{trip.name}: {len(searches)} pricing calls")
            for s in searches:
                desc = " + ".join(
                    f"{trip.legs[i].origin}-{trip.legs[i].destination}"
                    for i in s["leg_indices"])
                cab = s["cabin"] or "ALL"
                print(f"  {s['kind']:<34} {desc} [{cab}]")
            total += len(searches)
        print(f"\nTotal API calls: {total}")
        return

    provider = (MockProvider(seed=args.seed) if args.mock
                else DuffelProvider(
                    supplier_timeout_ms=args.supplier_timeout_ms))

    mode = "MOCK (synthetic prices)" if args.mock else "LIVE Duffel"
    if not args.mock:
        tok = os.environ.get("DUFFEL_ACCESS_TOKEN", "")
        if tok.startswith("duffel_test_"):
            mode = ("Duffel TEST MODE — sandbox/Duffel Airways data; "
                    "verifies mechanics, not real fares")
    report = ["# Flight decomposition validation report",
              f"_Generated {datetime.now():%Y-%m-%d %H:%M}_",
              f"_Mode: {mode}_", ""]
    all_results = []

    for trip in trips:
        print(f"\n=== {trip.name} ===")
        ranked = run_trip(trip, provider, args.top_k)
        base = naive_baseline(trip, ranked)
        block = report_trip(trip, ranked)
        report.append(block)
        print()
        print(block)
        all_results.append({
            "trip": trip.name,
            "baseline_price": base.total_price if base else None,
            "options": [{
                "strategy": o.strategy,
                "cabins": o.cabins_by_leg(len(trip.legs)),
                "price": o.total_price,
                "currency": o.offers[0].currency,
                "comfort_credit": o.comfort_credit,
                "effective_cost": o.effective_cost,
                "flags": o.flags,
                "links": o.links,
            } for o in ranked],
        })

    with open(args.out, "w") as f:
        f.write("\n".join(report))
    with open("results.json", "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"\nProvider calls made: {provider.calls_made}")
    print(f"Wrote {args.out} and results.json")


if __name__ == "__main__":
    main()
