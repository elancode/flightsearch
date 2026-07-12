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

## Live Duffel search

The query builder's **Run** button POSTs the search spec to a Python
serverless function (`api/search.py`) that prices it through the shared core
(`api/flightcore.py` — the same code the CLI uses) and returns ranked results
the three views render. Browsing a results screen without running shows the
built-in sample story (`src/data.ts`); both paths flow through one view-model
(`src/viewmodel.ts`).

- **`--mock`** runs synthetic prices with no token — good for a demo.
- **`live`** runs real Duffel pricing. This requires the token below.

### Required: `DUFFEL_ACCESS_TOKEN`

The Duffel token is read **server-side only** and never ships to the browser.
Set it in Vercel → project **Settings → Environment Variables**:

```
DUFFEL_ACCESS_TOKEN = duffel_live_...   (or duffel_test_ for sandbox fares)
```

Redeploy after adding it. Locally, `vercel dev` picks it up from a `.env`
(gitignored); or point the app at a deployed backend with
`VITE_API_BASE=https://your-app.vercel.app`.

### Notes

- Provider calls fan out in parallel with a tightened supplier timeout so a
  full search fits the serverless budget (`maxDuration` is set in
  `vercel.json`); a very large spec is capped server-side.
- Duffel **test** tokens return sandbox/Duffel Airways fares (mechanics only,
  not real savings). A **live** token returns real routes; searching is free —
  the tool never books.
- The CLI (`../flightarb.py`) shares `api/flightcore.py`, so the numbers on the
  web and in `report.md` come from the same planner and ranking.
