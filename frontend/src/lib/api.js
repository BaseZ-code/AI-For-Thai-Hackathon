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
 * POST /v1/chat/analyze (with fallback to /v1/extractions for backward compatibility)
 * Returns { data, meta } on success.
 * Throws { status, title, detail } on API error (RFC 7807 shape).
 *
 * @param {Array}  messages  - Chat messages array [{ role, content, timestamp? }]
 * @param {string} source    - 'line' | 'facebook' | 'call_center' | 'other'
 */
export async function extractFromMessages(messages, source = 'line') {
  const payload = JSON.stringify({
    source,
    messages,
    extract: ['intent', 'sentiment', 'entities'],
  })
  const headers = { 'Content-Type': 'application/json' }

  // Try /v1/chat/analyze first, then /v1/extractions
  let res = await fetch(`${BASE}/chat/analyze`, {
    method: 'POST',
    headers,
    body: payload,
  }).catch(() => null)

  if (!res || res.status === 404) {
    res = await fetch(`${BASE}/extractions`, {
      method: 'POST',
      headers,
      body: payload,
    })
  }

  if (!res.ok) {
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
 * POST /v1/audio/analyze
 * Uploads an audio file (.mp3, .wav, .m4a, .flac) for ASR transcription + LLM extraction.
 */
export async function extractFromAudio(audioFile, source = 'call_center') {
  const formData = new FormData()
  formData.append('file', audioFile)
  formData.append('source', source)
  formData.append('extract', JSON.stringify(['intent', 'sentiment', 'entities']))

  const res = await fetch(`${BASE}/audio/analyze`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    let err = { status: res.status, title: 'Audio Analysis failed', detail: res.statusText }
    try {
      const j = await res.json()
      err = { status: res.status, title: j.title || err.title, detail: j.detail || err.detail }
    } catch (_) {}
    throw err
  }

  return res.json()
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
