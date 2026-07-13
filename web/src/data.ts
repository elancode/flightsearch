// Built-in sample story (SFO–TLV overnight) for browsing the results
// directions without running a live search. It is expressed as a canned
// SearchResponse + the query that produced it, then projected through the
// exact same `mapResult` the live API path uses — so the demo and real
// results render through one code path.

import type { QueryState } from './types'
import { mapResult, type ApiOption, type SearchResponse } from './viewmodel'

const SAMPLE_STATE: QueryState = {
  name: 'SFO–TLV, premium eastbound overnight',
  mode: 'live',
  legs: [
    {
      origin: 'SFO',
      destination: 'TLV',
      via: [],
      date: '2026-10-12',
      cabins: { ECONOMY: true, PREMIUM_ECONOMY: true, BUSINESS: true, FIRST: false },
      comfort: { PREMIUM_ECONOMY: 500, BUSINESS: 1500 },
    },
    {
      origin: 'TLV',
      destination: 'SFO',
      via: [],
      date: '2026-10-26',
      cabins: { ECONOMY: true, PREMIUM_ECONOMY: true, BUSINESS: false, FIRST: false },
      comfort: { PREMIUM_ECONOMY: 250 },
    },
  ],
  constraints: { maxStops: 1, maxLayover: 240, passengers: 1, currency: 'USD' },
}

const REC_SEGMENTS = [
  {
    leg_index: 0,
    leg: 'Leg 1',
    origin: 'SFO',
    destination: 'TLV',
    route: 'SFO → TLV',
    path: 'SFO → TLV',
    stops_codes: [],
    airlines: ['United'],
    date: '2026-10-12',
    cabin: 'BUSINESS' as const,
    flights: 'UA 954',
    stops: 0,
    note: 'overnight · 15h 05m',
  },
  {
    leg_index: 1,
    leg: 'Leg 2',
    origin: 'TLV',
    destination: 'SFO',
    route: 'TLV → SFO',
    path: 'TLV → SFO',
    stops_codes: [],
    airlines: ['United'],
    date: '2026-10-26',
    cabin: 'ECONOMY' as const,
    flights: 'UA 955',
    stops: 0,
    note: 'daytime · 15h 55m',
  },
]

const opt = (
  strategy: ApiOption['strategy'],
  cabins: ApiOption['cabins'],
  price: number,
  credit: number,
  save: number,
  single_pnr: boolean,
  segments: ApiOption['segments'] = [],
): ApiOption => ({
  strategy,
  cabins,
  price,
  comfort_credit: credit,
  effective: price - credit,
  save,
  single_pnr,
  flags: single_pnr ? ['single PNR'] : ['separate PNRs — no misconnect protection'],
  links: segments.map(() => '#'),
  segments,
})

const SAMPLE_RESPONSE: SearchResponse = {
  ok: true,
  mode: 'live',
  currency: 'USD',
  trip_name: SAMPLE_STATE.name,
  baseline: { cabins: ['BUSINESS', 'BUSINESS'], price: 4820, comfort_credit: 1500, effective: 3320 },
  options: [
    opt('SPLIT_ONEWAY', ['BUSINESS', 'ECONOMY'], 2540, 1500, 2280, false),
    opt('SPLIT_ONEWAY', ['BUSINESS', 'PREMIUM_ECONOMY'], 2910, 1750, 1910, false),
    opt('MIXED_RT', ['BUSINESS', 'ECONOMY'], 2760, 1500, 2060, true, REC_SEGMENTS),
    opt('UNIFORM_RT', ['ECONOMY', 'ECONOMY'], 1290, 0, 3530, true),
    opt('MIXED_RT', ['BUSINESS', 'PREMIUM_ECONOMY'], 3180, 1750, 1640, true),
    opt('UNIFORM_RT', ['PREMIUM_ECONOMY', 'PREMIUM_ECONOMY'], 2180, 750, 2640, true),
  ],
  recommended_index: 2,
  calls_made: 9,
  log: [
    { t: 'pricing UNIFORM_RT     SFO-TLV + TLV-SFO  [BUSINESS]', k: 'call' },
    { t: 'pricing UNIFORM_RT     SFO-TLV + TLV-SFO  [PREMIUM_ECONOMY]', k: 'call' },
    { t: 'pricing UNIFORM_RT     SFO-TLV + TLV-SFO  [ECONOMY]', k: 'call' },
    { t: 'pricing MIXED_RT       SFO-TLV + TLV-SFO  [ALL CABINS]', k: 'call' },
    { t: '  → 148 offers across 4 cabin combos: (BUS,BUS) (BUS,PRM) (BUS,ECO) (ECO,ECO)', k: 'res' },
    { t: 'pricing ONEWAY         SFO-TLV           [BUSINESS] ×3', k: 'call' },
    { t: 'pricing ONEWAY         TLV-SFO           [ECONOMY] ×2', k: 'call' },
    { t: 'Provider calls made: 9   ·   report.md + results.json written', k: 'done' },
  ],
}

export const SAMPLE_VIEW = {
  ...mapResult(SAMPLE_STATE, SAMPLE_RESPONSE),
  live: false,
  statusKind: 'sample' as const,
}
