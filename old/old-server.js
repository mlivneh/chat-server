const WebSocket = require('ws');
const server = new WebSocket.Server({ port: process.env.PORT || 3000 });

const rooms = {};

server.on('connection', (socket) => {
  socket.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      const { type, room, message, username } = data;

      if (type === 'join') {
        // יצירת חדר אם לא קיים
        if (!rooms[room]) {
          rooms[room] = { sockets: [], lastMessage: null };
        }

        // הצטרפות לחדר
        rooms[room].sockets.push(socket);
        socket.room = room;
        socket.username = username || 'אנונימי';
        console.log(`👤 ${socket.username} joined room "${room}"`);

        // שלח הודעה אחרונה אם קיימת
        if (rooms[room].lastMessage) {
          socket.send(JSON.stringify({
            message: rooms[room].lastMessage
          }));
        }
      }

      if (type === 'chat') {
        const sender = socket.username || 'מישהו';
        const fullMessage = `${sender}: ${message}`;
        rooms[room].lastMessage = fullMessage;

        // שידור לכולם (כולל השולח)
        rooms[room]?.sockets.forEach(s => {
          if (s.readyState === WebSocket.OPEN) {
            s.send(JSON.stringify({ message: fullMessage }));
          }
        });

        console.log(`💬 ${fullMessage} @${room}`);
      }

    } catch (e) {
      console.error("❌ Invalid message:", msg);
    }
  });

  socket.on('close', () => {
    const room = socket.room;
    if (room && rooms[room]) {
      rooms[room].sockets = rooms[room].sockets.filter(s => s !== socket);
      if (rooms[room].sockets.length === 0) {
        delete rooms[room]; // מחיקה מלאה אם אין משתתפים
      }
      console.log(`👤 ${socket.username || 'מישהו'} left room "${room}"`);
    }
  });
});
