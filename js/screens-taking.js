/* ---------------------------------------------------------
   آزمون‌ساز معلم — صفحه آزمون دانش‌آموز
   © ghobeishawi - All rights reserved.
---------------------------------------------------------- */

import { useState, useEffect } from 'react';

export function TakeExamScreen({ examId, studentId }) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [currentExam, setCurrentExam] = useState(null);
  const [currentQuestions, setCurrentQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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

  useEffect(() => {
    if (timeRemaining <= 0) {
      handleSubmit();
      return;
    }
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => prev - 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeRemaining]);

  useEffect(() => {
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

  if (isLoading) return <div>در حال بارگذاری آزمون...</div>;
  if (error) return <div>خطا: {error}</div>;
  if (currentQuestions.length === 0) return <div>سوالی یافت نشد!</div>;

  const currentQuestion = currentQuestions[currentQuestionIndex];
  const options = typeof currentQuestion.options === "string" 
    ? JSON.parse(currentQuestion.options) 
    : currentQuestion.options;

  return (
    <div className="exam-container">
      <div className="timer">زمان باقی‌مانده: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</div>
      
      <div className="question-card">
        <h3>سوال {currentQuestionIndex + 1} از {currentQuestions.length}</h3>
        <p className="question-text">{currentQuestion.question_text}</p>
        
        <div className="options">
          {options.map((option, index) => (
            <div 
              key={index}
              className={`option ${answers[currentQuestion.id] === index ? 'selected' : ''}`}
              onClick={() => handleAnswer(currentQuestion.id, index)}
            >
              {option}
            </div>
          ))}
        </div>
      </div>

      <div className="nav-buttons">
        {currentQuestionIndex > 0 && (
          <button onClick={() => setCurrentQuestionIndex(prev => prev - 1)}>قبلی</button>
        )}
        {currentQuestionIndex < currentQuestions.length - 1 ? (
          <button onClick={() => setCurrentQuestionIndex(prev => prev + 1)}>بعدی</button>
        ) : (
          <button onClick={handleSubmit}>ثبت نهایی</button>
        )}
      </div>
    </div>
  );
         }
