# flightarb — flight decomposition validation (Duffel backend)

Tests the core product hypothesis: **do split tickets, mixed cabins, and
per-leg cabin choice regularly beat the naive round-trip search by enough
money to matter?**

> Provider note: originally built on Amadeus Self-Service, ported to Duffel
> after Amadeus announced its self-service portal shuts down July 17, 2026
> (registration already closed). Duffel content comes from direct airline
> connections (NDC-inclusive), which is better coverage anyway.

## Quick start

```bash
pip install requests pyyaml

# Validate pipeline with synthetic prices (no token needed):
python flightarb.py trips.yaml --mock

# See exactly which pricing calls will be made:
python flightarb.py trips.yaml --dry-run

# Run against Duffel (token from the dashboard at duffel.com — signup ~1 min):
export DUFFEL_ACCESS_TOKEN=duffel_test_...   # or duffel_live_...
python flightarb.py trips.yaml
```

Output: ranked table per trip on stdout, plus `report.md` and `results.json`.

**Test vs live mode matters here:**
- `duffel_test_` tokens hit airline sandboxes plus Duffel's own synthetic
  airline (Duffel Airways). Sandboxes are flaky and fares are not real —
  use test mode to verify mechanics only.
- `duffel_live_` tokens return real fares. **Searching is free** — you only
  pay Duffel when booking, which this tool never does. Real SFO–TLV
  validation numbers require live mode.

## The constraint schema (this is the product spec)

```yaml
trips:
  - name: "SFO-TLV, premium eastbound overnight"
    legs:
      - origin: SFO
        destination: TLV
        date: 2026-10-12
        cabins_acceptable: [BUSINESS, PREMIUM_ECONOMY, ECONOMY]
        comfort_value:          # what each cabin is WORTH TO YOU on this
          BUSINESS: 1500        # leg, in $. "Flat bed matters on the
          PREMIUM_ECONOMY: 500  #  overnight, not on the daytime return."
      - origin: TLV
        destination: SFO
        date: 2026-10-26
        cabins_acceptable: [ECONOMY, PREMIUM_ECONOMY]
        comfort_value:
          PREMIUM_ECONOMY: 250
    constraints:
      max_stops: 1
      max_layover_minutes: 240
      passengers: 1
```

Ranking is by **effective cost = price − Σ comfort_value(cabin obtained per
leg)**. The tool will happily conclude "business isn't worth it this week"
when the premium exceeds your stated value — that honesty is the product.

The **naive baseline** (uniform RT at the trip-level cabin a Kayak user
would select) is always priced; every savings claim is measured against it.

## How each strategy is priced on Duffel

- **UNIFORM_RT / ONEWAY**: standard offer requests with `cabin_class` and
  `max_connections` filters (passed down to airlines: more relevant results,
  faster).
- **MIXED_RT**: Duffel has no per-slice cabin filter, but an *unfiltered*
  RT search returns offers spanning all cabin/fare-brand combinations
  (thousands on popular routes). We run ONE unfiltered search and
  post-bucket offers by their actual per-slice cabins — every mixed combo
  priced from a single consistent inventory snapshot. The run log prints
  which cabin combos were actually found in the response.
- **SPLIT_ONEWAY**: cartesian reassembly of per-leg one-way offers, flagged
  "separate PNRs — no misconnect protection."

Call counts stay small: the two example trips need 15 calls total.

## Validation criteria

Run weekly for 3–4 weeks across your real routes (add long-haul premium
routes to the YAML), then analyze `results.json` across runs:

- **Median savings** of best non-naive strategy vs baseline. Regularly
  $400+ on premium long-haul = the landing page writes itself.
- **Hit rate**: fraction of trips where MIXED_RT or SPLIT beats the
  baseline at equal-or-better cabins.
- **Where wins come from** (mixed-cabin vs split) → which capability to
  lead with in the product.

## Known limits (deliberate v0 scope)

- Date-flex sweep not implemented yet (`date_flex_days` parsed but unused).
- Duffel coverage: strong on direct/NDC connections; a few carriers may be
  absent vs GDS. Multi-source is the long-term answer (the Amadeus shutdown
  is the proof).
- Duffel prices in your org's settlement currency; the report displays
  whatever currency comes back.
- Duffel's per-slice-selection flow (Partial Offer Requests) is deprecated;
  we deliberately avoid it. Watch for its successor — that will be the
  product-grade path for guided per-leg cabin picking.

## Lift path to product

`plan_searches()` + `run_trip()` + ranking are the backend. `DuffelProvider`
is behind a small interface (see `MockProvider`) — adding a second source
is one class. Put the YAML schema behind a form, stream `RankedOption`s to
a UI, keep the deep-link handoff.
