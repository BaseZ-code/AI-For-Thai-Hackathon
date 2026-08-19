// Unidentified Debugging Mock Payload
// Used only when backend is completely offline or fails with unhandled errors.
// Clearly marked as UNIDENTIFIED / OFFLINE so engineers can immediately distinguish
// mock data from live LLM responses during testing.
export const MOCK_RESPONSE = {
  data: {
    extraction_id: 'ext_offline_unidentified',
    source: 'call_center',
    identity: {
      customer_phone: null,
      order_invoice_no: null,
      product_sku_model: null,
    },
    issue_triage: {
      furniture_damage_type: null,
      photo_evidence_received: false,
      incident_description: '[UNIDENTIFIED: Backend offline or returned unparseable response]',
    },
    escalation_logic: {
      escalation_required: false,
      escalation_target: null,
      escalation_reason: '[UNIDENTIFIED_ESCALATION]',
    },
    after_call_work: {
      call_disposition: 'Unidentified_Inquiry',
      ticket_status: 'Pending_Inspection',
      action_deadline: '—',
      bluf_note: {
        bottom_line: '[UNIDENTIFIED_BLUF]: No live AI response received from backend.',
        context: 'Offline Fallback triggered. Please check backend /v1/chat/analyze or /v1/audio/analyze connection.',
        next_steps: 'Verify server status at https://team8.105app.site/v1/health.',
        formatted_text: '[BLUF / DEBUG]: No live LLM response received.\n• Context: Backend offline or API error.\n• Next Steps: Check API logs and ensure LLM keys are configured.',
      },
    },
    intent: {
      primary: 'general_inquiry',
      confidence: 0.0,
    },
    sentiment: {
      overall: 'neutral',
      score: 0.0,
    },
    entities: [],
    crm_fields: {
      customer_name: null,
      phone: null,
      email: null,
      order_id: null,
      issue_category: null,
      priority: 'normal',
    },
  },
  meta: {
    model: 'offline-unidentified-fallback',
    input_type: 'chat',
    processing_time_ms: 0,
    pii_fields_scrubbed: 0,
  },
}

// Preset HomePro furniture demo dialogue (Used when clicking "Reset to HomePro Sample" in paste modal)
export const DEFAULT_TRANSCRIPT = {
  source: 'call_center',
  messages: [
    { role: 'agent', content: 'สวัสดีครับ ศูนย์บริการลูกค้าโฮมโปร 24 ชั่วโมง ยินดีให้บริการครับ วันนี้มีอะไรให้ผมดูแลครับ', timestamp: '2026-08-19T14:30:00Z' },
    { role: 'customer', content: 'สวัสดีครับ พอดีเพิ่งได้รับโต๊ะทำงานไม้ยางพาราที่สั่งไปเมื่อวาน พอแกะกล่องออกมาจะประกอบ พบว่าขาโต๊ะด้านขวาแตกหักครึ่งท่อนเลยครับ ใช้งานไม่ได้เลย แย่มากครับ', timestamp: '2026-08-19T14:30:20Z' },
    { role: 'agent', content: 'ต้องขออภัยในความไม่สะดวกเป็นอย่างยิ่งเลยนะครับคุณลูกค้า รบกวนขอทราบเบอร์โทรศัพท์ที่ลงทะเบียนสมาชิก HomeCard เพื่อตรวจสอบข้อมูลในระบบหน่อยครับ', timestamp: '2026-08-19T14:30:40Z' },
    { role: 'customer', content: '0819876543 ครับ ชื่อ กิตติศักดิ์ พลอยงาม', timestamp: '2026-08-19T14:31:00Z' },
    { role: 'agent', content: 'ขอบคุณครับคุณกิตติศักดิ์ ขอทราบเลขที่ใบเสร็จหรือเลขออเดอร์สั่งซื้อเพิ่มเติมด้วยครับ', timestamp: '2026-08-19T14:31:15Z' },
    { role: 'customer', content: 'เลขที่ใบกำกับภาษี #HP-INV-99824 ครับ โต๊ะทำงานรุ่น Loft Wood 120cm', timestamp: '2026-08-19T14:31:35Z' },
    { role: 'agent', content: 'ขอบคุณครับ ตรวจสอบพบข้อมูลในระบบแล้วครับ สินค้าเพิ่งจัดส่งไปเมื่อวาน ยังอยู่ในเงื่อนไขรับประกันเปลี่ยนตัวใหม่ภายใน 14 วันครับ ไม่ทราบว่าคุณกิตติศักดิ์ได้ถ่ายรูปบริเวณขาโต๊ะที่แตกหักส่งเข้ามาทาง HomePro LINE Official แล้วหรือยังครับ', timestamp: '2026-08-19T14:32:00Z' },
    { role: 'customer', content: 'ส่งรูปถ่ายกล่องกับรอยแตกที่ขาโต๊ะเข้าไปใน LINE OA ของโฮมโปรแล้วครับ เมื่อสักครู่นี้เลย', timestamp: '2026-08-19T14:32:20Z' },
    { role: 'agent', content: 'สักครู่นะครับ... ได้รับรูปถ่ายหลักฐานใน LINE OA เรียบร้อยแล้วครับ ชัดเจนครับ ขาโต๊ะหักเนื่องจากความเสียหายจากการขนส่ง ทางเราจะเปิดเคลมเปลี่ยนสินค้าตัวใหม่แบบ 1 ต่อ 1 ให้ทันที โดยทีมช่างและขนส่งจะนำโต๊ะตัวใหม่เข้าไปสลับเปลี่ยนให้ถึงบ้านภายใน 48 ชั่วโมงครับ', timestamp: '2026-08-19T14:33:00Z' },
    { role: 'customer', content: 'โอเคครับ รบกวนเร่งให้หน่อยนะครับ เพราะต้องรีบใช้งาน ขอบคุณมากครับ', timestamp: '2026-08-19T14:33:15Z' },
    { role: 'agent', content: 'ยินดีครับ ทางทีมขนส่งจะโทรนัดหมายล่วงหน้าก่อนเข้าส่งมอบนะครับ ขอบคุณที่ไว้วางใจโฮมโปร สวัสดีครับ', timestamp: '2026-08-19T14:33:30Z' },
  ],
}
