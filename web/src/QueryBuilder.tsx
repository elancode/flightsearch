import { useMemo, useState } from 'react'
import './querybuilder.css'
import {
  CABINS,
  CABIN_META,
  type Cabin,
  type Leg,
  type Mode,
  type QueryState,
} from './types'
import { computePlan, validate, legRole } from './planner'

const SEED: QueryState = {
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

const MODES: Record<
  Mode,
  { run: string; token: string; dot: string; primary: boolean }
> = {
  mock: { run: 'Run (mock prices)', token: 'synthetic prices · no token needed', dot: 'var(--muted)', primary: true },
  dry: { run: 'Preview call plan', token: 'plan only · no calls sent', dot: 'var(--muted)', primary: false },
  live: { run: 'Run search', token: 'duffel_live_••••••4a2f · authorized', dot: 'var(--pos)', primary: true },
}

const MODE_BTNS: { key: Mode; label: string }[] = [
  { key: 'mock', label: '--mock' },
  { key: 'dry', label: '--dry-run' },
  { key: 'live', label: 'live' },
]

const emptyLeg = (): Leg => ({
  origin: '',
  destination: '',
  via: [],
  date: '',
  cabins: { ECONOMY: true, PREMIUM_ECONOMY: false, BUSINESS: false, FIRST: false },
  comfort: {},
})

// Auto-uppercase, strip non-letters, cap at 3 chars — for IATA code inputs.
const up = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)

export function QueryBuilder({
  onRun,
  loading,
  apiError,
}: {
  onRun: (state: QueryState) => void
  loading: boolean
  apiError: string | null
}) {
  const [st, setSt] = useState<QueryState>(SEED)

  const upLeg = (i: number, fn: (l: Leg) => Leg) =>
    setSt((s) => ({ ...s, legs: s.legs.map((l, j) => (j === i ? fn(l) : l)) }))
  const setField = <K extends keyof Leg>(i: number, k: K, v: Leg[K]) =>
    upLeg(i, (l) => ({ ...l, [k]: v }))
  const toggleCabin = (i: number, cab: Cabin) =>
    upLeg(i, (l) => ({ ...l, cabins: { ...l.cabins, [cab]: !l.cabins[cab] } }))
  const swap = (i: number) =>
    upLeg(i, (l) => ({ ...l, origin: l.destination, destination: l.origin }))
  const addLeg = () => setSt((s) => ({ ...s, legs: [...s.legs, emptyLeg()] }))
  const removeLeg = (i: number) =>
    setSt((s) => ({ ...s, legs: s.legs.filter((_, j) => j !== i) }))
  const setCon = <K extends keyof QueryState['constraints']>(
    k: K,
    v: QueryState['constraints'][K],
  ) => setSt((s) => ({ ...s, constraints: { ...s.constraints, [k]: v } }))

  const addVia = (i: number) => upLeg(i, (l) => ({ ...l, via: [...l.via, ''] }))
  const setVia = (i: number, vi: number, v: string) =>
    upLeg(i, (l) => ({ ...l, via: l.via.map((c, k) => (k === vi ? up(v) : c)) }))
  const removeVia = (i: number, vi: number) =>
    upLeg(i, (l) => ({ ...l, via: l.via.filter((_, k) => k !== vi) }))

  const plan = useMemo(() => computePlan(st.legs), [st.legs])
  const { errs, valid } = useMemo(() => validate(st.legs), [st.legs])

  const mi = MODES[st.mode]
  const n = st.legs.length
  const errText = errs.join(' · ')

  const runStyle = mi.primary
    ? {
        border: 'none',
        background: valid ? 'var(--accent)' : 'var(--line2)',
        color: '#fff',
        cursor: valid ? 'pointer' : 'not-allowed',
      }
    : {
        border: '1px solid var(--accent)',
        background: 'var(--surface)',
        color: 'var(--accent)',
        cursor: 'pointer',
      }

  const onRunClick = () => {
    if (!valid || loading) return
    // dry-run sends no calls — the plan is already live in the aside.
    if (st.mode !== 'dry') onRun(st)
  }

  return (
    <div className="app-card">
      {/* app bar */}
      <div className="app-bar">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span className="brand">
            itsadeal<span className="dot-ai">.ai</span>
          </span>
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>new search</span>
        </div>
        <div className="qb-mode" role="tablist" aria-label="run mode">
          {MODE_BTNS.map((m) => (
            <button
              key={m.key}
              className={st.mode === m.key ? 'active' : ''}
              onClick={() => setSt((s) => ({ ...s, mode: m.key }))}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="split-body">
        {/* FORM */}
        <div className="qb-form">
          {/* trip name */}
          <div className="stack" style={{ gap: 7 }}>
            <label className="section-label">Trip name</label>
            <input
              className="field"
              value={st.name}
              onChange={(e) => setSt((s) => ({ ...s, name: e.target.value }))}
            />
          </div>

          {/* legs */}
          <div className="qb-legs">
            <div className="qb-legs-head">
              <span className="section-label">Legs</span>
              <button className="dashed-btn" onClick={addLeg}>
                + add leg
              </button>
            </div>

            {st.legs.map((leg, i) => (
              <div className="leg-card" key={i}>
                <div className="leg-head">
                  <div className="leg-head-left">
                    <span className="leg-n">Leg {i + 1}</span>
                    <span className="leg-role">{legRole(i, n)}</span>
                  </div>
                  <div className="leg-head-right">
                    <span className="leg-flex-hint" title="reserved for the flex sweep">
                      date_flex ±0d
                    </span>
                    {n > 1 && (
                      <button
                        className="remove-btn"
                        title="remove leg"
                        aria-label={`remove leg ${i + 1}`}
                        onClick={() => removeLeg(i)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* route + date */}
                <div className="leg-route">
                  <div className="leg-field">
                    <span className="field-hint">origin</span>
                    <input
                      className="iata-input"
                      value={leg.origin}
                      placeholder="SFO"
                      maxLength={3}
                      onChange={(e) => setField(i, 'origin', up(e.target.value))}
                    />
                  </div>
                  <button
                    className="icon-btn swap-btn"
                    title="swap"
                    aria-label="swap origin and destination"
                    onClick={() => swap(i)}
                  >
                    ⇄
                  </button>
                  <div className="leg-field">
                    <span className="field-hint">destination</span>
                    <input
                      className="iata-input"
                      value={leg.destination}
                      placeholder="TLV"
                      maxLength={3}
                      onChange={(e) => setField(i, 'destination', up(e.target.value))}
                    />
                  </div>
                  <div className="leg-field grow">
                    <span className="field-hint">departure date</span>
                    <input
                      className="field field-mono"
                      type="date"
                      value={leg.date}
                      onChange={(e) => setField(i, 'date', e.target.value)}
                    />
                  </div>
                </div>

                {/* via / stopover (open-item control) */}
                <div className="leg-via">
                  <div className="leg-field">
                    <span className="field-hint">
                      via <span style={{ color: 'var(--faint)' }}>— preferred stopover (optional)</span>
                    </span>
                    <div className="via-codes">
                      {leg.via.map((code, vi) => (
                        <div
                          key={vi}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}
                        >
                          <input
                            className="iata-input via"
                            value={code}
                            placeholder="IST"
                            maxLength={3}
                            aria-label={`via airport ${vi + 1}`}
                            onChange={(e) => setVia(i, vi, e.target.value)}
                          />
                          <button
                            className="via-remove"
                            aria-label="remove via"
                            onClick={() => removeVia(i, vi)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button className="dashed-btn" onClick={() => addVia(i)}>
                        + via
                      </button>
                    </div>
                  </div>
                </div>

                {/* cabins */}
                <div className="leg-cabins">
                  <span className="field-hint">
                    acceptable cabins <span style={{ color: 'var(--faint)' }}>— tap to toggle</span>
                  </span>
                  <div className="chip-row">
                    {CABINS.map((cab) => {
                      const on = leg.cabins[cab]
                      const meta = CABIN_META[cab]
                      return (
                        <button
                          key={cab}
                          className="cabin-chip"
                          aria-pressed={on}
                          onClick={() => toggleCabin(i, cab)}
                          style={{
                            border: `1px ${on ? 'solid' : 'dashed'} ${on ? meta.color : 'var(--line2)'}`,
                            background: on ? 'var(--tint)' : 'var(--surface)',
                            color: on ? 'var(--ink)' : 'var(--faint)',
                            fontWeight: on ? 600 : 400,
                          }}
                        >
                          <span
                            className="chip-dot"
                            style={{ background: meta.color, opacity: on ? 1 : 0.3 }}
                          />
                          {meta.chip}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* constraints */}
          <div className="qb-constraints">
            <span className="section-label">Constraints</span>
            <div className="constraint-row">
              <div className="leg-field">
                <span className="field-hint">max stops</span>
                <select
                  className="field field-mono"
                  value={st.constraints.maxStops}
                  onChange={(e) => setCon('maxStops', parseInt(e.target.value, 10))}
                >
                  <option value={0}>0 · nonstop</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </div>
              <div className="leg-field">
                <span className="field-hint">max layover (min)</span>
                <input
                  className="field field-mono"
                  style={{ width: 120 }}
                  type="number"
                  value={st.constraints.maxLayover}
                  onChange={(e) => setCon('maxLayover', parseInt(e.target.value || '0', 10) || 0)}
                />
              </div>
              <div className="leg-field">
                <span className="field-hint">passengers</span>
                <select
                  className="field field-mono"
                  value={st.constraints.passengers}
                  onChange={(e) => setCon('passengers', parseInt(e.target.value, 10))}
                >
                  <option value={1}>1 adult</option>
                  <option value={2}>2 adults</option>
                  <option value={3}>3 adults</option>
                  <option value={4}>4 adults</option>
                </select>
              </div>
              <div className="leg-field">
                <span className="field-hint">currency</span>
                <select
                  className="field field-mono"
                  value={st.constraints.currency}
                  onChange={(e) => setCon('currency', e.target.value)}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="ILS">ILS</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ASIDE */}
        <div className="qb-aside">
          {/* call plan */}
          <div className="aside-card">
            <div className="callplan-head">
              <span className="section-label" style={{ letterSpacing: '0.1em' }}>
                Call plan
              </span>
              <span className="callplan-tag">dry-run</span>
            </div>
            <div className="callplan-num">
              <b>{plan.total}</b>
              <span>{plan.total === 1 ? 'pricing call' : 'pricing calls'}</span>
            </div>
            <div className="callplan-lines">
              {plan.lines.map((p, k) => (
                <div className="callplan-line" key={k}>
                  <b>{p.label}</b>
                  <span>{p.meta}</span>
                </div>
              ))}
            </div>
            <div className="callplan-note">
              One unfiltered <span className="mono">MIXED_RT</span> call is post-bucketed into
              every mixed-cabin combo — searching is free, you only pay to book.
            </div>
          </div>

          {/* run */}
          <div className="aside-card">
            <div className="run-status">
              <span
                style={{ width: 8, height: 8, borderRadius: '50%', background: mi.dot }}
              />
              {mi.token}
            </div>
            <button
              className="run-btn"
              style={{ ...runStyle, ...(loading ? { cursor: 'wait', opacity: 0.85 } : null) }}
              onClick={onRunClick}
              disabled={(mi.primary && !valid) || loading}
            >
              <span>{loading ? 'Searching…' : mi.run}</span>
              <span className="calls">{plan.total} calls</span>
            </button>
            {errText && <div className="run-err">⚠ {errText}</div>}
            {apiError && !errText && <div className="run-err">⚠ {apiError}</div>}
            {st.mode === 'live' && !errText && !apiError && (
              <div className="run-hint">
                Runs real Duffel pricing · needs DUFFEL_ACCESS_TOKEN on the server
              </div>
            )}
          </div>

          {/* ranking primer */}
          <div className="primer">
            <span className="section-label" style={{ letterSpacing: '0.1em' }}>
              What we search
            </span>
            <div className="primer-chips">UNIFORM_RT · MIXED_RT · SPLIT_ONEWAY</div>
            <span className="primer-note">
              Every mixed-cabin and split-ticket combination, priced and ranked against the naive
              round-trip baseline a Kayak user would book.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
