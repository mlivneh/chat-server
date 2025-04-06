/**
 * מודול הטיפול בסוגים שונים של הודעות
 * נועד לאפשר הרחבה ושינוי של לוגיקת הטיפול בהודעות מבלי לשנות את קוד השרת העיקרי
 */

// שימוש ב-WebSocket מהמודול המרכזי
const WebSocket = require('ws');

/**
 * מטפל בהודעת הצטרפות לחדר
 */
function handleJoin(socket, data, rooms) {
  const { room, sender } = data;
  
  // הצטרפות לחדר
  socket.room = room;
  socket.username = sender || 'אנונימי';
  rooms[room].sockets.push(socket);
  
  console.log(`👤 ${socket.username} joined room "${room}"`);
  
  // שליחת הודעת מערכת לכולם
  const joinMessage = {
    type: 'TEXT',
    sender: 'מערכת',
    content: `${socket.username} הצטרף/ה לחדר`
  };
  
  // שמירת ההודעה בהיסטוריה
  rooms[room].history.push(joinMessage);
  
  // שליחה לכולם
  rooms[room].sockets.forEach(s => {
    if (s.readyState === WebSocket.OPEN) {
      s.send(JSON.stringify(joinMessage));
    }
  });
  
  // שליחת היסטוריה
  if (rooms[room].history.length > 0) {
    // שליחת עד 10 הודעות אחרונות בלבד
    const recentHistory = rooms[room].history.slice(-10);
    socket.send(JSON.stringify({
      type: 'HISTORY',
      content: recentHistory
    }));
  }
}

/**
 * מטפל בהודעת טקסט
 */
function handleText(socket, data, rooms) {
  const { room, sender, content } = data;
  
  // וידוא תוכן תקין
  if (!content) {
    console.error("❌ Message content is empty");
    return;
  }
  
  // יצירת אובייקט ההודעה
  const textMessage = {
    type: 'TEXT',
    sender: socket.username || sender || 'אנונימי',
    content: content
  };
  
  // שמירה בהיסטוריה (עד 50 הודעות אחרונות)
  rooms[room].history.push(textMessage);
  if (rooms[room].history.length > 50) {
    rooms[room].history.shift();
  }
  
  // שליחה לכולם
  rooms[room].sockets.forEach(s => {
    if (s.readyState === WebSocket.OPEN) {
      s.send(JSON.stringify(textMessage));
    }
  });
  
  console.log(`💬 Text message in room ${room} from ${textMessage.sender}`);
}

/**
 * מטפל בהודעת סטטוס
 */
function handleStatus(socket, data, rooms) {
  const { room, sender, content } = data;
  
  // שליחת סטטוס משחק לכולם חוץ מהשולח
  const statusMessage = {
    type: 'STATUS',
    sender: socket.username || sender || 'אנונימי',
    content: content
  };
  
  rooms[room].sockets.forEach(s => {
    if (s !== socket && s.readyState === WebSocket.OPEN) {
      s.send(JSON.stringify(statusMessage));
    }
  });
  
  console.log(`🎮 Game status update in room ${room} from ${statusMessage.sender}`);
}

/**
 * מטפל בכל סוגי ההודעות האחרים באופן גנרי
 */
function handleGeneric(socket, data, rooms) {
  const { type, room, sender, content } = data;
  
  // יצירת אובייקט ההודעה
  const message = {
    type: type,
    sender: socket.username || sender || 'אנונימי',
    content: content
  };
  
  // שליחה לכולם
  rooms[room].sockets.forEach(s => {
    if (s.readyState === WebSocket.OPEN) {
      s.send(JSON.stringify(message));
    }
  });
  
  console.log(`🔄 Message type ${type} in room ${room} from ${message.sender}`);
}

// ייצוא המטפלים
module.exports = {
  JOIN: handleJoin,
  TEXT: handleText,
  STATUS: handleStatus,
  
  // מטפלים ספציפיים לחידות
  QUIZ: handleGeneric,
  ANSWER: handleGeneric,
  END_QUIZ: handleGeneric,
  STUDENT_JOINED: handleGeneric,
  STUDENT_LEFT: handleGeneric,
  
  // מטפל כללי להודעות מסוגים לא ידועים
  generic: handleGeneric
};