/**
 * ChaiToke API client
 *
 * In dev:  requests go to /v1 → Vite proxy → team8.105app.site (or VITE_API_BASE override)
 * In prod: requests go to /v1 → same origin (deploy frontend alongside backend)
 *
 * Backend deployed at: http://team8.105app.site  (see DEPLOY_GUIDE.md)
 * Rate limit: 60 req/min via SlowAPI              (see TECH_STACK.md)
 */

const BASE = '/v1'

// The resolved API target injected by Vite at build time (defined in vite.config.js)
// Falls back gracefully if not available (e.g. in tests)
export const API_TARGET =
  typeof __API_BASE__ !== 'undefined' ? __API_BASE__ : 'http://team8.105app.site'

/**
 * POST /v1/extractions
 * Returns { data, meta } on success.
 * Throws { status, title, detail } on API error (RFC 7807 shape).
 *
 * @param {Array}  messages  - Chat messages array [{ role, content, timestamp? }]
 * @param {string} source    - 'line' | 'facebook' | 'other'
 */
export async function extractFromMessages(messages, source = 'line') {
  const res = await fetch(`${BASE}/extractions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source,
      messages,
      extract: ['intent', 'sentiment', 'entities'],
    }),
  })

  if (!res.ok) {
    // Parse RFC 7807 error shape from backend (see TECH_STACK.md → Error Handling)
    let err = { status: res.status, title: 'Request failed', detail: res.statusText }
    try {
      const j = await res.json()
      err = { status: res.status, title: j.title || err.title, detail: j.detail || err.detail }
    } catch (_) {}
    throw err
  }

  return res.json() // { data, meta }
}

/**
 * GET /v1/health
 * Returns true if backend is reachable and reports healthy.
 * Timeout is 4s — generous enough for the deployed server cold start.
 */
export async function checkHealth() {
  try {
    const res = await fetch(`${BASE}/health`, {
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return false
    const j = await res.json()
    return j.status === 'healthy'
  } catch (_) {
    return false
  }
}
