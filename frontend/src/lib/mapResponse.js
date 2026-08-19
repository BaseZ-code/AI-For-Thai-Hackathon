/**
 * Maps the raw API response (data, meta) into the shape
 * the ChaiToke UI card and CustomerTab expect.
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

const INTENT_LABELS = {
  greeting:           'Greeting',
  order_inquiry:      'Order Inquiry',
  shipping_inquiry:   'Shipping Inquiry',
  product_inquiry:    'Product Inquiry',
  complaint:          'Complaint',
  refund_request:     'Refund Request',
  order_cancellation: 'Order Cancellation',
  payment_issue:      'Payment Issue',
  account_inquiry:    'Account Inquiry',
  general_inquiry:    'General Inquiry',
}

export function mapResponse({ data, meta }) {
  const crm    = data.crm_fields  || {}
  const intent = data.intent      || {}
  const senti  = data.sentiment   || {}

  const sentInfo  = SENTIMENT_EMOJI[senti.overall] || { emoji: '❓', label: senti.overall || '—' }
  const prioInfo  = PRIORITY_COLOURS[crm.priority]  || { label: crm.priority || '—', colour: 'blue' }
  const intentLbl = INTENT_LABELS[crm.issue_category] || crm.issue_category || '—'

  return {
    // ChaiToke card fields
    customerName:     crm.customer_name  || '—',
    phone:            crm.phone          || '—',
    orderId:          crm.order_id       || null,
    issueCategory:    intentLbl,
    sentimentEmoji:   sentInfo.emoji,
    sentimentLabel:   sentInfo.label,
    priorityLabel:    prioInfo.label,
    priorityColour:   prioInfo.colour,
    confidence:       intent.confidence != null ? Math.round(intent.confidence * 100) : null,
    processingMs:     meta?.processing_time_ms ?? null,
    isOffline:        meta?.model === 'demo-offline',

    // For Customer tab push
    customerTabFields: {
      name:      crm.customer_name  || '—',
      phone:     crm.phone          || '—',
      category:  intentLbl,
      priority:  prioInfo.label,
      sentiment: `${sentInfo.emoji} ${sentInfo.label}`,
      priorityColour: prioInfo.colour,
    },

    // Summary constructed from entities
    entities: data.entities || [],
  }
}

/**
 * Auto-convert raw Thai text (one message per line) into the messages[] array.
 * Lines starting with "agent:" or "เจ้าหน้าที่:" are tagged as agent.
 * Everything else is customer.
 */
export function rawTextToMessages(text) {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const agentPrefix = /^(agent|เจ้าหน้าที่|staff)\s*:\s*/i
      const isAgent = agentPrefix.test(line)
      return {
        role: isAgent ? 'agent' : 'customer',
        content: line.replace(agentPrefix, '').trim(),
        timestamp: new Date(Date.now() + i * 60000).toISOString(),
      }
    })
}

/**
 * Parse upload text — tries JSON first, falls back to raw-text conversion.
 * Returns { source, messages } ready for the API, or throws a human-readable Error.
 */
export function parseUploadInput(text, sourcePlatform) {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Paste is empty.')

  // Try JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      // Accept full API request shape { source, messages }
      if (parsed.messages && Array.isArray(parsed.messages)) {
        return { source: parsed.source || sourcePlatform, messages: parsed.messages }
      }
      // Accept bare messages array
      if (Array.isArray(parsed)) {
        return { source: sourcePlatform, messages: parsed }
      }
      throw new Error('JSON must have a "messages" array.')
    } catch (e) {
      throw new Error(`Invalid JSON: ${e.message}`)
    }
  }

  // Plain text fallback
  const messages = rawTextToMessages(trimmed)
  if (messages.length === 0) throw new Error('No messages found in pasted text.')
  return { source: sourcePlatform, messages }
}
