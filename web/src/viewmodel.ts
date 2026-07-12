// View-model shared by the results directions (1a/1b/1c).
//
// Both the live /api/search response and the built-in sample story are
// projected into a single `ResultsView` shape, so the three result screens
// render identically whether they're showing real Duffel prices or the demo.

import {
  CABINS,
  CABIN_META,
  STRATEGY_COLOR,
  STRATEGY_FILL,
  type Cabin,
  type QueryState,
  usd,
} from './types'
import { legRole } from './planner'

// ---- API response shape (mirrors flightcore.run_trip_result) -------------

export interface ApiSeg {
  leg_index: number
  leg: string
  origin: string
  destination: string
  route: string
  date: string
  cabin: Cabin
  flights: string
  stops: number
  note: string
}

export interface ApiOption {
  strategy: 'UNIFORM_RT' | 'MIXED_RT' | 'SPLIT_ONEWAY'
  cabins: Cabin[]
  price: number
  comfort_credit: number
  effective: number
  save: number | null
  single_pnr: boolean
  flags: string[]
  links: string[]
  segments: ApiSeg[]
}

export interface SearchResponse {
  ok: boolean
  error?: string
  warning?: string
  dry?: boolean
  mode: string
  currency: string
  trip_name: string
  baseline: { cabins: Cabin[]; price: number; comfort_credit: number; effective: number } | null
  options: ApiOption[]
  recommended_index: number | null
  calls_made: number
  log: { t: string; k: 'call' | 'res' | 'done' }[]
}

// ---- view-model shapes ---------------------------------------------------

export interface Row {
  rank: number
  strat: string
  stratColor: string
  cabins: Cabin[]
  c1abbr: string
  c1dot: string
  c2abbr: string
  c2dot: string
  price: number
  eff: number
  save: number | null
  cheaper: boolean | null // vs baseline; null when no baseline priced
  priceStr: string
  effStr: string
  creditStr: string
  saveStr: string // magnitude only; sign comes from `cheaper`
  flag: string
  recFlag: boolean
  recBorder: string
  rowBg: string
  barFill: string
  barPct: number
  ratioStr: string
}

export interface Seg {
  leg: string
  route: string
  date: string
  note: string
  flight: string
  cab: Cabin
  cabAbbr: string
  dot: string
}

export interface SpecLeg {
  n: number
  role: string
  route: string
  date: string
  badge?: string
  cabins: { cabin: Cabin; abbr: string; color: string; comfort: number }[]
  via: string[]
}

export interface ResultsView {
  live: boolean
  statusKind: 'sample' | 'mock' | 'live'
  tripName: string
  currency: string
  mode: string
  callsMade: number
  warning?: string
  spec: { name: string; legs: SpecLeg[]; constraints: string[] }
  rows: Row[]
  baseline: Row | null
  baselineCabinStr: string
  segs: Seg[]
  links: { label: string; href: string }[]
  recIndex: number
  maxEff: number
  runLog: { t: string; k: 'call' | 'res' | 'done' }[]
}

const cabinsFlow = (cabins: Cabin[]): [Cabin, Cabin] => {
  const c1 = cabins[0] ?? 'ECONOMY'
  const c2 = cabins[cabins.length - 1] ?? c1
  return [c1, c2]
}

function makeRow(
  o: ApiOption,
  rank: number,
  maxEff: number,
  isRec: boolean,
): Row {
  const [c1, c2] = cabinsFlow(o.cabins)
  return {
    rank,
    strat: o.strategy,
    stratColor: STRATEGY_COLOR[o.strategy] ?? 'var(--eco)',
    cabins: o.cabins,
    c1abbr: CABIN_META[c1].abbr,
    c1dot: CABIN_META[c1].color,
    c2abbr: CABIN_META[c2].abbr,
    c2dot: CABIN_META[c2].color,
    price: o.price,
    eff: o.effective,
    save: o.save,
    cheaper: o.save == null ? null : o.save >= 0,
    priceStr: usd(Math.round(o.price)),
    effStr: usd(Math.round(o.effective)),
    creditStr: usd(Math.round(o.comfort_credit)),
    saveStr: o.save == null ? '—' : usd(Math.abs(Math.round(o.save))),
    flag: o.single_pnr ? 'single PNR' : 'separate PNRs · no misconnect',
    recFlag: isRec,
    recBorder: isRec ? 'var(--accent)' : 'var(--line)',
    rowBg: isRec ? 'var(--accent-tint)' : 'var(--surface)',
    barFill: isRec ? 'var(--accent-tint)' : STRATEGY_FILL[o.strategy] ?? 'var(--tint)',
    barPct: maxEff > 0 ? Math.max(2, Math.round((o.effective / maxEff) * 100)) : 0,
    ratioStr: maxEff > 0 ? (o.effective / maxEff).toFixed(2) + '×' : '—',
  }
}

function segFrom(s: ApiSeg): Seg {
  const meta = CABIN_META[s.cabin] ?? CABIN_META.ECONOMY
  return {
    leg: s.leg,
    route: s.route,
    date: s.date,
    note: s.note,
    flight: s.flights + (s.stops === 0 ? ' · nonstop' : ` · ${s.stops} stop`),
    cab: s.cabin,
    cabAbbr: meta.abbr,
    dot: meta.color,
  }
}

/** Build the read-only spec panel from the submitted query state. */
export function buildSpec(state: QueryState): ResultsView['spec'] {
  const n = state.legs.length
  const legs: SpecLeg[] = state.legs.map((l, i) => {
    const accepted = CABINS.filter((c) => l.cabins[c])
    return {
      n: i + 1,
      role: legRole(i, n),
      route: `${l.origin || '???'} → ${l.destination || '???'}`,
      date: l.date,
      cabins: accepted.map((c) => ({
        cabin: c,
        abbr: CABIN_META[c].abbr,
        color: CABIN_META[c].color,
        comfort: l.comfort[c] ?? 0,
      })),
      via: l.via.filter(Boolean),
    }
  })
  const c = state.constraints
  const constraints = [
    `max_stops ≤ ${c.maxStops}`,
    `layover ≤ ${c.maxLayover}m`,
    `${c.passengers} adult${c.passengers > 1 ? 's' : ''}`,
    c.currency,
  ]
  return { name: state.name, legs, constraints }
}

/** Project a live API response (+ the query that produced it) into a view. */
export function mapResult(state: QueryState, res: SearchResponse): ResultsView {
  const recIndex = res.recommended_index ?? -1
  const maxEff = res.baseline?.effective ?? Math.max(...res.options.map((o) => o.effective), 1)

  const rows = res.options.map((o, i) => makeRow(o, i + 1, maxEff, i === recIndex))

  let baseline: Row | null = null
  let baselineCabinStr = '—'
  if (res.baseline) {
    baselineCabinStr = res.baseline.cabins.map((c) => CABIN_META[c].abbr).join('/')
    baseline = makeRow(
      {
        strategy: 'UNIFORM_RT',
        cabins: res.baseline.cabins,
        price: res.baseline.price,
        comfort_credit: res.baseline.comfort_credit,
        effective: res.baseline.effective,
        save: 0,
        single_pnr: true,
        flags: ['single PNR'],
        links: [],
        segments: [],
      },
      0,
      maxEff,
      false,
    )
    baseline.barPct = 100
    baseline.ratioStr = '1.00×'
    baseline.barFill = 'var(--warn-tint)'
  }

  const rec = recIndex >= 0 ? res.options[recIndex] : undefined
  const segs = (rec?.segments ?? []).map(segFrom)
  const links = (rec?.links ?? []).map((href, i) => ({
    label: segs[i]
      ? `google flights · ${segs[i].route.replace(' → ', '→')} ${segs[i].cab.toLowerCase().replace('_', ' ')} · ${segs[i].date}`
      : `book segment ${i + 1}`,
    href,
  }))

  return {
    live: res.mode === 'live',
    statusKind: res.mode === 'live' ? 'live' : 'mock',
    tripName: res.trip_name || state.name,
    currency: res.currency,
    mode: res.mode,
    callsMade: res.calls_made,
    warning: res.warning,
    spec: buildSpec(state),
    rows,
    baseline,
    baselineCabinStr,
    segs,
    links,
    recIndex,
    maxEff,
    runLog: res.log,
  }
}
