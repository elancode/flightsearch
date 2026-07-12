import './results.css'
import { ROWS, SEGS, LINKS } from '../data'
import { Dot, LiveStatus } from '../ui'

// 1c Benchmark — comparison-first: winner card up top, then an effective-cost
// bar chart (shorter is better) against the dashed baseline reference.
export function Benchmark() {
  return (
    <div className="app-card">
      <div className="app-bar">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span className="brand">
            itsadeal<span className="dot-ai">.ai</span>
          </span>
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>results</span>
        </div>
        <LiveStatus />
      </div>

      <div className="split-body">
        {/* slim spec rail */}
        <div className="spec-rail slim">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="section-label">Spec</span>
            <a href="#" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
              edit
            </a>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.4 }}>
            SFO–TLV, premium eastbound overnight
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <div
              style={{
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                borderRadius: 8,
                padding: 11,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600 }}>SFO → TLV</span>
                <span className="badge ovn" style={{ fontSize: 9.5, padding: '1px 6px' }}>OVN</span>
              </div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--muted)' }}>
                Oct 12 · BUS $1500 / PRM $500
              </span>
            </div>
            <div
              style={{
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                borderRadius: 8,
                padding: 11,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600 }}>TLV → SFO</span>
                <span className="badge day" style={{ fontSize: 9.5, padding: '1px 6px' }}>DAY</span>
              </div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--muted)' }}>
                Oct 26 · PRM $250 / ECO $0
              </span>
            </div>
          </div>
          <div className="constraint-tags" style={{ fontSize: 10 }}>
            <span>≤ 1 stop</span>
            <span>≤ 240m</span>
            <span>1 adult</span>
          </div>
          <button className="btn-ghost" style={{ marginTop: 'auto' }}>
            ↻ re-run · 9 calls
          </button>
        </div>

        {/* main */}
        <div className="res-panel" style={{ gap: 18 }}>
          {/* winner card */}
          <div className="winner-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div className="stack" style={{ gap: 7 }}>
                <span className="rec-badge" style={{ alignSelf: 'flex-start', letterSpacing: '0.12em', padding: '2px 8px' }}>
                  RECOMMENDED
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>
                    MIXED_RT
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500 }}>
                    <Dot color="var(--bus)" size={8} />
                    BUS
                    <span style={{ color: 'var(--faint)' }}>→</span>
                    <Dot color="var(--eco)" size={8} />
                    ECO
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
                    single PNR
                  </span>
                </div>
                <span style={{ fontSize: 12.5, color: 'var(--muted)', maxWidth: 420, lineHeight: 1.5 }}>
                  Business on the overnight where it matters, economy on the daytime return. The
                  cheapest single-ticket way to fly business eastbound.
                </span>
              </div>
              <div className="stack" style={{ textAlign: 'right', gap: 2 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 32, fontWeight: 600, lineHeight: 1, letterSpacing: '-0.01em' }}>
                  $2,760
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--pos)', fontWeight: 600 }}>
                  −$2,060 vs baseline
                </span>
              </div>
            </div>

            {/* effective-cost equation */}
            <div className="winner-eq">
              <span style={{ fontWeight: 600 }}>$2,760</span>
              <span style={{ color: 'var(--faint)' }}>price</span>
              <span style={{ color: 'var(--muted)' }}>−</span>
              <span style={{ fontWeight: 600, color: 'var(--bus)' }}>$1,500</span>
              <span style={{ color: 'var(--faint)' }}>comfort value</span>
              <span style={{ color: 'var(--muted)' }}>=</span>
              <span style={{ fontWeight: 600, color: 'var(--accent)' }}>$1,260 effective</span>
              <span style={{ color: 'var(--faint)', borderLeft: '1px solid var(--line)', paddingLeft: 10, marginLeft: 2 }}>
                effectively ties all-economy ($1,290)
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
              {SEGS.map((s) => (
                <div key={s.leg} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--muted)' }}>
                  <Dot color={s.dot} size={8} />
                  <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{s.route}</span>
                  <span>{s.flight}</span>
                  <span style={{ color: 'var(--faint)' }}>{s.note}</span>
                </div>
              ))}
            </div>
            <div className="link-row">
              {LINKS.map((l) => (
                <a href={l.href} key={l.label}>
                  {l.label} ↗
                </a>
              ))}
            </div>
          </div>

          {/* benchmark bars */}
          <div className="stack" style={{ gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span className="section-label">All strategies</span>
              <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>
                bar = effective cost · shorter is better
              </span>
            </div>
            <div className="stack" style={{ gap: 7 }}>
              {ROWS.map((row) => (
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
              <div
                className="bench-row"
                style={{ paddingTop: 6, borderTop: '1px dashed var(--line2)', marginTop: 2 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>
                    BASELINE
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--mono)', fontSize: 11 }}>
                    <Dot color="var(--bus)" size={6} />
                    BUS
                    <span style={{ color: 'var(--faint)' }}>/</span>
                    <Dot color="var(--bus)" size={6} />
                    BUS
                  </span>
                </div>
                <div className="bench-bar">
                  <div className="fill" style={{ width: '100%', background: 'var(--warn-tint)' }} />
                  <span className="eff">eff $3,320 · what Kayak prices</span>
                  <span className="price">$4,820</span>
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
                  1.00×
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
