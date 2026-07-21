/* ---------------------------------------------------------
   آزمون‌ساز معلم — Worker backend
   © ghobeishawi - All rights reserved.
--------------------------------------------------------- */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getKV(env) {
  return env.KV || env.Kv || env.kv;
}

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

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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
          html: `<div dir="rtl" style="font-family:Tahoma,sans-serif">
            <p>برای تنظیم رمز عبور جدید روی لینک زیر بزنید (تا ۱ ساعت معتبر است):</p>
            <p><a href="${resetLink}">${resetLink}</a></p>
          </div>`,
        }),
      });
    } catch (e) {
      // Swallow email errors — token still works if the user has the link some other way.
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/kv") return handleKV(request, env);
    if (url.pathname === "/api/list") return handleList(request, env);
    if (url.pathname === "/api/forgot-password" && request.method === "POST") return handleForgotPassword(request, env);
    if (url.pathname === "/api/reset-password" && request.method === "POST") return handleResetPassword(request, env);

    if (url.pathname.startsWith("/api/")) return json({ error: "not found" }, 404);

    return env.ASSETS.fetch(request);
  },
};
