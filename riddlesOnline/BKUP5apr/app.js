
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