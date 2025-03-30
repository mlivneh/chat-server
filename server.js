const WebSocket = require('ws');
const server = new WebSocket.Server({ port: process.env.PORT || 3000 });

const rooms = {};

server.on('connection', (socket) => {
  socket.on('message', (msg) => {
    const data = JSON.parse(msg);
    const { type, room, message } = data;

    if (type === 'join') {
      if (!rooms[room]) rooms[room] = [];
      rooms[room].push(socket);
      socket.room = room;
    }

    if (type === 'chat') {
      rooms[room]?.forEach(s => {
        if (s !== socket && s.readyState === WebSocket.OPEN) {
          s.send(JSON.stringify({ from: 'peer', message }));
        }
      });
    }
  });

  socket.on('close', () => {
    const room = socket.room;
    if (room) {
      rooms[room] = rooms[room]?.filter(s => s !== socket);
      if (rooms[room]?.length === 0) delete rooms[room];
    }
  });
});
