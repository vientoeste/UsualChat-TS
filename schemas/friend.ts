import mongoose = require('mongoose');
import { FriendINF } from '../interfaces';

const { Schema } = mongoose;
const friendSchema = new Schema({
  sender: {
    type: String,
    required: true,
  },
  receiver: {
    type: String,
    required: true,
  },
  isAccepted: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  dm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
  },
});

export const Friend = mongoose.model<FriendINF & mongoose.Document>('Friend', friendSchema);
