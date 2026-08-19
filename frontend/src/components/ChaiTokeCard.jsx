import { useState, useEffect } from 'react'

const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent']
const DAMAGE_TYPE_OPTIONS = [
  'Structural_Failure',
  'Cosmetic_Damage',
  'Missing_Assembly_Hardware',
]
const ESCALATION_TARGET_OPTIONS = [
  'Logistics_Delivery_Team',
  'Home_Service_Technician',
  'Furniture_Vendor_Support',
]
const TICKET_STATUS_OPTIONS = [
  'Replacement_Dispatched',
  'Pending_Inspection',
  'Awaiting_Photos',
]

export default function ChaiTokeCard({ chaiState, mapped, rawResult, isOffline, onPush, pushed }) {
  const [collapsed, setCollapsed] = useState(false)
  const [editMode,  setEditMode]  = useState(false)
  const [showJsonModal, setShowJsonModal] = useState(false)
  const [copiedBluf, setCopiedBluf] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  // Editable draft
  const [draft, setDraft] = useState(null)

  useEffect(() => {
    if (mapped && !draft) {
      setDraft({
        customerName:       mapped.customerName       || '',
        phone:              mapped.phone              || '',
        invoiceNo:          mapped.invoiceNo          || '',
        productSku:         mapped.productSku         || '',
        damageType:         mapped.damageType         || 'Structural_Failure',
        photosReceived:     mapped.photosReceived     ?? true,
        incidentDesc:       mapped.incidentDesc       || '',
        escalationRequired: mapped.escalationRequired ?? false,
        escalationTarget:   mapped.escalationTarget   || 'Logistics_Delivery_Team',
        ticketStatus:       mapped.ticketStatus       || 'Replacement_Dispatched',
        actionDeadline:     mapped.actionDeadline     || 'Within 48 hours',
        priorityLabel:      (mapped.priorityLabel     || 'high').toLowerCase(),
        sentimentValue:     mapped.sentimentLabel === 'Frustrated' ? 'negative' : 'neutral',
        blufText:           mapped.blufFormatted      || '',
        notes: '',
      })
    }
  }, [mapped])

  function handlePush() {
    onPush(draft)
  }

  function handleCopyBluf() {
    const textToCopy = draft?.blufText || mapped?.blufFormatted || ''
    if (!textToCopy) return
    navigator.clipboard.writeText(textToCopy)
    setCopiedBluf(true)
    setTimeout(() => setCopiedBluf(false), 2000)
  }

  function handleDownloadJson() {
    if (!rawResult) return
    const extractionId = rawResult.data?.extraction_id || 'demo'
    const blob = new Blob([JSON.stringify(rawResult, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chaitoke-homepro-${extractionId}-${Date.now()}.json`
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
        <div style={{ flex:1, fontSize:12, fontWeight:600, color:'#374151' }}>ChaiToke · HomePro Triage</div>
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
              <div style={{ fontSize:12, color:'#92400e', fontWeight:500, lineHeight:1.5 }}>Waiting for Call Session</div>
              <div style={{ fontSize:11, color:'#b45309', marginTop:4 }}>ChaiToke will auto-generate HomePro Triage & BLUF note upon call completion.</div>
            </div>
          )}

          {/* LOADING */}
          {chaiState === 'loading' && (
            <div style={{ padding:'24px 14px', textAlign:'center' }}>
              <div style={{ width:28, height:28, borderRadius:'50%', border:'3px solid var(--ct-mid)', borderTopColor:'var(--ct-orange)', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
              <div style={{ fontSize:12, fontWeight:600, color:'var(--ct-dark)' }}>Triaging call with Thai LLM…</div>
              <div style={{ fontSize:11, color:'#b45309', marginTop:4 }}>กำลังจำแนกความเสียหายและสร้างบันทึก BLUF</div>
            </div>
          )}

          {/* RESULTS */}
          {chaiState === 'results' && mapped && draft && (
            <div style={{ display:'flex', flexDirection:'column', animation:'fade-in 0.35s ease' }}>

              {/* Result header & Download Action */}
              <div style={{ padding:'10px 14px 8px', borderBottom:'1px solid var(--ct-mid)', display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ flex:1, fontSize:10, fontWeight:700, color:'var(--ct-dark)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                  {editMode ? '✏️ Editing Triage' : '✨ Auto-Triage & ACW'}
                </div>
                {!editMode && mapped.confidence != null && (
                  <span style={{ fontSize:10, color:'#059669', fontWeight:600, background:'#d1fae5', padding:'2px 6px', borderRadius:99 }}>{mapped.confidence}% conf</span>
                )}
                
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
                    <EditField label="Customer Phone (HomeCard)">
                      <input value={draft.phone} onChange={e => setDraft(d => ({...d, phone: e.target.value}))} style={inputStyle} />
                    </EditField>
                    <EditField label="Invoice / Receipt #">
                      <input value={draft.invoiceNo} onChange={e => setDraft(d => ({...d, invoiceNo: e.target.value}))} style={inputStyle} />
                    </EditField>
                    <EditField label="Product SKU / Model">
                      <input value={draft.productSku} onChange={e => setDraft(d => ({...d, productSku: e.target.value}))} style={inputStyle} />
                    </EditField>
                    <EditField label="Furniture Damage Classification">
                      <select value={draft.damageType} onChange={e => setDraft(d => ({...d, damageType: e.target.value}))} style={{ ...inputStyle, cursor:'pointer' }}>
                        {DAMAGE_TYPE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </EditField>
                    <EditField label="LINE OA Photo Evidence">
                      <select value={draft.photosReceived ? 'yes' : 'no'} onChange={e => setDraft(d => ({...d, photosReceived: e.target.value === 'yes'}))} style={{ ...inputStyle, cursor:'pointer' }}>
                        <option value="yes">🟢 Received via LINE OA</option>
                        <option value="no">🔴 Awaiting Customer Photos</option>
                      </select>
                    </EditField>
                    <EditField label="Escalation Target">
                      <select value={draft.escalationTarget} onChange={e => setDraft(d => ({...d, escalationTarget: e.target.value}))} style={{ ...inputStyle, cursor:'pointer' }}>
                        {ESCALATION_TARGET_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </EditField>
                    <EditField label="Ticket Status">
                      <select value={draft.ticketStatus} onChange={e => setDraft(d => ({...d, ticketStatus: e.target.value}))} style={{ ...inputStyle, cursor:'pointer' }}>
                        {TICKET_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </EditField>
                    <EditField label="Action Deadline / SLA">
                      <input value={draft.actionDeadline} onChange={e => setDraft(d => ({...d, actionDeadline: e.target.value}))} style={inputStyle} />
                    </EditField>
                    <EditField label="BLUF Free-Note (CRM Note)">
                      <textarea
                        value={draft.blufText}
                        onChange={e => setDraft(d => ({...d, blufText: e.target.value}))}
                        style={{ ...inputStyle, height:85, resize:'vertical' }}
                      />
                    </EditField>
                  </>
                ) : (
                  /* ── VIEW MODE (HomePro Structured Layout) ── */
                  <>
                    {/* Identity block */}
                    <div style={{ background:'white', border:'1px solid var(--ct-mid)', borderRadius:6, padding:'8px 10px', display:'flex', flexDirection:'column', gap:4 }}>
                      <div style={{ display:'flex', justifyContent:'space-between' }}>
                        <span style={{ fontSize:10, color:'#78716c', fontWeight:600 }}>HOMECARD</span>
                        <span style={{ fontSize:12, fontWeight:700, color:'#1c1917' }}>{draft.phone || '—'}</span>
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between' }}>
                        <span style={{ fontSize:10, color:'#78716c', fontWeight:600 }}>INVOICE #</span>
                        <span style={{ fontSize:11, fontWeight:600, color:'#0369a1' }}>{draft.invoiceNo || '—'}</span>
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between' }}>
                        <span style={{ fontSize:10, color:'#78716c', fontWeight:600 }}>MODEL</span>
                        <span style={{ fontSize:11, fontWeight:600, color:'#1c1917' }}>{draft.productSku || '—'}</span>
                      </div>
                    </div>

                    {/* Customer Mood & Sentiment Detection Card */}
                    <div style={{
                      background: mapped.sentimentOverall === 'negative' ? '#fff1f2' : mapped.sentimentOverall === 'positive' ? '#f0fdf4' : '#f8fafc',
                      border: `1px solid ${mapped.sentimentOverall === 'negative' ? '#fecdd3' : mapped.sentimentOverall === 'positive' ? '#bbf7d0' : '#e2e8f0'}`,
                      borderRadius: 6, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Customer Mood & Tone
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4,
                          color: mapped.sentimentOverall === 'negative' ? '#e11d48' : mapped.sentimentOverall === 'positive' ? '#16a34a' : '#475569',
                        }}>
                          {mapped.sentimentEmoji} {mapped.moodLevel || mapped.sentimentLabel}
                        </span>
                      </div>

                      {/* Visual Sentiment Spectrum Bar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8', fontWeight: 600, marginBottom: 3 }}>
                          <span>Upset (-1.0)</span>
                          <span style={{ fontWeight: 700, color: '#334155' }}>Score: {typeof mapped.sentimentScore === 'number' ? mapped.sentimentScore.toFixed(2) : '0.00'}</span>
                          <span>Delighted (+1.0)</span>
                        </div>
                        <div style={{ height: 6, width: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #f87171, #fbbf24, #4ade80)', position: 'relative', overflow: 'hidden' }}>
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: `${Math.max(5, Math.min(95, ((mapped.sentimentScore + 1) / 2) * 100))}%`,
                            width: 6,
                            borderRadius: '50%',
                            background: '#0f172a',
                            boxShadow: '0 0 4px rgba(0,0,0,0.5)',
                            transform: 'translateX(-50%)',
                          }} />
                        </div>
                      </div>

                      {/* Empathy Recommendation */}
                      {mapped.moodRecommendation && (
                        <div style={{
                          fontSize: 10.5, lineHeight: 1.4, color: '#334155',
                          background: 'rgba(255,255,255,0.7)', borderRadius: 4, padding: '4px 6px',
                          border: '1px solid rgba(0,0,0,0.05)',
                        }}>
                          <span style={{ fontWeight: 700, color: 'var(--ct-dark)' }}>💡 Agent Empathy Tip: </span>
                          {mapped.moodRecommendation}
                        </div>
                      )}
                    </div>

                    {/* Triage & Escalation Pills */}
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <div>
                        <div style={{ fontSize:10, fontWeight:600, color:'var(--ct-dark)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>Damage Classification</div>
                        <div style={{
                          fontSize:11, fontWeight:700, padding:'4px 8px', borderRadius:6,
                          background:'#fef2f2', border:'1px solid #fecaca', color:'#991b1b',
                        }}>
                          {mapped.damageTypeLabel || draft.damageType}
                        </div>
                      </div>

                      <div style={{ display:'flex', gap:6 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:10, fontWeight:600, color:'var(--ct-dark)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>Photo Evidence</div>
                          <span style={{
                            display:'inline-flex', alignItems:'center', gap:4,
                            padding:'2px 7px', borderRadius:99, fontSize:10, fontWeight:700,
                            background: draft.photosReceived ? '#f0fdf4' : '#fef2f2',
                            color: draft.photosReceived ? '#16a34a' : '#dc2626',
                            border: `1px solid ${draft.photosReceived ? '#bbf7d0' : '#fecaca'}`,
                          }}>
                            {draft.photosReceived ? '🟢 LINE OA Photos' : '🔴 Missing Photos'}
                          </span>
                        </div>

                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:10, fontWeight:600, color:'var(--ct-dark)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>SLA Deadline</div>
                          <span style={{ fontSize:11, fontWeight:700, color:'#1e293b' }}>
                            ⏱️ {draft.actionDeadline}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize:10, fontWeight:600, color:'var(--ct-dark)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>Escalation Route</div>
                        <div style={{
                          fontSize:11, fontWeight:600, padding:'4px 8px', borderRadius:6,
                          background:'#eff6ff', border:'1px solid #bfdbfe', color:'#1d4ed8',
                        }}>
                          {mapped.escalationTargetLabel || draft.escalationTarget}
                        </div>
                      </div>
                    </div>

                    {/* BLUF Note Card */}
                    <div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'var(--ct-dark)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                          📝 AI BLUF Note (Internal Note)
                        </div>
                        <button
                          onClick={handleCopyBluf}
                          style={{
                            fontSize:10, fontWeight:600, padding:'1px 6px', borderRadius:4,
                            border:'1px solid var(--zd-border)', background:'white', color:'#4b5563', cursor:'pointer',
                          }}
                        >
                          {copiedBluf ? '✓ Copied' : '📋 Copy'}
                        </button>
                      </div>
                      <div style={{
                        fontSize:11, color:'#1c1917', lineHeight:1.5,
                        background:'white', border:'1px solid var(--ct-mid)', borderRadius:6,
                        padding:'8px 10px', whiteSpace:'pre-wrap', fontFamily:'Inter, sans-serif',
                      }}>
                        {draft.blufText}
                      </div>
                    </div>
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
                    {pushed ? '✓ Pushed & Filled BLUF' : '⬆ Push to Ticket & BLUF Note'}
                  </button>

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

                  <div style={{ padding:'8px 14px', borderTop:'1px solid var(--ct-mid)', fontSize:10, color:'#b45309', display:'flex', alignItems:'center', gap:4 }}>
                    🔒 Connected via ChaiToke API · HomePro Scope (Tickets + CRM)
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
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--zd-border)', background: '#fafafa' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>⚡ Server API Response JSON</div>
                <div style={{ fontSize: 10, color: 'var(--zd-text-muted)', marginTop: 2 }}>
                  Extraction ID: {rawResult.data?.extraction_id || 'N/A'} · Model: {rawResult.meta?.model || 'N/A'}
                </div>
              </div>
              <button onClick={() => setShowJsonModal(false)} style={{ background: 'transparent', border: 'none', fontSize: 18, color: '#9ca3af', cursor: 'pointer', padding: '2px 6px' }}>×</button>
            </div>

            <div style={{ flex: 1, padding: 14, overflowY: 'auto', background: '#0f172a' }}>
              <pre style={{ margin: 0, color: '#38bdf8', fontSize: 11, fontFamily: 'ui-monospace, monospace', lineHeight: 1.5 }}>
                {JSON.stringify(rawResult, null, 2)}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 18px', borderTop: '1px solid var(--zd-border)', background: 'white' }}>
              <button onClick={() => setShowJsonModal(false)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--zd-border)', background: 'white', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Close</button>
              <button onClick={handleDownloadJson} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: 'linear-gradient(135deg,var(--ct-orange),var(--ct-dark))', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>↓ Download File</button>
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
    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
      <div style={{ fontSize:10, fontWeight:600, color:'var(--ct-dark)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
      {children}
    </div>
  )
}
