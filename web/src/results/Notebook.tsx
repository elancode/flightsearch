import './results.css'
import type { ResultsView } from '../viewmodel'
import { Dot, StatusBadge } from '../ui'

const LOG_COLOR = { call: 'var(--muted)', res: 'var(--accent)', done: 'var(--pos)' } as const

// 1b Notebook — In[1] → Out[1] flow that leans into the tool's real output:
// input cell (the spec), live pricing log, then the ranked report.
export function Notebook({ view, onEdit }: { view: ResultsView; onEdit: () => void }) {
  const rec = view.recIndex >= 0 ? view.rows[view.recIndex] : undefined
  return (
    <div className="app-card">
      <div className="app-bar">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span className="brand">
            itsadeal<span className="dot-ai">.ai</span>
          </span>
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>{view.spec.name}</span>
        </div>
        <StatusBadge kind={view.statusKind} />
      </div>

      <div className="nb-body">
        {/* IN cell */}
        <div className="nb-cell">
          <span className="nb-gutter" style={{ color: 'var(--accent)' }}>
            In [1]
          </span>
          <div className="nb-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600 }}>
                {view.spec.name}
              </span>
              <button
                onClick={onEdit}
                style={{
                  border: '1px solid var(--accent)',
                  background: 'var(--surface)',
                  color: 'var(--accent)',
                  borderRadius: 7,
                  padding: '6px 14px',
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ▶ edit
              </button>
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {view.spec.legs.map((leg) => (
                <div className="nb-mini" key={leg.n}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 17, fontWeight: 600 }}>{leg.route}</span>
                    <span className="badge day" style={{ fontSize: 10 }}>{leg.role}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--muted)' }}>
                    {leg.date}
                    {leg.via.length > 0 ? ` · via ${leg.via.join('/')}` : ''}
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, fontFamily: 'var(--mono)', fontSize: 11 }}>
                    {leg.cabins.map((c) => (
                      <span
                        key={c.cabin}
                        style={{
                          border: `1px solid ${c.comfort > 0 ? c.color : 'var(--line2)'}`,
                          borderRadius: 999,
                          padding: '3px 9px',
                          color: c.comfort > 0 ? 'var(--ink)' : 'var(--muted)',
                        }}
                      >
                        {c.abbr} <b style={{ fontWeight: 600 }}>${c.comfort}</b>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* run log */}
        <div className="nb-cell">
          <span className="nb-gutter" style={{ color: 'var(--faint)' }}>
            Out [1]
          </span>
          <div className="nb-log">
            {view.runLog.map((ln, i) => (
              <span key={i} style={{ color: LOG_COLOR[ln.k] }}>
                {ln.t}
              </span>
            ))}
          </div>
        </div>

        {/* report */}
        <div className="nb-cell">
          <span className="nb-gutter" />
          <div className="stack" style={{ flex: 1, gap: 14 }}>
            <div
              className="stack"
              style={{ gap: 3, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}
            >
              <span style={{ fontFamily: 'var(--mono)', fontSize: 17, fontWeight: 600 }}>
                # Flight decomposition report
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--faint)' }}>
                mode: {view.mode.toUpperCase()} · currency {view.currency} · {view.callsMade} provider calls
              </span>
              {view.baseline ? (
                <span style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>
                  Naive baseline (uniform RT{' '}
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink)' }}>
                    {view.baselineCabinStr}
                  </span>
                  ): <b style={{ fontFamily: 'var(--mono)' }}>{view.baseline.priceStr}</b> — every
                  saving below is measured against it.
                </span>
              ) : (
                <span style={{ fontSize: 12.5, color: 'var(--warn)', marginTop: 6 }}>
                  No naive baseline priced (common with a Duffel test token).
                </span>
              )}
            </div>

            {/* report table */}
            <div className="report-table">
              <div className="report-grid report-head">
                <span>#</span>
                <span>strategy</span>
                <span>cabins</span>
                <span>price</span>
                <span>eff</span>
                <span>vs base</span>
                <span>flags</span>
              </div>
              {view.rows.map((row) => (
                <div className="report-grid report-body" key={row.rank} style={{ background: row.rowBg }}>
                  <span style={{ color: 'var(--faint)' }}>{row.rank}</span>
                  <span style={{ color: row.stratColor, fontWeight: 600 }}>{row.strat}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Dot color={row.c1dot} size={6} />
                    {row.c1abbr}
                    <span style={{ color: 'var(--faint)' }}>/</span>
                    <Dot color={row.c2dot} size={6} />
                    {row.c2abbr}
                  </span>
                  <span style={{ fontWeight: 600 }}>{row.priceStr}</span>
                  <span style={{ color: 'var(--muted)' }}>{row.effStr}</span>
                  <span style={{ color: row.cheaper === false ? 'var(--muted)' : 'var(--pos)' }}>
                    {row.save == null ? '—' : `${row.cheaper ? '−' : '+'}${row.saveStr}`}
                  </span>
                  <span style={{ color: 'var(--faint)', fontSize: 11 }}>{row.flag}</span>
                </div>
              ))}
            </div>

            {/* top option detail */}
            {rec && view.segs.length > 0 && (
              <div className="stack" style={{ gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  Top single-PNR pick —{' '}
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                    {rec.strat} {rec.c1abbr}/{rec.c2abbr}
                  </span>{' '}
                  · single PNR
                </span>
                {view.segs.map((s) => (
                  <div key={s.leg} style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>
                    • {s.leg} <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{s.route}</span>{' '}
                    {s.date}: {s.flight}, cabin <span style={{ color: 'var(--ink)' }}>{s.cab}</span> ·{' '}
                    {s.note}
                  </div>
                ))}
                {view.links.length > 0 && (
                  <div className="link-row" style={{ marginTop: 2 }}>
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
        </div>
      </div>
    </div>
  )
}
