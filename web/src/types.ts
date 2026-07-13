// State model for the query builder (screen 2a), mirroring the handoff.
// Cabin enum is uppercase internally, matching flightarb.py (CABIN_ORDER).

export const CABINS = ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'] as const
export type Cabin = (typeof CABINS)[number]

export type Mode = 'mock' | 'dry' | 'live'

export interface Leg {
  origin: string // 3-letter IATA, uppercased
  destination: string
  via: string[] // preferred stopover / connecting airports (open-item control)
  date: string // yyyy-mm-dd
  cabins: Record<Cabin, boolean>
  comfort: Partial<Record<Cabin, number>> // $ worth per cabin; used by ranking, not entered here
}

export interface Constraints {
  maxStops: number
  maxLayover: number
  passengers: number
  currency: string
}

export interface QueryState {
  name: string
  mode: Mode
  legs: Leg[]
  constraints: Constraints
}

// Per-cabin display metadata (abbreviation + dot colour + chip label).
export const CABIN_META: Record<
  Cabin,
  { abbr: string; color: string; chip: string; full: string }
> = {
  ECONOMY: { abbr: 'ECO', color: 'var(--eco)', chip: 'ECONOMY', full: 'ECONOMY' },
  PREMIUM_ECONOMY: {
    abbr: 'PRM',
    color: 'var(--prm)',
    chip: 'PREM ECON',
    full: 'PREMIUM ECONOMY',
  },
  BUSINESS: { abbr: 'BUS', color: 'var(--bus)', chip: 'BUSINESS', full: 'BUSINESS' },
  FIRST: { abbr: 'FST', color: 'var(--first)', chip: 'FIRST', full: 'FIRST' },
}

export const STRATEGY_COLOR: Record<string, string> = {
  UNIFORM_RT: 'var(--eco)',
  MIXED_RT: 'var(--accent)',
  SPLIT_ONEWAY: 'var(--warn)',
  ONEWAY: 'var(--prm)',
}

export const STRATEGY_FILL: Record<string, string> = {
  UNIFORM_RT: 'oklch(0.93 0.006 260)',
  MIXED_RT: 'var(--accent-tint)',
  SPLIT_ONEWAY: 'var(--warn-tint)',
  ONEWAY: 'var(--prm-tint)',
}

export const cabinRank = (c: Cabin): number => CABINS.indexOf(c)

export const usd = (n: number): string => '$' + n.toLocaleString('en-US')
