import mongoose = require('mongoose');

export interface RoomINF {
  _id: mongoose.Types.ObjectId,
  title: string,
  max: number,
  owner: string,
  password: string,
  createdAt: Date,
  isDM: boolean,
  target: string,
}

export interface FriendINF {
  _id: mongoose.Types.ObjectId,
  sender: string,
  receiver: string,
  isAccepted: boolean,
  createdAt: Date,
  dm: mongoose.Types.ObjectId,
}

export interface FlagINF {
  _id?: mongoose.Types.ObjectId,
  username: string,
  room: mongoose.Types.ObjectId,
  deletedAt: Date,
}

export interface ChatINF {
  _id?: mongoose.Types.ObjectId,
  room: mongoose.Types.ObjectId,
  user: string,
  chat: string,
  img: string,
  file: string,
  createdAt: Date,
}

export interface UserINF {
  _id?: mongoose.Types.ObjectId,
  username: string,
  password: string,
}

export interface Username {
  username: string,
}

// interfaces for socket.io
export interface ServerToClientEvents {
  noArg: () => void;
  basicEmit: (a: number, b: string, c: Buffer) => void;
  withAck: (d: string, callback: (e: number) => void) => void;
}

export interface ClientToServerEvents {
  hello: () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  name: string;
  age: number;
}
