const { createServer } = require('http'); // HTTP для Render (SSL на их стороне)
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '10000', 10); // Render использует PORT из env

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Хранение активных пользователей в комнате
  const users = new Map();

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Отправляем новому пользователю список уже подключенных
    socket.emit('existing-users', Array.from(users.keys()));

    // Добавляем нового пользователя
    users.set(socket.id, socket);

    // Уведомляем всех остальных о новом пользователе
    socket.broadcast.emit('user-joined', socket.id);

    // Обработка WebRTC сигналов
    socket.on('offer', (data) => {
      console.log('Offer from', socket.id, 'to', data.to);
      io.to(data.to).emit('offer', {
        from: socket.id,
        offer: data.offer,
      });
    });

    socket.on('answer', (data) => {
      console.log('Answer from', socket.id, 'to', data.to);
      io.to(data.to).emit('answer', {
        from: socket.id,
        answer: data.answer,
      });
    });

    socket.on('ice-candidate', (data) => {
      console.log('ICE candidate from', socket.id, 'to', data.to);
      io.to(data.to).emit('ice-candidate', {
        from: socket.id,
        candidate: data.candidate,
      });
    });

    // Отключение пользователя
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      users.delete(socket.id);
      socket.broadcast.emit('user-left', socket.id);
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Socket.IO server running`);
      console.log(`> Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`> Render deployment mode (SSL handled by Render)`);
    });
});