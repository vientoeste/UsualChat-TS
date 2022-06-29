import * as express from 'express';
import cookieParser from 'cookie-parser';
import SocketIO from 'socket.io';
import SocketIOModule = module("socket.io");

export function webSocket(server: unknown, app: express.Application, sessionMiddleware: express.RequestHandler): void {
  const io = SocketIO(server, { path: '/socket.io' });

  app.set('io', io);
  const room = io.of('/room');
  const chat = io.of('/chat');

  io.use((socket, next: express.NextFunction) => {
    cookieParser(process.env.COOKIE_SECRET)(socket.request, socket.request.res, next);
    sessionMiddleware(socket.request, socket.request.res, next);
  });

  room.on('connection', (socket) => {
    console.log('room 네임스페이스에 접속');
    socket.on('disconnect', () => {
      console.log('room 네임스페이스 접속 해제');
    });
  });

  chat.on('connection', (socket) => {
    console.log('chat 네임스페이스에 접속');
    const req = socket.request;
    const { headers: { referer } } = req;
    const roomId = referer
      .split('/')[referer.split('/').length - 1]
      .replace(/\?.+/, '');
    socket.join(roomId);
    socket.to(roomId).emit('join', {
      user: 'system',
      chat: `${req.session.username}님이 입장하셨습니다.`,
    });

    socket.on('disconnect', () => {
      console.log('chat 네임스페이스 접속 해제');
      socket.leave(roomId);
      socket.to(roomId).emit('exit', {
        user: 'system',
        chat: `${req.session.username}님이 퇴장하셨습니다.`,
      });
    });

    socket.on('chat', (data) => {
      socket.to(data.room).emit(data);
    });
  });
}
