import React from "react";
import Navbar from './Navbar';
import Footer from './Footer';

const highlights = [
  {
    title: 'ค้นหาแบบคำร้องที่เหมาะสมได้เร็วขึ้น',
    description:
      'นิสิตสามารถเลือกตามระดับการศึกษาและค้นหาแบบคำร้องที่เกี่ยวข้องได้จากที่เดียวกัน ลดเวลาการไล่หาเอกสารจากหลายแหล่ง'
  },
  {
    title: 'ช่วยทำความเข้าใจข้อมูลก่อนยื่นคำร้อง',
    description:
      'ระบบรวบรวมรายละเอียดที่จำเป็นของแบบคำร้องแต่ละรายการ เพื่อช่วยให้นิสิตเห็นภาพรวมของข้อมูลและเอกสารที่ต้องเตรียม'
  },
  {
    title: 'มีผู้ช่วยแนะนำสำหรับการยื่นคำร้อง',
    description:
      'นิสิตสามารถถามคำถามเบื้องต้นเกี่ยวกับการยื่นคำร้องผ่านระบบแชต AI เพื่อช่วยตัดสินใจว่าควรเริ่มจากแบบคำร้องใด'
  }
];

const workflow = [
  'เลือกระดับการศึกษาที่ต้องการใช้งาน',
  'ค้นหาแบบคำร้องที่ตรงกับเรื่องที่ต้องการดำเนินการ',
  'อ่านรายละเอียดและข้อมูลประกอบที่ระบบแสดง',
  'ใช้คำแนะนำจากระบบเพื่อเตรียมข้อมูลหรือเอกสารให้ครบมากขึ้น',
  'ตรวจสอบความถูกต้องอีกครั้งก่อนนำไปใช้งานจริง'
];

const notes = [
  'Form Check เป็นเครื่องมือช่วยค้นหาและเตรียมความพร้อมของข้อมูล ไม่ใช่ช่องทางยื่นคำร้องอย่างเป็นทางการ',
  'คำแนะนำจากระบบมีไว้เพื่อช่วยสรุปและจัดระเบียบข้อมูล นิสิตควรตรวจสอบรายละเอียดหรือข้อกำหนดล่าสุดก่อนใช้งานจริง',
  'หากพบข้อมูลไม่ครบถ้วนหรือการทำงานผิดปกติ สามารถแจ้งปัญหาผ่านหน้า "แจ้งปัญหา" ได้'
];

function Aboutus() {
  return (
    <div className="page-shell bg-[#FCF8F3]">
      <Navbar />

      <main className="page-gutter content-reading flex-grow py-10 sm:py-14">
        <section className="overflow-hidden rounded-[32px] border border-[#E9DCCB] bg-white shadow-[0_20px_60px_rgba(123,84,47,0.08)]">
          <div className="bg-[linear-gradient(135deg,#FFF7EE_0%,#F7E5CF_55%,#F3D1A8_100%)] px-6 py-10 sm:px-10 sm:py-14">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A36A35]">
              About Form Check
            </p>
            <h1 className="mt-3 max-w-3xl text-[32px] font-extrabold leading-tight text-[#6F4722] sm:text-[42px]">
              ระบบช่วยค้นหา ทำความเข้าใจ และเตรียมความพร้อมก่อนยื่นคำร้อง
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-[#6B6258] sm:text-lg">
              Form Check ถูกออกแบบมาเพื่อช่วยให้นิสิตเข้าถึงข้อมูลเกี่ยวกับแบบคำร้องได้ง่ายขึ้น
              ลดความสับสนระหว่างการค้นหาเอกสาร และช่วยให้คำแนะนำว่าควรเตรียมข้อมูลและเอกสารอะไรบ้างก่อนเริ่มดำเนินการ
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-white/70 bg-white/75 p-5 backdrop-blur">
                <p className="text-sm font-semibold text-[#A36A35]">จุดประสงค์หลัก</p>
                <p className="mt-2 text-sm leading-7 text-[#5F5346]">
                  ช่วยให้นิสิตเข้าถึงข้อมูลแบบคำร้องได้เร็วขึ้นและเข้าใจกระบวนการเบื้องต้นก่อนยื่นคำร้องจริง
                </p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/75 p-5 backdrop-blur">
                <p className="text-sm font-semibold text-[#A36A35]">สิ่งที่ระบบช่วยได้</p>
                <p className="mt-2 text-sm leading-7 text-[#5F5346]">
                  ค้นหาแบบคำร้อง แนะนำข้อมูลเบื้องต้น และช่วยจัดระเบียบความเข้าใจเกี่ยวกับเอกสารที่เกี่ยวข้อง
                </p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/75 p-5 backdrop-blur">
                <p className="text-sm font-semibold text-[#A36A35]">ข้อควรทราบ</p>
                <p className="mt-2 text-sm leading-7 text-[#5F5346]">
                  นิสิตควรตรวจสอบรายละเอียดกับข้อกำหนดล่าสุดของการยื่นคำร้องอีกครั้งก่อนนำเอกสารไปยื่นจริง
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-10 sm:px-10 sm:py-12">
            <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#A36A35]">
                  ระบบของเราทำอะไร
                </p>
                <h2 className="mt-3 text-[28px] font-extrabold text-[#7B542F]">
                  อธิบายงานเอกสารให้เข้าใจง่ายขึ้นในจุดที่นิสิตมักติดขัด
                </h2>
                <p className="mt-4 text-[15px] leading-8 text-[#5F5346]">
                  หลายครั้งนิสิตไม่ได้ติดปัญหาที่การกรอกเอกสารเพียงอย่างเดียว แต่เริ่มตั้งแต่ไม่แน่ใจว่าต้องใช้แบบคำร้องใด
                  ต้องเตรียมอะไรบ้าง หรือควรเริ่มต้นจากตรงไหน Form Check จึงถูกสร้างขึ้นมาเพื่อช่วยลดภาระในขั้นตอนเหล่านี้
                  โดยเน้นการเข้าถึงข้อมูลที่เกี่ยวข้องอย่างเป็นระบบและใช้งานง่าย
                </p>
                <p className="mt-4 text-[15px] leading-8 text-[#5F5346]">
                  ระบบผสานการค้นหาแบบคำร้อง ข้อมูลประกอบ และผู้ช่วยตอบคำถามเบื้องต้นไว้ในที่เดียว
                  เพื่อให้นิสิตสามารถสำรวจตัวเลือก ทำความเข้าใจขั้นตอน และเตรียมข้อมูลได้อย่างมั่นใจก่อนดำเนินการยื่นคำร้องจริง
                </p>
              </div>

              <div className="rounded-[28px] border border-[#E9DCCB] bg-[#FFF8F1] p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#A36A35]">
                  การทำงานโดยย่อ
                </p>
                <ol className="mt-4 space-y-4">
                  {workflow.map((step, index) => (
                    <li key={step} className="flex items-start gap-4">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#7B542F] text-sm font-bold text-white">
                        {index + 1}
                      </span>
                      <p className="pt-1 text-sm leading-7 text-[#5F5346]">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="mt-12">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#A36A35]">
                ความสามารถหลัก
              </p>
              <div className="mt-5 grid gap-5 md:grid-cols-3">
                {highlights.map((item, index) => (
                  <article
                    key={item.title}
                    className="rounded-[28px] border border-[#E9DCCB] bg-[#FFFCF8] p-6 shadow-sm"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F4DEC2] text-lg font-extrabold text-[#7B542F]">
                      {index + 1}
                    </div>
                    <h3 className="mt-4 text-lg font-extrabold text-[#7B542F]">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[#5F5346]">
                      {item.description}
                    </p>
                  </article>
                ))}
              </div>
            </div>

            <div className="mt-12 rounded-[28px] border border-[#E9DCCB] bg-[#7B542F] px-6 py-7 text-white sm:px-8">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F5D8B5]">
                สิ่งที่อยากให้ผู้ใช้รู้
              </p>
              <div className="mt-4 space-y-3">
                {notes.map((note) => (
                  <p key={note} className="rounded-2xl bg-white/10 px-4 py-4 text-sm leading-7 text-[#FFF5EA]">
                    {note}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default Aboutus;