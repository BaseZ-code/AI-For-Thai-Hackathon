import { useState, useEffect } from 'react'

export default function CustomerTab({ fields, pushed }) {
  // fields shape from mapResponse: { name, phone, category, priority, sentiment, priorityColour }
  const [flash, setFlash] = useState({})

  useEffect(() => {
    if (!pushed) return
    // Trigger flash on every field when push happens
    const keys = ['phone', 'category', 'priority', 'sentiment']
    const next = {}
    keys.forEach(k => { next[k] = true })
    setFlash(next)
    const t = setTimeout(() => setFlash({}), 800)
    return () => clearTimeout(t)
  }, [pushed])

  const high = fields?.priorityColour === 'red'

  return (
    <div style={{ padding:14, display:'flex', flexDirection:'column', gap:14 }}>

      {/* Requester block */}
      <div>
        <SectionTitle>Requester</SectionTitle>
        <div style={{ background:'white', border:'1px solid var(--zd-border)', borderRadius:8, padding:12 }}>
          <FieldRow label="Full name">
            <FieldVal>{fields?.name || 'Somchai Janthong'}</FieldVal>
          </FieldRow>
          <FieldRow label="Phone">
            <FieldVal flash={flash.phone} empty={!fields?.phone}>
              {fields?.phone || '—'}
            </FieldVal>
          </FieldRow>
          <FieldRow label="Email">
            <FieldVal>somchai.j@example.co.th</FieldVal>
          </FieldRow>
          <FieldRow label="Previous tickets" last>
            <FieldVal>3 tickets</FieldVal>
          </FieldRow>
        </div>
      </div>

      {/* Ticket fields block */}
      <div>
        <SectionTitle>Ticket Fields</SectionTitle>
        <div style={{ background:'white', border:'1px solid var(--zd-border)', borderRadius:8, padding:12 }}>
          <TfRow label="Category">
            <TfVal flash={flash.category} empty={!fields?.category}>{fields?.category || '—'}</TfVal>
          </TfRow>
          <TfRow label="Priority">
            <TfVal flash={flash.priority}>
              <span style={{
                padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:700,
                background: high ? '#fef2f2' : '#eff6ff',
                color:      high ? '#991b1b' : '#1d4ed8',
                border:     `1px solid ${high ? '#fecaca' : '#bfdbfe'}`,
                transition:'all 0.4s',
              }}>
                {fields?.priority || 'Normal'}
              </span>
            </TfVal>
          </TfRow>
          <TfRow label="Sentiment">
            <TfVal flash={flash.sentiment} empty={!fields?.sentiment}>{fields?.sentiment || '—'}</TfVal>
          </TfRow>
          <TfRow label="Tags" last>
            <TfVal>billing, refund</TfVal>
          </TfRow>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize:10, fontWeight:700, color:'var(--zd-text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
      {children}
    </div>
  )
}

function FieldRow({ label, children, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : 10 }}>
      <div style={{ fontSize:11, color:'var(--zd-text-muted)', fontWeight:500, marginBottom:3 }}>{label}</div>
      {children}
    </div>
  )
}

function FieldVal({ children, flash, empty }) {
  return (
    <div style={{
      fontSize:13, fontWeight: empty ? 400 : 500,
      color: flash ? 'var(--ct-orange)' : empty ? '#9ca3af' : '#111827',
      borderRadius:4,
      animation: flash ? 'flash-orange 0.7s ease forwards' : 'none',
      transition:'color 0.4s',
    }}>{children}</div>
  )
}

function TfRow({ label, children, last }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: last ? 0 : 8 }}>
      <div style={{ fontSize:11, color:'var(--zd-text-muted)' }}>{label}</div>
      {children}
    </div>
  )
}

function TfVal({ children, flash, empty }) {
  return (
    <div style={{
      fontSize:12, fontWeight: empty ? 400 : 500,
      color: flash ? 'var(--ct-orange)' : empty ? '#9ca3af' : '#374151',
      animation: flash ? 'flash-orange 0.7s ease forwards' : 'none',
      borderRadius:4, transition:'color 0.4s',
    }}>{children}</div>
  )
}
