/**
 * ResQAI — Real Shelter Seeder (OpenStreetMap / Overpass API)
 * ─────────────────────────────────────────────────────────────
 * Fetches real hospitals, community centres, schools and government
 * buildings from OpenStreetMap for major Indian cities.
 *
 * Usage:
 *   node backend/seeds/seedShelters.js            ← appends to existing
 *   CLEAR=true node backend/seeds/seedShelters.js ← clears first, then seeds
 *   LIMIT=20   node backend/seeds/seedShelters.js ← max per city (default 15)
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

if (!process.env.MONGO_URI) {
  console.error('\n  ❌  MONGO_URI not found in backend/.env\n');
  process.exit(1);
}

// ── Inline Shelter schema ─────────────────────────────────────────────────────

const ShelterSchema = new mongoose.Schema(
  {
    name:             { type: String, required: true, trim: true },
    type:             { type: String, enum: ['relief_camp','hospital','school','community_hall','government_building','warehouse','other'], default: 'other' },
    status:           { type: String, enum: ['active','full','closed','preparing'], default: 'active' },
    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
      address:     { type: String, default: '' },
      city:        { type: String, default: '' },
      state:       { type: String, default: '' },
      country:     { type: String, default: 'India' },
    },
    totalCapacity:    { type: Number, default: 200 },
    currentOccupancy: { type: Number, default: 0 },
    registeredOccupants: [{ type: mongoose.Schema.Types.ObjectId }],
    managedBy:        { type: mongoose.Schema.Types.ObjectId, default: null },
    contacts:         [{ name: String, phone: String, role: String }],
    amenities: {
      food: Boolean, water: Boolean, medical: Boolean, electricity: Boolean,
      wifi: Boolean, toilets: Boolean, bedding: Boolean, childCare: Boolean,
      petFriendly: Boolean, wheelchairAccessible: Boolean,
    },
    resources: [], images: [],
    description:       { type: String, default: '' },
    autoCloseWhenFull: { type: Boolean, default: true },
    openedAt:          { type: Date, default: Date.now },
    closedAt:          { type: Date, default: null },
  },
  { timestamps: true }
);
ShelterSchema.index({ location: '2dsphere' });

const Shelter = mongoose.models.Shelter || mongoose.model('Shelter', ShelterSchema);

// ── Indian cities (smaller bboxes → faster Overpass queries) ──────────────────

const CITIES = [
  // name, state, [south, west, north, east] — kept tight to city core
  { name: 'New Delhi',   state: 'Delhi',          bbox: [28.56, 77.10, 28.72, 77.28] },
  { name: 'Mumbai',      state: 'Maharashtra',    bbox: [18.93, 72.80, 19.10, 72.93] },
  { name: 'Bengaluru',   state: 'Karnataka',      bbox: [12.93, 77.57, 13.05, 77.72] },
  { name: 'Chennai',     state: 'Tamil Nadu',     bbox: [13.00, 80.20, 13.12, 80.30] },
  { name: 'Kolkata',     state: 'West Bengal',    bbox: [22.52, 88.31, 22.60, 88.40] },
  { name: 'Hyderabad',   state: 'Telangana',      bbox: [17.37, 78.44, 17.48, 78.56] },
  { name: 'Pune',        state: 'Maharashtra',    bbox: [18.50, 73.82, 18.60, 73.94] },
  { name: 'Ahmedabad',   state: 'Gujarat',        bbox: [23.00, 72.54, 23.09, 72.64] },
  { name: 'Jaipur',      state: 'Rajasthan',      bbox: [26.85, 75.77, 26.93, 75.88] },
  { name: 'Lucknow',     state: 'Uttar Pradesh',  bbox: [26.82, 80.91, 26.92, 81.03] },
  { name: 'Patna',       state: 'Bihar',          bbox: [25.58, 85.10, 25.64, 85.19] },
  { name: 'Bhopal',      state: 'Madhya Pradesh', bbox: [23.22, 77.38, 23.28, 77.46] },
  { name: 'Bhubaneswar', state: 'Odisha',         bbox: [20.26, 85.82, 20.32, 85.88] },
  { name: 'Kochi',       state: 'Kerala',         bbox: [9.95, 76.27, 10.03, 76.34]  },
  { name: 'Guwahati',    state: 'Assam',          bbox: [26.13, 91.72, 26.18, 91.78] },
  { name: 'Chandigarh',  state: 'Punjab',         bbox: [30.72, 76.76, 30.76, 76.82] },
  { name: 'Surat',       state: 'Gujarat',        bbox: [21.17, 72.80, 21.22, 72.87] },
  { name: 'Nagpur',      state: 'Maharashtra',    bbox: [21.12, 79.04, 21.17, 79.11] },
  { name: 'Visakhapatnam', state: 'Andhra Pradesh', bbox: [17.69, 83.29, 17.74, 83.35] },
  { name: 'Indore',      state: 'Madhya Pradesh', bbox: [22.70, 75.85, 22.74, 75.91] },
];

// ── OSM amenity → ResQAI shelter type + defaults ──────────────────────────────

const TYPE_MAP = {
  hospital:         { type: 'hospital',           capacity: 500, amenities: { medical: true, water: true, electricity: true, toilets: true, wheelchairAccessible: true } },
  clinic:           { type: 'hospital',           capacity: 100, amenities: { medical: true, water: true, electricity: true, toilets: true } },
  community_centre: { type: 'community_hall',     capacity: 300, amenities: { water: true, electricity: true, toilets: true } },
  school:           { type: 'school',             capacity: 400, amenities: { water: true, electricity: true, toilets: true } },
  college:          { type: 'school',             capacity: 600, amenities: { water: true, electricity: true, toilets: true } },
  university:       { type: 'school',             capacity: 800, amenities: { water: true, electricity: true, toilets: true } },
  shelter:          { type: 'relief_camp',        capacity: 150, amenities: { food: true, water: true, bedding: true, toilets: true } },
  social_facility:  { type: 'relief_camp',        capacity: 100, amenities: { water: true, toilets: true } },
  stadium:          { type: 'relief_camp',        capacity: 2000,amenities: { water: true, electricity: true, toilets: true } },
  sports_centre:    { type: 'relief_camp',        capacity: 500, amenities: { water: true, electricity: true, toilets: true } },
  government:       { type: 'government_building',capacity: 200, amenities: { water: true, electricity: true, toilets: true } },
};

// ── Overpass API mirrors (tried in order on failure) ─────────────────────────

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

const LIMIT = parseInt(process.env.LIMIT) || 15;

function buildQuery(bbox) {
  const [s, w, n, e] = bbox;
  const box = `${s},${w},${n},${e}`;
  return `[out:json][timeout:20];(node["amenity"~"^(hospital|clinic|community_centre|school|college|shelter|sports_centre|stadium|social_facility)$"]["name"](${box});node["building"~"^(hospital|school|government|university)$"]["name"](${box}););out body 80;`;
}

async function fetchFromMirror(mirrorUrl, query, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${mirrorUrl}?data=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept':     'application/json',
        'User-Agent': 'ResQAI-Seeder/1.0 (Emergency Response Platform; educational project)',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.elements || [];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOverpass(query) {
  for (let i = 0; i < OVERPASS_MIRRORS.length; i++) {
    try {
      return await fetchFromMirror(OVERPASS_MIRRORS[i], query);
    } catch (err) {
      if (i === OVERPASS_MIRRORS.length - 1) throw err;
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

// ── Map OSM node → Shelter document ──────────────────────────────────────────

function toShelter(node, city, state) {
  const tags = node.tags || {};
  const name = tags.name || tags['name:en'];
  if (!name || !node.lat || !node.lon) return null;

  const key  = tags.amenity || tags.building || 'other';
  const meta = TYPE_MAP[key] || { type: 'other', capacity: 200, amenities: {} };

  return {
    name:  name.trim(),
    type:  meta.type,
    status: 'active',
    location: {
      type:        'Point',
      coordinates: [parseFloat(node.lon), parseFloat(node.lat)],
      address:     [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ') || '',
      city,
      state,
      country: 'India',
    },
    totalCapacity:    tags.capacity ? Math.max(10, parseInt(tags.capacity)) || meta.capacity : meta.capacity,
    currentOccupancy: 0,
    amenities:        meta.amenities,
    description:      `${meta.type.replace(/_/g, ' ')} in ${city}`,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n  ResQAI — Real Shelter Seeder (OpenStreetMap)');
  console.log('  ─────────────────────────────────────────────\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('  ✓ MongoDB connected\n');

  if (process.env.CLEAR === 'true') {
    const { deletedCount } = await Shelter.deleteMany({});
    console.log(`  ✓ Cleared ${deletedCount} existing shelter(s)\n`);
  }

  let totalInserted = 0;
  const seen = new Set();

  for (const city of CITIES) {
    process.stdout.write(`  ${city.name.padEnd(16)} … `);
    try {
      const nodes    = await fetchOverpass(buildQuery(city.bbox));
      const shelters = nodes
        .map(n => toShelter(n, city.name, city.state))
        .filter(Boolean)
        .filter(s => {
          const key = `${s.name.toLowerCase()}|${city.name}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, LIMIT);

      if (shelters.length > 0) {
        await Shelter.insertMany(shelters, { ordered: false });
        totalInserted += shelters.length;
        console.log(`${shelters.length} added`);
      } else {
        console.log('none found (no named shelters in OSM for this area)');
      }

      await new Promise(r => setTimeout(r, 2000)); // 2 s between cities
    } catch (err) {
      console.log(`⚠  ${err.message}`);
      await new Promise(r => setTimeout(r, 3000)); // back off on error
    }
  }

  console.log(`\n  ✅  Done — ${totalInserted} real shelter(s) inserted\n`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('\n  ❌  Error:', err.message, '\n');
  process.exit(1);
});
