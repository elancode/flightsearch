// Sample ranked dataset for the results directions (1a/1b/1c).
//
// Per the handoff these three screens are static explorations that all
// consume the SAME ranked dataset — the SFO–TLV overnight story. When wired
// to the real backend this is what `run_trip` / `results.json` would return.

import { STRATEGY_COLOR, STRATEGY_FILL, CABIN_META, type Cabin, usd } from './types'

export interface RawRow {
  rank: number
  strat: 'UNIFORM_RT' | 'MIXED_RT' | 'SPLIT_ONEWAY'
  c1: Cabin
  c2: Cabin
  price: number
  credit: number
  eff: number
  save: number
  pnr: boolean
  rec?: boolean
}

export const MAX_EFF = 3320 // baseline effective cost — the bar-chart denominator

export const RAW_ROWS: RawRow[] = [
  { rank: 1, strat: 'SPLIT_ONEWAY', c1: 'BUSINESS', c2: 'ECONOMY', price: 2540, credit: 1500, eff: 1040, save: 2280, pnr: false },
  { rank: 2, strat: 'SPLIT_ONEWAY', c1: 'BUSINESS', c2: 'PREMIUM_ECONOMY', price: 2910, credit: 1750, eff: 1160, save: 1910, pnr: false },
  { rank: 3, strat: 'MIXED_RT', c1: 'BUSINESS', c2: 'ECONOMY', price: 2760, credit: 1500, eff: 1260, save: 2060, pnr: true, rec: true },
  { rank: 4, strat: 'UNIFORM_RT', c1: 'ECONOMY', c2: 'ECONOMY', price: 1290, credit: 0, eff: 1290, save: 3530, pnr: true },
  { rank: 5, strat: 'MIXED_RT', c1: 'BUSINESS', c2: 'PREMIUM_ECONOMY', price: 3180, credit: 1750, eff: 1430, save: 1640, pnr: true },
  { rank: 6, strat: 'UNIFORM_RT', c1: 'PREMIUM_ECONOMY', c2: 'PREMIUM_ECONOMY', price: 2180, credit: 750, eff: 1430, save: 2640, pnr: true },
]

export interface EnrichedRow extends RawRow {
  stratColor: string
  priceStr: string
  effStr: string
  creditStr: string
  saveStr: string
  c1abbr: string
  c1dot: string
  c2abbr: string
  c2dot: string
  barPct: number
  ratioStr: string
  flag: string
  recFlag: boolean
  recBorder: string
  rowBg: string
  barFill: string
}

export function enrich(r: RawRow): EnrichedRow {
  return {
    ...r,
    stratColor: STRATEGY_COLOR[r.strat],
    priceStr: usd(r.price),
    effStr: usd(r.eff),
    creditStr: usd(r.credit),
    saveStr: usd(r.save),
    c1abbr: CABIN_META[r.c1].abbr,
    c1dot: CABIN_META[r.c1].color,
    c2abbr: CABIN_META[r.c2].abbr,
    c2dot: CABIN_META[r.c2].color,
    barPct: Math.round((r.eff / MAX_EFF) * 100),
    ratioStr: (r.eff / MAX_EFF).toFixed(2) + '×',
    flag: r.pnr ? 'single PNR' : 'separate PNRs · no misconnect',
    recFlag: !!r.rec,
    recBorder: r.rec ? 'var(--accent)' : 'var(--line)',
    rowBg: r.rec ? 'var(--accent-tint)' : 'var(--surface)',
    barFill: r.rec ? 'var(--accent-tint)' : STRATEGY_FILL[r.strat],
  }
}

export const ROWS: EnrichedRow[] = RAW_ROWS.map(enrich)

export const BASELINE: EnrichedRow = {
  ...enrich({ rank: 0, strat: 'UNIFORM_RT', c1: 'BUSINESS', c2: 'BUSINESS', price: 4820, credit: 1500, eff: 3320, save: 0, pnr: true }),
  barPct: 100,
  ratioStr: '1.00×',
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

export const SEGS: Seg[] = [
  { leg: 'Leg 1', route: 'SFO → TLV', date: '2026-10-12', note: 'overnight · 15h 05m', flight: 'UA 954 · nonstop', cab: 'BUSINESS', cabAbbr: 'BUS', dot: 'var(--bus)' },
  { leg: 'Leg 2', route: 'TLV → SFO', date: '2026-10-26', note: 'daytime · 15h 55m', flight: 'UA 955 · nonstop', cab: 'ECONOMY', cabAbbr: 'ECO', dot: 'var(--eco)' },
]

export const LINKS = [
  { label: 'google flights · SFO→TLV business · Oct 12', href: '#' },
  { label: 'google flights · TLV→SFO economy · Oct 26', href: '#' },
]

export type LogKind = 'call' | 'res' | 'done'
export const LOG_COLOR: Record<LogKind, string> = {
  call: 'var(--muted)',
  res: 'var(--accent)',
  done: 'var(--pos)',
}

export const RUN_LOG: { t: string; k: LogKind }[] = [
  { t: 'pricing UNIFORM_RT     SFO-TLV + TLV-SFO  [BUSINESS]', k: 'call' },
  { t: 'pricing UNIFORM_RT     SFO-TLV + TLV-SFO  [PREMIUM_ECONOMY]', k: 'call' },
  { t: 'pricing UNIFORM_RT     SFO-TLV + TLV-SFO  [ECONOMY]', k: 'call' },
  { t: 'pricing MIXED_RT       SFO-TLV + TLV-SFO  [ALL CABINS]', k: 'call' },
  { t: '  → 148 offers across 4 cabin combos: (BUS,BUS) (BUS,PRM) (BUS,ECO) (ECO,ECO)', k: 'res' },
  { t: 'pricing ONEWAY         SFO-TLV           [BUSINESS] ×3', k: 'call' },
  { t: 'pricing ONEWAY         TLV-SFO           [ECONOMY] ×2', k: 'call' },
  { t: 'Provider calls made: 9   ·   report.md + results.json written', k: 'done' },
]
