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
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null)
  const [audioUploading, setAudioUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  // In-Browser Live Mic Recording State (Pure LINEAR16 PCM WAV)
  const [isRecording, setIsRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0) // 0 - 100 for live visualizer
  const [micStatus, setMicStatus] = useState('idle') // 'idle' | 'requesting' | 'recording' | 'recorded'

  const timerIntervalRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const processorNodeRef = useRef(null)
  const streamRef = useRef(null)
  const pcmSamplesRef = useRef([])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllAudioTracks()
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl)
    }
  }, [audioPreviewUrl])

  function stopAllAudioTracks() {
    if (processorNodeRef.current) {
      try { processorNodeRef.current.disconnect() } catch (_) {}
      processorNodeRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
  }

  async function startRecording() {
    setError(null)
    setAudioFile(null)
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl)
      setAudioPreviewUrl(null)
    }
    setMicStatus('requesting')

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Live microphone recording requires HTTPS or localhost. Please use audio file upload below.')
      setMicStatus('idle')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      })
      streamRef.current = stream
      pcmSamplesRef.current = []

      // Setup Web Audio API PCM capture (16kHz mono LINEAR16 for Google Cloud STT)
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const audioCtx = new AudioCtx()
      audioContextRef.current = audioCtx
      const inputSampleRate = audioCtx.sampleRate

      const sourceNode = audioCtx.createMediaStreamSource(stream)
      
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.5
      analyserRef.current = analyser

      // Use 4096 sample buffer for smooth PCM streaming
      const processor = audioCtx.createScriptProcessor(4096, 1, 1)
      processorNodeRef.current = processor

      const freqData = new Uint8Array(analyser.frequencyBinCount)

      processor.onaudioprocess = e => {
        if (!isRecording && micStatus !== 'recording') return
        const inputData = e.inputBuffer.getChannelData(0)
        
        // Clone input samples for WAV encoding
        const copy = new Float32Array(inputData.length)
        copy.set(inputData)
        pcmSamplesRef.current.push(copy)

        // Calculate real-time voice decibel level
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(freqData)
          let sum = 0
          for (let i = 0; i < freqData.length; i++) sum += freqData[i]
          const avg = sum / freqData.length
          const normalized = Math.min(100, Math.round((avg / 128) * 100))
          setAudioLevel(normalized)
        }
      }

      sourceNode.connect(analyser)
      analyser.connect(processor)
      processor.connect(audioCtx.destination)

      setIsRecording(true)
      setMicStatus('recording')
      setRecordSeconds(0)
      timerIntervalRef.current = setInterval(() => {
        setRecordSeconds(s => s + 1)
      }, 1000)
    } catch (err) {
      console.error('Microphone error:', err)
      setMicStatus('idle')
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone permission was denied. Please click the 🔒 / 🎙️ icon in your address bar and allow access.')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No microphone found on this device. Please connect a microphone or upload a file.')
      } else {
        setError(`Microphone error (${err.name || 'Error'}): ${err.message}. Please use audio file upload.`)
      }
    }
  }

  function stopRecording() {
    if (!isRecording) return
    setIsRecording(false)
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    setAudioLevel(0)

    try {
      const inputSampleRate = audioContextRef.current ? audioContextRef.current.sampleRate : 44100
      const totalLength = pcmSamplesRef.current.reduce((acc, curr) => acc + curr.length, 0)
      
      if (totalLength === 0) {
        setError('No audio captured. Please speak into the microphone and try again.')
        setMicStatus('idle')
        stopAllAudioTracks()
        return
      }

      // Merge all sample chunks into single Float32 buffer
      const merged = new Float32Array(totalLength)
      let offset = 0
      for (const chunk of pcmSamplesRef.current) {
        merged.set(chunk, offset)
        offset += chunk.length
      }

      // Downsample to 16,000 Hz (Optimal target for Google Cloud STT LINEAR16)
      const targetSampleRate = 16000
      const downsampled = downsampleBuffer(merged, inputSampleRate, targetSampleRate)

      // Encode standard 16-bit PCM WAV (LINEAR16)
      const wavBlob = encodeWAV(downsampled, targetSampleRate)
      const file = new File([wavBlob], `voice-call-${Date.now()}.wav`, { type: 'audio/wav' })
      
      setAudioFile(file)
      const url = URL.createObjectURL(wavBlob)
      setAudioPreviewUrl(url)
      setMicStatus('recorded')
    } catch (encErr) {
      console.error('WAV encoding error:', encErr)
      setError(`Audio encoding error: ${encErr.message}`)
      setMicStatus('idle')
    } finally {
      stopAllAudioTracks()
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
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl)
    setAudioPreviewUrl(URL.createObjectURL(file))
    setMicStatus('recorded')
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
        paddingTop: 40,
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
              Record live speech via mic (LINEAR16 PCM), upload audio files, or paste dialogue
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
              
              {/* Option 1: In-Browser Microphone Live Recorder + Audio VU Visualizer */}
              <div style={{
                background: isRecording ? '#fef2f2' : (micStatus === 'requesting' ? '#fffbeb' : '#f8fafc'),
                border: `1px solid ${isRecording ? '#fecaca' : (micStatus === 'requesting' ? '#fde68a' : '#e2e8f0')}`,
                borderRadius: 10, padding: '16px 20px',
                display: 'flex', flexDirection: 'column', gap: 12,
                transition: 'all 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%',
                      background: isRecording ? '#ef4444' : (micStatus === 'requesting' ? '#f59e0b' : '#3b82f6'),
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16,
                      boxShadow: isRecording ? '0 0 12px rgba(239,68,68,0.5)' : 'none',
                      animation: isRecording ? 'pulse-red 1.2s infinite' : 'none',
                    }}>
                      {isRecording ? '⏺' : (micStatus === 'requesting' ? '⏳' : '🎙️')}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                        {isRecording ? `🔴 Live Recording Voice (${fmtTime(recordSeconds)})` : (micStatus === 'requesting' ? 'Requesting Mic Access…' : 'Record Thai Voice Call Directly via Mic')}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {isRecording ? 'Capturing LINEAR16 16kHz PCM audio… Speak naturally in Thai' : 'Click Start to record voice for Speech-to-Text extraction'}
                      </div>
                    </div>
                  </div>

                  <div>
                    {!isRecording ? (
                      <button
                        onClick={startRecording}
                        disabled={micStatus === 'requesting'}
                        style={{
                          padding: '8px 18px', borderRadius: 8, border: 'none',
                          background: micStatus === 'requesting' ? '#cbd5e1' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
                          color: 'white', fontSize: 12, fontWeight: 700,
                          cursor: micStatus === 'requesting' ? 'wait' : 'pointer',
                          boxShadow: micStatus === 'requesting' ? 'none' : '0 2px 6px rgba(59,130,246,0.3)',
                        }}
                      >
                        {micStatus === 'requesting' ? 'Prompting Mic…' : '🎙️ Start Recording'}
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        style={{
                          padding: '8px 18px', borderRadius: 8, border: 'none',
                          background: '#ef4444',
                          color: 'white', fontSize: 12, fontWeight: 700,
                          cursor: 'pointer', boxShadow: '0 2px 8px rgba(239,68,68,0.4)',
                        }}
                      >
                        ⏹️ Stop Recording ({fmtTime(recordSeconds)})
                      </button>
                    )}
                  </div>
                </div>

                {/* Real-time Voice Volume Equalizer Bars (Active during recording) */}
                {isRecording && (
                  <div style={{
                    background: '#ffffff', borderRadius: 8, padding: '10px 14px',
                    border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', width: 85 }}>Voice Level:</span>
                    
                    {/* Animated Equalizer Bars */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', height: 24, gap: 4 }}>
                      {[15, 30, 45, 60, 75, 90, 100, 85, 70, 55, 40, 25, 50, 70, 90, 60].map((barMax, i) => {
                        const heightPct = Math.min(100, Math.max(12, Math.round((audioLevel / 100) * barMax * (1 + (i % 3) * 0.2))))
                        return (
                          <div
                            key={i}
                            style={{
                              flex: 1,
                              height: `${heightPct}%`,
                              borderRadius: 3,
                              background: heightPct > 65 
                                ? 'linear-gradient(to top, #f59e0b, #ef4444)' 
                                : 'linear-gradient(to top, #3b82f6, #60a5fa)',
                              transition: 'height 0.08s ease',
                            }}
                          />
                        )
                      })}
                    </div>

                    <span style={{ fontSize: 11, fontWeight: 700, color: audioLevel > 20 ? '#16a34a' : '#9ca3af', minWidth: 45, textAlign: 'right' }}>
                      {audioLevel > 15 ? '🟢 Speaking' : '⚪ Silence'}
                    </span>
                  </div>
                )}

                {/* Recorded Audio Preview & Playback Player */}
                {audioPreviewUrl && !isRecording && (
                  <div style={{
                    background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
                    padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>🎧</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>
                          Voice Recorded ({audioFile ? (audioFile.size / 1024).toFixed(1) + ' KB' : 'Ready'} · WAV PCM)
                        </div>
                        <div style={{ fontSize: 10, color: '#15803d' }}>Ready to transcribe via Google Cloud ASR</div>
                      </div>
                    </div>
                    <audio controls src={audioPreviewUrl} style={{ height: 32, maxWidth: 260 }} />
                  </div>
                )}
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
                  border: `2px dashed ${dragOver ? 'var(--ct-orange)' : (audioFile && !isRecording ? '#22c55e' : '#cbd5e1')}`,
                  borderRadius: 10, padding: '20px', textAlign: 'center',
                  background: dragOver ? 'var(--ct-lt)' : (audioFile && !isRecording ? '#f0fdf4' : '#fafafa'),
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
                <div style={{ fontSize: 24, marginBottom: 4 }}>{audioFile ? '🎵' : '📁'}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: audioFile ? '#16a34a' : '#1e293b' }}>
                  {audioFile ? `Selected: ${audioFile.name}` : 'Or click to browse / drop pre-recorded audio file'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
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

// ── Helpers: Pure 16-bit LINEAR16 PCM WAV Encoder ──────────────────

function downsampleBuffer(buffer, inputSampleRate, outputSampleRate = 16000) {
  if (inputSampleRate === outputSampleRate) return buffer
  const sampleRateRatio = inputSampleRate / outputSampleRate
  const newLength = Math.round(buffer.length / sampleRateRatio)
  const result = new Float32Array(newLength)
  let offsetResult = 0
  let offsetBuffer = 0
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio)
    let accum = 0, count = 0
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i]
      count++
    }
    result[offsetResult] = count > 0 ? accum / count : 0
    offsetResult++
    offsetBuffer = nextOffsetBuffer
  }
  return result
}

function encodeWAV(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(view, 8, 'WAVE')

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true)  // AudioFormat (1 = LINEAR PCM)
  view.setUint16(22, 1, true)  // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true) // SampleRate (16000)
  view.setUint32(28, sampleRate * 2, true) // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true)  // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true) // BitsPerSample (16-bit)

  // "data" sub-chunk
  writeString(view, 36, 'data')
  view.setUint32(40, samples.length * 2, true)

  // Write 16-bit PCM integer samples
  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
  }

  return new Blob([view], { type: 'audio/wav' })
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}
