const WebSocket = require('ws');
const server = new WebSocket.Server({ port: process.env.PORT || 3000 });

const rooms = {};

server.on('connection', (socket) => {
  socket.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      const { type, room, message, username } = data;

      if (type === 'join') {
        if (!rooms[room]) rooms[room] = [];
        rooms[room].push(socket);
        socket.room = room;
        socket.username = username || 'אנונימי';
        console.log(`👤 ${socket.username} joined room "${room}"`);
      }

      if (type === 'chat') {
        const sender = socket.username || 'מישהו';
        const payload = JSON.stringify({ message: `${sender}: ${message}` });

        rooms[room]?.forEach(s => {
          if (s.readyState === WebSocket.OPEN) {
            s.send(payload);
          }
        });
        console.log(`💬 ${sender} @${room}: ${message}`);
      }
    } catch (e) {
      console.error("❌ Invalid message:", msg);
    }
  });

  socket.on('close', () => {
    const room = socket.room;
    if (room) {
      rooms[room] = rooms[room]?.filter(s => s !== socket);
      if (rooms[room]?.length === 0) delete rooms[room];
      console.log(`👤 ${socket.username || 'מישהו'} left room "${room}"`);
    }
  });
});
