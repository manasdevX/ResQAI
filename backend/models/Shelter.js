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
      required: [true, 'Shelter address is required'],
      trim: true,
    },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },
    pincode: { type: String, trim: true },
  },
  { _id: false }
);

const ResourceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },  // e.g. "Drinking Water"
    quantity: { type: Number, default: 0 },
    unit: { type: String, trim: true },                  // e.g. "litres", "kits"
    lastUpdated: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ContactSchema = new Schema(
  {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    role: { type: String, trim: true }, // e.g. "Shelter Manager", "Security"
  },
  { _id: false }
);

// ─── Shelter Schema ───────────────────────────────────────────────────────────

const ShelterSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Shelter name is required'],
      trim: true,
      maxlength: [200, 'Name must not exceed 200 characters'],
    },

    type: {
      type: String,
      enum: [
        'relief_camp',
        'hospital',
        'school',
        'community_hall',
        'government_building',
        'warehouse',
        'other',
      ],
      default: 'relief_camp',
    },

    status: {
      type: String,
      enum: ['active', 'full', 'closed', 'preparing'],
      default: 'active',
    },

    location: {
      type: LocationSchema,
      required: [true, 'Location is required'],
    },

    // Capacity management
    totalCapacity: {
      type: Number,
      required: [true, 'Total capacity is required'],
      min: [1, 'Capacity must be at least 1'],
    },
    currentOccupancy: {
      type: Number,
      default: 0,
      min: 0,
    },

    // People currently registered at this shelter
    registeredOccupants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // Incidents this shelter is supporting
    linkedIncidents: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Incident',
      },
    ],

    // Manager of this shelter
    managedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Emergency contacts
    contacts: [ContactSchema],

    // Available amenities
    amenities: {
      food: { type: Boolean, default: false },
      water: { type: Boolean, default: false },
      medical: { type: Boolean, default: false },
      electricity: { type: Boolean, default: false },
      wifi: { type: Boolean, default: false },
      toilets: { type: Boolean, default: false },
      bedding: { type: Boolean, default: false },
      childCare: { type: Boolean, default: false },
      petFriendly: { type: Boolean, default: false },
      wheelchairAccessible: { type: Boolean, default: false },
    },

    // Resource inventory
    resources: [ResourceSchema],

    // Image/media of the facility
    images: [
      {
        url: { type: String },
        publicId: { type: String },
        caption: { type: String },
      },
    ],

    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description must not exceed 2000 characters'],
    },

    // Auto-close when full
    autoCloseWhenFull: {
      type: Boolean,
      default: true,
    },

    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

ShelterSchema.index({ location: '2dsphere' });
ShelterSchema.index({ status: 1 });
ShelterSchema.index({ type: 1 });
ShelterSchema.index({ managedBy: 1 });

// ─── Pre-save: Auto-update status based on occupancy ─────────────────────────

ShelterSchema.pre('save', function () {
  if (this.autoCloseWhenFull) {
    if (this.currentOccupancy >= this.totalCapacity && this.status === 'active') {
      this.status = 'full';
    } else if (this.currentOccupancy < this.totalCapacity && this.status === 'full') {
      this.status = 'active';
    }
  }
});

// ─── Virtual: Available spots ─────────────────────────────────────────────────

ShelterSchema.virtual('availableSpots').get(function () {
  return Math.max(0, this.totalCapacity - this.currentOccupancy);
});

// ─── Virtual: Occupancy percentage ───────────────────────────────────────────

ShelterSchema.virtual('occupancyPercent').get(function () {
  if (!this.totalCapacity) return 0;
  return Math.min(100, Math.round((this.currentOccupancy / this.totalCapacity) * 100));
});

// ─── Virtual: Is shelter accepting people ────────────────────────────────────

ShelterSchema.virtual('isAccepting').get(function () {
  return this.status === 'active' && this.currentOccupancy < this.totalCapacity;
});

export default model('Shelter', ShelterSchema);
