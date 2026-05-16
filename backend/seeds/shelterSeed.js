/**
 * ResQAI — Shelter Seeder
 * Run: node seeds/shelterSeed.js
 *
 * Seeds the database with realistic Indian emergency shelters and hospitals.
 * Safe to re-run: checks for duplicates by name before inserting.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env'), quiet: true });

import Shelter from '../models/Shelter.js';

const SHELTERS = [
  // ── Delhi NCR ────────────────────────────────────────────────────────────────
  {
    name: 'AIIMS New Delhi Emergency Shelter',
    type: 'hospital',
    status: 'active',
    location: { type: 'Point', coordinates: [77.2100, 28.5672], address: 'Ansari Nagar, New Delhi', city: 'New Delhi', state: 'Delhi', country: 'India' },
    totalCapacity: 500, currentOccupancy: 120,
    description: 'Premier government hospital with dedicated disaster relief wing and trauma centre.',
    amenities: { food: true, water: true, medical: true, electricity: true, wifi: true, toilets: true, bedding: true, childCare: false, petFriendly: false, wheelchairAccessible: true },
    contacts: [{ name: 'Dr. Priya Sharma', phone: '+91-11-26588500', role: 'Disaster Coordinator' }],
  },
  {
    name: 'Ramlila Maidan Relief Camp',
    type: 'relief_camp',
    status: 'active',
    location: { type: 'Point', coordinates: [77.2373, 28.6389], address: 'Ramlila Maidan, Old Delhi', city: 'New Delhi', state: 'Delhi', country: 'India' },
    totalCapacity: 2000, currentOccupancy: 340,
    description: 'Large open ground converted to emergency shelter with tents, food, and medical aid.',
    amenities: { food: true, water: true, medical: true, electricity: true, wifi: false, toilets: true, bedding: true, childCare: true, petFriendly: true, wheelchairAccessible: false },
    contacts: [{ name: 'Rajesh Kumar', phone: '+91-11-23392461', role: 'Camp Manager' }],
  },
  {
    name: 'Jawaharlal Nehru Stadium Shelter',
    type: 'community_hall',
    status: 'active',
    location: { type: 'Point', coordinates: [77.2373, 28.5865], address: 'Lodhi Road, New Delhi', city: 'New Delhi', state: 'Delhi', country: 'India' },
    totalCapacity: 1500, currentOccupancy: 875,
    description: 'Indoor stadium repurposed as large-scale evacuation shelter with full facilities.',
    amenities: { food: true, water: true, medical: true, electricity: true, wifi: true, toilets: true, bedding: true, childCare: true, petFriendly: false, wheelchairAccessible: true },
    contacts: [{ name: 'Sunita Verma', phone: '+91-11-24362100', role: 'Facility Manager' }],
  },

  // ── Mumbai ────────────────────────────────────────────────────────────────────
  {
    name: 'KEM Hospital Disaster Relief Center',
    type: 'hospital',
    status: 'active',
    location: { type: 'Point', coordinates: [72.8426, 19.0038], address: 'Acharya Donde Marg, Parel, Mumbai', city: 'Mumbai', state: 'Maharashtra', country: 'India' },
    totalCapacity: 800, currentOccupancy: 290,
    description: 'Major trauma hospital with 24/7 disaster response team and dedicated flood relief facilities.',
    amenities: { food: true, water: true, medical: true, electricity: true, wifi: true, toilets: true, bedding: true, childCare: false, petFriendly: false, wheelchairAccessible: true },
    contacts: [{ name: 'Dr. Anand Desai', phone: '+91-22-24136051', role: 'Emergency Head' }],
  },
  {
    name: 'NSCI Dome Evacuation Camp',
    type: 'community_hall',
    status: 'active',
    location: { type: 'Point', coordinates: [72.8467, 19.0760], address: 'Worli, Mumbai', city: 'Mumbai', state: 'Maharashtra', country: 'India' },
    totalCapacity: 3000, currentOccupancy: 1200,
    description: 'Iconic dome venue converted into large-scale disaster shelter with climate control.',
    amenities: { food: true, water: true, medical: true, electricity: true, wifi: true, toilets: true, bedding: true, childCare: true, petFriendly: false, wheelchairAccessible: true },
    contacts: [{ name: 'Pradeep Nair', phone: '+91-22-24921323', role: 'Operations Lead' }],
  },
  {
    name: 'Dharavi Community Relief Camp',
    type: 'relief_camp',
    status: 'active',
    location: { type: 'Point', coordinates: [72.8530, 19.0390], address: 'Dharavi, Mumbai', city: 'Mumbai', state: 'Maharashtra', country: 'India' },
    totalCapacity: 1000, currentOccupancy: 860,
    description: 'Ground-level relief camp serving densely populated areas. High occupancy during floods.',
    amenities: { food: true, water: true, medical: false, electricity: true, wifi: false, toilets: true, bedding: false, childCare: false, petFriendly: false, wheelchairAccessible: false },
    contacts: [{ name: 'Raju Kamble', phone: '+91-22-24041414', role: 'Camp Coordinator' }],
  },

  // ── Bangalore ─────────────────────────────────────────────────────────────────
  {
    name: 'Nimhans Disaster Management Center',
    type: 'hospital',
    status: 'active',
    location: { type: 'Point', coordinates: [77.5937, 12.9387], address: 'Hosur Road, Bangalore', city: 'Bengaluru', state: 'Karnataka', country: 'India' },
    totalCapacity: 600, currentOccupancy: 145,
    description: 'National Institute of Mental Health with specialized disaster trauma care unit.',
    amenities: { food: true, water: true, medical: true, electricity: true, wifi: true, toilets: true, bedding: true, childCare: false, petFriendly: false, wheelchairAccessible: true },
    contacts: [{ name: 'Dr. Kavitha Rao', phone: '+91-80-46110007', role: 'Trauma Lead' }],
  },
  {
    name: 'Kanteerava Stadium Shelter',
    type: 'community_hall',
    status: 'preparing',
    location: { type: 'Point', coordinates: [77.5963, 12.9767], address: 'Kasturba Road, Bangalore', city: 'Bengaluru', state: 'Karnataka', country: 'India' },
    totalCapacity: 5000, currentOccupancy: 0,
    description: 'Largest multi-purpose stadium in Karnataka. Being prepared for monsoon disaster response.',
    amenities: { food: false, water: true, medical: false, electricity: true, wifi: false, toilets: true, bedding: false, childCare: false, petFriendly: false, wheelchairAccessible: true },
    contacts: [{ name: 'S. Krishnamurthy', phone: '+91-80-22238750', role: 'Stadium Director' }],
  },

  // ── Chennai ───────────────────────────────────────────────────────────────────
  {
    name: 'Rajiv Gandhi Government General Hospital',
    type: 'hospital',
    status: 'active',
    location: { type: 'Point', coordinates: [80.2758, 13.0786], address: 'Park Town, Chennai', city: 'Chennai', state: 'Tamil Nadu', country: 'India' },
    totalCapacity: 700, currentOccupancy: 310,
    description: 'Primary government hospital serving North Chennai with dedicated cyclone response team.',
    amenities: { food: true, water: true, medical: true, electricity: true, wifi: false, toilets: true, bedding: true, childCare: false, petFriendly: false, wheelchairAccessible: true },
    contacts: [{ name: 'Dr. Murali Krishnan', phone: '+91-44-25305000', role: 'Disaster Nodal Officer' }],
  },
  {
    name: 'YMCA Grounds Cyclone Relief Camp',
    type: 'relief_camp',
    status: 'active',
    location: { type: 'Point', coordinates: [80.2707, 13.0716], address: 'Nandanam, Chennai', city: 'Chennai', state: 'Tamil Nadu', country: 'India' },
    totalCapacity: 1200, currentOccupancy: 480,
    description: 'Open ground converted to relief camp during cyclone and flood events.',
    amenities: { food: true, water: true, medical: true, electricity: true, wifi: false, toilets: true, bedding: true, childCare: true, petFriendly: false, wheelchairAccessible: false },
    contacts: [{ name: 'A. Sundarajan', phone: '+91-44-24330252', role: 'Camp Manager' }],
  },

  // ── Kolkata ───────────────────────────────────────────────────────────────────
  {
    name: 'SSKM Medical College & Hospital',
    type: 'hospital',
    status: 'active',
    location: { type: 'Point', coordinates: [88.3421, 22.5298], address: 'AJC Bose Road, Kolkata', city: 'Kolkata', state: 'West Bengal', country: 'India' },
    totalCapacity: 900, currentOccupancy: 567,
    description: 'Largest government hospital in Eastern India with active cyclone and flood response protocols.',
    amenities: { food: true, water: true, medical: true, electricity: true, wifi: true, toilets: true, bedding: true, childCare: false, petFriendly: false, wheelchairAccessible: true },
    contacts: [{ name: 'Dr. Amit Ghosh', phone: '+91-33-22041054', role: 'Emergency Director' }],
  },
  {
    name: 'Salt Lake Stadium Relief Centre',
    type: 'community_hall',
    status: 'active',
    location: { type: 'Point', coordinates: [88.3974, 22.5789], address: 'Salt Lake City, Kolkata', city: 'Kolkata', state: 'West Bengal', country: 'India' },
    totalCapacity: 4000, currentOccupancy: 1100,
    description: 'Iconic football stadium serving as major cyclone shelter for East Kolkata residents.',
    amenities: { food: true, water: true, medical: true, electricity: true, wifi: false, toilets: true, bedding: true, childCare: true, petFriendly: false, wheelchairAccessible: false },
    contacts: [{ name: 'Debasis Majumdar', phone: '+91-33-23371096', role: 'Relief Coordinator' }],
  },

  // ── Hyderabad ─────────────────────────────────────────────────────────────────
  {
    name: 'Gandhi Hospital Disaster Unit',
    type: 'hospital',
    status: 'active',
    location: { type: 'Point', coordinates: [78.4960, 17.4062], address: 'Musheerabad, Hyderabad', city: 'Hyderabad', state: 'Telangana', country: 'India' },
    totalCapacity: 650, currentOccupancy: 200,
    description: 'State-level government hospital with specialized disaster management unit.',
    amenities: { food: true, water: true, medical: true, electricity: true, wifi: true, toilets: true, bedding: true, childCare: false, petFriendly: false, wheelchairAccessible: true },
    contacts: [{ name: 'Dr. Srinivas Reddy', phone: '+91-40-27505566', role: 'Disaster Nodal Officer' }],
  },
  {
    name: 'Lal Bahadur Stadium Shelter',
    type: 'community_hall',
    status: 'active',
    location: { type: 'Point', coordinates: [78.4762, 17.3850], address: 'Fateh Maidan, Hyderabad', city: 'Hyderabad', state: 'Telangana', country: 'India' },
    totalCapacity: 2500, currentOccupancy: 0,
    description: 'Multi-purpose indoor stadium activated during heavy rainfall and urban flooding.',
    amenities: { food: true, water: true, medical: false, electricity: true, wifi: false, toilets: true, bedding: false, childCare: false, petFriendly: false, wheelchairAccessible: true },
    contacts: [{ name: 'K. Venugopal', phone: '+91-40-23220990', role: 'Manager' }],
  },

  // ── Ahmedabad ─────────────────────────────────────────────────────────────────
  {
    name: 'SVP Hospital Emergency Shelter',
    type: 'hospital',
    status: 'active',
    location: { type: 'Point', coordinates: [72.5714, 23.0225], address: 'Ellis Bridge, Ahmedabad', city: 'Ahmedabad', state: 'Gujarat', country: 'India' },
    totalCapacity: 550, currentOccupancy: 180,
    description: 'Major civic hospital serving as primary relief centre during earthquake and flood events.',
    amenities: { food: true, water: true, medical: true, electricity: true, wifi: false, toilets: true, bedding: true, childCare: false, petFriendly: false, wheelchairAccessible: true },
    contacts: [{ name: 'Dr. Bhavesh Patel', phone: '+91-79-22684433', role: 'Emergency Coordinator' }],
  },

  // ── Jaipur ────────────────────────────────────────────────────────────────────
  {
    name: 'SMS Hospital Relief Camp',
    type: 'hospital',
    status: 'active',
    location: { type: 'Point', coordinates: [75.8060, 26.9145], address: 'JLN Marg, Jaipur', city: 'Jaipur', state: 'Rajasthan', country: 'India' },
    totalCapacity: 600, currentOccupancy: 220,
    description: 'Sawai Man Singh Hospital — largest in Rajasthan with active disaster response protocols.',
    amenities: { food: true, water: true, medical: true, electricity: true, wifi: true, toilets: true, bedding: true, childCare: false, petFriendly: false, wheelchairAccessible: true },
    contacts: [{ name: 'Dr. Mahesh Sharma', phone: '+91-141-2518501', role: 'Emergency Head' }],
  },

  // ── Bhubaneswar (high cyclone risk) ──────────────────────────────────────────
  {
    name: 'Kalinga Institute Relief Centre',
    type: 'school',
    status: 'active',
    location: { type: 'Point', coordinates: [85.8245, 20.3539], address: 'Patia, Bhubaneswar', city: 'Bhubaneswar', state: 'Odisha', country: 'India' },
    totalCapacity: 3000, currentOccupancy: 0,
    description: 'Large university campus activated as cyclone shelter — proven during Cyclone Fani response.',
    amenities: { food: true, water: true, medical: true, electricity: true, wifi: true, toilets: true, bedding: true, childCare: true, petFriendly: true, wheelchairAccessible: false },
    contacts: [{ name: 'Achyuta Samanta', phone: '+91-674-2725113', role: 'Shelter Director' }],
  },
  {
    name: 'SCB Medical College Cyclone Ward',
    type: 'hospital',
    status: 'active',
    location: { type: 'Point', coordinates: [85.8313, 20.4786], address: 'Manglabag, Cuttack', city: 'Cuttack', state: 'Odisha', country: 'India' },
    totalCapacity: 800, currentOccupancy: 312,
    description: 'Premier medical college hospital with dedicated post-cyclone trauma wing.',
    amenities: { food: true, water: true, medical: true, electricity: true, wifi: false, toilets: true, bedding: true, childCare: false, petFriendly: false, wheelchairAccessible: true },
    contacts: [{ name: 'Dr. Subrat Panda', phone: '+91-671-2414373', role: 'Disaster Nodal Officer' }],
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    let added = 0, skipped = 0;

    for (const shelterData of SHELTERS) {
      const exists = await Shelter.findOne({ name: shelterData.name });
      if (exists) {
        console.log(`  ⏭  Skipped (exists): ${shelterData.name}`);
        skipped++;
        continue;
      }
      await Shelter.create(shelterData);
      console.log(`  ✚  Added: ${shelterData.name}`);
      added++;
    }

    console.log(`\n🎉 Seeding complete — ${added} added, ${skipped} skipped`);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
