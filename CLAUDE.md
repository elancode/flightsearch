# flightarb

Validation tool for a potential product: constraint-based flight search that
finds combinations OTAs can't/won't surface (mixed cabins, split tickets,
per-leg cabin choice), ranked by the user's utility function.

## Product hypothesis being validated
Split/mixed strategies regularly beat the naive round-trip search by enough
($400+ on premium long-haul) to justify a subscription product. v1 is
search-and-deep-link only — NO booking (no ARC/IATA, no liability; user
books on airline site via handoff links). The overnight-leg optimizer is
the launch wedge: "premium seat on the leg where it matters, lowest total
cost."

## Architecture
- `flightarb.py` — single module, deliberately liftable into a product
  backend later. Components:
  - Constraint schema (`TripSpec`/`LegSpec`, loaded from `trips.yaml`).
    **The YAML schema is the product spec.** Key concept: `comfort_value` =
    $ worth of each cabin per leg; ranking is by
    `effective_cost = price − Σ comfort_value(cabin obtained)`.
  - Provider interface: `search(trip, leg_indices, cabin|None) -> [Offer]`.
    Implementations: `DuffelProvider` (live), `MockProvider` (synthetic,
    for pipeline testing). Multi-provider is a deliberate strategic choice.
  - Planner (`plan_searches`, `run_trip`): enumerates UNIFORM_RT, MIXED_RT,
    SPLIT_ONEWAY strategies; dedups; ranks by effective cost.
  - Naive baseline (uniform RT at trip-level target cabin) is ALWAYS priced
    — it's what Kayak does and every savings claim is measured against it.
- Run modes: `--mock` (no token), `--dry-run` (print call plan), live.

## Key decisions & history (don't relitigate without reason)
- **Amadeus is dead**: self-service portal decommissioned 2026-07-17,
  registration already closed. We ported from Amadeus to Duffel 2026-07-11.
  Lesson encoded in the architecture: data access is the strategic risk,
  hence the provider interface.
- **Duffel MIXED_RT technique**: Duffel's `cabin_class` filter is
  request-level, not per-slice. Mixed-cabin combos are obtained by ONE
  unfiltered RT search, post-bucketed by each offer's actual per-slice
  cabins (`Offer.cabins_tuple()`). Duffel returns fare-brand combinations
  in unfiltered results. Do NOT use Partial Offer Requests — deprecated.
- Test tokens (`duffel_test_`) hit sandboxes/Duffel Airways: mechanics
  only, fake fares. Real validation numbers need `duffel_live_` token
  (searching is free; we never book).
- Never generate .docx outputs; markdown only.

## Conventions
- Python 3.12, deps: requests, pyyaml only. Keep it dependency-light.
- Cabin enum uppercase internally (`ECONOMY`, `PREMIUM_ECONOMY`,
  `BUSINESS`, `FIRST`); Duffel uses lowercase (map at the boundary).
- Token via `DUFFEL_ACCESS_TOKEN` env var (or `.env`, gitignored).
  NEVER commit or print tokens.
- Outputs: `report.md` (human), `results.json` (analysis across runs).

## Commands
```bash
python flightarb.py trips.yaml --mock      # pipeline check, no token
python flightarb.py trips.yaml --dry-run   # show planned API calls
python flightarb.py trips.yaml             # live (needs DUFFEL_ACCESS_TOKEN)
```

## Backlog (rough priority)
1. Live run in test mode → fix any parsing surprises from real Duffel
   payloads (only mock-validated so far).
2. Live-mode run on real routes (SFO-TLV, SFO-PMI) → first real
   savings numbers vs baseline.
3. `results.json` history: append runs with timestamps; small analysis
   script for median savings + hit rate across weeks.
4. Date-flex sweep (`date_flex_days` is parsed but unused): ±N days
   per leg; watch call-count explosion, add a budget cap.
5. Nonstop-preference / time-of-day constraints in schema.
6. Second provider behind the interface (candidates: Kiwi Tequila,
   SerpAPI Google Flights for verification) — do after live numbers.
7. If validation succeeds: PRFAQ (lean markdown, Working Backwards
   format) around the overnight-leg optimizer wedge, with real
   screenshots/numbers from report.md.
