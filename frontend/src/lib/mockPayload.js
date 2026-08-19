// Hardcoded fallback payload — HomePro Furniture 24/7 Call Center ACW & BLUF schema
export const MOCK_RESPONSE = {
  data: {
    extraction_id: 'ext_homepro_demo',
    source: 'call_center',
    identity: {
      customer_phone: '0819876543',
      order_invoice_no: 'HP-INV-99824',
      product_sku_model: 'โต๊ะทำงานรุ่น Loft Wood 120cm',
    },
    issue_triage: {
      furniture_damage_type: 'Structural_Failure',
      photo_evidence_received: true,
      incident_description: 'แกะกล่องพบขาโต๊ะด้านขวาแตกหักครึ่งท่อนก่อนประกอบ ไม่สามารถใช้งานได้',
    },
    escalation_logic: {
      escalation_required: false,
      escalation_target: 'Logistics_Delivery_Team',
      escalation_reason: 'สินค้าอยู่ในเงื่อนไขรับประกัน 14 วันและมีหลักฐานภาพถ่ายครบถ้วน ดำเนินการเปลี่ยนตัวใหม่แบบ 1-to-1 ได้ทันที',
    },
    after_call_work: {
      call_disposition: 'Broken_Furniture_Intake',
      ticket_status: 'Replacement_Dispatched',
      action_deadline: 'Within 48 hours',
      bluf_note: {
        bottom_line: 'Replacement dispatched for broken dining table (within 14-day warranty); logistics team scheduled for 1-to-1 swap.',
        context: 'Structural Failure (cracked right leg upon unboxing). Photos verified via HomePro LINE OA. Invoice #HP-INV-99824.',
        next_steps: 'Logistics Delivery Team to swap replacement unit at customer residence within 48 hrs.',
        formatted_text: '[BLUF]: Replacement dispatched for broken dining table (within 14-day warranty); logistics team scheduled for 1-to-1 swap.\n• Context: Structural Failure (cracked right leg upon unboxing). Photos verified via HomePro LINE OA. Invoice #HP-INV-99824.\n• Next Steps: Logistics Delivery Team to swap replacement unit at customer residence within 48 hrs.',
      },
    },
    intent: {
      primary: 'complaint',
      confidence: 0.94,
    },
    sentiment: {
      overall: 'negative',
      score: -0.65,
    },
    entities: [
      { type: 'phone_number', value: '0819876543', span: '0819876543', pii_scrubbed: false },
      { type: 'person_name', value: 'กิตติศักดิ์ พลอยงาม', span: 'กิตติศักดิ์ พลอยงาม', pii_scrubbed: false },
      { type: 'order_id', value: 'HP-INV-99824', span: '#HP-INV-99824', pii_scrubbed: false },
      { type: 'product_name', value: 'โต๊ะทำงานรุ่น Loft Wood 120cm', span: 'โต๊ะทำงานรุ่น Loft Wood 120cm', pii_scrubbed: false },
    ],
    crm_fields: {
      customer_name: 'กิตติศักดิ์ พลอยงาม',
      phone: '0819876543',
      email: null,
      order_id: 'HP-INV-99824',
      issue_category: 'Structural_Failure',
      priority: 'high',
    },
  },
  meta: {
    model: 'thaillm-v1-homepro',
    input_type: 'chat',
    processing_time_ms: 320,
    pii_fields_scrubbed: 0,
  },
}

// Default HomePro furniture demo dialogue loaded on first open
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
