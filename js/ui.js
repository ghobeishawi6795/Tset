/* ---------------------------------------------------------
   Shared utilities (KV helpers) + shared UI primitives
   © ghobeishawi - All rights reserved.
--------------------------------------------------------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
function omit(obj, keys) {
  const out = {};
  Object.keys(obj).forEach((k) => {
    if (keys.indexOf(k) === -1) out[k] = obj[k];
  });
  return out;
}

/* ---------------------------------------------------------
   Password hashing (SHA-256, client-side via Web Crypto).
   Stored passwords are a 64-char hex digest, never plain text.
   verifyPassword() also transparently accepts an old plain-text
   password (from accounts created before hashing was added) so
   nobody gets locked out — see comment inside.
--------------------------------------------------------- */
async function hashPassword(plain) {
  const bytes = new TextEncoder().encode(plain);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function looksHashed(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}
// Returns true if `entered` matches the stored password, whether the
// stored value is already a hash (normal case) or still plain text
// (a legacy account from before this feature existed).
async function verifyPassword(storedPassword, entered) {
  if (looksHashed(storedPassword)) {
    return storedPassword === (await hashPassword(entered));
  }
  return storedPassword === entered; // legacy plain-text account
}

/* ---------------------------------------------------------
   Persistent login ("stay signed in across refresh").
   We store the username + the CURRENT password hash (never the
   plain password) in localStorage. On app load we look this up,
   re-fetch the teacher record, and only auto-login if the stored
   hash still matches teacher.password — so changing the password
   invalidates any stale saved sessions elsewhere automatically.
--------------------------------------------------------- */
const SESSION_KEY = "eduexam_session";
const SESSION_DAYS = 30;
function saveSession(username, passwordHash) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      username, passwordHash, expires_at: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
    }));
  } catch { /* localStorage unavailable — session just won't persist */ }
}
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.username || !s.passwordHash || Date.now() > s.expires_at) return null;
    return s;
  } catch {
    return null;
  }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

async function getJSON(key) {
  try {
    const r = await fetch(`/api/kv?key=${encodeURIComponent(key)}`);
    if (r.status === 404) return null;
    if (!r.ok) return null;
    const data = await r.json();
    return data.v;
  } catch {
    return null;
  }
}

async function setJSON(key, value) {
  try {
    const r = await fetch("/api/kv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ k: key, v: value }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function deleteKey(key) {
  try {
    await fetch(`/api/kv?key=${encodeURIComponent(key)}`, { method: "DELETE" });
  } catch {
    /* ignore */
  }
}

async function listPrefix(prefix) {
  try {
    const r = await fetch(`/api/list?prefix=${encodeURIComponent(prefix)}`);
    if (!r.ok) return [];
    const data = await r.json();
    return data.keys || [];
  } catch {
    return [];
  }
}

async function loadAll(prefix) {
  const keys = await listPrefix(prefix);
  const items = await Promise.all(keys.map((k) => getJSON(k)));
  return items.filter(Boolean);
}

/* ---------------------------------------------------------
   OFFLINE SUBMISSION QUEUE
   When a student finishes an exam with no internet connection
   (or a KV write fails mid-submission), the full submission is
   saved here instead of being lost. Once connectivity returns,
   flushOfflineQueue() replays every queued submission against
   the real KV API and removes it from the queue on success.
--------------------------------------------------------- */
const OFFLINE_QUEUE_KEY = "eduexam_offline_queue";

function getOfflineQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    /* localStorage full/unavailable — nothing more we can do client-side */
  }
}

function queueOfflineSubmission(submission) {
  const queue = getOfflineQueue();
  queue.push(submission);
  saveOfflineQueue(queue);
}

// Attempts to send every queued submission to the real backend. Returns the
// number of submissions successfully synced. Safe to call repeatedly (e.g.
// on an 'online' event or a periodic timer) — already-synced items are
// removed from the queue, so nothing is ever double-submitted.
async function flushOfflineQueue() {
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;
  const stillPending = [];
  let syncedCount = 0;
  for (const sub of queue) {
    try {
      const r = await fetch("/api/answers/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: sub.studentRecord.id,
          student: sub.studentRecord,
          exam_id: sub.examId,
          answers: sub.answerRecords.map((a) => ({
            question_id: a.question_id, selected_option: a.selected_option, time_taken: a.time_taken,
          })),
        }),
      });
      let ok = r.ok;
      if (ok && sub.cheatAlert) ok = await setJSON(`cheatalert:${sub.cheatAlert.id}`, sub.cheatAlert);
      if (ok) {
        if (sub.draftKeyToDelete) await deleteKey(sub.draftKeyToDelete);
        syncedCount++;
      } else {
        stillPending.push(sub);
      }
    } catch {
      stillPending.push(sub);
    }
  }
  saveOfflineQueue(stillPending);
  return syncedCount;
}

// Works for both multiple-choice answers (mark if correct) and essay answers
// that have been manually graded (awarded_mark set by the teacher).

function awardedMarkOf(a) {
  if (a.awarded_mark != null) return a.awarded_mark;
  return a.is_correct ? a.mark : 0;
}

// Sorts a copy of `arr` alphabetically (Persian-aware) by the string keyFn(item) returns.
function sortByFa(arr, keyFn) {
  return [...arr].sort((a, b) => (keyFn(a) || "").localeCompare(keyFn(b) || "", "fa"));
}

function downloadTextFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------
   Small UI atoms
--------------------------------------------------------- */

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#3A4A63", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 14px",
  borderRadius: 10,
  border: "1.5px solid #E2E8F0",
  fontSize: 14,
  outline: "none",
  fontFamily: "inherit",
  background: "#fff",
  color: "#1E293B",
  transition: "border-color .15s",
};

function TextInput(props) {
  const [focus, setFocus] = useState(false);
  return (
    <input
      {...props}
      onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
      style={{ ...inputStyle, borderColor: focus ? "#2563EB" : "#E2E8F0", ...(props.style || {}) }}
    />
  );
}

function Button(props) {
  const children = props.children;
  const variant = props.variant || "primary";
  const style = props.style;
  const rest = {};
  Object.keys(props).forEach((k) => {
    if (k !== "children" && k !== "variant" && k !== "style") rest[k] = props[k];
  });
  const variants = {
    primary: { background: "#2563EB", color: "#fff", border: "none" },
    ghost: { background: "#fff", color: "#334155", border: "1.5px solid #E2E8F0" },
    danger: { background: "#FEF2F2", color: "#DC2626", border: "1.5px solid #FECACA" },
    success: { background: "#16A34A", color: "#fff", border: "none" },
  };
  return (
    <button
      {...rest}
      style={{
        ...variants[variant],
        padding: "10px 18px",
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        transition: "filter .15s, transform .1s",
        ...style,
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {children}
    </button>
  );
}

function StatCard({ icon: IconCmp, label, value, delta, color }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16, padding: "20px 22px", flex: 1,
      border: "1px solid #EEF1F6", minWidth: 180,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 13, color: "#64748B", fontWeight: 600, marginBottom: 10 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#1E293B" }}>{value}</div>
        </div>
        <div style={{
          width: 42, height: 42, borderRadius: 12, background: color + "1A",
          display: "flex", alignItems: "center", justifyContent: "center", color,
        }}>
          <IconCmp size={20} />
        </div>
      </div>
      {delta && <div style={{ fontSize: 12, color: "#16A34A", marginTop: 10, fontWeight: 600 }}>{delta}</div>}
    </div>
  );
}

function Badge({ children, tone = "blue" }) {
  const tones = {
    blue: { bg: "#EFF6FF", fg: "#2563EB" },
    green: { bg: "#F0FDF4", fg: "#16A34A" },
    orange: { bg: "#FFFBEB", fg: "#D97706" },
    red: { bg: "#FEF2F2", fg: "#DC2626" },
    gray: { bg: "#F1F5F9", fg: "#475569" },
  };
  const t = tones[tone];
  return (
    <span style={{
      background: t.bg, color: t.fg, fontSize: 12, fontWeight: 700,
      padding: "4px 10px", borderRadius: 999, display: "inline-block",
    }}>
      {children}
    </span>
  );
}

/* ---------------------------------------------------------
   Sidebar (shared across teacher screens)
--------------------------------------------------------- */

function Sidebar({ active, onNavigate, onLogout, teacherName }) {
  const items = [
    { key: "dashboard", label: "داشبورد", icon: LayoutDashboard },
    { key: "exams", label: "آزمون‌ها", icon: FileText },
    { key: "questionbank", label: "بانک سوال", icon: Library },
    { key: "classes", label: "کلاس‌ها", icon: Users },
    { key: "students", label: "دانش‌آموزان", icon: Users },
    { key: "messages", label: "پیام‌ها", icon: MessageSquare },
    { key: "results", label: "نتایج", icon: BarChart3 },
    { key: "settings", label: "تنظیمات", icon: Settings },
  ];
  return (
    <div style={{
      width: 230, background: "#132A52", minHeight: "100%", display: "flex",
      flexDirection: "column", flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "22px 20px", borderBottom: "1px solid #22385F" }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <GraduationCap size={19} color="#fff" />
        </div>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>آزمون‌ساز</span>
      </div>
      <div style={{ padding: "14px 12px", flex: 1 }}>
        {items.map((it) => {
          const isActive = active === it.key;
          const IconCmp = it.icon;
          return (
            <div
              key={it.key}
              onClick={() => onNavigate(it.key)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
                borderRadius: 10, cursor: "pointer", marginBottom: 4,
                background: isActive ? "#2563EB" : "transparent",
                color: isActive ? "#fff" : "#AAB8D1",
                fontSize: 14, fontWeight: 600, transition: "background .15s",
              }}
            >
              <IconCmp size={17} />
              {it.label}
            </div>
          );
        })}
      </div>
      <div style={{ padding: 12, borderTop: "1px solid #22385F" }}>
        <div style={{ fontSize: 12, color: "#7C8CAE", padding: "6px 14px 12px" }}>{teacherName}</div>
        <div
          onClick={onLogout}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, cursor: "pointer", color: "#F87171", fontSize: 14, fontWeight: 600 }}
        >
          <LogOut size={17} />
          خروج
        </div>
        <div style={{ fontSize: 10, color: "#4B5C81", textAlign: "center", padding: "10px 14px 2px", letterSpacing: 0.3 }}>
          © {new Date().getFullYear()} ghobeishawi — تمامی حقوق محفوظ است
        </div>
      </div>
    </div>
  );
}

function TopBar({ title, teacherName }) {
  const today = new Date().toLocaleDateString("fa-IR");
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 26 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1E293B", margin: 0 }}>{title}</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontSize: 13, color: "#64748B" }}>{today}</span>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#2563EB", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>
          {teacherName?.[0] || "م"}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   AUTH SCREENS
--------------------------------------------------------- */

function EmptyState({ text, actionLabel, onAction }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{ fontSize: 14, color: "#64748B", marginBottom: 16 }}>{text}</div>
      {actionLabel && <Button onClick={onAction}><Plus size={16} />{actionLabel}</Button>}
    </div>
  );
}

/* ---------------------------------------------------------
   EXAMS LIST + CREATE
--------------------------------------------------------- */

function Modal({ title, children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 18, padding: 26, width: "100%", maxWidth: 420, maxHeight: "88vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#1E293B" }}>{title}</div>
          <div
            onClick={onClose}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, cursor: "pointer", marginLeft: -8 }}
          >
            <X size={18} color="#94A3B8" />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   STUDENT PICKER — searchable, grouped by class (used anywhere
   a teacher needs to pick one student out of a long roster)
--------------------------------------------------------- */
function StudentPicker({ classes, roster, value, onChange, placeholder = "— انتخاب دانش‌آموز —" }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const selected = roster.find((r) => r.id === value);
  const selectedClass = selected ? classes.find((c) => c.id === selected.class_id) : null;
  const matches = (s) => s.fullname.toLowerCase().includes(q.trim().toLowerCase());

  const groups = classes
    .map((c) => ({ id: c.id, name: c.name, students: roster.filter((r) => r.class_id === c.id && matches(r)) }))
    .filter((g) => g.students.length > 0);
  const noClassStudents = roster.filter((r) => !classes.some((c) => c.id === r.class_id) && matches(r));

  const close = () => { setOpen(false); setQ(""); };
  const pick = (id) => { onChange(id); close(); };

  const Row = ({ s }) => (
    <div
      onClick={() => pick(s.id)}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderRadius: 8, cursor: "pointer",
        background: value === s.id ? "#EFF6FF" : "transparent",
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: "50%", border: `2px solid ${value === s.id ? "#2563EB" : "#CBD5E1"}`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        {value === s.id && <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#2563EB" }} />}
      </div>
      <span style={{ fontSize: 14, color: "#1E293B" }}>{s.fullname}</span>
    </div>
  );

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        style={{ ...inputStyle, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <span style={{ color: selected ? "#1E293B" : "#94A3B8" }}>
          {selected ? `${selected.fullname}${selectedClass ? ` (${selectedClass.name})` : ""}` : placeholder}
        </span>
        <ChevronLeft size={16} style={{ color: "#94A3B8" }} />
      </div>
      {open && (
        <Modal title="انتخاب دانش‌آموز" onClose={close}>
          <div style={{ position: "relative", marginBottom: 14 }}>
            <Search size={15} style={{ position: "absolute", top: 12, right: 12, color: "#94A3B8" }} />
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="جستجوی نام دانش‌آموز..." style={{ ...inputStyle, paddingRight: 36 }}
            />
          </div>
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {groups.length === 0 && noClassStudents.length === 0 && (
              <div style={{ fontSize: 13, color: "#94A3B8", textAlign: "center", padding: "20px 0" }}>دانش‌آموزی پیدا نشد.</div>
            )}
            {groups.map((g) => (
              <div key={g.id} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", marginBottom: 6, padding: "0 4px" }}>{g.name}</div>
                {g.students.map((s) => <Row key={s.id} s={s} />)}
              </div>
            ))}
            {noClassStudents.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", marginBottom: 6, padding: "0 4px" }}>بدون کلاس</div>
                {noClassStudents.map((s) => <Row key={s.id} s={s} />)}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}


/* ---------------------------------------------------------
   QUESTION MANAGEMENT (add question w/ live preview)
--------------------------------------------------------- */

function parseBulkQuestions(text) {
  const blocks = text.split(/\n\s*(?:---)?\s*\n/).map((b) => b.trim()).filter(Boolean);
  const parsed = [];
  const errors = [];
  blocks.forEach((block, idx) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const qLine = lines.find((l) => /^Q:/i.test(l));
    const typeLine = lines.find((l) => /^TYPE:/i.test(l));
    const isEssay = typeLine && /essay|تشریحی/i.test(typeLine.replace(/^TYPE:/i, "").trim());
    const markLine = lines.find((l) => /^MARK:/i.test(l));
    if (!qLine) { errors.push(idx + 1); return; }
    if (isEssay) {
      const keywordsLine = lines.find((l) => /^KEYWORDS:/i.test(l));
      const answerLine = lines.find((l) => /^ANSWER:/i.test(l));
      parsed.push({
        type: "essay",
        question_text: qLine.replace(/^Q:/i, "").trim(),
        model_answer: answerLine ? answerLine.replace(/^ANSWER:/i, "").trim() : "",
        keywords: keywordsLine ? keywordsLine.replace(/^KEYWORDS:/i, "").trim() : "",
        mark: markLine ? Number(markLine.replace(/^MARK:/i, "").trim()) || 1 : 1,
      });
      return;
    }
    const optA = lines.find((l) => /^A\)/i.test(l));
    const optB = lines.find((l) => /^B\)/i.test(l));
    const optC = lines.find((l) => /^C\)/i.test(l));
    const optD = lines.find((l) => /^D\)/i.test(l));
    const ansLine = lines.find((l) => /^ANSWER:/i.test(l));
    if (!optA || !optB || !optC || !optD || !ansLine) { errors.push(idx + 1); return; }
    const answers = ansLine.replace(/^ANSWER:/i, "").trim().toUpperCase().split(/[,\s]+/).filter(Boolean);
    parsed.push({
      type: answers.length > 1 ? "mc_multi" : "mc",
      question_text: qLine.replace(/^Q:/i, "").trim(),
      option_a: optA.replace(/^A\)/i, "").trim(),
      option_b: optB.replace(/^B\)/i, "").trim(),
      option_c: optC.replace(/^C\)/i, "").trim(),
      option_d: optD.replace(/^D\)/i, "").trim(),
      correct_answer: answers.length === 1 ? answers[0] : undefined,
      correct_answers: answers.length > 1 ? answers : undefined,
      mark: markLine ? Number(markLine.replace(/^MARK:/i, "").trim()) || 1 : 1,
    });
  });
  return { parsed, errors };
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

/* ---------------------------------------------------------
   RESULTS
--------------------------------------------------------- */

function generateCode(existingCodes) {
  let code;
  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
  } while (existingCodes.includes(code));
  return code;
}
