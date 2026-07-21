-- جدول معلمان (برای اطمینان از سازگاری با سیستم فعلی)
CREATE TABLE IF NOT EXISTS teachers (
  username TEXT PRIMARY KEY,
  password TEXT,
  fullname TEXT,
  role TEXT DEFAULT 'teacher',
  email TEXT
);

-- جدول آزمون‌ها
CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  teacher_id TEXT,
  title TEXT,
  duration INTEGER,
  no_going_back INTEGER DEFAULT 0,
  created_at TEXT
);

-- جدول سوالات
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  exam_id TEXT,
  question_text TEXT,
  type TEXT,
  options TEXT,
  correct_option TEXT,
  mark INTEGER DEFAULT 1,
  section TEXT
);

-- جدول پاسخ‌ها (مهم‌ترین بخش برای رفع محدودیت Write)
CREATE TABLE IF NOT EXISTS answers (
  id TEXT PRIMARY KEY,
  student_id TEXT,
  exam_id TEXT,
  question_id TEXT,
  selected_option TEXT,
  awarded_mark REAL,
  is_correct INTEGER,
  time_taken INTEGER,
  answered_at TEXT
);

-- ایندکس‌ها برای سرعت بالا در جستجو و گزارش‌گیری
CREATE INDEX IF NOT EXISTS idx_answers_student ON answers(student_id);
CREATE INDEX IF NOT EXISTS idx_answers_exam ON answers(exam_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
