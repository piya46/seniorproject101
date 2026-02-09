// backend/data/staticData.js

exports.departments = [
  // กลุ่มวิทยาศาสตร์กายภาพ
  { id: "math_ug", name_th: "คณิตศาสตร์ (ป.ตรี)", email: "supattra.ua@chula.ac.th" },
  { id: "math_grad", name_th: "คณิตศาสตร์ (บัณฑิตศึกษา)", email: "supattra.u@chula.ac.th" },
  { id: "cs_all", name_th: "วิทยาการคอมพิวเตอร์ (ทุกระดับ)", email: "supattra.u@chula.ac.th" },
  { id: "chem_ug", name_th: "เคมี (ป.ตรี)", email: "pakakrongp@chula.ac.th" },
  { id: "chem_grad", name_th: "เคมี (บัณฑิตศึกษา)", email: "thitirat.ph@chula.ac.th" },
  { id: "chem_bsac", name_th: "เคมี (นานาชาติ BSAC)", email: "bsac@chula.ac.th" },
  
  // กลุ่มวิทยาศาสตร์ชีวภาพ
  { id: "bio", name_th: "ชีววิทยา/สัตววิทยา", email: "biology.sc@chula.ac.th" },
  { id: "botany", name_th: "พฤกษศาสตร์/พันธุศาสตร์", email: "rawipha.p@chula.ac.th" },
  { id: "biochem", name_th: "ชีวเคมี", email: "mitra2507@hotmail.com" },
  { id: "microbio", name_th: "จุลชีววิทยา", email: "trada.o@chula.ac.th" },

  // กลุ่มวิทยาศาสตร์ธรรมชาติ
  { id: "marine", name_th: "วิทยาศาสตร์ทางทะเล", email: "suthinee.a@chula.ac.th" },
  { id: "geo", name_th: "ธรณีวิทยา", email: "korgks2011@gmail.com" },
  { id: "envi_ug", name_th: "วิทยาศาสตร์สิ่งแวดล้อม (ป.ตรี)", email: "requestenvisci@gmail.com" },

  // กลุ่มวิทยาศาสตร์เทคโนโลยี
  { id: "chemtech", name_th: "เคมีเทคนิค", email: "watcharachai.c@chula.ac.th" },
  { id: "matsci", name_th: "วัสดุศาสตร์", email: "bhunditmee@gmail.com" },
  { id: "photo", name_th: "เทคโนโลยีทางภาพและการพิมพ์", email: "eidiarin.k@chula.ac.th" },
  { id: "food", name_th: "เทคโนโลยีทางอาหาร", email: "kamonwan.o@chula.ac.th" }
];

// 2. รายชื่อฟอร์มทั้งหมด (อ้างอิงจากตาราง PDF หน้า 9-16)
exports.forms = [
  { 
    form_code: "JT31", 
    name_th: "คำร้องขอลาออก (จท.31)", 
    category: "Status",
    degree_level: ["bachelor", "graduate"] 
  },
  { 
    form_code: "JT32", 
    name_th: "ขอรักษาสถานภาพการเป็นนิสิต (จท.32)", 
    category: "Status", 
    degree_level: ["graduate"] // เฉพาะ ป.โท-เอก
  },
  { 
    form_code: "JT34", 
    name_th: "ขอคืนสถานภาพการเป็นนิสิต (จท.34)", 
    category: "Status", 
    degree_level: ["graduate"] 
  },
  { 
    form_code: "JT35", 
    name_th: "ขอทักท้วงผลการศึกษา (จท.35)", 
    category: "Academic", 
    degree_level: ["bachelor", "graduate"] 
  },
  { 
    form_code: "JT43", 
    name_th: "ขอลงทะเบียนเรียนเพื่อขอผล S/U หรือ V/W (จท.43)", 
    category: "Academic", 
    degree_level: ["bachelor", "graduate"] 
  },
  { 
    form_code: "JT44", 
    name_th: "คำร้องขอลาป่วย (จท.44)", 
    category: "Academic", 
    degree_level: ["bachelor", "graduate"] 
  },
  { 
    form_code: "JT48", 
    name_th: "คำร้องขอถอนรายวิชา (จท.48 - W)", 
    category: "Academic", 
    degree_level: ["bachelor", "graduate"]
  },
  { 
    form_code: "JT49", 
    name_th: "ลาพักการศึกษา (จท.49)", 
    category: "Status", 
    degree_level: ["bachelor", "graduate"]
  },
  { 
    form_code: "JT66", 
    name_th: "ขอยกเว้นรายวิชา (จท.66)", 
    category: "Academic", 
    degree_level: ["bachelor", "graduate"]
  },
  { 
    form_code: "CF", 
    name_th: "ขอ CF (Course Withdrawal with CF)", 
    category: "Academic", 
    degree_level: ["bachelor"]
  },
  {
    form_code: "JT41",
    name_th: "คำร้องทั่วไป (จท.41)",
    category: "General",
    has_sub_types: true,
    sub_categories: [
       { value: "tuition_installment", label: "ขอผ่อนผันค่าเล่าเรียน" },
       { value: "keep_midterm_score", label: "ขอเก็บตัวสอบกลางภาค" },
       { value: "late_reg", label: "ขอลงทะเบียนเรียนหลังกำหนด" },
       { value: "missing_midterm", label: "ขอขาดสอบกลางภาค" },
       { value: "review_midterm", label: "ขอทบทวนคะแนนสอบกลางภาค" },
       { value: "sick_midterm", label: "ลาป่วยสำหรับกลางภาค" },
       { value: "postpone_final", label: "ขอเลื่อนสอบปลายภาค" }
    ],
    degree_level: ["bachelor", "graduate"]
  }
];

// 3. Logic การตรวจสอบเอกสาร (Validation Criteria)
exports.getFormConfig = (formCode, degreeLevel, subType) => {
  
  // --- JT31: ลาออก ---
  if (formCode === 'JT31') {
    const config = {
      form_code: "JT31",
      degree_level: degreeLevel,
      conditions: ["ไม่มีเงื่อนไขพิเศษสำหรับการยื่นคำร้อง"],
      
      // Location & Steps
      submission_location: degreeLevel === 'bachelor' 
          ? "ฝ่ายกิจการนิสิต คณะวิทยาศาสตร์ (ตึกแถบฯ ชั้น 1)" 
          : "สำนักงานบัณฑิตวิทยาลัย",
      submission_steps: degreeLevel === 'bachelor' ? [
          "1. กรอกแบบฟอร์ม จท.31 พร้อมติดรูปถ่าย",
          "2. ให้ผู้ปกครองลงนามยินยอม",
          "3. ให้อาจารย์ที่ปรึกษาลงนาม",
          "4. นำส่งที่ภาควิชาเพื่อให้อาจารย์หัวหน้าภาคลงนาม",
          "5. ยื่นที่ฝ่ายกิจการนิสิต คณะวิทยาศาสตร์"
      ] : [
          "1. กรอกแบบฟอร์ม จท.31",
          "2. ให้อาจารย์ที่ปรึกษาลงนาม",
          "3. นำส่งที่ภาควิชา",
          "4. ภาควิชานำส่งบัณฑิตวิทยาลัย"
      ],

      required_documents: [
        { 
          key: "main_form", 
          label: "แบบฟอร์ม จท.31", 
          required: true,
          validation_criteria: `1. ตรวจสอบว่าเป็นฟอร์ม จท.31 2. มีลายเซ็นนิสิต 3. หากเป็น ป.บัณฑิต ต้องส่งที่ทะเบียนภาควิชา`
        }
      ]
    };
    if (degreeLevel === 'bachelor') {
      config.conditions.push("ต้องได้รับความยินยอมจากผู้ปกครอง");
      config.required_documents.push(
        { key: "parent_consent", label: "หนังสือยินยอมจากผู้ปกครอง", required: true, validation_criteria: "มีลายเซ็นผู้ปกครองชัดเจน" },
        { key: "parent_id_card", label: "สำเนาบัตรประชาชนผู้ปกครอง", required: true, validation_criteria: "เห็นชื่อ-นามสกุลชัดเจน และควรมีการขีดคร่อมหรือเซ็นรับรองสำเนา" }
      );
    }
    return config;
  }

  // --- JT32: ขอรักษาสถานภาพ (เฉพาะ Grad) ---
  if (formCode === 'JT32') {
    return {
      form_code: "JT32",
      conditions: ["สำหรับนิสิตระดับบัณฑิตศึกษาเท่านั้น"],
      
      submission_location: "สำนักงานการทะเบียน (ผ่านภาควิชา)",
      submission_steps: [
          "1. นิสิตชำระเงินค่ารักษาสถานภาพผ่าน CUNEX หรือธนาคาร",
          "2. กรอก จท.32 และแนบหลักฐานการโอนเงิน",
          "3. ให้อาจารย์ที่ปรึกษาลงนาม",
          "4. นำส่งเจ้าหน้าที่ภาควิชาเพื่อดำเนินการต่อ"
      ],

      required_documents: [
        { 
            key: "main_form", label: "แบบฟอร์ม จท.32", required: true, 
            validation_criteria: "ตรวจสอบว่าเป็นฟอร์ม จท.32 และมีลายเซ็นนิสิตกับอาจารย์ที่ปรึกษา" 
        },
        {
            key: "payment_slip", label: "หลักฐานการชำระเงินค่ารักษาสถานภาพ", required: true,
            validation_criteria: "ตรวจสอบยอดเงิน (3,000 บาท สำหรับบัณฑิตศึกษา) และชื่อผู้ชำระต้องตรงกับนิสิต"
        }
      ]
    };
  }

  // --- JT34: ขอคืนสถานภาพ (Grad Only) ---
  if (formCode === 'JT34') {
    return {
      form_code: "JT34",
      conditions: ["ส่งเล่มวิทยานิพนธ์ฉบับสมบูรณ์แล้ว", "ชำระค่ารักษาสถานภาพแล้ว"],
      
      submission_location: "บัณฑิตวิทยาลัย",
      submission_steps: [
          "1. ตรวจสอบสถานะการส่งเล่มวิทยานิพนธ์",
          "2. ชำระค่าธรรมเนียมคืนสถานภาพ + ค่าปรับ",
          "3. ยื่นคำร้องผ่านภาควิชา",
          "4. ภาควิชาเสนอเรื่องไปยังบัณฑิตวิทยาลัย"
      ],

      required_documents: [
        { key: "main_form", label: "แบบฟอร์ม จท.34", required: true, validation_criteria: "ตรวจสอบลายเซ็นนิสิตและอาจารย์ที่ปรึกษา" },
        { key: "thesis_proof", label: "หลักฐานการส่งเล่มวิทยานิพนธ์", required: true, validation_criteria: "เป็นภาพถ่ายอีเมลตอบรับ หรือใบรับรองการส่งเล่มที่ระบุว่าดำเนินการเรียบร้อยแล้ว" },
        { key: "payment_proof", label: "หลักฐานการชำระเงินค่าคืนสถานภาพ", required: true, validation_criteria: "ต้องมียอดชำระค่าธรรมเนียมการขอคืนสถานภาพ และค่าปรับ (ถ้ามี)" }
      ]
    };
  }

  // --- JT35: ทักท้วงผลการศึกษา ---
  if (formCode === 'JT35') {
    return {
      form_code: "JT35",
      conditions: ["ยื่นภายใน 30 วันนับจากประกาศผล", "เฉพาะเกรดปลายภาคเท่านั้น"],
      
      submission_location: "ฝ่ายวิชาการ คณะวิทยาศาสตร์ (ตึกแถบฯ ชั้น 1)",
      submission_steps: [
          "1. นิสิตกรอกคำร้อง จท.35",
          "2. ยื่นคำร้องที่ฝ่ายวิชาการ คณะวิทยาศาสตร์ (ไม่ต้องผ่านอาจารย์)",
          "3. คณะฯ จะทำบันทึกข้อความสอบถามไปยังภาควิชาเจ้าของรายวิชา"
      ],

      required_documents: [
        { key: "main_form", label: "แบบฟอร์ม จท.35", required: true, validation_criteria: "ตรวจสอบว่าระบุรายวิชาและเกรดที่ต้องการทักท้วงชัดเจน" }
      ]
    };
  }

  // --- JT44: ลาป่วย ---
  if (formCode === 'JT44') {
    return {
      form_code: "JT44",
      conditions: ["ยื่นภายใน 5 วันทำการนับจากวันที่ขาดสอบ"],
      
      submission_location: "ฝ่ายวิชาการ คณะวิทยาศาสตร์",
      submission_steps: [
          "1. ขอใบรับรองแพทย์จากสถานพยาบาล (ระบุให้พักในวันสอบ)",
          "2. กรอก จท.44 และแนบใบรับรองแพทย์",
          "3. ยื่นที่ฝ่ายวิชาการ คณะวิทยาศาสตร์ (เร็วที่สุดหลังหายป่วย)",
          "4. รอประกาศผลการพิจารณาจากคณะฯ"
      ],

      required_documents: [
        { key: "main_form", label: "แบบฟอร์ม จท.44", required: true, validation_criteria: "ตรวจสอบว่าเป็นฟอร์ม จท.44 และระบุรายวิชาที่ขาดสอบ" },
        { 
            key: "exam_schedule", label: "สำเนาตารางสอบ", required: true, 
            validation_criteria: "ต้องไฮไลท์หรือระบุวิชาที่ขาดสอบ วันเวลาต้องชัดเจน" 
        },
        { 
            key: "med_cert", label: "ใบรับรองแพทย์", required: true, 
            validation_criteria: "สำคัญ: วันที่ที่ระบุในใบรับรองแพทย์ว่า 'ให้หยุดพัก' ต้องตรงหรือครอบคลุม 'วันที่ขาดสอบ' ในตารางสอบ" 
        }
      ]
    };
  }

  // --- JT48: ถอนรายวิชา (W) ---
  if (formCode === 'JT48') {
    return {
      form_code: "JT48",
      conditions: ["ถอนหลังกำหนด (มีค่าปรับ 300 บาท/วิชา)", "ต้องให้ อ.ที่ปรึกษา และ อ.วิชา เซ็น"],
      
      submission_location: "สำนักงานการทะเบียน (Reg Chula)",
      submission_steps: [
          "1. พิมพ์คำร้อง จท.48 จากระบบ Reg Chula (เมนูผลการลงทะเบียน)",
          "2. นำไปให้ อาจารย์ผู้สอนรายวิชา ลงนามอนุมัติ",
          "3. นำไปให้ อาจารย์ที่ปรึกษา ลงนามอนุมัติ",
          "4. ชำระค่าธรรมเนียม (ถ้ามี) ที่สำนักงานการทะเบียน",
          "5. ยื่นเอกสารที่สำนักงานการทะเบียน จามจุรี 5"
      ],

      required_documents: [
        { key: "main_form", label: "แบบฟอร์ม จท.48", required: true, validation_criteria: "ตรวจสอบลายเซ็นให้ครบ 3 จุด (นิสิต, อ.ที่ปรึกษา, อ.วิชา)" },
        { key: "reason_memo", label: "เอกสารประกอบเหตุผลการถอน", required: true, validation_criteria: "ใบบันทึกข้อความอธิบายเหตุผลความจำเป็น" }
      ]
    };
  }

  // --- JT49: ลาพักการศึกษา ---
  if (formCode === 'JT49') {
    const config = {
       form_code: "JT49",
       conditions: ["ต้องชำระค่ารักษาสถานภาพ", "เหตุผลต้องเข้าเกณฑ์ (เกณฑ์ทหาร, ป่วย >20วัน, เหตุจำเป็น)"],
       
       submission_location: "ฝ่ายวิชาการ คณะวิทยาศาสตร์",
       submission_steps: [
           "1. กรอก จท.49 และแนบหลักฐาน (เช่น ใบรับรองแพทย์)",
           "2. ให้อาจารย์ที่ปรึกษาลงนาม",
           "3. ให้หัวหน้าภาควิชาลงนาม",
           "4. นำส่งที่ฝ่ายวิชาการ คณะวิทยาศาสตร์",
           "5. เมื่ออนุมัติแล้ว ต้องชำระค่ารักษาสถานภาพที่ Reg Chula"
       ],

       required_documents: [
         { key: "main_form", label: "แบบฟอร์ม จท.49", required: true, validation_criteria: "ตรวจสอบว่าเป็นฟอร์ม จท.49" },
         { key: "evidence", label: "หลักฐานประกอบ (ใบรับรองแพทย์/Transcript)", required: true, validation_criteria: "ถ้าป่วยต้องมีใบรับรองแพทย์ระบุว่าพักรักษาตัวเกิน 20 วัน, ถ้าเหตุส่วนตัวต้องแนบ Transcript" }
       ]
    };
    if (degreeLevel === 'bachelor') {
        config.required_documents.push({
            key: "parent_consent", label: "หนังสือยินยอมจากผู้ปกครอง", required: true, validation_criteria: "ต้องมีลายเซ็นผู้ปกครอง"
        });
    }
    return config;
  }

  // --- JT41: คำร้องทั่วไป (General Request) ---
  if (formCode === 'JT41') {
      const config = {
        form_code: "JT41",
        sub_type: subType,
        conditions: [],
        
        submission_location: "ฝ่ายวิชาการ คณะวิทยาศาสตร์",
        submission_steps: [
            "1. กรอก จท.41 ระบุความประสงค์ให้ชัดเจน",
            "2. แนบเอกสารหลักฐานที่เกี่ยวข้อง",
            "3. ให้อาจารย์ที่ปรึกษาลงนามรับทราบ/มีความเห็น",
            "4. ยื่นที่ฝ่ายวิชาการ คณะวิทยาศาสตร์ (หรือภาควิชา แล้วแต่กรณี)"
        ],

        required_documents: [
            {
                key: "main_form",
                label: `คำร้องทั่วไป (จท.41) - ${subType}`,
                required: true,
                validation_criteria: `ตรวจสอบช่อง 'เรื่อง' ต้องระบุว่า '${subType}' หรือข้อความที่สื่อความหมายเดียวกัน`
            }
        ]
      };
      
      // เพิ่มเอกสารตาม Sub-type (อ้างอิงจาก PDF หน้า 14-16)
      switch (subType) {
          case 'tuition_installment': // ขอผ่อนผันค่าเล่าเรียน
              config.submission_location = "กิจการนิสิต คณะวิทยาศาสตร์";
              config.submission_steps = [
                  "1. ดาวน์โหลดแบบฟอร์มผ่อนผันค่าเล่าเรียน",
                  "2. ให้ผู้ปกครองลงนาม",
                  "3. สัมภาษณ์กับอาจารย์ที่ปรึกษา/รองคณบดีกิจการนิสิต",
                  "4. ยื่นที่ฝ่ายกิจการนิสิต ภายใน 2 สัปดาห์แรก"
              ];
              config.conditions.push("ยื่นภายใน 2 สัปดาห์แรกของภาคการศึกษา");
              break;
          
          case 'keep_midterm_score': // ขอเก็บตัวสอบกลางภาค
          case 'postpone_final': // ขอเลื่อนสอบปลายภาค
              config.required_documents.push(
                  { key: "reg_result", label: "ผลการลงทะเบียนเรียน (CR54)", required: true, validation_criteria: "แสดงรายวิชาที่ลงทะเบียน" },
                  { key: "exam_schedule", label: "ตารางสอบรายบุคคล", required: true, validation_criteria: "ระบุวันสอบกลางภาค/ปลายภาคชัดเจน" },
                  { key: "schedule_class", label: "ตารางเรียน", required: false, validation_criteria: "ตารางเรียนส่วนบุคคล" }
              );
              break;

          case 'late_reg': // ขอลงทะเบียนเรียนหลังกำหนด
              config.conditions.push("ภายใน 2 สัปดาห์แรก");
              break;

          case 'missing_midterm': // ขาดสอบกลางภาค
          case 'sick_midterm': // ลาป่วยกลางภาค
              config.required_documents.push(
                  { key: "reg_result", label: "ผลการลงทะเบียนเรียน", required: true, validation_criteria: "CR54" },
                  { key: "exam_schedule", label: "ตารางสอบ", required: true, validation_criteria: "ต้องระบุวันเวลาสอบที่ขาดไป" },
                  { key: "evidence", label: "หลักฐานประกอบ (เช่น ใบรับรองแพทย์)", required: true, validation_criteria: "วันที่ในหลักฐานต้องตรงกับวันที่สอบ" }
              );
              break;
          
          default:
               // กรณีอื่นๆ
               config.required_documents.push({
                  key: "memo", label: "บันทึกข้อความชี้แจง", required: true, validation_criteria: "อธิบายรายละเอียดความประสงค์"
               });
      }
      
      return config;
  }
  
  // --- CF: ขอ CF ---
  if (formCode === 'CF') {
      return {
          form_code: "CF",
          conditions: ["ต้องเป็นวิชาที่ระบุเงื่อนไข CF ไว้ใน Reg Chula"],
          
          submission_location: "ภาควิชาเจ้าของรายวิชา",
          submission_steps: [
              "1. ตรวจสอบเงื่อนไขรายวิชาใน Reg Chula ว่ามี CF หรือไม่",
              "2. กรอกแบบฟอร์มขอ CF (ขอที่ภาควิชา)",
              "3. ยื่นคำร้องต่ออาจารย์ผู้สอนรายวิชา เพื่อพิจารณา",
              "4. ภาควิชาจะรวบรวมส่งทะเบียนคณะฯ"
          ],

          required_documents: [
              { key: "cf_form", label: "แบบฟอร์มขอ CF", required: true, validation_criteria: "แบบฟอร์มถูกต้อง" },
              { key: "reg_page", label: "ภาพหน้าจอรายวิชาจากระบบ Reg", required: true, validation_criteria: "ต้องเห็นข้อความระบุเงื่อนไข CF ชัดเจน" },
              { key: "reg_result", label: "ผลการลงทะเบียนเรียน", required: true, validation_criteria: "CR54" }
          ]
      };
  }

  // Fallback: ถ้าหาไม่เจอ ให้คืนค่า null (เพื่อให้ Route ตอบ 404)
  return null;
};