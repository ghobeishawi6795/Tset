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

// کلیدهایی که فقط داخلی هستن و هیچ‌وقت نباید از طریق KV عمومی خونده/نوشته بشن،
// حتی برای یک کاربر لاگین‌کرده
const INTERNAL_ONLY_PREFIXES = ["session:", "resettoken:", "loginfail:"];
function isInternalKey(key) {
  return INTERNAL_ONLY_PREFIXES.some((p) => key.startsWith(p));
}

// سشن کاربر را از هدر Authorization می‌خواند. هیچ اندپوینتی که داده‌ی واقعی
// (امتحان، دانش‌آموز، معلم و ...) برمی‌گردونه بدون سشن معتبر اجرا نمی‌شه —
// این همون چیزیه که قبلاً باعث می‌شد هر بازدیدکننده‌ی ناشناس بتونه مستقیم
// از /api/kv و /api/list کل دیتابیس رو بخونه یا بنویسه.
async function getSession(request, env) {
  const kv = getKV(env);
  if (!kv) return null;
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  const raw = await kv.get(`session:${token}`);
  return raw ? JSON.parse(raw) : null;
}

// این نوع کلیدها متعلق به یک معلم مشخصن (فیلد teacher_id مستقیم دارن)
const DIRECT_OWNER_PREFIXES = ["exam:", "student:", "class:", "roster:", "cheatalert:", "message:"];
// این‌ها مالکیتشون غیرمستقیمه — باید از طریق آزمون (exam_id) به معلم برسیم
const EXAM_LINKED_PREFIXES = ["question:", "answers:", "draft:", "note:"];

// exam_id مربوط به یک کلید غیرمستقیم رو استخراج می‌کنه
function examIdFromKey(key, value) {
  if (key.startsWith("question:")) return value?.exam_id || null;
  if (key.startsWith("answers:")) return Array.isArray(value) ? value[0]?.exam_id || null : null;
  if (key.startsWith("draft:") || key.startsWith("note:")) return key.split(":")[1] || null;
  return null;
}

// مالک واقعی (username معلم) یک کلید رو برمی‌گردونه، یا null اگه قابل تشخیص/عمومی نباشه.
// یک کش کوچیک از exam_id -> teacher_id می‌گیره تا برای لیست‌های بزرگ، exam یکسان
// چندبار از KV خونده نشه.
async function ownerOf(kv, key, value, examOwnerCache) {
  if (key.startsWith("teacher:")) return value?.username || key.slice("teacher:".length);
  for (const p of DIRECT_OWNER_PREFIXES) {
    if (key.startsWith(p)) return value?.teacher_id || null;
  }
  for (const p of EXAM_LINKED_PREFIXES) {
    if (key.startsWith(p)) {
      const examId = examIdFromKey(key, value);
      if (!examId) return null;
      if (examOwnerCache && examOwnerCache.has(examId)) return examOwnerCache.get(examId);
      const examRaw = await kv.get(`exam:${examId}`);
      const owner = examRaw ? JSON.parse(examRaw).teacher_id || null : null;
      if (examOwnerCache) examOwnerCache.set(examId, owner);
      return owner;
    }
  }
  return null; // پیشوند ناشناخته — به‌صورت پیش‌فرض غیرمجاز برای غیر ادمین
}

// ==========================================
// مدیریت KV (برای معلمان و تنظیمات)
// ==========================================
async function handleKV(request, env) {
  const kv = getKV(env);
  if (!kv) return json({ error: "KV binding missing" }, 500);
  const url = new URL(request.url);

  // پیش‌نویس پاسخ‌های دانش‌آموز حین امتحان — دانش‌آموز هیچ‌وقت لاگین نمی‌کنه،
  // پس این کلید باید بدون سشن هم در دسترس باشه (دقیقاً مثل exam-session و
  // answers/submit). داده‌ش فقط پاسخ‌های ناتمام خودِ همون دانش‌آموز روی یک
  // امتحانه، چیز حساسی نیست.
  const draftKey = request.method === "DELETE" || request.method === "GET"
    ? url.searchParams.get("key") : null;
  const isDraftGetOrDelete = draftKey && draftKey.startsWith("draft:");

  if (request.method === "POST" && !isDraftGetOrDelete) {
    const peek = await request.clone().json().catch(() => ({}));
    if (peek && typeof peek.k === "string" && peek.k.startsWith("draft:")) {
      const { k, v } = peek;
      await kv.put(k, JSON.stringify(v));
      return json({ ok: true });
    }
  }
  if (isDraftGetOrDelete) {
    if (request.method === "GET") {
      const raw = await kv.get(draftKey);
      if (raw === null) return json({ error: "not found" }, 404);
      return json({ v: JSON.parse(raw) });
    }
    await kv.delete(draftKey);
    return json({ ok: true });
  }

  const session = await getSession(request, env);
  if (!session) return json({ error: "لازم است دوباره وارد شوید" }, 401);
  const isAdmin = session.role === "admin";

  if (request.method === "GET") {
    const key = url.searchParams.get("key");
    if (!key || isInternalKey(key)) return json({ error: "key required" }, 400);
    const raw = await kv.get(key);
    if (raw === null) return json({ error: "not found" }, 404);
    const value = JSON.parse(raw);
    if (!isAdmin) {
      const owner = await ownerOf(kv, key, value);
      if (owner !== session.username) return json({ error: "دسترسی غیرمجاز" }, 403);
    }
    return json({ v: value });
  }

  if (request.method === "POST") {
    const body = await request.json();
    const { k, v } = body || {};
    if (!k || isInternalKey(k)) return json({ error: "k required" }, 400);
    if (!isAdmin) {
      if (k.startsWith("teacher:")) {
        // معلم فقط می‌تونه رکورد خودش رو ویرایش کنه، و نمی‌تونه نقش خودش رو ارتقا بده
        if (k !== `teacher:${session.username}` || !v || v.username !== session.username || v.role !== session.role) {
          return json({ error: "دسترسی غیرمجاز" }, 403);
        }
      } else {
        // برای بقیه‌ی انواع، مقدار جدید باید متعلق به همین معلم باشه...
        const claimedOwner = await ownerOf(kv, k, v);
        if (claimedOwner !== session.username) return json({ error: "دسترسی غیرمجاز" }, 403);
        // ...و اگه کلید از قبل وجود داشته، نباید مال یه معلم دیگه بوده باشه (جلوگیری از ربودن رکورد)
        const existingRaw = await kv.get(k);
        if (existingRaw) {
          const existingOwner = await ownerOf(kv, k, JSON.parse(existingRaw));
          if (existingOwner !== session.username) return json({ error: "دسترسی غیرمجاز" }, 403);
        }
      }
    }
    await kv.put(k, JSON.stringify(v));
    return json({ ok: true });
  }

  if (request.method === "DELETE") {
    const key = url.searchParams.get("key");
    if (!key || isInternalKey(key)) return json({ error: "key required" }, 400);
    if (!isAdmin) {
      const existingRaw = await kv.get(key);
      if (existingRaw) {
        const owner = await ownerOf(kv, key, JSON.parse(existingRaw));
        if (owner !== session.username) return json({ error: "دسترسی غیرمجاز" }, 403);
      }
    }
    await kv.delete(key);
    return json({ ok: true });
  }

  return json({ error: "method not allowed" }, 405);
}

async function handleList(request, env) {
  const kv = getKV(env);
  if (!kv) return json({ error: "KV binding missing" }, 500);
  const session = await getSession(request, env);
  if (!session) return json({ error: "لازم است دوباره وارد شوید" }, 401);
  const isAdmin = session.role === "admin";
  const url = new URL(request.url);
  const prefix = url.searchParams.get("prefix") || "";
  if (isInternalKey(prefix) || prefix === "") return json({ keys: [] });
  const keys = [];
  let cursor;
  do {
    const res = await kv.list({ prefix, cursor });
    keys.push(...res.keys.map((k) => k.name));
    cursor = res.list_complete ? null : res.cursor;
  } while (cursor);

  if (isAdmin) return json({ keys });

  // برای غیر ادمین‌ها، فقط کلیدهایی که واقعاً مال خودشونه برگردونده می‌شه —
  // این همون تکه‌ای بود که قبلاً نبود: هر معلم لاگین‌کرده کل دیتای بقیه‌ی
  // معلم‌ها رو هم می‌گرفت چون این اندپوینت فقط اسم کلیدها رو برمی‌گردوند،
  // بدون توجه به این‌که واقعاً مال همون کاربره یا نه.
  // خواندن و بررسی مالکیت هر کلید یه رفت‌وبرگشت جدا به KV داره؛ اگه این کارو
  // یکی‌یکی و پشت‌سرهم انجام بدیم، برای مدرسه‌ای با صدها رکورد چندین ثانیه
  // طول می‌کشه. به‌جاش دسته‌دسته (هم‌زمان) پردازش می‌کنیم تا سریع بمونه، بدون
  // اینکه فشار زیادی روی KV بذاریم.
  const examOwnerCache = new Map();
  const owned = [];
  const CONCURRENCY = 25;
  for (let i = 0; i < keys.length; i += CONCURRENCY) {
    const batch = keys.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (key) => {
        const raw = await kv.get(key);
        if (raw === null) return null;
        const owner = await ownerOf(kv, key, JSON.parse(raw), examOwnerCache);
        return owner === session.username ? key : null;
      })
    );
    for (const key of results) if (key) owned.push(key);
  }
  return json({ keys: owned });
}

// ==========================================
// تایید یک‌باره‌ی مجوز مدل تصویری (Meta License) — Cloudflare قبل از اولین
// استفاده از llama-3.2-11b-vision-instruct، نیاز به یه درخواست با
// prompt: "agree" داره. این اندپوینت همون کارو انجام می‌ده، فقط برای اینکه
// از رابط Playground (که موبایل‌فرندلی نیست) بی‌نیاز باشیم. فقط ادمین
// می‌تونه صداش بزنه، و بعد از تایید موفق دیگه لازم نیست دوباره استفاده بشه.
// ==========================================
// پیشنهاد نمره برای پاسخ تشریحی با هوش مصنوعی — فقط یه پیشنهاده؛ معلم
// خودش باید نمره رو تایید/ویرایش و ثبت کنه، چیزی خودکار ذخیره نمی‌شه.
// ==========================================
async function handleGradeEssay(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "لازم است دوباره وارد شوید" }, 401);
  if (!env.AI) return json({ error: "قابلیت هوش مصنوعی برای این پروژه فعال نیست" }, 500);

  const body = await request.json().catch(() => ({}));
  const questionText = (body.question_text || "").trim();
  const modelAnswer = (body.model_answer || "").trim();
  const keywords = Array.isArray(body.keywords) ? body.keywords : [];
  const studentAnswer = (body.student_answer || "").trim();
  const mark = Number(body.mark) || 1;
  if (!questionText || !studentAnswer) return json({ error: "متن سوال و پاسخ دانش‌آموز لازمه" }, 400);

  const hasReference = !!(modelAnswer || keywords.length > 0);
  const prompt = `تو یه معلم منصفی که پاسخ تشریحی دانش‌آموز رو تصحیح می‌کنی.
سوال: ${questionText}
نمره‌ی کامل این سوال: ${mark}
${modelAnswer ? `پاسخ نمونه‌ی معلم: ${modelAnswer}` : "پاسخ نمونه‌ای ثبت نشده."}
${keywords.length > 0 ? `کلمات کلیدی موردانتظار: ${keywords.join("، ")}` : ""}

پاسخ دانش‌آموز: ${studentAnswer.slice(0, 4000)}

بر اساس میزان تطابق پاسخ دانش‌آموز با پاسخ نمونه/کلمات کلیدی بالا، یه نمره‌ی منصفانه بین ۰ تا ${mark} بده — فقط از این مقادیر استفاده کن: مضرب‌های ۰.۲۵ (یعنی ۰، ۰.۲۵، ۰.۵، ۰.۷۵، ۱ و به همین ترتیب)، نه هر عدد اعشاری دیگه. یه بازخورد خیلی کوتاه (حداکثر ۲ جمله، به فارسی) هم بده.
خروجی رو دقیقاً و فقط با این فرمت بده، بدون هیچ توضیح اضافه:
SCORE: <عدد>
FEEDBACK: <بازخورد کوتاه>`;

  try {
    const result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
    });
    const raw = (result && (result.response || result.result || "")) || "";
    const scoreMatch = raw.match(/SCORE:\s*([\d.]+)/i);
    const feedbackMatch = raw.match(/FEEDBACK:\s*([\s\S]*)/i);
    if (!scoreMatch) return json({ error: "هوش مصنوعی خروجی قابل‌فهمی نداد. دوباره امتحان کن." }, 502);
    let score = parseFloat(scoreMatch[1]);
    if (Number.isNaN(score)) score = 0;
    score = Math.max(0, Math.min(mark, score));
    score = Math.round(score * 4) / 4; // به نزدیک‌ترین ۰.۲۵ گرد می‌شه (۰، ۰.۲۵، ۰.۵، ۰.۷۵، ۱، ...)
    const feedback = feedbackMatch ? feedbackMatch[1].trim().split("\n")[0] : "";
    return json({ ok: true, score, feedback, hasReference });
  } catch (err) {
    console.error("handleGradeEssay failed:", err);
    return json({ error: `پیشنهاد نمره با خطا مواجه شد: ${err.message || err}` }, 500);
  }
}

// ==========================================
// تایید یک‌باره‌ی مجوز مدل تصویری (Meta License) — Cloudflare قبل از اولین
// استفاده از llama-3.2-11b-vision-instruct، نیاز به یه درخواست با
// prompt: "agree" داره. این اندپوینت همون کارو انجام می‌ده، فقط برای اینکه
// از رابط Playground (که موبایل‌فرندلی نیست) بی‌نیاز باشیم.
async function handleAcceptAiLicense(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "لازم است دوباره وارد شوید" }, 401);
  if (!env.AI) return json({ error: "AI binding فعال نیست" }, 500);
  try {
    const result = await env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct", { prompt: "agree" });
    return json({ ok: true, result });
  } catch (err) {
    return json({ error: err.message || String(err) }, 500);
  }
}

// ==========================================
// تولید سوال با هوش مصنوعی (Cloudflare Workers AI — رایگان، بدون نیاز به
// حساب یا کلید جداگانه). خروجی مدل عمداً در همون قالب متنی‌ای خواسته می‌شه
// که ابزار «ورود گروهی سوال» از قبل می‌فهمه (Q:/A)/ANSWER:/MARK:)، تا
// معلم قبل از ذخیره‌ی نهایی، متن رو ببینه و ویرایش کنه — هیچ سوالی خودکار
// و بدون تایید معلم ذخیره نمی‌شه.
// ==========================================
const AI_PROMPT_INSTRUCTIONS = `شما دستیار طراحی سوال امتحان هستی. بر اساس محتوای داده‌شده، سوال امتحانی به زبان فارسی بساز.
خروجی باید دقیقاً و فقط در این قالب باشه (بدون هیچ توضیح اضافه‌ی قبل یا بعدش):

برای سوال چهارگزینه‌ای:
Q: متن سوال
A) گزینه یک
B) گزینه دو
C) گزینه سه
D) گزینه چهار
ANSWER: <حرف گزینه‌ی صحیح، مثلاً A>
MARK: 1

برای سوال تشریحی:
Q: متن سوال
TYPE: essay
ANSWER: پاسخ نمونه
MARK: 1

بین هر سوال و سوال بعدی، دقیقاً یک خط خالی بذار. هیچ متن دیگه‌ای (مثل مقدمه یا جمع‌بندی) توی خروجی نباشه.`;

async function handleAIGenerateQuestions(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "لازم است دوباره وارد شوید" }, 401);
  if (!env.AI) return json({ error: "قابلیت هوش مصنوعی برای این پروژه فعال نیست (باید binding با نام AI به wrangler.toml اضافه بشه)" }, 500);

  const body = await request.json().catch(() => ({}));
  const { mode, sourceText, imageBase64, count, questionType } = body;
  const n = Math.min(Math.max(Number(count) || 5, 1), 15);
  const typeHint = questionType === "essay" ? "فقط سوال تشریحی"
    : questionType === "mixed" ? "ترکیبی از چهارگزینه‌ای و تشریحی"
    : "فقط سوال چهارگزینه‌ای";
  const instructions = `${AI_PROMPT_INSTRUCTIONS}\n\nتعداد سوال موردنیاز: ${n} عدد. نوع سوال: ${typeHint}.`;

  try {
    let result;
    let debugOcrText = null;
    if (mode === "image") {
      if (!imageBase64) return json({ error: "تصویری ارسال نشده" }, 400);
      // مدل‌های تصویری Workers AI معمولاً بایت‌های خام تصویر رو به‌صورت آرایه می‌خوان
      const binary = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
      // قدم اول: مدل تصویری فقط متن داخل عکس رو استخراج می‌کنه (کار ساده‌تر و
      // قابل‌اعتمادتر). اگه هم‌زمان از مدل بخوایم عکس رو بخونه، فارسی جواب بده،
      // و فرمت خاص رو رعایت کنه، مدل‌های سبک تصویری زیاد توی یه حلقه‌ی تکراری
      // گیر می‌کنن. قدم دوم رو به همون مدل قوی متنی می‌سپاریم که از قبل خوب کار می‌کرد.
      const ocrResult = await env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct", {
        prompt: "You are an OCR engine, not an image describer. Output ONLY the exact words/sentences printed or written in this image, verbatim, preserving line breaks. Do NOT describe the image, its colors, its layout, or its language — only transcribe the actual text content, in whatever language it is written in. If there is no readable text, reply with exactly: NO_TEXT_FOUND",
        image: Array.from(binary),
        max_tokens: 2048,
      });
      const extractedText = (ocrResult && (ocrResult.response || ocrResult.result || "")) || "";
      debugOcrText = extractedText;
      // اگه مدل به‌جای رونویسی متن، توضیح داده (مثلاً درباره‌ی رنگ یا زبان تصویر)،
      // معمولاً نتیجه خیلی کوتاهه — بهتره این‌جا جلوش رو بگیریم تا سوال بی‌ربط تولید نشه.
      if (!extractedText.trim() || extractedText.includes("NO_TEXT_FOUND") || extractedText.trim().length < 40) {
        return json({ error: "متن قابل استفاده‌ای از تصویر خونده نشد (شاید متن خیلی کوچیک یا کم‌واضح بود). یه عکس واضح‌تر و با نور بهتر امتحان کن، یا نزدیک‌تر از متن عکس بگیر.", debugOcrText: extractedText }, 502);
      }
      result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          { role: "system", content: instructions },
          { role: "user", content: `این متن رو بخون و از روش سوال بساز:\n\n${extractedText.slice(0, 12000)}` },
        ],
        max_tokens: 3000,
      });
    } else {
      if (!sourceText || !sourceText.trim()) return json({ error: "متنی ارسال نشده" }, 400);
      result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          { role: "system", content: instructions },
          { role: "user", content: `این متن رو بخون و از روش سوال بساز:\n\n${sourceText.slice(0, 12000)}` },
        ],
        max_tokens: 3000,
      });
    }
    const outputText = (result && (result.response || result.result || "")) || "";
    if (!outputText.trim()) return json({ error: "هوش مصنوعی خروجی برنگردوند، دوباره امتحان کن." }, 502);
    return json({ ok: true, text: outputText.trim(), debugOcrText });
  } catch (err) {
    console.error("handleAIGenerateQuestions failed:", err);
    return json({ error: `تولید سوال با خطا مواجه شد: ${err.message || err}` }, 500);
  }
}

// آیا این دانش‌آموز قبلاً همین امتحان رو داده؟ — به‌جای این‌که کل لیست
// دانش‌آموزها و پاسخ‌های همه‌ی مدرسه به مرورگر دانش‌آموز بیاد، این فقط
// یک true/false برمی‌گردونه.
async function handleExamAttempted(request, env) {
  const kv = getKV(env);
  if (!kv) return json({ already: false });
  const url = new URL(request.url);
  const examId = url.searchParams.get("examId");
  const name = (url.searchParams.get("name") || "").trim();
  if (!examId || !name) return json({ already: false });

  const examRaw = await kv.get(`exam:${examId}`);
  if (!examRaw) return json({ already: false });
  const exam = JSON.parse(examRaw);

  const [studentKeys, answersKeys] = await Promise.all([
    kv.list({ prefix: "student:" }), kv.list({ prefix: "answers:" }),
  ]);
  const students = (await Promise.all(studentKeys.keys.map((k) => kv.get(k.name)))).filter(Boolean).map((r) => JSON.parse(r));
  const matchingIds = students
    .filter((s) => s.teacher_id === exam.teacher_id && (s.fullname || "").trim() === name)
    .map((s) => s.id);
  if (matchingIds.length === 0) return json({ already: false });

  const answerBatches = (await Promise.all(answersKeys.keys.map((k) => kv.get(k.name)))).filter(Boolean).map((r) => JSON.parse(r));
  const already = answerBatches.flat().some((a) => a && matchingIds.includes(a.student_id) && a.exam_id === examId);
  return json({ already });
}
async function handleTeacherExists(request, env) {
  const kv = getKV(env);
  if (!kv) return json({ exists: false });
  const res = await kv.list({ prefix: "teacher:", limit: 1 });
  return json({ exists: res.keys.length > 0 });
}

// ثبت‌نام فقط برای ساخت اولین حساب (مدیر مدرسه) مجاز است — این چک حالا سمت
// سرور انجام می‌شه، نه فقط با یک state در فرانت‌اند که قابل دور زدن بود.
async function handleRegister(request, env) {
  const kv = getKV(env);
  if (!kv) return json({ error: "KV binding missing" }, 500);
  const existing = await kv.list({ prefix: "teacher:", limit: 1 });
  if (existing.keys.length > 0) return json({ error: "امکان ثبت‌نام وجود ندارد" }, 403);

  const { username, fullname, email, passwordHash } = await request.json();
  if (!username || !fullname || !email || !passwordHash) {
    return json({ error: "همه فیلدها لازم است" }, 400);
  }
  const teacher = { username, fullname, email, password: passwordHash, role: "admin", created_at: new Date().toISOString() };
  await kv.put(`teacher:${username}`, JSON.stringify(teacher));

  const token = uid() + uid() + uid();
  await kv.put(`session:${token}`, JSON.stringify({ username, role: "admin" }), { expirationTtl: 60 * 60 * 24 * 30 });
  return json({ ok: true, token, teacher });
}

// بعد از چند تلاش ناموفق پشت سر هم برای یک نام کاربری، ورود رو برای چند
// دقیقه قفل می‌کنه — جلوی حدس زدن نامحدود رمز عبور رو می‌گیره.
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_SECONDS = 10 * 60;

async function handleLogin(request, env) {
  const kv = getKV(env);
  if (!kv) return json({ error: "KV binding missing" }, 500);
  const { username, passwordHash } = await request.json();
  if (!username || !passwordHash) return json({ error: "نام کاربری و رمز عبور لازم است" }, 400);

  const failKey = `loginfail:${username}`;
  const failRaw = await kv.get(failKey);
  const fail = failRaw ? JSON.parse(failRaw) : { count: 0 };
  if (fail.count >= LOGIN_MAX_ATTEMPTS) {
    return json({ error: "به‌دلیل تلاش‌های ناموفق زیاد، چند دقیقه صبر کنید و دوباره امتحان کنید." }, 429);
  }

  const raw = await kv.get(`teacher:${username}`);
  const teacher = raw ? JSON.parse(raw) : null;
  if (!teacher || teacher.password !== passwordHash) {
    await kv.put(failKey, JSON.stringify({ count: fail.count + 1 }), { expirationTtl: LOGIN_LOCKOUT_SECONDS });
    return json({ error: "نام کاربری یا رمز عبور اشتباه است" }, 401);
  }
  await kv.delete(failKey);
  const token = uid() + uid() + uid();
  await kv.put(`session:${token}`, JSON.stringify({ username: teacher.username, role: teacher.role || "teacher" }), { expirationTtl: 60 * 60 * 24 * 30 });
  return json({ ok: true, token, teacher });
}

async function handleLogout(request, env) {
  const kv = getKV(env);
  if (!kv) return json({ ok: true });
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token) await kv.delete(`session:${token}`);
  return json({ ok: true });
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

// پرتال دانش‌آموزی — با کد شخصی، فقط نتایج و پیام‌های خودِ همون دانش‌آموز
// برمی‌گرده، نه کل دیتابیس مدرسه.
async function handleStudentLookup(request, env) {
  const kv = getKV(env);
  if (!kv) return json({ error: "KV binding missing" }, 500);
  const url = new URL(request.url);
  const code = (url.searchParams.get("code") || "").trim();
  if (!code) return json({ error: "کد لازم است" }, 400);

  const rosterKeys = await kv.list({ prefix: "roster:" });
  const rosterRecords = (await Promise.all(rosterKeys.keys.map((k) => kv.get(k.name))))
    .filter(Boolean).map((r) => JSON.parse(r));
  const activeRoster = rosterRecords.find((r) => r.code === code);
  if (!activeRoster) return json({ found: false });

  const classRaw = await kv.get(`class:${activeRoster.class_id}`);
  const className = classRaw ? JSON.parse(classRaw).name : "—";

  const [studentKeys, examKeys, answersKeys, messageKeys] = await Promise.all([
    kv.list({ prefix: "student:" }), kv.list({ prefix: "exam:" }),
    kv.list({ prefix: "answers:" }), kv.list({ prefix: "message:" }),
  ]);
  const students = (await Promise.all(studentKeys.keys.map((k) => kv.get(k.name)))).filter(Boolean).map((r) => JSON.parse(r));
  const myStudentIds = students
    .filter((s) => s.teacher_id === activeRoster.teacher_id && (s.fullname || "").trim() === (activeRoster.fullname || "").trim())
    .map((s) => s.id);

  const answerBatches = (await Promise.all(answersKeys.keys.map((k) => kv.get(k.name)))).filter(Boolean).map((r) => JSON.parse(r));
  const myAnswers = answerBatches.flat().filter((a) => a && myStudentIds.includes(a.student_id));

  const exams = (await Promise.all(examKeys.keys.map((k) => kv.get(k.name)))).filter(Boolean).map((r) => JSON.parse(r));
  const byExam = {};
  myAnswers.forEach((a) => { (byExam[a.exam_id] = byExam[a.exam_id] || []).push(a); });
  const results = Object.entries(byExam).map(([examId, list]) => {
    const exam = exams.find((e) => e.id === examId);
    const totalMarks = list.reduce((s, a) => s + (a.mark || 1), 0);
    const gotMarks = list.reduce((s, a) => s + (a.awarded_mark != null ? a.awarded_mark : (a.is_correct ? a.mark : 0)), 0);
    const pendingCount = list.filter((a) => a.is_correct === null && a.awarded_mark == null).length;
    const pct = totalMarks ? Math.round((gotMarks / totalMarks) * 1000) / 10 : 0;
    const date = list[0]?.answered_at || null;
    return { examId, title: exam?.title || "—", pct, pendingCount, date };
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const messages = (await Promise.all(messageKeys.keys.map((k) => kv.get(k.name)))).filter(Boolean).map((r) => JSON.parse(r));
  const myMessages = messages.filter((m) => {
    if (m.sender === "admin") {
      if (m.audience === "students") return true;
      if (m.audience === "class" && m.target_id === activeRoster.class_id) return true;
      if (m.audience === "student" && m.target_id === activeRoster.id) return true;
      return false;
    }
    return m.teacher_id === activeRoster.teacher_id &&
      (m.target_type === "all" || (m.target_type === "class" && m.target_id === activeRoster.class_id) || (m.target_type === "student" && m.target_id === activeRoster.id));
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  let teacherName = "معلم";
  const teacherRaw = await kv.get(`teacher:${activeRoster.teacher_id}`);
  if (teacherRaw) teacherName = JSON.parse(teacherRaw).fullname || teacherName;

  return json({
    found: true,
    roster: { fullname: activeRoster.fullname, id: activeRoster.id, class_id: activeRoster.class_id },
    className, results, messages: myMessages, teacherName,
  });
}
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

  const teacherRaw = await kv.get(`teacher:${exam.teacher_id}`);
  const teacherRecord = teacherRaw ? JSON.parse(teacherRaw) : null;
  const examWithExtras = {
    ...exam,
    finish_messages: Array.isArray(teacherRecord?.finish_messages) ? teacherRecord.finish_messages : [],
  };

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

  return json({ exam: examWithExtras, questions, roster, classes });
}

// ذخیره‌ی نهایی پاسخ‌ها — نمره‌دهی سؤالات تستی همیشه سمت سرور محاسبه می‌شه،
// نه با اعتماد به مقادیر is_correct/awarded_mark ارسالی از کلاینت.
async function handleSubmitAnswers(request, env) {
  const kv = getKV(env);
  if (!kv) return json({ error: "KV binding missing" }, 500);
  const { student_id, student, exam_id, answers, cheat_alert } = await request.json();
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
  if (cheat_alert && cheat_alert.id) {
    await kv.put(`cheatalert:${cheat_alert.id}`, JSON.stringify({ ...cheat_alert, exam_id, seen: false }));
  }

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



export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/ai/grade-essay" && request.method === "POST") return handleGradeEssay(request, env);
    if (url.pathname === "/api/ai/accept-license" && request.method === "POST") return handleAcceptAiLicense(request, env);
    if (url.pathname === "/api/ai/generate-questions" && request.method === "POST") return handleAIGenerateQuestions(request, env);
    if (url.pathname === "/api/exam-attempted" && request.method === "GET") return handleExamAttempted(request, env);
    if (url.pathname === "/api/teacher-exists" && request.method === "GET") return handleTeacherExists(request, env);
    if (url.pathname === "/api/register" && request.method === "POST") return handleRegister(request, env);
    if (url.pathname === "/api/login" && request.method === "POST") return handleLogin(request, env);
    if (url.pathname === "/api/logout" && request.method === "POST") return handleLogout(request, env);
    if (url.pathname === "/api/student-lookup" && request.method === "GET") return handleStudentLookup(request, env);
    if (url.pathname === "/api/exam-session" && request.method === "GET") return handleExamSession(request, env);
    if (url.pathname === "/api/answers/submit" && request.method === "POST") return handleSubmitAnswers(request, env);

    // مسیرهای قدیمی KV
    if (url.pathname === "/api/kv") return handleKV(request, env);
    if (url.pathname === "/api/list") return handleList(request, env);
    if (url.pathname === "/api/forgot-password" && request.method === "POST") return handleForgotPassword(request, env);
    if (url.pathname === "/api/reset-password" && request.method === "POST") return handleResetPassword(request, env);

    if (url.pathname.startsWith("/api/")) return json({ error: "not found" }, 404);

    return env.ASSETS.fetch(request);
  },
};
