import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const LocationSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
    address: {
      type: String,
      trim: true,
    },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },
  },
  { _id: false }
);

const MediaSchema = new Schema(
  {
    url: { type: String, required: true },    // Cloudinary URL
    publicId: { type: String },               // Cloudinary public ID for deletion
    type: {
      type: String,
      enum: ['image', 'video', 'audio', 'document'],
      default: 'image',
    },
    caption: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const AiTriageSchema = new Schema(
  {
    summary: { type: String },                // AI-generated incident summary
    recommendedActions: [{ type: String }],   // Step-by-step AI action plan
    estimatedAffected: { type: Number },      // AI estimate of affected people
    riskScore: { type: Number, min: 0, max: 100 }, // 0–100 risk score
    processedAt: { type: Date },
    modelUsed: { type: String, default: 'gemini-pro' },
  },
  { _id: false }
);

const StatusUpdateSchema = new Schema(
  {
    status: {
      type: String,
      enum: ['reported', 'acknowledged', 'responding', 'resolved', 'closed'],
      required: true,
    },
    note: { type: String, trim: true },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// ─── Incident Schema ──────────────────────────────────────────────────────────

const IncidentSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Incident title is required'],
      trim: true,
      maxlength: [200, 'Title must not exceed 200 characters'],
    },

    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [5000, 'Description must not exceed 5000 characters'],
    },

    type: {
      type: String,
      required: [true, 'Incident type is required'],
      enum: [
        'fire',
        'flood',
        'earthquake',
        'cyclone',
        'landslide',
        'accident',
        'medical_emergency',
        'building_collapse',
        'chemical_spill',
        'riot',
        'other',
      ],
    },

    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },

    status: {
      type: String,
      enum: ['reported', 'acknowledged', 'responding', 'resolved', 'closed'],
      default: 'reported',
    },

    location: {
      type: LocationSchema,
      required: [true, 'Location is required'],
    },

    // Who reported it
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter is required'],
    },

    // Responders assigned to this incident
    assignedResponders: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // Nearby shelters linked to this incident
    linkedShelters: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Shelter',
      },
    ],

    media: [MediaSchema],

    // Estimated number of people affected
    affectedCount: {
      type: Number,
      min: 0,
      default: 0,
    },

    // AI triage output
    aiTriage: {
      type: AiTriageSchema,
      default: null,
    },

    // Full status history log
    statusHistory: [StatusUpdateSchema],

    // Whether the incident requires immediate evacuation
    evacuationRequired: {
      type: Boolean,
      default: false,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    tags: [{ type: String, trim: true, lowercase: true }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

IncidentSchema.index({ location: '2dsphere' });
IncidentSchema.index({ status: 1, severity: 1 });
IncidentSchema.index({ type: 1 });
IncidentSchema.index({ reportedBy: 1 });
IncidentSchema.index({ createdAt: -1 });

// ─── Pre-save: Push to statusHistory on status change ─────────────────────────

IncidentSchema.pre('save', function (next) {
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      updatedBy: this._updatedBy || this.reportedBy,
      updatedAt: new Date(),
    });
  }

  // Auto-set resolvedAt timestamp
  if (this.status === 'resolved' && !this.resolvedAt) {
    this.resolvedAt = new Date();
  }

  next();
});

// ─── Virtual: Response time in minutes ────────────────────────────────────────

IncidentSchema.virtual('responseTimeMinutes').get(function () {
  if (!this.resolvedAt) return null;
  return Math.round((this.resolvedAt - this.createdAt) / 60000);
});

// ─── Virtual: Is active ───────────────────────────────────────────────────────

IncidentSchema.virtual('isActive').get(function () {
  return !['resolved', 'closed'].includes(this.status);
});

export default model('Incident', IncidentSchema);
