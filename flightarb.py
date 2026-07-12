#!/usr/bin/env python3
"""flightarb.py — CLI for constraint-based flight search decomposition.

Answers one question: for real trips, how often (and by how much) do
split tickets, mixed cabins, and per-leg cabin choice beat the naive
round-trip search that Kayak/Google/united.com perform?

The reusable core (schema, providers, planner, ranking) lives in
`web/api/flightcore.py` so the CLI and the web backend (`web/api/search.py`)
share one implementation. This file is the CLI shell: YAML loading, the
dry-run/mock/live modes, and the markdown + JSON report.

Strategies per trip:
  1. UNIFORM_RT   — round-trip search per cabin (what every OTA does today).
                    The highest-cabin uniform RT is the naive baseline.
  2. MIXED_RT     — one PNR, different cabin per slice. One unfiltered RT
                    search is post-bucketed by each offer's actual per-slice
                    cabins. One call covers every combo.
  3. SPLIT_ONEWAY — separate one-way tickets, cabin chosen per leg, all
                    combinations reassembled.

Ranking: effective cost = total price − Σ comfort_value(cabin obtained per
leg).

Usage:
  export DUFFEL_ACCESS_TOKEN=duffel_test_...   # or duffel_live_...
  python flightarb.py trips.yaml               # live pricing
  python flightarb.py trips.yaml --dry-run     # show planned API calls
  python flightarb.py trips.yaml --mock        # synthetic prices, no token

Output: ranked table per trip on stdout + report.md + results.json.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from typing import Optional

import yaml

# Share the core with the web backend (web/api/flightcore.py).
sys.path.insert(0, os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "web", "api"))
from flightcore import (  # noqa: E402
    DuffelProvider, LegSpec, MockProvider, RankedOption, TripSpec,
    cabin_combos, naive_baseline, plan_searches, run_trip,
)


# ---------------------------------------------------------------------------
# Trip loading (YAML is the product spec; CLI-only, so it lives here)
# ---------------------------------------------------------------------------

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
                via=[x.upper() for x in (l.get("via") or [])],
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

    if args.mock:
        provider = MockProvider(seed=args.seed)
    else:
        tok = os.environ.get("DUFFEL_ACCESS_TOKEN", "")
        if not tok:
            sys.exit("Set DUFFEL_ACCESS_TOKEN (dashboard at duffel.com), "
                     "or use --mock/--dry-run.")
        provider = DuffelProvider(supplier_timeout_ms=args.supplier_timeout_ms)

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
