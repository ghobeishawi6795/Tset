/* ---------------------------------------------------------
   STUDENT EXAM-TAKING FLOW + RESULTS + ESSAY GRADING
   © ghobeishawi - All rights reserved.
--------------------------------------------------------- */
// Shown to students after they submit an exam, picked at random each time.
// Falls back to this built-in list if the teacher hasn't customized it in Settings.
const DEFAULT_FINISH_MESSAGES = [
  "موفق باشی! 🌟",
  "آفرین، به خوبی تمومش کردی.",
  "دستت درد نکنه، خسته نباشی!",
  "عالی بود، منتظر نتیجه باش.",
];

function TakeExamScreen({ exam, questions, roster = [], classes = [], onFinish, onExit }) {
  const [stage, setStage] = useState("enter"); // enter -> exam -> done
  const [studentName, setStudentName] = useState("");
  const [classCode, setClassCode] = useState("");
  const nameOnly = exam.entry_mode === "name_only";
  const allowedClassIds = exam.restrict_class_ids || (exam.restrict_class_id ? [exam.restrict_class_id] : []);
  const restricted = !nameOnly && allowedClassIds.length > 0;
  const [entryMode, setEntryMode] = useState(nameOnly ? "name" : ((roster.length > 0 || restricted) ? "code" : "name"));
  const [codeInput, setCodeInput] = useState("");
  const matchedRoster = codeInput.trim() ? roster.find((r) => r.code === codeInput.trim()) : null;
  const matchedClassName = matchedRoster ? (classes.find((c) => c.id === matchedRoster.class_id)?.name || "") : "";
  const classMismatch = restricted && matchedRoster && !allowedClassIds.includes(matchedRoster.class_id);
  const restrictedClassName = restricted ? allowedClassIds.map((id) => classes.find((c) => c.id === id)?.name || "").filter(Boolean).join("، ") : "";
  const examQuestions = questions.filter((q) => q.exam_id === exam.id);
  const [current, setCurrent] = useState(0);
  const [selections, setSelections] = useState({}); // qid -> 'A'..'D' | [letters] | text
  const [visited, setVisited] = useState({});
  const [startedAt, setStartedAt] = useState(null);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [enterError, setEnterError] = useState("");
  const [checking, setChecking] = useState(false);
  const [qOrder, setQOrder] = useState(null); // array of question ids, display order
  const [optOrder, setOptOrder] = useState({}); // qid -> [origLetter,...] display order
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [finishMessages, setFinishMessages] = useState(DEFAULT_FINISH_MESSAGES);

  // The teacher's custom end-of-exam messages (set in Settings), if any —
  // included directly on the exam object by /api/exam-session.
  useEffect(() => {
    if (Array.isArray(exam.finish_messages) && exam.finish_messages.length > 0) {
      setFinishMessages(exam.finish_messages);
    }
  }, [exam]);

  const orderedQuestions = qOrder
    ? qOrder.map((id) => examQuestions.find((q) => q.id === id)).filter(Boolean)
    : examQuestions;

  const totalSeconds = exam.duration_minutes ? exam.duration_minutes * 60 : null;
  const [remaining, setRemaining] = useState(totalSeconds);
  const autoSubmittedRef = useRef(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [isOnline, setIsOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const letters = ["A", "B", "C", "D"];

  // Anti-cheat: count how many times the student leaves this tab/window during the exam.
  useEffect(() => {
    if (stage !== "exam") return;
    const onVisibility = () => {
      if (document.hidden) setTabSwitches((c) => c + 1);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [stage]);

  const startExam = async () => {
    const resolvedName = entryMode === "code" ? (matchedRoster?.fullname || "") : studentName.trim();
    const resolvedClass = entryMode === "code" ? matchedClassName : classCode.trim();
    if (!resolvedName) {
      if (entryMode === "code") setEnterError("کد وارد شده معتبر نیست.");
      return;
    }
    if (classMismatch) {
      setEnterError("این کد متعلق به کلاس دیگری است و اجازه‌ی شرکت در این آزمون را ندارد.");
      return;
    }
    setEnterError("");
    const now = new Date();
    if (exam.opens_at && now < new Date(exam.opens_at)) {
      setEnterError(`این آزمون هنوز باز نشده. زمان شروع: ${new Date(exam.opens_at).toLocaleString("fa-IR")}`);
      return;
    }
    if (exam.closes_at && now > new Date(exam.closes_at)) {
      setEnterError(`مهلت شرکت در این آزمون به پایان رسیده. زمان پایان: ${new Date(exam.closes_at).toLocaleString("fa-IR")}`);
      return;
    }
    if (exam.access_code && accessCodeInput.trim() !== exam.access_code) {
      setEnterError("کد دسترسی اشتباه است.");
      return;
    }
    setChecking(true);
    const nameNorm = resolvedName;
    setStudentName(resolvedName);
    setClassCode(resolvedClass);
    let already = false;
    try {
      const r = await fetch(`/api/exam-attempted?examId=${encodeURIComponent(exam.id)}&name=${encodeURIComponent(nameNorm)}`);
      if (r.ok) { const d = await r.json(); already = !!d.already; }
    } catch { /* if the check fails, fall through and let them attempt — better than blocking a legit student */ }
    if (already && !exam.allow_retake) {
      setChecking(false);
      setEnterError("شما قبلاً در این آزمون شرکت کرده‌اید.");
      return;
    }
    const draft = await getJSON(`draft:${exam.id}:${nameNorm}`);
    let order, options;
    if (draft && draft.qOrder) {
      setSelections(draft.selections || {});
      setCurrent(draft.current || 0);
      order = draft.qOrder;
      options = draft.optOrder || {};
    } else {
      order = exam.shuffle_questions ? shuffleArray(examQuestions.map((q) => q.id)) : examQuestions.map((q) => q.id);
      options = {};
      examQuestions.forEach((q) => {
        options[q.id] = (q.type === "mc" && exam.shuffle_options) ? shuffleArray(["A", "B", "C", "D"]) : ["A", "B", "C", "D"];
      });
    }
    setQOrder(order);
    setOptOrder(options);
    setChecking(false);
    setStartedAt(Date.now());
    setVisited({ 0: true });
    setStage("exam");
    if (exam.require_fullscreen && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  // Autosave answers as the student works through the exam, so a refresh doesn't lose progress.
  // Throttled: writing to KV on every single click would burn through the free-tier
  // daily write quota almost instantly with many students. Instead we batch rapid
  // changes and write at most once every few seconds, plus a final flush on exit.
  const draftSaveTimerRef = useRef(null);
  const pendingDraftRef = useRef(null);
  useEffect(() => {
    if (stage !== "exam") return;
    pendingDraftRef.current = { selections, current, qOrder, optOrder };
    if (draftSaveTimerRef.current) return; // a flush is already scheduled
    draftSaveTimerRef.current = setTimeout(() => {
      draftSaveTimerRef.current = null;
      if (pendingDraftRef.current) {
        setJSON(`draft:${exam.id}:${studentName.trim()}`, pendingDraftRef.current);
      }
    }, 4000);
  }, [selections, current, stage, qOrder, optOrder]);

  // Flush any pending draft save immediately when leaving the exam stage
  // (submit, tab close, etc.) so the last few answers aren't lost.
  useEffect(() => {
    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
        if (pendingDraftRef.current) {
          setJSON(`draft:${exam.id}:${studentName.trim()}`, pendingDraftRef.current);
        }
      }
    };
  }, []);

  // Countdown ticker — starts once the exam stage begins, only when the exam has a time limit.
  useEffect(() => {
    if (stage !== "exam" || totalSeconds === null) return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r === null) return r;
        if (r <= 1) {
          clearInterval(t);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [stage]);

  const fmtClock = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const selectOption = (qid, letter) => {
    setSelections((s) => ({ ...s, [qid]: letter }));
  };

  const toggleMultiOption = (qid, letter) => {
    setSelections((s) => {
      const cur = Array.isArray(s[qid]) ? s[qid] : [];
      const next = cur.includes(letter) ? cur.filter((l) => l !== letter) : [...cur, letter];
      return { ...s, [qid]: next };
    });
  };

  const goTo = (i) => {
    if (exam.no_going_back && i < current) return;
    setCurrent(i);
    setVisited((v) => ({ ...v, [i]: true }));
  };

  const submitExam = async () => {
    setSubmitting(true);
    const studentId = uid();
    const timeTakenSec = Math.round((Date.now() - startedAt) / 1000);
    const rawAnswers = orderedQuestions.map((q) => {
      const sel = selections[q.id] || null;
      const selected_option = Array.isArray(sel) ? sel.join(",") : sel;
      return { question_id: q.id, selected_option, time_taken: timeTakenSec };
    });
    const studentRecord = {
      id: studentId, fullname: studentName.trim(), class_code: classCode.trim(),
      teacher_id: exam.teacher_id, tab_switches: tabSwitches,
    };
    const draftKey = `draft:${exam.id}:${studentName.trim()}`;
    let cheatAlert = null;
    if (tabSwitches > 0) {
      cheatAlert = {
        id: uid(), teacher_id: exam.teacher_id, exam_id: exam.id, exam_title: exam.title,
        student_name: studentName.trim(), tab_switches: tabSwitches, seen: false,
        created_at: new Date().toISOString(),
      };
    }

    // Try to submit for real first (only if we appear to have a connection —
    // no point waiting on doomed requests). If anything fails or we're
    // offline, queue the whole submission locally so nothing is lost; it
    // gets sent automatically once the connection comes back. Grading
    // (is_correct / awarded_mark) is always computed server-side from the
    // real answer key — never trusted from this client.
    let synced = false;
    let summary = null;
    if (typeof navigator === "undefined" || navigator.onLine) {
      try {
        const r = await fetch("/api/answers/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: studentId, student: studentRecord, exam_id: exam.id, answers: rawAnswers, cheat_alert: cheatAlert }),
        });
        if (r.ok) {
          summary = await r.json();
          await deleteKey(draftKey);
          synced = true;
        }
      } catch {
        synced = false;
      }
    }
    if (!synced) {
      queueOfflineSubmission({
        id: uid(), examId: exam.id, studentRecord,
        answerRecords: rawAnswers.map((a) => ({ ...a })),
        cheatAlert, draftKeyToDelete: draftKey, createdAt: new Date().toISOString(),
      });
    }

    const list = finishMessages.length > 0 ? finishMessages : DEFAULT_FINISH_MESSAGES;
    const finishMsg = list[Math.floor(Math.random() * list.length)];
    setResult({
      correctCount: summary?.correctCount ?? null,
      total: examQuestions.length,
      pct: summary?.pct ?? null,
      timeTakenSec,
      pendingEssays: summary?.pendingEssays ?? null,
      finishMsg,
      offlineQueued: !synced,
      reveal: summary?.reveal || null,
    });
    setSubmitting(false);
    setStage("done");
    onFinish();
  };

  useEffect(() => {
    if (stage === "exam" && remaining === 0 && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      submitExam();
    }
  }, [remaining, stage]);

  if (stage === "enter") {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#132A52,#1D3E73)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: 36, width: "100%", maxWidth: 400 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#2563EB", marginBottom: 6 }}>ورود به آزمون</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1E293B", marginBottom: 20 }}>{exam.title}</div>

          {restricted && (
            <div style={{ fontSize: 12, color: "#2563EB", background: "#EFF6FF", borderRadius: 8, padding: "8px 10px", marginBottom: 14 }}>
              این آزمون فقط برای دانش‌آموزان کلاس(های) «{restrictedClassName}» است.
            </div>
          )}
          {entryMode === "code" ? (
            <>
              <Field label="کد دانش‌آموزی">
                <TextInput
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ""))}
                  placeholder="کدی که معلم به تو داده را وارد کن"
                  style={{ fontSize: 18, letterSpacing: 3, textAlign: "center", fontWeight: 700 }}
                  maxLength={6}
                />
              </Field>
              {codeInput.trim() && (
                matchedRoster ? (
                  classMismatch ? (
                    <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 14 }}>این کد متعلق به کلاس دیگری است و اجازه‌ی شرکت در این آزمون را ندارد.</div>
                  ) : (
                    <div style={{ fontSize: 13, color: "#16A34A", background: "#F0FDF4", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
                      خوش آمدی، {matchedRoster.fullname}{matchedClassName ? ` (${matchedClassName})` : ""}
                    </div>
                  )
                ) : (
                  <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 14 }}>کد پیدا نشد.</div>
                )
              )}
              {roster.length > 0 && !restricted && !nameOnly && (
                <div onClick={() => setEntryMode("name")} style={{ fontSize: 12, color: "#94A3B8", cursor: "pointer", marginBottom: 14 }}>کد نداری؟ ورود با نام</div>
              )}
            </>
          ) : (
            <>
              <Field label="نام و نام‌خانوادگی">
                <TextInput value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="نام خود را وارد کن" />
              </Field>
              <Field label="کد کلاس (اختیاری)">
                <TextInput value={classCode} onChange={(e) => setClassCode(e.target.value)} placeholder="مثلاً: دهم-الف" />
              </Field>
              {roster.length > 0 && !nameOnly && (
                <div onClick={() => setEntryMode("code")} style={{ fontSize: 12, color: "#94A3B8", cursor: "pointer", marginBottom: 14 }}>کد دانش‌آموزی داری؟ ورود با کد</div>
              )}
            </>
          )}

          {exam.access_code && (
            <Field label="کد دسترسی آزمون">
              <TextInput value={accessCodeInput} onChange={(e) => setAccessCodeInput(e.target.value)} placeholder="کد را از معلم بگیر" />
            </Field>
          )}
          <div style={{ fontSize: 12, color: "#64748B", marginBottom: 18 }}>
            {examQuestions.length} سوال در این آزمون وجود دارد.
            {totalSeconds !== null && ` زمان مجاز: ${exam.duration_minutes} دقیقه.`}
            {exam.no_going_back && " امکان بازگشت به سوالات قبلی وجود ندارد."}
          </div>
          {(exam.opens_at || exam.closes_at) && (
            <div style={{ fontSize: 12, color: "#2563EB", background: "#EFF6FF", borderRadius: 8, padding: "8px 10px", marginBottom: 14 }}>
              {exam.opens_at && `از ${new Date(exam.opens_at).toLocaleString("fa-IR")} `}
              {exam.closes_at && `تا ${new Date(exam.closes_at).toLocaleString("fa-IR")}`}
              {" قابل شرکت است."}
            </div>
          )}
          {enterError && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 14 }}>{enterError}</div>}
          <Button onClick={startExam} disabled={examQuestions.length === 0 || checking || (entryMode === "code" && (!matchedRoster || classMismatch))} style={{ width: "100%", justifyContent: "center" }}>
            {checking ? "در حال بررسی..." : "شروع آزمون"}
          </Button>
          {examQuestions.length === 0 && <div style={{ fontSize: 12, color: "#DC2626", marginTop: 10 }}>این آزمون هنوز سوالی ندارد.</div>}
          <div onClick={onExit} style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "#94A3B8", cursor: "pointer" }}>بازگشت</div>
        </div>
      </div>
    );
  }

  if (stage === "done" && result) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#132A52,#1D3E73)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: 40, width: "100%", maxWidth: 480, textAlign: "center" }}>
          <div style={{ width: 68, height: 68, borderRadius: "50%", background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
            <Award size={32} color="#16A34A" />
          </div>
          <div style={{ fontSize: 14, color: "#64748B", marginBottom: 6 }}>آزمون با موفقیت ثبت شد</div>
          <div style={{ fontSize: 38, fontWeight: 900, color: "#1E293B", marginBottom: 6 }}>{result.pct != null ? `${result.pct}%` : "—"}</div>
          <div style={{ fontSize: 13, color: "#64748B", marginBottom: 10 }}>
            {result.correctCount != null ? `${result.correctCount} پاسخ صحیح از ${result.total} سوال` : "پاسخ‌ها ذخیره شد؛ نمره پس از اتصال به اینترنت محاسبه می‌شود."}
          </div>
          {result.offlineQueued && (
            <div style={{ fontSize: 12.5, color: "#D97706", background: "#FFFBEB", borderRadius: 10, padding: "10px 12px", marginBottom: 14, lineHeight: 1.9 }}>
              چون در لحظه‌ی ارسال به اینترنت وصل نبودی، پاسخ‌هایت روی همین دستگاه ذخیره شد. به‌محض وصل شدن این گوشی به اینترنت (همین اپ رو باز نگه‌دار یا بعداً دوباره باز کن)، پاسخ‌ها خودکار برای معلم ارسال می‌شن.
            </div>
          )}
          {result.finishMsg && (
            <div style={{ fontSize: 14, fontWeight: 700, color: "#2563EB", background: "#EFF6FF", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
              {result.finishMsg}
            </div>
          )}
          {result.pendingEssays > 0 && (
            <div style={{ fontSize: 12, color: "#D97706", background: "#FFFBEB", borderRadius: 10, padding: "8px 12px", marginBottom: 12 }}>
              نمره‌ی نهایی موقت است — {result.pendingEssays} سوال تشریحی در انتظار تصحیح توسط معلم است.
            </div>
          )}
          {result.reveal && (
            <div style={{ textAlign: "right", marginBottom: 22, maxHeight: 320, overflowY: "auto" }}>
              {examQuestions.map((q, idx) => {
                const optsMap = { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d };
                const revealed = result.reveal.find((r) => r.question_id === q.id);
                if (!revealed || q.type === "essay") return null;
                const sel = selections[q.id];
                const ok = revealed.is_correct;
                return (
                  <div key={q.id} style={{ border: "1px solid #EEF1F6", borderRadius: 10, padding: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", marginBottom: 6 }}>{idx + 1}. {q.question_text}</div>
                    <div style={{ fontSize: 12, color: ok ? "#16A34A" : "#DC2626" }}>
                      پاسخ شما: {sel ? `${Array.isArray(sel) ? sel.join("، ") : sel}. ${Array.isArray(sel) ? sel.map((l) => optsMap[l]).join("، ") : optsMap[sel]}` : "بدون پاسخ"}
                    </div>
                    {!ok && (
                      <div style={{ fontSize: 12, color: "#16A34A" }}>
                        پاسخ صحیح: {q.type === "mc_multi"
                          ? (revealed.correct_answers || []).map((l) => `${l}. ${optsMap[l]}`).join("، ")
                          : `${revealed.correct_answer}. ${optsMap[revealed.correct_answer]}`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <Button onClick={onExit} style={{ width: "100%", justifyContent: "center" }}>بازگشت</Button>
        </div>
      </div>
    );
  }

  const q = orderedQuestions[current];
  const answeredCount = Object.keys(selections).filter((qid) => {
    const v = selections[qid];
    return Array.isArray(v) ? v.length > 0 : !!v;
  }).length;
  const progressPct = orderedQuestions.length ? Math.round((answeredCount / orderedQuestions.length) * 100) : 0;
  const unansweredCount = orderedQuestions.length - answeredCount;

  return (
    <div
      style={{ minHeight: "100vh", background: "#F8FAFC", padding: 24, ...(exam.no_copy_paste ? { userSelect: "none", WebkitUserSelect: "none" } : {}) }}
      onCopy={(e) => exam.no_copy_paste && e.preventDefault()}
      onPaste={(e) => exam.no_copy_paste && e.preventDefault()}
      onCut={(e) => exam.no_copy_paste && e.preventDefault()}
      onContextMenu={(e) => exam.no_copy_paste && e.preventDefault()}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#1E293B" }}>{exam.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {!isOnline && (
            <div style={{ fontSize: 12, fontWeight: 700, color: "#B45309", background: "#FFFBEB", borderRadius: 8, padding: "6px 10px" }}>
              اتصال اینترنت قطع است — پاسخ‌ها بعداً خودکار ارسال می‌شوند
            </div>
          )}
          <div style={{ fontSize: 13, color: "#64748B", display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={15} /> {studentName}
          </div>
          {remaining !== null && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 800,
              padding: "7px 14px", borderRadius: 10,
              color: remaining <= 120 ? "#DC2626" : "#1E293B",
              background: remaining <= 120 ? "#FEF2F2" : "#F1F5F9",
            }}>
              <Clock size={15} /> {fmtClock(remaining)}
            </div>
          )}
          <Button variant="success" onClick={() => (unansweredCount > 0 ? setShowConfirmSubmit(true) : submitExam())} disabled={submitting}>
            {submitting ? "در حال ثبت..." : "پایان و ثبت آزمون"}
          </Button>
        </div>
      </div>

      {tabSwitches > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, background: "#FFFBEB", color: "#B45309",
          border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 16,
        }}>
          <AlertTriangle size={16} />
          هشدار: خروج از صفحه‌ی آزمون {tabSwitches} بار ثبت شد. این مورد برای معلم نمایش داده می‌شود.
        </div>
      )}

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 480px", background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748B", marginBottom: 8 }}>
            <span>سوال {current + 1} از {orderedQuestions.length}</span>
            <span>{progressPct}%</span>
          </div>
          <div style={{ height: 6, background: "#EEF1F6", borderRadius: 4, marginBottom: 22, overflow: "hidden" }}>
            <div style={{ width: `${progressPct}%`, height: "100%", background: "#2563EB", borderRadius: 4, transition: "width .2s" }} />
          </div>
          {q.section && (
            <div style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, color: "#2563EB", background: "#EFF6FF", borderRadius: 6, padding: "3px 10px", marginBottom: 10 }}>
              {q.section}
            </div>
          )}
          <div style={{ fontSize: 17, fontWeight: 700, color: "#1E293B", marginBottom: 16, lineHeight: 1.7 }}>{q.question_text}</div>
          {q.image_url && (
            <img src={q.image_url} alt="" style={{ maxWidth: "100%", borderRadius: 12, marginBottom: 18, display: "block" }}
              onError={(e) => { e.target.style.display = "none"; }} />
          )}
          {q.type === "essay" ? (
            <textarea
              value={selections[q.id] || ""}
              onChange={(e) => selectOption(q.id, e.target.value)}
              placeholder="پاسخ خود را اینجا بنویس..."
              rows={6}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {q.type === "mc_multi" && (
                <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: -4 }}>می‌توانی بیش از یک گزینه انتخاب کنی.</div>
              )}
              {(optOrder[q.id] || ["A", "B", "C", "D"]).map((origLetter, i) => {
                const optText = { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d }[origLetter];
                const isMulti = q.type === "mc_multi";
                const selVal = selections[q.id];
                const isSelected = isMulti ? (Array.isArray(selVal) && selVal.includes(origLetter)) : selVal === origLetter;
                const onPick = () => isMulti ? toggleMultiOption(q.id, origLetter) : selectOption(q.id, origLetter);
                return (
                  <div key={origLetter} onClick={onPick}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderRadius: 12,
                      border: "1.5px solid " + (isSelected ? "#2563EB" : "#E2E8F0"),
                      background: isSelected ? "#EFF6FF" : "#fff", cursor: "pointer",
                    }}>
                    {isSelected ? <CheckCircle2 size={18} color="#2563EB" /> : <Circle size={18} color="#CBD5E1" />}
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#64748B" }}>{letters[i]}.</span>
                    <span style={{ fontSize: 14, color: "#334155" }}>{optText}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 26 }}>
            <Button variant="ghost" onClick={() => goTo(Math.max(0, current - 1))} disabled={current === 0 || exam.no_going_back}>
              <ChevronRight size={16} /> قبلی
            </Button>
            <Button onClick={() => goTo(Math.min(orderedQuestions.length - 1, current + 1))} disabled={current === orderedQuestions.length - 1}>
              بعدی <ChevronLeft size={16} />
            </Button>
          </div>
        </div>

        <div style={{ width: 260, background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 20, flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1E293B", marginBottom: 14 }}>پالت سوالات</div>
          <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#64748B", marginBottom: 14, flexWrap: "wrap" }}>
            <LegendDot color="#16A34A" label="پاسخ داده" />
            <LegendDot color="#F59E0B" label="مشاهده شده" />
            <LegendDot color="#E2E8F0" label="بدون پاسخ" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
            {orderedQuestions.map((qq, i) => {
              let bg = "#F1F5F9", fg = "#475569";
              const v = selections[qq.id];
              const answered = Array.isArray(v) ? v.length > 0 : !!v;
              if (answered) { bg = "#16A34A"; fg = "#fff"; }
              else if (visited[i]) { bg = "#F59E0B"; fg = "#fff"; }
              if (i === current) { bg = "#2563EB"; fg = "#fff"; }
              const locked = exam.no_going_back && i < current;
              return (
                <div key={qq.id} onClick={() => goTo(i)} style={{
                  width: 34, height: 34, borderRadius: 8, background: locked ? "#F1F5F9" : bg, color: locked ? "#CBD5E1" : fg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, cursor: locked ? "not-allowed" : "pointer",
                }}>
                  {i + 1}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showConfirmSubmit && (
        <Modal title="ثبت نهایی آزمون" onClose={() => setShowConfirmSubmit(false)}>
          <div style={{ fontSize: 14, color: "#334155", marginBottom: 20, lineHeight: 1.8 }}>
            {unansweredCount} سوال بی‌پاسخ داری. بعد از ثبت نهایی دیگر امکان تغییر پاسخ‌ها وجود ندارد. مطمئنی می‌خوای ثبت کنی؟
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setShowConfirmSubmit(false)}>بازگشت به آزمون</Button>
            <Button variant="success" onClick={() => { setShowConfirmSubmit(false); submitExam(); }} disabled={submitting}>
              {submitting ? "در حال ثبت..." : "ثبت نهایی"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ResultsScreen({ teacher, exams, questions, students, answers, initialExamId, onBack, refresh, examsOverride, examLabelFn, headerTitle, hideTopBar }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [notes, setNotes] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const myExams = examsOverride || exams.filter((e) => e.teacher_id === teacher.username);
  const [examId, setExamId] = useState(initialExamId || myExams[0]?.id || null);
  const exam = myExams.find((e) => e.id === examId);

  useEffect(() => {
    if (myExams.length === 0) { if (examId !== null) setExamId(null); return; }
    if (!myExams.some((e) => e.id === examId)) setExamId(myExams[0].id);
  }, [myExams.map((e) => e.id).join(",")]);

  useEffect(() => {
    if (!examId) return;
    (async () => {
      const keys = await listPrefix(`note:${examId}:`);
      const entries = await Promise.all(keys.map(async (k) => {
        const v = await getJSON(k);
        return [k.replace(`note:${examId}:`, ""), v];
      }));
      setNotes(Object.fromEntries(entries));
    })();
  }, [examId]);

  const saveNote = async (studentId, text) => {
    setNotes((n) => ({ ...n, [studentId]: text }));
    if (text.trim()) await setJSON(`note:${examId}:${studentId}`, text);
    else await deleteKey(`note:${examId}:${studentId}`);
  };

  if (!exam) {
    return (
      <div style={hideTopBar ? {} : { flex: 1, padding: "30px 34px" }}>
        {!hideTopBar && <TopBar title={headerTitle || "نتایج"} teacherName={teacher.fullname} />}
        <EmptyState text={myExams.length === 0 && examsOverride ? "هنوز آزمونی در مدرسه برگزار نشده است." : "ابتدا یک آزمون بساز تا نتایج آن را اینجا ببینی."} />
      </div>
    );
  }

  const examAnswers = answers.filter((a) => a.exam_id === examId);
  const byStudent = {};
  examAnswers.forEach((a) => {
    byStudent[a.student_id] = byStudent[a.student_id] || [];
    byStudent[a.student_id].push(a);
  });

  const examQuestionsList = questions.filter((q) => q.exam_id === examId);
  const examSections = [...new Set(examQuestionsList.map((q) => q.section).filter(Boolean))];
  const sectionOf = Object.fromEntries(examQuestionsList.map((q) => [q.id, q.section || null]));

  const rows = Object.entries(byStudent).map(([studentId, list]) => {
    const student = students.find((s) => s.id === studentId) || { fullname: "—", class_code: "" };
    const totalMarks = list.reduce((s, a) => s + (a.mark || 1), 0);
    const gotMarks = list.reduce((s, a) => s + awardedMarkOf(a), 0);
    const pendingCount = list.filter((a) => a.is_correct === null && a.awarded_mark == null).length;
    const pct = totalMarks ? Math.round((gotMarks / totalMarks) * 1000) / 10 : 0;
    const correctCount = list.filter((a) => a.is_correct).length;
    const timeTaken = list[0]?.time_taken || 0;
    const date = list[0]?.answered_at ? new Date(list[0].answered_at).toLocaleDateString("fa-IR") : "—";
    const sections = {};
    examSections.forEach((sec) => {
      const secList = list.filter((a) => sectionOf[a.question_id] === sec);
      const secTotal = secList.reduce((s, a) => s + (a.mark || 1), 0);
      const secGot = secList.reduce((s, a) => s + awardedMarkOf(a), 0);
      sections[sec] = secTotal ? Math.round((secGot / secTotal) * 1000) / 10 : null;
    });
    return {
      studentId, name: student.fullname, cls: student.class_code, pct, correctCount,
      total: list.length, timeTaken, date, pendingCount, tabSwitches: student.tab_switches || 0, sections,
    };
  }).sort((a, b) => b.pct - a.pct);

  const displayRows = rows
    .filter((r) => !search.trim() || (r.name + " " + (r.cls || "")).toLowerCase().includes(search.trim().toLowerCase()))
    .filter((r) => !classFilter || r.cls === classFilter);

  const classList = [...new Set(rows.map((r) => r.cls).filter(Boolean))];

  const avg = rows.length ? (rows.reduce((s, r) => s + r.pct, 0) / rows.length).toFixed(1) : "0";
  const highest = rows.length ? Math.max(...rows.map((r) => r.pct)) : 0;
  const lowest = rows.length ? Math.min(...rows.map((r) => r.pct)) : 0;
  const passRate = rows.length ? Math.round((rows.filter((r) => r.pct >= 50).length / rows.length) * 100) : 0;

  const fmtTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const medals = ["🥇", "🥈", "🥉"];

  // Score distribution buckets
  const buckets = [
    { label: "۰-۴۹", min: 0, max: 49 },
    { label: "۵۰-۵۹", min: 50, max: 59 },
    { label: "۶۰-۶۹", min: 60, max: 69 },
    { label: "۷۰-۷۹", min: 70, max: 79 },
    { label: "۸۰-۸۹", min: 80, max: 89 },
    { label: "۹۰-۱۰۰", min: 90, max: 100 },
  ].map((b) => ({ ...b, count: rows.filter((r) => r.pct >= b.min && r.pct <= b.max).length }));
  const maxBucketCount = Math.max(1, ...buckets.map((b) => b.count));

  // Per-question analysis
  const questionStats = examQuestionsList.map((q) => {
    const qAnswers = examAnswers.filter((a) => a.question_id === q.id);
    const correctN = qAnswers.filter((a) => a.is_correct).length;
    const pct = qAnswers.length ? Math.round((correctN / qAnswers.length) * 100) : null;
    return { id: q.id, text: q.question_text, answered: qAnswers.length, correctN, pct };
  });

  // Section averages (across all students)
  const sectionStats = examSections.map((sec) => {
    const qIds = new Set(examQuestionsList.filter((q) => q.section === sec).map((q) => q.id));
    const secAnswers = examAnswers.filter((a) => qIds.has(a.question_id));
    const totalMarks = secAnswers.reduce((s, a) => s + (a.mark || 1), 0);
    const gotMarks = secAnswers.reduce((s, a) => s + awardedMarkOf(a), 0);
    const pct = totalMarks ? Math.round((gotMarks / totalMarks) * 1000) / 10 : 0;
    return { name: sec, pct };
  });

  const printStudentReport = (r) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><title>کارنامه ${r.name}</title>
      <style>body{font-family:Tahoma,sans-serif;padding:40px;color:#111}
      .box{border:2px solid #111;border-radius:10px;padding:24px;max-width:480px}
      h1{font-size:18px;margin:0 0 4px}
      .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}
      .score{font-size:36px;font-weight:bold;text-align:center;margin:16px 0}</style>
      </head><body><div class="box">
      <h1>کارنامه‌ی آزمون</h1>
      <div style="color:#666;font-size:13px;margin-bottom:16px">${exam.title}</div>
      <div class="row"><span>نام دانش‌آموز</span><b>${r.name}</b></div>
      <div class="row"><span>کلاس</span><b>${r.cls || "—"}</b></div>
      <div class="row"><span>پاسخ صحیح</span><b>${r.correctCount} از ${r.total}</b></div>
      <div class="row"><span>زمان صرف‌شده</span><b>${fmtTime(r.timeTaken)}</b></div>
      <div class="row"><span>تاریخ</span><b>${r.date}</b></div>
      ${examSections.map((sec) => `<div class="row"><span>${sec}</span><b>${r.sections[sec] === null ? "—" : r.sections[sec] + "%"}</b></div>`).join("")}
      <div class="score">${r.pct}%</div>
      </div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const exportCSV = () => {
    const header = ["رتبه", "نام", "کلاس", "نمره", "پاسخ صحیح", "زمان", "تاریخ", ...examSections];
    const lines = [header.join(",")];
    rows.forEach((r, i) => {
      lines.push([i + 1, r.name, r.cls || "", r.pct, `${r.correctCount}/${r.total}`, fmtTime(r.timeTaken), r.date, ...examSections.map((sec) => r.sections[sec] === null ? "" : r.sections[sec])]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    });
    downloadTextFile(`${exam.title}-نتایج.csv`, "\uFEFF" + lines.join("\n"), "text/csv;charset=utf-8;");
  };

  return (
    <div style={hideTopBar ? {} : { flex: 1, padding: "30px 34px", overflowY: "auto" }}>
      {!hideTopBar && <TopBar title={headerTitle || "نتایج آزمون"} teacherName={teacher.fullname} />}
      <div style={{ marginBottom: 18, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "#64748B" }}>انتخاب آزمون:</span>
          <select value={examId} onChange={(e) => setExamId(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 12px" }}>
            {myExams.map((e) => <option key={e.id} value={e.id}>{examLabelFn ? examLabelFn(e) : e.title}</option>)}
          </select>
          {rows.length > 0 && (
            <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجوی نام یا کلاس..." style={{ width: 200, padding: "8px 12px" }} />
          )}
          {classList.length > 1 && (
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 12px" }}>
              <option value="">همه کلاس‌ها</option>
              {classList.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
        {rows.length > 0 && (
          <Button variant="ghost" onClick={exportCSV}><Download size={15} />خروجی CSV</Button>
        )}
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <StatCard icon={TrendingUp} label="میانگین نمره" value={`${avg}%`} color="#2563EB" />
        <StatCard icon={Award} label="بالاترین نمره" value={`${highest}%`} color="#16A34A" />
        <StatCard icon={BarChart3} label="پایین‌ترین نمره" value={`${lowest}%`} color="#DC2626" />
        <StatCard icon={CheckCircle2} label="درصد قبولی" value={`${passRate}%`} color="#8B5CF6" />
        <StatCard icon={Users} label="تعداد شرکت‌کننده" value={rows.length} color="#0EA5E9" />
      </div>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 22 }}>
        {rows.length === 0 ? (
          <EmptyState text="هنوز دانش‌آموزی در این آزمون شرکت نکرده است." />
        ) : displayRows.length === 0 ? (
          <EmptyState text="نتیجه‌ای با این جستجو پیدا نشد." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "right", color: "#64748B", fontSize: 12, fontWeight: 700 }}>
                <th style={{ padding: "8px 6px" }}>رتبه</th>
                <th style={{ padding: "8px 6px" }}>نام دانش‌آموز</th>
                <th style={{ padding: "8px 6px" }}>کلاس</th>
                <th style={{ padding: "8px 6px" }}>نمره</th>
                <th style={{ padding: "8px 6px" }}>پاسخ صحیح</th>
                <th style={{ padding: "8px 6px" }}>زمان</th>
                <th style={{ padding: "8px 6px" }}>تاریخ</th>
                <th style={{ padding: "8px 6px" }}>وضعیت</th>
                {examSections.length > 0 && <th style={{ padding: "8px 6px" }}>بخش‌ها</th>}
                <th style={{ padding: "8px 6px" }}>یادداشت</th>
                <th style={{ padding: "8px 6px" }}></th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r, i) => (
                <React.Fragment key={r.studentId}>
                <tr style={{ borderTop: "1px solid #F1F5F9", fontSize: 14 }}>
                  <td style={{ padding: "12px 6px" }}>{medals[i] || i + 1}</td>
                  <td style={{ padding: "12px 6px", fontWeight: 700, color: "#1E293B" }}>{r.name}</td>
                  <td style={{ padding: "12px 6px", color: "#475569" }}>{r.cls || "—"}</td>
                  <td style={{ padding: "12px 6px", fontWeight: 800, color: r.pct >= 50 ? "#16A34A" : "#DC2626" }}>{r.pct}%</td>
                  <td style={{ padding: "12px 6px", color: "#475569" }}>{r.correctCount} / {r.total}</td>
                  <td style={{ padding: "12px 6px", color: "#475569" }}>{fmtTime(r.timeTaken)}</td>
                  <td style={{ padding: "12px 6px", color: "#475569" }}>{r.date}</td>
                  <td style={{ padding: "12px 6px" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {r.pendingCount > 0 && <Badge tone="orange">{r.pendingCount} در انتظار تصحیح</Badge>}
                      {r.tabSwitches > 0 && (
                        <Badge tone="red">
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                            <AlertTriangle size={11} /> {r.tabSwitches} خروج
                          </span>
                        </Badge>
                      )}
                      {r.pendingCount === 0 && r.tabSwitches === 0 && <span style={{ fontSize: 12, color: "#94A3B8" }}>—</span>}
                    </div>
                  </td>
                  {examSections.length > 0 && (
                    <td style={{ padding: "12px 6px" }}>
                      <span
                        onClick={() => setExpandedId(expandedId === r.studentId ? null : r.studentId)}
                        style={{ fontSize: 12, color: "#2563EB", cursor: "pointer", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}
                      >
                        {expandedId === r.studentId ? "بستن" : "نمایش"}
                      </span>
                    </td>
                  )}
                  <td style={{ padding: "12px 6px" }}>
                    <TextInput
                      defaultValue={notes[r.studentId] || ""}
                      onBlur={(e) => saveNote(r.studentId, e.target.value)}
                      placeholder="یادداشت..."
                      style={{ width: 140, padding: "6px 8px", fontSize: 12 }}
                    />
                  </td>
                  <td style={{ padding: "12px 6px" }}>
                    <FileText size={16} style={{ cursor: "pointer", color: "#64748B" }} onClick={() => printStudentReport(r)} />
                  </td>
                </tr>
                {examSections.length > 0 && expandedId === r.studentId && (
                  <tr style={{ background: "#F8FAFC" }}>
                    <td colSpan={11} style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                        {examSections.map((sec) => (
                          <div key={sec} style={{ fontSize: 12.5, color: "#334155" }}>
                            <span style={{ color: "#64748B" }}>{sec}: </span>
                            <span style={{ fontWeight: 800, color: r.sections[sec] === null ? "#94A3B8" : r.sections[sec] >= 50 ? "#16A34A" : "#DC2626" }}>
                              {r.sections[sec] === null ? "—" : `${r.sections[sec]}%`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <EssayGrading examId={examId} questions={questions} answers={answers} students={students} refresh={refresh} />

      {rows.length > 0 && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 20 }}>
          <div style={{ flex: "1 1 320px", background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", marginBottom: 16 }}>توزیع نمرات</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 140 }}>
              {buckets.map((b) => (
                <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1E293B" }}>{b.count}</div>
                  <div style={{
                    width: "100%", borderRadius: "6px 6px 0 0", background: "#2563EB",
                    height: `${Math.max(4, (b.count / maxBucketCount) * 100)}px`,
                  }} />
                  <div style={{ fontSize: 11, color: "#64748B" }}>{b.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: "1 1 320px", background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", marginBottom: 16 }}>تحلیل سوالات</div>
            {questionStats.length === 0 ? (
              <div style={{ fontSize: 13, color: "#94A3B8" }}>سوالی برای این آزمون وجود ندارد.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 220, overflowY: "auto" }}>
                {questionStats.map((qs, i) => (
                  <div key={qs.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#334155", marginBottom: 4 }}>
                      <span>{i + 1}. {qs.text.length > 40 ? qs.text.slice(0, 40) + "…" : qs.text}</span>
                      <span style={{ fontWeight: 700, color: qs.pct === null ? "#94A3B8" : qs.pct >= 50 ? "#16A34A" : "#DC2626" }}>
                        {qs.pct === null ? "—" : `${qs.pct}%`}
                      </span>
                    </div>
                    <div style={{ height: 6, background: "#EEF1F6", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${qs.pct || 0}%`, height: "100%", background: qs.pct !== null && qs.pct >= 50 ? "#16A34A" : "#DC2626" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {examSections.length > 0 && (
            <div style={{ flex: "1 1 320px", background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 22 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", marginBottom: 16 }}>میانگین نمره به تفکیک بخش</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {sectionStats.map((ss) => (
                  <div key={ss.name}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#334155", marginBottom: 4 }}>
                      <span>{ss.name}</span>
                      <span style={{ fontWeight: 700, color: ss.pct >= 50 ? "#16A34A" : "#DC2626" }}>{ss.pct}%</span>
                    </div>
                    <div style={{ height: 8, background: "#EEF1F6", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${ss.pct}%`, height: "100%", background: ss.pct >= 50 ? "#16A34A" : "#DC2626" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   ESSAY GRADING — manual correction for open-answer questions
--------------------------------------------------------- */

function EssayGrading({ examId, questions, answers, students, refresh }) {
  const essayQuestions = questions.filter((q) => q.exam_id === examId && q.type === "essay");
  const [drafts, setDrafts] = useState({}); // answerId -> input value
  const [savingId, setSavingId] = useState(null);

  if (essayQuestions.length === 0) return null;

  const items = [];
  essayQuestions.forEach((q) => {
    answers.filter((a) => a.question_id === q.id && a.selected_option).forEach((a) => {
      const student = students.find((s) => s.id === a.student_id);
      items.push({ answer: a, question: q, studentName: student?.fullname || "—" });
    });
  });

  if (items.length === 0) return null;

  const pending = items.filter((it) => it.answer.awarded_mark == null);
  const graded = items.filter((it) => it.answer.awarded_mark != null);

  const grade = async (answerId, questionMark) => {
    const raw = drafts[answerId];
    let val = Number(raw);
    if (Number.isNaN(val)) return;
    if (val < 0) val = 0;
    if (val > questionMark) val = questionMark;
    setSavingId(answerId);
    // Answers are stored batched per exam attempt (one "answers:<studentId>" key
    // holding all of that attempt's answer records) — find which student this
    // answer belongs to, then update it inside that batch and write it back.
    const owningAnswer = answers.find((a) => a.id === answerId);
    if (owningAnswer) {
      const batch = (await getJSON(`answers:${owningAnswer.student_id}`)) || [];
      const updatedBatch = batch.map((a) =>
        a.id === answerId ? { ...a, awarded_mark: val, is_correct: val >= questionMark } : a
      );
      await setJSON(`answers:${owningAnswer.student_id}`, updatedBatch);
    }
    setSavingId(null);
    await refresh();
  };

  // Suggests a score by checking how many of the question's keywords appear
  // in the student's answer text. Only fills the draft field — the teacher
  // still has to press "ثبت نمره" to actually save it.
  const suggestFromKeywords = (answerId, question, answerText) => {
    const kws = question.keywords || [];
    if (kws.length === 0) return;
    const text = (answerText || "").toLowerCase();
    const matched = kws.filter((k) => text.includes(k.toLowerCase())).length;
    const suggested = Math.round((matched / kws.length) * question.mark * 10) / 10;
    setDrafts((d) => ({ ...d, [answerId]: String(suggested) }));
  };

  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 22, marginTop: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", marginBottom: 4 }}>تصحیح پاسخ‌های تشریحی</div>
      <div style={{ fontSize: 12, color: "#64748B", marginBottom: 16 }}>
        {pending.length > 0 ? `${pending.length} پاسخ در انتظار تصحیح` : "همه‌ی پاسخ‌ها تصحیح شده‌اند."}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[...pending, ...graded].map(({ answer, question, studentName }) => (
          <div key={answer.id} style={{ border: "1px solid #EEF1F6", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{studentName}</div>
                <div style={{ fontSize: 12, color: "#64748B" }}>{question.question_text}</div>
              </div>
              {answer.awarded_mark != null && <Badge tone={answer.awarded_mark >= question.mark ? "green" : "orange"}>نمره‌داده‌شده: {answer.awarded_mark} از {question.mark}</Badge>}
            </div>
            <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#334155", marginBottom: 10, whiteSpace: "pre-wrap" }}>
              {answer.selected_option}
            </div>
            {question.model_answer && (
              <div style={{ fontSize: 12, color: "#16A34A", marginBottom: 10 }}>پاسخ نمونه: {question.model_answer}</div>
            )}
            {(question.keywords || []).length > 0 && (
              <div style={{ fontSize: 12, color: "#64748B", marginBottom: 10 }}>
                کلمات کلیدی: {question.keywords.map((k) => {
                  const found = (answer.selected_option || "").toLowerCase().includes(k.toLowerCase());
                  return <span key={k} style={{ color: found ? "#16A34A" : "#CBD5E1", fontWeight: found ? 700 : 400, marginInlineEnd: 8 }}>{k}</span>;
                })}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {(question.keywords || []).length > 0 && (
                <Button variant="ghost" style={{ fontSize: 12, padding: "8px 12px" }} onClick={() => suggestFromKeywords(answer.id, question, answer.selected_option)}>
                  پیشنهاد نمره (خودکار)
                </Button>
              )}
              <TextInput
                type="number" min={0} max={question.mark}
                placeholder={`نمره از ${question.mark}`}
                value={drafts[answer.id] ?? (answer.awarded_mark ?? "")}
                onChange={(e) => setDrafts((d) => ({ ...d, [answer.id]: e.target.value }))}
                style={{ width: 120 }}
              />
              <Button variant="ghost" style={{ fontSize: 13, padding: "8px 14px" }} onClick={() => grade(answer.id, question.mark)} disabled={savingId === answer.id}>
                {savingId === answer.id ? "..." : "ثبت نمره"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   CLASSES + ROSTER — teacher pre-registers students per class
   and assigns each a login code, so students don't type their
   name when starting an exam.
--------------------------------------------------------- */
