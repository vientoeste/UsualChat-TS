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
  dm: boolean,
}

export interface FlagINF {
  _id: mongoose.Types.ObjectId,
  username: string,
  room: mongoose.Types.ObjectId,
  deletedAt: Date,
}

export interface ChatINF {
  _id: mongoose.Types.ObjectId,
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
