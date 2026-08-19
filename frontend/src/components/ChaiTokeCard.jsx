import { useState, useEffect } from 'react'

const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent']
const SENTIMENT_OPTIONS = [
  { value: 'positive', emoji: '😊', label: 'Positive' },
  { value: 'neutral',  emoji: '😐', label: 'Neutral' },
  { value: 'negative', emoji: '😤', label: 'Frustrated' },
  { value: 'mixed',    emoji: '😕', label: 'Mixed' },
]

export default function ChaiTokeCard({ chaiState, mapped, rawResult, isOffline, onPush, pushed }) {
  const [collapsed, setCollapsed] = useState(false)
  const [editMode,  setEditMode]  = useState(false)
  const [showJsonModal, setShowJsonModal] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  // Editable draft — seeded from mapped when results arrive
  const [draft, setDraft] = useState(null)

  // Seed draft when mapped first arrives
  useEffect(() => {
    if (mapped && !draft) {
      setDraft({
        customerName:   mapped.customerName   || '',
        phone:          mapped.phone          || '',
        orderId:        mapped.orderId        || '',
        issueCategory:  mapped.issueCategory  || '',
        priorityLabel:  (mapped.priorityLabel || 'normal').toLowerCase(),
        sentimentValue: mapped.sentimentLabel === 'Frustrated' ? 'negative'
                      : mapped.sentimentLabel === 'Positive'  ? 'positive'
                      : mapped.sentimentLabel === 'Mixed'     ? 'mixed'
                      : 'neutral',
        notes: '',
      })
    }
  }, [mapped])

  function handlePush() {
    onPush(draft)
  }

  function handleDownloadJson() {
    if (!rawResult) return
    const extractionId = rawResult.data?.extraction_id || 'demo'
    const blob = new Blob([JSON.stringify(rawResult, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chaitoke-api-result-${extractionId}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2500)
  }

  return (
    <div style={{ background:'white', border:'1px solid var(--zd-border)', borderRadius:8, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>

      {/* ── Zendesk app-card chrome header ── */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px', borderBottom:'1px solid var(--zd-border)', cursor:'pointer', userSelect:'none', background:'#fdfdfd' }}
      >
        <div style={{ width:22, height:22, borderRadius:4, flexShrink:0, background:'linear-gradient(135deg,var(--ct-orange),var(--ct-dark))', color:'white', fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>CT</div>
        <div style={{ flex:1, fontSize:12, fontWeight:600, color:'#374151' }}>ChaiToke</div>
        {isOffline && <span style={{ fontSize:9, fontWeight:700, color:'#dc2626', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:99, padding:'1px 6px' }}>DEMO</span>}
        {chaiState === 'results' && !pushed && (
          <button
            onClick={e => { e.stopPropagation(); setEditMode(m => !m) }}
            style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:99, border:'1px solid var(--zd-border)', background: editMode ? 'var(--ct-lt)' : 'white', color: editMode ? 'var(--ct-dark)' : '#6b7280', cursor:'pointer' }}
          >
            {editMode ? '✓ Done' : '✏️ Edit'}
          </button>
        )}
        <span style={{ fontSize:11, color:'#9ca3af', transform: collapsed ? 'rotate(-90deg)' : 'none', transition:'transform 0.2s' }}>▾</span>
      </div>

      {/* ── Body ── */}
      {!collapsed && (
        <div style={{ background:'var(--ct-lt)' }}>

          {/* WAITING */}
          {chaiState === 'waiting' && (
            <div style={{ padding:'20px 14px', textAlign:'center' }}>
              <div style={{ fontSize:28, marginBottom:8 }}>⏳</div>
              <div style={{ fontSize:12, color:'#92400e', fontWeight:500, lineHeight:1.5 }}>Waiting for call to end</div>
              <div style={{ fontSize:11, color:'#b45309', marginTop:4 }}>ChaiToke will auto-generate this ticket the moment the call disconnects.</div>
            </div>
          )}

          {/* LOADING */}
          {chaiState === 'loading' && (
            <div style={{ padding:'24px 14px', textAlign:'center' }}>
              <div style={{ width:28, height:28, borderRadius:'50%', border:'3px solid var(--ct-mid)', borderTopColor:'var(--ct-orange)', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
              <div style={{ fontSize:12, fontWeight:600, color:'var(--ct-dark)' }}>Analyzing call with Thai LLM…</div>
              <div style={{ fontSize:11, color:'#b45309', marginTop:4 }}>กำลังประมวลผลการสนทนา</div>
            </div>
          )}

          {/* RESULTS */}
          {chaiState === 'results' && mapped && draft && (
            <div style={{ display:'flex', flexDirection:'column', animation:'fade-in 0.35s ease' }}>

              {/* Result header & Download Action */}
              <div style={{ padding:'10px 14px 8px', borderBottom:'1px solid var(--ct-mid)', display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ flex:1, fontSize:10, fontWeight:700, color:'var(--ct-dark)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                  {editMode ? '✏️ Editing' : '✨ Auto-generated'}
                </div>
                {!editMode && mapped.confidence != null && (
                  <span style={{ fontSize:10, color:'#059669', fontWeight:600, background:'#d1fae5', padding:'2px 6px', borderRadius:99 }}>{mapped.confidence}% conf</span>
                )}
                
                {/* Download Server Result JSON */}
                {rawResult && (
                  <button
                    onClick={handleDownloadJson}
                    title="Download raw server JSON response"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 10, fontWeight: 700,
                      padding: '2px 8px', borderRadius: 99,
                      border: '1px solid #fed7aa',
                      background: downloaded ? '#f0fdf4' : 'white',
                      color: downloaded ? '#16a34a' : 'var(--ct-dark)',
                      cursor: 'pointer', transition: 'all 0.15s',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    }}
                  >
                    {downloaded ? '✓ Saved' : '↓ JSON'}
                  </button>
                )}
              </div>

              {/* Fields — VIEW or EDIT mode */}
              <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:10 }}>

                {editMode ? (
                  /* ── EDIT MODE ── */
                  <>
                    <EditField label="Customer Name">
                      <input value={draft.customerName} onChange={e => setDraft(d => ({...d, customerName: e.target.value}))} style={inputStyle} />
                    </EditField>
                    <EditField label="Phone">
                      <input value={draft.phone} onChange={e => setDraft(d => ({...d, phone: e.target.value}))} style={inputStyle} placeholder="+66 XX XXX XXXX" />
                    </EditField>
                    <EditField label="Order ID (optional)">
                      <input value={draft.orderId} onChange={e => setDraft(d => ({...d, orderId: e.target.value}))} style={inputStyle} placeholder="e.g. TH12345" />
                    </EditField>
                    <EditField label="Issue Category">
                      <input value={draft.issueCategory} onChange={e => setDraft(d => ({...d, issueCategory: e.target.value}))} style={inputStyle} />
                    </EditField>
                    <EditField label="Priority">
                      <select value={draft.priorityLabel} onChange={e => setDraft(d => ({...d, priorityLabel: e.target.value}))} style={{ ...inputStyle, cursor:'pointer' }}>
                        {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
                      </select>
                    </EditField>
                    <EditField label="Sentiment">
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        {SENTIMENT_OPTIONS.map(s => (
                          <button key={s.value} onClick={() => setDraft(d => ({...d, sentimentValue: s.value}))} style={{
                            padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:600,
                            border:`1px solid ${draft.sentimentValue===s.value ? 'var(--ct-orange)' : 'var(--zd-border)'}`,
                            background: draft.sentimentValue===s.value ? 'var(--ct-lt)' : 'white',
                            color: draft.sentimentValue===s.value ? 'var(--ct-dark)' : '#6b7280',
                            cursor:'pointer',
                          }}>
                            {s.emoji} {s.label}
                          </button>
                        ))}
                      </div>
                    </EditField>
                    <EditField label="Agent Notes">
                      <textarea
                        value={draft.notes}
                        onChange={e => setDraft(d => ({...d, notes: e.target.value}))}
                        placeholder="Add notes before pushing to ticket…"
                        style={{ ...inputStyle, height:72, resize:'vertical' }}
                      />
                    </EditField>
                  </>
                ) : (
                  /* ── VIEW MODE ── */
                  <>
                    <ViewField label="Customer Name">{draft.customerName || '—'}</ViewField>
                    <ViewField label="Phone">{draft.phone || '—'}</ViewField>
                    {draft.orderId && <ViewField label="Order ID">#{draft.orderId}</ViewField>}
                    <ViewField label="Issue Category">💳 {draft.issueCategory}</ViewField>
                    <ViewField label="Sentiment · Priority">
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:15 }}>{SENTIMENT_OPTIONS.find(s => s.value === draft.sentimentValue)?.emoji || '😐'}</span>
                        <span>{SENTIMENT_OPTIONS.find(s => s.value === draft.sentimentValue)?.label || draft.sentimentValue}</span>
                        <span style={{ color:'#9ca3af' }}>·</span>
                        <PriorityBadge p={draft.priorityLabel}>{draft.priorityLabel.charAt(0).toUpperCase()+draft.priorityLabel.slice(1)}</PriorityBadge>
                      </div>
                    </ViewField>

                    {/* Extracted entities */}
                    <div>
                      <div style={{ fontSize:10, fontWeight:600, color:'var(--ct-dark)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Extracted Entities</div>
                      <div style={{ fontSize:12, color:'#292524', lineHeight:1.55, background:'white', border:'1px solid var(--ct-mid)', borderRadius:6, padding:'8px 10px', display:'flex', flexDirection:'column', gap:4 }}>
                        {mapped.entities.length > 0
                          ? mapped.entities.map((e, i) => (
                              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <span style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.04em' }}>{e.type}</span>
                                <span style={{ fontWeight:500 }}>{e.value}</span>
                              </div>
                            ))
                          : <span style={{ color:'#9ca3af' }}>No entities detected</span>
                        }
                      </div>
                    </div>

                    {/* Agent notes preview */}
                    {draft.notes && (
                      <div>
                        <div style={{ fontSize:10, fontWeight:600, color:'var(--ct-dark)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Agent Notes</div>
                        <div style={{ fontSize:12, color:'#374151', lineHeight:1.5, background:'white', border:'1px solid var(--ct-mid)', borderRadius:6, padding:'8px 10px' }}>{draft.notes}</div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Push button & secondary actions */}
              {!editMode && (
                <>
                  <button onClick={handlePush} disabled={pushed} style={{
                    width:'calc(100% - 28px)', margin:'4px 14px 6px',
                    padding:'10px', borderRadius:8, border:'none',
                    background: pushed ? '#d1d5db' : 'linear-gradient(135deg,var(--ct-orange),var(--ct-dark))',
                    color: pushed ? '#9ca3af' : 'white',
                    fontSize:13, fontWeight:700,
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    boxShadow: pushed ? 'none' : '0 2px 8px rgba(255,107,0,0.35)',
                    cursor: pushed ? 'not-allowed' : 'pointer',
                    transition:'all 0.2s',
                  }}>
                    {pushed ? '✓ Pushed to ticket' : '⬆ Push to Ticket Fields'}
                  </button>

                  {/* Secondary button: View raw JSON */}
                  {rawResult && (
                    <div style={{ display: 'flex', justifyContent: 'center', margin: '0 14px 10px' }}>
                      <button
                        onClick={() => setShowJsonModal(true)}
                        style={{
                          background: 'transparent', border: 'none',
                          color: '#b45309', fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', textDecoration: 'underline',
                        }}
                      >
                        {'{ } View Server JSON Response'}
                      </button>
                    </div>
                  )}

                  <div style={{ padding:'8px 14px', borderTop:'1px solid var(--ct-mid)', fontSize:10, color:'#b45309', display:'flex', alignItems:'center', gap:4 }}>
                    🔒 Connected via ChaiToke API · Scopes: Tickets (read/write)
                  </div>
                </>
              )}

              {/* Edit-mode confirm */}
              {editMode && (
                <button onClick={() => setEditMode(false)} style={{
                  width:'calc(100% - 28px)', margin:'4px 14px 14px',
                  padding:'9px', borderRadius:8,
                  border:'1px solid var(--ct-orange)', background:'white',
                  color:'var(--ct-dark)', fontSize:13, fontWeight:700,
                  cursor:'pointer',
                }}>
                  ✓ Confirm edits
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Raw JSON Modal */}
      {showJsonModal && rawResult && (
        <div
          onClick={() => setShowJsonModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 12, width: 'min(680px, 92vw)',
              maxHeight: '85vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 24px 64px rgba(0,0,0,0.3)', overflow: 'hidden',
              animation: 'slide-down 0.2s ease',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 18px', borderBottom: '1px solid var(--zd-border)', background: '#fafafa',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>⚡ Server API Response JSON</div>
                <div style={{ fontSize: 10, color: 'var(--zd-text-muted)', marginTop: 2 }}>
                  Extraction ID: {rawResult.data?.extraction_id || 'N/A'} · Model: {rawResult.meta?.model || 'N/A'}
                </div>
              </div>
              <button
                onClick={() => setShowJsonModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: 18, color: '#9ca3af', cursor: 'pointer', padding: '2px 6px' }}
              >
                ×
              </button>
            </div>

            <div style={{ flex: 1, padding: 14, overflowY: 'auto', background: '#0f172a' }}>
              <pre style={{
                margin: 0, color: '#38bdf8', fontSize: 11, fontFamily: 'ui-monospace, monospace', lineHeight: 1.5,
              }}>
                {JSON.stringify(rawResult, null, 2)}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 18px', borderTop: '1px solid var(--zd-border)', background: 'white' }}>
              <button
                onClick={() => setShowJsonModal(false)}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--zd-border)', background: 'white', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                onClick={handleDownloadJson}
                style={{
                  padding: '6px 16px', borderRadius: 6, border: 'none',
                  background: 'linear-gradient(135deg,var(--ct-orange),var(--ct-dark))',
                  color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                ↓ Download File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────

const inputStyle = {
  width:'100%', padding:'6px 8px', borderRadius:6,
  border:'1px solid var(--ct-mid)', background:'white',
  fontSize:12, color:'#1f2937', outline:'none',
  fontFamily:'Inter, sans-serif',
}

function EditField({ label, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <div style={{ fontSize:10, fontWeight:600, color:'var(--ct-dark)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
      {children}
    </div>
  )
}

function ViewField({ label, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
      <div style={{ fontSize:10, fontWeight:600, color:'var(--ct-dark)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:500, color:'#1c1917', lineHeight:1.4 }}>{children}</div>
    </div>
  )
}

function PriorityBadge({ p, children }) {
  const high = p === 'high' || p === 'urgent'
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:700,
      background: high ? '#fef2f2' : '#eff6ff',
      color:      high ? '#991b1b' : '#1d4ed8',
      border:     `1px solid ${high ? '#fecaca' : '#bfdbfe'}`,
    }}>
      {high ? '🔴' : '🔵'} {children}
    </span>
  )
}
