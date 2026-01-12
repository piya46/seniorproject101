exports.departments = [
  { id: "math_ug", name_th: "คณิตศาสตร์ (ระดับปริญญาตรี)", email: "supattra.ua@chula.ac.th" },
  { id: "math_grad", name_th: "คณิตศาสตร์ (ระดับบัณฑิตศึกษา)", email: "supattra.u@chula.ac.th" },
  { id: "bio", name_th: "ชีววิทยา", email: "biology.sc@chula.ac.th" }
];

exports.forms = [
  { 
    form_code: "JT31", 
    name_th: "คำร้องขอลาออก (จท.31)", 
    category: "Status",
    degree_level: ["bachelor", "graduate"] 
  },
  { 
    form_code: "JT48", 
    name_th: "คำร้องขอถอนรายวิชา (จท.48 - W)", 
    category: "Academic",
    degree_level: ["bachelor", "graduate"]
  },
  {
    form_code: "JT41",
    name_th: "คำร้องทั่วไป (จท.41)",
    category: "General",
    has_sub_types: true,
    sub_categories: [
       { value: "late_reg", label: "ขอลงทะเบียนเรียนหลังกำหนด" },
       { value: "other", label: "กรณีอื่นๆ" }
    ],
    degree_level: ["bachelor", "graduate"]
  }
];

// ✅ Logic เงื่อนไขเอกสาร + กติกาการตรวจ (Validation Criteria)
exports.getFormConfig = (formCode, degreeLevel, subType) => {
  
  // กรณี 1: JT31 (ลาออก)
  if (formCode === 'JT31') {
    const config = {
      form_code: "JT31",
      degree_level: degreeLevel,
      conditions: [],
      required_documents: [
        { 
          key: "main_form", 
          label: "แบบฟอร์ม จท.31", 
          required: true,
          // 👇 บอก AI ให้ตรวจ "รูปแบบฟอร์ม" (Visual Check)
          validation_criteria: `
            1. ตรวจสอบมุมขวาบนของกระดาษ ต้องมีรหัส "จท.31" หรือ "JT.31" พิมพ์อยู่ชัดเจน
            2. ส่วนหัวกระดาษต้องมีตราพระเกี้ยว หรือโลโก้จุฬาฯ
            3. ตรวจสอบช่องลายเซ็นนิสิต ต้องมีการลงนามเรียบร้อย
          `
        }
      ]
    };

    if (degreeLevel === 'bachelor') {
      config.conditions.push("ต้องได้รับความยินยอมจากผู้ปกครอง");
      config.required_documents.push(
        { 
          key: "parent_consent", 
          label: "หนังสือยินยอมจากผู้ปกครอง", 
          required: true,
          validation_criteria: "ต้องเป็นจดหมายที่มีใจความยินยอมให้ลาออก และมีลายเซ็นผู้ปกครอง"
        },
        { 
          key: "parent_id_card", 
          label: "สำเนาบัตรประชาชนผู้ปกครอง", 
          required: true,
          // 👇 บอก AI ให้ตรวจ "ขีดคร่อม" หรือรายละเอียดในบัตร
          validation_criteria: "ต้องเป็นสำเนาบัตรประชาชนที่เห็นชื่อชัดเจน และควรมีการเซ็นรับรองสำเนาถูกต้อง"
        }
      );
    }
    return config;
  }
  
  // กรณี 2: JT41 (ทั่วไป)
  if (formCode === 'JT41') {
      const config = {
        form_code: "JT41",
        required_documents: [
            {
                key: "main_form",
                label: "คำร้องทั่วไป (จท.41)",
                required: true,
                // 👇 บอก AI ให้ตรวจ "หัวข้อ" (Topic Check)
                validation_criteria: `
                  1. ตรวจสอบว่าเป็นฟอร์ม จท.41 จริง (มุมขวาบน)
                  2. อ่านข้อความในช่อง "เรื่อง" (Subject): ต้องมีการระบุเรื่องที่ยื่นคำร้องชัดเจน (ห้ามเว้นว่าง หรือเขียนสั้นเกินไปว่า "คำร้อง")
                  3. ช่อง "มีความประสงค์" (Intention): ต้องมีการอธิบายรายละเอียดความต้องการ
                `
            }
        ]
      };
      
      // ถ้าเลือก "กรณีอื่นๆ" ต้องแนบเอกสารอธิบายเหตุผล
      if (subType === 'other') {
          config.required_documents.push({
              key: "reason_memo",
              label: "บันทึกข้อความชี้แจงเหตุผล",
              required: true,
              validation_criteria: "ต้องเป็นเอกสาร A4 ที่เขียน/พิมพ์ อธิบายเหตุผลประกอบคำร้องอย่างน้อย 3-4 บรรทัด"
          });
      }
      
      return config;
  }

  // Default config
  return { 
      form_code: formCode, 
      required_documents: [
          { 
              key: "main_form", 
              label: "แบบฟอร์มหลัก", 
              required: true, 
              validation_criteria: `ตรวจสอบว่าเป็นแบบฟอร์ม ${formCode} ที่ถูกต้อง มีตราสัญลักษณ์มหาวิทยาลัย และกรอกข้อมูลครบ` 
          }
      ] 
  };
};