# itsadeal.ai — web UI

Front-end for the constraint-based flight search tool (backend: `../flightarb.py`).
React + TypeScript + Vite, kept dependency-light to match the backend's spirit.

Implements the `Engineerfriendly_UX_design` handoff:

- **Query builder (2a)** — the primary, fully-interactive screen. Specify a
  trip (name, legs, per-leg acceptable cabins, optional via/stopover airports,
  constraints) and watch the **live call plan** update. The call-plan math in
  `src/planner.ts` is a faithful port of `plan_searches` / `cabin_combos` in
  `flightarb.py` (the default SFO–TLV two-leg spec totals **9** pricing calls).
- **Three results directions** — competing presentations of the same ranked
  dataset (`src/data.ts`), pending a product decision:
  - **1a Workbench** — two-pane spec + ranked options, recommended row expands
    inline. The everyday tool.
  - **1b Notebook** — In[1] → Out[1] flow: input cell, live pricing log,
    generated `report.md`. Leans into the tool's real CLI output.
  - **1c Benchmark** — winner card + effective-cost bar chart against the
    dashed baseline reference.

The top nav switches screens; the query builder's Run button jumps to Workbench.

## Design system

Tokens live in `src/tokens.css`, authored in `oklch()` (the source of truth per
the handoff). Type is IBM Plex Sans (chrome) + IBM Plex Mono (all data). Cabin
encoding is a colored dot + mono abbreviation (`ECO`/`PRM`/`BUS`/`FST`);
strategies are color-coded `UNIFORM_RT` → grey, `MIXED_RT` → accent,
`SPLIT_ONEWAY` → warn.

## Develop

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build → dist/
npm run preview    # serve the production build
```

## Wiring to the backend

The results screens currently render the sample ranked dataset from the
handoff. To go live, replace `src/data.ts` with a fetch of `results.json`
produced by `run_trip` (see `../flightarb.py`), and POST the query-builder
state to a thin endpoint that constructs a `TripSpec`.
