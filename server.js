const { createServer: createHttpsServer } = require('https');
const { createServer: createHttpServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '10000', 10);

// Загружаем SSL сертификаты если они есть
const keyPath = path.join(__dirname, 'ssl', 'key.pem');
const certPath = path.join(__dirname, 'ssl', 'cert.pem');
const hasSSL = fs.existsSync(keyPath) && fs.existsSync(certPath);

let httpsOptions = null;
if (hasSSL) {
  httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}

const protocol = hasSSL ? 'https' : 'http';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const requestHandler = async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  };

  const server = hasSSL
    ? createHttpsServer(httpsOptions, requestHandler)
    : createHttpServer(requestHandler);

  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Track which rooms each socket is in and their nicknames
  // Map<socketId, { rooms: Set<roomId>, nickname: string }>
  const socketMeta = new Map();

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socketMeta.set(socket.id, { rooms: new Set(), nickname: '' });

    // ─── Join a room (video or chat) ────────────────────────────────
    socket.on('join-room', ({ roomId, type, nickname }) => {
      socket.join(roomId);
      const meta = socketMeta.get(socket.id);
      if (meta) {
        meta.rooms.add(roomId);
        if (nickname) meta.nickname = nickname;
      }

      console.log(`[${type}] ${socket.id} joined room ${roomId}`);

      // Send list of existing users in this room
      const room = io.sockets.adapter.rooms.get(roomId);
      const existingUsers = room
        ? [...room].filter(id => id !== socket.id)
        : [];
      socket.emit('existing-users', existingUsers);

      // Notify others in the room
      socket.to(roomId).emit('user-joined', socket.id);

      // For chat rooms: notify with nickname
      if (type === 'chat' && nickname) {
        socket.to(roomId).emit('chat-user-joined', {
          id: socket.id,
          nickname,
        });
      }

      // Send current participant count
      const count = room ? room.size : 1;
      io.to(roomId).emit('participant-count', count);
    });

    // ─── Leave a room ───────────────────────────────────────────────
    socket.on('leave-room', (roomId) => {
      socket.leave(roomId);
      const meta = socketMeta.get(socket.id);
      if (meta) meta.rooms.delete(roomId);

      socket.to(roomId).emit('user-left', socket.id);

      const room = io.sockets.adapter.rooms.get(roomId);
      const count = room ? room.size : 0;
      io.to(roomId).emit('participant-count', count);
    });

    // ─── WebRTC signaling (video rooms) ─────────────────────────────
    socket.on('offer', (data) => {
      io.to(data.to).emit('offer', {
        from: socket.id,
        offer: data.offer,
      });
    });

    socket.on('answer', (data) => {
      io.to(data.to).emit('answer', {
        from: socket.id,
        answer: data.answer,
      });
    });

    socket.on('ice-candidate', (data) => {
      io.to(data.to).emit('ice-candidate', {
        from: socket.id,
        candidate: data.candidate,
      });
    });

    // ─── Chat messages ──────────────────────────────────────────────
    socket.on('chat-message', ({ roomId, message, nickname }) => {
      socket.to(roomId).emit('chat-message', {
        id: `${socket.id}-${Date.now()}`,
        from: socket.id,
        nickname: nickname || 'Anonymous',
        message,
        timestamp: Date.now(),
        type: 'user',
      });
    });

    // ─── Nickname update ────────────────────────────────────────────
    socket.on('set-nickname', ({ roomId, nickname }) => {
      const meta = socketMeta.get(socket.id);
      if (meta) meta.nickname = nickname;
      socket.to(roomId).emit('nickname-updated', {
        id: socket.id,
        nickname,
      });
    });

    // ─── Disconnect ─────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      const meta = socketMeta.get(socket.id);
      if (meta) {
        for (const roomId of meta.rooms) {
          socket.to(roomId).emit('user-left', socket.id);
          socket.to(roomId).emit('chat-user-left', {
            id: socket.id,
            nickname: meta.nickname,
          });
          const room = io.sockets.adapter.rooms.get(roomId);
          const count = room ? room.size : 0;
          io.to(roomId).emit('participant-count', count);
        }
      }
      socketMeta.delete(socket.id);
    });
  });

  server
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on ${protocol}://${hostname}:${port}`);
      console.log(`> Socket.IO server running with ${hasSSL ? 'HTTPS' : 'HTTP'}`);
      console.log(`> Local:    ${protocol}://localhost:${port}`);
      if (hasSSL) {
        console.log(`> Network:  ${protocol}://192.168.50.57:${port}`);
        console.log(`> External: ${protocol}://176.36.188.208:${port}`);
        console.log(`\n⚠️  WARNING: Using self-signed certificate. You'll need to accept the certificate in your browser.`);
      } else {
        console.log(`> Running without SSL (SSL terminated by platform)`);
      }
    });
});
