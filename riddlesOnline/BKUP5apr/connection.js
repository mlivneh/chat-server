/**
 * מודול התקשורת עם שרת ה-WebSocket
 * מטפל בחיבור, שליחת הודעות וקבלת עדכונים בזמן אמת
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

// ייצוא המחלקה לשימוש במקומות אחרים
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GameConnection };
}