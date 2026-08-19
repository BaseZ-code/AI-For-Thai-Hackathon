import { useState } from 'react'
import { parseUploadInput } from '../lib/mapResponse'
import { DEFAULT_TRANSCRIPT } from '../lib/mockPayload'

const SOURCES = ['line', 'facebook', 'other']

export default function TranscriptUploader({ onLoad, onClose, history = [] }) {
  const [text, setText] = useState(JSON.stringify(DEFAULT_TRANSCRIPT, null, 2))
  const [source, setSource] = useState('line')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  function handlePasteLoad() {
    setError(null)
    setSuccess(false)
    try {
      const parsed = parseUploadInput(text, source)
      onLoad(parsed)
      setSuccess(true)
      setTimeout(onClose, 600)
    } catch (e) {
      setError(e.message)
    }
  }

  function recallHistory(entry) {
    onLoad({ source: entry.source, messages: entry.messages })
    onClose()
  }

  function handleResetDefault() {
    setText(JSON.stringify(DEFAULT_TRANSCRIPT, null, 2))
    setSource('line')
    setError(null)
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(15,23,42,0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 50,
      }}
    >
      <div style={{
        background: 'white',
        borderRadius: 12,
        width: 'min(740px, 94vw)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slide-down 0.2s ease',
        maxHeight: '90vh',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid var(--zd-border)',
          background: '#fafafa',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>📂 Load / Upload Transcript</div>
            <div style={{ fontSize: 11, color: 'var(--zd-text-muted)', marginTop: 2 }}>
              Paste JSON payload or raw Thai dialogue for the demo call session
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: 20, color: '#9ca3af', cursor: 'pointer', padding: '2px 8px', borderRadius: 6 }}
          >
            ×
          </button>
        </div>

        {/* Recall history */}
        {history.length > 0 && (
          <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--zd-border)', background: '#f9fafb' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--zd-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              🕐 Recent Transcripts
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {history.map((entry, i) => (
                <button
                  key={entry.id}
                  onClick={() => recallHistory(entry)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 99,
                    border: '1px solid var(--zd-border)', background: 'white',
                    fontSize: 11, fontWeight: 500, color: '#374151',
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}
                >
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg,var(--ct-orange),var(--ct-dark))',
                    color: 'white', fontSize: 8, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ textTransform: 'capitalize' }}>{entry.source}</span>
                  <span style={{ color: '#9ca3af' }}>·</span>
                  <span>{entry.messages.length} msgs</span>
                  <span style={{ color: '#9ca3af' }}>·</span>
                  <span style={{ color: '#6b7280' }}>{entry.loadedAtLabel}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>

          <div style={{
            background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
            padding: '10px 14px', fontSize: 12, color: '#1e40af', lineHeight: 1.5,
          }}>
            <strong>Accepted format:</strong> Paste full <code style={{ background: '#dbeafe', padding: '1px 4px', borderRadius: 3 }}>{'{ source, messages[] }'}</code> JSON, bare <code style={{ background: '#dbeafe', padding: '1px 4px', borderRadius: 3 }}>messages[]</code> array, or <strong>raw Thai text</strong> (one line per turn; prefix agent lines with <code style={{ background: '#dbeafe', padding: '1px 4px', borderRadius: 3 }}>agent:</code>).
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Platform</span>
              <div style={{ display: 'flex', gap: 5 }}>
                {SOURCES.map(s => (
                  <button
                    key={s}
                    onClick={() => setSource(s)}
                    style={{
                      padding: '3px 12px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                      border: `1px solid ${source === s ? 'var(--ct-orange)' : 'var(--zd-border)'}`,
                      background: source === s ? 'var(--ct-lt)' : 'white',
                      color: source === s ? 'var(--ct-dark)' : '#6b7280',
                      cursor: 'pointer',
                    }}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleResetDefault}
              style={{
                fontSize: 11, color: '#4b5563', background: 'transparent',
                border: 'none', textDecoration: 'underline', cursor: 'pointer',
              }}
            >
              Reset to #TH98765 Sample
            </button>
          </div>

          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setError(null); setSuccess(false) }}
            spellCheck={false}
            placeholder="Paste JSON or raw Thai text here…"
            style={{
              width: '100%',
              height: 240,
              resize: 'vertical',
              border: `1px solid ${error ? 'var(--cti-red)' : success ? '#22c55e' : 'var(--zd-border)'}`,
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 12,
              lineHeight: 1.6,
              color: '#1f2937',
              background: success ? '#f0fdf4' : '#f9fafb',
              outline: 'none',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            }}
          />

          {error && (
            <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px' }}>
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div style={{ fontSize: 12, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 12px' }}>
              ✅ Transcript successfully loaded into session!
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button
              onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--zd-border)', background: 'white', color: '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handlePasteLoad}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                background: 'linear-gradient(135deg,var(--ct-orange),var(--ct-dark))',
                color: 'white', fontSize: 12, fontWeight: 700,
                boxShadow: '0 2px 8px rgba(255,107,0,0.3)', cursor: 'pointer',
              }}
            >
              Load Transcript →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
