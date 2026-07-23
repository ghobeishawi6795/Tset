/* ---------------------------------------------------------
   DASHBOARD, EXAMS LIST, QUESTIONS, QUESTION BANK
   © ghobeishawi - All rights reserved.
--------------------------------------------------------- */
function DashboardScreen({ teacher, exams, questions, students, answers, onNavigate, onOpenExam }) {
  const myExams = exams.filter((e) => e.teacher_id === teacher.username);
  const myExamIds = new Set(myExams.map((e) => e.id));
  const myQuestions = questions.filter((q) => myExamIds.has(q.exam_id));
  const myAnswerGroups = {};
  answers.forEach((a) => {
    if (!myExamIds.has(a.exam_id)) return;
    const k = a.exam_id + "|" + a.student_id;
    myAnswerGroups[k] = myAnswerGroups[k] || [];
    myAnswerGroups[k].push(a);
  });
  const scores = Object.values(myAnswerGroups).map((list) => {
    const total = list.reduce((s, a) => s + (a.mark || 1), 0);
    const got = list.reduce((s, a) => s + awardedMarkOf(a), 0);
    return total ? (got / total) * 100 : 0;
  });
  const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";
  const sorted = [...myExams].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

  return (
    <div style={{ flex: 1, padding: "30px 34px", overflowY: "auto" }}>
      <TopBar title="داشبورد معلم" teacherName={teacher.fullname} />
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard icon={FileText} label="تعداد آزمون‌ها" value={myExams.length} color="#2563EB" />
        <StatCard icon={Users} label="تعداد دانش‌آموزان" value={students.filter(s=>s.teacher_id===teacher.username).length} color="#0EA5E9" />
        <StatCard icon={ListChecks} label="تعداد سوالات" value={myQuestions.length} color="#8B5CF6" />
        <StatCard icon={Percent} label="میانگین نمرات" value={avgScore === "—" ? "—" : `${avgScore}%`} color="#16A34A" />
      </div>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#1E293B" }}>آزمون‌های اخیر</div>
          <Button variant="ghost" onClick={() => onNavigate("exams")}>مشاهده همه</Button>
        </div>
        {sorted.length === 0 ? (
          <EmptyState text="هنوز آزمونی نساخته‌ای. اولین آزمونت را بساز." actionLabel="ساخت آزمون جدید" onAction={() => onNavigate("exams")} />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "right", color: "#64748B", fontSize: 12, fontWeight: 700 }}>
                <th style={{ padding: "8px 6px" }}>عنوان آزمون</th>
                <th style={{ padding: "8px 6px" }}>تعداد سوال</th>
                <th style={{ padding: "8px 6px" }}>تاریخ ساخت</th>
                <th style={{ padding: "8px 6px" }}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((ex) => (
                <tr key={ex.id} style={{ borderTop: "1px solid #F1F5F9", fontSize: 14 }}>
                  <td style={{ padding: "12px 6px", fontWeight: 700, color: "#1E293B" }}>{ex.title}</td>
                  <td style={{ padding: "12px 6px", color: "#475569" }}>{questions.filter((q) => q.exam_id === ex.id).length}</td>
                  <td style={{ padding: "12px 6px", color: "#475569" }}>{new Date(ex.created_at).toLocaleDateString("fa-IR")}</td>
                  <td style={{ padding: "12px 6px" }}>
                    <span onClick={() => onOpenExam(ex.id)} style={{ color: "#2563EB", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>مدیریت</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ExamsScreen({ teacher, exams, questions, answers, classes = [], onNavigate, onOpenExam, refresh }) {
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [restrictClassIds, setRestrictClassIds] = useState([]);
  const [nameOnlyEntry, setNameOnlyEntry] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [noGoingBack, setNoGoingBack] = useState(false);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [allowRetake, setAllowRetake] = useState(false);
  const [requireFullscreen, setRequireFullscreen] = useState(false);
  const [noCopyPaste, setNoCopyPaste] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cloningId, setCloningId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const copyExamLink = async (examId) => {
    const link = `${window.location.origin}${window.location.pathname}?exam=${examId}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt("این لینک را کپی کن:", link);
    }
    setCopiedId(examId);
    setTimeout(() => setCopiedId((c) => (c === examId ? null : c)), 2000);
  };
  const myExams = exams.filter((e) => e.teacher_id === teacher.username)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const myClasses = classes.filter((c) => c.teacher_id === teacher.username);

  const createExam = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const id = uid();
    const durMin = Number(duration);
    await setJSON(`exam:${id}`, {
      id, title: title.trim(), teacher_id: teacher.username,
      duration_minutes: durMin > 0 ? durMin : null,
      access_code: accessCode.trim() || null,
      opens_at: opensAt ? new Date(opensAt).toISOString() : null,
      closes_at: closesAt ? new Date(closesAt).toISOString() : null,
      restrict_class_ids: nameOnlyEntry ? [] : restrictClassIds,
      entry_mode: nameOnlyEntry ? "name_only" : "code",
      show_answers: showAnswers,
      no_going_back: noGoingBack,
      shuffle_questions: shuffleQuestions,
      shuffle_options: shuffleOptions,
      allow_retake: allowRetake,
      require_fullscreen: requireFullscreen,
      no_copy_paste: noCopyPaste,
      created_at: new Date().toISOString(),
    });
    setSaving(false);
    setTitle("");
    setDuration("");
    setAccessCode("");
    setOpensAt("");
    setClosesAt("");
    setRestrictClassIds([]);
    setNameOnlyEntry(false);
    setShowAnswers(false);
    setNoGoingBack(false);
    setShuffleQuestions(false);
    setShuffleOptions(false);
    setAllowRetake(false);
    setRequireFullscreen(false);
    setNoCopyPaste(false);
    setShowCreate(false);
    await refresh();
    onOpenExam(id);
  };

  const removeExam = async (examId) => {
    await deleteKey(`exam:${examId}`);
    const qs = questions.filter((q) => q.exam_id === examId);
    await Promise.all(qs.map((q) => deleteKey(`question:${q.id}`)));
    const ansStudentIds = new Set(answers.filter((a) => a.exam_id === examId).map((a) => a.student_id));
    await Promise.all([...ansStudentIds].map((sid) => deleteKey(`answers:${sid}`)));
    await refresh();
  };

  const cloneExam = async (ex) => {
    setCloningId(ex.id);
    const newId = uid();
    await setJSON(`exam:${newId}`, {
      ...ex, id: newId, title: ex.title + " (کپی)", created_at: new Date().toISOString(),
    });
    const qs = questions.filter((q) => q.exam_id === ex.id);
    await Promise.all(qs.map((q) => {
      const newQId = uid();
      return setJSON(`question:${newQId}`, { ...q, id: newQId, exam_id: newId });
    }));
    setCloningId(null);
    await refresh();
  };

  return (
    <div style={{ flex: 1, padding: "30px 34px", overflowY: "auto" }}>
      <TopBar title="آزمون‌ها" teacherName={teacher.fullname} />
      <div style={{ marginBottom: 18 }}>
        <Button onClick={() => setShowCreate(true)}><Plus size={16} />ساخت آزمون جدید</Button>
      </div>

      {myExams.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6" }}>
          <EmptyState text="هنوز آزمونی نساخته‌ای." actionLabel="ساخت آزمون جدید" onAction={() => setShowCreate(true)} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 16 }}>
          {myExams.map((ex) => {
            const qCount = questions.filter((q) => q.exam_id === ex.id).length;
            return (
              <div key={ex.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#1E293B", marginBottom: 6 }}>{ex.title}</div>
                  <Badge tone={qCount > 0 ? "green" : "orange"}>{qCount > 0 ? "آماده" : "بدون سوال"}</Badge>
                </div>
                <div style={{ fontSize: 12, color: "#64748B", marginBottom: 10 }}>
                  {qCount} سوال{ex.duration_minutes ? ` · ${ex.duration_minutes} دقیقه` : ""} · ساخته‌شده {new Date(ex.created_at).toLocaleDateString("fa-IR")}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {ex.access_code && <Badge tone="blue">دارای کد دسترسی</Badge>}
                  {ex.entry_mode === "name_only" && <Badge tone="gray">بدون کد — ورود با نام</Badge>}
                  {(ex.restrict_class_ids || (ex.restrict_class_id ? [ex.restrict_class_id] : [])).length > 0 && (
                    <Badge tone="blue">
                      فقط کلاس‌ها: {(ex.restrict_class_ids || [ex.restrict_class_id]).map((id) => classes.find((c) => c.id === id)?.name || "حذف‌شده").join("، ")}
                    </Badge>
                  )}
                  {(ex.opens_at || ex.closes_at) && <Badge tone="blue">دارای بازه‌ی زمانی</Badge>}
                  {ex.show_answers && <Badge tone="gray">نمایش پاسخ بعد از آزمون</Badge>}
                  {ex.no_going_back && <Badge tone="orange">بدون بازگشت به سوال قبل</Badge>}
                  {ex.shuffle_questions && <Badge tone="gray">ترتیب تصادفی سوال</Badge>}
                  {ex.shuffle_options && <Badge tone="gray">ترتیب تصادفی گزینه</Badge>}
                  {ex.allow_retake && <Badge tone="gray">شرکت چندباره مجاز</Badge>}
                  {ex.require_fullscreen && <Badge tone="gray">تمام‌صفحه</Badge>}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button variant="ghost" style={{ fontSize: 13, padding: "8px 12px" }} onClick={() => onOpenExam(ex.id)}>مدیریت سوالات</Button>
                  <Button variant="ghost" style={{ fontSize: 13, padding: "8px 12px" }} onClick={() => onNavigate("results", ex.id)}>نتایج</Button>
                  <Button
                    variant={copiedId === ex.id ? "primary" : "ghost"}
                    style={{ fontSize: 13, padding: "8px 12px" }}
                    onClick={() => copyExamLink(ex.id)}
                    disabled={qCount === 0}
                    title={qCount === 0 ? "اول یک سوال اضافه کن" : "کپی لینک آزمون برای دانش‌آموزان"}
                  >
                    {copiedId === ex.id ? "کپی شد ✓" : "کپی لینک آزمون"}
                  </Button>
                  <Button variant="ghost" style={{ fontSize: 13, padding: "8px 10px" }} onClick={() => cloneExam(ex)} disabled={cloningId === ex.id}>
                    {cloningId === ex.id ? "..." : "کپی آزمون"}
                  </Button>
                  <Button variant="danger" style={{ fontSize: 13, padding: "8px 10px" }} onClick={() => removeExam(ex.id)}><Trash2 size={14} /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} title="ساخت آزمون جدید">
          <Field label="عنوان آزمون">
            <TextInput autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: ریاضی فصل ۴" onKeyDown={(e) => e.key === "Enter" && createExam()} />
          </Field>
          <Field label="مدت زمان آزمون به دقیقه (اختیاری — خالی بگذار برای بدون محدودیت)">
            <TextInput type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="مثلاً: ۲۰" />
          </Field>
          <Field label="کد دسترسی (اختیاری — دانش‌آموز باید این کد را وارد کند)">
            <TextInput value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="مثلاً: 1404" />
          </Field>
          <Field label="زمان باز شدن آزمون (اختیاری)">
            <TextInput type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
          </Field>
          <Field label="زمان بسته شدن آزمون (اختیاری)">
            <TextInput type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          </Field>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer" }} onClick={() => setNameOnlyEntry((s) => !s)}>
            {nameOnlyEntry ? <CheckCircle2 size={18} color="#2563EB" /> : <Circle size={18} color="#CBD5E1" />}
            <span style={{ fontSize: 13, color: "#334155" }}>بدون کد — دانش‌آموزان (یا هرکسی) فقط با نام وارد شوند (مناسب پرسشنامه)</span>
          </div>
          {!nameOnlyEntry && (
            <Field label="محدود کردن به کلاس‌های خاص (اختیاری — می‌توانی چند کلاس انتخاب کنی)">
              <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "#F8FAFC", borderRadius: 10, padding: 10 }}>
                {myClasses.length === 0 && (
                  <div style={{ fontSize: 11.5, color: "#94A3B8" }}>
                    هنوز کلاسی نساخته‌ای؛ اول از بخش «کلاس‌ها» یک کلاس و دانش‌آموزانش را اضافه کن.
                  </div>
                )}
                {myClasses.map((c) => {
                  const checked = restrictClassIds.includes(c.id);
                  return (
                    <div key={c.id} onClick={() => setRestrictClassIds((ids) => checked ? ids.filter((x) => x !== c.id) : [...ids, c.id])}
                      style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      {checked ? <CheckCircle2 size={16} color="#2563EB" /> : <Circle size={16} color="#CBD5E1" />}
                      <span style={{ fontSize: 13, color: "#334155" }}>{c.name}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 6 }}>
                اگر هیچ کلاسی انتخاب نکنی، همه‌ی دانش‌آموزان با کد خودشان می‌توانند شرکت کنند.
              </div>
            </Field>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer" }} onClick={() => setShowAnswers((s) => !s)}>
            {showAnswers ? <CheckCircle2 size={18} color="#2563EB" /> : <Circle size={18} color="#CBD5E1" />}
            <span style={{ fontSize: 13, color: "#334155" }}>نمایش پاسخ‌های صحیح به دانش‌آموز بعد از پایان آزمون</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer" }} onClick={() => setNoGoingBack((s) => !s)}>
            {noGoingBack ? <CheckCircle2 size={18} color="#2563EB" /> : <Circle size={18} color="#CBD5E1" />}
            <span style={{ fontSize: 13, color: "#334155" }}>عدم امکان بازگشت به سوالات قبلی</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer" }} onClick={() => setShuffleQuestions((s) => !s)}>
            {shuffleQuestions ? <CheckCircle2 size={18} color="#2563EB" /> : <Circle size={18} color="#CBD5E1" />}
            <span style={{ fontSize: 13, color: "#334155" }}>ترتیب سوالات برای هر دانش‌آموز تصادفی باشد</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer" }} onClick={() => setShuffleOptions((s) => !s)}>
            {shuffleOptions ? <CheckCircle2 size={18} color="#2563EB" /> : <Circle size={18} color="#CBD5E1" />}
            <span style={{ fontSize: 13, color: "#334155" }}>ترتیب گزینه‌ها برای هر دانش‌آموز تصادفی باشد</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer" }} onClick={() => setAllowRetake((s) => !s)}>
            {allowRetake ? <CheckCircle2 size={18} color="#2563EB" /> : <Circle size={18} color="#CBD5E1" />}
            <span style={{ fontSize: 13, color: "#334155" }}>اجازه‌ی شرکت چندباره با یک نام</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer" }} onClick={() => setNoCopyPaste((s) => !s)}>
            {noCopyPaste ? <CheckCircle2 size={18} color="#2563EB" /> : <Circle size={18} color="#CBD5E1" />}
            <span style={{ fontSize: 13, color: "#334155" }}>غیرفعال کردن کپی/پیست حین آزمون</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, cursor: "pointer" }} onClick={() => setRequireFullscreen((s) => !s)}>
            {requireFullscreen ? <CheckCircle2 size={18} color="#2563EB" /> : <Circle size={18} color="#CBD5E1" />}
            <span style={{ fontSize: 13, color: "#334155" }}>درخواست حالت تمام‌صفحه هنگام شروع (بازدارنده، نه تضمینی)</span>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>انصراف</Button>
            <Button onClick={createExam} disabled={saving}>{saving ? "در حال ساخت..." : "ادامه و افزودن سوال"}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function QuestionsScreen({ exam, questions, exams, teacher, onBack, refresh }) {
  const examQuestions = questions.filter((q) => q.exam_id === exam.id);
  const [qType, setQType] = useState("mc"); // 'mc' | 'mc_multi' | 'essay'
  const [qText, setQText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0); // single-answer index
  const [correctMulti, setCorrectMulti] = useState([]); // multi-answer indices
  const [modelAnswer, setModelAnswer] = useState("");
  const [keywords, setKeywords] = useState("");
  const [mark, setMark] = useState(1);
  const [tags, setTags] = useState("");
  const [section, setSection] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterTag, setFilterTag] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [showCopyFrom, setShowCopyFrom] = useState(false);
  const [copySourceExam, setCopySourceExam] = useState("");
  const [copySelected, setCopySelected] = useState([]);
  const [showAddFromBank, setShowAddFromBank] = useState(false);
  const [bankSelected, setBankSelected] = useState([]);
  const [aiMode, setAiMode] = useState("text"); // 'text' | 'image'
  const [aiSourceText, setAiSourceText] = useState("");
  const [aiImageData, setAiImageData] = useState(""); // base64 (no data-url prefix)
  const [aiImageName, setAiImageName] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiQType, setAiQType] = useState("mc"); // 'mc' | 'essay' | 'mixed'
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiLicenseLoading, setAiLicenseLoading] = useState(false);
  const [aiLicenseMsg, setAiLicenseMsg] = useState("");

  const acceptAiLicense = async () => {
    setAiLicenseMsg("");
    setAiLicenseLoading(true);
    try {
      const r = await fetch("/api/ai/accept-license", { method: "POST", headers: authHeaders() });
      const data = await r.json().catch(() => ({}));
      setAiLicenseMsg(r.ok ? "انجام شد — حالا «تولید سوال» رو دوباره امتحان کن." : (data.error || "فعال‌سازی با خطا مواجه شد."));
    } catch {
      setAiLicenseMsg("اتصال برقرار نشد.");
    }
    setAiLicenseLoading(false);
  };

  const generateWithAI = async () => {
    setAiError("");
    if (aiMode === "text" && !aiSourceText.trim()) { setAiError("یه متن وارد کن."); return; }
    if (aiMode === "image" && !aiImageData) { setAiError("یه تصویر انتخاب کن."); return; }
    setAiLoading(true);
    try {
      const r = await fetch("/api/ai/generate-questions", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          mode: aiMode,
          sourceText: aiMode === "text" ? aiSourceText : undefined,
          imageBase64: aiMode === "image" ? aiImageData : undefined,
          count: aiCount,
          questionType: aiQType,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setAiError(data.error || "تولید سوال با خطا مواجه شد."); setAiLoading(false); return; }
      setBulkText((prev) => (prev ? prev + "\n\n" : "") + data.text);
    } catch {
      setAiError("اتصال برقرار نشد. دوباره امتحان کن.");
    }
    setAiLoading(false);
  };

  const letters = ["A", "B", "C", "D"];

  const resetForm = () => {
    setQType("mc"); setQText(""); setImageUrl(""); setOptions(["", "", "", ""]);
    setCorrect(0); setCorrectMulti([]); setModelAnswer(""); setKeywords(""); setMark(1); setTags(""); setSection(""); setEditingId(null);
  };

  const startEdit = (q) => {
    setEditingId(q.id);
    setQType(q.type || "mc");
    setQText(q.question_text);
    setImageUrl(q.image_url || "");
    setOptions([q.option_a || "", q.option_b || "", q.option_c || "", q.option_d || ""]);
    setCorrect(["A", "B", "C", "D"].indexOf(q.correct_answer) >= 0 ? ["A", "B", "C", "D"].indexOf(q.correct_answer) : 0);
    setCorrectMulti((q.correct_answers || []).map((l) => ["A", "B", "C", "D"].indexOf(l)).filter((i) => i >= 0));
    setModelAnswer(q.model_answer || "");
    setKeywords((q.keywords || []).join(", "));
    setMark(q.mark || 1);
    setTags((q.tags || []).join(", "));
    setSection(q.section || "");
  };

  const toggleCorrectMulti = (i) => {
    setCorrectMulti((arr) => arr.includes(i) ? arr.filter((x) => x !== i) : [...arr, i]);
  };

  const saveQuestion = async () => {
    if (!qText.trim()) return;
    if ((qType === "mc" || qType === "mc_multi") && options.some((o) => !o.trim())) return;
    if (qType === "mc_multi" && correctMulti.length === 0) return;
    setSaving(true);
    const id = editingId || uid();
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = {
      id, exam_id: exam.id,
      type: qType,
      question_text: qText.trim(),
      image_url: imageUrl.trim() || null,
      mark: Number(mark) || 1,
      tags: tagList,
      section: section.trim() || null,
    };
    if (qType === "mc") {
      payload.option_a = options[0]; payload.option_b = options[1];
      payload.option_c = options[2]; payload.option_d = options[3];
      payload.correct_answer = ["A", "B", "C", "D"][correct];
    } else if (qType === "mc_multi") {
      payload.option_a = options[0]; payload.option_b = options[1];
      payload.option_c = options[2]; payload.option_d = options[3];
      payload.correct_answers = correctMulti.map((i) => ["A", "B", "C", "D"][i]);
    } else {
      payload.model_answer = modelAnswer.trim() || null;
      payload.keywords = keywords.split(",").map((k) => k.trim()).filter(Boolean);
    }
    await setJSON(`question:${id}`, payload);
    setSaving(false);
    resetForm();
    await refresh();
  };

  const removeQuestion = async (id) => {
    await deleteKey(`question:${id}`);
    if (editingId === id) resetForm();
    await refresh();
  };

  // Bulk import format, one block per question separated by a blank line or "---":
  //   Q: question text
  //   A) option
  //   B) option
  //   C) option
  //   D) option
  //   ANSWER: B
  //   MARK: 2
  const parseBulk = (text) => {
    const blocks = text.split(/\n\s*(?:---)?\s*\n/).map((b) => b.trim()).filter(Boolean);
    const parsed = [];
    const errors = [];
    blocks.forEach((block, idx) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      const qLine = lines.find((l) => /^Q:/i.test(l));
      const typeLine = lines.find((l) => /^TYPE:/i.test(l));
      const isEssay = typeLine && /essay|تشریحی/i.test(typeLine.replace(/^TYPE:/i, "").trim());
      const markLine = lines.find((l) => /^MARK:/i.test(l));
      const sectionLine = lines.find((l) => /^SECTION:/i.test(l));
      const sectionVal = sectionLine ? sectionLine.replace(/^SECTION:/i, "").trim() : null;
      if (!qLine) {
        errors.push(idx + 1);
        return;
      }
      if (isEssay) {
        const keywordsLine = lines.find((l) => /^KEYWORDS:/i.test(l));
        const answerLine = lines.find((l) => /^ANSWER:/i.test(l));
        parsed.push({
          type: "essay",
          question_text: qLine.replace(/^Q:/i, "").trim(),
          model_answer: answerLine ? answerLine.replace(/^ANSWER:/i, "").trim() : "",
          keywords: keywordsLine ? keywordsLine.replace(/^KEYWORDS:/i, "").trim() : "",
          mark: markLine ? Number(markLine.replace(/^MARK:/i, "").trim()) || 1 : 1,
          section: sectionVal,
        });
        return;
      }
      const optA = lines.find((l) => /^A\)/i.test(l));
      const optB = lines.find((l) => /^B\)/i.test(l));
      const optC = lines.find((l) => /^C\)/i.test(l));
      const optD = lines.find((l) => /^D\)/i.test(l));
      const ansLine = lines.find((l) => /^ANSWER:/i.test(l));
      if (!optA || !optB || !optC || !optD || !ansLine) {
        errors.push(idx + 1);
        return;
      }
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
        section: sectionVal,
      });
    });
    return { parsed, errors };
  };

  const runBulkImport = async () => {
    const { parsed, errors } = parseBulk(bulkText);
    if (parsed.length === 0) {
      setBulkError("هیچ سوال معتبری پیدا نشد. فرمت را بررسی کن.");
      return;
    }
    await Promise.all(parsed.map((p) => setJSON(`question:${uid()}`, { id: uid(), exam_id: exam.id, tags: [], ...p })));
    setBulkError(errors.length > 0 ? `${parsed.length} سوال اضافه شد؛ ${errors.length} بلوک نامعتبر نادیده گرفته شد.` : "");
    setBulkText("");
    await refresh();
    if (errors.length === 0) setShowBulkImport(false);
  };

  const otherExams = (exams || []).filter((e) => e.teacher_id === teacher.username && e.id !== exam.id);
  const sourceQuestions = copySourceExam ? questions.filter((q) => q.exam_id === copySourceExam) : [];
  const bankQuestions = questions.filter((q) => !q.exam_id && q.owner_id === teacher.username);

  const runCopyFrom = async () => {
    const toCopy = sourceQuestions.filter((q) => copySelected.includes(q.id));
    await Promise.all(toCopy.map((q) => {
      const { id, exam_id, ...rest } = q;
      return setJSON(`question:${uid()}`, { id: uid(), exam_id: exam.id, ...rest });
    }));
    setShowCopyFrom(false);
    setCopySelected([]);
    setCopySourceExam("");
    await refresh();
  };

  const runAddFromBank = async () => {
    const toAdd = bankQuestions.filter((q) => bankSelected.includes(q.id));
    await Promise.all(toAdd.map((q) => {
      const { id, exam_id, owner_id, ...rest } = q;
      return setJSON(`question:${uid()}`, { id: uid(), exam_id: exam.id, ...rest });
    }));
    setShowAddFromBank(false);
    setBankSelected([]);
    await refresh();
  };

  const printExamPaper = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const printSections = [...new Set(examQuestions.map((q) => q.section || null))];
    const hasSections = printSections.some((s) => s);
    let counter = 0;
    const rows = printSections.map((sec) => {
      const items = examQuestions.filter((q) => (q.section || null) === sec);
      const header = hasSections ? `<div style="font-weight:800;font-size:15px;margin:18px 0 10px;padding-bottom:6px;border-bottom:1px solid #ccc">${sec || "سایر سوالات"}</div>` : "";
      const body = items.map((q) => {
        counter += 1;
        const opts = q.type === "essay" ? "" : `
          <div style="margin-top:6px;line-height:2">
            ${["A", "B", "C", "D"].map((L, i) => `<div>${letters[i]}) ${[q.option_a, q.option_b, q.option_c, q.option_d][i] || ""}</div>`).join("")}
          </div>`;
        return `<div style="margin-bottom:22px;page-break-inside:avoid">
          <div style="font-weight:700">${counter}. ${q.question_text} <span style="font-weight:400;color:#666">(${q.mark} نمره)</span></div>
          ${opts}
          ${q.type === "essay" ? '<div style="border-bottom:1px solid #999;height:70px;margin-top:8px"></div>' : ""}
        </div>`;
      }).join("");
      return header + body;
    }).join("");
    win.document.write(`<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><title>${exam.title}</title>
      <style>body{font-family:Tahoma,sans-serif;padding:30px;color:#111}h1{font-size:20px;border-bottom:2px solid #111;padding-bottom:10px}</style>
      </head><body><h1>${exam.title}</h1><p>نام و نام‌خانوادگی: ......................................</p>${rows}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const allTags = [...new Set(examQuestions.flatMap((q) => q.tags || []))];
  const allSections = [...new Set(examQuestions.map((q) => q.section).filter(Boolean))];
  const visibleQuestions = examQuestions
    .filter((q) => !filterTag || (q.tags || []).includes(filterTag))
    .filter((q) => !filterSection || q.section === filterSection);
  const sectionOrder = [...new Set(visibleQuestions.map((q) => q.section || null))];
  const groupedQuestions = sectionOrder.map((sec) => ({
    section: sec,
    items: visibleQuestions.filter((q) => (q.section || null) === sec),
  }));

  return (
    <div style={{ flex: 1, padding: "30px 34px", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748B", marginBottom: 6, cursor: "pointer" }} onClick={onBack}>
        <ArrowRight size={15} /> بازگشت به آزمون‌ها
      </div>
      <TopBar title={`سوالات — ${exam.title}`} teacherName={teacher.fullname} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <Button variant="ghost" style={{ fontSize: 13 }} onClick={() => setShowBulkImport(true)}><Plus size={14} />وارد کردن دسته‌ای</Button>
        {otherExams.length > 0 && (
          <Button variant="ghost" style={{ fontSize: 13 }} onClick={() => setShowCopyFrom(true)}><Download size={14} />کپی سوال از آزمون دیگر</Button>
        )}
        {bankQuestions.length > 0 && (
          <Button variant="ghost" style={{ fontSize: 13 }} onClick={() => setShowAddFromBank(true)}><Library size={14} />افزودن از بانک سوال</Button>
        )}
        {examQuestions.length > 0 && (
          <Button variant="ghost" style={{ fontSize: 13 }} onClick={printExamPaper}><FileText size={14} />چاپ برگه‌ی آزمون</Button>
        )}
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 420px", background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B" }}>{editingId ? "ویرایش سوال" : "افزودن سوال جدید"}</div>
            {editingId && <span onClick={resetForm} style={{ fontSize: 12, color: "#64748B", cursor: "pointer" }}>لغو ویرایش</span>}
          </div>
          <Field label="نوع سوال">
            <div style={{ display: "flex", gap: 8 }}>
              <div onClick={() => setQType("mc")} style={{
                flex: 1, textAlign: "center", padding: "9px 4px", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700,
                background: qType === "mc" ? "#2563EB" : "#F1F5F9", color: qType === "mc" ? "#fff" : "#475569",
              }}>چهارگزینه‌ای</div>
              <div onClick={() => setQType("mc_multi")} style={{
                flex: 1, textAlign: "center", padding: "9px 4px", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700,
                background: qType === "mc_multi" ? "#2563EB" : "#F1F5F9", color: qType === "mc_multi" ? "#fff" : "#475569",
              }}>چندجوابی</div>
              <div onClick={() => setQType("essay")} style={{
                flex: 1, textAlign: "center", padding: "9px 4px", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700,
                background: qType === "essay" ? "#2563EB" : "#F1F5F9", color: qType === "essay" ? "#fff" : "#475569",
              }}>تشریحی</div>
            </div>
          </Field>
          <Field label="متن سوال">
            <textarea value={qText} onChange={(e) => setQText(e.target.value)} placeholder="مثلاً: حاصل 2×3+5 چقدر است؟" rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </Field>
          <Field label="آدرس تصویر (اختیاری)">
            <TextInput value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="لینک یک تصویر برای این سوال" />
          </Field>
          {qType !== "essay" ? (
            <Field label={qType === "mc_multi" ? "گزینه‌ها (همه‌ی پاسخ‌های صحیح را انتخاب کن)" : "گزینه‌ها (پاسخ صحیح را انتخاب کن)"}>
              {options.map((opt, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span onClick={() => qType === "mc_multi" ? toggleCorrectMulti(i) : setCorrect(i)} style={{ cursor: "pointer", color: (qType === "mc_multi" ? correctMulti.includes(i) : correct === i) ? "#16A34A" : "#CBD5E1", flexShrink: 0 }}>
                    {(qType === "mc_multi" ? correctMulti.includes(i) : correct === i) ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#64748B", width: 16 }}>{letters[i]}</span>
                  <TextInput value={opt} onChange={(e) => {
                    const arr = [...options]; arr[i] = e.target.value; setOptions(arr);
                  }} placeholder={`گزینه ${letters[i]}`} />
                </div>
              ))}
            </Field>
          ) : (
            <>
              <Field label="پاسخ نمونه (اختیاری — فقط برای مرور خودت، در تصحیح دستی می‌بینی)">
                <textarea value={modelAnswer} onChange={(e) => setModelAnswer(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
              </Field>
              <Field label="کلمات کلیدی برای تصحیح خودکار (اختیاری — با ویرگول جدا کن)">
                <TextInput value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="مثلاً: فتوسنتز, کلروفیل, نور خورشید" />
                <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 6 }}>
                  هنگام تصحیح، سیستم می‌تواند بر اساس تعداد این کلمات که در پاسخ دانش‌آموز پیدا می‌شود، نمره‌ی پیشنهادی بدهد؛ نمره‌ی نهایی همیشه با خودت است.
                </div>
              </Field>
            </>
          )}
          <Field label="نمره این سوال">
            <TextInput type="number" min={1} value={mark} onChange={(e) => setMark(e.target.value)} style={{ maxWidth: 120 }} />
          </Field>
          <Field label="بخش (اختیاری — مثلاً: قلمرو زبانی)">
            <TextInput value={section} onChange={(e) => setSection(e.target.value)} placeholder="مثلاً: قلمرو زبانی" list="section-suggestions" />
            {allSections.length > 0 && (
              <datalist id="section-suggestions">
                {allSections.map((s) => <option key={s} value={s} />)}
              </datalist>
            )}
            <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 6 }}>
              سوال‌هایی که بخش یکسان دارند در آزمون و نتایج زیر یک عنوان گروه می‌شوند.
            </div>
          </Field>
          <Field label="برچسب‌ها (اختیاری — با ویرگول جدا کن)">
            <TextInput value={tags} onChange={(e) => setTags(e.target.value)} placeholder="مثلاً: جبر, فصل ۴" />
          </Field>
          <Button onClick={saveQuestion} disabled={saving} style={{ width: "100%", justifyContent: "center" }}>
            {editingId ? <Check size={16} /> : <Plus size={16} />}
            {saving ? "در حال ذخیره..." : editingId ? "ذخیره تغییرات" : "افزودن سوال"}
          </Button>
        </div>

        <div style={{ flex: "0 1 320px", background: "#F8FAFC", borderRadius: 16, border: "1px dashed #CBD5E1", padding: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#64748B", marginBottom: 12 }}>پیش‌نمایش سوال</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", marginBottom: 12, minHeight: 40 }}>
            {qText || "متن سوال اینجا نمایش داده می‌شود..."}
          </div>
          {imageUrl && (
            <img src={imageUrl} alt="" style={{ width: "100%", borderRadius: 10, marginBottom: 12, display: "block" }}
              onError={(e) => { e.target.style.display = "none"; }} />
          )}
          {qType !== "essay" ? options.map((opt, i) => {
            const isCorrect = qType === "mc_multi" ? correctMulti.includes(i) : correct === i;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, marginBottom: 6, background: isCorrect ? "#F0FDF4" : "#fff", border: "1px solid " + (isCorrect ? "#BBF7D0" : "#E2E8F0") }}>
                {isCorrect ? <CheckCircle2 size={16} color="#16A34A" /> : <Circle size={16} color="#CBD5E1" />}
                <span style={{ fontSize: 13, color: "#334155" }}>{letters[i]}. {opt || "—"}</span>
              </div>
            );
          }) : (
            <div style={{ fontSize: 12, color: "#94A3B8", padding: "10px 0" }}>دانش‌آموز پاسخ خود را به‌صورت متنی وارد می‌کند (تصحیح دستی).</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B" }}>
            سوالات این آزمون ({examQuestions.length})
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {allSections.length > 0 && (
              <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 12 }}>
                <option value="">همه بخش‌ها</option>
                {allSections.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {allTags.length > 0 && (
              <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 12 }}>
                <option value="">همه برچسب‌ها</option>
                {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>
        </div>
        {visibleQuestions.length === 0 ? (
          <div style={{ fontSize: 13, color: "#94A3B8" }}>هنوز سوالی اضافه نشده.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {groupedQuestions.map(({ section: sec, items }) => (
              <div key={sec || "__none__"}>
                {allSections.length > 0 && (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #EEF1F6" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: "#2563EB" }}>{sec || "بدون بخش"}</span>
                    <span style={{ fontSize: 11.5, color: "#94A3B8" }}>
                      {items.length} سوال · {items.reduce((s, q) => s + (q.mark || 0), 0)} نمره
                    </span>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {items.map((q) => (
                    <div key={q.id} style={{ background: "#fff", border: "1px solid #EEF1F6", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{visibleQuestions.indexOf(q) + 1}. {q.question_text}</div>
                        <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
                          {q.type === "essay" ? "پاسخ تشریحی" : q.type === "mc_multi" ? `پاسخ‌های صحیح: ${(q.correct_answers || []).join("، ")}` : `پاسخ صحیح: ${q.correct_answer}`} · نمره: {q.mark}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                          {q.type === "essay" && <Badge tone="blue">تشریحی</Badge>}
                          {q.type === "mc_multi" && <Badge tone="blue">چندجوابی</Badge>}
                          {q.image_url && <Badge tone="gray">دارای تصویر</Badge>}
                          {(q.tags || []).map((t) => <Badge key={t} tone="gray">{t}</Badge>)}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 14, flexShrink: 0 }}>
                        <Edit2 size={16} style={{ cursor: "pointer", color: "#64748B" }} onClick={() => startEdit(q)} />
                        <Trash2 size={16} style={{ cursor: "pointer", color: "#F87171" }} onClick={() => removeQuestion(q.id)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showBulkImport && (
        <Modal title="وارد کردن دسته‌ای سوال" onClose={() => setShowBulkImport(false)}>
          <div style={{ border: "1px solid #DBEAFE", background: "#EFF6FF", borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1E3A8A", marginBottom: 8 }}>✨ تولید سوال با هوش مصنوعی</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button type="button" onClick={() => setAiMode("text")} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "1px solid #BFDBFE", background: aiMode === "text" ? "#2563EB" : "#fff", color: aiMode === "text" ? "#fff" : "#1E3A8A", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>از متن</button>
              <button type="button" onClick={() => setAiMode("image")} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "1px solid #BFDBFE", background: aiMode === "image" ? "#2563EB" : "#fff", color: aiMode === "image" ? "#fff" : "#1E3A8A", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>از عکس (اسکن صفحه)</button>
            </div>
            {aiMode === "text" ? (
              <textarea
                value={aiSourceText}
                onChange={(e) => setAiSourceText(e.target.value)}
                rows={5}
                style={{ ...inputStyle, resize: "vertical", fontSize: 12.5, marginBottom: 8 }}
                placeholder="متن درس یا جزوه رو این‌جا پیست کن..."
              />
            ) : (
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "#2563EB", cursor: "pointer" }}>
                  <Upload size={14} />
                  {aiImageName || "انتخاب عکس صفحه"}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files && e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const dataUrl = String(ev.target.result || "");
                        setAiImageData(dataUrl.split(",")[1] || "");
                        setAiImageName(file.name);
                      };
                      reader.readAsDataURL(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={acceptAiLicense}
                    disabled={aiLicenseLoading}
                    style={{ fontSize: 11.5, color: "#2563EB", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}
                  >
                    {aiLicenseLoading ? "در حال فعال‌سازی..." : "اگه اولین باره از عکس استفاده می‌کنی و خطا گرفتی، اول این‌جا رو بزن (فعال‌سازی یک‌باره)"}
                  </button>
                  {aiLicenseMsg && <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 4 }}>{aiLicenseMsg}</div>}
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <select value={aiQType} onChange={(e) => setAiQType(e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 12.5 }}>
                <option value="mc">چهارگزینه‌ای</option>
                <option value="essay">تشریحی</option>
                <option value="mixed">ترکیبی</option>
              </select>
              <select value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))} style={{ ...inputStyle, width: 90, fontSize: 12.5 }}>
                {[3, 5, 8, 10, 15].map((n) => <option key={n} value={n}>{n} سوال</option>)}
              </select>
            </div>
            {aiError && <div style={{ color: "#DC2626", fontSize: 12, marginBottom: 8 }}>{aiError}</div>}
            <Button type="button" onClick={generateWithAI} disabled={aiLoading} style={{ width: "100%", justifyContent: "center" }}>
              {aiLoading ? "در حال تولید..." : "تولید سوال"}
            </Button>
            <div style={{ fontSize: 11, color: "#64748B", marginTop: 6 }}>
              سوال‌های تولیدشده پایین اضافه می‌شن — قبل از «افزودن سوالات» حتماً بازبینی‌شون کن، چون ممکنه هوش مصنوعی اشتباه کنه.
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#64748B", marginBottom: 10, lineHeight: 1.8, background: "#F8FAFC", padding: 10, borderRadius: 8 }}>
            برای سوال چندگزینه‌ای:
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, marginTop: 6 }}>{`Q: متن سوال
A) گزینه یک
B) گزینه دو
C) گزینه سه
D) گزینه چهار
ANSWER: B
MARK: 2
SECTION: قلمرو زبانی`}</pre>
            برای سوال تشریحی:
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, marginTop: 6 }}>{`Q: متن سوال
TYPE: ESSAY
ANSWER: پاسخ نمونه (اختیاری)
KEYWORDS: کلمه۱, کلمه۲ (اختیاری)
MARK: 2
SECTION: قلمرو زبانی`}</pre>
            خط SECTION اختیاری است. بین هر دو سوال یک خط خالی بگذار.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: "#2563EB", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Upload size={14} />
              آپلود فایل متنی
              <input
                type="file"
                accept=".txt,text/plain"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files && e.target.files[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => setBulkText((prev) => (prev ? prev + "\n\n" : "") + String(ev.target.result || ""));
                  reader.readAsText(file, "UTF-8");
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={10} style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 12 }} placeholder="سوالات را اینجا پیست کن، یا از دکمه‌ی بالا یک فایل متنی آپلود کن..." />
          {bulkError && <div style={{ color: "#D97706", fontSize: 12, marginTop: 8 }}>{bulkError}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
            <Button variant="ghost" onClick={() => setShowBulkImport(false)}>انصراف</Button>
            <Button onClick={runBulkImport}>افزودن سوالات</Button>
          </div>
        </Modal>
      )}

      {showCopyFrom && (
        <Modal title="کپی سوال از آزمون دیگر" onClose={() => setShowCopyFrom(false)}>
          <Field label="انتخاب آزمون مبدأ">
            <select value={copySourceExam} onChange={(e) => { setCopySourceExam(e.target.value); setCopySelected([]); }} style={{ ...inputStyle }}>
              <option value="">— انتخاب کن —</option>
              {otherExams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </Field>
          {sourceQuestions.length > 0 && (
            <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              {sourceQuestions.map((q) => (
                <div key={q.id} onClick={() => setCopySelected((s) => s.includes(q.id) ? s.filter((x) => x !== q.id) : [...s, q.id])}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: copySelected.includes(q.id) ? "#EFF6FF" : "#F8FAFC" }}>
                  {copySelected.includes(q.id) ? <CheckCircle2 size={16} color="#2563EB" /> : <Circle size={16} color="#CBD5E1" />}
                  <span style={{ fontSize: 13, color: "#334155" }}>{q.question_text}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setShowCopyFrom(false)}>انصراف</Button>
            <Button onClick={runCopyFrom} disabled={copySelected.length === 0}>افزودن {copySelected.length > 0 ? `(${copySelected.length})` : ""}</Button>
          </div>
        </Modal>
      )}

      {showAddFromBank && (
        <Modal title="افزودن از بانک سوال" onClose={() => setShowAddFromBank(false)}>
          {bankQuestions.length === 0 ? (
            <div style={{ fontSize: 13, color: "#64748B" }}>بانک سوال تو خالیه.</div>
          ) : (
            <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              {bankQuestions.map((q) => (
                <div key={q.id} onClick={() => setBankSelected((s) => s.includes(q.id) ? s.filter((x) => x !== q.id) : [...s, q.id])}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: bankSelected.includes(q.id) ? "#EFF6FF" : "#F8FAFC" }}>
                  {bankSelected.includes(q.id) ? <CheckCircle2 size={16} color="#2563EB" /> : <Circle size={16} color="#CBD5E1" />}
                  <span style={{ fontSize: 13, color: "#334155" }}>{q.question_text}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setShowAddFromBank(false)}>انصراف</Button>
            <Button onClick={runAddFromBank} disabled={bankSelected.length === 0}>افزودن {bankSelected.length > 0 ? `(${bankSelected.length})` : ""}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   QUESTION BANK (questions independent of any exam)
--------------------------------------------------------- */

function QuestionBankScreen({ teacher, questions, exams, refresh, onBack }) {
  const bankQuestions = questions.filter((q) => !q.exam_id && q.owner_id === teacher.username);
  const [qType, setQType] = useState("mc");
  const [qText, setQText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [correctMulti, setCorrectMulti] = useState([]);
  const [modelAnswer, setModelAnswer] = useState("");
  const [keywords, setKeywords] = useState("");
  const [mark, setMark] = useState(1);
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterTag, setFilterTag] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [showAddToExam, setShowAddToExam] = useState(false);
  const [targetExam, setTargetExam] = useState("");
  const [addSelected, setAddSelected] = useState([]);

  const letters = ["A", "B", "C", "D"];
  const myExams = (exams || []).filter((e) => e.teacher_id === teacher.username);

  const resetForm = () => {
    setQType("mc"); setQText(""); setImageUrl(""); setOptions(["", "", "", ""]);
    setCorrect(0); setCorrectMulti([]); setModelAnswer(""); setKeywords(""); setMark(1); setTags(""); setEditingId(null);
  };

  const startEdit = (q) => {
    setEditingId(q.id);
    setQType(q.type || "mc");
    setQText(q.question_text);
    setImageUrl(q.image_url || "");
    setOptions([q.option_a || "", q.option_b || "", q.option_c || "", q.option_d || ""]);
    setCorrect(["A", "B", "C", "D"].indexOf(q.correct_answer) >= 0 ? ["A", "B", "C", "D"].indexOf(q.correct_answer) : 0);
    setCorrectMulti((q.correct_answers || []).map((l) => ["A", "B", "C", "D"].indexOf(l)).filter((i) => i >= 0));
    setModelAnswer(q.model_answer || "");
    setKeywords((q.keywords || []).join(", "));
    setMark(q.mark || 1);
    setTags((q.tags || []).join(", "));
  };

  const toggleCorrectMulti = (i) => {
    setCorrectMulti((arr) => arr.includes(i) ? arr.filter((x) => x !== i) : [...arr, i]);
  };

  const saveQuestion = async () => {
    if (!qText.trim()) return;
    if ((qType === "mc" || qType === "mc_multi") && options.some((o) => !o.trim())) return;
    if (qType === "mc_multi" && correctMulti.length === 0) return;
    setSaving(true);
    const id = editingId || uid();
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = {
      id, exam_id: null, owner_id: teacher.username,
      type: qType,
      question_text: qText.trim(),
      image_url: imageUrl.trim() || null,
      mark: Number(mark) || 1,
      tags: tagList,
    };
    if (qType === "mc") {
      payload.option_a = options[0]; payload.option_b = options[1];
      payload.option_c = options[2]; payload.option_d = options[3];
      payload.correct_answer = ["A", "B", "C", "D"][correct];
    } else if (qType === "mc_multi") {
      payload.option_a = options[0]; payload.option_b = options[1];
      payload.option_c = options[2]; payload.option_d = options[3];
      payload.correct_answers = correctMulti.map((i) => ["A", "B", "C", "D"][i]);
    } else {
      payload.model_answer = modelAnswer.trim() || null;
      payload.keywords = keywords.split(",").map((k) => k.trim()).filter(Boolean);
    }
    await setJSON(`question:${id}`, payload);
    setSaving(false);
    resetForm();
    await refresh();
  };

  const removeQuestion = async (id) => {
    await deleteKey(`question:${id}`);
    if (editingId === id) resetForm();
    await refresh();
  };

  const runBulkImport = async () => {
    const { parsed, errors } = parseBulkQuestions(bulkText);
    if (parsed.length === 0) {
      setBulkError("هیچ سوال معتبری پیدا نشد. فرمت را بررسی کن.");
      return;
    }
    await Promise.all(parsed.map((p) => setJSON(`question:${uid()}`, { id: uid(), exam_id: null, owner_id: teacher.username, tags: [], ...p })));
    setBulkError(errors.length > 0 ? `${parsed.length} سوال اضافه شد؛ ${errors.length} بلوک نامعتبر نادیده گرفته شد.` : "");
    setBulkText("");
    await refresh();
    if (errors.length === 0) setShowBulkImport(false);
  };

  const runAddToExam = async () => {
    if (!targetExam || addSelected.length === 0) return;
    const toAdd = bankQuestions.filter((q) => addSelected.includes(q.id));
    await Promise.all(toAdd.map((q) => {
      const { id, exam_id, owner_id, ...rest } = q;
      return setJSON(`question:${uid()}`, { id: uid(), exam_id: targetExam, ...rest });
    }));
    setShowAddToExam(false);
    setAddSelected([]);
    setTargetExam("");
    await refresh();
  };

  const allTags = [...new Set(bankQuestions.flatMap((q) => q.tags || []))];
  const visibleQuestions = filterTag ? bankQuestions.filter((q) => (q.tags || []).includes(filterTag)) : bankQuestions;

  return (
    <div style={{ flex: 1, padding: "30px 34px", overflowY: "auto" }}>
      <TopBar title="بانک سوال" teacherName={teacher.fullname} />
      <div style={{ fontSize: 13, color: "#64748B", marginBottom: 18, marginTop: -12 }}>
        سوالاتی که اینجا می‌سازی به هیچ آزمونی وابسته نیستن؛ هر وقت خواستی می‌تونی اونا رو به هر آزمونی اضافه کنی.
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <Button variant="ghost" style={{ fontSize: 13 }} onClick={() => setShowBulkImport(true)}><Plus size={14} />وارد کردن دسته‌ای</Button>
        {myExams.length > 0 && bankQuestions.length > 0 && (
          <Button variant="ghost" style={{ fontSize: 13 }} onClick={() => setShowAddToExam(true)}><Download size={14} />افزودن به آزمون</Button>
        )}
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 420px", background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B" }}>{editingId ? "ویرایش سوال" : "افزودن سوال جدید به بانک"}</div>
            {editingId && <span onClick={resetForm} style={{ fontSize: 12, color: "#64748B", cursor: "pointer" }}>لغو ویرایش</span>}
          </div>
          <Field label="نوع سوال">
            <div style={{ display: "flex", gap: 8 }}>
              <div onClick={() => setQType("mc")} style={{
                flex: 1, textAlign: "center", padding: "9px 4px", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700,
                background: qType === "mc" ? "#2563EB" : "#F1F5F9", color: qType === "mc" ? "#fff" : "#475569",
              }}>چهارگزینه‌ای</div>
              <div onClick={() => setQType("mc_multi")} style={{
                flex: 1, textAlign: "center", padding: "9px 4px", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700,
                background: qType === "mc_multi" ? "#2563EB" : "#F1F5F9", color: qType === "mc_multi" ? "#fff" : "#475569",
              }}>چندجوابی</div>
              <div onClick={() => setQType("essay")} style={{
                flex: 1, textAlign: "center", padding: "9px 4px", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700,
                background: qType === "essay" ? "#2563EB" : "#F1F5F9", color: qType === "essay" ? "#fff" : "#475569",
              }}>تشریحی</div>
            </div>
          </Field>
          <Field label="متن سوال">
            <textarea value={qText} onChange={(e) => setQText(e.target.value)} placeholder="مثلاً: حاصل 2×3+5 چقدر است؟" rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </Field>
          <Field label="آدرس تصویر (اختیاری)">
            <TextInput value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="لینک یک تصویر برای این سوال" />
          </Field>
          {qType !== "essay" ? (
            <Field label={qType === "mc_multi" ? "گزینه‌ها (همه‌ی پاسخ‌های صحیح را انتخاب کن)" : "گزینه‌ها (پاسخ صحیح را انتخاب کن)"}>
              {options.map((opt, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span onClick={() => qType === "mc_multi" ? toggleCorrectMulti(i) : setCorrect(i)} style={{ cursor: "pointer", color: (qType === "mc_multi" ? correctMulti.includes(i) : correct === i) ? "#16A34A" : "#CBD5E1", flexShrink: 0 }}>
                    {(qType === "mc_multi" ? correctMulti.includes(i) : correct === i) ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#64748B", width: 16 }}>{letters[i]}</span>
                  <TextInput value={opt} onChange={(e) => {
                    const arr = [...options]; arr[i] = e.target.value; setOptions(arr);
                  }} placeholder={`گزینه ${letters[i]}`} />
                </div>
              ))}
            </Field>
          ) : (
            <>
              <Field label="پاسخ نمونه (اختیاری — فقط برای مرور خودت، در تصحیح دستی می‌بینی)">
                <textarea value={modelAnswer} onChange={(e) => setModelAnswer(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
              </Field>
              <Field label="کلمات کلیدی برای تصحیح خودکار (اختیاری — با ویرگول جدا کن)">
                <TextInput value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="مثلاً: فتوسنتز, کلروفیل, نور خورشید" />
              </Field>
            </>
          )}
          <Field label="نمره این سوال">
            <TextInput type="number" min={1} value={mark} onChange={(e) => setMark(e.target.value)} style={{ maxWidth: 120 }} />
          </Field>
          <Field label="برچسب‌ها (اختیاری — با ویرگول جدا کن)">
            <TextInput value={tags} onChange={(e) => setTags(e.target.value)} placeholder="مثلاً: جبر, فصل ۴" />
          </Field>
          <Button onClick={saveQuestion} disabled={saving} style={{ width: "100%", justifyContent: "center" }}>
            {editingId ? <Check size={16} /> : <Plus size={16} />}
            {saving ? "در حال ذخیره..." : editingId ? "ذخیره تغییرات" : "افزودن به بانک"}
          </Button>
        </div>

        <div style={{ flex: "0 1 320px", background: "#F8FAFC", borderRadius: 16, border: "1px dashed #CBD5E1", padding: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#64748B", marginBottom: 12 }}>پیش‌نمایش سوال</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", marginBottom: 12, minHeight: 40 }}>
            {qText || "متن سوال اینجا نمایش داده می‌شود..."}
          </div>
          {imageUrl && (
            <img src={imageUrl} alt="" style={{ width: "100%", borderRadius: 10, marginBottom: 12, display: "block" }}
              onError={(e) => { e.target.style.display = "none"; }} />
          )}
          {qType !== "essay" ? options.map((opt, i) => {
            const isCorrect = qType === "mc_multi" ? correctMulti.includes(i) : correct === i;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, marginBottom: 6, background: isCorrect ? "#F0FDF4" : "#fff", border: "1px solid " + (isCorrect ? "#BBF7D0" : "#E2E8F0") }}>
                {isCorrect ? <CheckCircle2 size={16} color="#16A34A" /> : <Circle size={16} color="#CBD5E1" />}
                <span style={{ fontSize: 13, color: "#334155" }}>{letters[i]}. {opt || "—"}</span>
              </div>
            );
          }) : (
            <div style={{ fontSize: 12, color: "#94A3B8", padding: "10px 0" }}>دانش‌آموز پاسخ خود را به‌صورت متنی وارد می‌کند (تصحیح دستی).</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B" }}>
            سوالات بانک ({bankQuestions.length})
          </div>
          {allTags.length > 0 && (
            <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 12 }}>
              <option value="">همه برچسب‌ها</option>
              {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
        {visibleQuestions.length === 0 ? (
          <EmptyState text="هنوز سوالی به بانک اضافه نکرده‌ای." actionLabel={null} onAction={null} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visibleQuestions.map((q, idx) => (
              <div key={q.id} style={{ background: "#fff", border: "1px solid #EEF1F6", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{idx + 1}. {q.question_text}</div>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
                    {q.type === "essay" ? "پاسخ تشریحی" : q.type === "mc_multi" ? `پاسخ‌های صحیح: ${(q.correct_answers || []).join("، ")}` : `پاسخ صحیح: ${q.correct_answer}`} · نمره: {q.mark}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    {q.type === "essay" && <Badge tone="blue">تشریحی</Badge>}
                    {q.type === "mc_multi" && <Badge tone="blue">چندجوابی</Badge>}
                    {q.image_url && <Badge tone="gray">دارای تصویر</Badge>}
                    {(q.tags || []).map((t) => <Badge key={t} tone="gray">{t}</Badge>)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 14, flexShrink: 0 }}>
                  <Edit2 size={16} style={{ cursor: "pointer", color: "#64748B" }} onClick={() => startEdit(q)} />
                  <Trash2 size={16} style={{ cursor: "pointer", color: "#F87171" }} onClick={() => removeQuestion(q.id)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showBulkImport && (
        <Modal title="وارد کردن دسته‌ای سوال به بانک" onClose={() => setShowBulkImport(false)}>
          <div style={{ fontSize: 12, color: "#64748B", marginBottom: 10, lineHeight: 1.8, background: "#F8FAFC", padding: 10, borderRadius: 8 }}>
            برای سوال چندگزینه‌ای:
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, marginTop: 6 }}>{`Q: متن سوال
A) گزینه یک
B) گزینه دو
C) گزینه سه
D) گزینه چهار
ANSWER: B
MARK: 2`}</pre>
            برای سوال تشریحی:
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, marginTop: 6 }}>{`Q: متن سوال
TYPE: ESSAY
ANSWER: پاسخ نمونه (اختیاری)
KEYWORDS: کلمه۱, کلمه۲ (اختیاری)
MARK: 2`}</pre>
            بین هر دو سوال یک خط خالی بگذار.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: "#2563EB", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Upload size={14} />
              آپلود فایل متنی
              <input
                type="file"
                accept=".txt,text/plain"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files && e.target.files[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => setBulkText((prev) => (prev ? prev + "\n\n" : "") + String(ev.target.result || ""));
                  reader.readAsText(file, "UTF-8");
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={10} style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 12 }} placeholder="سوالات را اینجا پیست کن، یا از دکمه‌ی بالا یک فایل متنی آپلود کن..." />
          {bulkError && <div style={{ color: "#D97706", fontSize: 12, marginTop: 8 }}>{bulkError}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
            <Button variant="ghost" onClick={() => setShowBulkImport(false)}>انصراف</Button>
            <Button onClick={runBulkImport}>افزودن سوالات</Button>
          </div>
        </Modal>
      )}

      {showAddToExam && (
        <Modal title="افزودن سوالات بانک به آزمون" onClose={() => setShowAddToExam(false)}>
          <Field label="انتخاب آزمون مقصد">
            <select value={targetExam} onChange={(e) => setTargetExam(e.target.value)} style={{ ...inputStyle }}>
              <option value="">— انتخاب کن —</option>
              {myExams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </Field>
          {bankQuestions.length > 0 && (
            <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              {bankQuestions.map((q) => (
                <div key={q.id} onClick={() => setAddSelected((s) => s.includes(q.id) ? s.filter((x) => x !== q.id) : [...s, q.id])}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: addSelected.includes(q.id) ? "#EFF6FF" : "#F8FAFC" }}>
                  {addSelected.includes(q.id) ? <CheckCircle2 size={16} color="#2563EB" /> : <Circle size={16} color="#CBD5E1" />}
                  <span style={{ fontSize: 13, color: "#334155" }}>{q.question_text}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setShowAddToExam(false)}>انصراف</Button>
            <Button onClick={runAddToExam} disabled={!targetExam || addSelected.length === 0}>افزودن {addSelected.length > 0 ? `(${addSelected.length})` : ""}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   TAKE EXAM (student flow)
--------------------------------------------------------- */
