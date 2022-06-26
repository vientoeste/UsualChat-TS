import * as express from 'express';
import passportLocalMongoose from 'passport-local-mongoose';
import { NextFunction, Request, Response } from 'express';
import path = require('path');
import nunjucks = require('nunjucks');
import dotenv from 'dotenv';
import morgan from 'morgan';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import mongoose from 'mongoose';
import fs from 'fs';
import multer from 'multer';
import resTime from 'response-time';
import chalk from 'chalk';
import jwt from 'jsonwebtoken';
import PassJWT from 'passport-jwt';
import connect from './schemas';
import type { ErrorRequestHandler } from 'express';
import { webSocket } from './socket';
import { Room } from './schemas/room';
import { Chat } from './schemas/chat';
import { Friend } from './schemas/friend';
import { Flag } from './schemas/flag';
import {
  FriendINF,
  RoomINF,
  UserINF,
  Username,
} from './interfaces';

const { ExtractJwt } = PassJWT;
const JWTStrategy = PassJWT.Strategy;
// const { ExtractJwt, Strategy: JWTStrategy } = require('passport-jwt');

dotenv.config();

const app: express.Application = express.default();

app.set('port', process.env.PORT || 3001);
app.set('view engine', 'njk');

nunjucks.configure('views', {
  express: app,
  watch: true,
});

const sessionMiddleware: express.RequestHandler = session({
  resave: false,
  saveUninitialized: false,
  secret: process.env.COOKIE_SECRET || 'default',
  cookie: {
    httpOnly: true,
    secure: false,
  },
});

app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'uploads')));
app.use('/img', express.static(path.join(__dirname, 'uploads')));
app.use('/file', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(sessionMiddleware);
app.use(resTime((req: Request, res: Response, time: number) => {
  if (time >= 1000) {
    console.log('\x1b[1m', chalk.white.bgRed(`1초 이상(${time / 1000}초) 걸린 요청: ${req.method} ${req.url}`));
  }
}));

app.use(passport.initialize());
app.use(passport.session());

connect(process.env.MONGO_ID || 'default',
  process.env.MONGO_PASSWORD || 'default',
  process.env.NODE_ENV || 'default');

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model<UserINF & mongoose.Document>('User', userSchema);

passport.use(User.createStrategy());

const JWTConfig = {
  jwtFromRequest: ExtractJwt.fromHeader('authorization'),
  secretOrKey: process.env.COOKIE_SECRET,
};

const JWTVerify = async (jwtPayload, cb: (e: Error,
  isSucceed?: UserINF | boolean,
  reason?: { [key: string]: string }) => void) => {
  try {
    const user: UserINF = await User.findById({ _id: jwtPayload.id });
    if (user) {
      cb(null, user);
      return;
    }
    cb(null, false, { reason: '인증 실패' });
  } catch (error) {
    console.error(error);
    cb(error);
  }
};

passport.use('jwt', new JWTStrategy(JWTConfig, JWTVerify));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.route('/mobile').get(passport.authenticate('jwt'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username } = req.user as unknown as Username;
    if (username === 'undefined') {
      throw Error('username undefined');
    }
    type ShortenRoomINF = Pick<RoomINF, 'title'>;
    const rooms: ShortenRoomINF[] = await Room.find({
      isDM: false,
    }).select('_id title');
    const friendreqs = await Friend.find({
      receiver: username,
      isAccepted: false,
    }).select('-_id sender');
    const accfriends = await Friend.find({
      $or: [{
        sender: username,
      }, {
        receiver: username,
      }],
      isAccepted: true,
    }).select('-_id sender receiver');
    const fReq = new Array(friendreqs.length);
    for (let i = 0; i < friendreqs.length; i += 1) {
      fReq[i] = friendreqs[i].sender;
    }
    const fr = [];
    for (let i = 0; i < accfriends.length; i += 1) {
      if (accfriends[i].sender === username) fr[i] = accfriends[i].receiver;
      else if (accfriends[i].receiver === username) fr[i] = accfriends[i].sender;
    }
    res.json(JSON.stringify({
      username, rooms, fReqs: friendreqs, fr: accfriends,
    }));
  } catch (e) {
    console.log(e);
    next(e);
  }
});

app.route('/').get(async (req: Request, res: Response, next: NextFunction) => {
  if (req.isUnauthenticated()) {
    res.redirect('login');
  } else {
    try {
      const { username } = req.session as unknown as Username;
      const rooms = await Room.find({
        isDM: false,
      });
      const friendreqs = await Friend.find({
        receiver: username,
        isAccepted: false,
      });
      const accfriends = await Friend.find({
        $or: [{
          sender: username,
        }, {
          receiver: username,
        }],
        isAccepted: true,
      });
      res.render('main', {
        username, rooms, friendreqs, accfriends, title: 'UsualChat',
      });
    } catch (error) {
      console.error(error);
      next(error);
    }
  }
});

app.route('/register')
  .post((req: Request, res: Response) => {
    interface UNameAndPW extends Username {
      password: string,
    }
    type Tmp = session.Session & Partial<session.SessionData> & {
      username?: string,
    };
    const newSession: Tmp = req.session;
    const { username, password } = req.body as unknown as UNameAndPW;
    const user = new User({ username, password });
    User.register(
      user,
      password,
      (err) => {
        if (err) {
          console.log(err);
          res.redirect('/login');
        } else {
          passport.authenticate('local')(req, res, () => {
            newSession.username = username;
            newSession.save(() => {
              res.redirect('/');
            });
          });
        }
      },
    );
  });

app.route('/friend')
  .post(async (req: Request, res: Response, next: NextFunction) => {
    interface ReqBody extends Username {
      friend: string,
    }
    const { username, friend } = req.body as ReqBody;
    const friendQuery: FriendINF | null = await User.findOne({ username }).then((item) => item);
    try {
      if (!friendQuery) {
        res.redirect('/?error=존재하지 않는 유저입니다.');
      } else {
        await Friend.create({
          sender: username,
          receiver: friend,
        });
        res.send('ok');
      }
    } catch (error) {
      console.error(error);
      next(error);
    }
  });

app.route('/friend/:id')
  .get((req, res) => {
    res.send('ok');
  })
  .post(async (req, res) => {
    await Friend.findByIdAndUpdate({
      _id: req.params.id,
    }, {
      isAccepted: true,
    });
    res.redirect('/');
  });

app.post('/friend/:id/deletereq', async (req: Request, res: Response, next: NextFunction) => {
  await Friend.findByIdAndDelete({
    _id: req.params.id,
  }).then((f) => {
    console.log(f);
    res.redirect('/');
  }).catch((e) => {
    console.log(e);
    next(e);
  });
});

app.post('/friend/:id/delete', await (req: Request, res: Response, next: NextFunction) => {
  try {
    const friend = Friend.find({
      _id: req.params.id,
    }).then(async (items) => {
      console.log(items[0]);
      await Room.deleteMany({
        _id: items[0].dm,
      }).then(() => {
        console.log('room deleted');
      });
      await Chat.deleteMany({
        room: items[0].dm,
      }).then(() => {
        console.log('chat deleted');
      });
      await Flag.deleteMany({
        room: items[0].dm,
      }).then(() => {
        console.log('flag deleted');
      });
    });
    await Friend.findByIdAndDelete({
      _id: req.params.id,
    });
    res.redirect('/');
  } catch (error) {
    console.log(error);
    next(error);
  }
});

app.get('/unregister', async (req, res) => {
  const username = req.session as unknown as Username;
  await Friend.deleteMany({
    $or: [{
      sender: username,
    }, {
      receiver: username,
    }],
  });
  await User.remove({ username });
  await Room.remove({ owner: username });
  res.redirect('/login');
});

app.route('/mobile/login')
  .get((req: Request, res: Response, next: NextFunction) => {
    res.render('login', { strategy: 'jwt' });
  })
  .post((req: Request, res: Response, next: NextFunction) => {
    try {
      passport.authenticate('local', (error, user, info) => {
        req.login(user, (err) => {
          if (err) {
            console.log(err);
            next(err);
          } else {
            const token = jwt.sign({
              id: user.id, name: user.name, auth: user.auth,
            }, process.env.COOKIE_SECRET);
            const decoded = jwt.verify(token, process.env.COOKIE_SECRET);
            console.log(decoded);
            req.session.username = user.name;
            res.json({ token });
          }
        });
      })(req, res);
    } catch (e) {
      console.log(e);
      next(e);
    }
  });

app.route('/login')
  .get((req, res) => {
    if (req.isAuthenticated()) {
      res.redirect('/');
    } else {
      res.render('login', { strategy: 'default' });
    }
  })
  .post((req, res) => {
    interface UNameAndPW extends Username {
      password: string,
    }
    type Tmp = session.Session & Partial<session.SessionData> & {
      username?: string,
    };
    const newSession: Tmp = req.session;
    const { username, password } = req.body as unknown as UNameAndPW;
    const user: UserINF = new User({ username, password });

    req.login(user, (err) => {
      if (err) {
        console.log(err);
      } else {
        passport.authenticate('local')(req, res, () => {
          newSession.username = username;
          newSession.save(() => {
            res.redirect('/');
          });
        });
      }
    });
  });

app.route('/logout')
  .get((req, res) => {
    req.logout();
    req.session.destroy();
    res.redirect('/');
  });

app.route('/room')
  .get((req, res) => {
    res.render('room', { title: 'UsualChat 채팅방 생성' });
  })
  .post(async (req: Request, res: Response, next: NextFunction) => {
    interface ReqBody {
      title: string,
      friend: string,
      max: number,
      owner: string,
      password?: string,
    }
    const {
      title, friend, max, password,
    } = req.body as ReqBody;
    const { username } = req.session as unknown as Username;
    let newRoom: RoomINF;
    try {
      if (!friend && !password) {
        // req.body.title = req.body.friend;
        newRoom = await Room.create({
          title,
          max,
          owner: username,
          password,
          isDM: false,
        });
      } else if (!friend && !!password) {
        newRoom = await Room.create({
          title,
          max,
          owner: username,
          isDM: false,
        });
      } else {
        newRoom = await Room.create({
          title: 'dm',
          max,
          owner: username,
          isDM: true,
        });
      }
      const io = req.app.get('io');
      io.of('/room').emit('newRoom', newRoom);
      res.redirect(`/room/${newRoom._id as unknown as string}?password=${password as string}`);
    } catch (error) {
      console.error(error);
      next(error);
    }
  });

// room - POST와 통합
app.route('/dm')
  .post(async (req: Request, res: Response, next: NextFunction) => {
    try {
      let dmroomid: mongoose.Types.ObjectId;
      const dm = await Room.find({
        isDM: true,
        $or: [{
          owner: req.session.username,
          target: req.body.friend,
        }, {
          owner: req.body.friend,
          target: req.session.username,
        }],
      }).then((rooms) => {
        if (rooms.length === 0) {
          return false;
        }
        dmroomid = rooms[0]._id;
        return true;
      });
      const friend = await Friend.findOne({
        $or: [{
          sender: req.body.friend,
          receiver: req.session.username,
        }, {
          sender: req.session.username,
          receiver: req.body.friend,
        }],
      }).then((friends: FriendINF) => friends[0]._id);
      if (dm === false) {
        const newRoom = await Room.create({
          title: 'Direct Message',
          max: 2,
          owner: req.session.username,
          isDM: true,
          target: req.body.friend,
        });
        await Friend.findOneAndUpdate({
          _id: friend,
        }, {
          dm: newRoom._id,
        });
        console.log(`dm 생성 - id: ${newRoom._id}`);
        res.redirect(`/room/${newRoom._id}`);
      } else {
        res.redirect(`/room/${dmroomid}`);
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  });

app.route('/room/:id')
  .get(async (req: Request, res: Response, next: NextFunction) => {
    const { username } = req.session as unknown as Username;
    try {
      const room = await Room.findOne({ _id: req.params.id });
      const io = req.app.get('io');
      if (!room) {
        return res.redirect('/');
      }
      if (room.password && room.password !== req.query.password) {
        return res.redirect('/?error=비밀번호가 틀렸습니다.');
      }
      const { rooms } = io.of('/chat').adapter;
      if (
        rooms
        && rooms[req.params.id]
        && room.max <= rooms[req.params.id].length
      ) {
        return res.redirect('/?error=허용 인원을 초과하였습니다.');
      }
      const flag = await Flag.find({
        username,
        room: req.params.id,
      }).then((items) => {
        if (items.length === 0) {
          return false;
        }
        return items[0];
      });

      let chats;
      if (!flag) {
        chats = await Chat.find({ room: room._id }).sort('createdAt');
      } else {
        chats = await Chat.find({ room: room._id, createdAt: { $gt: flag.deletedAt } }).sort('createdAt');
      }
      return res.render('chat', {
        room,
        title: room.title,
        chats,
        user: username,
      });
    } catch (error) {
      console.error(error);
      return next(error);
    }
  });
// .delete(async (req: Request, res: Response, next: NextFunction) => {
//   const roomid = await Room.findById({ _id: req.params.id });
//   if (roomid.owner === req.session.username) {
//     try {
//       await req.app.get('io').of('/room').emit('removeRoom', req.params.id);
//       const io = req.app.get('io');
//       io.of('/chat').emit('reload');
//       await Room.deleteMany({ _id: req.params.id });
//       await Chat.deleteMany({ room: req.params.id });
//       await Flag.deleteMany({ room: req.params.id });
//       res.redirect('/');
//     } catch (error) {
//       console.error(error);
//       next(error);
//     }
//   }
// });

app.post('/room/:id/clearchat', async (req: Request, res: Response) => {
  const { username } = req.session as unknown as Username;
  await Room.findById({ _id: req.params.id })
    .then((item) => {
      if (item.owner === username) {
        await Chat.deleteMany({
          room: req.params.id,
        }).then(() => {
          res.send('ok');
        });
      } else {
        await Flag.create({
          username: req.session.username,
          room: req.params.id,
        });
        res.send('ok');
      }
    });
});

app.route('/room/:id/chat').post(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chat = await Chat.create({
      room: req.params.id,
      user: req.session.username,
      chat: req.body.chat,
    });
    req.app.get('io').of('/chat').to(req.params.id).emit('chat', chat);
    res.send('ok');
  } catch (error) {
    console.error(error);
    next(error);
  }
});

try {
  fs.readdirSync('uploads');
} catch (err) {
  console.error('uploads 폴더가 없어 uploads 폴더를 생성합니다.');
  fs.mkdirSync('uploads');
}

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, done) {
      done(null, 'uploads/');
    },
    filename(req, file, done) {
      const ext = path.extname(file.originalname);
      done(null, `${path.basename(file.originalname, ext)} + ${Date.now()} + ${ext}`);
      console.log(`${path.basename(file.originalname, ext)} / ${Date.now()} / ${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 * 1024 },
});

app.post('/room/:id/img', upload.single('img'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chat = await Chat.create({
      room: req.params.id,
      user: req.session.username,
      img: req.file.filename,
    });
    req.app.get('io').of('/chat').to(req.params.id).emit('chat', chat);
    res.send('ok');
  } catch (error) {
    console.error(error);
    next(error);
  }
});

app.post('/room/:id/file', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chat = await Chat.create({
      room: req.params.id,
      user: req.session.username,
      file: req.file.filename,
    });
    req.app.get('io').of('/chat').to(req.params.id).emit('chat', chat);
    res.send('ok');
  } catch (error) {
    console.error(error);
    next(error);
  }
});

app.use((req: Request, res: Response, next: NextFunction) => {
  interface Err extends Error{
    status?: number,
  }
  const error: Err = new Error(`${req.method} ${req.url} 라우터가 없습니다.`);
  error.status = 404;
  next(error);
});
const errorHandler: ErrorRequestHandler = (err, req, res: Response, next) => {
  console.log(err);
  res.locals.message = err.message;
  res.locals.error = process.env.NODE_ENV !== 'production' ? err : {};
  res.status(err.status || 500);
  res.render('error');
};
app.use(errorHandler);

const server = app.listen(app.get('port'), () => {
  console.log(app.get('port'), '번 포트에서 대기 중');
});

webSocket(server, app, sessionMiddleware);
