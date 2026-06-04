import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const InviteSchema = new Schema(
  {
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: '',
    },

    role: {
      type: String,
      enum: ['admin'],
      required: [true, 'Role is required'],
    },

    token: {
      type: String,
      required: true,
      unique: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    usedAt: {
      type: Date,
      default: null,
    },

    usedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

InviteSchema.index({ createdBy: 1 });

export default model('Invite', InviteSchema);
