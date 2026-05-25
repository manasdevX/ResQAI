import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const ResourceRequestSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['food', 'water', 'medical', 'rescue', 'shelter', 'clothing'],
      required: [true, 'Resource type is required'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description must not exceed 500 characters'],
    },

    urgency: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },

    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, 'Location coordinates are required'],
      },
      address: { type: String, trim: true },
    },

    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    status: {
      type: String,
      enum: ['pending', 'acknowledged', 'fulfilled'],
      default: 'pending',
    },

    fulfilledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    fulfilledAt: {
      type: Date,
      default: null,
    },

    acknowledgedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    acknowledgedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ResourceRequestSchema.index({ location: '2dsphere' });
ResourceRequestSchema.index({ status: 1 });
ResourceRequestSchema.index({ requestedBy: 1 });
ResourceRequestSchema.index({ createdAt: -1 });

export default model('ResourceRequest', ResourceRequestSchema);
