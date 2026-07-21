/* ---------------------------------------------------------
   آزمون‌ساز معلم — صفحه آزمون دانش‌آموز
   © ghobeishawi - All rights reserved.
---------------------------------------------------------- */

// متغیرهای سراسری
let currentExam = null;
let currentQuestions = [];
let currentStudentId = null;
let currentIndex = 0;
let answers = {};
let timerInterval = null;
let timeRemaining = 0;
let autoSaveInterval = null;
let offlineQueue = [];

// ==========================================
// توابع کمکی
// ==========================================
async function saveAnswersToD1(studentId, examId, answersBatch) {
  try {
    const response = await fetch("/api/answers/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: studentId,
        exam_id: examId,
        answers_batch: answersBatch
      })
    });
    const data = await response.json();
    return data.ok;
  } catch (err) {
    console.error("خطا در ذخیره:", err);
    return false;
  }
}

async function autoSave() {
  if (!currentStudentId || !currentExam) return;
  
  const batch = Object.keys(answers).map(qId => ({
    question_id: qId,
    selected_option: answers[qId] || null,
    time_taken: 0
  }));
  
  if (batch.length === 0) return;
  
  const success = await saveAnswersToD1(currentStudentId, currentExam.id, batch);
  if (!success) {
    offlineQueue.push(...batch);
  }
}

function flushOfflineQueue() {
  if (offlineQueue.length === 0) return;
  const batch = [...offlineQueue];
  offlineQueue = [];
  saveAnswersToD1(currentStudentId, currentExam.id, batch);
}

// ==========================================
// شروع آزمون
// ==========================================
async function startExam(examId, studentId) {
  currentStudentId = studentId;
  
  try {
    const response = await fetch(`/api/kv?key=exam:${examId}`);
    const data = await response.json();
    currentExam = data.v;
    
    const qResponse = await fetch(`/api/kv?key=questions:${examId}`);
    const qData = await qResponse.json();
    currentQuestions = qData.v || [];
    
    if (currentQuestions.length === 0) {
      alert("سوالی یافت نشد!");
      return;
    }
    
    timeRemaining = (currentExam.duration || 60) * 60;
    currentIndex = 0;
    answers = {};
    
    renderQuestion();
    startTimer();
    startAutoSave();
    
  } catch (err) {
    alert("خطا در بارگذاری آزمون: " + err.message);
  }
}

// ==========================================
// نمایش سوال
// ==========================================
function renderQuestion() {
  const container = document.getElementById("question-container");
  if (!container) return;
  
  const q = currentQuestions[currentIndex];
  if (!q) return;
  
  let html = `
    <div class="question-card">
      <h3>سوال ${currentIndex + 1} از ${currentQuestions.length}</h3>
      <p class="question-text">${q.question_text}</p>
      <div class="options">
  `;
  
  const options = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
  if (Array.isArray(options)) {
    options.forEach((opt, idx) => {
      const selected = answers[q.id] === idx ? "selected" : "";
      html += `
        <div class="option ${selected}" onclick="selectOption(${idx})">
          ${opt}
        </div>
      `;
    });
  }
  
  html += `
      </div>
      <div class="nav-buttons">
        ${currentIndex > 0 ? '<button onclick="prevQuestion()">قبلی</button>' : ''}
        ${currentIndex < currentQuestions.length - 1 ? '<button onclick="nextQuestion()">بعدی</button>' : ''}
        ${currentIndex === currentQuestions.length - 1 ? '<button onclick="submitExam()">ثبت نهایی</button>' : ''}
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

function selectOption(idx) {
  const q = currentQuestions[currentIndex];
  answers[q.id] = idx;
  renderQuestion();
}

function nextQuestion() {
  if (currentIndex < currentQuestions.length - 1) {
    currentIndex++;
    renderQuestion();
  }
}

function prevQuestion() {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
  }
}

// ==========================================
// تایمر
// ==========================================
function startTimer() {
  const timerEl = document.getElementById("timer");
  timerInterval = setInterval(() => {
    timeRemaining--;
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      submitExam();
      return;
    }
    const min = Math.floor(timeRemaining / 60);
    const sec = timeRemaining % 60;
    if (timerEl) {
      timerEl.textContent = `${min}:${sec.toString().padStart(2, "0")}`;
    }
  }, 1000);
}

// ==========================================
// ذخیره خودکار هر ۳۰ ثانیه
// ==========================================
function startAutoSave() {
  autoSaveInterval = setInterval(autoSave, 30000);
}

// ==========================================
// ثبت نهایی
// ==========================================
async function submitExam() {
  clearInterval(timerInterval);
  clearInterval(autoSaveInterval);
  
  await autoSave();
  await flushOfflineQueue();
  
  alert("آزمون شما با موفقیت ثبت شد!");
  window.location.href = "/";
}
