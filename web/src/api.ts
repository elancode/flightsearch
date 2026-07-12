import type { QueryState } from './types'
import type { SearchResponse } from './viewmodel'

// Where the serverless search function lives. Same-origin in production
// (Vercel serves /api/* alongside the static build); override for local dev
// against a deployed backend via VITE_API_BASE.
const API_BASE = import.meta.env.VITE_API_BASE ?? ''

export async function runSearch(state: QueryState): Promise<SearchResponse> {
  const res = await fetch(`${API_BASE}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  })
  let body: SearchResponse
  try {
    body = await res.json()
  } catch {
    throw new Error(`Server returned ${res.status} with a non-JSON response.`)
  }
  if (!res.ok || !body.ok) {
    throw new Error(body?.error || `Search failed (${res.status}).`)
  }
  return body
}
