// Call-plan computation for the query builder.
//
// This mirrors flightarb.py's `plan_searches` / `cabin_combos` and the
// reference `renderVals()` in the design prototype. Keep it faithful: the
// aside panel's live number must match what the backend would actually spend.
//
//   UNIFORM_RT — one call per cabin in the intersection of every leg's
//                accepted set, plus the computed naive-baseline cabin
//                (highest "last option" across legs), de-duplicated. Only
//                when there are >= 2 legs.
//   MIXED_RT   — exactly one unfiltered call, IF >= 2 legs, every leg has a
//                cabin, and some cross-leg combo uses more than one cabin.
//                That one response is post-bucketed into every mixed combo.
//   ONEWAY     — sum over legs of that leg's accepted-cabin count.

import { CABINS, type Cabin, type Leg, cabinRank, CABIN_META } from './types'

export interface PlanLine {
  label: string
  meta: string
}

export interface CallPlan {
  total: number
  uniformCount: number
  mixedExists: boolean
  onewayCount: number
  lines: PlanLine[]
}

export interface Validation {
  errs: string[]
  valid: boolean
}

/** Accepted cabins per leg, in canonical rank order. */
function acceptedCabins(legs: Leg[]): Cabin[][] {
  return legs.map((l) => CABINS.filter((c) => l.cabins[c]))
}

export function computePlan(legs: Leg[]): CallPlan {
  const n = legs.length
  const acc = acceptedCabins(legs)

  // UNIFORM_RT: intersection of all legs' accepted sets + baseline cabin.
  const inter = CABINS.filter((c) => acc.every((a) => a.includes(c)))
  let baselineCab: Cabin | null = null
  acc.forEach((a) => {
    if (a.length) {
      const p = a[a.length - 1] // this leg's "last option" (highest accepted)
      if (baselineCab === null || cabinRank(p) > cabinRank(baselineCab)) baselineCab = p
    }
  })
  const uni = new Set<Cabin>(inter)
  if (baselineCab) uni.add(baselineCab)
  const uniformCount = n >= 2 ? uni.size : 0

  // MIXED_RT: 1 iff some cross-leg cabin combination uses >1 distinct cabin.
  let mixedExists = false
  if (n >= 2 && acc.every((a) => a.length)) {
    const prod = acc.reduce<Cabin[][]>(
      (pre, a) => pre.flatMap((p) => a.map((c) => [...p, c])),
      [[]],
    )
    mixedExists = prod.some((combo) => new Set(combo).size > 1)
  }

  // ONEWAY: sum of per-leg accepted-cabin counts.
  const onewayCount = acc.reduce((s, a) => s + a.length, 0)

  const total = uniformCount + (mixedExists ? 1 : 0) + onewayCount

  const lines: PlanLine[] = []
  if (n >= 2) {
    lines.push({
      label: 'UNIFORM_RT × ' + uniformCount,
      meta: [...uni]
        .sort((a, b) => cabinRank(b) - cabinRank(a))
        .map((c) => CABIN_META[c].abbr)
        .join(' '),
    })
    if (mixedExists) {
      lines.push({ label: 'MIXED_RT × 1', meta: 'ALL CABINS · post-bucketed' })
    }
  }
  legs.forEach((l, i) => {
    if (acc[i].length) {
      const via = l.via.filter(Boolean).length ? ' · via ' + l.via.filter(Boolean).join('/') : ''
      lines.push({
        label: 'ONEWAY × ' + acc[i].length,
        meta:
          (l.origin || '???') +
          '–' +
          (l.destination || '???') +
          ' · ' +
          acc[i].map((c) => CABIN_META[c].abbr).join(' ') +
          via,
      })
    }
  })

  return { total, uniformCount, mixedExists, onewayCount, lines }
}

export function validate(legs: Leg[]): Validation {
  const acc = acceptedCabins(legs)
  const errs: string[] = []
  legs.forEach((l, i) => {
    if (!l.origin || !l.destination) errs.push('Leg ' + (i + 1) + ' route incomplete')
    else if (!l.date) errs.push('Leg ' + (i + 1) + ' date missing')
    else if (acc[i].length === 0) errs.push('Leg ' + (i + 1) + ' needs a cabin')
  })
  return { errs, valid: errs.length === 0 }
}

/** Role pill text: one-way / outbound / via / return. */
export function legRole(index: number, count: number): string {
  if (count === 1) return 'one-way'
  if (index === 0) return 'outbound'
  if (index === count - 1) return 'return'
  return 'via'
}
