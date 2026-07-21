/* ---------------------------------------------------------
   آزمون‌ساز معلم — صفحه آزمون دانش‌آموز
   © ghobeishawi - All rights reserved.
---------------------------------------------------------- */

function TakeExamScreen({ examId, studentId }) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState({});
  const [timeRemaining, setTimeRemaining] = React.useState(0);
  const [currentExam, setCurrentExam] = React.useState(null);
  const [currentQuestions, setCurrentQuestions] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    async function loadData() {
      try {
        const examResponse = await fetch(`/api/kv?key=exam:${examId}`);
        const examData = await examResponse.json();
        setCurrentExam(examData.v);
        
        const questionsResponse = await fetch(`/api/kv?key=questions:${examId}`);
        const questionsData = await questionsResponse.json();
        setCurrentQuestions(questionsData.v || []);
        
        setTimeRemaining((examData.v.duration || 60) * 60);
        setIsLoading(false);
      } catch (err) {
        setError("خطا در بارگذاری آزمون");
        setIsLoading(false);
      }
    }
    loadData();
  }, [examId]);

  React.useEffect(() => {
    if (timeRemaining <= 0) {
      handleSubmit();
      return;
    }
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => prev - 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeRemaining]);

  React.useEffect(() => {
    if (currentQuestions.length === 0) return;
    
    const interval = setInterval(() => {
      const batch = Object.keys(answers).map(qId => ({
        question_id: qId,
        selected_option: answers[qId],
      }));
      
      if (batch.length > 0) {
        fetch("/api/answers/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_id: studentId,
            exam_id: examId,
            answers_batch: batch
          })
        });
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [answers, examId, studentId]);

  const handleAnswer = (questionId, optionIndex) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = async () => {
    await fetch("/api/answers/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: studentId,
        exam_id: examId,
        answers_batch: Object.keys(answers).map(qId => ({
          question_id: qId,
          selected_option: answers[qId],
        }))
      })
    });
    
    alert("آزمون شما با موفقیت ثبت شد!");
    window.location.href = "/";
  };

  if (isLoading) return React.createElement('div', null, 'در حال بارگذاری آزمون...');
  if (error) return React.createElement('div', null, `خطا: ${error}`);
  if (currentQuestions.length === 0) return React.createElement('div', null, 'سوالی یافت نشد!');

  const currentQuestion = currentQuestions[currentQuestionIndex];
  const options = typeof currentQuestion.options === "string" 
    ? JSON.parse(currentQuestion.options) 
    : currentQuestion.options;

  return React.createElement('div', { className: 'exam-container' },
    React.createElement('div', { className: 'timer' },
      `زمان باقی‌مانده: ${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, '0')}`
    ),
    React.createElement('div', { className: 'question-card' },
      React.createElement('h3', null, `سوال ${currentQuestionIndex + 1} از ${currentQuestions.length}`),
      React.createElement('p', { className: 'question-text' }, currentQuestion.question_text),
      React.createElement('div', { className: 'options' },
        options.map((option, index) => 
          React.createElement('div', {
            key: index,
            className: `option ${answers[currentQuestion.id] === index ? 'selected' : ''}`,
            onClick: () => handleAnswer(currentQuestion.id, index)
          }, option)
        )
      )
    ),
    React.createElement('div', { className: 'nav-buttons' },
      currentQuestionIndex > 0 && React.createElement('button', {
        onClick: () => setCurrentQuestionIndex(prev => prev - 1)
      }, 'قبلی'),
      currentQuestionIndex < currentQuestions.length - 1 
        ? React.createElement('button', {
            onClick: () => setCurrentQuestionIndex(prev => prev + 1)
          }, 'بعدی')
        : React.createElement('button', { onClick: handleSubmit }, 'ثبت نهایی')
    )
  );
}
