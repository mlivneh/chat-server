/**
 * QuizManager - מנהל החידות של האפליקציה
 * אחראי על ניהול החידות, מעקב אחר תשובות תלמידים וחישוב ציונים
 */
class QuizManager {
  /**
   * יוצר מופע חדש של מנהל החידות
   * @param {GameConnection} connection - מופע של מחלקת החיבור
   */
  constructor(connection) {
    this.connection = connection;
    this.currentQuiz = null;
    this.studentAnswers = {};
    this.studentsInRoom = [];
    this.studentScores = {};
  }
  
  /**
   * איתחול מנהל החידות
   */
  initialize() {
    // אתחול רשימת החידות אם מורה
    if (this.connection.isTeacher) {
      this.initializeTeacherView();
    } else {
      this.initializeStudentView();
    }
  }
  
  /**
   * איתחול תצוגת המורה
   */
  initializeTeacherView() {
    const quizSelect = document.getElementById('quiz-select');
    const sendQuizBtn = document.getElementById('send-quiz-btn');
    const endQuizBtn = document.getElementById('end-quiz-btn');
    const previewTitle = document.getElementById('preview-title');
    const previewText = document.getElementById('preview-text');
    const previewAnswers = document.getElementById('preview-answers');
    
    // מילוי הרשימה הנפתחת עם החידות הזמינות
    quizQuestions.forEach(quiz => {
      const option = document.createElement('option');
      option.value = quiz.id;
      option.textContent = `${quiz.id}. ${quiz.title} (${quiz.points} נקודות)`;
      quizSelect.appendChild(option);
    });
    
    // בעת בחירת חידה - הצגת תצוגה מקדימה
    quizSelect.addEventListener('change', () => {
      const selectedId = parseInt(quizSelect.value);
      
      if (!selectedId) {
        document.getElementById('selected-quiz-preview').style.display = 'none';
        sendQuizBtn.disabled = true;
        return;
      }
      
      const selectedQuiz = quizQuestions.find(q => q.id === selectedId);
      
      if (selectedQuiz) {
        // הצגת תצוגה מקדימה של החידה
        previewTitle.textContent = `${selectedQuiz.id}. ${selectedQuiz.title}`;
        previewText.textContent = selectedQuiz.text;
        
        // הצגת התשובות בתצוגה מקדימה
        previewAnswers.innerHTML = '';
        selectedQuiz.answers.forEach(answer => {
          const answerElem = document.createElement('div');
          answerElem.className = 'quiz-answer-group';
          
          // אם יש טקסט שאלה ספציפי
          if (answer.questionText) {
            const questionText = document.createElement('div');
            questionText.textContent = answer.questionText;
            answerElem.appendChild(questionText);
          }
          
          const answerLabel = document.createElement('div');
          answerLabel.innerHTML = `<strong>תשובה:</strong> ${answer.correctAnswer}`;
          answerElem.appendChild(answerLabel);
          
          previewAnswers.appendChild(answerElem);
        });
        
        document.getElementById('selected-quiz-preview').style.display = 'block';
        sendQuizBtn.disabled = false;
      }
    });
    
    // שליחת חידה נבחרת
    sendQuizBtn.addEventListener('click', () => {
      const selectedId = parseInt(quizSelect.value);
      
      if (!selectedId) return;
      
      const selectedQuiz = quizQuestions.find(q => q.id === selectedId);
      
      if (selectedQuiz) {
        try {
          // איפוס תשובות קודמות
          this.studentAnswers = {};
          
          // שליחת החידה
          this.connection.sendQuiz(selectedQuiz);
          
          // עדכון ממשק
          this.currentQuiz = selectedQuiz;
          sendQuizBtn.disabled = true;
          endQuizBtn.disabled = false;
          
          // הוספת הודעת מערכת
          this.addSystemMessage(`החידה "${selectedQuiz.title}" נשלחה לתלמידים`);
          
          // איפוס אזור התשובות
          document.getElementById('student-answers').innerHTML = '<h3>תשובות תלמידים</h3><div class="quiz-status">ממתין לתשובות מהתלמידים...</div>';
        } catch (error) {
          alert('שגיאה בשליחת החידה: ' + error.message);
        }
      }
    });
    
    // סיום חידה נוכחית
    endQuizBtn.addEventListener('click', () => {
      if (this.currentQuiz) {
        try {
          // חישוב תוצאות
          const results = this.calculateResults();
          
          // שליחת סיום החידה
          this.connection.endQuiz(results);
          
          // עדכון ממשק
          sendQuizBtn.disabled = false;
          endQuizBtn.disabled = true;
          
          // הוספת הודעת מערכת
          this.addSystemMessage(`החידה "${this.currentQuiz.title}" הסתיימה`);
          
          // עדכון רשימת התלמידים עם הציונים
          this.updateStudentsList();
          
          // איפוס החידה הנוכחית
          this.currentQuiz = null;
        } catch (error) {
          alert('שגיאה בסיום החידה: ' + error.message);
        }
      }
    });
  }
  
  /**
   * איתחול תצוגת התלמיד
   */
  initializeStudentView() {
    const submitBtn = document.getElementById('submit-answer-btn');
    
    // שליחת תשובה
    submitBtn.addEventListener('click', () => {
      if (!this.currentQuiz) return;
      
      try {
        // איסוף התשובות מהטופס
        const answerForm = document.getElementById('answer-form');
        const formData = new FormData(answerForm);
        
        const answers = [];
        this.currentQuiz.answers.forEach(answer => {
          const value = formData.get(`answer-${answer.id}`);
          answers.push({
            id: answer.id,
            value: value
          });
        });
        
        // שליחת התשובות
        this.connection.sendAnswer({
          quizId: this.currentQuiz.id,
          answers: answers
        });
        
        // עדכון ממשק
        document.getElementById('answer-area').style.display = 'none';
        document.getElementById('result-area').style.display = 'block';
        document.getElementById('result-area').innerHTML = '<div class="quiz-status">תשובתך נשלחה בהצלחה. ממתין לסיום החידה...</div>';
        
        // הוספת הודעת מערכת
        this.addSystemMessage(`שלחת תשובה לחידה "${this.currentQuiz.title}"`);
      } catch (error) {
        alert('שגיאה בשליחת התשובה: ' + error.message);
      }
    });
  }
  
  /**
   * הוספת הודעת מערכת לצ'אט
   * @param {string} message - תוכן ההודעה
   */
  addSystemMessage(message) {
    const messageContainer = document.getElementById('message-container');
    const messageElem = document.createElement('div');
    messageElem.className = 'system-message';
    messageElem.textContent = message;
    messageContainer.appendChild(messageElem);
    messageContainer.scrollTop = messageContainer.scrollHeight;
  }
  
  /**
   * טיפול בקבלת חידה (צד התלמיד)
   * @param {Object} quiz - אובייקט החידה שהתקבל
   */
  handleQuizReceived(quiz) {
    this.currentQuiz = quiz;
    
    // עדכון התצוגה
    const currentQuizElem = document.getElementById('current-quiz');
    const answerAreaElem = document.getElementById('answer-area');
    const resultAreaElem = document.getElementById('result-area');
    
    // איפוס אזורי התצוגה
    resultAreaElem.style.display = 'none';
    
    // הצגת החידה
    currentQuizElem.innerHTML = `
      <div class="quiz-question">
        <div class="quiz-question-title">${quiz.id}. ${quiz.title}</div>
        <div class="quiz-question-text">${quiz.text}</div>
      </div>
    `;
    
    // יצירת טופס התשובות
    let answerForm = `<form id="answer-form">`;
    
    quiz.answers.forEach(answer => {
      answerForm += `<div class="quiz-answer-group">`;
      
      // אם יש טקסט שאלה ספציפי
      if (answer.questionText) {
        answerForm += `<div>${answer.questionText}</div>`;
      }
      
      if (answer.type === 'numerical') {
        answerForm += `<input type="number" step="0.01" name="answer-${answer.id}" required placeholder="הכנס תשובה מספרית" />`;
      } else if (answer.type === 'text') {
        answerForm += `<input type="text" name="answer-${answer.id}" required placeholder="הכנס תשובה" />`;
      }
      
      answerForm += `</div>`;
    });
    
    answerForm += `</form>`;
    
    answerAreaElem.innerHTML = answerForm;
    document.getElementById('submit-answer-btn').disabled = false;
    
    // הצגת האזורים
    currentQuizElem.style.display = 'block';
    answerAreaElem.style.display = 'block';
    
    // איפוס הודעת הסטטוס
    document.querySelector('.quiz-status').style.display = 'none';
    
    // הוספת הודעת מערכת
    this.addSystemMessage(`התקבלה חידה חדשה: "${quiz.title}"`);
  }
  
  /**
   * טיפול בקבלת תשובה מתלמיד (צד המורה)
   * @param {Object} answer - אובייקט התשובה שהתקבל
   * @param {string} studentName - שם התלמיד
   */
  handleAnswerReceived(answer, studentName) {
    if (!this.currentQuiz || this.currentQuiz.id !== answer.quizId) return;
    
    // שמירת התשובה
    this.studentAnswers[studentName] = answer;
    
    // עדכון תצוגת התשובות
    const studentAnswersElem = document.getElementById('student-answers');
    studentAnswersElem.innerHTML = '<h3>תשובות תלמידים</h3>';
    
    let receivedCount = Object.keys(this.studentAnswers).length;
    let totalStudents = this.studentsInRoom.length;
    
    studentAnswersElem.innerHTML += `
      <div class="quiz-status">
        התקבלו ${receivedCount} תשובות מתוך ${totalStudents} תלמידים
      </div>
    `;
    
    // הצגת התשובות שהתקבלו
    for (const [student, studentAnswer] of Object.entries(this.studentAnswers)) {
      const answerElem = document.createElement('div');
      answerElem.className = 'student-answer';
      
      let answerHtml = `<div><strong>${student}</strong></div>`;
      
      studentAnswer.answers.forEach(ans => {
        const correctAnswer = this.currentQuiz.answers.find(a => a.id === ans.id);
        
        if (correctAnswer) {
          const isCorrect = ans.value === correctAnswer.correctAnswer;
          
          answerHtml += `<div class="${isCorrect ? 'correct-answer' : 'incorrect-answer'}">
            ${correctAnswer.questionText ? correctAnswer.questionText + ': ' : ''}
            ${ans.value} ${isCorrect ? '✓' : '✗'}
          </div>`;
        }
      });
      
      answerElem.innerHTML = answerHtml;
      studentAnswersElem.appendChild(answerElem);
    }
    
    // הוספת הודעת מערכת
    this.addSystemMessage(`התקבלה תשובה מ: ${studentName}`);
  }
  
  /**
   * טיפול בסיום חידה (צד התלמיד)
   * @param {Object} result - תוצאות החידה
   */
  handleQuizEnded(result) {
    // עדכון התצוגה
    const resultAreaElem = document.getElementById('result-area');
    resultAreaElem.style.display = 'block';
    
    // הצגת התוצאות
    let resultHtml = '<h3>תוצאות החידה</h3>';
    
    if (result.studentResults && result.studentResults[this.connection.username]) {
      const myResult = result.studentResults[this.connection.username];
      
      resultHtml += `
        <div class="quiz-question">
          <div class="quiz-question-title">ציון: ${myResult.score} מתוך ${myResult.total}</div>
          <div class="quiz-status">
            ענית נכון על ${myResult.correct} שאלות מתוך ${myResult.total}
          </div>
        </div>
      `;
    } else {
      resultHtml += `
        <div class="quiz-question">
          <div class="quiz-status">
            לא נמצאה תשובה שלך לחידה זו
          </div>
        </div>
      `;
    }
    
    resultAreaElem.innerHTML = resultHtml;
    
    // איפוס החידה הנוכחית
    this.currentQuiz = null;
    
    // הצגת הודעת המתנה
    document.querySelector('.quiz-status').style.display = 'block';
    document.querySelector('.quiz-status').textContent = 'ממתין לחידה הבאה...';
    
    // הסתרת אזור החידה
    document.getElementById('current-quiz').style.display = 'none';
    document.getElementById('answer-area').style.display = 'none';
    
    // הוספת הודעת מערכת
    this.addSystemMessage('החידה הסתיימה. הוצגו התוצאות');
  }
  
  /**
   * טיפול בהצטרפות תלמיד חדש (צד המורה)
   * @param {string} studentName - שם התלמיד שהצטרף
   */
  handleStudentJoined(studentName) {
    if (!this.connection.isTeacher) return;
    
    // הוספת התלמיד לרשימה
    if (!this.studentsInRoom.includes(studentName)) {
      this.studentsInRoom.push(studentName);
      
      // אתחול ציון התלמיד
      if (!this.studentScores[studentName]) {
        this.studentScores[studentName] = 0;
      }
    }
    
    // עדכון רשימת התלמידים
    this.updateStudentsList();
  }
  
  /**
   * טיפול בעזיבת תלמיד (צד המורה)
   * @param {string} studentName - שם התלמיד שעזב
   */
  handleStudentLeft(studentName) {
    if (!this.connection.isTeacher) return;
    
    // הסרת התלמיד מהרשימה
    this.studentsInRoom = this.studentsInRoom.filter(s => s !== studentName);
    
    // עדכון רשימת התלמידים
    this.updateStudentsList();
  }
  
  /**
   * עדכון רשימת התלמידים בממשק המורה
   */
  updateStudentsList() {
    if (!this.connection.isTeacher) return;
    
    const studentsListElem = document.getElementById('students-list');
    
    if (this.studentsInRoom.length === 0) {
      studentsListElem.innerHTML = '<div class="student-item">אין תלמידים מחוברים כרגע</div>';
      return;
    }
    
    studentsListElem.innerHTML = `<div><strong>תלמידים מחוברים (${this.studentsInRoom.length}):</strong></div>`;
    
    this.studentsInRoom.forEach(student => {
      const studentElem = document.createElement('div');
      studentElem.className = 'student-item';
      
      studentElem.innerHTML = `
        <span>${student}</span>
        <span class="student-score">ציון: ${this.studentScores[student] || 0}</span>
      `;
      
      studentsListElem.appendChild(studentElem);
    });
  }
  
  /**
   * חישוב תוצאות החידה הנוכחית (צד המורה)
   * @returns {Object} אובייקט תוצאות החידה
   */
  calculateResults() {
    if (!this.currentQuiz || !this.connection.isTeacher) return {};
    
    const results = {
      quizId: this.currentQuiz.id,
      quizTitle: this.currentQuiz.title,
      studentResults: {}
    };
 //================================================   

   // חישוב התוצאות לכל תלמיד
    for (const [student, answer] of Object.entries(this.studentAnswers)) {
      let correct = 0;
      const total = this.currentQuiz.answers.length;
      
      // בדיקת כל תשובה
      answer.answers.forEach(ans => {
        const correctAnswer = this.currentQuiz.answers.find(a => a.id === ans.id);
        
        if (correctAnswer && ans.value === correctAnswer.correctAnswer) {
          correct++;
        }
      });
      
      // חישוב הציון
      const score = Math.round((correct / total) * this.currentQuiz.points);
      
      // עדכון הציון המצטבר
      this.studentScores[student] = (this.studentScores[student] || 0) + score;
      
      // הוספת התוצאה
      results.studentResults[student] = {
        correct,
        total,
        score,
        totalScore: this.studentScores[student]
      };
    }  // סגירת הלולאה
 //==================================================   
    return results;
  }  // סגירת הפונקציה calculateResults
}  // סגירת מחלקת QuizManager
	