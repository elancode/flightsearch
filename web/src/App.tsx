import { useState } from 'react'
import { QueryBuilder, SEED } from './QueryBuilder'
import { Workbench } from './results/Workbench'
import { runSearch } from './api'
import { mapResult, type ResultsView } from './viewmodel'
import { SAMPLE_VIEW } from './data'
import type { QueryState } from './types'

type View = '2a' | '1a'

export function App() {
  const [view, setView] = useState<View>('2a')
  // The query lives here (not inside QueryBuilder) so it survives navigating
  // to the results and back — clicking Edit returns to the same search.
  const [query, setQuery] = useState<QueryState>(SEED)
  const [results, setResults] = useState<ResultsView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fires the live search: POST the query state, project the response into a
  // ResultsView, and switch to the results view to show it.
  async function handleRun(state: QueryState) {
    setLoading(true)
    setError(null)
    try {
      const res = await runSearch(state)
      setResults(mapResult(state, res))
      setView('1a')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed.')
    } finally {
      setLoading(false)
    }
  }

  const shown = results ?? SAMPLE_VIEW
  const goEdit = () => setView('2a')

  return (
    <div className="page">
      <div className="screen">
        {view === '2a' && (
          <QueryBuilder
            state={query}
            setState={setQuery}
            onRun={handleRun}
            loading={loading}
            apiError={error}
          />
        )}
        {view === '1a' && <Workbench view={shown} onEdit={goEdit} />}
      </div>
    </div>
  )
}
