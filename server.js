/**
 * שרת WebSocket עם תמיכה מורחבת בסוגי הודעות
 * משתמש במודול handlers.js לטיפול בסוגי ההודעות השונים
 */
const WebSocket = require('ws');
const handlers = require('./handlers');

const server = new WebSocket.Server({ port: process.env.PORT || 3000 });
const rooms = {};

server.on('connection', (socket) => {
  console.log('🔌 New connection established');
  
  socket.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      const { type, room } = data;
      
      if (!room) {
        console.error("❌ Room ID is required");
        return;
      }
      
      // יצירת חדר אם לא קיים
      if (!rooms[room]) {
        rooms[room] = { sockets: [], history: [] };
        console.log(`🏠 New room created: ${room}`);
      }
      
      // טיפול בהודעה לפי סוג
      if (handlers[type]) {
        // אם קיים מטפל ספציפי לסוג זה, השתמש בו
        handlers[type](socket, data, rooms);
      } else {
        // אחרת, השתמש במטפל הגנרי
        handlers.generic(socket, data, rooms);
      }
    } catch (e) {
      console.error("❌ Error processing message:", e.message);
      console.error("Raw message:", msg.toString());
    }
  });
  
  socket.on('close', () => {
    const room = socket.room;
    const username = socket.username || 'אנונימי';
    
    if (room && rooms[room]) {
      // הסרת השחקן מהחדר
      rooms[room].sockets = rooms[room].sockets.filter(s => s !== socket);
      
      // הודעה על עזיבה
      const leaveMessage = {
        type: 'TEXT',
        sender: 'מערכת',
        content: `${username} עזב/ה את החדר`
      };
      
      // שמירת ההודעה בהיסטוריה
      rooms[room].history.push(leaveMessage);
      
      // שליחה לכולם
      rooms[room].sockets.forEach(s => {
        if (s.readyState === WebSocket.OPEN) {
          s.send(JSON.stringify(leaveMessage));
        }
      });
      
      console.log(`👤 ${username} left room "${room}"`);
      
      // מחיקת חדרים ריקים
      if (rooms[room].sockets.length === 0) {
        delete rooms[room];
        console.log(`🏠 Room "${room}" was deleted (empty)`);
      }
    }
  });
  
  // טיפול בשגיאות
  socket.on('error', (error) => {
    console.error(`❌ WebSocket Error: ${error.message}`);
  });
});

console.log(`WebSocket server is running on port ${process.env.PORT || 3000}`);
console.log(`Supported message types: ${Object.keys(handlers).join(', ')}`);
