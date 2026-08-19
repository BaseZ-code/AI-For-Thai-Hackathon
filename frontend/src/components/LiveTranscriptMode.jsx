import { useState, useRef, useEffect } from 'react'

const SOURCES = ['line', 'facebook', 'other']

const ROLE_CFG = {
  customer: {
    label: 'Customer',
    emoji: '👤',
    bubble: { bg: '#f0f4ff', border: '#c7d2fe', textColor: '#1e1b4b' },
    avatar: { bg: 'linear-gradient(135deg,#667eea,#764ba2)', initials: 'CX' },
  },
  agent: {
    label: 'Agent',
    emoji: '🎧',
    bubble: { bg: '#f9fafb', border: '#e5e7eb', textColor: '#374151' },
    avatar: { bg: 'linear-gradient(135deg,#f59e0b,#d97706)', initials: 'AG' },
  },
}

export default function LiveTranscriptMode({ onLoadAndAnalyze, onLoad, disabled }) {
  const [messages, setMessages] = useState([])
  const [activeRole, setActiveRole] = useState('customer')
  const [input, setInput]           = useState('')
  const [source, setSource]         = useState('line')
  const [downloaded, setDownloaded] = useState(false)
  const inputRef  = useRef(null)
  const scrollRef = useRef(null)

  // Auto-scroll to bottom as messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function sendMessage() {
    const text = input.trim()
    if (!text) return
    const msg = {
      role:      activeRole,
      content:   text,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, msg])
    setInput('')
    setDownloaded(false)
    // Auto-switch role after each message (toggle for natural conversation flow)
    setActiveRole(r => r === 'customer' ? 'agent' : 'customer')
    inputRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function deleteMessage(idx) {
    setMessages(prev => prev.filter((_, i) => i !== idx))
  }

  function buildPayload() {
    return { source, messages }
  }

  function handleDownload() {
    const payload  = buildPayload()
    const blob     = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url      = URL.createObjectURL(blob)
    const a        = document.createElement('a')
    a.href         = url
    a.download     = `chaitoke-transcript-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setDownloaded(true)
  }

  function handleEndCall() {
    if (messages.length === 0) return
    const payload = buildPayload()
    onLoadAndAnalyze(payload)   // → handleLoadTranscript + handleEndCall in App
  }

  function handleLoadOnly() {
    if (messages.length === 0) return
    onLoad(buildPayload())      // → just load into uploader without firing API
  }

  const isEmpty = messages.length === 0

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:0 }}>

      {/* ── Source + stats row ── */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 20px', borderBottom:'1px solid var(--zd-border)', flexShrink:0 }}>
        <span style={{ fontSize:11, fontWeight:600, color:'#374151' }}>Platform</span>
        <div style={{ display:'flex', gap:5 }}>
          {SOURCES.map(s => (
            <button key={s} onClick={() => setSource(s)} style={{
              padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:600,
              border:`1px solid ${source===s ? 'var(--ct-orange)' : 'var(--zd-border)'}`,
              background: source===s ? 'var(--ct-lt)' : 'white',
              color: source===s ? 'var(--ct-dark)' : '#6b7280',
              cursor:'pointer',
            }}>{s.charAt(0).toUpperCase()+s.slice(1)}</button>
          ))}
        </div>
        <div style={{ flex:1 }} />
        {!isEmpty && (
          <span style={{ fontSize:11, color:'var(--zd-text-muted)' }}>
            {messages.length} message{messages.length !== 1 ? 's' : ''} recorded
          </span>
        )}
      </div>

      {/* ── Chat bubble area ── */}
      <div ref={scrollRef} style={{
        flex:1, overflowY:'auto', padding:'14px 20px',
        display:'flex', flexDirection:'column', gap:10,
        minHeight: 200, maxHeight: 300,
        background:'#fafafa',
      }}>
        {isEmpty ? (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#9ca3af', textAlign:'center', gap:8 }}>
            <div style={{ fontSize:28 }}>🎙️</div>
            <div style={{ fontSize:13, fontWeight:500 }}>Start typing to build your transcript</div>
            <div style={{ fontSize:11 }}>Role auto-switches after each message · Press Enter to send</div>
          </div>
        ) : messages.map((msg, i) => {
          const cfg = ROLE_CFG[msg.role] || ROLE_CFG.agent
          const time = new Date(msg.timestamp).toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
          return (
            <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', animation:'fade-in 0.2s ease' }}
              onMouseEnter={e => e.currentTarget.querySelector('.del-btn')?.style && (e.currentTarget.querySelector('.del-btn').style.opacity='1')}
              onMouseLeave={e => e.currentTarget.querySelector('.del-btn')?.style && (e.currentTarget.querySelector('.del-btn').style.opacity='0')}
            >
              {/* Avatar */}
              <div style={{
                width:26, height:26, borderRadius:'50%', flexShrink:0,
                background:cfg.avatar.bg, color:'white',
                fontSize:9, fontWeight:800,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>{cfg.avatar.initials}</div>

              {/* Bubble */}
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                  <span style={{ fontSize:10, fontWeight:600, color:'#374151' }}>{cfg.emoji} {cfg.label}</span>
                  <span style={{ fontSize:10, color:'#9ca3af' }}>{time}</span>
                </div>
                <div style={{
                  fontSize:12, lineHeight:1.55, padding:'7px 10px', borderRadius:'0 8px 8px 8px',
                  background: cfg.bubble.bg, border:`1px solid ${cfg.bubble.border}`,
                  color: cfg.bubble.textColor, whiteSpace:'pre-wrap',
                }}>
                  {msg.content}
                </div>
              </div>

              {/* Delete */}
              <button className="del-btn" onClick={() => deleteMessage(i)} style={{
                opacity:0, transition:'opacity 0.15s',
                background:'transparent', border:'none',
                color:'#9ca3af', cursor:'pointer', fontSize:14, padding:'2px 4px',
                flexShrink:0, alignSelf:'center',
              }}>✕</button>
            </div>
          )
        })}
      </div>

      {/* ── Role toggle + input ── */}
      <div style={{ padding:'12px 20px', borderTop:'1px solid var(--zd-border)', borderBottom:'1px solid var(--zd-border)', flexShrink:0, background:'white' }}>

        {/* Role switcher */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
          <span style={{ fontSize:11, fontWeight:600, color:'#374151' }}>Role</span>
          <div style={{ display:'flex', background:'#f3f4f6', borderRadius:99, padding:2, gap:2 }}>
            {['customer','agent'].map(role => {
              const cfg = ROLE_CFG[role]
              const active = activeRole === role
              return (
                <button key={role} onClick={() => setActiveRole(role)} style={{
                  padding:'4px 14px', borderRadius:99, fontSize:11, fontWeight:700,
                  border:'none', cursor:'pointer', transition:'all 0.15s',
                  background: active ? (role==='customer' ? '#667eea' : '#f59e0b') : 'transparent',
                  color: active ? 'white' : '#6b7280',
                  boxShadow: active ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
                }}>
                  {cfg.emoji} {cfg.label}
                </button>
              )
            })}
          </div>
          <span style={{ fontSize:10, color:'#9ca3af', marginLeft:'auto' }}>Auto-switches after send · Tab to toggle</span>
        </div>

        {/* Text input */}
        <div style={{ display:'flex', gap:8 }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={e => { if(e.key==='Tab') { e.preventDefault(); setActiveRole(r => r==='customer'?'agent':'customer') } }}
            placeholder={`Type ${ROLE_CFG[activeRole].label} message… (Enter to send, Tab to switch role)`}
            rows={2}
            style={{
              flex:1, padding:'8px 10px', borderRadius:8, resize:'none',
              border:`2px solid ${activeRole==='customer' ? '#818cf8' : '#fbbf24'}`,
              fontSize:13, color:'#1f2937', background:'white', outline:'none',
              fontFamily:'Inter, sans-serif', lineHeight:1.5, transition:'border-color 0.15s',
            }}
          />
          <button onClick={sendMessage} disabled={!input.trim()} style={{
            padding:'0 18px', borderRadius:8, border:'none',
            background: input.trim()
              ? (activeRole==='customer' ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'linear-gradient(135deg,#f59e0b,#d97706)')
              : '#e5e7eb',
            color: input.trim() ? 'white' : '#9ca3af',
            fontWeight:700, fontSize:13, cursor: input.trim() ? 'pointer' : 'default',
            transition:'all 0.15s', whiteSpace:'nowrap',
          }}>
            Send →
          </button>
        </div>
      </div>

      {/* ── Action row ── */}
      <div style={{ padding:'12px 20px', display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
        {/* Clear */}
        {!isEmpty && (
          <button onClick={() => { setMessages([]); setDownloaded(false) }} style={{
            padding:'7px 12px', borderRadius:8, border:'1px solid var(--zd-border)',
            background:'white', color:'#6b7280', fontSize:12, fontWeight:500, cursor:'pointer',
          }}>
            🗑 Clear
          </button>
        )}

        {/* Download JSON */}
        <button onClick={handleDownload} disabled={isEmpty} style={{
          padding:'7px 14px', borderRadius:8,
          border:`1px solid ${isEmpty ? 'var(--zd-border)' : '#6366f1'}`,
          background: isEmpty ? 'white' : (downloaded ? '#f0fdf4' : '#eef2ff'),
          color: isEmpty ? '#9ca3af' : (downloaded ? '#16a34a' : '#4f46e5'),
          fontSize:12, fontWeight:600, cursor: isEmpty ? 'default' : 'pointer',
          transition:'all 0.2s',
        }}>
          {downloaded ? '✓ Downloaded' : '↓ Download JSON'}
        </button>

        <div style={{ flex:1 }} />

        {/* Load only (no API call) */}
        <button onClick={handleLoadOnly} disabled={isEmpty} style={{
          padding:'7px 14px', borderRadius:8,
          border:'1px solid var(--zd-border)', background:'white',
          color: isEmpty ? '#9ca3af' : '#374151',
          fontSize:12, fontWeight:500, cursor: isEmpty ? 'default' : 'pointer',
        }}>
          Load only
        </button>

        {/* End Session & Analyze — primary CTA */}
        <button onClick={handleEndCall} disabled={isEmpty} style={{
          padding:'8px 18px', borderRadius:8, border:'none',
          background: isEmpty
            ? '#d1d5db'
            : 'linear-gradient(135deg,var(--ct-orange),var(--ct-dark))',
          color: isEmpty ? '#9ca3af' : 'white',
          fontSize:13, fontWeight:700,
          boxShadow: isEmpty ? 'none' : '0 2px 8px rgba(255,107,0,0.3)',
          cursor: isEmpty ? 'default' : 'pointer',
          transition:'all 0.2s',
        }}>
          🛑 End Session & Analyze →
        </button>
      </div>
    </div>
  )
}
