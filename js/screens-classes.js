/* ---------------------------------------------------------
   CLASSES / ROSTER / STUDENTS / MESSAGES / STUDENT PORTAL / SETTINGS
   © ghobeishawi - All rights reserved.
--------------------------------------------------------- */
function ClassesScreen({ teacher, classes, roster, onOpenClass }) {
  const myClasses = classes.filter((c) => c.teacher_id === teacher.username)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div style={{ flex: 1, padding: "30px 34px", overflowY: "auto" }}>
      <TopBar title="کلاس‌ها" teacherName={teacher.fullname} />
      <div style={{ fontSize: 12.5, color: "#94A3B8", marginBottom: 18 }}>
        کلاس‌بندی و افزودن/حذف دانش‌آموز توسط مدیر مدرسه انجام می‌شود.
      </div>

      {myClasses.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6" }}>
          <EmptyState text="هنوز کلاسی برای شما تعریف نشده است." />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))", gap: 16 }}>
          {myClasses.map((c) => {
            const count = roster.filter((r) => r.class_id === c.id).length;
            return (
              <div key={c.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1E293B", marginBottom: 6 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "#64748B", marginBottom: 16 }}>{count} دانش‌آموز</div>
                <Button variant="ghost" style={{ fontSize: 13, padding: "8px 12px" }} onClick={() => onOpenClass(c.id)}>مشاهده دانش‌آموزان</Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RosterScreen({ classroom, roster, teacher, onBack, refresh, addLocalRoster, addLocalRosterMany, updateLocalRoster, removeLocalRoster }) {
  const members = roster.filter((r) => r.class_id === classroom.id);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const addStudent = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const allCodes = roster.filter((r) => r.teacher_id === teacher.username).map((r) => r.code);
    const id = uid();
    const code = generateCode(allCodes);
    const record = {
      id, class_id: classroom.id, teacher_id: teacher.username,
      fullname: name.trim(), code, created_at: new Date().toISOString(),
    };
    // Show it in the list immediately — KV's list endpoint can lag a few
    // seconds behind a just-written key, so we don't wait for refresh().
    addLocalRoster && addLocalRoster(record);
    await setJSON(`roster:${id}`, record);
    setSaving(false);
    setName("");
    refresh();
  };

  // Bulk add: one student per line (or comma-separated). Blank lines are ignored,
  // duplicate names already in this class are skipped, and every new student gets
  // its own unique auto-generated code.
  const addBulkStudents = async () => {
    const names = bulkText
      .split(/[\n,]/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length === 0) { setBulkMsg("نامی برای افزودن پیدا نشد."); return; }
    setBulkSaving(true);
    const existingNames = new Set(members.map((m) => m.fullname.trim()));
    const usedCodes = roster.filter((r) => r.teacher_id === teacher.username).map((r) => r.code);
    let added = 0, skipped = 0;
    const newRecords = [];
    for (const n of names) {
      if (existingNames.has(n)) { skipped++; continue; }
      existingNames.add(n);
      const id = uid();
      const code = generateCode(usedCodes);
      usedCodes.push(code);
      const record = {
        id, class_id: classroom.id, teacher_id: teacher.username,
        fullname: n, code, created_at: new Date().toISOString(),
      };
      newRecords.push(record);
      await setJSON(`roster:${id}`, record);
      added++;
    }
    if (newRecords.length > 0) addLocalRosterMany && addLocalRosterMany(newRecords);
    setBulkSaving(false);
    setBulkMsg(`${added} دانش‌آموز اضافه شد${skipped > 0 ? ` — ${skipped} مورد تکراری نادیده گرفته شد.` : "."}`);
    if (added > 0) {
      setBulkText("");
      refresh();
    }
  };

  const regenerateCode = async (member) => {
    const allCodes = roster.filter((r) => r.teacher_id === teacher.username && r.id !== member.id).map((r) => r.code);
    const code = generateCode(allCodes);
    const updated = { ...member, code };
    updateLocalRoster && updateLocalRoster(updated);
    await setJSON(`roster:${member.id}`, updated);
    refresh();
  };

  const removeStudent = async (id) => {
    if (!window.confirm("این دانش‌آموز از کلاس حذف شود؟")) return;
    setDeletingId(id);
    // Remove from the visible list right away instead of waiting on a
    // KV list refresh (which can take a few seconds to catch up).
    removeLocalRoster && removeLocalRoster(id);
    await deleteKey(`roster:${id}`);
    setDeletingId(null);
    refresh();
  };

  const printCodes = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const cards = members.map((m) => `
      <div style="border:1.5px dashed #999;border-radius:10px;padding:14px;text-align:center;width:150px;display:inline-block;margin:6px">
        <div style="font-size:12px;color:#666">${classroom.name}</div>
        <div style="font-size:14px;font-weight:bold;margin:6px 0">${m.fullname}</div>
        <div style="font-size:22px;font-weight:bold;letter-spacing:2px">${m.code}</div>
      </div>`).join("");
    win.document.write(`<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><title>کدهای ${classroom.name}</title>
      <style>body{font-family:Tahoma,sans-serif;padding:20px}</style></head><body>${cards}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div style={{ flex: 1, padding: "30px 34px", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748B", marginBottom: 6, cursor: "pointer" }} onClick={onBack}>
        <ArrowRight size={15} /> بازگشت به کلاس‌ها
      </div>
      <TopBar title={`دانش‌آموزان — ${classroom.name}`} teacherName={teacher.fullname} />

      <div style={{ background: "#FFFBEB", borderRadius: 16, border: "1px solid #FDE68A", padding: 16, marginBottom: 20, fontSize: 12.5, color: "#92400E" }}>
        افزودن و حذف دانش‌آموز توسط مدیر مدرسه انجام می‌شود.
      </div>

      {members.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <Button variant="ghost" onClick={printCodes}><FileText size={15} />چاپ کارت کدها برای پخش بین دانش‌آموزان</Button>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 22 }}>
        {members.length === 0 ? (
          <EmptyState text="هنوز دانش‌آموزی به این کلاس اضافه نشده." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "right", color: "#64748B", fontSize: 12, fontWeight: 700 }}>
                <th style={{ padding: "8px 6px" }}>نام</th>
                <th style={{ padding: "8px 6px" }}>کد ورود</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} style={{ borderTop: "1px solid #F1F5F9", fontSize: 14 }}>
                  <td style={{ padding: "12px 6px", fontWeight: 700, color: "#1E293B" }}>{m.fullname}</td>
                  <td style={{ padding: "12px 6px" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 800, color: "#2563EB", letterSpacing: 2 }}>{m.code}</span>
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

/* ---------------------------------------------------------
   STUDENTS + SETTINGS (simple)
--------------------------------------------------------- */

function StudentsScreen({ teacher, students, exams, answers, questions, refresh }) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [deletingKey, setDeletingKey] = useState(null);
  const myStudents = students.filter((s) => s.teacher_id === teacher.username);

  const removeStudentRecord = async (ids) => {
    if (!window.confirm("سوابق شرکت این دانش‌آموز در همه‌ی آزمون‌ها حذف شود؟ این کار قابل بازگشت نیست.")) return;
    setDeletingKey(ids.join(","));
    await Promise.all(ids.map((id) => deleteKey(`answers:${id}`)));
    await Promise.all(ids.map((id) => deleteKey(`student:${id}`)));
    setDeletingKey(null);
    if (refresh) await refresh();
  };

  // Group by name since each exam attempt creates a separate student record.
  const byName = {};
  myStudents.forEach((s) => {
    const key = s.fullname.trim().toLowerCase();
    byName[key] = byName[key] || { fullname: s.fullname, class_code: s.class_code, ids: [] };
    byName[key].ids.push(s.id);
  });

  const rows = Object.values(byName).map((g) => {
    const myAnswers = answers.filter((a) => g.ids.includes(a.student_id));
    const examIds = [...new Set(myAnswers.map((a) => a.exam_id))];
    const trend = examIds.map((examId) => {
      const list = myAnswers.filter((a) => a.exam_id === examId);
      const totalMarks = list.reduce((s, a) => s + (a.mark || 1), 0);
      const gotMarks = list.reduce((s, a) => s + awardedMarkOf(a), 0);
      const pct = totalMarks ? Math.round((gotMarks / totalMarks) * 1000) / 10 : 0;
      const exam = exams.find((e) => e.id === examId);
      const date = list[0]?.answered_at || null;
      return { examId, title: exam?.title || "—", pct, date };
    }).sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    return { ...g, examCount: examIds.length, trend };
  });

  const displayRows = search.trim()
    ? rows.filter((s) => (s.fullname + " " + (s.class_code || "")).toLowerCase().includes(search.trim().toLowerCase()))
    : rows;

  return (
    <div style={{ flex: 1, padding: "30px 34px", overflowY: "auto" }}>
      <TopBar title="دانش‌آموزان" teacherName={teacher.fullname} />
      {rows.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجوی نام یا کلاس..." style={{ maxWidth: 260 }} />
        </div>
      )}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 22 }}>
        {rows.length === 0 ? (
          <EmptyState text="هنوز دانش‌آموزی در آزمون‌های تو شرکت نکرده است." />
        ) : displayRows.length === 0 ? (
          <EmptyState text="نتیجه‌ای با این جستجو پیدا نشد." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "right", color: "#64748B", fontSize: 12, fontWeight: 700 }}>
                <th style={{ padding: "8px 6px" }}>نام</th>
                <th style={{ padding: "8px 6px" }}>کد کلاس</th>
                <th style={{ padding: "8px 6px" }}>تعداد آزمون شرکت‌کرده</th>
                <th style={{ padding: "8px 6px" }}></th>
                <th style={{ padding: "8px 6px" }}></th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((s) => (
                <React.Fragment key={s.fullname}>
                  <tr style={{ borderTop: "1px solid #F1F5F9", fontSize: 14, cursor: s.trend.length > 1 ? "pointer" : "default" }}>
                    <td style={{ padding: "12px 6px", fontWeight: 700, color: "#1E293B" }} onClick={() => s.trend.length > 1 && setExpanded((e) => e === s.fullname ? null : s.fullname)}>{s.fullname}</td>
                    <td style={{ padding: "12px 6px", color: "#475569" }} onClick={() => s.trend.length > 1 && setExpanded((e) => e === s.fullname ? null : s.fullname)}>{s.class_code || "—"}</td>
                    <td style={{ padding: "12px 6px", color: "#475569" }} onClick={() => s.trend.length > 1 && setExpanded((e) => e === s.fullname ? null : s.fullname)}>{s.examCount}</td>
                    <td style={{ padding: "12px 6px", color: "#2563EB", fontSize: 12 }} onClick={() => s.trend.length > 1 && setExpanded((e) => e === s.fullname ? null : s.fullname)}>
                      {s.trend.length > 1 && (expanded === s.fullname ? "بستن روند ▲" : "روند نمرات ▼")}
                    </td>
                    <td style={{ padding: "12px 6px" }}>
                      <Trash2
                        size={16}
                        style={{ cursor: "pointer", color: "#F87171", opacity: deletingKey === s.ids.join(",") ? 0.4 : 1 }}
                        onClick={() => removeStudentRecord(s.ids)}
                      />
                    </td>
                  </tr>
                  {expanded === s.fullname && (
                    <tr>
                      <td colSpan={5} style={{ padding: "6px 6px 18px" }}>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 110, background: "#F8FAFC", borderRadius: 10, padding: "14px 18px", overflowX: "auto" }}>
                          {s.trend.map((t) => (
                            <div key={t.examId} title={t.title} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 46 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#1E293B" }}>{t.pct}%</div>
                              <div style={{ width: 22, borderRadius: "4px 4px 0 0", background: t.pct >= 50 ? "#16A34A" : "#DC2626", height: `${Math.max(4, t.pct * 0.6)}px` }} />
                              <div style={{ fontSize: 10, color: "#94A3B8", maxWidth: 60, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
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
    </div>
  );
}

/* ---------------------------------------------------------
   MESSAGES — teacher broadcasts announcements to all students,
   one class, or a single student; shown in the student portal.
--------------------------------------------------------- */

function MessagesScreen({ teacher, classes, roster, messages, refresh }) {
  const [targetType, setTargetType] = useState("all"); // 'all' | 'class' | 'student'
  const [targetClassId, setTargetClassId] = useState("");
  const [targetStudentId, setTargetStudentId] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const myClasses = classes.filter((c) => c.teacher_id === teacher.username);
  const myRoster = roster.filter((r) => r.teacher_id === teacher.username);
  const myMessages = messages.filter((m) => m.teacher_id === teacher.username)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const send = async () => {
    if (!text.trim()) return;
    if (targetType === "class" && !targetClassId) return;
    if (targetType === "student" && !targetStudentId) return;
    setSending(true);
    const id = uid();
    await setJSON(`message:${id}`, {
      id, teacher_id: teacher.username,
      target_type: targetType,
      target_id: targetType === "class" ? targetClassId : targetType === "student" ? targetStudentId : null,
      text: text.trim(),
      created_at: new Date().toISOString(),
    });
    setSending(false);
    setText("");
    await refresh();
  };

  const removeMessage = async (id) => {
    setDeletingId(id);
    await deleteKey(`message:${id}`);
    setDeletingId(null);
    await refresh();
  };

  const describeTarget = (m) => {
    if (m.target_type === "all") return "همه‌ی دانش‌آموزان";
    if (m.target_type === "class") return `کلاس: ${classes.find((c) => c.id === m.target_id)?.name || "حذف‌شده"}`;
    return `دانش‌آموز: ${roster.find((r) => r.id === m.target_id)?.fullname || "حذف‌شده"}`;
  };

  const adminAnnouncements = messages.filter((m) => m.sender === "admin" && m.audience === "teachers")
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div style={{ flex: 1, padding: "30px 34px", overflowY: "auto" }}>
      <TopBar title="پیام‌ها" teacherName={teacher.fullname} />

      {adminAnnouncements.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1E293B", marginBottom: 10 }}>اعلانات مدیر مدرسه</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {adminAnnouncements.map((m) => (
              <div key={m.id} style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 13, color: "#4C1D95", whiteSpace: "pre-wrap", marginBottom: 4 }}>{m.text}</div>
                <div style={{ fontSize: 11, color: "#7C3AED" }}>{new Date(m.created_at).toLocaleString("fa-IR")}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>
        پیام‌هایی که اینجا می‌فرستی، در پرتال دانش‌آموزی (وقتی دانش‌آموز با کد خودش وارد می‌شود) نمایش داده می‌شوند.
      </div>
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 22, marginBottom: 20 }}>
        <Field label="گیرنده">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { key: "all", label: "همه‌ی دانش‌آموزان" },
              { key: "class", label: "یک کلاس خاص" },
              { key: "student", label: "یک دانش‌آموز خاص" },
            ].map((opt) => (
              <div key={opt.key} onClick={() => setTargetType(opt.key)} style={{
                padding: "8px 14px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700,
                background: targetType === opt.key ? "#2563EB" : "#F1F5F9", color: targetType === opt.key ? "#fff" : "#475569",
              }}>{opt.label}</div>
            ))}
          </div>
        </Field>
        {targetType === "class" && (
          <Field label="انتخاب کلاس">
            <select value={targetClassId} onChange={(e) => setTargetClassId(e.target.value)} style={inputStyle}>
              <option value="">— انتخاب کن —</option>
              {myClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        {targetType === "student" && (
          <Field label="انتخاب دانش‌آموز">
            <StudentPicker classes={myClasses} roster={myRoster} value={targetStudentId} onChange={setTargetStudentId} />
          </Field>
        )}
        <Field label="متن پیام">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} placeholder="مثلاً: فردا امتحان فصل ۵ برگزار می‌شود." />
        </Field>
        <Button onClick={send} disabled={sending}><Plus size={16} />{sending ? "در حال ارسال..." : "ارسال پیام"}</Button>
      </div>

      <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", marginBottom: 12 }}>پیام‌های ارسال‌شده</div>
      {myMessages.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6" }}>
          <EmptyState text="هنوز پیامی نفرستاده‌ای." />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {myMessages.map((m) => (
            <div key={m.id} style={{ background: "#fff", border: "1px solid #EEF1F6", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <div style={{ fontSize: 13, color: "#334155", marginBottom: 6, whiteSpace: "pre-wrap" }}>{m.text}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Badge tone="blue">{describeTarget(m)}</Badge>
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>{new Date(m.created_at).toLocaleString("fa-IR")}</span>
                </div>
              </div>
              <Trash2 size={16} style={{ cursor: "pointer", color: "#F87171", flexShrink: 0, opacity: deletingId === m.id ? 0.4 : 1 }} onClick={() => removeMessage(m.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   STUDENT PORTAL — a student enters their roster code to see
   their own exam results and any messages from the teacher.
   No teacher login required; reachable from the login screen.
--------------------------------------------------------- */

function StudentPortalScreen() {
  const [codeInput, setCodeInput] = useState("");
  const [activeRoster, setActiveRoster] = useState(null);
  const [className, setClassName] = useState("");
  const [results, setResults] = useState([]);
  const [myMessages, setMyMessages] = useState([]);
  const [teacherName, setTeacherName] = useState("معلم");
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);

  const lookup = async () => {
    const code = codeInput.trim();
    if (!code) return;
    setLoading(true);
    setNotFound(false);
    try {
      const r = await fetch(`/api/student-lookup?code=${encodeURIComponent(code)}`);
      const data = await r.json();
      if (r.ok && data.found) {
        setActiveRoster(data.roster);
        setClassName(data.className);
        setResults(data.results || []);
        setMyMessages(data.messages || []);
        setTeacherName(data.teacherName || "معلم");
      } else {
        setActiveRoster(null);
        setNotFound(true);
      }
    } catch {
      setActiveRoster(null);
      setNotFound(true);
    }
    setLoading(false);
  };

  if (!activeRoster) {
    return (
      <div style={{ flex: 1.15, padding: "44px 40px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", marginBottom: 6 }}>پرتال دانش‌آموزی</div>
        <div style={{ fontSize: 13, color: "#64748B", marginBottom: 26 }}>کدی که معلمت به تو داده را وارد کن تا نمرات و پیام‌های خودت را ببینی.</div>
        <Field label="کد دانش‌آموزی">
          <TextInput
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            placeholder="کد خود را وارد کن"
            style={{ fontSize: 18, letterSpacing: 3, textAlign: "center", fontWeight: 700 }}
            maxLength={6}
          />
        </Field>
        {notFound && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 14 }}>کد پیدا نشد. از معلم خود بپرس.</div>}
        <Button type="button" onClick={lookup} disabled={loading} style={{ width: "100%", justifyContent: "center", padding: "12px 0", fontSize: 15 }}>{loading ? "در حال جستجو..." : "ورود"}</Button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1.15, padding: "44px 40px", maxHeight: "80vh", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1E293B" }}>{activeRoster.fullname}</div>
          <div style={{ fontSize: 13, color: "#64748B" }}>کلاس: {className}</div>
        </div>
        <span onClick={() => { setActiveRoster(null); setCodeInput(""); }} style={{ fontSize: 12, color: "#2563EB", fontWeight: 700, cursor: "pointer" }}>خروج</span>
      </div>

      <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", marginBottom: 10 }}>نمرات آزمون‌ها</div>
      {results.length === 0 ? (
        <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 24 }}>هنوز در آزمونی شرکت نکرده‌ای.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {results.map((r) => (
            <div key={r.examId} style={{ border: "1px solid #EEF1F6", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{r.title}</div>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>{r.date ? new Date(r.date).toLocaleDateString("fa-IR") : "—"}</div>
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: r.pct >= 50 ? "#16A34A" : "#DC2626" }}>{r.pct}%</div>
                {r.pendingCount > 0 && <div style={{ fontSize: 10, color: "#D97706" }}>در انتظار تصحیح</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", marginBottom: 10 }}>پیام‌ها</div>
      {myMessages.length === 0 ? (
        <div style={{ fontSize: 13, color: "#94A3B8" }}>پیامی برای تو ثبت نشده.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {myMessages.map((m) => (
            <div key={m.id} style={{ background: "#F8FAFC", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: m.sender === "admin" ? "#7C3AED" : "#2563EB", marginBottom: 4 }}>
                {m.sender === "admin" ? "🏫 مدیر مدرسه" : teacherName}
              </div>
              <div style={{ fontSize: 13, color: "#334155", whiteSpace: "pre-wrap", marginBottom: 4 }}>{m.text}</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>{new Date(m.created_at).toLocaleString("fa-IR")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsScreen({ teacher, onUpdate, refresh, exams, students }) {
  const [fullname, setFullname] = useState(teacher.fullname);
  const [email, setEmail] = useState(teacher.email || "");
  const [saved, setSaved] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const save = async () => {
    const updated = { ...teacher, fullname, email };
    await setJSON(`teacher:${teacher.username}`, updated);
    onUpdate(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const [finishMessages, setFinishMessages] = useState(
    (teacher.finish_messages && teacher.finish_messages.length > 0) ? teacher.finish_messages : DEFAULT_FINISH_MESSAGES
  );
  const [msgSaved, setMsgSaved] = useState(false);
  const updateMessageAt = (i, val) => {
    setFinishMessages((list) => list.map((m, idx) => (idx === i ? val : m)));
  };
  const addMessage = () => setFinishMessages((list) => [...list, ""]);
  const removeMessage = (i) => setFinishMessages((list) => list.filter((_, idx) => idx !== i));
  const saveMessages = async () => {
    const cleaned = finishMessages.map((m) => m.trim()).filter(Boolean);
    const list = cleaned.length > 0 ? cleaned : DEFAULT_FINISH_MESSAGES;
    const updated = { ...teacher, finish_messages: list };
    await setJSON(`teacher:${teacher.username}`, updated);
    onUpdate(updated);
    setFinishMessages(list);
    setMsgSaved(true);
    setTimeout(() => setMsgSaved(false), 2000);
  };

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSaved, setPwSaved] = useState(false);
  const changePassword = async () => {
    setPwError(""); setPwSaved(false);
    if (!curPw || !newPw || !newPw2) { setPwError("همه فیلدها را پر کنید."); return; }
    if (!(await verifyPassword(teacher.password, curPw))) { setPwError("رمز عبور فعلی اشتباه است."); return; }
    if (newPw.length < 8) { setPwError("رمز عبور جدید باید حداقل ۸ کاراکتر باشد."); return; }
    if (newPw !== newPw2) { setPwError("رمز عبور جدید و تکرار آن یکسان نیستند."); return; }
    const updated = { ...teacher, password: await hashPassword(newPw) };
    await setJSON(`teacher:${teacher.username}`, updated);
    saveSession(updated.username, updated.password, getAuthToken());
    onUpdate(updated);
    setCurPw(""); setNewPw(""); setNewPw2("");
    setPwSaved(true);
    setTimeout(() => setPwSaved(false), 2500);
  };

  const exportBackup = async () => {
    // Scoped to this teacher's own data only — previously this pulled every
    // key in the whole KV namespace (all teachers' data, password hashes
    // included), which was fine when the app was single-teacher but is a
    // data leak now that multiple teachers share one school.
    const data = {};
    data[`teacher:${teacher.username}`] = teacher;
    const allExams = await loadAll("exam:");
    const myExams = allExams.filter((ex) => ex.teacher_id === teacher.username);
    const myExamIds = new Set(myExams.map((ex) => ex.id));
    myExams.forEach((ex) => { data[`exam:${ex.id}`] = ex; });

    const allQuestions = await loadAll("question:");
    allQuestions.filter((q) => myExamIds.has(q.exam_id)).forEach((q) => { data[`question:${q.id}`] = q; });

    const allStudents = await loadAll("student:");
    const myStudents = allStudents.filter((s) => s.teacher_id === teacher.username);
    myStudents.forEach((s) => { data[`student:${s.id}`] = s; });

    for (const s of myStudents) {
      const ans = await getJSON(`answers:${s.id}`);
      if (ans) data[`answers:${s.id}`] = ans;
    }

    downloadTextFile("edu-exam-backup.json", JSON.stringify(data, null, 2), "application/json");
  };

  const importBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg("در حال بازیابی...");
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      // Only restore keys that belong to this teacher — a teacher's backup
      // file should never be able to overwrite another teacher's or the
      // admin's data, even if the uploaded file contains such keys.
      const myExamIds = new Set(exams.filter((ex) => ex.teacher_id === teacher.username).map((ex) => ex.id));
      const myStudentIds = new Set(students.filter((s) => s.teacher_id === teacher.username).map((s) => s.id));
      let restored = 0;
      for (const k of Object.keys(data)) {
        const v = data[k];
        const isOwnTeacher = k === `teacher:${teacher.username}`;
        const isOwnExam = k.startsWith("exam:") && (v?.teacher_id === teacher.username || myExamIds.has(k.slice(5)));
        const isOwnQuestion = k.startsWith("question:") && v?.exam_id && (myExamIds.has(v.exam_id) || (data[`exam:${v.exam_id}`]?.teacher_id === teacher.username));
        const isOwnStudent = k.startsWith("student:") && (v?.teacher_id === teacher.username || myStudentIds.has(k.slice(8)));
        const isOwnAnswers = k.startsWith("answers:") && (myStudentIds.has(k.slice(8)) || (data[`student:${k.slice(8)}`]?.teacher_id === teacher.username));
        if (isOwnTeacher || isOwnExam || isOwnQuestion || isOwnStudent || isOwnAnswers) {
          await setJSON(k, v);
          restored++;
        }
      }
      await refresh();
      setImportMsg(restored > 0 ? `${restored} مورد با موفقیت بازیابی شد.` : "این فایل شامل داده‌ی مربوط به حساب تو نبود.");
    } catch {
      setImportMsg("فایل نامعتبر است.");
    }
    e.target.value = "";
  };

  return (
    <div style={{ flex: 1, padding: "30px 34px" }}>
      <TopBar title="تنظیمات" teacherName={teacher.fullname} />
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 24, maxWidth: 420, marginBottom: 20 }}>
        <Field label="نام کاربری">
          <TextInput value={teacher.username} disabled style={{ background: "#F8FAFC", color: "#94A3B8" }} />
        </Field>
        <Field label="نام و نام‌خانوادگی">
          <TextInput value={fullname} onChange={(e) => setFullname(e.target.value)} />
        </Field>
        <Field label="ایمیل (برای بازیابی رمز عبور)">
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ایمیل" />
        </Field>
        <Button onClick={save}><Check size={16} />ذخیره تغییرات</Button>
        {saved && <div style={{ color: "#16A34A", fontSize: 13, marginTop: 10 }}>ذخیره شد.</div>}
      </div>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 24, maxWidth: 420, marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", marginBottom: 16 }}>تغییر رمز عبور</div>
        <Field label="رمز عبور فعلی">
          <TextInput type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="رمز عبور فعلی" />
        </Field>
        <Field label="رمز عبور جدید">
          <TextInput type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="رمز عبور جدید" />
        </Field>
        <Field label="تکرار رمز عبور جدید">
          <TextInput type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} placeholder="تکرار رمز عبور جدید" />
        </Field>
        {pwError && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 10 }}>{pwError}</div>}
        <Button onClick={changePassword}><Check size={16} />تغییر رمز عبور</Button>
        {pwSaved && <div style={{ color: "#16A34A", fontSize: 13, marginTop: 10 }}>رمز عبور با موفقیت تغییر کرد.</div>}
      </div>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 24, maxWidth: 420, marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", marginBottom: 6 }}>پیام‌های پایان آزمون</div>
        <div style={{ fontSize: 12, color: "#64748B", marginBottom: 16 }}>
          بعد از ثبت آزمون توسط دانش‌آموز، یکی از این پیام‌ها به‌صورت تصادفی نمایش داده می‌شود.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {finishMessages.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <TextInput value={m} onChange={(e) => updateMessageAt(i, e.target.value)} placeholder="مثلاً: موفق باشی!" style={{ flex: 1 }} />
              <div onClick={() => removeMessage(i)} style={{ cursor: "pointer", color: "#DC2626", fontSize: 20, padding: "0 6px", lineHeight: 1 }}>×</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="ghost" onClick={addMessage}><Plus size={15} />افزودن پیام</Button>
          <Button onClick={saveMessages}><Check size={16} />ذخیره پیام‌ها</Button>
        </div>
        {msgSaved && <div style={{ color: "#16A34A", fontSize: 13, marginTop: 10 }}>ذخیره شد.</div>}
      </div>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 24, maxWidth: 420 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", marginBottom: 6 }}>پشتیبان‌گیری از داده‌ها</div>
        <div style={{ fontSize: 12, color: "#64748B", marginBottom: 16 }}>
          یک نسخه پشتیبان از آزمون‌ها، سوالات و نتایج خودت (نه کل مدرسه) می‌گیره.
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="ghost" onClick={exportBackup}><Download size={15} />دانلود فایل پشتیبان</Button>
          <label style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10,
            fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#fff", color: "#334155", border: "1.5px solid #E2E8F0",
          }}>
            بازیابی از فایل
            <input type="file" accept="application/json" onChange={importBackup} style={{ display: "none" }} />
          </label>
        </div>
        {importMsg && <div style={{ fontSize: 13, color: "#2563EB", marginTop: 10 }}>{importMsg}</div>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   ROOT APP
--------------------------------------------------------- */
