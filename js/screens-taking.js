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
    console.log("Loading exam:", examId, "for student:", studentId);
    
    async function loadData() {
      try {
        console.log("Fetching exam data...");
        const examResponse = await fetch(`/api/kv?key=exam:${examId}`);
        console.log("Exam response status:", examResponse.status);
        const examData = await examResponse.json();
        console.log("Exam data:", examData);
        
        if (!examData.v) {
          setError("آزمون یافت نشد!");
          setIsLoading(false);
          return;
        }
        
        setCurrentExam(examData.v);
        
        console.log("Fetching questions...");
        const questionsResponse = await fetch(`/api/kv?key=questions:${examId}`);
        console.log("Questions response status:", questionsResponse.status);
        const questionsData = await questionsResponse.json();
        console.log("Questions data:", questionsData);
        
        const questions = questionsData.v || [];
        setCurrentQuestions(questions);
        
        if (questions.length === 0) {
          setError("سوالی در این آزمون وجود ندارد!");
          setIsLoading(false);
          return;
        }
        
        setTimeRemaining((examData.v.duration || 60) * 60);
        setIsLoading(false);
        console.log("Exam loaded successfully!");
      } catch (err) {
        console.error("Error loading exam:", err);
        setError("خطا در بارگذاری آزمون: " + err.message);
        setIsLoading(false);
      }
    }
    
    if (examId) {
      loadData();
    } else {
      setError("شناسه آزمون مشخص نشده است!");
      setIsLoading(false);
    }
  }, [examId]);

  React.useEffect(() => {
    if (timeRemaining <= 0 || isLoading || error) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeRemaining, isLoading, error]);

  const handleAnswer = (questionId, optionIndex) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = async () => {
    console.log("Submitting exam...");
    try {
      await fetch("/api/answers/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId || "unknown",
          exam_id: examId,
          answers_batch: Object.keys(answers).map(qId => ({
            question_id: qId,
            selected_option: answers[qId],
          }))
        })
      });
      
      alert("آزمون شما با موفقیت ثبت شد!");
      window.location.href = "/";
    } catch (err) {
      console.error("Error submitting:", err);
      alert("خطا در ثبت آزمون: " + err.message);
    }
  };

  if (isLoading) {
    return React.createElement('div', { style: { padding: '20px', textAlign: 'center' } }, 'در حال بارگذاری آزمون...');
  }
  
  if (error) {
    return React.createElement('div', { style: { padding: '20px', color: 'red' } }, error);
  }

  const currentQuestion = currentQuestions[currentQuestionIndex];
  if (!currentQuestion) {
    return React.createElement('div', { style: { padding: '20px' } }, 'سوال یافت نشد!');
  }

  const options = typeof currentQuestion.options === "string" 
    ? JSON.parse(currentQuestion.options) 
    : currentQuestion.options;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return React.createElement('div', { style: { padding: '20px', maxWidth: '600px', margin: '0 auto' } },
    React.createElement('div', { style: { background: '#1D3E73', color: 'white', padding: '10px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center' } },
      `زمان باقی‌مانده: ${minutes}:${seconds.toString().padStart(2, '0')}`
    ),
    React.createElement('div', { style: { background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' } },
      React.createElement('h3', null, `سوال ${currentQuestionIndex + 1} از ${currentQuestions.length}`),
      React.createElement('p', { style: { fontSize: '16px', marginBottom: '20px' } }, currentQuestion.question_text),
      React.createElement('div', null,
        options.map((option, index) => 
          React.createElement('div', {
            key: index,
            onClick: () => handleAnswer(currentQuestion.id, index),
            style: {
              padding: '15px',
              margin: '10px 0',
              background: answers[currentQuestion.id] === index ? '#BFDBFE' : '#F3F4F6',
              borderRadius: '8px',
              cursor: 'pointer',
              border: '2px solid ' + (answers[currentQuestion.id] === index ? '#3B82F6' : 'transparent')
            }
          }, option)
        )
      )
    ),
    React.createElement('div', { style: { marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'space-between' } },
      currentQuestionIndex > 0 
        ? React.createElement('button', {
            onClick: () => setCurrentQuestionIndex(prev => prev - 1),
            style: { padding: '10px 20px', background: '#6B7280', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }
          }, 'قبلی')
        : null,
      currentQuestionIndex < currentQuestions.length - 1
        ? React.createElement('button', {
            onClick: () => setCurrentQuestionIndex(prev => prev + 1),
            style: { padding: '10px 20px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }
          }, 'بعدی')
        : React.createElement('button', {
            onClick: handleSubmit,
            style: { padding: '10px 20px', background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }
          }, 'ثبت نهایی')
    )
  );
           }
