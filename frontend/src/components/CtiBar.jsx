import { useEffect, useRef, useState } from 'react'
import { API_TARGET } from '../lib/api'

// Extract just the hostname for display (e.g. "team8.105app.site" or "localhost:8000")
const API_HOST = (() => { try { return new URL(API_TARGET).host } catch(_) { return API_TARGET } })()

export default function CtiBar({
  callState,
  backendStatus,
  onEndCall,
  onOpenUploader,
  transcriptMode, // 'live' | 'upload'
}) {
  const [seconds, setSeconds] = useState(0)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (callState === 'active') {
      intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [callState])

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`
  const ended = callState === 'ended'
  const isLiveMode = transcriptMode === 'live'

  return (
    <header style={{
      gridColumn: '1 / -1',
      background: 'var(--cti-bg)',
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 16px',
      borderBottom: '1px solid #1e293b',
      zIndex: 100, height: 48, flexShrink: 0,
    }}>
      {/* Logo */}
      <span style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase' }}>
        Thailand CTI
      </span>
      <div style={{ width:1, height:24, background:'#334155' }} />

      {/* Status pill */}
      <div style={{
        display:'flex', alignItems:'center', gap:6,
        background: ended ? 'rgba(100,116,139,0.15)' : 'rgba(239,68,68,0.15)',
        border: `1px solid ${ended ? 'rgba(100,116,139,0.3)' : 'rgba(239,68,68,0.35)'}`,
        borderRadius: 99, padding: '3px 10px 3px 8px',
        fontSize: 11, fontWeight:600,
        color: ended ? '#64748b' : 'var(--cti-red)',
      }}>
        <span style={{
          width:7, height:7, borderRadius:'50%',
          background: ended ? '#64748b' : 'var(--cti-red)',
          animation: ended ? 'none' : 'pulse-red 1.4s ease-in-out infinite',
          display:'inline-block',
        }} />
        {ended ? 'Call Ended' : 'Live Call'}
      </div>

      {/* Caller */}
      <span style={{ color:'#e2e8f0', fontSize:13, fontWeight:500 }}>
        +66 81 234 5678&nbsp;
        <span style={{ color:'#94a3b8', fontSize:11, fontWeight:400 }}>Somchai J.</span>
      </span>

      {/* Timer */}
      <span style={{
        fontVariantNumeric:'tabular-nums', fontSize:13, fontWeight:600,
        color: ended ? '#64748b' : 'var(--cti-green)',
        letterSpacing:'0.06em', minWidth:52,
      }}>
        {fmt(seconds)}
      </span>

      <div style={{ flex:1 }} />

      {/* Backend status badge */}
      <BackendBadge status={backendStatus} />

      {/* Load Voice / Transcript button — disabled in Live Mode or when ended */}
      <CtiBtn
        onClick={onOpenUploader}
        disabled={ended || isLiveMode}
        title={isLiveMode ? "Disabled in Live Mode (type directly in the chat log)" : "Open Voice Recording & Audio / Transcript Ingestion"}
        activeHighlight={!isLiveMode && !ended}
      >
        🎙️ Voice & Audio Ingestion
      </CtiBtn>

      {/* Call controls */}
      <CtiBtn disabled>🎙️ Mute</CtiBtn>
      <CtiBtn disabled>⏸ Hold</CtiBtn>
      <button
        onClick={onEndCall}
        disabled={ended}
        style={{
          display:'flex', alignItems:'center', gap:5,
          padding:'5px 16px', borderRadius:6,
          border: ended ? '1px solid #374151' : '1px solid var(--cti-red)',
          background: ended ? '#374151' : 'var(--cti-red)',
          color: ended ? '#6b7280' : 'white',
          fontSize:12, fontWeight:600,
          cursor: ended ? 'not-allowed' : 'pointer',
          transition:'all 0.15s',
          boxShadow: ended ? 'none' : '0 2px 8px rgba(239,68,68,0.3)',
        }}
      >
        📵 End Call
      </button>
    </header>
  )
}

function CtiBtn({ children, onClick, disabled, title, activeHighlight }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display:'flex', alignItems:'center', gap:5,
        padding:'5px 12px', borderRadius:6,
        border: activeHighlight ? '1px solid #475569' : '1px solid #334155',
        background: activeHighlight ? 'rgba(255,255,255,0.06)' : 'transparent',
        color: disabled ? '#475569' : (activeHighlight ? '#f1f5f9' : '#94a3b8'),
        fontSize:12, fontWeight:500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition:'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}

function BackendBadge({ status }) {
  const cfg = {
    checking: { bg:'rgba(250,204,21,0.15)', border:'rgba(250,204,21,0.4)', color:'#ca8a04', dot:'#eab308', label:'Checking…' },
    online:   { bg:'rgba(34,197,94,0.15)',  border:'rgba(34,197,94,0.4)',  color:'#16a34a', dot:'#22c55e', label:`⚡ ${API_HOST}` },
    offline:  { bg:'rgba(239,68,68,0.12)',  border:'rgba(239,68,68,0.3)',  color:'#dc2626', dot:'#ef4444', label:'🔌 Demo Mode' },
  }[status] || {}

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:5,
      background: cfg.bg, border:`1px solid ${cfg.border}`,
      borderRadius:99, padding:'3px 10px',
      fontSize:10, fontWeight:700, color: cfg.color,
      letterSpacing:'0.04em', textTransform:'uppercase',
    }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:cfg.dot, display:'inline-block' }} />
      {cfg.label}
    </div>
  )
}
