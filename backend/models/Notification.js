import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const NotificationSchema = new Schema(
  {
    recipient: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    type: {
      type:    String,
      enum:    ['incident_status', 'assignment', 'shelter', 'alert', 'system', 'resource', 'sos'],
      default: 'system',
    },
    title: { type: String, required: true, maxlength: 200 },
    body:  { type: String, maxlength: 500 },
    link:  { type: String },
    read:  { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Auto-delete notifications older than 30 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default model('Notification', NotificationSchema);
