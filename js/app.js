/* ---------------------------------------------------------
   ROOT APP
   © ghobeishawi - All rights reserved.
--------------------------------------------------------- */
function EduExamApp() {
  const [authView, setAuthView] = useState("login"); // login | register | forgot
  const [portalMode, setPortalMode] = useState("teacher"); // teacher | student
  const [teacher, setTeacher] = useState(null);
  const [view, setView] = useState("dashboard");
  const [activeExamId, setActiveExamId] = useState(null);
  const [activeClassId, setActiveClassId] = useState(null);
  // If the URL is a student exam link (?exam=ID), jump straight into it, no login needed.
  const [studentExamId, setStudentExamId] = useState(
    () => new URLSearchParams(window.location.search).get("exam")
  );
  // If the URL is a password-reset link (?reset=TOKEN), show the reset screen.
  const [resetToken, setResetToken] = useState(
    () => new URLSearchParams(window.location.search).get("reset")
  );
  const [teacherExists, setTeacherExists] = useState(false);
  const [teachers, setTeachers] = useState([]);

  const [exams, setExams] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [students, setStudents] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [roster, setRoster] = useState([]);
  const [messages, setMessages] = useState([]);
  const [cheatAlerts, setCheatAlerts] = useState([]);
  const [ready, setReady] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [alertBtnPos, setAlertBtnPos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("eduexam_alertbtn_pos"));
      if (saved && typeof saved.top === "number" && typeof saved.left === "number") return saved;
    } catch { /* use default below */ }
    return { top: 22, left: 22 };
  });
  const draggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const startDrag = (clientX, clientY) => {
    draggingRef.current = true;
    dragMovedRef.current = false;
    dragOffsetRef.current = { x: clientX - alertBtnPos.left, y: clientY - alertBtnPos.top };
  };
  const onDragMove = (clientX, clientY) => {
    if (!draggingRef.current) return;
    dragMovedRef.current = true;
    const btn = 44;
    const maxLeft = window.innerWidth - btn - 6;
    const maxTop = window.innerHeight - btn - 6;
    const left = Math.min(Math.max(clientX - dragOffsetRef.current.x, 6), maxLeft);
    const top = Math.min(Math.max(clientY - dragOffsetRef.current.y, 6), maxTop);
    setAlertBtnPos({ top, left });
  };
  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { localStorage.setItem("eduexam_alertbtn_pos", JSON.stringify(alertBtnPos)); } catch { /* ignore */ }
  };
  useEffect(() => {
    const onMouseMove = (e) => onDragMove(e.clientX, e.clientY);
    const onTouchMove = (e) => { if (draggingRef.current && e.touches[0]) { e.preventDefault(); onDragMove(e.touches[0].clientX, e.touches[0].clientY); } };
    const onUp = () => endDrag();
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [alertBtnPos]);

  // Restore a "remembered" login (see saveSession/loadSession in ui.js) so
  // refreshing the page doesn't force a re-login. Only trusts the saved
  // session if the stored password hash still matches the current one on
  // the teacher record — so changing the password anywhere invalidates
  // any other saved sessions automatically.
  useEffect(() => {
    (async () => {
      const session = loadSession();
      if (session) {
        const t = await getJSON(`teacher:${session.username}`);
        if (t && t.password === session.passwordHash) {
          setTeacher(t);
        } else {
          clearSession();
        }
      }
      setSessionChecked(true);
    })();
  }, []);

  const refresh = useCallback(async () => {
    const [ex, qs, st, answerBatches, cl, ro, msg, alerts, allTeachers] = await Promise.all([
      loadAll("exam:"), loadAll("question:"), loadAll("student:"), loadAll("answers:"),
      loadAll("class:"), loadAll("roster:"), loadAll("message:"), loadAll("cheatalert:"),
      loadAll("teacher:"),
    ]);
    // Each "answers:<studentId>" key holds a whole exam attempt's worth of
    // answer records as one array — flatten so the rest of the app can keep
    // treating `answers` as a flat list of individual answer records.
    const an = answerBatches.flat().filter(Boolean);
    setExams(ex); setQuestions(qs); setStudents(st); setAnswers(an);
    setClasses(sortByFa(cl, (c) => c.name));
    setRoster(sortByFa(ro, (r) => r.fullname));
    setMessages(msg);
    setCheatAlerts(alerts);
    setTeachers(allTeachers);
  }, []);

  // Used instead of refresh() for the student exam-link flow (?exam=ID).
  // refresh() pulls the *entire* database — every teacher's password hash,
  // every exam's answer key, every student's records — which is fine for a
  // logged-in teacher's own dashboard but must never be sent to an anonymous
  // student. This hits a dedicated endpoint that returns only the one exam's
  // data, with correct answers stripped out server-side.
  const loadStudentSession = useCallback(async (examId) => {
    try {
      const r = await fetch(`/api/exam-session?examId=${encodeURIComponent(examId)}`);
      if (!r.ok) { setExams([]); return; }
      const data = await r.json();
      setExams([data.exam]);
      setQuestions(data.questions || []);
      setRoster(sortByFa(data.roster || [], (r2) => r2.fullname));
      setClasses(sortByFa(data.classes || [], (c) => c.name));
    } catch {
      setExams([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (studentExamId) {
        await loadStudentSession(studentExamId);
        setReady(true);
        return;
      }
      // Whether a teacher account exists yet decides whether the login screen
      // offers "register" — this has to work before anyone is logged in, so
      // it's a small dedicated public endpoint rather than the authenticated
      // refresh() below.
      try {
        const r = await fetch("/api/teacher-exists");
        if (r.ok) {
          const d = await r.json();
          setTeacherExists(!!d.exists);
        }
      } catch { /* ignore — defaults to false, register screen offered */ }
      setReady(true);
    })();
  }, [studentExamId, loadStudentSession]);

  // Load the full authenticated dataset once a teacher is actually logged in
  // (fresh login, or a restored session) — never before, since /api/kv and
  // /api/list now require a valid session token.
  useEffect(() => {
    if (teacher && !studentExamId) refresh();
  }, [teacher, studentExamId, refresh]);

  // Auto-sync any exam submissions that were queued locally because the
  // student had no internet connection at the time. Retried whenever the
  // browser reports it's back online, and periodically as a fallback (the
  // 'online' event isn't always reliable on flaky mobile connections).
  useEffect(() => {
    const trySync = async () => {
      const synced = await flushOfflineQueue();
      if (synced > 0) {
        if (studentExamId) loadStudentSession(studentExamId);
        else if (teacher) refresh();
      }
    };
    trySync();
    window.addEventListener("online", trySync);
    const interval = setInterval(trySync, 20000);
    return () => {
      window.removeEventListener("online", trySync);
      clearInterval(interval);
    };
  }, [refresh, studentExamId, loadStudentSession, teacher]);

  // Optimistic local-state helpers for classes/roster — KV's list endpoint
  // is only eventually consistent, so a just-written/deleted key can take
  // a few seconds to show up (or disappear) via refresh(). These update the
  // UI immediately; refresh() still runs afterward to stay in sync.
  const addLocalClass = useCallback((record) => {
    setClasses((prev) => sortByFa([...prev, record], (c) => c.name));
  }, []);
  const removeLocalClass = useCallback((id) => {
    setClasses((prev) => prev.filter((c) => c.id !== id));
    setRoster((prev) => prev.filter((r) => r.class_id !== id));
  }, []);
  const updateLocalClass = useCallback((record) => {
    setClasses((prev) => sortByFa(prev.map((c) => (c.id === record.id ? record : c)), (c) => c.name));
  }, []);
  const addLocalRoster = useCallback((record) => {
    setRoster((prev) => sortByFa([...prev, record], (r) => r.fullname));
  }, []);
  const addLocalRosterMany = useCallback((records) => {
    setRoster((prev) => sortByFa([...prev, ...records], (r) => r.fullname));
  }, []);
  const updateLocalRoster = useCallback((record) => {
    setRoster((prev) => sortByFa(prev.map((r) => (r.id === record.id ? record : r)), (r) => r.fullname));
  }, []);
  const removeLocalRoster = useCallback((id) => {
    setRoster((prev) => prev.filter((r) => r.id !== id));
  }, []);

  if (!ready || !sessionChecked) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC", fontFamily: "inherit", color: "#64748B" }}>
        در حال بارگذاری...
      </div>
    );
  }

  // Student is taking an exam — separate full-screen flow, no auth needed.
  if (studentExamId) {
    const exam = exams.find((e) => e.id === studentExamId);
    if (!exam) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          آزمون یافت نشد.
        </div>
      );
    }
    return (
      <TakeExamScreen
        exam={exam}
        questions={questions}
        roster={roster.filter((r) => r.teacher_id === exam.teacher_id)}
        classes={classes.filter((c) => c.teacher_id === exam.teacher_id)}
        onFinish={() => loadStudentSession(studentExamId)}
        onExit={() => {
          setStudentExamId(null);
          const url = new URL(window.location.href);
          url.searchParams.delete("exam");
          window.history.replaceState({}, "", url);
        }}
      />
    );
  }

  // Password-reset link (?reset=TOKEN) — shown regardless of login state.
  if (resetToken) {
    return (
      <ResetPasswordScreen
        token={resetToken}
        onDone={() => {
          setResetToken(null);
          const url = new URL(window.location.href);
          url.searchParams.delete("reset");
          window.history.replaceState({}, "", url);
        }}
      />
    );
  }

  if (!teacher) {
    const showRegister = authView === "register" && !teacherExists;
    const showForgot = authView === "forgot";
    if (showForgot) {
      return <ForgotPasswordScreen goLogin={() => setAuthView("login")} />;
    }
    return showRegister ? (
      <RegisterScreen
        onRegistered={(t) => { setTeacher(t); setTeacherExists(true); }}
        goLogin={() => setAuthView("login")}
      />
    ) : (
      <LoginScreen
        onLogin={setTeacher}
        goRegister={() => setAuthView("register")}
        goForgot={() => setAuthView("forgot")}
        allowRegister={!teacherExists}
        portalMode={portalMode}
        setPortalMode={setPortalMode}
        portalData={{ roster, students, answers, exams, questions, classes, messages }}
      />
    );
  }

  // Admin accounts get a completely separate screen — they manage teacher
  // accounts for the whole school rather than owning classes/exams themselves.
  if (teacher.role === "admin") {
    return (
      <AdminDashboardScreen
        teacher={teacher}
        teachers={teachers.filter((t) => t.role !== "admin")}
        exams={exams}
        classes={classes}
        roster={roster}
        students={students}
        questions={questions}
        answers={answers}
        messages={messages}
        cheatAlerts={cheatAlerts}
        onLogout={() => { performLogout(); setTeacher(null); setView("dashboard"); }}
        onUpdateSelf={(updated) => { setTeacher(updated); saveSession(updated.username, updated.password, getAuthToken()); }}
        refresh={refresh}
      />
    );
  }

  const activeExam = exams.find((e) => e.id === activeExamId);
  const activeClass = classes.find((c) => c.id === activeClassId);
  const myAlerts = cheatAlerts.filter((a) => a.teacher_id === teacher.username)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const unseenAlertCount = myAlerts.filter((a) => !a.seen).length;
  const markAlertsSeen = async () => {
    const unseen = myAlerts.filter((a) => !a.seen);
    await Promise.all(unseen.map((a) => setJSON(`cheatalert:${a.id}`, { ...a, seen: true })));
    if (unseen.length > 0) await refresh();
  };
  const dismissAlert = async (id) => {
    await deleteKey(`cheatalert:${id}`);
    await refresh();
  };

  return (
    <div style={{ display: "flex", flexDirection: "row-reverse", minHeight: "100vh" }}>
      <div style={{ position: "fixed", top: alertBtnPos.top, left: alertBtnPos.left, zIndex: 50 }}>
        <div
          onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
          onTouchStart={(e) => { const t = e.touches[0]; if (t) startDrag(t.clientX, t.clientY); }}
          onClick={() => {
            if (dragMovedRef.current) { dragMovedRef.current = false; return; } // was a drag, not a tap
            const next = !showAlerts; setShowAlerts(next); if (next) markAlertsSeen();
          }}
          style={{
            width: 44, height: 44, borderRadius: "50%", background: "#fff", boxShadow: "0 6px 20px rgba(0,0,0,.14)",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab", position: "relative",
            touchAction: "none", userSelect: "none",
          }}
        >
          <AlertTriangle size={20} color={unseenAlertCount > 0 ? "#DC2626" : "#94A3B8"} />
          {unseenAlertCount > 0 && (
            <div style={{
              position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, background: "#DC2626",
              color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
            }}>{unseenAlertCount}</div>
          )}
        </div>
        {showAlerts && (
          <div style={{
            position: "absolute", top: 52, left: 0, width: 320, maxHeight: 380, overflowY: "auto",
            background: "#fff", borderRadius: 14, boxShadow: "0 10px 30px rgba(0,0,0,.18)", padding: 14,
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", marginBottom: 10 }}>هشدارهای تخلف در آزمون</div>
            {myAlerts.length === 0 ? (
              <div style={{ fontSize: 12, color: "#94A3B8" }}>موردی ثبت نشده است.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {myAlerts.map((a) => (
                  <div key={a.id} style={{ border: "1px solid #EEF1F6", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{a.student_name}</div>
                        <div style={{ fontSize: 12, color: "#64748B" }}>{a.exam_title}</div>
                        <div style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}>{a.tab_switches} بار خروج از صفحه‌ی آزمون</div>
                      </div>
                      <div onClick={() => dismissAlert(a.id)} style={{ cursor: "pointer", color: "#94A3B8", fontSize: 16, lineHeight: 1 }}>×</div>
                    </div>
                    <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>{new Date(a.created_at).toLocaleString("fa-IR")}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <Sidebar
        active={view}
        onNavigate={(v) => { setView(v); setActiveExamId(null); setActiveClassId(null); }}
        onLogout={() => { performLogout(); setTeacher(null); setView("dashboard"); }}
        teacherName={teacher.fullname}
      />
      <div style={{ flex: 1, background: "#F8FAFC", minHeight: "100vh" }}>
        {view === "dashboard" && (
          <DashboardScreen
            teacher={teacher} exams={exams} questions={questions} students={students} answers={answers}
            onNavigate={setView}
            onOpenExam={(id) => { setActiveExamId(id); setView("manageQuestions"); }}
          />
        )}
        {view === "exams" && (
          <ExamsScreen
            teacher={teacher} exams={exams} questions={questions} answers={answers} classes={classes}
            onNavigate={(v, examId) => { setView(v); if (examId) setActiveExamId(examId); }}
            onOpenExam={(id) => { setActiveExamId(id); setView("manageQuestions"); }}
            refresh={refresh}
          />
        )}
        {view === "manageQuestions" && activeExam && (
          <QuestionsScreen
            exam={activeExam} questions={questions} exams={exams} teacher={teacher}
            onBack={() => setView("exams")}
            refresh={refresh}
          />
        )}
        {view === "questionbank" && (
          <QuestionBankScreen
            teacher={teacher} questions={questions} exams={exams}
            refresh={refresh}
          />
        )}
        {view === "results" && (
          <ResultsScreen
            teacher={teacher} exams={exams} questions={questions} students={students} answers={answers}
            initialExamId={activeExamId}
            onBack={() => setView("exams")}
            refresh={refresh}
          />
        )}
        {view === "classes" && (
          <ClassesScreen
            teacher={teacher} classes={classes} roster={roster}
            onOpenClass={(id) => { setActiveClassId(id); setView("manageRoster"); }}
            refresh={refresh}
            addLocalClass={addLocalClass}
            removeLocalClass={removeLocalClass}
            updateLocalClass={updateLocalClass}
          />
        )}
        {view === "manageRoster" && activeClass && (
          <RosterScreen
            classroom={activeClass} roster={roster} teacher={teacher}
            onBack={() => setView("classes")}
            refresh={refresh}
            addLocalRoster={addLocalRoster}
            addLocalRosterMany={addLocalRosterMany}
            updateLocalRoster={updateLocalRoster}
            removeLocalRoster={removeLocalRoster}
          />
        )}
        {view === "students" && (
          <StudentsScreen teacher={teacher} students={students} exams={exams} answers={answers} questions={questions} refresh={refresh} />
        )}
        {view === "messages" && (
          <MessagesScreen teacher={teacher} classes={classes} roster={roster} messages={messages} refresh={refresh} />
        )}
        {view === "settings" && (
          <SettingsScreen teacher={teacher} onUpdate={setTeacher} refresh={refresh} exams={exams} students={students} />
        )}

        {/* Quick access: preview the student exam-taking flow for any exam you own */}
        {(view === "exams" || view === "dashboard") && exams.some(e => e.teacher_id === teacher.username) && (
          <div style={{ position: "fixed", bottom: 22, left: 22 }}>
            <select
              defaultValue=""
              onChange={(e) => { if (e.target.value) setStudentExamId(e.target.value); }}
              style={{ ...inputStyle, padding: "10px 14px", boxShadow: "0 6px 20px rgba(0,0,0,.12)" }}
            >
              <option value="" disabled>پیش‌نمایش آزمون به‌عنوان دانش‌آموز</option>
              {exams.filter(e => e.teacher_id === teacher.username).map(e => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

console.log(
  "%cآزمون‌ساز معلم%c\n© ghobeishawi - تمامی حقوق محفوظ است",
  "font-weight:bold;font-size:14px;color:#2563EB;",
  "color:#64748B;font-size:12px;"
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<EduExamApp />);
