import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

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
      default: [0, 0],
    },
  },
  { _id: false }
);

// ─── User Schema ──────────────────────────────────────────────────────────────

const UserSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Name must not exceed 100 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never return password by default
    },

    role: {
      type: String,
      enum: ['citizen', 'responder', 'admin', 'shelter_manager'],
      default: 'citizen',
    },

    phone: {
      type: String,
      trim: true,
      match: [/^\+?[\d\s\-().]{7,20}$/, 'Please provide a valid phone number'],
    },

    avatar: {
      type: String, // Cloudinary URL
      default: null,
    },

    // Real-time location for responders / citizens in distress
    location: {
      type: LocationSchema,
      default: () => ({ type: 'Point', coordinates: [0, 0] }),
    },

    // Incidents this user has reported
    reportedIncidents: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Incident',
      },
    ],

    // Shelter this user is currently assigned to (if evacuated)
    currentShelter: {
      type: Schema.Types.ObjectId,
      ref: 'Shelter',
      default: null,
    },

    skills: [{ type: String, trim: true, lowercase: true }],

    isAvailable: {
      type: Boolean,
      default: false,
    },

    isSafe: {
      type: Boolean,
      default: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastSeen: {
      type: Date,
      default: Date.now,
    },

    // Password-reset token flow
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },

    // Email verification via OTP
    isEmailVerified: {
      type:    Boolean,
      default: false,
    },
    emailOTP: {
      type:   String,
      select: false,
    },
    emailOTPExpires: {
      type:   Date,
      select: false,
    },
    emailOTPAttempts: {
      type:    Number,
      default: 0,
      select:  false,
    },
    emailOTPSentAt: {
      type:   Date,
      select: false,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

UserSchema.index({ location: '2dsphere' }); // Geospatial queries
UserSchema.index({ role: 1 });

// ─── Pre-save Hook: Hash password ─────────────────────────────────────────────

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

/**
 * Compare a plain-text password against the stored hash.
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Virtual: Full profile URL ────────────────────────────────────────────────

UserSchema.virtual('profileUrl').get(function () {
  return `/api/users/${this._id}`;
});

export default model('User', UserSchema);
