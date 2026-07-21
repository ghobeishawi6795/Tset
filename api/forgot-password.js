// POST /api/forgot-password  { username }
//
// Looks up the teacher account, generates a one-hour reset token stored in
// Redis, and emails a reset link via the Resend API. Always responds 200
// with a generic message (even if the username doesn't exist) so the
// response can't be used to check which usernames are registered.
//
// Requires these Vercel project environment variables (Project ->
// Settings -> Environment Variables):
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
//     - auto-added when you connect the Upstash integration to this project
//   RESEND_API_KEY
//     - your Resend API key (mark it Sensitive)
//   RESEND_FROM        (optional, defaults to onboarding@resend.dev sender)
const { Redis } = require("@upstash/redis");
const crypto = require("crypto");
const redis = Redis.fromEnv();

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const username = ((req.body && req.body.username) || "").trim();
  const generic = () => res.status(200).json({ ok: true });
  if (!username) return generic();

  const teacher = await redis.get(`teacher:${username}`);
  if (!teacher) return generic(); // don't leak whether the username exists
  if (!teacher.email) return generic(); // no email on file — nothing to send

  const token = crypto.randomUUID();
  await redis.set(`reset:${token}`, { username }, { ex: 3600 }); // 1 hour TTL

  const origin = `https://${req.headers.host}`;
  const link = `${origin}/?reset=${token}`;

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const from = process.env.RESEND_FROM || "آزمون‌ساز معلم <onboarding@resend.dev>";
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [teacher.email],
          subject: "بازیابی رمز عبور — آزمون‌ساز معلم",
          html: `
            <div dir="rtl" style="font-family:Tahoma,sans-serif;font-size:15px;line-height:1.9">
              <p>سلام ${teacher.fullname || ""}،</p>
              <p>برای تنظیم رمز عبور جدید روی لینک زیر بزن. این لینک تا ۱ ساعت دیگر معتبر است.</p>
              <p><a href="${link}">${link}</a></p>
              <p>اگر این درخواست را نداده‌ای، این ایمیل را نادیده بگیر.</p>
            </div>`,
        }),
      });
    } catch (err) {
      console.error("resend send failed", err);
    }
  } else {
    console.error("RESEND_API_KEY not set — cannot send reset email");
  }

  return generic();
};
