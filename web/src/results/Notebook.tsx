import './results.css'
import { ROWS, SEGS, LINKS, RUN_LOG, LOG_COLOR } from '../data'
import { Dot, LiveStatus } from '../ui'

// 1b Notebook — Jupyter-style In[1] → Out[1] flow that leans into the tool's
// real CLI output: input cell, live pricing log, then the generated report.md.
export function Notebook() {
  return (
    <div className="app-card">
      <div className="app-bar">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span className="brand">
            itsadeal<span className="dot-ai">.ai</span>
          </span>
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>trips.yaml · SFO-TLV overnight</span>
        </div>
        <LiveStatus />
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
                SFO–TLV, premium eastbound overnight
              </span>
              <button
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
                ▶ run
              </button>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              {/* leg 1 mini */}
              <div className="nb-mini">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 17, fontWeight: 600 }}>SFO → TLV</span>
                  <span className="badge ovn" style={{ fontSize: 10 }}>OVERNIGHT</span>
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--muted)' }}>
                  2026-10-12 · max 1 stop
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, fontFamily: 'var(--mono)', fontSize: 11 }}>
                  <span style={{ border: '1px solid var(--bus)', background: 'var(--warn-tint)', borderRadius: 999, padding: '3px 9px' }}>
                    BUS <b style={{ fontWeight: 600 }}>$1500</b>
                  </span>
                  <span style={{ border: '1px solid var(--prm)', background: 'var(--prm-tint)', borderRadius: 999, padding: '3px 9px' }}>
                    PRM <b style={{ fontWeight: 600 }}>$500</b>
                  </span>
                  <span style={{ border: '1px solid var(--line2)', borderRadius: 999, padding: '3px 9px', color: 'var(--muted)' }}>
                    ECO $0
                  </span>
                </div>
              </div>
              {/* leg 2 mini */}
              <div className="nb-mini">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 17, fontWeight: 600 }}>TLV → SFO</span>
                  <span className="badge day" style={{ fontSize: 10 }}>DAYTIME</span>
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--muted)' }}>
                  2026-10-26 · max 1 stop
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, fontFamily: 'var(--mono)', fontSize: 11 }}>
                  <span style={{ border: '1px solid var(--prm)', background: 'var(--prm-tint)', borderRadius: 999, padding: '3px 9px' }}>
                    PRM <b style={{ fontWeight: 600 }}>$250</b>
                  </span>
                  <span style={{ border: '1px solid var(--line2)', borderRadius: 999, padding: '3px 9px', color: 'var(--muted)' }}>
                    ECO $0
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* run log */}
        <div className="nb-cell">
          <span className="nb-gutter" style={{ color: 'var(--faint)' }}>
            Out [1]
          </span>
          <div className="nb-log">
            {RUN_LOG.map((ln, i) => (
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
                # Flight decomposition validation report
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--faint)' }}>
                generated 2026-07-11 14:22 · mode: LIVE duffel · currency USD
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>
                Naive baseline (uniform RT{' '}
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink)' }}>BUS/BUS</span>):{' '}
                <b style={{ fontFamily: 'var(--mono)' }}>$4,820</b> — every saving below is measured
                against it.
              </span>
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
              {ROWS.map((row) => (
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
                  <span style={{ color: 'var(--pos)' }}>−{row.saveStr}</span>
                  <span style={{ color: 'var(--faint)', fontSize: 11 }}>{row.flag}</span>
                </div>
              ))}
            </div>

            {/* top option detail */}
            <div className="stack" style={{ gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                Top option detail —{' '}
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                  MIXED_RT BUS/ECO
                </span>{' '}
                · single PNR
              </span>
              {SEGS.map((s) => (
                <div key={s.leg} style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>
                  • {s.leg} <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{s.route}</span>{' '}
                  {s.date}: {s.flight}, cabin <span style={{ color: 'var(--ink)' }}>{s.cab}</span> ·{' '}
                  {s.note}
                </div>
              ))}
              <div className="link-row" style={{ marginTop: 2 }}>
                {LINKS.map((l) => (
                  <a href={l.href} key={l.label}>
                    {l.label} ↗
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
