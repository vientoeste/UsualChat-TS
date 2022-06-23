import mongoose = require('mongoose');
import { RoomINF } from '../interfaces';

const { Schema } = mongoose;
const roomSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  max: {
    type: Number,
    required: true,
    default: 10,
    min: 2,
  },
  owner: {
    type: String,
    required: true,
  },
  password: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isDM: {
    type: Boolean,
    default: false,
  },
  target: String,
});

export const Room = mongoose.model<RoomINF & mongoose.Document>('Room', roomSchema);
