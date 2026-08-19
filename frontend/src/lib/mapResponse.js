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

export function mapResponse({ data, meta }) {
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
  
  // Format BLUF note fallback if model didn't return pre-formatted text
  const blufFormatted = bluf.formatted_text || (
    bluf.bottom_line
      ? `[BLUF]: ${bluf.bottom_line}\n• Context: ${bluf.context || 'N/A'}\n• Next Steps: ${bluf.next_steps || 'N/A'}`
      : `[BLUF]: ${triage.incident_description || 'Customer inquiry recorded.'}\n• Status: ${acw.ticket_status || 'Pending'}\n• Action: ${acw.action_deadline || 'Within 48h'}`
  )

  const phone = identity.customer_phone || crm.phone || '—'
  const invoiceNo = identity.order_invoice_no || crm.order_id || '—'
  const productSku = identity.product_sku_model || '—'

  return {
    // Identity fields
    customerName:     crm.customer_name || '—',
    phone:            phone,
    invoiceNo:        invoiceNo,
    productSku:       productSku,

    // Triage & Escalation
    damageType:       triage.furniture_damage_type || null,
    damageTypeLabel:  DAMAGE_TYPE_LABELS[triage.furniture_damage_type] || triage.furniture_damage_type || null,
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
    actionDeadline:   acw.action_deadline || 'Within 48 hours',
    blufNote:         bluf,
    blufFormatted:    blufFormatted,

    // Standard sentiment & priority
    sentimentEmoji:   sentInfo.emoji,
    sentimentLabel:   sentInfo.label,
    priorityLabel:    prioInfo.label,
    priorityColour:   prioInfo.colour,
    confidence:       intent.confidence != null ? Math.round(intent.confidence * 100) : null,
    processingMs:     meta?.processing_time_ms ?? null,
    isOffline:        meta?.model?.includes('offline') || false,

    // Customer Tab fields for CRM Push
    customerTabFields: {
      name:           crm.customer_name || 'กิตติศักดิ์ พลอยงาม',
      phone:          phone,
      invoiceNo:      invoiceNo,
      productSku:     productSku,
      category:       triage.furniture_damage_type || crm.issue_category || 'Structural_Failure',
      ticketStatus:   acw.ticket_status || 'Replacement_Dispatched',
      escalation:     escalation.escalation_target || 'Logistics_Delivery_Team',
      deadline:       acw.action_deadline || 'Within 48 hours',
      priority:       prioInfo.label,
      priorityColour: prioInfo.colour,
      sentiment:      `${sentInfo.emoji} ${sentInfo.label}`,
      blufNote:       blufFormatted,
    },

    entities: data.entities || [],
    rawTranscript: meta?.raw_transcript || null,
    reconstructedTranscript: data.reconstructed_transcript || null,
  }
}

/**
 * Auto-convert raw Thai text (one message per line) into messages[]
 */
export function rawTextToMessages(text) {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const agentPrefix = /^(agent|เจ้าหน้าที่|staff|แอดมิน)\s*:\s*/i
      const isAgent = agentPrefix.test(line)
      return {
        role: isAgent ? 'agent' : 'customer',
        content: line.replace(agentPrefix, '').trim(),
        timestamp: new Date(Date.now() + i * 20000).toISOString(),
      }
    })
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
