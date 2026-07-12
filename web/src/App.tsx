import { useState } from 'react'
import { QueryBuilder } from './QueryBuilder'
import { Workbench } from './results/Workbench'
import { Notebook } from './results/Notebook'
import { Benchmark } from './results/Benchmark'

type View = '2a' | '1a' | '1b' | '1c'

const NAV: { id: View; tag: string; label: string; caption: string }[] = [
  {
    id: '2a',
    tag: '2a',
    label: 'Query builder',
    caption:
      'Specify a search — legs, per-leg acceptable cabins, constraints. Live dry-run call plan. (interactive)',
  },
  {
    id: '1a',
    tag: '1a',
    label: 'Workbench',
    caption:
      'Balanced two-pane — spec on the left, ranked results on the right. The everyday tool.',
  },
  {
    id: '1b',
    tag: '1b',
    label: 'Notebook',
    caption: 'Input cell → live pricing log → generated report.md. Leans into the tool’s real output.',
  },
  {
    id: '1c',
    tag: '1c',
    label: 'Benchmark',
    caption:
      'Comparison-first — winner card up top, effective-cost bars against the baseline reference.',
  },
]

export function App() {
  const [view, setView] = useState<View>('2a')
  const active = NAV.find((n) => n.id === view)!

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-eyebrow">itsadeal.ai · constraint-based flight search</div>
        <div className="page-title">Find the deal an OTA won&rsquo;t surface</div>
        <div className="page-sub">
          Define a trip&rsquo;s per-leg cabin preferences, run the search, read strategies ranked
          by effective cost against the naive round-trip baseline. The query builder is fully
          interactive; the three results directions are competing presentations of the same ranked
          data.
        </div>
      </div>

      <nav className="viewnav">
        {NAV.map((n) => (
          <button
            key={n.id}
            className={n.id === view ? 'active' : ''}
            onClick={() => setView(n.id)}
          >
            <span className="tag">{n.tag}</span>
            {n.label}
          </button>
        ))}
      </nav>

      <div className="screen">
        <div className="screen-caption">{active.caption}</div>
        {view === '2a' && <QueryBuilder onRun={() => setView('1a')} />}
        {view === '1a' && <Workbench />}
        {view === '1b' && <Notebook />}
        {view === '1c' && <Benchmark />}
      </div>
    </div>
  )
}
