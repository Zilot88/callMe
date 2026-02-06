const { createServer: createHttpsServer } = require('https');
const { createServer: createHttpServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '4057', 10);

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
