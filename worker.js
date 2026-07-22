/* ---------------------------------------------------------
   آزمون‌ساز معلم — Worker backend
   © ghobeishawi - All rights reserved.
---------------------------------------------------------- */

// ==========================================
// توابع کمکی
// ==========================================
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function uid() {
  // ترکیب timestamp (پایه ۳۶) + رشته تصادفی برای کاهش شدید احتمال تکرار
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

function getKV(env) {
  return env.KV || env.Kv || env.kv;
}

// ==========================================
// مدیریت KV (برای معلمان و تنظیمات)
// ==========================================
async function handleKV(request, env) {
  const kv = getKV(env);
  if (!kv) return json({ error: "KV binding missing" }, 500);
  const url = new URL(request.url);

  if (request.method === "GET") {
    const key = url.searchParams.get("key");
    if (!key) return json({ error: "key required" }, 400);
    const raw = await kv.get(key);
    if (raw === null) return json({ error: "not found" }, 404);
    return json({ v: JSON.parse(raw) });
  }

  if (request.method === "POST") {
    const body = await request.json();
    const { k, v } = body || {};
    if (!k) return json({ error: "k required" }, 400);
    await kv.put(k, JSON.stringify(v));
    return json({ ok: true });
  }

  if (request.method === "DELETE") {
    const key = url.searchParams.get("key");
    if (!key) return json({ error: "key required" }, 400);
    await kv.delete(key);
    return json({ ok: true });
  }

  return json({ error: "method not allowed" }, 405);
}

async function handleList(request, env) {
  const kv = getKV(env);
  if (!kv) return json({ error: "KV binding missing" }, 500);
  const url = new URL(request.url);
  const prefix = url.searchParams.get("prefix") || "";
  const keys = [];
  let cursor;
  do {
    const res = await kv.list({ prefix, cursor });
    keys.push(...res.keys.map((k) => k.name));
    cursor = res.list_complete ? null : res.cursor;
  } while (cursor);
  return json({ keys });
}

async function handleForgotPassword(request, env) {
  const kv = getKV(env);
  if (!kv) return json({ error: "KV binding missing" }, 500);
  const { username } = await request.json();
  const uname = (username || "").trim();
  if (!uname) return json({ ok: true }); // پاسخ عمومی، حتی برای ورودی خالی

  const raw = await kv.get(`teacher:${uname}`);
  const teacher = raw ? JSON.parse(raw) : null;
  // همیشه پاسخ یکسان (ok:true) برمی‌گردونیم تا نشه فهمید کدوم نام کاربری ثبت شده
  if (!teacher || !teacher.email) return json({ ok: true });

  const token = uid() + uid();
  await kv.put(`resettoken:${token}`, JSON.stringify({ username: teacher.username }), {
    expirationTtl: 3600,
  });

  const url = new URL(request.url);
  const resetLink = `${url.origin}/?reset=${token}`;

  if (env.RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.RESEND_FROM || "onboarding@resend.dev",
          to: teacher.email,
          subject: "بازیابی رمز عبور — آزمون‌ساز معلم",
          html: `
            <div dir="rtl" style="font-family:Tahoma,sans-serif;font-size:15px;line-height:1.9">
              <p>سلام ${teacher.fullname || ""}،</p>
              <p>برای تنظیم رمز عبور جدید روی لینک زیر بزن. این لینک تا ۱ ساعت دیگر معتبر است.</p>
              <p><a href="${resetLink}">${resetLink}</a></p>
              <p>اگر این درخواست را نداده‌ای، این ایمیل را نادیده بگیر.</p>
            </div>`,
        }),
      });
    } catch (e) {
      // خطای ایمیل نادیده گرفته می‌شود
    }
  }
  return json({ ok: true });
}

async function handleResetPassword(request, env) {
  const kv = getKV(env);
  if (!kv) return json({ error: "KV binding missing" }, 500);
  const { token, newPassword } = await request.json();
  if (!token || !newPassword) return json({ error: "token and newPassword required" }, 400);

  const raw = await kv.get(`resettoken:${token}`);
  if (!raw) return json({ error: "invalid or expired token" }, 400);
  const { username } = JSON.parse(raw);

  const teacherRaw = await kv.get(`teacher:${username}`);
  if (!teacherRaw) return json({ error: "teacher not found" }, 404);
  const teacher = JSON.parse(teacherRaw);
  teacher.password = newPassword;
  await kv.put(`teacher:${username}`, JSON.stringify(teacher));
  await kv.delete(`resettoken:${token}`);

  return json({ ok: true });
}

// ==========================================
// جلسه‌ی امتحان دانش‌آموز — بدون افشای پاسخ صحیح
// ==========================================
// برخلاف /api/kv و /api/list (که هر کلیدی رو خام برمی‌گردونن)، این اندپوینت
// مخصوص لینک آزمون دانش‌آموزه: فقط داده‌ی لازم برای همون آزمون رو برمی‌گردونه
// و فیلدهای پاسخ صحیح (correct_answer / correct_answers) رو قبل از ارسال حذف می‌کنه.
async function handleExamSession(request, env) {
  const kv = getKV(env);
  if (!kv) return json({ error: "KV binding missing" }, 500);
  const url = new URL(request.url);
  const examId = url.searchParams.get("examId");
  if (!examId) return json({ error: "examId required" }, 400);

  const examRaw = await kv.get(`exam:${examId}`);
  if (!examRaw) return json({ error: "exam not found" }, 404);
  const exam = JSON.parse(examRaw);

  const [qKeys, rosterKeys, classKeys] = await Promise.all([
    kv.list({ prefix: "question:" }),
    kv.list({ prefix: "roster:" }),
    kv.list({ prefix: "class:" }),
  ]);

  const allQuestions = (await Promise.all(qKeys.keys.map((k) => kv.get(k.name))))
    .filter(Boolean).map((r) => JSON.parse(r));
  const questions = allQuestions
    .filter((q) => q.exam_id === examId)
    .map(({ correct_answer, correct_answers, ...safe }) => safe); // حذف پاسخ صحیح

  const allRoster = (await Promise.all(rosterKeys.keys.map((k) => kv.get(k.name))))
    .filter(Boolean).map((r) => JSON.parse(r));
  const roster = allRoster.filter((r) => r.teacher_id === exam.teacher_id);

  const allClasses = (await Promise.all(classKeys.keys.map((k) => kv.get(k.name))))
    .filter(Boolean).map((r) => JSON.parse(r));
  const classes = allClasses.filter((c) => c.teacher_id === exam.teacher_id);

  return json({ exam, questions, roster, classes });
}

// ذخیره‌ی نهایی پاسخ‌ها — نمره‌دهی سؤالات تستی همیشه سمت سرور محاسبه می‌شه،
// نه با اعتماد به مقادیر is_correct/awarded_mark ارسالی از کلاینت.
async function handleSubmitAnswers(request, env) {
  const kv = getKV(env);
  if (!kv) return json({ error: "KV binding missing" }, 500);
  const { student_id, student, exam_id, answers } = await request.json();
  if (!student_id || !exam_id || !Array.isArray(answers)) {
    return json({ error: "اطلاعات ارسالی معتبر نیست" }, 400);
  }

  const examRaw = await kv.get(`exam:${exam_id}`);
  if (!examRaw) return json({ error: "exam not found" }, 404);
  const exam = JSON.parse(examRaw);

  const qKeys = await kv.list({ prefix: "question:" });
  const allQuestions = (await Promise.all(qKeys.keys.map((k) => kv.get(k.name))))
    .filter(Boolean).map((r) => JSON.parse(r));
  const qMap = new Map(allQuestions.filter((q) => q.exam_id === exam_id).map((q) => [q.id, q]));

  let correctCount = 0;
  let pendingEssays = 0;
  const graded = answers.map((a) => {
    const q = qMap.get(a.question_id);
    if (!q) return null; // سوال نامعتبر/متعلق به آزمون دیگر — نادیده گرفته می‌شود
    const base = {
      id: uid(), student_id, exam_id, question_id: q.id,
      selected_option: a.selected_option, mark: q.mark,
      time_taken: a.time_taken || null, answered_at: new Date().toISOString(),
    };
    if (q.type === "essay") {
      if (a.selected_option) pendingEssays++;
      return { ...base, is_correct: null, awarded_mark: null };
    }
    if (q.type === "mc_multi") {
      const selArr = Array.isArray(a.selected_option) ? [...a.selected_option].sort()
        : String(a.selected_option || "").split(",").filter(Boolean).sort();
      const correctArr = [...(q.correct_answers || [])].sort();
      const isCorrect = selArr.length > 0 && selArr.length === correctArr.length && selArr.every((v, i) => v === correctArr[i]);
      if (isCorrect) correctCount++;
      return { ...base, selected_option: selArr.join(","), is_correct: isCorrect };
    }
    const isCorrect = a.selected_option === q.correct_answer;
    if (isCorrect) correctCount++;
    return { ...base, is_correct: isCorrect };
  }).filter(Boolean);

  if (student) {
    await kv.put(`student:${student_id}`, JSON.stringify({ ...student, id: student_id }));
  }
  await kv.put(`answers:${student_id}`, JSON.stringify(graded));

  const totalQuestions = qMap.size;
  const totalMarks = [...qMap.values()].reduce((s, q) => s + (q.mark || 0), 0);
  const gotMarks = graded.reduce((s, a) => s + (a.is_correct ? a.mark : 0), 0);
  const pct = totalMarks ? Math.round((gotMarks / totalMarks) * 1000) / 10 : 0;

  return json({
    ok: true,
    correctCount, total: totalQuestions, pct, pendingEssays,
    // پاسخ‌های صحیح فقط وقتی برگردونده می‌شن که خود معلم گزینه‌ی «نمایش پاسخ‌ها» رو فعال کرده باشه
    reveal: exam.show_answers ? graded.map((a) => ({ ...a, correct_answer: qMap.get(a.question_id)?.correct_answer, correct_answers: qMap.get(a.question_id)?.correct_answers })) : null,
  });
}

// ==========================================
// مدیریت D1 (ذخیره پاسخ‌های دانش‌آموزان)
// ==========================================
async function handleSaveAnswersBatch(request, env) {
  const db = env.DB;
  if (!db) return json({ error: "D1 binding missing" }, 500);

  try {
    const { student_id, exam_id, answers_batch } = await request.json();
    if (!student_id || !exam_id || !Array.isArray(answers_batch)) {
      return json({ error: "اطلاعات ارسالی معتبر نیست" }, 400);
    }

    // اعتبارسنجی هر آیتم قبل از نوشتن در دیتابیس
    for (const ans of answers_batch) {
      if (!ans || typeof ans !== "object" || !ans.question_id) {
        return json({ error: "شناسه سوال برای یکی از پاسخ‌ها وجود ندارد" }, 400);
      }
      if (
        ans.awarded_mark !== undefined &&
        ans.awarded_mark !== null &&
        (typeof ans.awarded_mark !== "number" || !Number.isFinite(ans.awarded_mark) || ans.awarded_mark < 0)
      ) {
        return json({ error: "نمره ثبت‌شده برای یکی از پاسخ‌ها نامعتبر است" }, 400);
      }
      if (
        ans.is_correct !== undefined &&
        ans.is_correct !== null &&
        typeof ans.is_correct !== "boolean"
      ) {
        return json({ error: "مقدار صحیح/غلط برای یکی از پاسخ‌ها نامعتبر است" }, 400);
      }
      if (
        ans.time_taken !== undefined &&
        ans.time_taken !== null &&
        (typeof ans.time_taken !== "number" || !Number.isFinite(ans.time_taken) || ans.time_taken < 0)
      ) {
        return json({ error: "زمان صرف‌شده برای یکی از پاسخ‌ها نامعتبر است" }, 400);
      }
    }

    await db.batch(
      answers_batch.map((ans) =>
        db.prepare(`
          INSERT INTO answers (id, student_id, exam_id, question_id, selected_option, awarded_mark, is_correct, time_taken, answered_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            selected_option = excluded.selected_option,
            awarded_mark = excluded.awarded_mark,
            is_correct = excluded.is_correct,
            time_taken = excluded.time_taken,
            answered_at = excluded.answered_at
        `).bind(
          ans.id || `${student_id}_${exam_id}_${ans.question_id}_${Date.now()}`,
          student_id,
          exam_id,
          ans.question_id,
          ans.selected_option || null,
          ans.awarded_mark || null,
          ans.is_correct === true ? 1 : (ans.is_correct === false ? 0 : null),
          ans.time_taken || 0,
          ans.answered_at || new Date().toISOString()
        )
      )
    );
    return json({ ok: true, saved_count: answers_batch.length });
  } catch (err) {
    console.error("handleSaveAnswersBatch failed:", err);
    return json({ error: "ثبت پاسخ‌ها با خطا مواجه شد. لطفاً دوباره تلاش کنید." }, 500);
  }
}

async function handleGetAnswers(request, env) {
  const db = env.DB;
  if (!db) return json({ error: "D1 binding missing" }, 500);
  
  const url = new URL(request.url);
  const student_id = url.searchParams.get("student_id");
  const exam_id = url.searchParams.get("exam_id");

  if (!student_id || !exam_id) {
    return json({ error: "student_id and exam_id are required" }, 400);
  }

  try {
    const { results } = await db.prepare(`
      SELECT * FROM answers WHERE student_id = ? AND exam_id = ?
    `).bind(student_id, exam_id).all();
    
    return json({ ok: true, answers: results });
  } catch (err) {
    return json({ error: "Database read failed", details: err.message }, 500);
  }
}

// ==========================================
// نقطه ورود اصلی (Router)
// ==========================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // مسیرهای جدید D1
    if (url.pathname === "/api/exam-session" && request.method === "GET") return handleExamSession(request, env);
    if (url.pathname === "/api/answers/submit" && request.method === "POST") return handleSubmitAnswers(request, env);
    if (url.pathname === "/api/answers/batch" && request.method === "POST") {
      return handleSaveAnswersBatch(request, env);
    }
    if (url.pathname === "/api/answers" && request.method === "GET") {
      return handleGetAnswers(request, env);
    }

    // مسیرهای قدیمی KV
    if (url.pathname === "/api/kv") return handleKV(request, env);
    if (url.pathname === "/api/list") return handleList(request, env);
    if (url.pathname === "/api/forgot-password" && request.method === "POST") return handleForgotPassword(request, env);
    if (url.pathname === "/api/reset-password" && request.method === "POST") return handleResetPassword(request, env);

    if (url.pathname.startsWith("/api/")) return json({ error: "not found" }, 404);

    return env.ASSETS.fetch(request);
  },
};
