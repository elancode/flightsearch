import './results.css'
import type { ResultsView } from '../viewmodel'
import { Dot, StatusBadge } from '../ui'
import { ConstraintTags, SpecLegCardSlim } from './Spec'

// 1c Benchmark — comparison-first: winner card up top, then an effective-cost
// bar chart (shorter is better) against the dashed baseline reference.
export function Benchmark({ view, onEdit }: { view: ResultsView; onEdit: () => void }) {
  const rec = view.recIndex >= 0 ? view.rows[view.recIndex] : undefined

  return (
    <div className="app-card">
      <div className="app-bar">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span className="brand">
            itsadeal<span className="dot-ai">.ai</span>
          </span>
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>results</span>
        </div>
        <StatusBadge kind={view.statusKind} />
      </div>

      <div className="split-body">
        {/* slim spec rail */}
        <div className="spec-rail slim">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="section-label">Spec</span>
            <a onClick={onEdit} style={{ fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer' }}>
              edit
            </a>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.4 }}>{view.spec.name}</div>
          <div className="stack" style={{ gap: 10 }}>
            {view.spec.legs.map((leg) => (
              <SpecLegCardSlim leg={leg} key={leg.n} />
            ))}
          </div>
          <ConstraintTags items={view.spec.constraints.slice(0, 3)} size={10} />
          <button className="btn-ghost" style={{ marginTop: 'auto' }} onClick={onEdit}>
            ↻ re-run · {view.callsMade} calls
          </button>
        </div>

        {/* main */}
        <div className="res-panel" style={{ gap: 18 }}>
          {view.warning && <div className="res-warning">⚠ {view.warning}</div>}

          {/* winner card */}
          {rec ? (
            <div className="winner-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div className="stack" style={{ gap: 7 }}>
                  <span className="rec-badge" style={{ alignSelf: 'flex-start', letterSpacing: '0.12em', padding: '2px 8px' }}>
                    RECOMMENDED
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600, color: rec.stratColor }}>
                      {rec.strat}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500 }}>
                      <Dot color={rec.c1dot} size={8} />
                      {rec.c1abbr}
                      <span style={{ color: 'var(--faint)' }}>→</span>
                      <Dot color={rec.c2dot} size={8} />
                      {rec.c2abbr}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 11,
                        color: 'var(--muted)',
                        border: '1px solid var(--line)',
                        borderRadius: 5,
                        padding: '2px 8px',
                        background: 'var(--surface)',
                      }}
                    >
                      {rec.flag}
                    </span>
                  </div>
                  <span style={{ fontSize: 12.5, color: 'var(--muted)', maxWidth: 420, lineHeight: 1.5 }}>
                    Best single-PNR pick by effective cost — premium where it matters, economy where
                    it doesn&rsquo;t.
                  </span>
                </div>
                <div className="stack" style={{ textAlign: 'right', gap: 2 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 32, fontWeight: 600, lineHeight: 1, letterSpacing: '-0.01em' }}>
                    {rec.priceStr}
                  </span>
                  {rec.save != null && (
                    <span
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 13,
                        color: rec.cheaper ? 'var(--pos)' : 'var(--muted)',
                        fontWeight: 600,
                      }}
                    >
                      {rec.cheaper ? '−' : '+'}
                      {rec.saveStr} vs baseline
                    </span>
                  )}
                </div>
              </div>

              {/* effective-cost equation */}
              <div className="winner-eq">
                <span style={{ fontWeight: 600 }}>{rec.priceStr}</span>
                <span style={{ color: 'var(--faint)' }}>price</span>
                <span style={{ color: 'var(--muted)' }}>−</span>
                <span style={{ fontWeight: 600, color: 'var(--bus)' }}>{rec.creditStr}</span>
                <span style={{ color: 'var(--faint)' }}>comfort value</span>
                <span style={{ color: 'var(--muted)' }}>=</span>
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{rec.effStr} effective</span>
              </div>

              {view.segs.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
                  {view.segs.map((s) => (
                    <div key={s.leg} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--muted)' }}>
                      <Dot color={s.dot} size={8} />
                      <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{s.route}</span>
                      <span>{s.flight}</span>
                      <span style={{ color: 'var(--faint)' }}>{s.note}</span>
                    </div>
                  ))}
                </div>
              )}
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
          ) : (
            <div className="res-warning">No rankable options returned for this search.</div>
          )}

          {/* benchmark bars */}
          <div className="stack" style={{ gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span className="section-label">All strategies</span>
              <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>
                bar = effective cost · shorter is better
              </span>
            </div>
            <div className="stack" style={{ gap: 7 }}>
              {view.rows.map((row) => (
                <div className="bench-row" key={row.rank}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: row.stratColor }}>
                      {row.strat}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--mono)', fontSize: 11 }}>
                      <Dot color={row.c1dot} size={6} />
                      {row.c1abbr}
                      <span style={{ color: 'var(--faint)' }}>/</span>
                      <Dot color={row.c2dot} size={6} />
                      {row.c2abbr}
                    </span>
                  </div>
                  <div className="bench-bar">
                    <div
                      className="fill"
                      style={{ width: `${row.barPct}%`, background: row.barFill, borderRight: `1px solid ${row.stratColor}` }}
                    />
                    <span className="eff">eff {row.effStr}</span>
                    <span className="price">{row.priceStr}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--faint)', textAlign: 'right' }}>
                    {row.ratioStr}
                  </span>
                </div>
              ))}

              {/* baseline reference */}
              {view.baseline && (
                <div
                  className="bench-row"
                  style={{ paddingTop: 6, borderTop: '1px dashed var(--line2)', marginTop: 2 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>
                      BASELINE
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--mono)', fontSize: 11 }}>
                      <Dot color={view.baseline.c1dot} size={6} />
                      {view.baseline.c1abbr}
                      <span style={{ color: 'var(--faint)' }}>/</span>
                      <Dot color={view.baseline.c2dot} size={6} />
                      {view.baseline.c2abbr}
                    </span>
                  </div>
                  <div className="bench-bar">
                    <div className="fill" style={{ width: '100%', background: 'var(--warn-tint)' }} />
                    <span className="eff">eff {view.baseline.effStr} · what Kayak prices</span>
                    <span className="price">{view.baseline.priceStr}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
                    1.00×
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
