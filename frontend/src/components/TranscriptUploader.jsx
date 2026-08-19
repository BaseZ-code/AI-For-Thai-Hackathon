import { useState, useRef, useEffect } from 'react'
import { parseUploadInput } from '../lib/mapResponse'
import { DEFAULT_TRANSCRIPT } from '../lib/mockPayload'
import { extractFromAudio } from '../lib/api'

const SOURCES = ['call_center', 'line', 'facebook', 'other']
const TABS = [
  { id: 'audio',  label: '🎙️ Voice & Audio',   desc: 'Live Mic Recording or .wav/.mp3 File' },
  { id: 'paste',  label: '📋 Text / JSON',      desc: 'Paste transcript or JSON dialogue' },
]

export default function TranscriptUploader({ onLoad, onAudioAnalyze, onClose, history = [] }) {
  const [activeTab, setActiveTab] = useState('audio')
  
  // Paste / JSON Tab state
  const [text, setText] = useState(JSON.stringify(DEFAULT_TRANSCRIPT, null, 2))
  const [source, setSource] = useState('call_center')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Audio Upload / Live Recording state
  const [audioFile, setAudioFile] = useState(null)
  const [audioUploading, setAudioUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  // In-Browser Live Mic Recording State
  const [isRecording, setIsRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerIntervalRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop())
      }
    }
  }, [isRecording])

  async function startRecording() {
    setError(null)
    setAudioFile(null)

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Live recording requires HTTPS or localhost, which is not supported in this environment. Please use file upload instead.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      
      // Determine best supported MIME type across Chrome, Firefox, Safari
      let mimeType = 'audio/webm'
      let fileExt = 'webm'
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
        fileExt = 'webm'
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
        fileExt = 'm4a'
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg'
        fileExt = 'ogg'
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav'
        fileExt = 'wav'
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' })
        // Use extension matched to recorded audio
        const file = new File([audioBlob], `mic-recording-${Date.now()}.${fileExt === 'webm' ? 'm4a' : fileExt}`, { 
          type: mimeType || 'audio/webm' 
        })
        setAudioFile(file)
        stream.getTracks().forEach(t => t.stop())
      }

      mediaRecorder.start(250) // slice every 250ms for smooth chunks
      setIsRecording(true)
      setRecordSeconds(0)
      timerIntervalRef.current = setInterval(() => {
        setRecordSeconds(s => s + 1)
      }, 1000)
    } catch (err) {
      console.error('Microphone access error:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone permission was denied by your browser. Please click the 🔒 / 🎙️ icon in your address bar and allow Microphone access.')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No microphone found on this device. Please connect a microphone or use file upload.')
      } else {
        setError(`Microphone error (${err.name || 'Unknown'}): ${err.message}. Please use audio file upload.`)
      }
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }

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

  function handleAudioFileSelected(file) {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['mp3', 'wav', 'm4a', 'flac', 'ogg'].includes(ext)) {
      setError(`Unsupported format .${ext}. Please upload .mp3, .wav, .m4a, or .flac`)
      return
    }
    setError(null)
    setAudioFile(file)
  }

  async function handleUploadAudioAndAnalyze() {
    if (!audioFile) return
    setAudioUploading(true)
    setError(null)
    try {
      if (onAudioAnalyze) {
        await onAudioAnalyze(audioFile, source)
      } else {
        await extractFromAudio(audioFile, source)
      }
      setSuccess(true)
      setTimeout(onClose, 800)
    } catch (e) {
      setError(e.detail || e.message || 'Audio analysis failed.')
    } finally {
      setAudioUploading(false)
    }
  }

  function recallHistory(entry) {
    onLoad({ source: entry.source, messages: entry.messages })
    onClose()
  }

  function handleResetDefault() {
    setText(JSON.stringify(DEFAULT_TRANSCRIPT, null, 2))
    setSource('call_center')
    setError(null)
  }

  const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 45,
      }}
    >
      <div style={{
        background: 'white', borderRadius: 12, width: 'min(760px, 94vw)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', animation: 'slide-down 0.2s ease', maxHeight: '90vh',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--zd-border)', background: '#fafafa',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>🎙️ Voice Audio & Transcript Ingestion</div>
            <div style={{ fontSize: 11, color: 'var(--zd-text-muted)', marginTop: 2 }}>
              Record live speech via mic, upload audio files (.wav/.mp3), or paste dialogue
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: 20, color: '#9ca3af', cursor: 'pointer', padding: '2px 8px', borderRadius: 6 }}
          >
            ×
          </button>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--zd-border)', background: 'white', flexShrink: 0 }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setError(null); }}
              style={{
                flex: 1, padding: '11px 0', textAlign: 'center',
                border: 'none', borderBottom: `2px solid ${activeTab === tab.id ? 'var(--ct-orange)' : 'transparent'}`,
                background: 'transparent', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: activeTab === tab.id ? 'var(--ct-dark)' : '#6b7280' }}>{tab.label}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{tab.desc}</div>
            </button>
          ))}
        </div>

        {/* ── Recall history ── */}
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

        {/* ── Body ── */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>

          {/* Platform Selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Channel</span>
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
                    {s === 'call_center' ? '📞 24/7 Call Center' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'paste' && (
              <button
                onClick={handleResetDefault}
                style={{ fontSize: 11, color: '#4b5563', background: 'transparent', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
              >
                Reset to HomePro Sample
              </button>
            )}
          </div>

          {/* ── VOICE & AUDIO TAB ── */}
          {activeTab === 'audio' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {/* Option 1: In-Browser Microphone Recorder */}
              <div style={{
                background: isRecording ? '#fef2f2' : '#f8fafc',
                border: `1px solid ${isRecording ? '#fecaca' : '#e2e8f0'}`,
                borderRadius: 10, padding: '16px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'all 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: isRecording ? '#ef4444' : '#3b82f6',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16,
                    animation: isRecording ? 'pulse-red 1.2s infinite' : 'none',
                  }}>
                    {isRecording ? '⏺' : '🎙️'}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                      {isRecording ? 'Live Microphone Recording in Progress…' : 'Record Thai Voice Call Directly via Mic'}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      {isRecording ? `Timer: ${fmtTime(recordSeconds)} · Speak naturally in Thai` : 'Click Start to simulate a live customer call session'}
                    </div>
                  </div>
                </div>

                <div>
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      style={{
                        padding: '7px 16px', borderRadius: 8, border: 'none',
                        background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
                        color: 'white', fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', boxShadow: '0 2px 6px rgba(59,130,246,0.3)',
                      }}
                    >
                      🎙️ Start Recording
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      style={{
                        padding: '7px 16px', borderRadius: 8, border: 'none',
                        background: '#ef4444',
                        color: 'white', fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', boxShadow: '0 2px 6px rgba(239,68,68,0.35)',
                      }}
                    >
                      ⏹️ Stop Recording ({fmtTime(recordSeconds)})
                    </button>
                  )}
                </div>
              </div>

              {/* Option 2: Drag & Drop File Upload */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault()
                  setDragOver(false)
                  if (e.dataTransfer.files?.[0]) handleAudioFileSelected(e.dataTransfer.files[0])
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--ct-orange)' : (audioFile ? '#22c55e' : '#cbd5e1')}`,
                  borderRadius: 10, padding: '24px 20px', textAlign: 'center',
                  background: dragOver ? 'var(--ct-lt)' : (audioFile ? '#f0fdf4' : '#fafafa'),
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/mp3,audio/wav,audio/m4a,audio/flac,audio/ogg"
                  onChange={e => e.target.files?.[0] && handleAudioFileSelected(e.target.files[0])}
                  style={{ display: 'none' }}
                />
                <div style={{ fontSize: 28, marginBottom: 6 }}>{audioFile ? '🎵' : '📁'}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: audioFile ? '#16a34a' : '#1e293b' }}>
                  {audioFile ? `Ready: ${audioFile.name}` : 'Or click to select / drop pre-recorded audio file'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                  {audioFile
                    ? `File size: ${(audioFile.size / (1024 * 1024)).toFixed(2)} MB · Click button below to analyze`
                    : 'Supports .mp3, .wav, .m4a, .flac (up to 10 MB)'}
                </div>
              </div>

              {error && (
                <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px' }}>
                  ⚠️ {error}
                </div>
              )}

              {success && (
                <div style={{ fontSize: 12, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 12px' }}>
                  ✅ Voice transcribed via Google Cloud ASR & analyzed by ChaiToke!
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
                  onClick={handleUploadAudioAndAnalyze}
                  disabled={!audioFile || audioUploading || isRecording}
                  style={{
                    padding: '8px 20px', borderRadius: 8, border: 'none',
                    background: (!audioFile || audioUploading || isRecording) ? '#cbd5e1' : 'linear-gradient(135deg,var(--ct-orange),var(--ct-dark))',
                    color: 'white', fontSize: 12, fontWeight: 700,
                    boxShadow: (!audioFile || audioUploading || isRecording) ? 'none' : '0 2px 8px rgba(255,107,0,0.3)',
                    cursor: (!audioFile || audioUploading || isRecording) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {audioUploading ? '⏳ Transcribing Voice (ASR + LLM)...' : 'Transcribe & Analyze Voice →'}
                </button>
              </div>
            </div>
          )}

          {/* ── PASTE / TEXT TAB ── */}
          {activeTab === 'paste' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <textarea
                value={text}
                onChange={e => { setText(e.target.value); setError(null); setSuccess(false) }}
                spellCheck={false}
                placeholder="Paste JSON or raw Thai text here…"
                style={{
                  width: '100%', height: 220, resize: 'vertical',
                  border: `1px solid ${error ? 'var(--cti-red)' : success ? '#22c55e' : 'var(--zd-border)'}`,
                  borderRadius: 8, padding: '10px 12px', fontSize: 12, lineHeight: 1.6, color: '#1f2937',
                  background: success ? '#f0fdf4' : '#f9fafb', outline: 'none',
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
          )}
        </div>
      </div>
    </div>
  )
}
