import { useState, useEffect, useRef } from 'react'

const ROLE_STYLE = {
  customer: {
    gradient: 'linear-gradient(135deg,#667eea,#764ba2)',
    initials: 'CX',
    label: 'Customer',
    bubbleBg: '#f0f4ff',
    bubbleBorder: '#c7d2fe',
    textColor: '#1e1b4b',
  },
  agent: {
    gradient: 'linear-gradient(135deg,#f59e0b,#d97706)',
    initials: 'AG',
    label: 'Agent (You)',
    bubbleBg: '#f9fafb',
    bubbleBorder: 'var(--zd-border)',
    textColor: '#374151',
  },
  system: {
    gradient: 'linear-gradient(135deg,#64748b,#475569)',
    initials: 'SY',
    label: 'System',
    bubbleBg: '#f3f4f6',
    bubbleBorder: '#e5e7eb',
    textColor: '#4b5563',
  },
}

export default function TicketPane({
  callState,
  callDuration,
  priorityColour,
  transcript,
  transcriptMode, // 'live' | 'upload'
  liveMessages,
  onAddLiveMessage,
  onDeleteLiveMessage,
  onClearLiveMessages,
}) {
  const ended = callState === 'ended'
  const high = priorityColour === 'red'
  const convRef = useRef(null)
  const inputRef = useRef(null)

  const [activeRole, setActiveRole] = useState('customer')
  const [inputText, setInputText] = useState('')

  // Decide which messages to render: in live mode use liveMessages, otherwise transcript.messages
  const displayMessages = transcriptMode === 'live' 
    ? liveMessages 
    : (ended ? (transcript?.messages || []) : [])

  // Auto-scroll when messages update
  useEffect(() => {
    if (convRef.current) {
      convRef.current.scrollTop = convRef.current.scrollHeight
    }
  }, [displayMessages.length, ended, transcriptMode])

  function handleSend() {
    const trimmed = inputText.trim()
    if (!trimmed) return
    onAddLiveMessage({
      role: activeRole,
      content: trimmed,
      timestamp: new Date().toISOString(),
    })
    setInputText('')
    // Toggle role automatically for smooth conversation flow
    setActiveRole(r => r === 'customer' ? 'agent' : 'customer')
    inputRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      setActiveRole(r => r === 'customer' ? 'agent' : 'customer')
    }
  }

  function handleExportJson() {
    const payload = {
      source: transcript?.source || 'line',
      messages: liveMessages,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `live-transcript-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: 'white',
      borderRight: '1px solid var(--zd-border)',
      overflow: 'hidden',
      height: '100%',
    }}>

      {/* ── Ticket Header ── */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--zd-border)', flexShrink: 0, background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--zd-text-muted)' }}>Ticket #4471 · Assigned to you</div>
          {transcriptMode === 'live' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#eff6ff', border: '1px solid #bfdbfe',
              borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: '#1d4ed8',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
              Live Interactive Chat
            </div>
          )}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
          ร้องเรียนปัญหาการเรียกเก็บเงิน
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', fontWeight: 500 }}>
            <Avatar initials="สจ" gradient="linear-gradient(135deg,#667eea,#764ba2)" />
            Somchai Janthong
          </div>
          <span style={{ color: '#d1d5db' }}>·</span>
          <Badge bg="#fef3c7" color="#92400e" border="#fde68a">⏺ Open</Badge>
          <Badge
            bg={high ? '#fef2f2' : '#eff6ff'}
            color={high ? '#991b1b' : '#1d4ed8'}
            border={high ? '#fecaca' : '#bfdbfe'}
          >
            {high ? 'High' : 'Normal'}
          </Badge>
          <Chip>billing</Chip>
          <Chip>refund</Chip>
          {transcript?.source && (
            <Chip style={{ textTransform: 'capitalize', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}>
              {transcript.source}
            </Chip>
          )}
        </div>
      </div>

      {/* ── Conversation Log ── */}
      <div
        ref={convRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: '#fafafa',
        }}
      >
        <SystemMsg icon="📞">Inbound call connected — Thailand CTI · {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</SystemMsg>

        {/* In Upload Mode (Active): show default placeholder */}
        {transcriptMode === 'upload' && !ended && (
          <div style={{ display: 'flex', gap: 10 }}>
            <Avatar initials="AG" gradient="linear-gradient(135deg,#f59e0b,#d97706)" size={28} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--zd-text-muted)', marginBottom: 4 }}>
                <strong style={{ color: '#374151' }}>Agent (You)</strong> · just now
              </div>
              <div style={{
                fontSize: 13, color: '#374151', lineHeight: 1.5,
                background: '#ffffff', border: '1px solid var(--zd-border)',
                borderRadius: '0 8px 8px 8px', padding: '10px 12px',
              }}>
                สวัสดีครับ ยินดีต้อนรับสู่ศูนย์บริการลูกค้า วันนี้มีอะไรให้ช่วยได้บ้างครับ
              </div>
            </div>
          </div>
        )}

        {/* Render chat bubbles (Live Mode stream OR Upload Mode results) */}
        {displayMessages.map((msg, i) => {
          const style = ROLE_STYLE[msg.role] || ROLE_STYLE.agent
          const isCustomer = msg.role === 'customer'
          const time = msg.timestamp
            ? new Date(msg.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
            : null

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                animation: `fade-in 0.25s ease ${i * 40}ms both`,
              }}
              onMouseEnter={e => {
                if (transcriptMode === 'live' && !ended) {
                  const del = e.currentTarget.querySelector('.live-del-btn')
                  if (del) del.style.opacity = '1'
                }
              }}
              onMouseLeave={e => {
                const del = e.currentTarget.querySelector('.live-del-btn')
                if (del) del.style.opacity = '0'
              }}
            >
              <Avatar initials={style.initials} gradient={style.gradient} size={28} />
              <div style={{ flex: 1, maxWidth: '85%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--zd-text-muted)', marginBottom: 4 }}>
                  <strong style={{ color: '#374151' }}>{style.label}</strong>
                  {time && <span>· {time}</span>}
                </div>
                <div style={{
                  fontSize: 13, color: style.textColor, lineHeight: 1.55,
                  background: isCustomer ? '#f0f4ff' : '#ffffff',
                  border: `1px solid ${isCustomer ? '#c7d2fe' : 'var(--zd-border)'}`,
                  borderRadius: '0 8px 8px 8px',
                  padding: '9px 12px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
              </div>

              {transcriptMode === 'live' && !ended && (
                <button
                  className="live-del-btn"
                  onClick={() => onDeleteLiveMessage(i)}
                  title="Delete message"
                  style={{
                    opacity: 0,
                    transition: 'opacity 0.15s',
                    background: 'transparent',
                    border: 'none',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    fontSize: 13,
                    padding: '4px',
                    alignSelf: 'center',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}

        {ended && (
          <SystemMsg icon="📵" animate>
            Call ended · {callDuration} · ChaiToke analyzing…
          </SystemMsg>
        )}
      </div>

      {/* ── LIVE TRANSCRIPT INPUT CONSOLE (Only when in Live Mode and Call is Active) ── */}
      {transcriptMode === 'live' && !ended ? (
        <div style={{
          borderTop: '1px solid var(--zd-border)',
          padding: '12px 18px',
          background: '#ffffff',
          flexShrink: 0,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.03)',
        }}>
          {/* Role selector & live controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4b5563' }}>Role:</span>
              <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 99, padding: 2, gap: 2 }}>
                <button
                  onClick={() => setActiveRole('customer')}
                  style={{
                    padding: '3px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, border: 'none',
                    background: activeRole === 'customer' ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'transparent',
                    color: activeRole === 'customer' ? 'white' : '#6b7280',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  👤 Customer
                </button>
                <button
                  onClick={() => setActiveRole('agent')}
                  style={{
                    padding: '3px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, border: 'none',
                    background: activeRole === 'agent' ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'transparent',
                    color: activeRole === 'agent' ? 'white' : '#6b7280',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  🎧 Agent
                </button>
              </div>
              <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}>
                (Tab to switch role)
              </span>
            </div>

            {liveMessages.length > 0 && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleExportJson}
                  style={{
                    fontSize: 11, fontWeight: 600, color: '#4f46e5',
                    background: '#eef2ff', border: '1px solid #c7d2fe',
                    borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                  }}
                >
                  ↓ Export JSON
                </button>
                <button
                  onClick={onClearLiveMessages}
                  style={{
                    fontSize: 11, fontWeight: 500, color: '#6b7280',
                    background: 'white', border: '1px solid var(--zd-border)',
                    borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                  }}
                >
                  Clear ({liveMessages.length})
                </button>
              </div>
            )}
          </div>

          {/* Input text box */}
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Type ${activeRole === 'customer' ? 'Customer' : 'Agent'} message… (Press Enter to post live)`}
              rows={2}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: `2px solid ${activeRole === 'customer' ? '#818cf8' : '#fbbf24'}`,
                fontSize: 13,
                color: '#1f2937',
                background: '#ffffff',
                outline: 'none',
                fontFamily: 'Inter, sans-serif',
                lineHeight: 1.45,
                resize: 'none',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              style={{
                padding: '0 16px',
                borderRadius: 8,
                border: 'none',
                background: inputText.trim()
                  ? (activeRole === 'customer' ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'linear-gradient(135deg,#f59e0b,#d97706)')
                  : '#e5e7eb',
                color: inputText.trim() ? 'white' : '#9ca3af',
                fontWeight: 700,
                fontSize: 12,
                cursor: inputText.trim() ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              Post ↵
            </button>
          </div>
        </div>
      ) : (
        /* ── Standard Zendesk Reply Composer (Upload Mode or Post-Call) ── */
        <div style={{
          borderTop: '1px solid var(--zd-border)',
          padding: '12px 20px',
          flexShrink: 0,
          background: '#ffffff',
          opacity: ended ? 1 : 0.45,
          pointerEvents: ended ? 'auto' : 'none',
          transition: 'opacity 0.3s',
        }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--zd-border)', marginBottom: 10 }}>
            <ComposerTab active>Reply</ComposerTab>
            <ComposerTab>Internal Note</ComposerTab>
          </div>
          <textarea
            placeholder={ended ? "Write a reply to the customer…" : "Chat console is read-only during call simulation…"}
            style={{
              width: '100%',
              height: 60,
              border: '1px solid var(--zd-border)',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 13,
              color: '#374151',
              background: '#f9fafb',
              resize: 'none',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn secondary>Save Draft</Btn>
            <Btn primary>Submit as Open ▾</Btn>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers & UI Atoms ──────────────────────────────────────────

function Avatar({ initials, gradient, size = 24 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: gradient,
      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 700, flexShrink: 0,
    }}>{initials}</div>
  )
}

function Badge({ bg, color, border, children }) {
  return (
    <div style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: bg, color, border: `1px solid ${border}` }}>
      {children}
    </div>
  )
}

function Chip({ children, style = {} }) {
  return (
    <div style={{
      padding: '2px 7px', borderRadius: 99, fontSize: 10, fontWeight: 500,
      background: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb',
      ...style,
    }}>
      {children}
    </div>
  )
}

function SystemMsg({ icon, children, animate }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--zd-text-muted)',
      animation: animate ? 'fade-in 0.4s ease' : 'none',
    }}>
      <span style={{ flex: 1, height: 1, background: 'var(--zd-border)', display: 'block' }} />
      <span>{icon}</span><span>{children}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--zd-border)', display: 'block' }} />
    </div>
  )
}

function ComposerTab({ children, active }) {
  return (
    <div style={{
      padding: '6px 12px', fontSize: 12, fontWeight: 500,
      color: active ? 'var(--zd-blue)' : 'var(--zd-text-muted)',
      borderBottom: active ? '2px solid var(--zd-blue)' : '2px solid transparent',
      cursor: 'pointer',
    }}>{children}</div>
  )
}

function Btn({ children, primary }) {
  return (
    <button style={{
      padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: primary ? 600 : 500,
      background: primary ? 'var(--zd-blue)' : 'white',
      color: primary ? 'white' : '#374151',
      border: primary ? 'none' : '1px solid var(--zd-border)',
      cursor: 'pointer',
    }}>{children}</button>
  )
}
