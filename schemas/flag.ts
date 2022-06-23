import mongoose = require('mongoose');
import { FlagINF } from '../interfaces';

const { Schema } = mongoose;
const {
  Types: { ObjectId },
} = Schema;
const flagSchema = new Schema({
  username: {
    type: String,
    required: true,
    ref: 'User',
  },
  room: {
    type: ObjectId,
    required: true,
    ref: 'Room',
  },
  deletedAt: {
    type: Date,
    default: Date.now,
  },
});

export const Flag = mongoose.model<FlagINF & mongoose.Document>('Flag', flagSchema);
