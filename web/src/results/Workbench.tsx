import './results.css'
import type { ResultsView } from '../viewmodel'
import { CabinFlow, Dot, StatusBadge } from '../ui'
import { ConstraintTags, SpecLegCardWide } from './Spec'

// 1a Workbench — balanced two-pane: read-only trip spec on the left, ranked
// options on the right. Fully data-driven: renders live results or the sample.
export function Workbench({ view, onEdit }: { view: ResultsView; onEdit: () => void }) {
  return (
    <div className="app-card">
      <div className="app-bar">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span className="brand">
            itsadeal<span className="dot-ai">.ai</span>
          </span>
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>flight decomposition search</span>
        </div>
        <div className="res-appbar-meta">
          <StatusBadge kind={view.statusKind} />
          <span className="cur">{view.currency}</span>
        </div>
      </div>

      <div className="split-body">
        {/* SPEC PANEL */}
        <div className="spec-rail wide">
          <div className="section-label" style={{ letterSpacing: '0.13em' }}>
            Trip spec
          </div>

          <div className="stack" style={{ gap: 6 }}>
            <div className="field-hint">name</div>
            <div
              style={{
                border: '1px solid var(--line2)',
                borderRadius: 7,
                background: 'var(--surface)',
                padding: '9px 11px',
                fontSize: 13,
                color: 'var(--ink)',
              }}
            >
              {view.spec.name}
            </div>
          </div>

          {view.spec.legs.map((leg) => (
            <SpecLegCardWide leg={leg} key={leg.n} />
          ))}

          <ConstraintTags items={view.spec.constraints} />

          <button className="btn-primary" style={{ marginTop: 2 }} onClick={onEdit}>
            <span>Edit &amp; re-run</span>
            <span className="calls">{view.callsMade} pricing calls</span>
          </button>
        </div>

        {/* RESULTS PANEL */}
        <div className="res-panel">
          <div className="res-head">
            <div className="res-head-left">
              <span className="section-label" style={{ letterSpacing: '0.13em' }}>
                Ranked options
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>
                by effective cost · {view.rows.length} surviving constraints
              </span>
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
              {view.callsMade} calls · <a onClick={onEdit} style={{ cursor: 'pointer' }}>re-run</a>
            </span>
          </div>

          {view.warning && (
            <div className="res-warning">⚠ {view.warning}</div>
          )}

          {/* baseline callout */}
          {view.baseline ? (
            <div className="baseline-callout">
              <div className="stack" style={{ gap: 2 }}>
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 10.5,
                    letterSpacing: '0.1em',
                    color: 'var(--faint)',
                    textTransform: 'uppercase',
                  }}
                >
                  Naive baseline
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  uniform round-trip{' '}
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink)' }}>
                    {view.baselineCabinStr}
                  </span>{' '}
                  — what Kayak &amp; Google price
                </span>
              </div>
              <div className="num">{view.baseline.priceStr}</div>
            </div>
          ) : (
            <div className="res-warning">
              No naive baseline priced (common with a Duffel test token) — savings vs. baseline
              unavailable.
            </div>
          )}

          {/* rows */}
          <div className="stack" style={{ gap: 8 }}>
            {view.rows.map((row) => (
              <div className="rank-row" key={row.rank} style={{ border: `1px solid ${row.recBorder}` }}>
                <div className="rank-row-main">
                  <span className="rk">{row.rank}</span>
                  <span className="strat" style={{ color: row.stratColor }}>
                    {row.strat}
                  </span>
                  <CabinFlow c1abbr={row.c1abbr} c1dot={row.c1dot} c2abbr={row.c2abbr} c2dot={row.c2dot} />
                  <span className="flag">{row.flag}</span>
                  <span className="rank-price">
                    <b>{row.priceStr}</b>
                    <span>
                      eff {row.effStr}
                      {row.save != null && (
                        <>
                          {' '}·{' '}
                          <span style={{ color: row.cheaper ? 'var(--pos)' : 'var(--muted)' }}>
                            {row.cheaper ? '−' : '+'}
                            {row.saveStr} vs base
                          </span>
                        </>
                      )}
                    </span>
                  </span>
                </div>

                {row.recFlag && view.segs.length > 0 && (
                  <div className="rec-detail">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="rec-badge">RECOMMENDED</span>
                      <span style={{ fontSize: 12, color: 'var(--ink)' }}>
                        best single-PNR pick by effective cost{' '}
                        {row.save != null && row.cheaper && <>— {row.saveStr} under baseline</>}.
                      </span>
                    </div>
                    <div className="stack" style={{ gap: 6 }}>
                      {view.segs.map((s) => (
                        <div className="seg-line" key={s.leg}>
                          <span style={{ color: 'var(--faint)', width: 42 }}>{s.leg}</span>
                          <span style={{ fontWeight: 600, width: 96 }}>{s.route}</span>
                          <span style={{ color: 'var(--muted)', width: 96 }}>{s.date}</span>
                          <span style={{ color: 'var(--muted)' }}>{s.flight}</span>
                          <span
                            style={{
                              marginLeft: 'auto',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              fontWeight: 500,
                            }}
                          >
                            <Dot color={s.dot} />
                            {s.cabAbbr}
                          </span>
                          <span style={{ color: 'var(--faint)', width: 150, textAlign: 'right' }}>
                            {s.note}
                          </span>
                        </div>
                      ))}
                    </div>
                    {view.links.length > 0 && (
                      <div className="link-row">
                        {view.links.map((l) => (
                          <a href={l.href} key={l.label} target="_blank" rel="noreferrer">
                            {l.label} ↗
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
