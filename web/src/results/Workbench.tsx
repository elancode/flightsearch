import './results.css'
import { ROWS, SEGS, LINKS } from '../data'
import { CabinFlow, Dot, LiveStatus } from '../ui'

// 1a Workbench — balanced two-pane: read-only trip spec on the left,
// ranked options on the right. The everyday tool.
export function Workbench() {
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
          <LiveStatus />
          <span className="cur">USD</span>
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
              SFO–TLV, premium eastbound overnight
            </div>
          </div>

          {/* LEG 1 */}
          <div className="spec-leg">
            <div className="spec-leg-head">
              <span className="spec-leg-title">Leg 1 · outbound</span>
              <span className="badge ovn">OVERNIGHT</span>
            </div>
            <div className="spec-route">
              <b>SFO → TLV</b>
              <span>2026-10-12</span>
            </div>
            <div>
              <div className="spec-sub">acceptable cabins</div>
              <div className="cabin-tags">
                <span
                  className="cabin-tag-pill"
                  style={{ border: '1px solid var(--bus)', background: 'var(--warn-tint)', color: 'var(--ink)' }}
                >
                  <Dot color="var(--bus)" />
                  BUSINESS
                </span>
                <span
                  className="cabin-tag-pill"
                  style={{ border: '1px solid var(--prm)', background: 'var(--prm-tint)', color: 'var(--ink)' }}
                >
                  <Dot color="var(--prm)" />
                  PREM_ECON
                </span>
                <span
                  className="cabin-tag-pill"
                  style={{ border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--muted)' }}
                >
                  <Dot color="var(--eco)" />
                  ECONOMY
                </span>
              </div>
            </div>
            <div>
              <div className="spec-sub">
                comfort value <span style={{ color: 'var(--faint)' }}>($ worth on this leg)</span>
              </div>
              <div className="comfort-rows">
                <div className="comfort-row">
                  <span style={{ color: 'var(--ink)' }}>BUSINESS</span>
                  <span className="val">$1,500</span>
                </div>
                <div className="comfort-row">
                  <span style={{ color: 'var(--ink)' }}>PREMIUM_ECONOMY</span>
                  <span className="val">$500</span>
                </div>
                <div className="comfort-row" style={{ color: 'var(--faint)' }}>
                  <span>ECONOMY</span>
                  <span>$0 · baseline</span>
                </div>
              </div>
            </div>
          </div>

          {/* LEG 2 */}
          <div className="spec-leg">
            <div className="spec-leg-head">
              <span className="spec-leg-title">Leg 2 · return</span>
              <span className="badge day">DAYTIME</span>
            </div>
            <div className="spec-route">
              <b>TLV → SFO</b>
              <span>2026-10-26</span>
            </div>
            <div>
              <div className="spec-sub">acceptable cabins</div>
              <div className="cabin-tags">
                <span
                  className="cabin-tag-pill"
                  style={{ border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--ink)' }}
                >
                  <Dot color="var(--eco)" />
                  ECONOMY
                </span>
                <span
                  className="cabin-tag-pill"
                  style={{ border: '1px solid var(--prm)', background: 'var(--prm-tint)', color: 'var(--ink)' }}
                >
                  <Dot color="var(--prm)" />
                  PREM_ECON
                </span>
                <span
                  className="cabin-tag-pill"
                  style={{ border: '1px dashed var(--line2)', background: 'transparent', color: 'var(--faint)' }}
                >
                  + BUSINESS
                </span>
              </div>
            </div>
            <div>
              <div className="spec-sub">comfort value</div>
              <div className="comfort-rows">
                <div className="comfort-row">
                  <span style={{ color: 'var(--ink)' }}>PREMIUM_ECONOMY</span>
                  <span className="val">$250</span>
                </div>
                <div className="comfort-row" style={{ color: 'var(--faint)' }}>
                  <span>ECONOMY</span>
                  <span>$0 · baseline</span>
                </div>
              </div>
            </div>
          </div>

          <div className="constraint-tags">
            <span>max_stops ≤ 1</span>
            <span>layover ≤ 240m</span>
            <span>1 adult</span>
            <span>USD</span>
          </div>

          <button className="btn-primary" style={{ marginTop: 2 }}>
            <span>Run search</span>
            <span className="calls">9 pricing calls</span>
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
                by effective cost · 6 of 6 surviving constraints
              </span>
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
              ran 2s ago · <a href="#">re-run</a>
            </span>
          </div>

          {/* baseline callout */}
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
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink)' }}>BUS/BUS</span> —
                what Kayak &amp; Google price
              </span>
            </div>
            <div className="num">$4,820</div>
          </div>

          {/* rows */}
          <div className="stack" style={{ gap: 8 }}>
            {ROWS.map((row) => (
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
                      eff {row.effStr} ·{' '}
                      <span style={{ color: 'var(--pos)' }}>−{row.saveStr} vs base</span>
                    </span>
                  </span>
                </div>

                {row.recFlag && (
                  <div className="rec-detail">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="rec-badge">RECOMMENDED</span>
                      <span style={{ fontSize: 12, color: 'var(--ink)' }}>
                        best single-PNR pick — business on the overnight, economy on the daytime
                        return. Effectively ties all-economy ($1,290), $2,060 under baseline.
                      </span>
                    </div>
                    <div className="stack" style={{ gap: 6 }}>
                      {SEGS.map((s) => (
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
                    <div className="link-row">
                      {LINKS.map((l) => (
                        <a href={l.href} key={l.label}>
                          {l.label} ↗
                        </a>
                      ))}
                    </div>
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
