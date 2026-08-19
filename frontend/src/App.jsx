import { useEffect, useRef, useState } from 'react'
import CtiBar from './components/CtiBar'
import IconRail from './components/IconRail'
import TicketPane from './components/TicketPane'
import ContextPanel from './components/ContextPanel'
import TranscriptUploader from './components/TranscriptUploader'
import { extractFromMessages, extractFromAudio, checkHealth } from './lib/api'
import { mapResponse, rawTextToMessages } from './lib/mapResponse'

export default function App() {
  // ── Backend status ───────────────────────────────────────────
  const [backendStatus, setBackendStatus] = useState('checking')

  useEffect(() => {
    checkHealth().then(ok => setBackendStatus(ok ? 'online' : 'offline'))
  }, [])

  // ── Demo Mode (Top Tab): 'live' | 'upload' ────────────────────
  const [transcriptMode, setTranscriptMode] = useState('live')

  // ── Live Interactive Messages (starts empty — user types real messages) ──
  const [liveMessages, setLiveMessages] = useState([])

  // ── Uploaded / Preset Transcript (for 'upload' mode) ──────────
  const [transcript, setTranscript] = useState({ source: 'call_center', messages: [] })
  const [uploaderOpen, setUploaderOpen] = useState(false)
  const [transcriptHistory, setTranscriptHistory] = useState([])

  // ── Call state ───────────────────────────────────────────────
  const [callState, setCallState] = useState('active')
  const callEndTimeRef = useRef(null)
  const [callDuration, setCallDuration] = useState('—')

  // ── ChaiToke sidebar state ───────────────────────────────────
  const [chaiState, setChaiState] = useState('waiting')
  const [mapped, setMapped] = useState(null)
  const [rawResult, setRawResult] = useState(null)
  const [isOffline, setIsOffline] = useState(false)
  const [apiError, setApiError] = useState(null)

  // ── Context panel ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('apps')

  // ── Push state ───────────────────────────────────────────────
  const [pushed, setPushed] = useState(false)
  const [pushCount, setPushCount] = useState(0)
  const [customerFields, setCustomerFields] = useState(null)

  // ── Live message handlers ────────────────────────────────────
  function handleAddLiveMessage(msg) {
    setLiveMessages(prev => [...prev, msg])
  }

  function handleDeleteLiveMessage(index) {
    setLiveMessages(prev => prev.filter((_, i) => i !== index))
  }

  function handleClearLiveMessages() {
    setLiveMessages([])
  }

  // ── End Call Handler ─────────────────────────────────────────
  async function handleEndCall() {
    if (callState === 'ended') return
    setCallState('ended')
    callEndTimeRef.current = Date.now()
    setCallDuration('calculating…')
    setChaiState('loading')
    setActiveTab('apps')
    setApiError(null)

    // Determine payload based on current mode
    let targetPayload
    if (transcriptMode === 'live') {
      if (liveMessages.length === 0) {
        setApiError('No messages in live chat. Please type a message before ending call.')
        setChaiState('waiting')
        setCallState('active')
        return
      }
      targetPayload = {
        source: 'other',
        messages: liveMessages,
      }
    } else {
      if (!transcript.messages || transcript.messages.length === 0) {
        setApiError('No transcript loaded. Please open "Voice & Audio Ingestion" and load a transcript or record audio.')
        setChaiState('waiting')
        setCallState('active')
        return
      }
      targetPayload = transcript
    }

    try {
      // Direct call to live backend server
      const result = await extractFromMessages(targetPayload.messages, targetPayload.source)
      setIsOffline(false)
      setRawResult(result)
      setMapped(mapResponse(result))
      setChaiState('results')
    } catch (err) {
      console.error('ChaiToke API error:', err)
      setIsOffline(true)
      setApiError(`API error ${err.status || 500}: ${err.detail || err.title || err.message}`)
      setRawResult(null)
      setMapped(null)
      setChaiState('waiting')
    }
  }

  // ── Audio Upload & Transcription Handler ────────────────────
  async function handleAudioAnalyze(audioFile, source = 'call_center') {
    setCallState('ended')
    setCallDuration('Voice Audio')
    setChaiState('loading')
    setActiveTab('apps')
    setApiError(null)

    try {
      const result = await extractFromAudio(audioFile, source)
      
      // Separate reconstructed transcript into distinct customer / agent chat bubbles
      const transcriptText = result.data?.reconstructed_transcript || result.meta?.raw_transcript || ''
      if (transcriptText) {
        const msgs = rawTextToMessages(transcriptText)
        setTranscript({ source, messages: msgs })
        setLiveMessages(msgs)
      }

      setRawResult(result)
      setMapped(mapResponse(result))
      setChaiState('results')
    } catch (err) {
      console.error('Audio extraction error:', err)
      setIsOffline(true)
      setApiError(`Audio error ${err.status || 500}: ${err.detail || err.title || err.message}`)
      setRawResult(null)
      setMapped(null)
      setChaiState('waiting')
    }
  }

  // ── Push to ticket fields & BLUF Note ─────────────────────────
  function handlePush(draft) {
    if (!mapped || pushed) return
    setPushed(true)
    setPushCount(c => c + 1)

    const high = draft.priorityLabel === 'high' || draft.priorityLabel === 'urgent'
    const sentInfo = {
      negative: '😤 Frustrated',
      positive: '😊 Positive',
      neutral: '😐 Neutral',
      mixed: '😕 Mixed',
    }

    setCustomerFields({
      name:           draft.customerName || 'กิตติศักดิ์ พลอยงาม',
      phone:          draft.phone || '0819876543',
      invoiceNo:      draft.invoiceNo || 'HP-INV-99824',
      productSku:     draft.productSku || 'โต๊ะทำงานรุ่น Loft Wood 120cm',
      category:       draft.damageType || 'Structural_Failure',
      ticketStatus:   draft.ticketStatus || 'Replacement_Dispatched',
      escalation:     draft.escalationTarget || 'Logistics_Delivery_Team',
      deadline:       draft.actionDeadline || 'Within 48 hours',
      priority:       draft.priorityLabel.charAt(0).toUpperCase() + draft.priorityLabel.slice(1),
      sentiment:      sentInfo[draft.sentimentValue] || draft.sentimentValue,
      priorityColour: high ? 'red' : 'blue',
      blufNote:       draft.blufText || mapped.blufFormatted || '',
    })
    setTimeout(() => setActiveTab('customer'), 150)
  }

  // ── Load transcript ──────────────────────────────────────────
  function handleLoadTranscript(parsed) {
    setTranscript(parsed)
    const entry = {
      id: crypto.randomUUID(),
      source: parsed.source,
      messages: parsed.messages,
      loadedAt: Date.now(),
      loadedAtLabel: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    }
    setTranscriptHistory(prev => [entry, ...prev].slice(0, 5))
  }

  // Reset entire session for a fresh demo run
  function handleResetDemo() {
    setCallState('active')
    setChaiState('waiting')
    setMapped(null)
    setRawResult(null)
    setPushed(false)
    setCustomerFields(null)
    setApiError(null)
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateRows: '48px 1fr',
      gridTemplateColumns: '52px 1fr',
      height: '100vh',
    }}>

      {/* CTI Bar */}
      <CtiBar
        callState={callState}
        backendStatus={backendStatus}
        onEndCall={handleEndCall}
        onOpenUploader={() => setUploaderOpen(true)}
        transcriptMode={transcriptMode}
      />

      {/* Icon Rail */}
      <IconRail />

      {/* Main Workspace */}
      <div style={{
        gridRow: 2,
        gridColumn: 2,
        display: 'grid',
        gridTemplateRows: '42px 1fr',
        overflow: 'hidden',
      }}>
        {/* Top Tab Bar & Mode Switcher */}
        <div style={{
          background: '#f1f5f9',
          borderBottom: '1px solid var(--zd-border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 12,
          justifyContent: 'space-between',
        }}>
          {/* Left: Zendesk Ticket Tabs */}
          <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', gap: 4 }}>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px', height: '100%',
              border: 'none', background: 'transparent', color: 'var(--zd-text-muted)',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              borderRight: '1px solid var(--zd-border)', marginRight: 4,
            }}>
              Views ▾
            </button>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px',
              borderRadius: '6px 6px 0 0',
              border: '1px solid var(--zd-border)',
              borderBottom: 'none',
              background: 'white',
              fontSize: 12,
              fontWeight: 600,
              color: '#374151',
              position: 'relative',
              boxShadow: '0 -1px 3px rgba(0,0,0,0.02)',
            }}>
              <span style={{ color: '#6b7280', fontSize: 11 }}>#4471</span>
              &nbsp;·&nbsp;Somchai J.
              <span style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3, color: '#9ca3af', fontSize: 11, cursor: 'pointer' }}>×</span>
              <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 1, background: 'white' }} />
            </div>
          </div>

          {/* Center/Right: Demo Transcript Mode Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Transcript Mode:
            </span>
            <div style={{
              display: 'flex',
              background: '#e2e8f0',
              borderRadius: 8,
              padding: 2,
              gap: 2,
            }}>
              <button
                onClick={() => setTranscriptMode('live')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 12px', borderRadius: 6,
                  border: 'none',
                  background: transcriptMode === 'live' ? '#ffffff' : 'transparent',
                  color: transcriptMode === 'live' ? '#1e293b' : '#64748b',
                  fontSize: 11, fontWeight: 700,
                  boxShadow: transcriptMode === 'live' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <span>✍️ Live Editable Chat</span>
                {transcriptMode === 'live' && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6' }} />
                )}
              </button>
              <button
                onClick={() => setTranscriptMode('upload')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 12px', borderRadius: 6,
                  border: 'none',
                  background: transcriptMode === 'upload' ? '#ffffff' : 'transparent',
                  color: transcriptMode === 'upload' ? '#1e293b' : '#64748b',
                  fontSize: 11, fontWeight: 700,
                  boxShadow: transcriptMode === 'upload' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <span>📂 Upload / Preset</span>
                {transcriptMode === 'upload' && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ct-orange)' }} />
                )}
              </button>
            </div>

            {callState === 'ended' && (
              <button
                onClick={handleResetDemo}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 6,
                  border: '1px solid var(--zd-border)',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: 11, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                🔄 Reset Call
              </button>
            )}
          </div>
        </div>

        {/* Ticket Workspace Pane */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', overflow: 'hidden' }}>
          <TicketPane
            callState={callState}
            callDuration={callDuration}
            priorityColour={customerFields?.priorityColour || mapped?.priorityColour}
            transcript={transcript}
            transcriptMode={transcriptMode}
            liveMessages={liveMessages}
            onAddLiveMessage={handleAddLiveMessage}
            onDeleteLiveMessage={handleDeleteLiveMessage}
            onClearLiveMessages={handleClearLiveMessages}
            pushed={pushed}
            customerFields={customerFields}
          />
          <ContextPanel
            activeTab={activeTab}
            onTabChange={setActiveTab}
            chaiState={chaiState}
            mapped={mapped}
            rawResult={rawResult}
            isOffline={isOffline}
            onPush={handlePush}
            pushed={pushed}
            customerFields={customerFields}
            pushCount={pushCount}
          />
        </div>
      </div>

      {/* API Error Toast */}
      {apiError && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#1f2937', color: 'white', fontSize: 12,
          padding: '10px 16px', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 10,
          zIndex: 300, animation: 'slide-down 0.2s ease',
        }}>
          ⚠️ {apiError}
          <button onClick={() => setApiError(null)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      {/* Transcript & Audio Uploader Modal (Only in Upload Mode) */}
      {uploaderOpen && (
        <TranscriptUploader
          onLoad={handleLoadTranscript}
          onAudioAnalyze={handleAudioAnalyze}
          onClose={() => setUploaderOpen(false)}
          history={transcriptHistory}
        />
      )}
    </div>
  )
}
