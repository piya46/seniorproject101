const academicCalendarByYear = {
  2568: {
    academic_year: 2568,
    system: 'semester',
    source: 'https://www.reg.chula.ac.th/th/wp-content/uploads/sites/4/2025/04/Start_EndDates_T-Sem2568.pdf',
    updated_at: '2026-04-09',
    notes: 'อ้างอิงคำสั่งจุฬาลงกรณ์มหาวิทยาลัย เรื่องกำหนดวันเปิด-ปิดภาคการศึกษา ระบบทวิภาค ปีการศึกษา 2568',
    terms: [
      {
        term_code: 'semester_1',
        label_th: 'ภาคต้น',
        start_date: '2025-08-04',
        end_date: '2025-12-09',
        periods: {
          midterm: { start_date: '2025-09-22', end_date: '2025-09-26' },
          final: { start_date: '2025-11-24', end_date: '2025-12-08' }
        }
      },
      {
        term_code: 'semester_2',
        label_th: 'ภาคปลาย',
        start_date: '2026-01-05',
        end_date: '2026-05-13',
        periods: {
          midterm: { start_date: '2026-02-23', end_date: '2026-02-27' },
          final: { start_date: '2026-04-27', end_date: '2026-05-12' }
        }
      },
      {
        term_code: 'summer',
        label_th: 'ภาคฤดูร้อน',
        start_date: '2026-06-02',
        end_date: '2026-07-18',
        periods: {
          final: { start_date: '2026-07-17', end_date: '2026-07-17' }
        }
      }
    ]
  },
  2569: {
    academic_year: 2569,
    system: 'semester',
    source: 'https://www.reg.chula.ac.th/th/wp-content/uploads/sites/4/2026/02/StartEndDates2569_SEM_Thai.pdf',
    updated_at: '2026-04-09',
    notes: 'อ้างอิงคำสั่งจุฬาลงกรณ์มหาวิทยาลัย เรื่องกำหนดวันเปิด-ปิดภาคการศึกษา ระบบทวิภาค ปีการศึกษา 2569',
    terms: [
      {
        term_code: 'semester_1',
        label_th: 'ภาคต้น',
        start_date: '2026-08-03',
        end_date: '2026-12-05',
        periods: {
          midterm: { start_date: '2026-09-21', end_date: '2026-09-25' },
          final: { start_date: '2026-11-23', end_date: '2026-12-04' }
        }
      },
      {
        term_code: 'semester_2',
        label_th: 'ภาคปลาย',
        start_date: '2027-01-04',
        end_date: '2027-05-12',
        periods: {
          midterm: { start_date: '2027-02-23', end_date: '2027-03-01' },
          final: { start_date: '2027-04-26', end_date: '2027-05-11' }
        }
      },
      {
        term_code: 'summer',
        label_th: 'ภาคฤดูร้อน',
        start_date: '2027-05-31',
        end_date: '2027-07-17',
        periods: {
          final: { start_date: '2027-07-16', end_date: '2027-07-16' }
        }
      }
    ]
  }
};

const normalizeAcademicYear = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const cloneCalendar = (calendar) => {
  if (!calendar) {
    return null;
  }

  return JSON.parse(JSON.stringify(calendar));
};

const getAcademicCalendar = (academicYear) => {
  const normalizedYear = normalizeAcademicYear(academicYear);
  if (!normalizedYear) {
    return null;
  }

  const calendar = academicCalendarByYear[normalizedYear];
  return cloneCalendar(calendar);
};

const resolveAcademicCalendarContext = ({
  academicYear,
  explicitCalendarContext = null
} = {}) => {
  if (explicitCalendarContext && typeof explicitCalendarContext === 'object') {
    return explicitCalendarContext;
  }

  return getAcademicCalendar(academicYear);
};

module.exports = {
  academicCalendarByYear,
  normalizeAcademicYear,
  getAcademicCalendar,
  resolveAcademicCalendarContext
};
