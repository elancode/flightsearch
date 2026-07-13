// Data-driven trip-spec rendering shared by the results directions.
// Projects the submitted query (via ResultsView.spec) into read-only panels.

import type { SpecLeg } from '../viewmodel'
import { Dot } from '../ui'

export function ConstraintTags({ items, size = 11 }: { items: string[]; size?: number }) {
  return (
    <div className="constraint-tags" style={{ fontSize: size }}>
      {items.map((t) => (
        <span key={t}>{t}</span>
      ))}
    </div>
  )
}

function ComfortRows({ leg }: { leg: SpecLeg }) {
  const priced = leg.cabins.filter((c) => c.comfort > 0)
  if (!priced.length) return null
  return (
    <div>
      <div className="spec-sub">
        comfort value <span style={{ color: 'var(--faint)' }}>($ worth on this leg)</span>
      </div>
      <div className="comfort-rows">
        {priced.map((c) => (
          <div className="comfort-row" key={c.cabin}>
            <span style={{ color: 'var(--ink)' }}>{c.cabin}</span>
            <span className="val">${c.comfort.toLocaleString('en-US')}</span>
          </div>
        ))}
        <div className="comfort-row" style={{ color: 'var(--faint)' }}>
          <span>ECONOMY</span>
          <span>$0 · baseline</span>
        </div>
      </div>
    </div>
  )
}

/** Full spec-leg card — the wide rail (1a Workbench). */
export function SpecLegCardWide({ leg }: { leg: SpecLeg }) {
  return (
    <div className="spec-leg">
      <div className="spec-leg-head">
        <span className="spec-leg-title">
          Leg {leg.n} · {leg.role}
        </span>
        {leg.badge && <span className="badge ovn">{leg.badge}</span>}
      </div>
      <div className="spec-route">
        <b>{leg.route}</b>
        <span>{leg.date}</span>
      </div>
      {leg.via.length > 0 && (
        <div className="spec-sub" style={{ marginBottom: 0 }}>
          via {leg.via.join(' / ')}
        </div>
      )}
      <div>
        <div className="spec-sub">acceptable cabins</div>
        <div className="cabin-tags">
          {leg.cabins.map((c) => (
            <span
              key={c.cabin}
              className="cabin-tag-pill"
              style={{ border: `1px solid ${c.color}`, background: 'var(--surface)', color: 'var(--ink)' }}
            >
              <Dot color={c.color} />
              {c.abbr}
            </span>
          ))}
        </div>
      </div>
      <ComfortRows leg={leg} />
    </div>
  )
}

