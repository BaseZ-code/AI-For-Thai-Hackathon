// Hardcoded fallback payload — mirrors the #TH98765 example from the API guide.
// Used when backend is offline so the pitch never breaks.
export const MOCK_RESPONSE = {
  data: {
    extraction_id: 'ext_demo_offline',
    source: 'line',
    intent: {
      primary: 'complaint',
      confidence: 0.88,
    },
    sentiment: {
      overall: 'negative',
      score: -1,
    },
    entities: [
      { type: 'phone_number', value: '0811049552',   span: '0811049552',           pii_scrubbed: false },
      { type: 'order_id',     value: 'TH98765',      span: 'คำสั่งซื้อ #TH98765',   pii_scrubbed: false },
      { type: 'person_name',  value: 'ทาจ บอร์ธวิค', span: 'ทาจ บอร์ธวิค',         pii_scrubbed: false },
    ],
    crm_fields: {
      customer_name:  'ทาจ บอร์ธวิค',
      phone:          '0811049552',
      email:          null,
      order_id:       'TH98765',
      issue_category: 'complaint',
      priority:       'high',
    },
  },
  meta: {
    model:                'demo-offline',
    processing_time_ms:   0,
    pii_fields_scrubbed:  0,
  },
}

// Default demo transcript loaded on first open
export const DEFAULT_TRANSCRIPT = {
  source: 'line',
  messages: [
    { role: 'customer', content: 'ได้รับของแล้วครับ แต่เสื้อมีรอยขาดตรงแขน ทำเรื่องเคลมยังไงได้บ้างครับ แย่มากๆ เสียเวลาเลย', timestamp: '2026-08-18T10:30:00Z' },
    { role: 'agent',    content: 'ต้องขออภัยในความไม่สะดวกอย่างยิ่งเลยนะคะ รบกวนคุณลูกค้าถ่ายรูปสินค้าบริเวณที่มีรอยขาด พร้อมแจ้งเลขที่คำสั่งซื้อให้แอดมินประสานงานเคลมให้ทันทีค่ะ', timestamp: '2026-08-18T10:32:00Z' },
    { role: 'customer', content: 'เลขที่คำสั่งซื้อ #TH98765 ครับ รูปส่งเข้าไปในแชทแล้วครับ', timestamp: '2026-08-18T10:35:00Z' },
    { role: 'agent',    content: 'ขอข้อมูลลูกค้าหน่อยครับผม', timestamp: '2026-08-18T10:37:00Z' },
    { role: 'customer', content: 'ทาจ บอร์ธวิค 0811049552', timestamp: '2026-08-18T10:42:00Z' },
    { role: 'agent',    content: 'ทาจ บอร์ธวิค คือชื่อใช่มั้ยครับ', timestamp: '2026-08-18T10:48:00Z' },
    { role: 'customer', content: 'ใช่ครับ', timestamp: '2026-08-18T10:52:00Z' },
  ],
}
