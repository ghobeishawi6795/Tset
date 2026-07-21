CREATE TABLE IF NOT EXISTS teachers (
  username TEXT PRIMARY KEY,
  password TEXT,
  fullname TEXT,
  role TEXT DEFAULT 'teacher',
  email TEXT
);

CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  teacher_id TEXT,
  title TEXT,
  duration INTEGER,
  no_going_back INTEGER DEFAULT 0,
  created_at TEXT
);

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

CREATE INDEX IF NOT EXISTS idx_answers_student ON answers(student_id);
CREATE INDEX IF NOT EXISTS idx_answers_exam ON answers(exam_id);
