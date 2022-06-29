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
import mongoose, { Document } from 'mongoose';
import fs from 'fs';
import multer from 'multer';
import resTime from 'response-time';
import chalk from 'chalk';
import jwt from 'jsonwebtoken';
import PassJWT from 'passport-jwt';
import type { ErrorRequestHandler } from 'express';
import connect from './schemas';
import { webSocket } from './socket';
import { Room } from './schemas/room';
import { Chat } from './schemas/chat';
import { Friend } from './schemas/friend';
import { Flag } from './schemas/flag';
import {
  FlagINF,
  FriendINF,
  RoomINF,
  UserINF,
  Username,
} from './interfaces';

const { ExtractJwt } = PassJWT;
const JWTStrategy = PassJWT.Strategy;
// const { ExtractJwt, Strategy: JWTStrategy } = require('passport-jwt');

dotenv.config();

interface ENV {
  COOKIE_SECRET?: string,
  MONGO_ID?: string,
  MONGO_PASSWORD?: string,
  PORT?: number,
  NODE_ENV?: string,
}
const env: ENV = process.env as unknown as ENV;

const app: express.Application = express.default();

app.set('port', env.PORT || 3001);
app.set('view engine', 'njk');

nunjucks.configure('views', {
  express: app,
  watch: true,
});

const sessionMiddleware: express.RequestHandler = session({
  resave: false,
  saveUninitialized: false,
  secret: env.COOKIE_SECRET || 'default',
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
app.use(cookieParser(env.COOKIE_SECRET));
app.use(sessionMiddleware);
app.use(resTime((req: Request, res: Response, time: number) => {
  if (time >= 1000) {
    console.log('\x1b[1m', chalk.white.bgRed(`1초 이상(${time / 1000}초) 걸린 요청: ${req.method} ${req.url}`));
  }
}));

app.use(passport.initialize());
app.use(passport.session());

connect(env.MONGO_ID || 'default',
  env.MONGO_PASSWORD || 'default',
  env.NODE_ENV || 'default');

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model<UserINF & mongoose.Document>('User', userSchema);

passport.use(User.createStrategy());

const JWTConfig = {
  jwtFromRequest: ExtractJwt.fromHeader('authorization'),
  secretOrKey: env.COOKIE_SECRET,
};

interface JwtPayload {
  id: mongoose.ObjectId,
}
const JWTVerify = async (jwtPayload: JwtPayload, cb: (e: Error,
  isSucceed?: UserINF | boolean,
  reason?: { [key: string]: string }) => void) => {
  try {
    const user: UserINF | null = await User.findById({ _id: jwtPayload.id });
    if (!user) {
      cb(null, null, { reason: '인증 실패' });
    } else {
      cb(null, user);
      return;
    }
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
    try {
      if (!await User.findOne({ username })) {
        await Friend.create({
          sender: username,
          receiver: friend,
        });
        res.send('ok');
      } else {
        res.redirect('/?error=존재하지 않는 유저입니다.');
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

app.route('/friend/:id/deletereq').post(async (req: Request,
  res: Response,
  next: NextFunction) => {
  try {
    await Friend.findByIdAndDelete({
      _id: req.params.id,
    });
    res.redirect('/');
  } catch (error) {
    console.log(error);
    next(error);
  }
});

app.route('/friend/:id/delete').post(async (req: Request,
  res: Response,
  next: NextFunction) => {
  try {
    const friend: FriendINF & Document | null = await Friend.findById({
      _id: req.params.id,
    });
    if (!friend) {
      res.status(400).send('check id again');
    } else {
      await Room.find({
        _id: friend.dm,
      }).deleteMany({});

      await Chat.find({
        room: friend.dm,
      }).deleteMany({});

      await Flag.find({
        room: friend.dm,
      }).deleteMany({});

      await Friend.findById({
      _id: req.params.id,
      }).deleteOne({});

      res.redirect('/');
    }
  } catch (error) {
    console.log(error);
    next(error);
  }
});

app.route('/unregister').get(async (req: Request, res: Response) => {
  const { username } = req.session as unknown as Username;
  await Friend.find({
    $or: [{
      sender: username,
    }, {
      receiver: username,
    }],
  }).deleteMany({});

  await User.find({
    username,
  }).deleteMany({});

  await Room.find({
    owner: username,
  }).deleteMany({});
  // await User.remove({ username });
  // await Room.remove({ owner: username });
  res.redirect('/login');
});

app.route('/mobile/login')
  .get((req: Request, res: Response) => {
    res.render('login', { strategy: 'jwt' });
  })
  .post((req: Request, res: Response, next: NextFunction) => {
    type Tmp = session.Session & Partial<session.SessionData> & {
      username?: string,
    };
    const newSession: Tmp = req.session;
    try {
      passport.authenticate('local', (error, user, info) => {
        req.login(user, (err) => {
          if (err) {
            console.log(err);
            next(err);
          } else {
            const token = jwt.sign({
              id: user.id, name: user.name, auth: user.auth,
            }, env.COOKIE_SECRET as jwt.Secret);
            const decoded = jwt.verify(token, env.COOKIE_SECRET as jwt.Secret);
            console.log(decoded);
            newSession.username = user.name;
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
    const { username } = req.session as unknown as Username;
    interface ReqBody {
      friend: string,
    }
    const { friend } = req.body as ReqBody;
    try {
      // let dmroomid: mongoose.Types.ObjectId;
      // interface RoomINFQueryResult extends Document{
      //   _id: mongoose.Types.ObjectId,
      //   title: string,
      //   max: number,
      //   owner: string,
      //   password: string,
      //   createdAt: Date,
      //   isDM: boolean,
      //   target: string,
      // }
      const dm: RoomINF & Document | null = await Room.findOne({
        isDM: true,
        $or: [{
          owner: username,
          target: friend,
        }, {
          owner: friend,
          target: username,
        }],
      });
      // await Friend.findOne({
      //   $or: [{
      //     sender: friend,
      //     receiver: username,
      //   }, {
      //     sender: username,
      //     receiver: friend,
      //   }],
      // });
      if (!dm) {
        const newRoom: RoomINF & Document = await Room.create({
          title: 'Direct Message',
          max: 2,
          owner: username,
          isDM: true,
          target: friend,
        });
        await Friend.findOne({
          $or: [{
            sender: friend,
            receiver: username,
          }, {
            sender: username,
            receiver: friend,
          }],
        }).updateOne({}, {
          dm: new mongoose.Types.ObjectId(newRoom.id),
        });
        console.log(`dm 생성 - id: ${newRoom._id as string}`);
        res.redirect(`/room/${newRoom._id as string}`);
      } else {
        res.redirect(`/room/${dm._id as string}`);
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
      const room: RoomINF | null = await Room.findOne({ _id: req.params.id });
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
      const flag: FlagINF | null = await Flag.find({
        username,
        room: req.params.id,
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

app.route('/room/:id/clearchat').post(async (req: Request, res: Response) => {
  const { username } = req.session as unknown as Username;
  await Room.findById({ _id: req.params.id })
    .then(async (item: RoomINF | null) => {
      if (!item) {
        res.status(400).send('error');
      } else if (item.owner === username) {
        await Chat.deleteMany({
          room: req.params.id,
        }).then(() => {
          res.send('ok');
        });
      } else {
        await Flag.create({
          username,
          room: req.params.id,
        });
        res.send('ok');
      }
    });
});

app.route('/room/:id/chat').post(async (req: Request, res: Response, next: NextFunction) => {
  const { username } = req.session as unknown as Username;
  interface ChatINF {
    newChat: string,
  }
  const { newChat } = req.body as unknown as ChatINF;
  try {
    const chat = await Chat.create({
      room: req.params.id,
      user: username,
      chat: newChat,
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
  const { username } = req.session as unknown as Username;
  interface File {
    filename: string,
  }
  const { filename } = req.file as unknown as File;
  try {
    const chat = await Chat.create({
      room: req.params.id,
      user: username,
      img: filename,
    });
    req.app.get('io').of('/chat').to(req.params.id).emit('chat', chat);
    res.send('ok');
  } catch (error) {
    console.error(error);
    next(error);
  }
});

app.post('/room/:id/file', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  const { username } = req.session as unknown as Username;
  interface File {
    filename: string,
  }
  const { filename } = req.file as unknown as File;
  try {
    const chat = await Chat.create({
      room: req.params.id,
      user: username,
      file: filename,
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
  res.locals.error = env.NODE_ENV !== 'production' ? err : {};
  res.status(err.status || 500);
  res.render('error');
};
app.use(errorHandler);

const server = app.listen(app.get('port'), () => {
  console.log(app.get('port'), '번 포트에서 대기 중');
});

webSocket(server, app, sessionMiddleware);
