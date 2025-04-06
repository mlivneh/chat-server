const WebSocket = require('ws');
const server = new WebSocket.Server({ port: process.env.PORT || 3000 });

const rooms = {};

server.on('connection', (socket) => {
  console.log('🔌 New connection established');
  
  socket.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      const { type, room, sender, content } = data;
      
      if (!room) {
        console.error("❌ Room ID is required");
        return;
      }
      
      // יצירת חדר אם לא קיים
      if (!rooms[room]) {
        rooms[room] = { sockets: [], history: [] };
        console.log(`🏠 New room created: ${room}`);
      }
      
      // טיפול בסוגים שונים של הודעות
      switch (type) {
        case 'JOIN':
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
          break;
          
        case 'TEXT':
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
          break;
          
        case 'STATUS':
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
          break;
          
        default:
          console.log(`⚠️ Unknown message type: ${type}`);
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
