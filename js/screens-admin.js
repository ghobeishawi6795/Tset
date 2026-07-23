/* ---------------------------------------------------------
   ADMIN DASHBOARD (school-wide, multi-teacher)
   © ghobeishawi - All rights reserved.
--------------------------------------------------------- */
function CreateTeacherForm({ onCreated, existingUsernames }) {
  const [fullname, setFullname] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    if (!fullname || !username || !password || !email) { setError("همه فیلدها را پر کنید."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("ایمیل معتبر نیست."); return; }
    if (password.length < 8) { setError("رمز عبور باید حداقل ۸ کاراکتر باشد."); return; }
    if (existingUsernames.includes(username.trim())) { setError("این نام کاربری قبلاً استفاده شده است."); return; }
    setLoading(true);
    const existing = await getJSON(`teacher:${username}`);
    if (existing) {
      setLoading(false);
      setError("این نام کاربری قبلاً ثبت شده است.");
      return;
    }
    const teacher = {
      username: username.trim(),
      password: await hashPassword(password),
      fullname: fullname.trim(),
      email: email.trim(),
      role: "teacher",
      created_at: new Date().toISOString(),
    };
    await setJSON(`teacher:${teacher.username}`, teacher);
    setLoading(false);
    onCreated(teacher);
  };
  const handleKeyDown = (e) => { if (e.key === "Enter") submit(); };

  return (
    <div>
      <Field label="نام و نام‌خانوادگی معلم">
        <TextInput value={fullname} onChange={(e) => setFullname(e.target.value)} onKeyDown={handleKeyDown} placeholder="مثلاً: زهرا احمدی" />
      </Field>
      <Field label="نام کاربری">
        <TextInput value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={handleKeyDown} placeholder="یک نام کاربری یکتا" />
      </Field>
      <Field label="رمز عبور اولیه">
        <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKeyDown} placeholder="رمز عبور" />
      </Field>
      <Field label="ایمیل">
        <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={handleKeyDown} placeholder="برای بازیابی رمز عبور معلم استفاده می‌شود" />
      </Field>
      {error && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 14 }}>{error}</div>}
      <Button type="button" onClick={submit} style={{ width: "100%", justifyContent: "center", padding: "12px 0", fontSize: 15 }} disabled={loading}>
        {loading ? "در حال ساخت..." : "ساخت حساب معلم"}
      </Button>
    </div>
  );
}

function EditTeacherForm({ teacher, onSaved }) {
  const [fullname, setFullname] = useState(teacher.fullname);
  const [email, setEmail] = useState(teacher.email || "");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    setError(""); setSaved(false);
    if (!fullname || !email) { setError("نام و ایمیل نباید خالی باشند."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("ایمیل معتبر نیست."); return; }
    if (newPassword && newPassword.length < 8) { setError("رمز عبور جدید باید حداقل ۸ کاراکتر باشد."); return; }
    setLoading(true);
    const updated = { ...teacher, fullname: fullname.trim(), email: email.trim() };
    if (newPassword) updated.password = await hashPassword(newPassword);
    await setJSON(`teacher:${teacher.username}`, updated);
    setLoading(false);
    setNewPassword("");
    setSaved(true);
    onSaved(updated);
  };
  const handleKeyDown = (e) => { if (e.key === "Enter") submit(); };

  return (
    <div>
      <Field label="نام کاربری">
        <TextInput value={teacher.username} disabled style={{ background: "#F8FAFC", color: "#94A3B8" }} />
      </Field>
      <Field label="نام و نام‌خانوادگی">
        <TextInput value={fullname} onChange={(e) => setFullname(e.target.value)} onKeyDown={handleKeyDown} />
      </Field>
      <Field label="ایمیل">
        <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={handleKeyDown} />
      </Field>
      <Field label="رمز عبور جدید (اختیاری)">
        <TextInput type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} onKeyDown={handleKeyDown} placeholder="برای تغییر ندادن، خالی بگذارید" />
      </Field>
      {error && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 14 }}>{error}</div>}
      {saved && <div style={{ color: "#16A34A", fontSize: 13, marginBottom: 14 }}>تغییرات ذخیره شد.</div>}
      <Button type="button" onClick={submit} style={{ width: "100%", justifyContent: "center", padding: "12px 0", fontSize: 15 }} disabled={loading}>
        {loading ? "در حال ذخیره..." : "ذخیره تغییرات"}
      </Button>
    </div>
  );
}

function AdminProfileModal({ teacher, onSaved, onClose }) {
  const [fullname, setFullname] = useState(teacher.fullname);
  const [email, setEmail] = useState(teacher.email || "");
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [error, setError] = useState("");
  const [pwError, setPwError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);

  const saveProfile = async () => {
    setError(""); setSaved(false);
    if (!fullname || !email) { setError("نام و ایمیل نباید خالی باشند."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("ایمیل معتبر نیست."); return; }
    setLoading(true);
    const updated = { ...teacher, fullname: fullname.trim(), email: email.trim() };
    await setJSON(`teacher:${teacher.username}`, updated);
    setLoading(false);
    setSaved(true);
    onSaved(updated);
  };

  const changePassword = async () => {
    setPwError(""); setPwSaved(false);
    if (!curPw || !newPw || !newPw2) { setPwError("همه فیلدها را پر کنید."); return; }
    if (!(await verifyPassword(teacher.password, curPw))) { setPwError("رمز عبور فعلی اشتباه است."); return; }
    if (newPw.length < 8) { setPwError("رمز عبور جدید باید حداقل ۸ کاراکتر باشد."); return; }
    if (newPw !== newPw2) { setPwError("رمز عبور جدید و تکرار آن یکسان نیستند."); return; }
    setPwLoading(true);
    const updated = { ...teacher, password: await hashPassword(newPw) };
    await setJSON(`teacher:${teacher.username}`, updated);
    saveSession(updated.username, updated.password, getAuthToken());
    setPwLoading(false);
    setCurPw(""); setNewPw(""); setNewPw2("");
    setPwSaved(true);
    onSaved(updated);
  };

  return (
    <Modal title="تنظیمات حساب مدیر" onClose={onClose}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", marginBottom: 12 }}>اطلاعات حساب</div>
      <Field label="نام کاربری">
        <TextInput value={teacher.username} disabled style={{ background: "#F8FAFC", color: "#94A3B8" }} />
      </Field>
      <Field label="نام و نام‌خانوادگی">
        <TextInput value={fullname} onChange={(e) => setFullname(e.target.value)} />
      </Field>
      <Field label="ایمیل">
        <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      {error && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 14 }}>{error}</div>}
      {saved && <div style={{ color: "#16A34A", fontSize: 13, marginBottom: 14 }}>ذخیره شد.</div>}
      <Button type="button" onClick={saveProfile} style={{ width: "100%", justifyContent: "center", padding: "12px 0", fontSize: 15, marginBottom: 22 }} disabled={loading}>
        {loading ? "در حال ذخیره..." : "ذخیره اطلاعات"}
      </Button>

      <div style={{ borderTop: "1px solid #EEF1F6", paddingTop: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", marginBottom: 12 }}>تغییر رمز عبور</div>
        <Field label="رمز عبور فعلی">
          <TextInput type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} />
        </Field>
        <Field label="رمز عبور جدید">
          <TextInput type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        </Field>
        <Field label="تکرار رمز عبور جدید">
          <TextInput type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} />
        </Field>
        {pwError && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 14 }}>{pwError}</div>}
        {pwSaved && <div style={{ color: "#16A34A", fontSize: 13, marginBottom: 14 }}>رمز عبور تغییر کرد.</div>}
        <Button type="button" onClick={changePassword} style={{ width: "100%", justifyContent: "center", padding: "12px 0", fontSize: 15 }} disabled={pwLoading}>
          {pwLoading ? "در حال ذخیره..." : "تغییر رمز عبور"}
        </Button>
      </div>
    </Modal>
  );
}

function AdminRosterModal({ cls, roster, onClose, refresh }) {
  const members = roster.filter((r) => r.class_id === cls.id);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const startEditMember = (m) => { setEditingMemberId(m.id); setEditName(m.fullname); };
  const cancelEditMember = () => { setEditingMemberId(null); setEditName(""); };
  const saveEditMember = async (m) => {
    if (!editName.trim() || editName.trim() === m.fullname) { cancelEditMember(); return; }
    setSavingEdit(true);
    await setJSON(`roster:${m.id}`, { ...m, fullname: editName.trim() });
    setSavingEdit(false);
    cancelEditMember();
    await refresh();
  };

  const addStudent = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const allCodes = roster.map((r) => r.code);
    const id = uid();
    const code = generateCode(allCodes);
    const record = {
      id, class_id: cls.id, teacher_id: cls.teacher_id || null,
      fullname: name.trim(), code, created_at: new Date().toISOString(),
    };
    await setJSON(`roster:${id}`, record);
    setSaving(false);
    setName("");
    await refresh();
  };

  const addBulkStudents = async () => {
    const names = bulkText.split(/[\n,]/).map((n) => n.trim()).filter(Boolean);
    if (names.length === 0) { setBulkMsg("نامی برای افزودن پیدا نشد."); return; }
    setBulkSaving(true);
    const existingNames = new Set(members.map((m) => m.fullname.trim()));
    const usedCodes = roster.map((r) => r.code);
    let added = 0, skipped = 0;
    for (const n of names) {
      if (existingNames.has(n)) { skipped++; continue; }
      existingNames.add(n);
      const id = uid();
      const code = generateCode(usedCodes);
      usedCodes.push(code);
      const record = {
        id, class_id: cls.id, teacher_id: cls.teacher_id || null,
        fullname: n, code, created_at: new Date().toISOString(),
      };
      await setJSON(`roster:${id}`, record);
      added++;
    }
    setBulkSaving(false);
    setBulkMsg(`${added} دانش‌آموز اضافه شد${skipped > 0 ? ` — ${skipped} مورد تکراری نادیده گرفته شد.` : "."}`);
    if (added > 0) { setBulkText(""); await refresh(); }
  };

  // آپلود فایل اکسل: فقط ستون اول شیت اول رو می‌خونه (اسم دانش‌آموز)،
  // ردیف اول رو اگه شبیه هدر بود (مثلاً «نام») نادیده می‌گیره، و بقیه رو
  // توی همون textarea گروهی می‌ریزه تا معلم قبل از ثبت نهایی مرورش کنه.
  const [excelMsg, setExcelMsg] = useState("");
  const handleExcelFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setExcelMsg("در حال خواندن فایل...");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const grid = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      let names = grid.map((row) => String(row[0] ?? "").trim()).filter(Boolean);
      if (names.length && /^(نام|name|fullname|نام دانش.آموز)$/i.test(names[0])) names = names.slice(1);
      if (names.length === 0) { setExcelMsg("هیچ نامی توی فایل پیدا نشد."); return; }
      setBulkText((prev) => (prev.trim() ? prev.trim() + "\n" + names.join("\n") : names.join("\n")));
      setExcelMsg(`${names.length} نام از فایل خونده شد — قبل از «افزودن همه» مرورشون کن.`);
    } catch (err) {
      setExcelMsg("خواندن فایل اکسل با خطا مواجه شد. مطمئن شو فایل .xlsx یا .csv سالم است.");
    }
  };

  const regenerateCodeFor = async (member) => {
    const allCodes = roster.filter((r) => r.id !== member.id).map((r) => r.code);
    const code = generateCode(allCodes);
    await setJSON(`roster:${member.id}`, { ...member, code });
    await refresh();
  };

  const removeStudent = async (member) => {
    if (!window.confirm(`«${member.fullname}» از این کلاس حذف شود؟`)) return;
    await deleteKey(`roster:${member.id}`);
    await refresh();
  };

  return (
    <Modal title={`دانش‌آموزان — ${cls.name}`} onClose={onClose}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#1E293B" }}>افزودن دانش‌آموز</div>
        <span onClick={() => setShowBulk((s) => !s)} style={{ fontSize: 12, color: "#2563EB", fontWeight: 700, cursor: "pointer" }}>
          {showBulk ? "افزودن تکی" : "افزودن گروهی"}
        </span>
      </div>
      {showBulk ? (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: "#64748B", marginBottom: 10, lineHeight: 1.8 }}>
            اسم هر دانش‌آموز را در یک خط جدا بنویسید (یا با ویرگول جدا کنید)، یا از فایل اکسل بارگذاری کنید.
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#2563EB", fontWeight: 700, cursor: "pointer", marginBottom: 10 }}>
            <Upload size={14} />بارگذاری نام‌ها از فایل اکسل (.xlsx / .csv)
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelFile} style={{ display: "none" }} />
          </label>
          {excelMsg && <div style={{ fontSize: 12, color: "#64748B", marginBottom: 10 }}>{excelMsg}</div>}
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={6}
            placeholder={"علی رضایی\nمریم احمدی\n..."}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", marginBottom: 10 }} />
          {bulkMsg && <div style={{ fontSize: 12, color: "#2563EB", marginBottom: 10 }}>{bulkMsg}</div>}
          <Button type="button" onClick={addBulkStudents} disabled={bulkSaving} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} />{bulkSaving ? "در حال افزودن..." : "افزودن همه"}
          </Button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="نام دانش‌آموز" onKeyDown={(e) => e.key === "Enter" && addStudent()} />
          <Button type="button" onClick={addStudent} disabled={saving}><Plus size={16} />{saving ? "..." : "افزودن"}</Button>
        </div>
      )}

      <div style={{ borderTop: "1px solid #EEF1F6", paddingTop: 14, maxHeight: 320, overflowY: "auto" }}>
        {members.length === 0 ? (
          <div style={{ fontSize: 13, color: "#94A3B8", textAlign: "center", padding: "16px 0" }}>هنوز دانش‌آموزی اضافه نشده است.</div>
        ) : (
          members.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px", borderBottom: "1px solid #F5F7FA", gap: 8 }}>
              {editingMemberId === m.id ? (
                <div style={{ display: "flex", gap: 6, flex: 1 }}>
                  <TextInput
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveEditMember(m); if (e.key === "Escape") cancelEditMember(); }}
                    style={{ fontSize: 13, padding: "7px 10px" }}
                  />
                  <Button type="button" style={{ fontSize: 12, padding: "7px 10px" }} onClick={() => saveEditMember(m)} disabled={savingEdit}>ذخیره</Button>
                  <Button type="button" variant="ghost" style={{ fontSize: 12, padding: "7px 10px" }} onClick={cancelEditMember}>انصراف</Button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E293B" }}>{m.fullname}</div>
                  <span onClick={() => startEditMember(m)} style={{ display: "flex", cursor: "pointer", color: "#94A3B8", padding: 3 }} title="ویرایش نام">
                    <Edit2 size={13} />
                  </span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 800, color: "#2563EB", letterSpacing: 1 }}>{m.code}</span>
                <span onClick={() => regenerateCodeFor(m)} style={{ fontSize: 11.5, color: "#64748B", cursor: "pointer" }}>کد جدید</span>
                <div onClick={() => removeStudent(m)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, background: "#FEF2F2", cursor: "pointer" }}>
                  <Trash2 size={14} color="#DC2626" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

function CreateClassForm({ onCreate }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onCreate(name);
    setSaving(false);
    setName("");
  };
  return (
    <div>
      <Field label="نام کلاس">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="مثلاً: هفتم الف" />
      </Field>
      <Button type="button" onClick={submit} style={{ width: "100%", justifyContent: "center", padding: "12px 0", fontSize: 15 }} disabled={saving}>
        {saving ? "در حال ساخت..." : "ساخت کلاس"}
      </Button>
    </div>
  );
}

function AdminSidebar({ active, onNavigate, onSettings, onHelp, onLogout, adminName }) {
  const items = [
    { key: "dashboard", label: "داشبورد", icon: LayoutDashboard },
    { key: "teachers", label: "معلمان", icon: Users },
    { key: "classes", label: "کلاس‌بندی", icon: Library },
    { key: "exams", label: "آزمون‌ها", icon: FileText },
    { key: "results", label: "نتایج و گزارش‌ها", icon: BarChart3 },
    { key: "backup", label: "پشتیبان‌گیری و بازیابی", icon: Download },
    { key: "students", label: "دانش‌آموزان", icon: GraduationCap },
    { key: "messages", label: "اعلانات و پیام‌ها", icon: MessageSquare },
    { key: "schedule", label: "برنامه امتحانات", icon: Clock },
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
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>پنل مدیریت</span>
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
                fontSize: 14, fontWeight: 600,
              }}
            >
              <IconCmp size={17} />
              {it.label}
            </div>
          );
        })}
        <div
          onClick={onSettings}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, cursor: "pointer", marginBottom: 4, color: "#AAB8D1", fontSize: 14, fontWeight: 600 }}
        >
          <Settings size={17} />
          تنظیمات حساب
        </div>
        <div
          onClick={onHelp}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, cursor: "pointer", marginBottom: 4, color: "#AAB8D1", fontSize: 14, fontWeight: 600 }}
        >
          <HelpCircle size={17} />
          راهنما
        </div>
      </div>
      <div style={{ padding: 12, borderTop: "1px solid #22385F" }}>
        <div style={{ fontSize: 12, color: "#7C8CAE", padding: "6px 14px 12px" }}>{adminName}</div>
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

function AdminDashboardScreen({ teacher, teachers, exams, classes, roster, students, questions, answers, messages, cheatAlerts, onLogout, onUpdateSelf, refresh, addLocalClass, removeLocalClass, updateLocalClass }) {
  const [view, setView] = useState("dashboard");
  const [showCreate, setShowCreate] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [showOwnSettings, setShowOwnSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [classSearch, setClassSearch] = useState("");
  const [managingRosterClass, setManagingRosterClass] = useState(null);
  const [editingClassId, setEditingClassId] = useState(null);
  const [editClassName, setEditClassName] = useState("");
  const [savingClassName, setSavingClassName] = useState(false);
  const [examSearch, setExamSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [editStudentName, setEditStudentName] = useState("");
  const [savingStudentName, setSavingStudentName] = useState(false);
  const [announceAudience, setAnnounceAudience] = useState("teachers");
  const [announceClassId, setAnnounceClassId] = useState("");
  const [announceStudentId, setAnnounceStudentId] = useState("");
  const [announceText, setAnnounceText] = useState("");
  const [announceSending, setAnnounceSending] = useState(false);
  const [resultsTeacherFilter, setResultsTeacherFilter] = useState("");

  const statsFor = (username) => ({
    classCount: classes.filter((c) => c.teacher_id === username).length,
    examCount: exams.filter((e) => e.teacher_id === username).length,
    studentCount: students.filter((s) => s.teacher_id === username).length,
  });

  const visibleTeachers = teachers
    .filter((t) => !search || t.fullname.includes(search) || t.username.includes(search))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const removeTeacher = async (t) => {
    const relatedExamIds = exams.filter((e) => e.teacher_id === t.username).map((e) => e.id);
    const counts = {
      classes: classes.filter((c) => c.teacher_id === t.username).length,
      exams: relatedExamIds.length,
      students: students.filter((s) => s.teacher_id === t.username).length,
    };
    if (!window.confirm(`حساب معلم «${t.fullname}» حذف شود؟\nهمراه آن ${counts.classes} کلاس، ${counts.exams} آزمون و ${counts.students} دانش‌آموز این معلم نیز برای همیشه حذف می‌شوند. این کار قابل بازگشت نیست.`)) return;

    const deletions = [deleteKey(`teacher:${t.username}`)];
    classes.filter((c) => c.teacher_id === t.username).forEach((c) => deletions.push(deleteKey(`class:${c.id}`)));
    roster.filter((r) => r.teacher_id === t.username).forEach((r) => deletions.push(deleteKey(`roster:${r.id}`)));
    students.filter((s) => s.teacher_id === t.username).forEach((s) => deletions.push(deleteKey(`student:${s.id}`)));
    (messages || []).filter((m) => m.teacher_id === t.username).forEach((m) => deletions.push(deleteKey(`message:${m.id}`)));
    (cheatAlerts || []).filter((a) => a.teacher_id === t.username).forEach((a) => deletions.push(deleteKey(`cheatalert:${a.id}`)));
    (questions || []).filter((q) => relatedExamIds.includes(q.exam_id) || q.owner_id === t.username).forEach((q) => deletions.push(deleteKey(`question:${q.id}`)));
    const relatedAnswerStudentIds = new Set((answers || []).filter((a) => relatedExamIds.includes(a.exam_id)).map((a) => a.student_id));
    relatedAnswerStudentIds.forEach((sid) => deletions.push(deleteKey(`answers:${sid}`)));
    exams.filter((e) => e.teacher_id === t.username).forEach((e) => deletions.push(deleteKey(`exam:${e.id}`)));

    await Promise.all(deletions);
    await refresh();
  };

  const schoolClasses = classes.slice().sort((a, b) => a.name.localeCompare(b.name, "fa"));

  const assignClass = async (cls, newTeacherUsername) => {
    const updatedClass = { ...cls, teacher_id: newTeacherUsername || null };
    const members = roster.filter((r) => r.class_id === cls.id);
    updateLocalClass && updateLocalClass(updatedClass);
    await Promise.all([
      setJSON(`class:${cls.id}`, updatedClass),
      ...members.map((r) => setJSON(`roster:${r.id}`, { ...r, teacher_id: newTeacherUsername || null })),
    ]);
    await refresh();
  };

  const createClass = async (name) => {
    const id = uid();
    const record = { id, name: name.trim(), teacher_id: null, created_at: new Date().toISOString() };
    // مثل افزودن دانش‌آموز، لیست /api/list ممکنه چند ثانیه طول بکشه تا کلید
    // تازه‌نوشته‌شده رو نشون بده — بدون این خط، کلاس جدید انگار «اضافه نشده»
    // به‌نظر می‌رسید و کاربر دوباره می‌زد، که باعث دوتا شدنش می‌شد.
    addLocalClass && addLocalClass(record);
    await setJSON(`class:${id}`, record);
    await refresh();
  };

  const removeClass = async (cls) => {
    const members = roster.filter((r) => r.class_id === cls.id);
    if (!window.confirm(`کلاس «${cls.name}» حذف شود؟${members.length ? ` ${members.length} دانش‌آموز این کلاس نیز حذف می‌شوند.` : ""} این کار قابل بازگشت نیست.`)) return;
    removeLocalClass && removeLocalClass(cls.id);
    const deletions = [deleteKey(`class:${cls.id}`), ...members.map((r) => deleteKey(`roster:${r.id}`))];
    await Promise.all(deletions);
    await refresh();
  };

  const startEditClass = (c) => { setEditingClassId(c.id); setEditClassName(c.name); };
  const cancelEditClass = () => { setEditingClassId(null); setEditClassName(""); };
  const saveEditClass = async (c) => {
    if (!editClassName.trim() || editClassName.trim() === c.name) { cancelEditClass(); return; }
    setSavingClassName(true);
    const updated = { ...c, name: editClassName.trim() };
    updateLocalClass && updateLocalClass(updated);
    await setJSON(`class:${c.id}`, updated);
    setSavingClassName(false);
    cancelEditClass();
    await refresh();
  };

  const viewTitles = { dashboard: "داشبورد مدیریت", teachers: "معلمان مدرسه", classes: "کلاس‌بندی مدرسه", exams: "آزمون‌های مدرسه", results: "نتایج و گزارش‌ها", backup: "پشتیبان‌گیری و بازیابی", students: "دانش‌آموزان مدرسه", messages: "اعلانات و پیام‌ها", schedule: "برنامه امتحانات" };

  const adminAnnouncements = (messages || []).filter((m) => m.sender === "admin")
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const sendAnnouncement = async () => {
    if (!announceText.trim()) return;
    if (announceAudience === "class" && !announceClassId) return;
    if (announceAudience === "student" && !announceStudentId) return;
    setAnnounceSending(true);
    const id = uid();
    const target_type = announceAudience === "class" ? "class" : announceAudience === "student" ? "student" : null;
    const target_id = announceAudience === "class" ? announceClassId : announceAudience === "student" ? announceStudentId : null;
    await setJSON(`message:${id}`, {
      id, sender: "admin", sender_name: teacher.fullname,
      audience: announceAudience, target_type, target_id,
      text: announceText.trim(),
      created_at: new Date().toISOString(),
    });
    setAnnounceSending(false);
    setAnnounceText("");
    setAnnounceClassId("");
    setAnnounceStudentId("");
    await refresh();
  };

  const removeAnnouncement = async (id) => {
    await deleteKey(`message:${id}`);
    await refresh();
  };

  const describeAudience = (m) => {
    if (m.audience === "teachers") return "همه معلمان";
    if (m.audience === "students") return "همه دانش‌آموزان";
    if (m.audience === "class") { const c = classById[m.target_id]; return c ? `کلاس: ${c.name}` : "کلاس حذف‌شده"; }
    if (m.audience === "student") { const s = roster.find((r) => r.id === m.target_id); return s ? `دانش‌آموز: ${s.fullname}` : "دانش‌آموز حذف‌شده"; }
    return "—";
  };

  const now = new Date();
  const examStatus = (exam) => {
    const opens = exam.opens_at ? new Date(exam.opens_at) : null;
    const closes = exam.closes_at ? new Date(exam.closes_at) : null;
    if (closes && closes < now) return { label: "پایان‌یافته", tone: "gray" };
    if (opens && opens > now) return { label: "پیش‌رو", tone: "blue" };
    if (opens || closes) return { label: "در حال برگزاری", tone: "green" };
    return { label: "بدون زمان‌بندی", tone: "gray" };
  };
  const scheduledExams = exams
    .slice()
    .sort((a, b) => {
      const da = a.opens_at ? new Date(a.opens_at) : new Date(8640000000000000);
      const db = b.opens_at ? new Date(b.opens_at) : new Date(8640000000000000);
      return da - db;
    });

  const teacherByUsername = {};
  teachers.forEach((t) => { teacherByUsername[t.username] = t; });
  const classById = {};
  classes.forEach((c) => { classById[c.id] = c; });

  const schoolExams = exams
    .filter((e) => !examSearch || e.title.includes(examSearch))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const removeExam = async (exam) => {
    const qCount = questions.filter((q) => q.exam_id === exam.id).length;
    if (!window.confirm(`آزمون «${exam.title}» حذف شود؟ ${qCount} سوال و همه‌ی نتایج این آزمون نیز حذف می‌شوند. این کار قابل بازگشت نیست.`)) return;
    const deletions = [deleteKey(`exam:${exam.id}`)];
    questions.filter((q) => q.exam_id === exam.id).forEach((q) => deletions.push(deleteKey(`question:${q.id}`)));
    const examAnswerStudentIds = new Set(answers.filter((a) => a.exam_id === exam.id).map((a) => a.student_id));
    examAnswerStudentIds.forEach((sid) => deletions.push(deleteKey(`answers:${sid}`)));
    students.filter((s) => s.exam_id === exam.id).forEach((s) => deletions.push(deleteKey(`student:${s.id}`)));
    await Promise.all(deletions);
    await refresh();
  };

  const schoolRoster = roster
    .filter((r) => !studentSearch || r.fullname.includes(studentSearch))
    .sort((a, b) => a.fullname.localeCompare(b.fullname, "fa"));

  const startEditStudent = (m) => { setEditingStudentId(m.id); setEditStudentName(m.fullname); };
  const cancelEditStudent = () => { setEditingStudentId(null); setEditStudentName(""); };
  const saveEditStudent = async (m) => {
    if (!editStudentName.trim() || editStudentName.trim() === m.fullname) { cancelEditStudent(); return; }
    setSavingStudentName(true);
    await setJSON(`roster:${m.id}`, { ...m, fullname: editStudentName.trim() });
    setSavingStudentName(false);
    cancelEditStudent();
    await refresh();
  };
  const regenerateStudentCode = async (m) => {
    const code = generateCode(roster.filter((r) => r.id !== m.id).map((r) => r.code));
    await setJSON(`roster:${m.id}`, { ...m, code });
    await refresh();
  };
  const removeSchoolStudent = async (m) => {
    if (!window.confirm(`«${m.fullname}» حذف شود؟`)) return;
    await deleteKey(`roster:${m.id}`);
    await refresh();
  };

  return (
    <div style={{ display: "flex", flexDirection: "row-reverse", minHeight: "100vh", background: "#F8FAFC" }}>
      <AdminSidebar
        active={view}
        onNavigate={setView}
        onSettings={() => setShowOwnSettings(true)}
        onHelp={() => setShowHelp(true)}
        onLogout={onLogout}
        adminName={teacher.fullname}
      />

      <div style={{ flex: 1, padding: "30px 34px", overflowY: "auto" }}>
        <TopBar title={viewTitles[view]} teacherName={teacher.fullname} />

        {view === "dashboard" && (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <StatCard icon={Users} label="تعداد معلمان" value={teachers.length} color="#2563EB" />
            <StatCard icon={FileText} label="تعداد آزمون‌ها (کل مدرسه)" value={exams.length} color="#8B5CF6" />
            <StatCard icon={Users} label="تعداد کلاس‌ها (کل مدرسه)" value={classes.length} color="#0EA5E9" />
            <StatCard icon={BarChart3} label="تعداد دانش‌آموزان (کل مدرسه)" value={students.length} color="#16A34A" />
          </div>
        )}

        {view === "teachers" && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#1E293B" }}>معلمان مدرسه</div>
              <div style={{ display: "flex", gap: 10, flex: 1, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجوی معلم..." style={{ maxWidth: 220 }} />
                <Button onClick={() => setShowCreate(true)}><Plus size={16} />افزودن معلم</Button>
              </div>
            </div>

            {visibleTeachers.length === 0 ? (
              <EmptyState text="هنوز معلمی اضافه نشده است." actionLabel="افزودن معلم" onAction={() => setShowCreate(true)} />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #EEF1F6", textAlign: "right" }}>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>نام معلم</th>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>نام کاربری</th>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>کلاس‌ها</th>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>آزمون‌ها</th>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>دانش‌آموزان</th>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>تاریخ عضویت</th>
                      <th style={{ padding: "10px 6px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTeachers.map((t) => {
                      const s = statsFor(t.username);
                      return (
                        <tr key={t.username} style={{ borderBottom: "1px solid #F5F7FA" }}>
                          <td style={{ padding: "12px 6px", fontWeight: 700, color: "#1E293B" }}>{t.fullname}</td>
                          <td style={{ padding: "12px 6px", color: "#64748B" }}>{t.username}</td>
                          <td style={{ padding: "12px 6px", color: "#475569" }}>{s.classCount}</td>
                          <td style={{ padding: "12px 6px", color: "#475569" }}>{s.examCount}</td>
                          <td style={{ padding: "12px 6px", color: "#475569" }}>{s.studentCount}</td>
                          <td style={{ padding: "12px 6px", color: "#94A3B8" }}>{t.created_at ? new Date(t.created_at).toLocaleDateString("fa-IR") : "—"}</td>
                          <td style={{ padding: "12px 6px" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                              <div
                                onClick={() => setEditingTeacher(t)}
                                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, background: "#EFF6FF", cursor: "pointer" }}
                              >
                                <Edit2 size={16} color="#2563EB" />
                              </div>
                              <div
                                onClick={() => removeTeacher(t)}
                                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, background: "#FEF2F2", cursor: "pointer" }}
                              >
                                <Trash2 size={16} color="#DC2626" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {view === "classes" && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#1E293B" }}>کلاس‌بندی مدرسه</div>
              <div style={{ display: "flex", gap: 10, flex: 1, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <TextInput value={classSearch} onChange={(e) => setClassSearch(e.target.value)} placeholder="جستجوی کلاس..." style={{ maxWidth: 220 }} />
                <Button onClick={() => setShowCreateClass(true)}><Plus size={16} />کلاس جدید</Button>
              </div>
            </div>

            {schoolClasses.filter((c) => !classSearch || c.name.includes(classSearch)).length === 0 ? (
              <EmptyState text="هنوز کلاسی ساخته نشده است." actionLabel="کلاس جدید" onAction={() => setShowCreateClass(true)} />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #EEF1F6", textAlign: "right" }}>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>نام کلاس</th>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>معلم مسئول</th>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>دانش‌آموزان</th>
                      <th style={{ padding: "10px 6px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {schoolClasses.filter((c) => !classSearch || c.name.includes(classSearch)).map((c) => (
                      <tr key={c.id} style={{ borderBottom: "1px solid #F5F7FA" }}>
                        <td style={{ padding: "12px 6px", fontWeight: 700, color: "#1E293B" }}>
                          {editingClassId === c.id ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <TextInput
                                autoFocus
                                value={editClassName}
                                onChange={(e) => setEditClassName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") saveEditClass(c); if (e.key === "Escape") cancelEditClass(); }}
                                style={{ fontSize: 13, padding: "7px 10px", maxWidth: 140 }}
                              />
                              <Button type="button" style={{ fontSize: 12, padding: "7px 10px" }} onClick={() => saveEditClass(c)} disabled={savingClassName}>ذخیره</Button>
                              <Button type="button" variant="ghost" style={{ fontSize: 12, padding: "7px 10px" }} onClick={cancelEditClass}>انصراف</Button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {c.name}
                              <span onClick={() => startEditClass(c)} style={{ display: "flex", cursor: "pointer", color: "#94A3B8", padding: 3 }} title="ویرایش نام کلاس">
                                <Edit2 size={13} />
                              </span>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "12px 6px" }}>
                          <select
                            value={c.teacher_id || ""}
                            onChange={(e) => assignClass(c, e.target.value)}
                            style={{ ...inputStyle, padding: "8px 10px", fontSize: 13, maxWidth: 200 }}
                          >
                            <option value="">— بدون معلم —</option>
                            {teachers.map((t) => (
                              <option key={t.username} value={t.username}>{t.fullname}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: "12px 6px", color: "#475569" }}>{roster.filter((r) => r.class_id === c.id).length}</td>
                        <td style={{ padding: "12px 6px" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <Button variant="ghost" style={{ fontSize: 12.5, padding: "7px 10px" }} onClick={() => setManagingRosterClass(c)}>
                              <Users size={14} />دانش‌آموزان
                            </Button>
                            <div
                              onClick={() => removeClass(c)}
                              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, background: "#FEF2F2", cursor: "pointer" }}
                            >
                              <Trash2 size={16} color="#DC2626" />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {view === "exams" && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#1E293B" }}>آزمون‌های مدرسه</div>
              <TextInput value={examSearch} onChange={(e) => setExamSearch(e.target.value)} placeholder="جستجوی آزمون..." style={{ maxWidth: 220 }} />
            </div>

            {schoolExams.length === 0 ? (
              <EmptyState text="هنوز آزمونی ساخته نشده است." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #EEF1F6", textAlign: "right" }}>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>عنوان آزمون</th>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>معلم</th>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>تعداد سوال</th>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>شرکت‌کنندگان</th>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>تاریخ ساخت</th>
                      <th style={{ padding: "10px 6px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {schoolExams.map((exam) => {
                      const t = teacherByUsername[exam.teacher_id];
                      const qCount = questions.filter((q) => q.exam_id === exam.id).length;
                      const sCount = students.filter((s) => s.exam_id === exam.id).length;
                      return (
                        <tr key={exam.id} style={{ borderBottom: "1px solid #F5F7FA" }}>
                          <td style={{ padding: "12px 6px", fontWeight: 700, color: "#1E293B" }}>{exam.title}</td>
                          <td style={{ padding: "12px 6px", color: "#64748B" }}>{t ? t.fullname : "—"}</td>
                          <td style={{ padding: "12px 6px", color: "#475569" }}>{qCount}</td>
                          <td style={{ padding: "12px 6px", color: "#475569" }}>{sCount}</td>
                          <td style={{ padding: "12px 6px", color: "#94A3B8" }}>{exam.created_at ? new Date(exam.created_at).toLocaleDateString("fa-IR") : "—"}</td>
                          <td style={{ padding: "12px 6px" }}>
                            <div
                              onClick={() => removeExam(exam)}
                              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, background: "#FEF2F2", cursor: "pointer" }}
                            >
                              <Trash2 size={16} color="#DC2626" />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {view === "results" && (
          <AdminResultsScreen
            exams={exams}
            teachers={teachers}
            teacherByUsername={teacherByUsername}
            classes={classes}
            students={students}
            questions={questions}
            answers={answers}
            teacherFilter={resultsTeacherFilter}
            onTeacherFilterChange={setResultsTeacherFilter}
            adminTeacher={teacher}
            refresh={refresh}
          />
        )}

        {view === "backup" && <AdminBackupScreen refresh={refresh} />}

        {view === "students" && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#1E293B" }}>دانش‌آموزان مدرسه</div>
              <TextInput value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="جستجوی دانش‌آموز..." style={{ maxWidth: 220 }} />
            </div>

            {schoolRoster.length === 0 ? (
              <EmptyState text="هنوز دانش‌آموزی اضافه نشده است." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #EEF1F6", textAlign: "right" }}>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>نام دانش‌آموز</th>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>کلاس</th>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>معلم</th>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>کد ورود</th>
                      <th style={{ padding: "10px 6px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {schoolRoster.map((m) => {
                      const cls = classById[m.class_id];
                      const t = teacherByUsername[m.teacher_id];
                      return (
                        <tr key={m.id} style={{ borderBottom: "1px solid #F5F7FA" }}>
                          <td style={{ padding: "12px 6px", fontWeight: 700, color: "#1E293B" }}>
                            {editingStudentId === m.id ? (
                              <div style={{ display: "flex", gap: 6 }}>
                                <TextInput
                                  autoFocus
                                  value={editStudentName}
                                  onChange={(e) => setEditStudentName(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") saveEditStudent(m); if (e.key === "Escape") cancelEditStudent(); }}
                                  style={{ fontSize: 13, padding: "7px 10px", maxWidth: 150 }}
                                />
                                <Button type="button" style={{ fontSize: 12, padding: "7px 10px" }} onClick={() => saveEditStudent(m)} disabled={savingStudentName}>ذخیره</Button>
                                <Button type="button" variant="ghost" style={{ fontSize: 12, padding: "7px 10px" }} onClick={cancelEditStudent}>انصراف</Button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                {m.fullname}
                                <span onClick={() => startEditStudent(m)} style={{ display: "flex", cursor: "pointer", color: "#94A3B8", padding: 3 }} title="ویرایش نام">
                                  <Edit2 size={13} />
                                </span>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "12px 6px", color: "#64748B" }}>{cls ? cls.name : "—"}</td>
                          <td style={{ padding: "12px 6px", color: "#64748B" }}>{t ? t.fullname : "—"}</td>
                          <td style={{ padding: "12px 6px" }}>
                            <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 800, color: "#2563EB", letterSpacing: 1 }}>{m.code}</span>
                          </td>
                          <td style={{ padding: "12px 6px" }}>
                            <div style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "flex-end" }}>
                              <span onClick={() => regenerateStudentCode(m)} style={{ fontSize: 11.5, color: "#64748B", cursor: "pointer" }}>کد جدید</span>
                              <div
                                onClick={() => removeSchoolStudent(m)}
                                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 7, background: "#FEF2F2", cursor: "pointer" }}
                              >
                                <Trash2 size={14} color="#DC2626" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {view === "messages" && (
          <div>
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 22, marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#1E293B", marginBottom: 16 }}>ارسال اعلان جدید</div>
              <Field label="گیرنده">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { key: "teachers", label: "همه معلمان" },
                    { key: "students", label: "همه دانش‌آموزان مدرسه" },
                    { key: "class", label: "یک کلاس خاص" },
                    { key: "student", label: "یک دانش‌آموز خاص" },
                  ].map((opt) => (
                    <div key={opt.key} onClick={() => { setAnnounceAudience(opt.key); setAnnounceClassId(""); setAnnounceStudentId(""); }} style={{
                      padding: "8px 14px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700,
                      background: announceAudience === opt.key ? "#2563EB" : "#F1F5F9", color: announceAudience === opt.key ? "#fff" : "#475569",
                    }}>{opt.label}</div>
                  ))}
                </div>
              </Field>
              {(announceAudience === "class" || announceAudience === "student") && (
                <Field label="انتخاب کلاس">
                  <select
                    value={announceClassId}
                    onChange={(e) => { setAnnounceClassId(e.target.value); setAnnounceStudentId(""); }}
                    style={{ ...inputStyle }}
                  >
                    <option value="">— انتخاب کن —</option>
                    {schoolClasses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </Field>
              )}
              {announceAudience === "student" && announceClassId && (
                <Field label="انتخاب دانش‌آموز">
                  <select
                    value={announceStudentId}
                    onChange={(e) => setAnnounceStudentId(e.target.value)}
                    style={{ ...inputStyle }}
                  >
                    <option value="">— انتخاب کن —</option>
                    {roster.filter((r) => r.class_id === announceClassId).map((r) => (
                      <option key={r.id} value={r.id}>{r.fullname}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="متن اعلان">
                <textarea value={announceText} onChange={(e) => setAnnounceText(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} placeholder="مثلاً: جلسه هماهنگی معلمان روز شنبه ساعت ۱۰" />
              </Field>
              <Button onClick={sendAnnouncement} disabled={announceSending || (announceAudience === "class" && !announceClassId) || (announceAudience === "student" && !announceStudentId)}>
                <Plus size={16} />{announceSending ? "در حال ارسال..." : "ارسال اعلان"}
              </Button>
            </div>

            <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", marginBottom: 12 }}>اعلانات ارسال‌شده</div>
            {adminAnnouncements.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6" }}>
                <EmptyState text="هنوز اعلانی نفرستاده‌ای." />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {adminAnnouncements.map((m) => (
                  <div key={m.id} style={{ background: "#fff", border: "1px solid #EEF1F6", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#334155", marginBottom: 6, whiteSpace: "pre-wrap" }}>{m.text}</div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Badge tone="blue">{describeAudience(m)}</Badge>
                        <span style={{ fontSize: 11, color: "#94A3B8" }}>{new Date(m.created_at).toLocaleString("fa-IR")}</span>
                      </div>
                    </div>
                    <div
                      onClick={() => removeAnnouncement(m.id)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 7, background: "#FEF2F2", cursor: "pointer", flexShrink: 0 }}
                    >
                      <Trash2 size={14} color="#DC2626" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "schedule" && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 22 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1E293B", marginBottom: 16 }}>برنامه امتحانات مدرسه</div>
            {scheduledExams.length === 0 ? (
              <EmptyState text="هنوز آزمونی ساخته نشده است." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #EEF1F6", textAlign: "right" }}>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>عنوان آزمون</th>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>معلم</th>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>شروع</th>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>پایان</th>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>مدت (دقیقه)</th>
                      <th style={{ padding: "10px 6px", color: "#94A3B8", fontWeight: 700 }}>وضعیت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduledExams.map((exam) => {
                      const t = teacherByUsername[exam.teacher_id];
                      const st = examStatus(exam);
                      return (
                        <tr key={exam.id} style={{ borderBottom: "1px solid #F5F7FA" }}>
                          <td style={{ padding: "12px 6px", fontWeight: 700, color: "#1E293B" }}>{exam.title}</td>
                          <td style={{ padding: "12px 6px", color: "#64748B" }}>{t ? t.fullname : "—"}</td>
                          <td style={{ padding: "12px 6px", color: "#475569" }}>{exam.opens_at ? new Date(exam.opens_at).toLocaleString("fa-IR") : "—"}</td>
                          <td style={{ padding: "12px 6px", color: "#475569" }}>{exam.closes_at ? new Date(exam.closes_at).toLocaleString("fa-IR") : "—"}</td>
                          <td style={{ padding: "12px 6px", color: "#475569" }}>{exam.duration_minutes || "—"}</td>
                          <td style={{ padding: "12px 6px" }}><Badge tone={st.tone}>{st.label}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 26, fontSize: 11, color: "#94A3B8" }}>
          © {new Date().getFullYear()} ghobeishawi — تمامی حقوق محفوظ است
        </div>
      </div>

      {showCreate && (
        <Modal title="افزودن حساب معلم جدید" onClose={() => setShowCreate(false)}>
          <CreateTeacherForm
            existingUsernames={teachers.map((t) => t.username)}
            onCreated={async () => { setShowCreate(false); await refresh(); }}
          />
        </Modal>
      )}

      {managingRosterClass && (
        <AdminRosterModal
          cls={managingRosterClass}
          roster={roster}
          onClose={() => setManagingRosterClass(null)}
          refresh={refresh}
        />
      )}

      {showCreateClass && (
        <Modal title="ساخت کلاس جدید" onClose={() => setShowCreateClass(false)}>
          <CreateClassForm onCreate={async (name) => { await createClass(name); setShowCreateClass(false); }} />
        </Modal>
      )}

      {editingTeacher && (
        <Modal title={`ویرایش حساب: ${editingTeacher.fullname}`} onClose={() => setEditingTeacher(null)}>
          <EditTeacherForm
            teacher={editingTeacher}
            onSaved={async (updated) => { setEditingTeacher(updated); await refresh(); }}
          />
        </Modal>
      )}

      {showHelp && (
        <Modal title="راهنمای پنل مدیریت" onClose={() => setShowHelp(false)}>
          <div style={{ fontSize: 13.5, color: "#334155", lineHeight: 2.1 }}>
            <b>معلمان:</b> از این بخش برای هر معلم مدرسه یک حساب کاربری بساز. هر معلم فقط کلاس‌ها و آزمون‌های خودش را می‌بیند.
            <br /><br />
            <b>کلاس‌بندی:</b> کلاس‌های مدرسه را اینجا تعریف کن و هرکدام را به یک معلم بسپار. دانش‌آموزان هر کلاس هم از همین بخش (دکمه «دانش‌آموزان») اضافه می‌شوند.
            <br /><br />
            <b>آزمون‌ها و دانش‌آموزان:</b> نمای کلی از همه‌ی آزمون‌ها و دانش‌آموزان مدرسه، صرف‌نظر از اینکه مال کدام معلم است.
            <br /><br />
            <b>نتایج و گزارش‌ها:</b> میانگین نمرات و مقایسه‌ی عملکرد به تفکیک معلم و کلاس، و امکان دیدن نتایج ریز هر آزمون.
            <br /><br />
            <b>پشتیبان‌گیری و بازیابی:</b> دانلود یک فایل شامل کل داده‌ی مدرسه، و بازیابی از روی آن در صورت نیاز.
            <br /><br />
            برای خروج از حساب یا تغییر رمز عبور، از پایین همین منو استفاده کن.
          </div>
        </Modal>
      )}

      {showOwnSettings && (
        <AdminProfileModal
          teacher={teacher}
          onClose={() => setShowOwnSettings(false)}
          onSaved={(updated) => { onUpdateSelf && onUpdateSelf(updated); }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   ADMIN RESULTS & REPORTS — school-wide performance overview
--------------------------------------------------------- */

function AdminResultsScreen({ exams, teachers, teacherByUsername, classes, students, questions, answers, teacherFilter, onTeacherFilterChange, adminTeacher, refresh }) {
  const [drillExamId, setDrillExamId] = useState(null);

  const visibleExams = teacherFilter ? exams.filter((e) => e.teacher_id === teacherFilter) : exams;
  const visibleExamIds = new Set(visibleExams.map((e) => e.id));
  const visibleAnswers = answers.filter((a) => visibleExamIds.has(a.exam_id));

  // One row per exam attempt (student), with its overall percentage — mirrors
  // the per-exam grouping ResultsScreen uses, but across every visible exam at once.
  const byAttempt = {};
  visibleAnswers.forEach((a) => {
    const key = a.student_id;
    byAttempt[key] = byAttempt[key] || [];
    byAttempt[key].push(a);
  });
  const attemptRows = Object.entries(byAttempt).map(([studentId, list]) => {
    const student = students.find((s) => s.id === studentId);
    const exam = exams.find((e) => e.id === list[0].exam_id);
    const totalMarks = list.reduce((s, a) => s + (a.mark || 1), 0);
    const gotMarks = list.reduce((s, a) => s + awardedMarkOf(a), 0);
    const pct = totalMarks ? Math.round((gotMarks / totalMarks) * 1000) / 10 : 0;
    return {
      studentId, pct, teacherId: exam?.teacher_id, examId: exam?.id,
      classCode: student?.class_code || null,
    };
  }).filter((r) => r.teacherId);

  const avg = attemptRows.length ? Math.round((attemptRows.reduce((s, r) => s + r.pct, 0) / attemptRows.length) * 10) / 10 : 0;
  const passRate = attemptRows.length ? Math.round((attemptRows.filter((r) => r.pct >= 50).length / attemptRows.length) * 100) : 0;
  const examsHeldCount = new Set(attemptRows.map((r) => r.examId)).size;

  const byTeacher = {};
  attemptRows.forEach((r) => {
    byTeacher[r.teacherId] = byTeacher[r.teacherId] || [];
    byTeacher[r.teacherId].push(r);
  });
  const teacherRankings = Object.entries(byTeacher).map(([username, rows]) => ({
    username,
    name: teacherByUsername[username]?.fullname || username,
    avg: Math.round((rows.reduce((s, r) => s + r.pct, 0) / rows.length) * 10) / 10,
    participantCount: rows.length,
    examCount: new Set(rows.map((r) => r.examId)).size,
  })).sort((a, b) => b.avg - a.avg);

  const byClass = {};
  attemptRows.forEach((r) => {
    const key = r.classCode || "بدون کلاس";
    byClass[key] = byClass[key] || [];
    byClass[key].push(r);
  });
  const classRankings = Object.entries(byClass).map(([cls, rows]) => ({
    cls,
    avg: Math.round((rows.reduce((s, r) => s + r.pct, 0) / rows.length) * 10) / 10,
    participantCount: rows.length,
  })).sort((a, b) => b.avg - a.avg);

  const drillExam = exams.find((e) => e.id === drillExamId);

  return (
    <div>
      <div style={{ marginBottom: 18, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#64748B" }}>فیلتر معلم:</span>
        <select
          value={teacherFilter}
          onChange={(e) => { onTeacherFilterChange(e.target.value); setDrillExamId(null); }}
          style={{ ...inputStyle, width: "auto", padding: "8px 12px" }}
        >
          <option value="">همه معلمان</option>
          {teachers.map((t) => <option key={t.username} value={t.username}>{t.fullname}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <StatCard icon={TrendingUp} label="میانگین نمره (کل)" value={`${avg}%`} color="#2563EB" />
        <StatCard icon={CheckCircle2} label="درصد قبولی" value={`${passRate}%`} color="#8B5CF6" />
        <StatCard icon={Users} label="تعداد شرکت‌ها" value={attemptRows.length} color="#0EA5E9" />
        <StatCard icon={FileText} label="آزمون‌های برگزارشده" value={examsHeldCount} color="#16A34A" />
      </div>

      {attemptRows.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 22 }}>
          <EmptyState text="هنوز هیچ دانش‌آموزی در آزمونی شرکت نکرده است." />
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
            <div style={{ flex: "1 1 320px", background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 22 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", marginBottom: 14 }}>مقایسه معلمان</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {teacherRankings.map((t) => (
                  <div key={t.username}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#334155", marginBottom: 4 }}>
                      <span>{t.name} <span style={{ color: "#94A3B8", fontSize: 11 }}>({t.participantCount} شرکت، {t.examCount} آزمون)</span></span>
                      <span style={{ fontWeight: 800, color: t.avg >= 50 ? "#16A34A" : "#DC2626" }}>{t.avg}%</span>
                    </div>
                    <div style={{ height: 7, background: "#EEF1F6", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${t.avg}%`, height: "100%", background: t.avg >= 50 ? "#16A34A" : "#DC2626" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ flex: "1 1 320px", background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 22 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", marginBottom: 14 }}>مقایسه کلاس‌ها</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {classRankings.map((c) => (
                  <div key={c.cls}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#334155", marginBottom: 4 }}>
                      <span>{c.cls} <span style={{ color: "#94A3B8", fontSize: 11 }}>({c.participantCount} شرکت)</span></span>
                      <span style={{ fontWeight: 800, color: c.avg >= 50 ? "#16A34A" : "#DC2626" }}>{c.avg}%</span>
                    </div>
                    <div style={{ height: 7, background: "#EEF1F6", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${c.avg}%`, height: "100%", background: c.avg >= 50 ? "#16A34A" : "#DC2626" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", marginBottom: 14 }}>نتایج ریز یک آزمون</div>
            {!drillExamId ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: "#64748B" }}>انتخاب آزمون:</span>
                <select
                  value=""
                  onChange={(e) => setDrillExamId(e.target.value)}
                  style={{ ...inputStyle, width: "auto", padding: "8px 12px" }}
                >
                  <option value="" disabled>یک آزمون را انتخاب کن...</option>
                  {visibleExams.map((e) => (
                    <option key={e.id} value={e.id}>{e.title} — {teacherByUsername[e.teacher_id]?.fullname || "—"}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <div
                  onClick={() => setDrillExamId(null)}
                  style={{ fontSize: 12.5, color: "#2563EB", cursor: "pointer", fontWeight: 700, marginBottom: 10 }}
                >
                  ← بازگشت به لیست آزمون‌ها
                </div>
                <ResultsScreen
                  teacher={adminTeacher}
                  exams={exams}
                  questions={questions}
                  students={students}
                  answers={answers}
                  examsOverride={visibleExams}
                  examLabelFn={(e) => `${e.title} — ${teacherByUsername[e.teacher_id]?.fullname || "—"}`}
                  initialExamId={drillExamId}
                  hideTopBar
                  refresh={refresh}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   ADMIN BACKUP & RESTORE — full school-wide data snapshot
--------------------------------------------------------- */

function AdminBackupScreen({ refresh }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState("blue");
  const [confirmingRestore, setConfirmingRestore] = useState(null); // holds the parsed file data awaiting confirmation

  const ALL_PREFIXES = ["teacher:", "exam:", "question:", "student:", "answers:", "class:", "roster:", "message:", "cheatalert:"];

  const exportBackup = async () => {
    setBusy(true);
    setMsg("در حال آماده‌سازی فایل پشتیبان...");
    setMsgTone("blue");
    try {
      const data = {};
      let count = 0;
      for (const p of ALL_PREFIXES) {
        const keys = await listPrefix(p);
        for (const k of keys) {
          data[k] = await getJSON(k);
          count++;
        }
      }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadTextFile(`majazi-backup-${stamp}.json`, JSON.stringify(data, null, 2), "application/json");
      setMsg(`پشتیبان کامل مدرسه دانلود شد (${count} مورد).`);
      setMsgTone("green");
    } catch {
      setMsg("خطا در ساخت فایل پشتیبان.");
      setMsgTone("red");
    }
    setBusy(false);
  };

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const keys = Object.keys(data);
      const hasTeacher = keys.some((k) => k.startsWith("teacher:"));
      if (keys.length === 0 || !hasTeacher) {
        setMsg("این فایل یک پشتیبان معتبر مجازی به نظر نمی‌رسد.");
        setMsgTone("red");
        return;
      }
      setConfirmingRestore({ data, keys });
    } catch {
      setMsg("فایل نامعتبر است.");
      setMsgTone("red");
    }
  };

  const doRestore = async () => {
    if (!confirmingRestore) return;
    setBusy(true);
    setMsg("در حال بازیابی...");
    setMsgTone("blue");
    try {
      const { data, keys } = confirmingRestore;
      for (const k of keys) {
        await setJSON(k, data[k]);
      }
      setConfirmingRestore(null);
      await refresh();
      setMsg(`${keys.length} مورد با موفقیت بازیابی شد.`);
      setMsgTone("green");
    } catch {
      setMsg("خطایی در بازیابی رخ داد.");
      setMsgTone("red");
    }
    setBusy(false);
  };

  const toneColor = { blue: "#2563EB", green: "#16A34A", red: "#DC2626" }[msgTone] || "#2563EB";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 520 }}>
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", marginBottom: 6 }}>دانلود پشتیبان کامل مدرسه</div>
        <div style={{ fontSize: 12.5, color: "#64748B", marginBottom: 16 }}>
          یک فایل شامل همه‌ی داده‌های مدرسه می‌سازه: حساب‌های معلمان، کلاس‌بندی، دانش‌آموزان، آزمون‌ها، سوالات و نتایج. توصیه می‌شه هر چند وقت یک‌بار (مثلاً قبل از تغییرات بزرگ) یک نسخه دانلود و جایی امن نگه‌داری بشه.
        </div>
        <Button onClick={exportBackup} disabled={busy}><Download size={15} />دانلود فایل پشتیبان</Button>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EEF1F6", padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", marginBottom: 6 }}>بازیابی از فایل پشتیبان</div>
        <div style={{ fontSize: 12.5, color: "#64748B", marginBottom: 16 }}>
          هر چیزی که در فایل باشه بازنویسی می‌شه (روی داده‌ی فعلی می‌شینه). چیزهایی که در فایل نیستن حذف نمی‌شن. این کار قابل بازگشت نیست، مگر اینکه خودت هم از وضعیت فعلی یک پشتیبان جدا داشته باشی.
        </div>
        <label style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10,
          fontSize: 14, fontWeight: 700, cursor: busy ? "default" : "pointer", background: "#fff", color: "#334155",
          border: "1.5px solid #E2E8F0", opacity: busy ? 0.6 : 1,
        }}>
          انتخاب فایل پشتیبان
          <input type="file" accept="application/json" onChange={pickFile} disabled={busy} style={{ display: "none" }} />
        </label>
      </div>

      {msg && <div style={{ fontSize: 13, color: toneColor, fontWeight: 600 }}>{msg}</div>}

      {confirmingRestore && (
        <Modal onClose={() => setConfirmingRestore(null)} title="تأیید بازیابی">
          <div style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.9, marginBottom: 18 }}>
            این فایل شامل <b>{confirmingRestore.keys.length}</b> مورد داده‌ست. با ادامه، این داده‌ها جایگزین نسخه‌ی فعلی‌شون در مدرسه می‌شن. این کار قابل بازگشت نیست. مطمئنی؟
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={doRestore} disabled={busy}>بله، بازیابی کن</Button>
            <Button variant="ghost" onClick={() => setConfirmingRestore(null)}>انصراف</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
