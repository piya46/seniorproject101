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

// Logic เงื่อนไขเอกสาร (Hardcode Rules)
exports.getFormConfig = (formCode, degreeLevel, subType) => {
  // ตัวอย่าง Logic สำหรับ JT31
  if (formCode === 'JT31') {
    const config = {
      form_code: "JT31",
      degree_level: degreeLevel,
      conditions: [],
      required_documents: [
        { key: "main_form", label: "แบบฟอร์ม จท.31", required: true }
      ]
    };
    if (degreeLevel === 'bachelor') {
      config.conditions.push("ต้องได้รับความยินยอมจากผู้ปกครอง");
      config.required_documents.push(
        { key: "parent_consent", label: "หนังสือยินยอมจากผู้ปกครอง", required: true },
        { key: "parent_id_card", label: "สำเนาบัตรประชาชนผู้ปกครอง", required: true }
      );
    }
    return config;
  }
  

  return { form_code: formCode, required_documents: [{ key: "main_form", label: "แบบฟอร์มหลัก", required: true }] };
};
