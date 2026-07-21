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
  return Math.random().toString(36).substring(2, 10);
}

function getKV(env) {
  return env.KV || env.Kv || env.kv;
}

// ==========================================
// مدیریت KV (برای معلمان و تنظیمات - بدون تغییر منطق شما)
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
  const { email } = await request.json();
  if (!email) return json({ error: "email required" }, 400);

  const teacherKeys = await kv.list({ prefix: "teacher:" });
  let teacher = null;
  for (const k of teacherKeys.keys) {
    const raw = await kv.get(k.name);
    if (!raw) continue;
    const t = JSON.parse(raw);
    if ((t.email || "").toLowerCase() === email.trim().toLowerCase()) {
      teacher = t;
      break;
    }
  }
  if (!teacher) return json({ ok: true });

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
          subject: "بازیابی رمز عبور - آزمون‌ساز معلم",
          html: `<p>برای تنظیم رمز عبور جدید روی لینک زیر بزنید (تا ۱ ساعت معتبر است):</p><p><a href="${resetLink}">${resetLink}</a></p>`,
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
// مدیریت D1 (جدید: برای ذخیره پاسخ‌های دانش‌آموزان)
// ==========================================
async function handleSaveAnswersBatch(request, env) {
  const db = env.DB;
  if (!db) return json({ error: "D1 binding missing. Please configure wrangler.toml" }, 500);

  try {
    const { student_id, exam_id, answers_batch } = await request.json();
    if (!student_id || !exam_id || !Array.isArray(answers_batch)) {
      return json({ error: "Invalid payload: student_id, exam_id, and answers_batch are required" }, 400);
    }

    // استفاده از db.batch برای ذخیره فوق‌سریع و کاهش درخواست‌ها
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
    return json({ error: "Database write failed", details: err.message }, 500);
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

    // مسیرهای جدید D1 (برای پاسخ‌های دانش‌آموزان)
    if (url.pathname === "/api/answers/batch" && request.method === "POST") {
      return handleSaveAnswersBatch(request, env);
    }
    if (url.pathname === "/api/answers" && request.method === "GET") {
      return handleGetAnswers(request, env);
    }

    // مسیرهای قدیمی KV (برای حفظ سازگاری سیستم ورود شما)
    if (url.pathname === "/api/kv") return handleKV(request, env);
    if (url.pathname === "/api/list") return handleList(request, env);
    if (url.pathname === "/api/forgot-password" && request.method === "POST") return handleForgotPassword(request, env);
    if (url.pathname === "/api/reset-password" && request.method === "POST") return handleResetPassword(request, env);

    if (url.pathname.startsWith("/api/")) return json({ error: "not found" }, 404);

    return env.ASSETS.fetch(request);
  },
};
