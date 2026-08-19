/**
 * Maps the raw API response (data, meta) into the shape
 * the ChaiToke UI card, CustomerTab, and CRM Internal Note composer expect.
 */

const SENTIMENT_EMOJI = {
  positive: { emoji: '😊', label: 'Positive' },
  negative: { emoji: '😤', label: 'Frustrated' },
  neutral:  { emoji: '😐', label: 'Neutral' },
  mixed:    { emoji: '😕', label: 'Mixed' },
}

const PRIORITY_COLOURS = {
  low:    { label: 'Low',    colour: 'blue' },
  normal: { label: 'Normal', colour: 'blue' },
  high:   { label: 'High',   colour: 'red'  },
  urgent: { label: 'Urgent', colour: 'red'  },
}

const DAMAGE_TYPE_LABELS = {
  Structural_Failure:         '🪵 Structural Failure (แตกหัก/เสียหายหนัก)',
  Cosmetic_Damage:            '🎨 Cosmetic Damage (รอยขูดขีด/ตำหนิผิว)',
  Missing_Assembly_Hardware:  '🔩 Missing Hardware (อุปกรณ์/น็อตไม่ครบ)',
}

const ESCALATION_LABELS = {
  Home_Service_Technician:  '🛠️ Home Service Technician (ช่างหน้างาน)',
  Logistics_Delivery_Team:  '🚚 Logistics Delivery Team (ทีมขนส่งเปลี่ยนตัวใหม่)',
  Furniture_Vendor_Support: '🏭 Furniture Vendor Support (ประสานงานโรงงานผู้ผลิต)',
}

const TICKET_STATUS_LABELS = {
  Replacement_Dispatched: '📦 Replacement Dispatched (อนุมัติส่งเปลี่ยนตัวใหม่)',
  Pending_Inspection:     '🔍 Pending Inspection (รอช่างเข้าตรวจสอบ)',
  Awaiting_Photos:        '📸 Awaiting Photos (รอลูกค้าส่งภาพทาง LINE OA)',
}

export function mapResponse({ data = {}, meta = {} }) {
  const crm        = data.crm_fields       || {}
  const identity   = data.identity         || {}
  const triage     = data.issue_triage     || {}
  const escalation = data.escalation_logic  || {}
  const acw        = data.after_call_work  || {}
  const bluf       = acw.bluf_note         || {}
  const intent     = data.intent           || {}
  const senti      = data.sentiment        || {}

  const sentInfo   = SENTIMENT_EMOJI[senti.overall] || { emoji: '❓', label: senti.overall || '—' }
  const prioInfo   = PRIORITY_COLOURS[crm.priority] || { label: crm.priority || 'Normal', colour: 'blue' }
  
  // Format BLUF note fallback
  const blufFormatted = bluf.formatted_text || (
    bluf.bottom_line
      ? `[BLUF]: ${bluf.bottom_line}\n• Context: ${bluf.context || 'N/A'}\n• Next Steps: ${bluf.next_steps || 'N/A'}`
      : `[BLUF]: ${triage.incident_description || 'Customer inquiry recorded.'}\n• Status: ${acw.ticket_status || 'Pending'}\n• Action: ${acw.action_deadline || 'Within 48h'}`
  )

  const phone = identity.customer_phone || crm.phone || null
  const invoiceNo = identity.order_invoice_no || crm.order_id || null
  const productSku = identity.product_sku_model || null
  const isOfflineFallback = meta.model === 'offline-unidentified-fallback' || meta.model === 'demo-offline'

  return {
    // Identity fields
    customerName:     crm.customer_name || (isOfflineFallback ? '[UNIDENTIFIED_CUSTOMER]' : '—'),
    phone:            phone || (isOfflineFallback ? '[UNIDENTIFIED_PHONE]' : '—'),
    invoiceNo:        invoiceNo || (isOfflineFallback ? '[UNIDENTIFIED_INVOICE]' : '—'),
    productSku:       productSku || (isOfflineFallback ? '[UNIDENTIFIED_PRODUCT]' : '—'),

    // Triage & Escalation
    damageType:       triage.furniture_damage_type || null,
    damageTypeLabel:  DAMAGE_TYPE_LABELS[triage.furniture_damage_type] || triage.furniture_damage_type || (isOfflineFallback ? '[UNIDENTIFIED_DAMAGE]' : null),
    photosReceived:   Boolean(triage.photo_evidence_received),
    incidentDesc:     triage.incident_description || null,
    
    escalationRequired: Boolean(escalation.escalation_required),
    escalationTarget:   escalation.escalation_target || null,
    escalationTargetLabel: ESCALATION_LABELS[escalation.escalation_target] || escalation.escalation_target || null,
    escalationReason:   escalation.escalation_reason || null,

    // After-Call Work (ACW) & BLUF
    callDisposition:  acw.call_disposition || 'Broken_Furniture_Intake',
    ticketStatus:     acw.ticket_status || 'Pending_Inspection',
    ticketStatusLabel: TICKET_STATUS_LABELS[acw.ticket_status] || acw.ticket_status || 'Pending',
    actionDeadline:   acw.action_deadline || '—',
    blufNote:         bluf,
    blufFormatted:    blufFormatted,

    // Standard sentiment & priority
    sentimentEmoji:   sentInfo.emoji,
    sentimentLabel:   sentInfo.label,
    priorityLabel:    prioInfo.label,
    priorityColour:   prioInfo.colour,
    confidence:       intent.confidence != null ? Math.round(intent.confidence * 100) : null,
    processingMs:     meta.processing_time_ms ?? null,
    isOffline:        isOfflineFallback,

    // Customer Tab fields for CRM Push
    customerTabFields: {
      name:           crm.customer_name || (isOfflineFallback ? '[UNIDENTIFIED_CUSTOMER]' : '—'),
      phone:          phone || (isOfflineFallback ? '[UNIDENTIFIED_PHONE]' : '—'),
      invoiceNo:      invoiceNo || (isOfflineFallback ? '[UNIDENTIFIED_INVOICE]' : '—'),
      productSku:     productSku || (isOfflineFallback ? '[UNIDENTIFIED_PRODUCT]' : '—'),
      category:       triage.furniture_damage_type || crm.issue_category || (isOfflineFallback ? '[UNIDENTIFIED]' : '—'),
      ticketStatus:   acw.ticket_status || 'Pending_Inspection',
      escalation:     escalation.escalation_target || (isOfflineFallback ? '[UNIDENTIFIED_ESCALATION]' : '—'),
      deadline:       acw.action_deadline || '—',
      priority:       prioInfo.label,
      priorityColour: prioInfo.colour,
      sentiment:      `${sentInfo.emoji} ${sentInfo.label}`,
      blufNote:       blufFormatted,
    },

    entities: data.entities || [],
    rawTranscript: meta.raw_transcript || null,
    reconstructedTranscript: data.reconstructed_transcript || null,
  }
}

/**
 * Robustly parses Thai transcripts containing [customer], [agent], [ลูกค้า], [เจ้าหน้าที่],
 * or line-by-line tags, separating them into discrete conversation bubbles.
 */
export function rawTextToMessages(text) {
  if (!text || typeof text !== 'string') return []

  // 1. Strip redundant [transcript] prefix if present
  let cleanText = text.replace(/^\[transcript\]\s*/i, '').trim()
  if (!cleanText) return []

  // 2. Tag replacement regex for splitting
  // Matches tags like [customer], [agent], [ลูกค้า], [เจ้าหน้าที่], customer:, agent:, เจ้าหน้าที่:, ลูกค้า:
  const tagPattern = /(\[(?:customer|agent|staff|แอดมิน|เจ้าหน้าที่|ลูกค้า)\]|^(?:customer|agent|staff|แอดมิน|เจ้าหน้าที่|ลูกค้า)\s*:)/gi

  // Check if text has inline bracket tags like "[agent] สวัสดี [customer] มีปัญหา"
  if (/\[(?:customer|agent|staff|แอดมิน|เจ้าหน้าที่|ลูกค้า)\]/i.test(cleanText)) {
    // Split by bracket tags while keeping delimiters
    const tokens = cleanText.split(/(\[(?:customer|agent|staff|แอดมิน|เจ้าหน้าที่|ลูกค้า)\])/i).filter(Boolean)
    const messages = []
    let currentRole = 'customer'

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i].trim()
      if (!token) continue

      const match = token.match(/^\[(customer|agent|staff|แอดมิน|เจ้าหน้าที่|ลูกค้า)\]$/i)
      if (match) {
        const rawRole = match[1].toLowerCase()
        currentRole = (rawRole === 'agent' || rawRole === 'staff' || rawRole === 'แอดมิน' || rawRole === 'เจ้าหน้าที่')
          ? 'agent'
          : 'customer'
      } else {
        // Content block
        messages.push({
          role: currentRole,
          content: token,
          timestamp: new Date(Date.now() + messages.length * 15000).toISOString(),
        })
      }
    }

    if (messages.length > 0) return messages
  }

  // 3. Line-by-line parsing fallback
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean)
  const result = []

  lines.forEach((line, i) => {
    const agentMatch = /^(?:\[(?:agent|staff|แอดมิน|เจ้าหน้าที่)\]|(?:agent|staff|แอดมิน|เจ้าหน้าที่)\s*:)\s*/i
    const customerMatch = /^(?:\[(?:customer|ลูกค้า)\]|(?:customer|ลูกค้า)\s*:)\s*/i

    let role = 'customer'
    let content = line

    if (agentMatch.test(line)) {
      role = 'agent'
      content = line.replace(agentMatch, '').trim()
    } else if (customerMatch.test(line)) {
      role = 'customer'
      content = line.replace(customerMatch, '').trim()
    } else {
      // If no tag, alternate or default
      role = i === 0 && line.includes('สวัสดี') && (line.includes('ยินดี') || line.includes('โฮมโปร') || line.includes('ศูนย์'))
        ? 'agent'
        : (i % 2 === 0 ? 'customer' : 'agent')
    }

    if (content) {
      result.push({
        role,
        content,
        timestamp: new Date(Date.now() + i * 20000).toISOString(),
      })
    }
  })

  return result
}

/**
 * Parse upload input — handles JSON or raw text
 */
export function parseUploadInput(text, sourcePlatform) {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Input is empty.')

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed.messages && Array.isArray(parsed.messages)) {
        return { source: parsed.source || sourcePlatform, messages: parsed.messages }
      }
      if (Array.isArray(parsed)) {
        return { source: sourcePlatform, messages: parsed }
      }
      throw new Error('JSON must contain a "messages" array.')
    } catch (e) {
      throw new Error(`Invalid JSON: ${e.message}`)
    }
  }

  const messages = rawTextToMessages(trimmed)
  if (messages.length === 0) throw new Error('No messages detected in input.')
  return { source: sourcePlatform, messages }
}
