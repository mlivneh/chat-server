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
      
      console.log('התחברות עם נתונים:');
      console.log('- שם משתמש:', username);
      console.log('- חדר:', room);
      console.log('- האם מורה:', isTeacher);
      
      // סגירת חיבור קודם אם קיים
      if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
        this.socket.close();
      }
      
      try {
        console.log('מתחבר לשרת:', this.serverUrl);
        this.socket = new WebSocket(this.serverUrl);
        
        // טיימאאוט להתעוררות השרת
        const wakeupTimeout = setTimeout(() => {
          if (!this.connected) {
            this.serverWakingUp = true;
            console.log('השרת בתהליך התעוררות');
            if (this.listeners.onStatusUpdate) {
              this.listeners.onStatusUpdate('waking-up');
            }
          }
        }, 3000);
        
        this.socket.onopen = () => {
          clearTimeout(wakeupTimeout);
          this.connected = true;
          this.serverWakingUp = false;
          console.log('חיבור WebSocket נפתח בהצלחה');
          
          // שליחת הודעת הצטרפות לחדר
          const joinMessage = {
            type: 'JOIN',
            room: this.room,
            sender: this.username,
            isTeacher: this.isTeacher  // סימון אם זה המורה
          };
          
          console.log('שולח הודעת הצטרפות:', joinMessage);
          this.socket.send(JSON.stringify(joinMessage));
          
          if (this.listeners.onConnect) {
            this.listeners.onConnect();
          }
          
          resolve();
        };
        
        this.socket.onclose = () => {
          clearTimeout(wakeupTimeout);
          this.connected = false;
          console.log('חיבור WebSocket נסגר');
          
          if (this.listeners.onDisconnect) {
            this.listeners.onDisconnect();
          }
        };
        
        this.socket.onerror = (error) => {
          clearTimeout(wakeupTimeout);
          console.error('שגיאת WebSocket:', error);
          
          if (this.listeners.onError) {
            this.listeners.onError(error);
          }
          
          reject(error);
        };
 //==========================================================================================       
this.socket.onmessage = (event) => {
          try {
            const rawData = event.data;
            console.log('*** התקבלה הודעה גולמית:', rawData);
            
            const data = JSON.parse(rawData);
            console.log('*** הודעה אחרי פענוח JSON:', data);
            console.log('*** סוג ההודעה:', data.type);
            
            // הדפסת כל השדות בהודעה
            Object.keys(data).forEach(key => {
              console.log(`*** שדה ${key}:`, data[key]);
            });
            
            // טיפול בסוגי ההודעות השונים
            switch (data.type) {
              case 'TEXT':
                console.log('*** זוהתה כהודעת טקסט');
                if (this.listeners.onTextMessage) {
                  this.listeners.onTextMessage(data);
                }
                break;
                
              case 'STATUS':
                console.log('*** זוהתה כעדכון סטטוס');
                if (this.listeners.onStatusUpdate) {
                  this.listeners.onStatusUpdate(data.content);
                }
                break;
                
              case 'HISTORY':
                console.log('*** זוהתה כהיסטוריית הודעות');
                if (this.listeners.onHistory) {
                  this.listeners.onHistory(data.content);
                }
                break;
                
              case 'QUIZ':
                console.log('*** זוהתה כחידה');
                if (this.listeners.onQuizReceived) {
                  console.log('*** מפעיל מאזין onQuizReceived');
                  console.log('*** תוכן החידה:', data.content);
                  this.listeners.onQuizReceived(data.content);
                } else {
                  console.error('*** אין מאזין רשום עבור onQuizReceived!');
                }
                break;
                
              case 'ANSWER':
                console.log('*** זוהתה כתשובה');
                if (this.listeners.onAnswerReceived) {
                  this.listeners.onAnswerReceived(data.content, data.sender);
                }
                break;
                
              case 'END_QUIZ':
                console.log('*** זוהתה כסיום חידה');
                if (this.listeners.onQuizEnded) {
                  this.listeners.onQuizEnded(data.content);
                }
                break;
                
              case 'STUDENT_JOINED':
                console.log('*** זוהתה כהצטרפות תלמיד');
                if (this.listeners.onStudentJoined) {
                  this.listeners.onStudentJoined(data.content);
                }
                break;
                
              case 'STUDENT_LEFT':
                console.log('*** זוהתה כעזיבת תלמיד');
                if (this.listeners.onStudentLeft) {
                  this.listeners.onStudentLeft(data.content);
                }
                break;
              
              default:
                console.log(`*** סוג הודעה לא מוכר: ${data.type}`);
                break;
            }
          } catch (error) {
            console.error('*** שגיאה בפענוח הודעה:', error, 'הודעה מקורית:', event.data);
          }
        };   
      } catch (error) {
        console.error('שגיאה ביצירת חיבור WebSocket:', error);
        reject(error);
      }
    });
  }
  //============================================================
  /**
   * שליחת הודעת טקסט לחדר
   * @param {string} text - תוכן הטקסט
   */
  sendTextMessage(text) {
    if (!this.connected || !this.socket) {
      throw new Error('לא מחובר לשרת');
    }
    
    const message = {
      type: 'TEXT',
      room: this.room,
      sender: this.username,
      content: text
    };
    
    console.log('שולח הודעת טקסט:', text);
    this.socket.send(JSON.stringify(message));
  }
  
  /**
   * שליחת עדכון סטטוס משחק לכל המשתתפים בחדר
   * @param {any} statusData - מידע סטטוס לשליחה
   */
  sendGameStatus(statusData) {
    if (!this.connected || !this.socket) {
      throw new Error('לא מחובר לשרת');
    }
    
    const message = {
      type: 'STATUS',
      room: this.room,
      sender: this.username,
      content: statusData
    };
    
    console.log('שולח עדכון סטטוס:', statusData);
    this.socket.send(JSON.stringify(message));
  }
  
  /**
   * שליחת חידה לתלמידים
   * @param {Object} quiz - אובייקט החידה
   */
  sendQuiz(quiz) {
    console.log('שליחת חידה במודול חיבור:');
    console.log('- האם מחובר?', this.connected);
    console.log('- האם יש socket?', !!this.socket);
    console.log('- האם משתמש מורה?', this.isTeacher);
    
    if (!this.connected || !this.socket) {
      throw new Error('לא מחובר לשרת');
    }
    
    if (!this.isTeacher) {
      throw new Error('רק המורה יכול לשלוח חידות');
    }
    
    const message = {
      type: 'QUIZ',
      room: this.room,
      sender: this.username,
      content: quiz
    };
    
    console.log('שולח הודעת חידה לשרת:', message);
    this.socket.send(JSON.stringify(message));
    
    if (this.listeners.onQuizSent) {
      this.listeners.onQuizSent(quiz);
    }
  }
  
  /**
   * שליחת תשובה לחידה
   * @param {Object} answer - אובייקט התשובה
   */
  sendAnswer(answer) {
    console.log('שליחת תשובה במודול חיבור:');
    console.log('- האם מחובר?', this.connected);
    console.log('- האם יש socket?', !!this.socket);
    console.log('- האם משתמש מורה?', this.isTeacher);
    
    if (!this.connected || !this.socket) {
      throw new Error('לא מחובר לשרת');
    }
    
    if (this.isTeacher) {
      throw new Error('רק תלמיד יכול לשלוח תשובות');
    }
    
    const message = {
      type: 'ANSWER',
      room: this.room,
      sender: this.username,
      content: answer
    };
    
    console.log('שולח תשובה לשרת:', message);
    this.socket.send(JSON.stringify(message));
  }
  
  /**
   * סיום חידה נוכחית
   * @param {Object} result - תוצאות החידה
   */
  endQuiz(result) {
    console.log('סיום חידה במודול חיבור:');
    console.log('- האם מחובר?', this.connected);
    console.log('- האם יש socket?', !!this.socket);
    console.log('- האם משתמש מורה?', this.isTeacher);
    
    if (!this.connected || !this.socket) {
      throw new Error('לא מחובר לשרת');
    }
    
    if (!this.isTeacher) {
      throw new Error('רק המורה יכול לסיים חידה');
    }
    
    const message = {
      type: 'END_QUIZ',
      room: this.room,
      sender: this.username,
      content: result
    };
    
    console.log('שולח הודעת סיום חידה לשרת:', message);
    this.socket.send(JSON.stringify(message));
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