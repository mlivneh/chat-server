/**
 * אפליקציית חידות כיתתית
 * מאפשרת למורה לשלוח חידות לתלמידים ולנהל את המשחק
 */

/**
 * GameConnection - מודול תקשורת WebSocket
 * מאפשר תקשורת בין המורה לתלמידים
 */
class GameConnection {
  /**
   * יצירת חיבור חדש
   * @param {string} serverUrl - כתובת שרת ה-WebSocket
   */
  constructor(serverUrl) {
    this.socket = null;
    this.serverUrl = serverUrl;
    this.room = '';
    this.username = '';
    this.connected = false;
    this.isTeacher = false;  // האם משתמש זה הוא המורה
    
    // מאזינים לאירועים
    this.listeners = {
      onConnect: null,      // בעת התחברות
      onDisconnect: null,   // בעת ניתוק
      onError: null,        // בעת שגיאה
      onTextMessage: null,  // בעת קבלת הודעת טקסט
      onStatusUpdate: null, // בעת קבלת עדכון סטטוס
      onHistory: null,      // בעת קבלת היסטוריה
      onQuizSent: null,     // בעת שליחת חידה למורה
      onQuizReceived: null, // בעת קבלת חידה לתלמיד
      onAnswerReceived: null,// בעת קבלת תשובה מתלמיד
      onQuizEnded: null,    // בעת סיום חידה
      onStudentJoined: null,// בעת הצטרפות תלמיד לחדר
      onStudentLeft: null   // בעת עזיבת תלמיד את החדר
    };
    
    // אינדיקטור האם השרת בתהליך התעוררות
    this.serverWakingUp = false;
  }
  
  /**
   * התחברות לשרת והצטרפות לחדר
   * @param {string} username - שם המשתמש
   * @param {string} room - מזהה החדר
   * @param {boolean} isTeacher - האם המשתמש הוא מורה
   * @returns {Promise} הבטחה שמתממשת בעת התחברות
   */
  connect(username, room, isTeacher = false) {
    return new Promise((resolve, reject) => {
      if (!username || !room) {
        reject(new Error('שם משתמש וחדר הם שדות חובה'));
        return;
      }
      
      this.room = room;
      this.username = username;
      this.isTeacher = isTeacher;
      this.serverWakingUp = false;
      
      // סגירת חיבור קודם אם קיים
      if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
        this.socket.close();
      }
      
      try {
        this.socket = new WebSocket(this.serverUrl);
        
        // טיימאאוט להתעוררות השרת
        const wakeupTimeout = setTimeout(() => {
          if (!this.connected) {
            this.serverWakingUp = true;
            if (this.listeners.onStatusUpdate) {
              this.listeners.onStatusUpdate('waking-up');
            }
          }
        }, 3000);
        
        this.socket.onopen = () => {
          clearTimeout(wakeupTimeout);
          this.connected = true;
          this.serverWakingUp = false;
          
          // שליחת הודעת הצטרפות לחדר
          this.socket.send(JSON.stringify({
            type: 'JOIN',
            room: this.room,
            sender: this.username,
            isTeacher: this.isTeacher  // סימון אם זה המורה
          }));
          
          if (this.listeners.onConnect) {
            this.listeners.onConnect();
          }
          
          resolve();
        };
        
        this.socket.onclose = () => {
          clearTimeout(wakeupTimeout);
          this.connected = false;
          
          if (this.listeners.onDisconnect) {
            this.listeners.onDisconnect();
          }
        };
        
        this.socket.onerror = (error) => {
          clearTimeout(wakeupTimeout);
          
          if (this.listeners.onError) {
            this.listeners.onError(error);
          }
          
          reject(error);
        };
        
        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // טיפול בסוגי ההודעות השונים
            switch (data.type) {
              case 'TEXT':
                if (this.listeners.onTextMessage) {
                  this.listeners.onTextMessage(data);
                }
                break;
                
              case 'STATUS':
                if (this.listeners.onStatusUpdate) {
                  this.listeners.onStatusUpdate(data);
                }
                break;
                
              case 'HISTORY':
                if (this.listeners.onHistory) {
                  this.listeners.onHistory(data.content);
                }
                break;
                
              case 'QUIZ':
                if (this.listeners.onQuizReceived) {
                  this.listeners.onQuizReceived(data.content);
                }
                break;
                
              case 'ANSWER':
                if (this.listeners.onAnswerReceived) {
                  this.listeners.onAnswerReceived(data.content, data.sender);
                }
                break;
                
              case 'END_QUIZ':
                if (this.listeners.onQuizEnded) {
                  this.listeners.onQuizEnded(data.content);
                }
                break;
                
              case 'STUDENT_JOINED':
                if (this.listeners.onStudentJoined) {
                  this.listeners.onStudentJoined(data.content);
                }
                break;
                
              case 'STUDENT_LEFT':
                if (this.listeners.onStudentLeft) {
                  this.listeners.onStudentLeft(data.content);
                }
                break;
            }
          } catch (error) {
            console.error('שגיאה בפענוח הודעה:', error);
          }
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * שליחת הודעת טקסט לחדר
   * @param {string} text - תוכן הטקסט
   */
  sendTextMessage(text) {
    if (!this.connected || !this.socket) {
      throw new Error('לא מחובר לשרת');
    }
    
    this.socket.send(JSON.stringify({
      type: 'TEXT',
      room: this.room,
      sender: this.username,
      content: text
    }));
  }
  
  /**
   * שליחת עדכון סטטוס משחק לכל המשתתפים בחדר
   * @param {any} statusData - מידע סטטוס לשליחה
   */
  sendGameStatus(statusData) {
    if (!this.connected || !this.socket) {
      throw new Error('לא מחובר לשרת');
    }
    
    this.socket.send(JSON.stringify({
      type: 'STATUS',
      room: this.room,
      sender: this.username,
      content: statusData
    }));
  }
  
  /**
   * שליחת חידה לתלמידים
   * @param {Object} quiz - אובייקט החידה
   */
  sendQuiz(quiz) {
    if (!this.connected || !this.socket || !this.isTeacher) {
      throw new Error('רק המורה יכול לשלוח חידות');
    }
    
    this.socket.send(JSON.stringify({
      type: 'QUIZ',
      room: this.room,
      sender: this.username,
      content: quiz
    }));
    
    if (this.listeners.onQuizSent) {
      this.listeners.onQuizSent(quiz);
    }
  }
  
  /**
   * שליחת תשובה לחידה
   * @param {Object} answer - אובייקט התשובה
   */
  sendAnswer(answer) {
    if (!this.connected || !this.socket || this.isTeacher) {
      throw new Error('רק תלמיד יכול לשלוח תשובות');
    }
    
    this.socket.send(JSON.stringify({
      type: 'ANSWER',
      room: this.room,
      sender: this.username,
      content: answer
    }));
  }
  
  /**
   * סיום חידה נוכחית
   * @param {Object} result - תוצאות החידה
   */
  endQuiz(result) {
    if (!this.connected || !this.socket || !this.isTeacher) {
      throw new Error('רק המורה יכול לסיים חידה');
    }
    
    this.socket.send(JSON.stringify({
      type: 'END_QUIZ',
      room: this.room,
      sender: this.username,
      content: result
    }));
  }
  
  /**
   * ניתוק מהשרת
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
    }
    
    this.connected = false;
  }
  
  /**
   * הגדרת מאזין לאירוע
   * @param {string} event - סוג האירוע
   * @param {Function} callback - פונקציית קולבק
   */
  on(event, callback) {
    if (this.listeners.hasOwnProperty(event)) {
      this.listeners[event] = callback;
    } else {
      console.warn(`אירוע לא מוכר: ${event}`);
    }
  }
}

/**
 * QuizManager - מנהל החידות של האפליקציה
 */
class QuizManager {
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
    }
    
    return results;
  }
}

// אתחול האפליקציה בטעינת המסמך
document.addEventListener('DOMContentLoaded', function() {
  // אלמנטים בממשק
  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('username');
  const roomInput = document.getElementById('room');
  const connectBtn = document.getElementById('connect-btn');
  const statusDiv = document.getElementById('status');
  const spinnerDiv = document.getElementById('spinner');
  const userArea = document.getElementById('user-area');
  const quizArea = document.getElementById('quiz-area');
  const chatArea = document.getElementById('chat-area');
  const messageContainer = document.getElementById('message-container');
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const roleDisplay = document.getElementById('role-display');
  const teacherView = document.getElementById('teacher-view');
  const studentView = document.getElementById('student-view');
  const teacherRole = document.getElementById('teacher-role');
  const studentRole = document.getElementById('student-role');
  const teacherPasswordGroup = document.getElementById('teacher-password-group');
  
  // הצגת/הסתרת שדה סיסמת מורה בהתאם לבחירה
  teacherRole.addEventListener('change', function() {
    teacherPasswordGroup.style.display = 'block';
  });

  studentRole.addEventListener('change', function() {
    teacherPasswordGroup.style.display = 'none';
  });
  
  // יצירת חיבור לשרת
  const connection = new GameConnection('wss://chat-server-kqi4.onrender.com');
  
  // יצירת מנהל החידות
  const quizManager = new QuizManager(connection);
  
  // הוספת הודעה לממשק
  function addMessage(message, isSystem = false) {
    if (isSystem) {
      const messageElem = document.createElement('div');
      messageElem.className = 'system-message';
      messageElem.textContent = message;
      messageContainer.appendChild(messageElem);
    } else {
      const messageRow = document.createElement('div');
      messageRow.className = 'message-row';
      
      const messageElem = document.createElement('div');
      messageElem.className = message.sender === connection.username ? 'message my-message' : 'message other-message';
      
      if (message.sender !== connection.username) {
        const senderElem = document.createElement('span');
        senderElem.className = 'sender-name';
        senderElem.textContent = message.sender;
        messageElem.appendChild(senderElem);
      }
      
      const contentElem = document.createElement('div');
      contentElem.textContent = message.content;
      messageElem.appendChild(contentElem);
      
      messageRow.appendChild(messageElem);
      messageContainer.appendChild(messageRow);
    }
    
    // גלילה לתחתית
    messageContainer.scrollTop = messageContainer.scrollHeight;
  }
  
  // מאזינים לאירועי החיבור
  connection.on('onConnect', () => {
    statusDiv.textContent = '✅ מחובר לשרת';
    statusDiv.className = 'status-connected';
    spinnerDiv.style.display = 'none';
    loginForm.style.display = 'none';
    userArea.style.display = 'block';
    
    // הצגת תפקיד
    if (connection.isTeacher) {
      roleDisplay.textContent = 'תפקיד: מורה';
      roleDisplay.className = 'role-indicator role-teacher';
      teacherView.style.display = 'block';
      studentView.style.display = 'none';
    } else {
      roleDisplay.textContent = 'תפקיד: תלמיד';
      roleDisplay.className = 'role-indicator role-student';
      teacherView.style.display = 'none';
      studentView.style.display = 'block';
    }
    
    // הצגת אזור החידות
    quizArea.style.display = 'block';
    chatArea.style.display = 'block';
    
    // אתחול מנהל החידות
    quizManager.initialize();
    
    addMessage('התחברת לחדר בהצלחה!', true);
  });
  
  connection.on('onDisconnect', () => {
    statusDiv.textContent = '❌ נותקת מהשרת';
    statusDiv.className = 'status-error';
    loginForm.style.display = 'block';
    userArea.style.display = 'none';
  });
  
  connection.on('onError', (error) => {
    statusDiv.textContent = '❌ שגיאה בהתחברות';
    statusDiv.className = 'status-error';
    spinnerDiv.style.display = 'none';
    console.error('שגיאת חיבור:', error);
  });
  
  connection.on('onStatusUpdate', (data) => {
    if (data === 'waking-up') {
      // השרת בתהליך התעוררות
      spinnerDiv.style.display = 'flex';
      return;
    }
  });
  
  connection.on('onTextMessage', (message) => {
    addMessage(message);
  });
  
  connection.on('onHistory', (messages) => {
    // הוספת היסטוריית הודעות
    addMessage('היסטוריית הודעות:', true);
    messages.forEach(message => {
      addMessage(message);
    });
    addMessage('סוף היסטוריה', true);
  });
  
  // מאזינים לאירועי משחק
  connection.on('onQuizReceived', (quiz) => {
    quizManager.handleQuizReceived(quiz);
  });
  
  connection.on('onAnswerReceived', (answer, studentName) => {
    quizManager.handleAnswerReceived(answer, studentName);
  });
  
  connection.on('onQuizEnded', (result) => {
    quizManager.handleQuizEnded(result);
  });
  
  connection.on('onStudentJoined', (studentName) => {
    quizManager.handleStudentJoined(studentName);
    addMessage(`${studentName} הצטרף/ה לחדר החידות`, true);
  });
  
  connection.on('onStudentLeft', (studentName) => {
    quizManager.handleStudentLeft(studentName);
    addMessage(`${studentName} עזב/ה את חדר החידות`, true);
  });
  
  // כפתור התחברות
  connectBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const room = roomInput.value.trim();
    const isTeacher = document.querySelector('input[name="role"]:checked').value === 'teacher';
    
    if (!username || !room) {
      alert('נא להזין שם משתמש ושם חדר');
      return;
    }
    
    // בדיקת סיסמת מורה אם נבחר תפקיד מורה
    if (isTeacher) {
      const password = document.getElementById('teacher-password').value.trim();
      
      // חישוב הסיסמה הנכונה (התאריך + 10)
      const today = new Date();
      const day = today.getDate(); // מספר היום בחודש (1-31)
      const correctPassword = String(day + 10); // התאריך + 10 כמחרוזת
      
      if (password !== correctPassword) {
        alert('סיסמת מורה שגויה!');
        return;
      }
    }
    
    statusDiv.textContent = 'מתחבר לשרת...';
    statusDiv.className = 'status-connecting';
    
    // מתחברים לחדר עם תפקיד מוגדר מראש
    connection.connect(username, room, isTeacher)
      .catch(error => {
        console.error('שגיאה בהתחברות:', error);
        statusDiv.textContent = 'שגיאה בהתחברות';
        statusDiv.className = 'status-error';
      });
  });
  
  // שליחת הודעה
  function sendMessage() {
    const text = messageInput.value.trim();
    if (text) {
      try {
        connection.sendTextMessage(text);
        messageInput.value = '';
      } catch (error) {
        alert('שגיאה בשליחת ההודעה: ' + error.message);
      }
    }
  }
  
  // כפתור שליחת הודעה
  sendBtn.addEventListener('click', sendMessage);
  
  // שליחה בלחיצה על Enter
  messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });
});