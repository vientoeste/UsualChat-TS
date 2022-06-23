import mongoose = require('mongoose');
import { ChatINF } from '../interfaces';

const { Schema } = mongoose;
const {
  Types: { ObjectId },
} = Schema;
const chatSchema = new Schema({
  room: {
    type: ObjectId,
    required: true,
    ref: 'Room',
  },
  user: {
    type: String,
    required: true,
  },
  chat: String,
  img: String,
  file: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Chat = mongoose.model<ChatINF & mongoose.Document>('Chat', chatSchema);
