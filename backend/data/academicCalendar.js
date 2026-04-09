const academicCalendarByYear = {
  /**
   * เติมข้อมูลปฏิทินการศึกษาตามประกาศสำนักทะเบียนปีต่อปีในรูปแบบนี้
   *
   * 2568: {
   *   academic_year: 2568,
   *   source: 'ประกาศสำนักทะเบียน ...',
   *   updated_at: '2026-04-09',
   *   terms: [
   *     {
   *       term_code: 'semester_1',
   *       label_th: 'ภาคต้น',
   *       start_date: '2025-08-01',
   *       end_date: '2025-12-01',
   *       periods: {
   *         registration: { start_date: '2025-07-20', end_date: '2025-08-15' },
   *         midterm: { start_date: '2025-09-20', end_date: '2025-09-30' },
   *         final: { start_date: '2025-11-20', end_date: '2025-12-01' }
   *       }
   *     }
   *   ]
   * }
   */
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
