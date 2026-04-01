// // backend/data/staticData.js

// exports.departments = [
//   // กลุ่มวิทยาศาสตร์กายภาพ
//   { id: "math_ug", name_th: "คณิตศาสตร์ (ป.ตรี)", email: "supattra.u@chula.ac.th" },
//   { id: "math_grad", name_th: "คณิตศาสตร์ (บัณฑิตศึกษา)", email: "supattra.u@chula.ac.th" },
//   { id: "cs_all", name_th: "วิทยาการคอมพิวเตอร์ (ทุกระดับ)", email: "supattra.u@chula.ac.th" },
//   { id: "chem_ug", name_th: "เคมี (ป.ตรี)", email: "pakakrong.p@chula.ac.th" },
//   { id: "chem_grad", name_th: "เคมี (บัณฑิตศึกษา)", email: "thitirat.ph@chula.ac.th" },
//   { id: "chem_bsac", name_th: "เคมี (นานาชาติ BSAC)", email: "bsac@chula.ac.th" },
  
//   // กลุ่มวิทยาศาสตร์ชีวภาพ
//   { id: "bio", name_th: "ชีววิทยา/สัตววิทยา", email: "biology.sc@chula.ac.th" },
//   { id: "botany", name_th: "พฤกษศาสตร์/พันธุศาสตร์", email: "rawipha.p@chula.ac.th" },
//   { id: "biochem", name_th: "ชีวเคมี", email: "sujitra2507@hotmail.com" },
//   { id: "microbio", name_th: "จุลชีววิทยา", email: "trada.o@chula.ac.th" },

//   // กลุ่มวิทยาศาสตร์ธรรมชาติ
//   { id: "marine", name_th: "วิทยาศาสตร์ทางทะเล", email: "suthinee.a@chula.ac.th" },
//   { id: "geo", name_th: "ธรณีวิทยา", email: "jongkolk2011@gmail.com" },
//   { id: "envi_ug", name_th: "วิทยาศาสตร์สิ่งแวดล้อม (ป.ตรี)", email: "requestenvisci@gmail.com" },
//   { id: "envi_grad", name_th: "วิทยาศาสตร์สิ่งแวดล้อม (บัณฑิตศึกษา)", email: "requestenvisci@gmail.com" },

//   // กลุ่มวิทยาศาสตร์เทคโนโลยี
//   { id: "chemtech", name_th: "เคมีเทคนิค", email: "watcharachai.c@chula.ac.th" },
//   { id: "matsci", name_th: "วัสดุศาสตร์", email: "bhunditmee@gmail.com" },
//   { id: "photo", name_th: "เทคโนโลยีทางภาพและการพิมพ์", email: "ekkarin.k@chula.ac.th" },
//   { id: "food", name_th: "เทคโนโลยีทางอาหาร", email: "kamonwan.o@chula.ac.th" }
// ];

// // 2. รายชื่อฟอร์มทั้งหมด 
// exports.forms = [
//   { 
//     form_code: "JT31", 
//     name_th: "จท.31 คำร้องขอลาออก", 
//     category: "Status",
//     degree_level: ["bachelor", "graduate"] 
//   },
//   { 
//     form_code: "JT32", 
//     name_th: "จท.32 คำร้องขอรักษาสถานภาพการเป็นนิสิต", 
//     category: "Status", 
//     degree_level: ["graduate"] 
//   },
//   { 
//     form_code: "JT34", 
//     name_th: "จท.34 คำร้องขอคืนสถานภาพการเป็นนิสิต", 
//     category: "Status", 
//     degree_level: ["bachelor", "graduate"] 
//   },
//   { 
//     form_code: "JT35", 
//     name_th: "จท.35 คำร้องขอทักท้วงผลการศึกษา", 
//     category: "Academic", 
//     degree_level: ["bachelor", "graduate"] 
//   },
//   {
//     form_code: "JT41",
//     name_th: "จท.41 คำร้องทั่วไป",
//     category: "General",
//     has_sub_types: true,
//     sub_categories: [
//        { value: "tuition_installment", label: "ขอผ่อนผันค่าเล่าเรียน" },
//        { value: "keep_midterm_score", label: "ขอเก็บตัวสอบกลางภาค" },
//        { value: "late_reg", label: "ขอลงทะเบียนเรียนหลังกำหนด" },
//        { value: "missing_midterm", label: "ขอขาดสอบกลางภาค" },
//        { value: "review_midterm", label: "ขอทบทวนคะแนนสอบกลางภาค" },
//        { value: "sick_midterm", label: "ลาป่วยสำหรับกลางภาค" },
//        { value: "postpone_final", label: "ขอเลื่อนสอบปลายภาค" }
//     ],
//     degree_level: ["bachelor", "graduate"]
//   },
//   { 
//     form_code: "JT43", 
//     name_th: "จท.43 คำร้องขอลงทะเบียนเรียนเพื่อขอผล S/U หรือ V/W", 
//     category: "Academic", 
//     degree_level: ["bachelor", "graduate"] 
//   },
//   { 
//     form_code: "JT44", 
//     name_th: "จท.44 คำร้องขอลาป่วย", 
//     category: "Academic", 
//     degree_level: ["bachelor", "graduate"] 
//   },
//   { 
//     form_code: "JT48", 
//     name_th: "จท.48 คำร้องขอถอนรายวิชา (W)", 
//     category: "Academic", 
//     degree_level: ["bachelor", "graduate"]
//   },
//   { 
//     form_code: "JT49", 
//     name_th: "จท.49 คำร้องขอลาพักการศึกษา", 
//     category: "Status", 
//     degree_level: ["bachelor", "graduate"]
//   },
//   { 
//     form_code: "JT66", 
//     name_th: "จท.66 คำร้องขอยกเว้นรายวิชา", 
//     category: "Academic", 
//     degree_level: ["bachelor", "graduate"]
//   },
//   { 
//     form_code: "CF", 
//     name_th: "คำร้องขอ CF (Course Withdrawal with CF)", 
//     category: "Academic", 
//     degree_level: ["bachelor", "graduate"] 
//   }
// ];

// // 3. Logic การตรวจสอบเอกสาร (Validation Criteria)
// exports.getFormConfig = (formCode, degreeLevel, subType) => {
  
//   // --- JT31: ลาออก ---
//   if (formCode === 'JT31') {
//     const config = {
//       form_code: "JT31",
//       degree_level: degreeLevel,
//       conditions: ["นิสิตต้องไม่มีหนี้สินหรือภาระผูกพันค้างชำระกับทางมหาวิทยาลัย"],
      
//       submission_location: degreeLevel === 'bachelor' ? "ทะเบียนภาควิชาที่สังกัด" : "ทะเบียนคณะวิทยาศาสตร์",
//       submission_steps: degreeLevel === 'bachelor' ? [
//           "1. กรอกแบบฟอร์ม จท.31 และจัดเตรียมเอกสารประกอบ",
//           "2. ให้ผู้ปกครองลงนามในเอกสารยินยอม (เฉพาะปริญญาบัณฑิต)",
//           "3. นิสิตลงนามในคำร้อง",
//           "4. นำส่งเอกสารทั้งหมดที่ทะเบียนภาควิชาที่สังกัด"
//       ] : [
//           "1. กรอกแบบฟอร์ม จท.31 และจัดเตรียมเอกสารประกอบ",
//           "2. นิสิตตรวจสอบความถูกต้องและลงนามในคำร้อง",
//           "3. นำส่งที่ทะเบียนคณะวิทยาศาสตร์"
//       ],

//       required_documents: [
//         { key: "main_form", label: "คำร้อง จท.31", required: true, validation_criteria: "ตรวจสอบว่าเป็นฟอร์ม จท.31 และมีการลงนามเรียบร้อย" },
//         { key: "back_doc", label: "เอกสารประกอบ จท.31 ด้านหลังของคณะ", required: true, validation_criteria: "เอกสารแนบด้านหลังต้องครบถ้วน" }
//       ]
//     };
//     if (degreeLevel === 'bachelor') {
//       config.required_documents.push(
//         { key: "parent_consent", label: "เอกสารยินยอมจากผู้ปกครอง", required: true, validation_criteria: "มีลายเซ็นผู้ปกครอง" },
//         { key: "parent_id_card", label: "สำเนาบัตรประชาชนผู้ปกครอง", required: true, validation_criteria: "เห็นชื่อ-นามสกุลชัดเจน (พร้อมเซ็นรับรองสำเนาถูกต้อง)" }
//       );
//     }
//     return config;
//   }

//   // --- JT32: ขอรักษาสถานภาพ (เฉพาะ Grad) ---
//   if (formCode === 'JT32') {
//     return {
//       form_code: "JT32",
//       conditions: [
//           "เป็นนิสิตระดับบัณฑิตศึกษาเท่านั้น",
//           "เป็นนิสิตที่ส่งเล่มวิทยานิพนธ์ฉบับสมบูรณ์เรียบร้อยแล้วและรอการตีพิมพ์ (หรือเข้าเงื่อนไขอื่นตามประกาศมหาวิทยาลัย)"
//       ],
//       submission_location: "ทะเบียนภาควิชาที่สังกัด",
//       submission_steps: [
//           "1. หมายเหตุ (สำคัญ): นิสิตต้องดำเนินการชำระเงินค่ารักษาสถานภาพในระบบของมหาวิทยาลัยให้เรียบร้อยก่อน (ระบบนี้ไม่ตรวจสอบเอกสารการเงิน)",
//           "2. กรอกข้อมูลในแบบฟอร์ม จท.32 และลงนาม",
//           "3. นำไปให้อาจารย์ที่ปรึกษาลงนาม",
//           "4. นำส่งเอกสารที่ลงนามครบถ้วนที่ทะเบียนภาควิชาที่สังกัด"
//       ],
//       required_documents: [
//         { key: "main_form", label: "คำร้อง จท.32", required: true, validation_criteria: "ตรวจสอบฟอร์มและลายเซ็นนิสิตและอาจารย์ที่ปรึกษา" },
//         { key: "thesis_proof", label: "หลักฐานรูปถ่าย/ภาพถ่ายอีเมลการส่งเล่มวิทยานิพนธ์", required: true, validation_criteria: "หลักฐานต้องบ่งบอกชัดเจนว่าได้ส่งเล่มวิทยานิพนธ์เป็นที่เรียบร้อยแล้ว" }
//       ]
//     };
//   }

//   // --- JT34: ขอคืนสถานภาพ ---
//   if (formCode === 'JT34') {
//     return {
//       form_code: "JT34",
//       conditions: [
//           "นิสิตต้องชำระค่าธรรมเนียมการขอคืนสถานภาพการเป็นนิสิต (ป.ตรี 2,000 บาท / บัณฑิตศึกษา 3,000 บาท)",
//           "นิสิตต้องชำระค่าปรับกรณีลงทะเบียนหลังกำหนด หรือจ่ายค่ารักษาสถานภาพในกรณีลาพักการศึกษาตามเงื่อนไขมหาวิทยาลัย"
//       ],
//       submission_location: "ทะเบียนภาควิชาที่สังกัด",
//       submission_steps: [
//           "1. หมายเหตุ (สำคัญ): นิสิตต้องชำระค่าธรรมเนียมขอคืนสถานภาพ และค่าปรับรายวัน หรือค่ารักษาสถานภาพให้เรียบร้อยผ่านระบบ CUNEX ตามเงื่อนไข (ระบบนี้ไม่ตรวจสอบเอกสารการเงิน)",
//           "2. กรอกแบบฟอร์ม จท.34 พร้อมจัดเตรียมเอกสารประกอบการลาพัก",
//           "3. ให้อาจารย์ที่ปรึกษาลงนาม",
//           "4. นำส่งเอกสารทั้งหมดที่ทะเบียนภาควิชาที่สังกัด"
//       ],
//       required_documents: [
//         { key: "main_form", label: "คำร้อง จท.34", required: true, validation_criteria: "มีลายเซ็นนิสิตและอาจารย์ที่ปรึกษาครบถ้วน" },
//         { key: "leave_doc", label: "เอกสารประกอบการลาพัก", required: true, validation_criteria: "เอกสารที่เกี่ยวข้องกับเหตุผลการขอคืนสถานภาพหรือการลาพักก่อนหน้า" }
//       ]
//     };
//   }

//   // --- JT35: ทักท้วงผลการศึกษา ---
//   if (formCode === 'JT35') {
//     return {
//       form_code: "JT35",
//       conditions: [
//           "ยื่นเฉพาะการทักท้วงเกรดปลายภาคเท่านั้น",
//           "นิสิตต้องตรวจสอบผลการศึกษาและยื่นทักท้วงภายใน 30 วัน นับจากวันที่ประกาศผล"
//       ],
//       submission_location: "ทะเบียนภาควิชาที่สังกัด",
//       submission_steps: [
//           "1. กรอกแบบฟอร์ม จท.35",
//           "2. ให้อาจารย์ที่ปรึกษาลงนามรับทราบ",
//           "3. นำส่งเอกสารที่ทะเบียนภาควิชาที่สังกัด"
//       ],
//       required_documents: [
//         { key: "main_form", label: "คำร้อง จท.35", required: true, validation_criteria: "ระบุรายวิชาและเกรดที่ต้องการทักท้วงให้ชัดเจน พร้อมลายเซ็นครบถ้วน" }
//       ]
//     };
//   }

//   // --- JT43: ขอ S/U หรือ V/W ---
//   if (formCode === 'JT43') {
//     return {
//       form_code: "JT43",
//       conditions: [
//           "ต้องยื่นภายใน 2 สัปดาห์แรกของภาคการศึกษา",
//           "ต้องลงทะเบียนเรียนในรายวิชานั้นสำเร็จแล้ว"
//       ],
//       submission_location: "ทะเบียนภาควิชาที่สังกัด",
//       submission_steps: degreeLevel === 'bachelor' ? [
//           "1. กรอกแบบฟอร์ม จท.43",
//           "2. นำไปให้อาจารย์ที่ปรึกษาลงนาม",
//           "3. นำไปให้อาจารย์ผู้สอนประจำวิชาลงนาม",
//           "4. นำส่งเอกสารที่ทะเบียนภาควิชาที่สังกัด"
//       ] : [
//           "1. กรอกแบบฟอร์ม จท.43 และลงนาม",
//           "2. ส่งคำร้องที่ทะเบียนภาควิชาที่สังกัดเพื่อขอลงนามและความเห็นต่อไป"
//       ],
//       required_documents: [
//         { key: "main_form", label: "คำร้อง จท.43", required: true, validation_criteria: "ตรวจสอบความสมบูรณ์ของแบบฟอร์ม" },
//         { key: "cr54", label: "CR54 (ผลการลงทะเบียนเรียน)", required: true, validation_criteria: "ต้องปรากฏรายวิชาที่ต้องการขอผล S/U หรือ V/W" },
//         { key: "reason_doc", label: "ใบแนบเหตุผลประจำรายวิชา", required: true, validation_criteria: "ระบุเหตุผลความจำเป็นอย่างชัดเจน" }
//       ]
//     };
//   }

//   // --- JT44: ลาป่วย ---
//   if (formCode === 'JT44') {
//     return {
//       form_code: "JT44",
//       conditions: [
//           "ใช้สำหรับขาดสอบในการสอบปลายภาคเท่านั้น",
//           "ต้องส่งยื่นคำร้องภายใน 5 วันทำการนับจากวันที่ขาดสอบ",
//           "กรณีป่วยต่อเนื่องตั้งแต่ก่อนวันสอบจนถึงวันสอบ ให้ยื่นคำร้องนี้ (จท.44)",
//           "กรณีเจ็บป่วยกะทันหัน 'ระหว่างการสอบ' ให้ติดต่อกรรมการคุมสอบเพื่อทำบันทึก (อาจใช้ฟอร์มอื่นตามคณะกำหนด)"
//       ],
//       submission_location: "ทะเบียนภาควิชาที่สังกัด",
//       submission_steps: degreeLevel === 'bachelor' ? [
//           "1. กรอกแบบฟอร์ม จท.44 และเตรียมใบรับรองแพทย์",
//           "2. ให้อาจารย์ที่ปรึกษาลงนาม",
//           "3. ให้อาจารย์ผู้สอนประจำวิชาลงนาม (เฉพาะกรณีลาป่วยก่อนสอบ)",
//           "4. นำส่งเอกสารที่ทะเบียนภาควิชาที่สังกัด"
//       ] : [
//           "1. กรอกแบบฟอร์ม จท.44 และลงนามตัวนิสิต",
//           "2. ส่งที่ทะเบียนภาควิชาที่สังกัด"
//       ],
//       required_documents: [
//         { key: "main_form", label: "คำร้อง จท.44", required: true, validation_criteria: "ฟอร์มถูกต้องและระบุวิชาที่ขาดสอบ" },
//         { key: "schedule", label: "สำเนาตารางสอบรายบุคคล", required: true, validation_criteria: "ต้องไฮไลท์หรือทำเครื่องหมายวิชาที่ขาดสอบ (ถ้าเป็น TDF ให้ระบุวันเวลาสอบให้ครบถ้วน)" },
//         { key: "medical_cert", label: "ใบรับรองแพทย์", required: true, validation_criteria: "ต้องระบุวันที่ให้หยุดพักรักษาตัว ซึ่งต้องครอบคลุมวันเวลาที่ขาดสอบ" }
//       ]
//     };
//   }

//   // --- JT48: ถอนรายวิชา (W) ---
//   if (formCode === 'JT48') {
//     return {
//       form_code: "JT48",
//       conditions: [
//           "เป็นการขอถอนรายวิชาหลังกำหนด (ติด W)",
//           "นิสิตปริญญาบัณฑิตและนิสิตบัณฑิตศึกษาใช้ฟอร์มแยกกัน"
//       ],
//       submission_location: "ทะเบียนภาควิชาที่สังกัด",
//       submission_steps: [
//           "1. หมายเหตุ (สำคัญ): นิสิตต้องดำเนินการชำระค่าถอนรายวิชาหลังกำหนด วิชาละ 300 บาท ผ่านระบบที่มหาวิทยาลัยกำหนด (ระบบนี้ไม่ตรวจสอบเอกสารการเงิน)",
//           "2. กรอกแบบฟอร์ม จท.48",
//           "3. ให้อาจารย์ที่ปรึกษาลงนาม",
//           "4. ให้อาจารย์ประจำรายวิชาลงนาม",
//           "5. นำส่งที่ทะเบียนภาควิชาที่สังกัด"
//       ],
//       required_documents: [
//         { key: "main_form", label: "คำร้อง จท.48", required: true, validation_criteria: "ตรวจสอบฟอร์มและลายเซ็นให้ครบทั้ง 3 ส่วน (นิสิต, ที่ปรึกษา, ผู้สอน)" },
//         { key: "reason", label: "เอกสารประกอบเหตุผลการถอนรายวิชาหลังกำหนด", required: true, validation_criteria: "อธิบายเหตุผลความจำเป็นที่ต้องถอนหลังกำหนด" }
//       ]
//     };
//   }

//   // --- JT49: ลาพักการศึกษา ---
//   if (formCode === 'JT49') {
//     return {
//        form_code: "JT49",
//        conditions: [
//            "หากไม่ได้ลงทะเบียนเรียน ต้องยื่นคำร้องและชำระค่ารักษาสถานภาพภายใน 2 สัปดาห์หลังเปิดภาคการศึกษา",
//            "ต้องเข้าเกณฑ์: 1) ถูกเกณฑ์ทหาร 2) ป่วยพักรักษาตัวเกิน 20 วัน หรือ 3) ความจำเป็นส่วนตัว (ต้องศึกษามาแล้วไม่น้อยกว่า 1 ภาคการศึกษา)"
//        ],
//        submission_location: "ทะเบียนภาควิชาที่สังกัด",
//        submission_steps: [
//            "1. หมายเหตุ (สำคัญ): หากไม่ได้ลงทะเบียนเรียน นิสิตต้องชำระค่ารักษาสถานภาพภายใน 2 สัปดาห์แรก (ระบบนี้ไม่ตรวจสอบเอกสารการเงิน)",
//            "2. กรอกแบบฟอร์ม จท.49 และเตรียมหลักฐาน",
//            "3. นิสิตและบุคคลที่เกี่ยวข้องลงนามให้เรียบร้อย",
//            "4. ส่งเอกสารมาที่ทะเบียนภาควิชาที่สังกัด"
//        ],
//        required_documents: [
//          { key: "main_form", label: "คำร้อง จท.49", required: true, validation_criteria: "ตรวจสอบความถูกต้องของฟอร์ม" },
//          { key: "evidence", label: "หลักฐานประกอบการขอลาพักการศึกษา", required: true, validation_criteria: "หลักฐานต้องสอดคล้องกับเหตุผล เช่น ใบรับรองแพทย์ต้องระบุให้พักเกิน 20 วัน" }
//        ]
//     };
//   }

//   // --- JT66: ขอยกเว้นรายวิชา ---
//   if (formCode === 'JT66') {
//       const config = {
//           form_code: "JT66",
//           conditions: degreeLevel === 'bachelor' ? [
//               "วิชาที่ขอยกเว้นต้องอยู่ในหลักสูตรที่ศึกษา",
//               "ต้องยื่นภายในภาคการศึกษาแรกที่เข้าศึกษา",
//               "เคยศึกษามาแล้วไม่เกิน 5 ปีการศึกษา",
//               "ได้รับผลการประเมินไม่ต่ำกว่า C หรือ S"
//           ] : [
//               "ต้องยื่นภายในภาคการศึกษาแรกที่เข้าศึกษา",
//               "ได้รับผลการศึกษาไม่ต่ำกว่า B หรือ S หรือเทียบเท่า",
//               "กรณีรายวิชานั้นเป็นระดับปริญญาบัณฑิตต้องได้รับความเห็นชอบจากประธานหลักสูตร"
//           ],
//           submission_location: "ทะเบียนภาควิชาที่สังกัด",
//           submission_steps: [
//               "1. กรอกแบบฟอร์ม จท.66",
//               "2. ให้อาจารย์ที่ปรึกษาลงนาม",
//               "3. ให้อาจารย์ประจำรายวิชาลงนาม",
//               "4. นำส่งที่ทะเบียนภาควิชาที่สังกัด"
//           ],
//           required_documents: [
//               { key: "main_form", label: "คำร้อง จท.66", required: true, validation_criteria: "แบบฟอร์มถูกต้องและมีลายเซ็นครบถ้วน" },
//               { key: "transcript", label: "Transcript (ผลการศึกษาเดิม)", required: true, validation_criteria: "แสดงผลการเรียนวิชาที่นำมาขอยกเว้นตามเงื่อนไขเกรด" }
//           ]
//       };
      
//       if (degreeLevel === 'bachelor') {
//           config.required_documents.push({
//               key: "approval_memo", label: "บันทึกอนุญาตจากเจ้าของรายวิชา", required: false, validation_criteria: "จำเป็นเฉพาะกรณีที่รหัสวิชาเดิมและรหัสวิชาใหม่ไม่ตรงกัน"
//           });
//       }
//       return config;
//   }

//   // --- CF: ขอ CF ---
//   if (formCode === 'CF') {
//       return {
//           form_code: "CF",
//           conditions: [
//               "วิชานั้นต้องอนุญาตให้ทำการ CF ได้",
//               "ต้องมีการระบุเงื่อนไข CF ไว้อย่างชัดเจนในหน้ารายวิชาของระบบ Reg Chula"
//           ],
//           submission_location: "ทะเบียนภาควิชาที่สังกัด",
//           submission_steps: [
//               "1. กรอกแบบฟอร์มคำร้องขอ CF",
//               "2. ให้อาจารย์ที่ปรึกษาลงนาม",
//               "3. ให้อาจารย์ประจำรายวิชาลงนาม",
//               "4. ส่งที่ทะเบียนภาควิชาที่สังกัด"
//           ],
//           required_documents: [
//               { key: "main_form", label: "คำร้องขอ CF", required: true, validation_criteria: "แบบฟอร์มถูกต้องและลายเซ็นครบถ้วน" },
//               { key: "reg_page", label: "ภาพหน้าจอรายวิชาในระบบ Reg Chula", required: true, validation_criteria: "ต้องแสดงให้เห็นเงื่อนไขการอนุญาต CF อย่างชัดเจน" },
//               { key: "reg_result", label: "ผลการลงทะเบียนเรียน (CR54)", required: true, validation_criteria: "ต้องปรากฏรายวิชานี้ในผลการลงทะเบียน" }
//           ]
//       };
//   }

//   // --- JT41: คำร้องทั่วไป ---
//   if (formCode === 'JT41') {
//       const config = {
//         form_code: "JT41",
//         sub_type: subType,
//         conditions: [],
//         submission_location: "ทะเบียนภาควิชาที่สังกัด",
//         submission_steps: [],
//         required_documents: []
//       };
      
//       switch (subType) {
//           case 'tuition_installment':
//               config.conditions.push("ยื่นคำร้องได้ภายใน 2 สัปดาห์แรกของภาคการศึกษา");
//               config.submission_steps = [
//                   "1. หมายเหตุ (สำคัญ): กระบวนการนี้ไม่มีการตรวจสอบเอกสารการเงินผ่านระบบ นิสิตต้องจัดการด้านการเงินกับมหาวิทยาลัยตามประกาศ",
//                   "2. กรอก จท.41 ระบุหัวข้อว่า 'ขอผ่อนผันค่าเล่าเรียน'",
//                   "3. นิสิตและอาจารย์ที่ปรึกษาลงนาม",
//                   "4. นำส่งที่ทะเบียนภาควิชาที่สังกัด"
//               ];
//               config.required_documents.push(
//                   { key: "main_form", label: "คำร้อง จท.41 (ขอผ่อนผันค่าเล่าเรียน)", required: true, validation_criteria: "ตรวจสอบว่าระบุหัวข้อชัดเจน" }
//               );
//               break;

//           case 'keep_midterm_score':
//               config.conditions.push(
//                   "วิชาบังคับชนวิชาบังคับ: สามารถทำได้ทุกชั้นปี",
//                   "วิชาบังคับชนวิชาเลือก หรือ วิชาเลือกชนวิชาเลือก: ทำได้เฉพาะนิสิตชั้นปีที่ 4",
//                   "อาจารย์ที่ปรึกษาต้องเห็นชอบและยินดีมาคุมสอบให้ (หรือมอบหมายอาจารย์ท่านอื่นมาคุมสอบแทน)",
//                   "กรณีข้ามคณะ ต้องได้รับความเห็นชอบจากประธานกรรมการรายวิชานั้นด้วย"
//               );
//               config.submission_steps = [
//                   "1. กรอก จท.41 ระบุหัวข้อ 'ขอสอบเก็บตัวกลางภาค'",
//                   "2. นิสิตและอาจารย์ที่ปรึกษาลงนาม",
//                   "3. นำส่งที่ทะเบียนภาควิชาที่สังกัด"
//               ];
//               config.required_documents.push(
//                   { key: "main_form", label: "คำร้อง จท.41 (ขอสอบเก็บตัวกลางภาค)", required: true, validation_criteria: "ระบุหัวข้อชัดเจน" },
//                   { key: "schedule_class", label: "ตารางเรียนส่วนบุคคล", required: true, validation_criteria: "แสดงให้เห็นรายวิชาและเวลาที่ชนกัน" },
//                   { key: "schedule_exam", label: "ตารางสอบรายบุคคล", required: true, validation_criteria: "ระบุวันสอบกลางภาคและปลายภาคครบทุกวิชา" },
//                   { key: "faculty_doc", label: "เอกสารแนบที่คณะจัดให้", required: true, validation_criteria: "ตรวจสอบความครบถ้วนของเอกสารส่วนเสริม" }
//               );
//               break;

//           case 'late_reg':
//               config.conditions.push("ต้องส่งทะเบียนคณะภายใน 2 สัปดาห์แรกของภาคการศึกษา (หรือภายในสัปดาห์แรกของภาคฤดูร้อน)");
//               config.submission_steps = [
//                   "1. หมายเหตุ (สำคัญ): หากมีค่าปรับการลงทะเบียนล่าช้า นิสิตต้องชำระตามระบบมหาวิทยาลัย (ระบบนี้ไม่ตรวจสอบเอกสารการเงิน)",
//                   "2. กรอก จท.41 ระบุว่า 'ขอลงทะเบียนเรียนหลังกำหนด'",
//                   "3. นิสิตและอาจารย์ที่ปรึกษาลงนาม",
//                   "4. นำส่งที่ทะเบียนภาควิชาที่สังกัด"
//               ];
//               config.required_documents.push(
//                   { key: "main_form", label: "คำร้อง จท.41 (ขอลงทะเบียนเรียนหลังกำหนด)", required: true, validation_criteria: "ระบุหัวข้อชัดเจน" },
//                   { key: "faculty_doc", label: "เอกสารแนบที่คณะจัดให้", required: true, validation_criteria: "แนบเอกสารคณะที่เกี่ยวข้องครบถ้วน" }
//               );
//               break;

//           case 'missing_midterm':
//               config.conditions.push("ต้องยื่นคำร้องทันทีหลังจากที่ขาดสอบกลางภาค");
//               config.submission_steps = [
//                   "1. กรอก จท.41 ระบุว่า 'ขอขาดสอบกลางภาค'",
//                   "2. นิสิตและอาจารย์ที่ปรึกษาลงนาม",
//                   "3. นำส่งที่ทะเบียนภาควิชาที่สังกัด"
//               ];
//               config.required_documents.push(
//                   { key: "main_form", label: "คำร้อง จท.41 (ขอขาดสอบกลางภาค)", required: true, validation_criteria: "ระบุหัวข้อชัดเจน" },
//                   { key: "reg_result", label: "ผลการลงทะเบียนเรียน", required: true, validation_criteria: "ต้องปรากฏวิชาที่ขาดสอบ" },
//                   { key: "schedule_exam", label: "ตารางสอบกลางภาคและปลายภาค", required: true, validation_criteria: "ไฮไลท์วิชาที่ขาดสอบ (หากเป็น TDF ให้ระบุวันเวลาให้ชัดเจน)" },
//                   { key: "evidence", label: "หลักฐานที่สนับสนุนเหตุผล", required: true, validation_criteria: "ต้องมีหลักฐานรับรองเหตุผลการขาดสอบอย่างเป็นรูปธรรม" }
//               );
//               break;

//           case 'review_midterm':
//               config.conditions.push("ไม่มีเงื่อนไขพิเศษ");
//               config.submission_steps = [
//                   "1. กรอก จท.41 ระบุว่า 'ขอทบทวนคะแนนสอบกลางภาค'",
//                   "2. นิสิตและอาจารย์ที่ปรึกษาลงนาม",
//                   "3. นำส่งที่ทะเบียนภาควิชาที่สังกัด"
//               ];
//               config.required_documents.push(
//                   { key: "main_form", label: "คำร้อง จท.41 (ขอทบทวนคะแนนสอบกลางภาค)", required: true, validation_criteria: "ระบุหัวข้อชัดเจน" }
//               );
//               break;

//           case 'sick_midterm':
//               config.conditions.push("ต้องยื่นคำร้องภายใน 5 วันทำการหลังจากที่ขาดสอบ");
//               config.submission_steps = [
//                   "1. กรอก จท.41 ระบุว่า 'ลาป่วยกลางภาค'",
//                   "2. นิสิตและอาจารย์ที่ปรึกษาลงนาม",
//                   "3. นำส่งที่ทะเบียนภาควิชาที่สังกัด"
//               ];
//               config.required_documents.push(
//                   { key: "main_form", label: "คำร้อง จท.41 (ลาป่วยกลางภาค)", required: true, validation_criteria: "ระบุหัวข้อชัดเจน" },
//                   { key: "reg_result", label: "ผลการลงทะเบียนเรียน", required: true, validation_criteria: "มีรายวิชาที่ขาดสอบ" },
//                   { key: "schedule_exam", label: "ตารางสอบกลางภาคทุกวิชา", required: true, validation_criteria: "ไฮไลท์วิชาที่ขาดสอบ (หากเป็น TDF ต้องระบุวันเวลาให้ชัดเจน)" },
//                   { key: "medical_cert", label: "ใบรับรองแพทย์", required: true, validation_criteria: "ระบุวันป่วยให้ชัดเจน ซึ่งต้องครอบคลุมวันที่ขาดสอบ" }
//               );
//               break;
          
//           case 'postpone_final':
//               config.conditions.push("ไม่มีเงื่อนไขพิเศษ");
//               config.submission_steps = [
//                   "1. กรอก จท.41 ระบุหัวข้อ 'ขอเลื่อนสอบปลายภาค'",
//                   "2. ให้อาจารย์ที่ปรึกษาลงนาม",
//                   "3. ให้อาจารย์ประจำรายวิชาลงนาม",
//                   "4. นำส่งที่ทะเบียนภาควิชาที่สังกัด"
//               ];
//               config.required_documents.push(
//                   { key: "main_form", label: "คำร้อง จท.41 (ขอเลื่อนสอบปลายภาค)", required: true, validation_criteria: "ระบุหัวข้อชัดเจน" },
//                   { key: "reg_result", label: "ผลการลงทะเบียนเรียน", required: true, validation_criteria: "มีรายวิชาที่ขอเลื่อนสอบ" },
//                   { key: "schedule_exam", label: "ตารางสอบปลายภาคทุกวิชา", required: true, validation_criteria: "ไฮไลท์วิชาที่เลื่อนสอบ (หากเป็น TDF ต้องระบุวันเวลาให้ชัดเจน)" },
//                   { key: "reason_doc", label: "เอกสารระบุเหตุผลประกอบ", required: true, validation_criteria: "เหตุผลสอดคล้องกับคำร้องที่ระบุ" }
//               );
//               break;
//       }
//       return config;
//   }
  
//   return null;
// };


// 1. รายชื่อภาควิชาและอีเมลติดต่อ
exports.departments = [
  // กลุ่มวิทยาศาสตร์กายภาพ
  { id: "math_ug", name_th: "คณิตศาสตร์ (ป.ตรี)", email: "supattra.u@chula.ac.th" },
  { id: "math_grad", name_th: "คณิตศาสตร์ (บัณฑิตศึกษา)", email: "supattra.u@chula.ac.th" },
  { id: "cs_all", name_th: "วิทยาการคอมพิวเตอร์ (ทุกระดับ)", email: "supattra.u@chula.ac.th" },
  { id: "chem_ug", name_th: "เคมี (ป.ตรี)", email: "pakakrong.p@chula.ac.th" },
  { id: "chem_grad", name_th: "เคมี (บัณฑิตศึกษา)", email: "thitirat.ph@chula.ac.th" },
  { id: "chem_bsac", name_th: "เคมี (นานาชาติ BSAC)", email: "bsac@chula.ac.th" },
  
  // กลุ่มวิทยาศาสตร์ชีวภาพ
  { id: "bio", name_th: "ชีววิทยา/สัตววิทยา", email: "biology.sc@chula.ac.th" },
  { id: "botany", name_th: "พฤกษศาสตร์/พันธุศาสตร์", email: "rawipha.p@chula.ac.th" },
  { id: "biochem", name_th: "ชีวเคมี", email: "sujitra2507@hotmail.com" },
  { id: "microbio", name_th: "จุลชีววิทยา", email: "trada.o@chula.ac.th" },

  // กลุ่มวิทยาศาสตร์ธรรมชาติ
  { id: "marine", name_th: "วิทยาศาสตร์ทางทะเล", email: "suthinee.a@chula.ac.th" },
  { id: "geo", name_th: "ธรณีวิทยา", email: "jongkolk2011@gmail.com" },
  { id: "envi_ug", name_th: "วิทยาศาสตร์สิ่งแวดล้อม (ป.ตรี)", email: "requestenvisci@gmail.com" },
  { id: "envi_grad", name_th: "วิทยาศาสตร์สิ่งแวดล้อม (บัณฑิตศึกษา)", email: "requestenvisci@gmail.com" },

  // กลุ่มวิทยาศาสตร์เทคโนโลยี
  { id: "chemtech", name_th: "เคมีเทคนิค", email: "watcharachai.c@chula.ac.th" },
  { id: "matsci", name_th: "วัสดุศาสตร์", email: "bhunditmee@gmail.com" },
  { id: "photo", name_th: "เทคโนโลยีทางภาพและการพิมพ์", email: "ekkarin.k@chula.ac.th" },
  { id: "food", name_th: "เทคโนโลยีทางอาหาร", email: "kamonwan.o@chula.ac.th" }
];

// 2. รายชื่อฟอร์มและ Sub-types ของ จท.41
exports.forms = [
  { form_code: "JT31", name_th: "จท.31 คำร้องขอลาออก", category: "Status", degree_level: ["bachelor", "graduate"] },
  { form_code: "JT32", name_th: "จท.32 คำร้องขอรักษาสถานภาพการเป็นนิสิต", category: "Status", degree_level: ["graduate"] },
  { form_code: "JT34", name_th: "จท.34 คำร้องขอคืนสถานภาพการเป็นนิสิต", category: "Status", degree_level: ["bachelor", "graduate"] },
  { form_code: "JT35", name_th: "จท.35 คำร้องขอทักท้วงผลการศึกษา", category: "Academic", degree_level: ["bachelor", "graduate"] },
  {
    form_code: "JT41",
    name_th: "จท.41 คำร้องทั่วไป",
    category: "General",
    has_sub_types: true,
    sub_categories: [
       { value: "late_reg", label: "ขอลงทะเบียนเรียนหลังกำหนด / เพิ่มรายวิชาหลังกำหนด" },
       { value: "change_section", label: "ขอเปลี่ยนตอนเรียนหลังกำหนด" },
       { value: "cross_faculty", label: "ขอลงทะเบียนเรียนข้ามคณะ" },
       { value: "credit_limit", label: "ขอลงทะเบียนเกิน/ต่ำกว่าจำนวนหน่วยกิตที่กำหนด" },
       { value: "more_than_two_gened", label: "ขอลงทะเบียนเรียนวิชาศึกษาทั่วไปมากกว่า 2 วิชา" },
       { value: "keep_midterm_score", label: "ขอสอบเก็บตัวกลางภาค (กรณีสอบชน)" },
       { value: "missing_midterm", label: "ขอขาดสอบกลางภาค (เหตุสุดวิสัย)" },
       { value: "sick_midterm", label: "ขอลาป่วยสำหรับการสอบกลางภาค" },
       { value: "leave_class", label: "ขอลาเรียน" },
       { value: "postpone_final", label: "ขอเลื่อนสอบปลายภาค" },
       { value: "review_score", label: "ขอทบทวนคะแนนสอบกลางภาค / ปลายภาค" },
       { value: "submit_english_score", label: "ขอส่งคะแนนภาษาอังกฤษ" },
       { value: "tuition_installment", label: "ขอผ่อนผันค่าเล่าเรียน" },
       { value: "transfer_course", label: "ขอเทียบโอนหน่วยกิต" },
       { value: "other", label: "เรื่องอื่นๆ (โปรดระบุในคำร้อง)" }
    ],
    degree_level: ["bachelor", "graduate"]
  },
  { form_code: "JT43", name_th: "จท.43 คำร้องขอลงทะเบียนเรียนเพื่อขอผล S/U หรือ V/W", category: "Academic", degree_level: ["bachelor", "graduate"] },
  { form_code: "JT44", name_th: "จท.44 คำร้องขอลาป่วย", category: "Academic", degree_level: ["bachelor", "graduate"] },
  { form_code: "JT48", name_th: "จท.48 คำร้องขอถอนรายวิชา (W)", category: "Academic", degree_level: ["bachelor", "graduate"] },
  { form_code: "JT49", name_th: "จท.49 คำร้องขอลาพักการศึกษา", category: "Status", degree_level: ["bachelor", "graduate"] },
  { form_code: "JT66", name_th: "จท.66 คำร้องขอยกเว้นรายวิชา", category: "Academic", degree_level: ["bachelor", "graduate"] },
  { form_code: "CF", name_th: "คำร้องขอ CF (Course Withdrawal with CF)", category: "Academic", degree_level: ["bachelor", "graduate"] }
];

// 3. Logic การตรวจสอบเอกสาร (Validation Criteria)
exports.getFormConfig = (formCode, degreeLevel, subType) => {
  
  // --- JT31: ลาออก ---
  if (formCode === 'JT31') {
    const config = {
      form_code: "JT31",
      degree_level: degreeLevel,
      conditions: ["นิสิตต้องไม่มีหนี้สินหรือภาระผูกพันค้างชำระกับทางมหาวิทยาลัย"],
      submission_location: "ทะเบียนภาควิชาที่สังกัด",
      submission_steps: [
          "1. กรอกแบบฟอร์ม จท.31 และจัดเตรียมเอกสารประกอบ",
          "2. ให้ผู้ปกครองลงนามในเอกสารยินยอม (เฉพาะปริญญาบัณฑิต)",
          "3. นิสิตลงนามในคำร้อง",
          "4. นำส่งที่ทะเบียนภาควิชาที่สังกัด (ภาควิชาจะดำเนินการส่งต่อให้ทะเบียนคณะ นิสิตไม่ต้องไปส่งที่คณะเอง)"
      ],
      required_documents: [
        { key: "main_form", label: "คำร้อง จท.31", required: true, validation_criteria: "ตรวจสอบว่าเป็นฟอร์ม จท.31 และมีการลงนามเรียบร้อย" },
        { key: "back_doc", label: "เอกสารประกอบ จท.31 ด้านหลังของคณะ", required: true, validation_criteria: "เอกสารแนบด้านหลังต้องครบถ้วน" }
      ]
    };
    if (degreeLevel === 'bachelor') {
      config.required_documents.push(
        { key: "parent_consent", label: "เอกสารยินยอมจากผู้ปกครอง", required: true, validation_criteria: "มีลายเซ็นผู้ปกครอง" },
        { key: "parent_id_card", label: "สำเนาบัตรประชาชนผู้ปกครอง", required: true, validation_criteria: "เห็นชื่อ-นามสกุลชัดเจน (พร้อมเซ็นรับรองสำเนาถูกต้อง)" }
      );
    }
    return config;
  }

  // --- JT32: ขอรักษาสถานภาพ (เฉพาะ Grad) ---
  if (formCode === 'JT32') {
    return {
      form_code: "JT32",
      conditions: [
          "เป็นนิสิตระดับบัณฑิตศึกษาเท่านั้น",
          "เป็นนิสิตที่ส่งเล่มวิทยานิพนธ์ฉบับสมบูรณ์เรียบร้อยแล้วและรอการตีพิมพ์"
      ],
      submission_location: "ทะเบียนภาควิชาที่สังกัด",
      submission_steps: [
          "1. หมายเหตุ: นิสิตต้องดำเนินการชำระเงินค่ารักษาสถานภาพในระบบของมหาวิทยาลัยให้เรียบร้อยก่อน",
          "2. กรอกข้อมูลในแบบฟอร์ม จท.32 และลงนาม",
          "3. นำไปให้อาจารย์ที่ปรึกษาลงนาม",
          "4. นำส่งที่ทะเบียนภาควิชาที่สังกัด (ภาควิชาจะดำเนินการส่งต่อให้ทะเบียนคณะต่อไป)"
      ],
      required_documents: [
        { key: "main_form", label: "คำร้อง จท.32", required: true, validation_criteria: "ตรวจสอบฟอร์มและลายเซ็นนิสิตและอาจารย์ที่ปรึกษา" },
        { key: "thesis_proof", label: "หลักฐานการส่งเล่มวิทยานิพนธ์", required: true, validation_criteria: "หลักฐานต้องระบุชัดเจนว่าได้ส่งเล่มวิทยานิพนธ์แล้ว" }
      ]
    };
  }

  // --- JT34: ขอคืนสถานภาพ ---
  if (formCode === 'JT34') {
    return {
      form_code: "JT34",
      conditions: ["นิสิตต้องชำระค่าธรรมเนียมการขอคืนสถานภาพ และค่าปรับ/ค่ารักษาสถานภาพตามเงื่อนไขมหาวิทยาลัย"],
      submission_location: "ทะเบียนภาควิชาที่สังกัด",
      submission_steps: [
          "1. กรอกแบบฟอร์ม จท.34 พร้อมจัดเตรียมเอกสารประกอบ",
          "2. ให้อาจารย์ที่ปรึกษาลงนาม",
          "3. นำส่งที่ทะเบียนภาควิชาที่สังกัด (ภาควิชาจะดำเนินการส่งต่อให้ทะเบียนคณะ นิสิตไม่ต้องไปส่งที่คณะเอง)"
      ],
      required_documents: [
        { key: "main_form", label: "คำร้อง จท.34", required: true, validation_criteria: "มีลายเซ็นนิสิตและอาจารย์ที่ปรึกษาครบถ้วน" },
        { key: "leave_doc", label: "เอกสารประกอบการลาพัก", required: true, validation_criteria: "เอกสารที่เกี่ยวข้องกับเหตุผลการขอคืนสถานภาพ" }
      ]
    };
  }

  // --- JT35: ทักท้วงผลการศึกษา ---
  if (formCode === 'JT35') {
    return {
      form_code: "JT35",
      conditions: [
          "ยื่นเฉพาะการทักท้วงเกรดปลายภาคเท่านั้น",
          "ต้องยื่นภายใน 30 วัน นับจากวันที่ประกาศผล"
      ],
      submission_location: "ทะเบียนภาควิชาที่สังกัด",
      submission_steps: [
          "1. กรอกแบบฟอร์ม จท.35",
          "2. ให้อาจารย์ที่ปรึกษาลงนามรับทราบ",
          "3. นำส่งที่ทะเบียนภาควิชาที่สังกัด (ภาควิชาจะดำเนินการส่งต่อให้ทะเบียนคณะ)"
      ],
      approval_requirements: [
        "อาจารย์ที่ปรึกษาลงนามรับทราบ",
        "ภาควิชารับคำร้องและส่งต่อให้ทะเบียนคณะ",
        "อาจารย์เจ้าของรายวิชาตรวจสอบและแจ้งผล"
      ],
      case_rules: [
        {
          key: "final_grade_review",
          label: "ทักท้วงเกรดปลายภาค",
          note: "ใช้กับการทักท้วงผลการศึกษาหลังประกาศเกรดปลายภาคภายใน 30 วัน"
        }
      ],
      post_submit_flow: [
        "ทะเบียนคณะเสนอคำร้องและลงนาม",
        "ทะเบียนคณะส่งออกคำสั่งไปยังสำนักงานการทะเบียนเพื่อระงับผลรายวิชาที่ทักท้วงเป็น X",
        "อาจารย์ประจำวิชาตรวจสอบผล ทำบันทึกชี้แจงและแนบหลักฐานส่งกลับที่ทะเบียนคณะ",
        "หากผลไม่เปลี่ยนแปลง ทะเบียนคณะแจ้งภาควิชาที่นิสิตสังกัด",
        "หากผลมีการเปลี่ยนแปลง จะนำเรื่องเข้าคณะกรรมการบริหารคณะเพื่อพิจารณาและดำเนินการส่งสำนักทะเบียน"
      ],
      required_documents: [
        { key: "main_form", label: "คำร้อง จท.35", required: true, url: "#", validation_criteria: "ระบุรายวิชาและเกรดที่ต้องการทักท้วงให้ชัดเจน" }
      ]
    };
  }

  // --- JT43: ขอ S/U หรือ V/W ---
  if (formCode === 'JT43') {
    const isGraduate = degreeLevel === 'graduate';
    return {
      form_code: "JT43",
      conditions: ["ต้องยื่นภายใน 2 สัปดาห์แรกของภาคการศึกษา", "ต้องลงทะเบียนเรียนในรายวิชานั้นสำเร็จแล้ว"],
      submission_location: "ทะเบียนภาควิชาที่สังกัด",
      submission_steps: isGraduate ? [
          "1. กรอกแบบฟอร์ม จท.43",
          "2. เสนอขอความเห็นและลงนามจากอาจารย์ที่ปรึกษา",
          "3. ผ่านที่ประชุมคณะกรรมการบริหารหลักสูตรหรือผู้มีอำนาจตามหลักสูตร",
          "4. นำส่งที่ทะเบียนภาควิชาที่สังกัดเพื่อส่งต่อให้ทะเบียนคณะ"
      ] : [
          "1. กรอกแบบฟอร์ม จท.43",
          "2. นำไปให้อาจารย์ที่ปรึกษา และอาจารย์ผู้สอนประจำวิชาลงนาม",
          "3. นำส่งที่ทะเบียนภาควิชาที่สังกัด (ภาควิชาจะดำเนินการส่งต่อให้ทะเบียนคณะ)"
      ],
      approval_requirements: isGraduate ? [
        "อาจารย์ที่ปรึกษาให้ความเห็น",
        "คณะกรรมการบริหารหลักสูตรหรือประธานหลักสูตรให้ความเห็นชอบ",
        "ทะเบียนคณะเสนออนุมัติและลงนาม"
      ] : [
        "อาจารย์ที่ปรึกษาลงนาม",
        "อาจารย์ผู้สอนประจำวิชาลงนาม",
        "ทะเบียนคณะเสนออนุมัติและลงนาม"
      ],
      post_submit_flow: [
        "ภาควิชาส่งคำร้องผ่านระบบ lesspaper มาที่ทะเบียนคณะ",
        "ทะเบียนคณะเสนออนุมัติและส่งออกคำร้องไปยังสำนักงานการทะเบียน"
      ],
      required_documents: [
        { key: "main_form", label: "คำร้อง จท.43", required: true, validation_criteria: "ตรวจสอบความสมบูรณ์ของแบบฟอร์ม" },
        { key: "cr54", label: "CR54 (ผลการลงทะเบียนเรียน)", required: true, validation_criteria: "ต้องปรากฏรายวิชาที่ต้องการขอผล S/U หรือ V/W" },
        { key: "reason_doc", label: "ใบแนบเหตุผลประจำรายวิชา", required: true, validation_criteria: "ระบุเหตุผลความจำเป็นอย่างชัดเจน" }
      ]
    };
  }

  // --- JT44: ลาป่วย ---
  if (formCode === 'JT44') {
    const isGraduate = degreeLevel === 'graduate';
    return {
      form_code: "JT44",
      conditions: ["ใช้สำหรับขาดสอบปลายภาคเท่านั้น", "ต้องส่งยื่นคำร้องภายใน 5 วันทำการนับจากวันที่ขาดสอบ"],
      submission_location: "ทะเบียนภาควิชาที่สังกัด",
      submission_steps: isGraduate ? [
          "1. กรอกแบบฟอร์ม จท.44 และเตรียมใบรับรองแพทย์/หลักฐาน",
          "2. เสนอความเห็นผ่านประธานคณะกรรมการบริหารหลักสูตร",
          "3. นำส่งที่ทะเบียนภาควิชาที่สังกัดเพื่อส่งต่อให้ทะเบียนคณะ"
      ] : [
          "1. กรอกแบบฟอร์ม จท.44 และเตรียมใบรับรองแพทย์",
          "2. ให้อาจารย์ที่ปรึกษา และอาจารย์ผู้สอนลงนามตามกรณี",
          "3. นำส่งที่ทะเบียนภาควิชาที่สังกัด (ภาควิชาจะดำเนินการส่งต่อให้ทะเบียนคณะ)"
      ],
      approval_requirements: isGraduate ? [
        "อาจารย์ที่ปรึกษาให้ความเห็น",
        "ประธานคณะกรรมการบริหารหลักสูตรลงนาม",
        "ทะเบียนคณะเสนออนุมัติและดำเนินการต่อ"
      ] : [
        "อาจารย์ที่ปรึกษาลงนาม",
        "อาจารย์ผู้สอนประจำวิชาลงนามเมื่อเป็นกรณีลาป่วยก่อนสอบ",
        "ภาควิชาและทะเบียนคณะดำเนินการส่งคำร้องต่อ"
      ],
      case_rules: [
        {
          key: "before_exam",
          label: "ลาป่วยก่อนสอบ",
          note: "ใช้เมื่อป่วยก่อนสิ้นภาคและยังป่วยต่อเนื่องจนถึงวันสอบ",
          approval_requirements: [
            "อาจารย์ที่ปรึกษาลงนาม",
            "อาจารย์ผู้สอนประจำวิชาลงนาม"
          ]
        },
        {
          key: "during_exam",
          label: "ลาป่วยระหว่างสอบ",
          note: "ใช้เมื่อป่วยระหว่างช่วงสอบและบางกรณีอาจไม่ต้องให้อาจารย์ผู้สอนลงนามตามแนวปฏิบัติ",
          approval_requirements: [
            "อาจารย์ที่ปรึกษาลงนาม",
            "แนบหลักฐานตามกรณีและให้ภาควิชาตรวจสอบต่อ"
          ]
        }
      ],
      post_submit_flow: [
        "ภาควิชาส่งคำร้องผ่านระบบ lesspaper มาที่ทะเบียนคณะ",
        "ทะเบียนคณะเสนอคำร้องและลงนาม",
        "ทะเบียนคณะส่งออกคำร้องไปยังสำนักงานการทะเบียนหรือภาควิชาที่เกี่ยวข้องตามกรณี"
      ],
      required_documents: [
        { key: "main_form", label: "คำร้อง จท.44", required: true, validation_criteria: "ฟอร์มถูกต้องและระบุวิชาที่ขาดสอบ" },
        { key: "schedule", label: "สำเนาตารางสอบรายบุคคล", required: true, validation_criteria: "ต้องไฮไลท์วิชาที่ขาดสอบ" },
        { key: "medical_cert", label: "ใบรับรองแพทย์ฉบับจริง", required: true, validation_criteria: "ระบุวันที่ให้หยุดพักรักษาตัว ซึ่งต้องครอบคลุมวันเวลาที่ขาดสอบ" }
      ]
    };
  }

  // --- JT48: ถอนรายวิชา (W) ---
  if (formCode === 'JT48') {
    const isGraduate = degreeLevel === 'graduate';
    return {
      form_code: "JT48",
      conditions: ["เป็นการขอถอนรายวิชาหลังกำหนด (ติด W)", "นิสิตต้องชำระค่าธรรมเนียมวิชาละ 300 บาท"],
      submission_location: "ทะเบียนภาควิชาที่สังกัด",
      submission_steps: isGraduate ? [
          "1. ชำระค่าถอนรายวิชาหลังกำหนดผ่านระบบที่มหาวิทยาลัยกำหนด",
          "2. กรอกแบบฟอร์ม จท.48 พร้อมระบุสาเหตุที่ถอนหลังกำหนด",
          "3. ให้อาจารย์ที่ปรึกษา และอาจารย์ประจำรายวิชาลงนาม",
          "4. นำส่งเอกสารที่ภาควิชาที่สังกัด เพื่อให้ภาควิชาส่งผ่านระบบ lesspaper มาที่ทะเบียนคณะ"
      ] : [
          "1. ชำระค่าถอนรายวิชาหลังกำหนดผ่านระบบที่มหาวิทยาลัยกำหนด",
          "2. กรอกแบบฟอร์ม จท.48",
          "3. ให้อาจารย์ที่ปรึกษา และอาจารย์ประจำรายวิชาลงนาม",
          "4. นำส่งเอกสารที่ภาควิชาที่สังกัด เพื่อให้ภาควิชาส่งผ่านระบบ lesspaper มาที่ทะเบียนคณะ"
      ],
      approval_requirements: [
        "อาจารย์ที่ปรึกษาลงนาม",
        "อาจารย์ประจำรายวิชาลงนาม",
        "ภาควิชาส่งคำร้องผ่านระบบ lesspaper",
        "ทะเบียนคณะเสนออนุมัติและลงนาม"
      ],
      required_fields_hint: ["reason"],
      post_submit_flow: [
        "ภาควิชาส่งคำร้องของนิสิตผ่าน lesspaper มาที่ทะเบียนคณะ",
        "ทะเบียนคณะเสนอนายทะเบียนคณะและคณบดีลงนาม",
        "ทะเบียนคณะส่งออกคำร้องไปยังสำนักงานการทะเบียน"
      ],
      required_documents: [
        { key: "main_form", label: "คำร้อง จท.48", required: true, validation_criteria: "ตรวจสอบฟอร์มและลายเซ็นให้ครบทั้ง 3 ส่วน" },
        { key: "reason", label: "เอกสารประกอบเหตุผลการถอน", required: true, validation_criteria: "อธิบายเหตุผลความจำเป็นที่ต้องถอนหลังกำหนด" }
      ]
    };
  }

  // --- JT49: ลาพักการศึกษา ---
  if (formCode === 'JT49') {
    return {
       form_code: "JT49",
       conditions: [
         "กรณีไม่ได้ลงทะเบียนเรียน ต้องชำระค่ารักษาสถานภาพการเป็นนิสิตและยื่นภายใน 2 สัปดาห์หลังเปิดภาคการศึกษา",
         "กรณีลงทะเบียนเรียนแล้ว ให้ยื่นก่อนสอบปลายภาค",
         "เหตุผลที่พิจารณาได้ เช่น ถูกเกณฑ์ทหาร, ทุนแลกเปลี่ยน, เจ็บป่วยต่อเนื่อง, ความจำเป็นส่วนตัว"
       ],
       submission_location: "ทะเบียนภาควิชาที่สังกัด",
       submission_steps: [
           "1. กรอกแบบฟอร์ม จท.49 และเตรียมหลักฐาน",
           "2. นิสิตและอาจารย์ที่ปรึกษาลงนามให้เรียบร้อย",
           "3. นำส่งที่ทะเบียนภาควิชาที่สังกัด (ภาควิชาจะดำเนินการส่งต่อให้ทะเบียนคณะ)"
       ],
       approval_requirements: [
         "อาจารย์ที่ปรึกษาลงนาม",
         "ภาควิชาส่งคำร้องผ่าน lesspaper มาที่ทะเบียนคณะ",
         "ทะเบียนคณะส่งออกคำร้องไปยังสำนักงานการทะเบียน"
       ],
       reason_examples: [
         "ถูกเกณฑ์ทหารหรือระดมเข้ารับราชการทหารกองประจำการ",
         "ได้รับทุนแลกเปลี่ยนหรือทุนศึกษาระหว่างประเทศ",
         "เจ็บป่วยจนต้องเข้ารักษาตัวต่อเนื่องเกินกว่า 20 วัน",
         "ความจำเป็นส่วนตัว"
       ],
       required_documents: [
         { key: "main_form", label: "คำร้อง จท.49", required: true, validation_criteria: "ตรวจสอบความถูกต้องของฟอร์ม" },
         { key: "evidence", label: "หลักฐานประกอบการขอลาพักการศึกษา", required: true, validation_criteria: "หลักฐานต้องสอดคล้องกับเหตุผล" }
       ]
    };
  }

  // --- JT66: ขอยกเว้นรายวิชา ---
  if (formCode === 'JT66') {
      const config = {
          form_code: "JT66",
          conditions: [
            "ต้องยื่นภายในภาคการศึกษาแรกที่เข้าศึกษา",
            "ผลการเรียนเดิมต้องไม่เกิน 5 ปีการศึกษาก่อนภาคการศึกษาที่ได้รับการประเมินผลของรายวิชานั้น",
            "ต้องได้รับผลการประเมินไม่ต่ำกว่า C, S หรือเกณฑ์เทียบเท่าที่หลักสูตรกำหนด",
            "รายวิชาที่ยกเว้นโดยทั่วไปต้องไม่เกิน 1 ใน 3 ของจำนวนหน่วยกิตรวมของรายวิชาในหลักสูตรที่กำลังศึกษา"
          ],
          submission_location: "ทะเบียนภาควิชาที่สังกัด",
          submission_steps: degreeLevel === 'graduate' ? [
              "1. กรอกแบบฟอร์ม จท.66",
              "2. แนบ transcript และเอกสารที่เกี่ยวข้อง",
              "3. เสนอความเห็นผ่านหลักสูตร/ภาควิชา",
              "4. นำส่งที่ทะเบียนภาควิชาเพื่อส่งต่อให้คณะ"
          ] : [
              "1. กรอกแบบฟอร์ม จท.66",
              "2. ให้อาจารย์ที่ปรึกษา และอาจารย์ประจำรายวิชาลงนาม",
              "3. นำส่งที่ทะเบียนภาควิชาที่สังกัด (ภาควิชาจะดำเนินการส่งต่อให้คณะ)"
          ],
          approval_requirements: degreeLevel === 'graduate' ? [
            "อาจารย์ที่ปรึกษาให้ความเห็น",
            "หลักสูตรหรือภาควิชาให้ความเห็นชอบ",
            "ทะเบียนคณะเสนอคณะกรรมการบริหารคณะและลงนาม"
          ] : [
            "อาจารย์ที่ปรึกษาลงนาม",
            "อาจารย์ประจำรายวิชาลงนาม",
            "ทะเบียนคณะเสนอคณะกรรมการบริหารคณะและคณบดีลงนาม"
          ],
          special_cases: [
            "นิสิตเปลี่ยนสาขาวิชา",
            "นิสิตเข้าศึกษาต่อเนื่องจากปริญญาตรีถึงปริญญาโท หรือปริญญาโทถึงปริญญาเอก",
            "นิสิตที่เคยเรียนระดับบัณฑิตศึกษาหรือรายวิชาบัณฑิตศึกษาของการศึกษานอกระบบหรือเทียบเท่า"
          ],
          required_documents: [
              { key: "main_form", label: "คำร้อง จท.66", required: true, validation_criteria: "แบบฟอร์มถูกต้องและมีลายเซ็นครบถ้วน" },
              { key: "transcript", label: "Transcript (ผลการศึกษาเดิม)", required: true, validation_criteria: "แสดงผลการเรียนวิชาที่นำมาขอยกเว้น" }
          ]
      };
      if (degreeLevel === 'bachelor') {
          config.required_documents.push(
              { key: "approval_memo", label: "บันทึกอนุญาตจากเจ้าของรายวิชา", required: false, validation_criteria: "จำเป็นเฉพาะกรณีที่รหัสวิชาเดิมและรหัสวิชาใหม่ไม่ตรงกัน" },
              { key: "course_syllabus", label: "คำอธิบายรายวิชา (Syllabus)", required: false, validation_criteria: "แนบกรณีขอยกเว้นจากต่างสถาบัน" }
          );
      }
      return config;
  }

  // --- CF: ขอ CF ---
  if (formCode === 'CF') {
      return {
          form_code: "CF",
          conditions: ["วิชานั้นต้องอนุญาตให้ทำการ CF ได้ ตามที่ระบุในระบบ Reg Chula"],
          submission_location: "ทะเบียนภาควิชาที่สังกัด",
          submission_steps: [
              "1. กรอกแบบฟอร์มคำร้องขอ CF",
              "2. ให้อาจารย์ที่ปรึกษา และอาจารย์ประจำรายวิชาลงนาม",
              "3. นำส่งที่ทะเบียนภาควิชาที่สังกัด"
          ],
          required_documents: [
              { key: "main_form", label: "คำร้องขอ CF", required: true, validation_criteria: "แบบฟอร์มถูกต้องและลายเซ็นครบถ้วน" },
              { key: "reg_page", label: "ภาพหน้าจอรายวิชาจากระบบ Reg", required: true, validation_criteria: "ต้องแสดงเงื่อนไขการอนุญาต CF" },
              { key: "reg_result", label: "ผลการลงทะเบียนเรียน (CR54)", required: true, validation_criteria: "ต้องปรากฏรายวิชานี้ในผลการลงทะเบียน" }
          ]
      };
  }

  // --- JT41: คำร้องทั่วไป (Complete Edition) ---
  if (formCode === 'JT41') {
      const config = {
        form_code: "JT41",
        sub_type: subType,
        conditions: [],
        submission_location: "ทะเบียนภาควิชาที่สังกัด",
        submission_steps: [
            "1. กรอกแบบฟอร์ม จท.41 พร้อมระบุความประสงค์ให้ชัดเจน",
            "2. ให้อาจารย์ที่ปรึกษาลงนาม",
            "3. นำส่งที่ทะเบียนภาควิชาที่สังกัด (ภาควิชาจะดำเนินการส่งต่อให้ทะเบียนคณะ)"
        ],
        approval_requirements: ["อาจารย์ที่ปรึกษาลงนาม", "ภาควิชารับคำร้องและส่งต่อให้ทะเบียนคณะ"],
        post_submit_flow: ["ภาควิชาส่งคำร้องผ่าน lesspaper มาที่ทะเบียนคณะ", "ทะเบียนคณะดำเนินการส่งต่อไปยังหน่วยงานที่เกี่ยวข้อง"],
        required_fields_hint: [],
        reason_examples: [],
        case_rules: [],
        attachment_template_required: false,
        attachment_template_label: null,
        required_documents: []
      };
      
      switch (subType) {
          case 'late_reg':
              config.conditions.push("ต้องส่งภายใน 2 สัปดาห์แรกของภาคการศึกษา");
              config.approval_requirements = [
                "อาจารย์ที่ปรึกษาลงนาม",
                "อาจารย์ประจำวิชาลงนาม",
                "หัวหน้าภาคลงนาม",
                "ภาควิชาส่งคำร้องผ่าน lesspaper มาที่ทะเบียนคณะ"
              ];
              config.required_fields_hint = ["reason", "course_code", "course_name"];
              config.attachment_template_required = true;
              config.attachment_template_label = "เอกสารแนบการลงทะเบียนหลังกำหนด";
              config.required_documents.push(
                  { key: "main_form", label: "คำร้อง จท.41 (ขอลงทะเบียนหลังกำหนด)", required: true, validation_criteria: "ระบุหัวข้อและรายวิชาให้ชัดเจน" },
                  { key: "faculty_doc", label: "เอกสารแนบจากคณะ", required: true, validation_criteria: "แนบใบคำร้องคณะที่เกี่ยวข้อง" },
                  // 🔧 เพิ่ม CR54 สำหรับการเพิ่ม/ลงทะเบียนหลังกำหนด
                  { key: "cr54", label: "CR54", required: false, validation_criteria: "ผลการลงทะเบียนล่าสุด" }
              );
              break;

          case 'change_section':
              config.approval_requirements = [
                "อาจารย์ผู้สอนตอนเดิมลงนาม",
                "อาจารย์ผู้สอนตอนใหม่ลงนาม",
                "อาจารย์ที่ปรึกษาลงนาม"
              ];
              config.required_fields_hint = ["reason"];
              config.attachment_template_required = true;
              config.attachment_template_label = "ใบแนบขอเปลี่ยนตอนเรียน";
              config.required_documents.push(
                  { key: "main_form", label: "คำร้อง จท.41 (ขอเปลี่ยนตอนเรียน)", required: true, validation_criteria: "ต้องมีลายเซ็นอาจารย์ผู้สอนทั้งตอนเรียนเดิมและตอนเรียนใหม่" },
                  { key: "cr54", label: "CR54", required: true, validation_criteria: "ผลการลงทะเบียนล่าสุด" }
              );
              break;

          case 'cross_faculty':
              config.approval_requirements = [
                "อาจารย์ที่ปรึกษาลงนาม",
                "คณะเจ้าของวิชาให้ความยินยอม",
                "ภาควิชาส่งคำร้องผ่าน lesspaper"
              ];
              config.required_documents.push(
                  { key: "main_form", label: "คำร้อง จท.41 (ขอลงทะเบียนข้ามคณะ)", required: true, validation_criteria: "ระบุวิชาและคณะที่ต้องการไปเรียน" },
                  { key: "faculty_approval", label: "หลักฐานการยินยอมจากคณะเจ้าของวิชา", required: true, validation_criteria: "เช่น อีเมลอนุมัติจากอาจารย์ผู้สอน" },
                  // 🔧 เพิ่ม CR54 สำหรับลงทะเบียนข้ามคณะ
                  { key: "cr54", label: "CR54", required: true, validation_criteria: "ผลการลงทะเบียนล่าสุด" }
              );
              break;

          case 'credit_limit':
              config.conditions.push(
                "นิสิตชั้นปีที่ 1 ภาคการศึกษาแรกไม่อนุญาต",
                "นิสิตชั้นปีที่ 2 - 3 ควรมี GPAX ตั้งแต่ 3.25 ขึ้นไป",
                "นิสิตชั้นปีที่ 4 พิจารณาตามเหตุจำเป็นเป็นกรณีพิเศษ"
              );
              config.approval_requirements = [
                "อาจารย์ที่ปรึกษาลงนาม",
                "ภาควิชาพิจารณา",
                "ทะเบียนคณะรับคำร้องต่อ"
              ];
              config.required_fields_hint = ["reason"];
              config.required_documents.push(
                  { key: "main_form", label: "คำร้อง จท.41 (ขอลงทะเบียนเกิน/ต่ำกว่าเกณฑ์)", required: true, validation_criteria: "ระบุเหตุผลความจำเป็น" },
                  { key: "transcript", label: "Transcript", required: true, validation_criteria: "เพื่อประกอบการพิจารณา GPAX" },
                  // 🔧 เพิ่ม CR54
                  { key: "cr54", label: "CR54", required: true, validation_criteria: "ผลการลงทะเบียนล่าสุด" }
              );
              break;

          case 'more_than_two_gened':
              config.conditions.push("ใช้สำหรับขอลงทะเบียนเรียนวิชาศึกษาทั่วไปมากกว่า 2 วิชา");
              config.approval_requirements = [
                "อาจารย์ที่ปรึกษาลงนาม",
                "อาจารย์ผู้สอนหรือหน่วยงานที่เกี่ยวข้องให้ความเห็น",
                "ภาควิชาส่งคำร้องผ่าน lesspaper มาที่ทะเบียนคณะ"
              ];
              config.attachment_template_required = true;
              config.attachment_template_label = "ใบแนบลงทะเบียนวิชาศึกษาทั่วไปมากกว่า 2 วิชา";
              config.required_fields_hint = ["reason", "course_table"];
              config.required_documents.push(
                  { key: "main_form", label: "คำร้อง จท.41 (ขอลงทะเบียนวิชาศึกษาทั่วไปมากกว่า 2 วิชา)", required: true, validation_criteria: "ระบุความประสงค์และเหตุผลให้ชัดเจน" },
                  { key: "attachment_form", label: "เอกสารแนบตารางรายวิชา", required: true, validation_criteria: "กรอกรายวิชาในตารางให้ครบถ้วน" }
              );
              break;

          case 'keep_midterm_score':
              config.conditions.push("วิชาบังคับชนบังคับ (ทุกปี), วิชาเลือกชนเลือก (เฉพาะปี 4)");
              config.approval_requirements = [
                "อาจารย์ที่ปรึกษาแสดงความเห็นชอบ",
                // "หัวหน้าภาควิชาลงนาม",
                "อาจารย์ผู้สอนลงนาม",
                "หากมีผู้คุมสอบแทน ต้องระบุชื่อผู้ได้รับมอบหมาย"
              ];
              config.required_documents.push(
                  { key: "main_form", label: "คำร้อง จท.41 (ขอสอบเก็บตัวกลางภาค)", required: true, validation_criteria: "ระบุหัวข้อชัดเจน" },
                  { key: "schedule_class", label: "ตารางเรียนส่วนบุคคล", required: true, validation_criteria: "แสดงรายวิชาที่เวลาชนกัน" },
                  { key: "schedule_exam", label: "ตารางสอบรายบุคคล", required: true, validation_criteria: "ระบุวันสอบกลางภาคและปลายภาค" }
              );
              break;

          case 'missing_midterm':
              config.approval_requirements = [
                "อาจารย์ที่ปรึกษาลงนาม",
                "อาจารย์ผู้สอนประจำวิชาลงนาม",
                "หัวหน้าภาคหรือประธานหลักสูตรลงนาม"
              ];
              config.required_fields_hint = ["reason"];
              config.required_documents.push(
                  { key: "main_form", label: "คำร้อง จท.41 (ขอขาดสอบกลางภาค)", required: true, validation_criteria: "ระบุหัวข้อชัดเจน" },
                  { key: "evidence", label: "หลักฐานเหตุสุดวิสัย", required: true, validation_criteria: "หลักฐานรับรองเหตุผลการขาดสอบที่เป็นรูปธรรม" },
                  { key: "cr54", label: "ผลการลงทะเบียนเรียนหรือวันเวลาสอบ", required: true, validation_criteria: "ต้องระบุวันเวลาสอบของรายวิชาที่ขาดสอบ" }
              );
              break;

          case 'sick_midterm':
              config.conditions.push("ต้องยื่นคำร้องภายใน 5 วันทำการหลังจากที่ขาดสอบ");
              config.approval_requirements = [
                "อาจารย์ที่ปรึกษาลงนาม",
                "อาจารย์ผู้สอนหรือภาควิชาตรวจสอบตามกรณี",
                "ภาควิชาส่งคำร้องผ่าน lesspaper"
              ];
              config.post_submit_flow = [
                "ภาควิชาส่งคำร้องผ่านระบบ lesspaper มาที่ทะเบียนคณะ",
                "ทะเบียนคณะเสนอคำร้องให้คณะกรรมการหรือหน่วยงานที่เกี่ยวข้องพิจารณาต่อ",
                "ส่งผลการพิจารณากลับภาควิชาที่เกี่ยวข้อง"
              ];
              config.required_documents.push(
                  { key: "main_form", label: "คำร้อง จท.41 (ลาป่วยกลางภาค)", required: true, validation_criteria: "ระบุหัวข้อชัดเจน" },
                  { key: "medical_cert", label: "ใบรับรองแพทย์ฉบับจริง", required: true, validation_criteria: "ระบุวันป่วยครอบคลุมวันที่ขาดสอบ" },
                  { key: "cr54", label: "CR54 พร้อมวันเวลาสอบ", required: true, validation_criteria: "ต้องระบุวันเวลาสอบกลางภาคของรายวิชาที่ขาดสอบ" }
              );
              break;

          case 'leave_class':
              config.approval_requirements = [
                "อาจารย์ที่ปรึกษาลงนาม",
                "อาจารย์ผู้สอนหรือหัวหน้าภาคให้ความเห็นตามกรณี"
              ];
              config.required_documents.push(
                  { key: "main_form", label: "คำร้อง จท.41 (ขอลาเรียน)", required: true, validation_criteria: "ระบุรายวิชาและช่วงเวลาที่ต้องการลาเรียนให้ชัดเจน" },
                  { key: "supporting_doc", label: "เอกสารประกอบการลาเรียน", required: true, validation_criteria: "เอกสารต้องสอดคล้องกับเหตุผลที่ขอลาเรียน" }
              );
              break;
          
          case 'postpone_final':
              config.approval_requirements = [
                "อาจารย์ที่ปรึกษาลงนาม",
                "อาจารย์ประจำวิชาลงนาม",
                "หัวหน้าภาคหรือประธานหลักสูตรลงนาม"
              ];
              config.required_fields_hint = ["course_code", "course_name", "section", "exam_datetime"];
              config.required_documents.push(
                  { key: "main_form", label: "คำร้อง จท.41 (ขอเลื่อนสอบปลายภาค)", required: true, validation_criteria: "ต้องให้อาจารย์ประจำรายวิชาลงนามด้วย" },
                  { key: "reason_doc", label: "เอกสารระบุเหตุผลประกอบ", required: true, validation_criteria: "เหตุผลสอดคล้องกับคำร้อง" }
              );
              break;
              
          case 'review_score':
              config.case_rules = [
                {
                  key: "midterm_review",
                  label: "ขอทบทวนคะแนนสอบกลางภาค",
                  note: "ใช้เมื่อประสงค์ขอทบทวนคะแนนสอบกลางภาค"
                },
                {
                  key: "final_review",
                  label: "ขอทบทวนคะแนนสอบปลายภาค",
                  note: "ใช้เมื่อประสงค์ขอทบทวนคะแนนสอบปลายภาค"
                }
              ];
              config.post_submit_flow = [
                "ทะเบียนคณะเสนอคำร้องและลงนาม",
                "ส่งคำร้องให้อาจารย์เจ้าของรายวิชาตรวจสอบคะแนน",
                "อาจารย์แจ้งผลกลับพร้อมบันทึกชี้แจง"
              ];
              config.required_documents.push(
                  { key: "main_form", label: "คำร้อง จท.41 (ขอทบทวนคะแนนสอบ)", required: true, validation_criteria: "ระบุวิชาและคะแนนที่ต้องการทบทวน" }
              );
              break;

          case 'submit_english_score':
              config.conditions.push(
                "นิสิตต้องยื่นคะแนนภาษาอังกฤษอย่างใดอย่างหนึ่งก่อนสำเร็จการศึกษา"
              );
              config.approval_requirements = [
                "อาจารย์ที่ปรึกษาลงนาม",
                "ภาควิชาหรือหลักสูตรตรวจสอบเอกสารและลงนาม",
                "ทะเบียนคณะจัดเก็บและดำเนินการต่อ"
              ];
              config.required_documents.push(
                  { key: "main_form", label: "คำร้อง จท.41 (ขอส่งคะแนนภาษาอังกฤษ)", required: true, validation_criteria: "ระบุประเภทผลสอบและคะแนนให้ชัดเจน" },
                  { key: "english_score_report", label: "สำเนาผลสอบภาษาอังกฤษ", required: true, validation_criteria: "ต้องเห็นคะแนนและชื่อผู้สอบชัดเจน" }
              );
              break;
              
          case 'tuition_installment':
              config.conditions.push("ส่งทะเบียนคณะไม่เกินสัปดาห์ที่ 2 ของภาคการศึกษา");
              config.approval_requirements = [
                "อาจารย์ที่ปรึกษาลงนาม",
                "ภาควิชาพิจารณาและส่งต่อทะเบียนคณะ"
              ];
              config.required_fields_hint = ["reason", "planned_payment_date"];
              config.required_documents.push(
                  { key: "main_form", label: "คำร้อง จท.41 (ขอผ่อนผันค่าเล่าเรียน)", required: true, validation_criteria: "ระบุหัวข้อชัดเจน" }
              );
              break;

          case 'transfer_course':
              config.required_documents.push(
                  { key: "main_form", label: "คำร้อง จท.41 (ขอเทียบโอนหน่วยกิต)", required: true, validation_criteria: "ระบุวิชาต้นทางและปลายทางชัดเจน" },
                  { key: "transcript", label: "Transcript เดิม", required: true, validation_criteria: "จากสถาบัน/หลักสูตรเดิม" },
                  { key: "course_syllabus", label: "Syllabus วิชาต้นทาง", required: true, validation_criteria: "เพื่อใช้พิจารณาเนื้อหา" }
              );
              break;

          case 'other':
              config.required_documents.push(
                  { key: "main_form", label: "คำร้อง จท.41 (เรื่องอื่นๆ)", required: true, validation_criteria: "ระบุรายละเอียดความประสงค์ให้ชัดเจน" },
                  { key: "other_doc", label: "เอกสารประกอบ (ถ้ามี)", required: false, validation_criteria: "เอกสารที่สนับสนุนคำร้อง" }
              );
              break;
      }
      return config;
  }
  
  return null;
};
