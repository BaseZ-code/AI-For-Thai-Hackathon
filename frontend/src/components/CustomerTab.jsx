import { useState, useEffect } from 'react'

export default function CustomerTab({ fields, pushed }) {
  const [flash, setFlash] = useState({})

  useEffect(() => {
    if (!pushed) return
    const keys = ['phone', 'invoiceNo', 'productSku', 'category', 'status', 'escalation', 'deadline', 'priority']
    const next = {}
    keys.forEach(k => { next[k] = true })
    setFlash(next)
    const t = setTimeout(() => setFlash({}), 900)
    return () => clearTimeout(t)
  }, [pushed])

  const high = fields?.priorityColour === 'red' || fields?.priority === 'High' || fields?.priority === 'Urgent'

  return (
    <div style={{ padding:14, display:'flex', flexDirection:'column', gap:14 }}>

      {/* Requester / Member Info */}
      <div>
        <SectionTitle>HomeCard Customer Identity</SectionTitle>
        <div style={{ background:'white', border:'1px solid var(--zd-border)', borderRadius:8, padding:12 }}>
          <FieldRow label="Full Name">
            <FieldVal>{fields?.name || 'Demo User'}</FieldVal>
          </FieldRow>
          <FieldRow label="HomeCard Phone">
            <FieldVal flash={flash.phone} empty={!fields?.phone}>
              {fields?.phone || '—'}
            </FieldVal>
          </FieldRow>
          <FieldRow label="Invoice / Receipt #" last>
            <FieldVal flash={flash.invoiceNo} empty={!fields?.invoiceNo}>
              {fields?.invoiceNo || '—'}
            </FieldVal>
          </FieldRow>
        </div>
      </div>

      {/* Ticket Fields & ACW */}
      <div>
        <SectionTitle>After-Call Work & Triage</SectionTitle>
        <div style={{ background:'white', border:'1px solid var(--zd-border)', borderRadius:8, padding:12 }}>
          <TfRow label="Product SKU / Model">
            <TfVal flash={flash.productSku} empty={!fields?.productSku}>{fields?.productSku || '—'}</TfVal>
          </TfRow>
          <TfRow label="Damage Classification">
            <TfVal flash={flash.category} empty={!fields?.category}>
              <span style={{ color: fields?.category ? '#dc2626' : '#9ca3af', fontWeight: 700 }}>
                {fields?.category || '—'}
              </span>
            </TfVal>
          </TfRow>
          <TfRow label="Ticket Status">
            <TfVal flash={flash.status}>
              <span style={{ padding:'2px 6px', borderRadius:4, fontSize:10, fontWeight:700, background: fields?.ticketStatus ? '#f0fdf4' : '#f3f4f6', color: fields?.ticketStatus ? '#16a34a' : '#6b7280', border: `1px solid ${fields?.ticketStatus ? '#bbf7d0' : '#e5e7eb'}` }}>
                {fields?.ticketStatus || 'Pending'}
              </span>
            </TfVal>
          </TfRow>
          <TfRow label="Escalation Route">
            <TfVal flash={flash.escalation}>
              <span style={{ padding:'2px 6px', borderRadius:4, fontSize:10, fontWeight:700, background: fields?.escalation ? '#eff6ff' : '#f3f4f6', color: fields?.escalation ? '#1d4ed8' : '#6b7280', border: `1px solid ${fields?.escalation ? '#bfdbfe' : '#e5e7eb'}` }}>
                {fields?.escalation || '—'}
              </span>
            </TfVal>
          </TfRow>
          <TfRow label="Action SLA Deadline">
            <TfVal flash={flash.deadline}>{fields?.deadline || '—'}</TfVal>
          </TfRow>
          <TfRow label="Priority" last>
            <TfVal flash={flash.priority}>
              <span style={{
                padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:700,
                background: high ? '#fef2f2' : '#eff6ff',
                color:      high ? '#991b1b' : '#1d4ed8',
                border:     `1px solid ${high ? '#fecaca' : '#bfdbfe'}`,
              }}>
                {fields?.priority || 'Normal'}
              </span>
            </TfVal>
          </TfRow>
        </div>
      </div>

      {/* Customer Mood Detection */}
      {fields?.moodLevel && (
        <div>
          <SectionTitle>Customer Mood & Sentiment</SectionTitle>
          <div style={{ background:'white', border:'1px solid var(--zd-border)', borderRadius:8, padding:12, display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:11, color:'var(--zd-text-muted)', fontWeight:600 }}>Detected Mood</span>
              <span style={{ fontSize:11, fontWeight:700, color: fields?.sentimentScore < -0.15 ? '#dc2626' : fields?.sentimentScore > 0.2 ? '#16a34a' : '#374151' }}>
                {fields?.sentiment || '—'} ({fields?.moodLevel})
              </span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:11, color:'var(--zd-text-muted)', fontWeight:600 }}>Emotional Tone</span>
              <span style={{ fontSize:11, fontWeight:600, color:'#4b5563' }}>{fields?.moodTone || '—'}</span>
            </div>
            {fields?.moodRecommendation && (
              <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, padding:'6px 8px', fontSize:11, color:'#334155', lineHeight:1.4 }}>
                <span style={{ fontWeight:700, color:'#0f172a' }}>💡 Recommended Response: </span>
                {fields.moodRecommendation}
              </div>
            )}
          </div>
        </div>
      )}

      {/* BLUF Note Preview */}
      {fields?.blufNote && (
        <div>
          <SectionTitle>ACW BLUF Internal Note</SectionTitle>
          <div style={{
            background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:10,
            fontSize:11, color:'#92400e', lineHeight:1.5, whiteSpace:'pre-wrap', fontFamily:'Inter, sans-serif',
          }}>
            {fields.blufNote}
          </div>
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize:10, fontWeight:700, color:'var(--zd-text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>
      {children}
    </div>
  )
}

function FieldRow({ label, children, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : 8 }}>
      <div style={{ fontSize:10, color:'var(--zd-text-muted)', fontWeight:600, marginBottom:2 }}>{label}</div>
      {children}
    </div>
  )
}

function FieldVal({ children, flash, empty }) {
  return (
    <div style={{
      fontSize:12, fontWeight: empty ? 400 : 600,
      color: flash ? 'var(--ct-orange)' : empty ? '#9ca3af' : '#111827',
      borderRadius:4, animation: flash ? 'flash-orange 0.7s ease forwards' : 'none',
      transition:'color 0.4s',
    }}>{children}</div>
  )
}

function TfRow({ label, children, last }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: last ? 0 : 7 }}>
      <div style={{ fontSize:11, color:'var(--zd-text-muted)' }}>{label}</div>
      {children}
    </div>
  )
}

function TfVal({ children, flash, empty }) {
  return (
    <div style={{
      fontSize:11, fontWeight: empty ? 400 : 600,
      color: flash ? 'var(--ct-orange)' : empty ? '#9ca3af' : '#374151',
      animation: flash ? 'flash-orange 0.7s ease forwards' : 'none',
      borderRadius:4, transition:'color 0.4s',
    }}>{children}</div>
  )
}
