/**
 * אפליקציית חידות כיתתית
 * מאפשרת למורה לשלוח חידות לתלמידים ולנהל את המשחק
 */

// אתחול האפליקציה בטעינת המסמך
document.addEventListener('DOMContentLoaded', function() {
  console.log('יישום החידות נטען בהצלחה');
  
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
  const teacherPasswordGroup = document.getElementById('teacher-password-group');
  
  // מצב התפקיד הנוכחי (תלמיד כברירת מחדל)
  let currentRole = 'student';
  
  // בניית בורר תפקידים ידני
  const roleSelector = document.querySelector('.role-selector');
  if (roleSelector) {
    // מנקים את הבורר הישן
    roleSelector.innerHTML = '';
    
    // יוצרים אפשרות מורה
    const teacherOption = document.createElement('div');
    teacherOption.className = 'role-option';
    teacherOption.innerHTML = '<label><input type="radio" name="role" value="teacher" id="teacher-role"> מורה</label>';
    roleSelector.appendChild(teacherOption);
    
    // יוצרים אפשרות תלמיד
    const studentOption = document.createElement('div');
    studentOption.className = 'role-option';
    studentOption.innerHTML = '<label><input type="radio" name="role" value="student" id="student-role" checked> תלמיד</label>';
    roleSelector.appendChild(studentOption);
    
    // מאתחלים מחדש את הפניות
    const teacherRadio = document.getElementById('teacher-role');
    const studentRadio = document.getElementById('student-role');
    
    // מאזינים לשינויים
    teacherRadio.addEventListener('change', function() {
      if (this.checked) {
        currentRole = 'teacher';
        teacherPasswordGroup.style.display = 'block';
        console.log('תפקיד שנבחר: מורה');
      }
    });
    
    studentRadio.addEventListener('change', function() {
      if (this.checked) {
        currentRole = 'student';
        teacherPasswordGroup.style.display = 'none';
        console.log('תפקיד שנבחר: תלמיד');
      }
    });
  }
  
  // יצירת חיבור לשרת
  const connection = new GameConnection('wss://chat-server-kqi4.onrender.com');
  console.log('נוצר חיבור לשרת');
  
  // יצירת מנהל החידות
  const quizManager = new QuizManager(connection);
  console.log('נוצר מנהל חידות');
  
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
    console.log('מחובר לשרת');
    statusDiv.textContent = '✅ מחובר לשרת';
    statusDiv.className = 'status-connected';
    spinnerDiv.style.display = 'none';
    loginForm.style.display = 'none';
    userArea.style.display = 'block';
    
    // הצגת תפקיד
    if (connection.isTeacher) {
      console.log('מחובר כמורה');
      roleDisplay.textContent = 'תפקיד: מורה';
      roleDisplay.className = 'role-indicator role-teacher';
      teacherView.style.display = 'block';
      studentView.style.display = 'none';
    } else {
      console.log('מחובר כתלמיד');
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
    console.log('נותק מהשרת');
    statusDiv.textContent = '❌ נותקת מהשרת';
    statusDiv.className = 'status-error';
    loginForm.style.display = 'block';
    userArea.style.display = 'none';
  });
  
  connection.on('onError', (error) => {
    console.log('שגיאת חיבור:', error);
    statusDiv.textContent = '❌ שגיאה בהתחברות';
    statusDiv.className = 'status-error';
    spinnerDiv.style.display = 'none';
    console.error('שגיאת חיבור:', error);
  });
  
  connection.on('onStatusUpdate', (data) => {
    console.log('עדכון סטטוס:', data);
    if (data === 'waking-up') {
      // השרת בתהליך התעוררות
      spinnerDiv.style.display = 'flex';
      return;
    }
  });
  
  connection.on('onTextMessage', (message) => {
    console.log('התקבלה הודעת טקסט:', message);
    addMessage(message);
  });
  
  connection.on('onHistory', (messages) => {
    console.log('התקבלה היסטוריית הודעות');
    // הוספת היסטוריית הודעות
    addMessage('היסטוריית הודעות:', true);
    messages.forEach(message => {
      addMessage(message);
    });
    addMessage('סוף היסטוריה', true);
  });
  
  // מאזינים לאירועי משחק
  connection.on('onQuizReceived', (quiz) => {
    console.log('התקבלה חידה:', quiz);
    quizManager.handleQuizReceived(quiz);
  });
  
  connection.on('onAnswerReceived', (answer, studentName) => {
    console.log('התקבלה תשובה מתלמיד:', studentName, answer);
    quizManager.handleAnswerReceived(answer, studentName);
  });
  
  connection.on('onQuizEnded', (result) => {
    console.log('החידה הסתיימה:', result);
    quizManager.handleQuizEnded(result);
  });
  
  connection.on('onStudentJoined', (studentName) => {
    console.log('תלמיד הצטרף:', studentName);
    quizManager.handleStudentJoined(studentName);
    addMessage(`${studentName} הצטרף/ה לחדר החידות`, true);
  });
  
  connection.on('onStudentLeft', (studentName) => {
    console.log('תלמיד עזב:', studentName);
    quizManager.handleStudentLeft(studentName);
    addMessage(`${studentName} עזב/ה את חדר החידות`, true);
  });
  
  // כפתור התחברות - קוד מעודכן
  connectBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const room = roomInput.value.trim();
    const isTeacher = currentRole === 'teacher';
    
    console.log('מנסה להתחבר:');
    console.log('- שם משתמש:', username);
    console.log('- חדר:', room);
    console.log('- תפקיד:', currentRole, '(isTeacher =', isTeacher, ')');
    
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
      
      console.log('סיסמת מורה:', password, 'הסיסמה הנכונה:', correctPassword);
      
      if (password !== correctPassword) {
        alert('סיסמת מורה שגויה!\nהסיסמה הנכונה: ' + correctPassword);
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