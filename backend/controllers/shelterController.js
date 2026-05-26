import Shelter from '../models/Shelter.js';
import User from '../models/User.js';
import { io } from '../server.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

const safeParse = (value, fallback) => {
  if (typeof value !== 'string') return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};

// ── Controllers ────────────────────────────────────────────────────────────────

/**
 * @desc  Get all shelters (with optional status / type filters)
 * @route GET /api/shelters
 * @access Private
 */
export const getAllShelters = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type)   filter.type   = req.query.type;

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip  = (page - 1) * limit;

    const [shelters, total] = await Promise.all([
      Shelter.find(filter)
        .populate('managedBy', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Shelter.countDocuments(filter),
    ]);

    const myCheckedIn = await Shelter.findOne({ registeredOccupants: req.user._id }).select('_id');

    return res.status(200).json({
      success:             true,
      count:               shelters.length,
      total,
      page,
      pages:               Math.ceil(total / limit),
      hasMore:             skip + shelters.length < total,
      myCheckedInShelterId: myCheckedIn?._id || null,
      shelters,
    });
  } catch (error) {
    console.error('[getAllShelters]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch shelters' });
  }
};

/**
 * @desc  Get a single shelter by ID
 * @route GET /api/shelters/:id
 * @access Private
 */
export const getShelterById = async (req, res) => {
  try {
    const shelter = await Shelter.findById(req.params.id)
      .populate('managedBy', 'name email phone')
      .populate('registeredOccupants', 'name email');

    if (!shelter) return res.status(404).json({ success: false, message: 'Shelter not found' });
    return res.status(200).json({ success: true, shelter });
  } catch (error) {
    console.error('[getShelterById]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch shelter' });
  }
};

/**
 * @desc  Get nearby active shelters within a radius
 * @route GET /api/shelters/nearby?lng=&lat=&maxDistance=&type=
 * @access Private
 */
export const getNearbyShelters = async (req, res) => {
  try {
    const { lng, lat, maxDistance = 50000, type } = req.query; // default 50 km

    if (!lng || !lat) {
      return res.status(400).json({ success: false, message: 'lng and lat query params are required' });
    }

    const parsedLng = parseFloat(lng);
    const parsedLat = parseFloat(lat);
    if (parsedLng < -180 || parsedLng > 180 || parsedLat < -90 || parsedLat > 90) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates' });
    }

    const geoQuery = {
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parsedLng, parsedLat] },
          $maxDistance: Math.min(parseInt(maxDistance) || 50000, 500000), // cap at 500 km
        },
      },
      status: { $in: ['active', 'preparing'] },
    };

    if (type) geoQuery.type = type;

    const shelters = await Shelter.find(geoQuery)
      .select('-registeredOccupants -linkedIncidents')
      .populate('managedBy', 'name phone');

    // Append distance (straight-line km) to each shelter for the UI
    const userLat = parsedLat;
    const userLng = parsedLng;
    const withDist = shelters.map((s) => {
      const [sLng, sLat] = s.location.coordinates;
      const R = 6371;
      const dLat = ((sLat - userLat) * Math.PI) / 180;
      const dLon = ((sLng - userLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((userLat * Math.PI) / 180) *
          Math.cos((sLat * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { ...s.toJSON(), distanceKm: Math.round(distKm * 10) / 10 };
    });

    return res.status(200).json({ success: true, count: withDist.length, shelters: withDist });
  } catch (error) {
    console.error('[getNearbyShelters]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch nearby shelters' });
  }
};

/**
 * @desc  Create a new shelter
 * @route POST /api/shelters
 * @access Private (admin / shelter_manager)
 */
export const createShelter = async (req, res) => {
  try {
    let { name, type, location, totalCapacity, description, amenities, contacts } = req.body;

    if (!name?.trim())    return res.status(400).json({ success: false, message: 'Shelter name is required' });
    if (!location)        return res.status(400).json({ success: false, message: 'Location is required' });
    if (!totalCapacity)   return res.status(400).json({ success: false, message: 'Total capacity is required' });

    location  = safeParse(location,  null);
    amenities = safeParse(amenities, {});
    contacts  = safeParse(contacts,  []);

    if (!location?.coordinates?.length) {
      return res.status(400).json({ success: false, message: 'Invalid location coordinates' });
    }

    const shelter = await Shelter.create({
      name:          name.trim(),
      type:          type || 'relief_camp',
      location,
      totalCapacity: Number(totalCapacity),
      description:   description?.trim(),
      amenities,
      contacts,
      managedBy:     req.user._id,
    });

    io.emit('shelterCreated', shelter);

    return res.status(201).json({ success: true, message: 'Shelter created', shelter });
  } catch (error) {
    console.error('[createShelter]', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create shelter' });
  }
};

/**
 * @desc  Update shelter occupancy (check-in / check-out)
 * @route PATCH /api/shelters/:id/occupancy
 * @access Private (admin / shelter_manager — own shelter only)
 */
export const updateOccupancy = async (req, res) => {
  try {
    // Accept either an absolute value (currentOccupancy) or a delta (+/-N)
    const { delta, currentOccupancy: absoluteOcc } = req.body;

    if (absoluteOcc === undefined && typeof delta !== 'number') {
      return res.status(400).json({ success: false, message: 'Provide either "currentOccupancy" (absolute) or "delta" (±N)' });
    }

    const shelter = await Shelter.findById(req.params.id);
    if (!shelter) return res.status(404).json({ success: false, message: 'Shelter not found' });

    // Shelter managers can only update shelters they manage
    if (
      req.user.role === 'shelter_manager' &&
      shelter.managedBy?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'You can only manage your own shelter' });
    }

    const newOccupancy = absoluteOcc !== undefined
      ? Number(absoluteOcc)
      : shelter.currentOccupancy + delta;

    if (newOccupancy < 0) {
      return res.status(400).json({ success: false, message: 'Occupancy cannot go below 0' });
    }
    if (newOccupancy > shelter.totalCapacity) {
      return res.status(400).json({ success: false, message: `Exceeds total capacity (${shelter.totalCapacity})` });
    }

    shelter.currentOccupancy = newOccupancy;
    // Auto-update status based on occupancy
    if (newOccupancy >= shelter.totalCapacity && shelter.status === 'active') {
      shelter.status = 'full';
    } else if (newOccupancy < shelter.totalCapacity && shelter.status === 'full') {
      shelter.status = 'active';
    }
    const updated = await shelter.save();

    io.emit('shelterUpdated', { shelterId: updated._id, currentOccupancy: updated.currentOccupancy, status: updated.status });

    return res.status(200).json({ success: true, shelter: updated });
  } catch (error) {
    console.error('[updateOccupancy]', error);
    return res.status(500).json({ success: false, message: 'Failed to update occupancy' });
  }
};


/**
 * @desc  Update shelter status
 * @route PATCH /api/shelters/:id/status
 * @access Private (admin / shelter_manager — own shelter only)
 */
export const updateShelterStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const VALID = ['active', 'full', 'closed', 'preparing'];
    if (!VALID.includes(status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${VALID.join(', ')}` });
    }

    // Fetch first so we can apply the ownership check
    const existing = await Shelter.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Shelter not found' });

    if (
      req.user.role === 'shelter_manager' &&
      existing.managedBy?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'You can only manage your own shelter' });
    }

    const shelter = await Shelter.findByIdAndUpdate(
      req.params.id,
      { status, ...(status === 'closed' ? { closedAt: new Date() } : {}) },
      { new: true, runValidators: true }
    );
    if (!shelter) return res.status(404).json({ success: false, message: 'Shelter not found' });

    io.emit('shelterUpdated', { shelterId: shelter._id, status });

    return res.status(200).json({ success: true, shelter });
  } catch (error) {
    console.error('[updateShelterStatus]', error);
    return res.status(500).json({ success: false, message: 'Failed to update status' });
  }
};

/**
 * @desc  Get real hospitals/shelters from OpenStreetMap Overpass API (no API key required)
 * @route GET /api/shelters/places?lat=&lng=&type=&radius=
 * @access Private
 */
export const getNearbyPlaces = async (req, res) => {
  try {
    const { lat, lng, type = 'hospital', radius = 5000 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'lat and lng are required' });
    }
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (parsedLng < -180 || parsedLng > 180 || parsedLat < -90 || parsedLat > 90) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates' });
    }

    const radiusMetres = Math.min(parseInt(radius) || 5000, 50000);

    // Map our type aliases → OSM amenity/healthcare tags
    const OSM_TAG_MAP = {
      hospital:       '["amenity"="hospital"]',
      clinic:         '["amenity"="clinic"]',
      pharmacy:       '["amenity"="pharmacy"]',
      fire_station:   '["amenity"="fire_station"]',
      police:         '["amenity"="police"]',
      shelter:        '["social_facility"="shelter"]',
      school:         '["amenity"="school"]',
      community_hall: '["amenity"="community_hall"]',
    };

    const osmFilter = OSM_TAG_MAP[type] || `["amenity"="${type}"]`;

    // Overpass QL — fetch nodes + ways near the user
    const query = `
      [out:json][timeout:15];
      (
        node${osmFilter}(around:${radiusMetres},${parsedLat},${parsedLng});
        way${osmFilter}(around:${radiusMetres},${parsedLat},${parsedLng});
      );
      out center tags 20;
    `;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    `data=${encodeURIComponent(query)}`,
      signal:  AbortSignal.timeout(18000),
    });

    if (!response.ok) {
      console.warn('[getNearbyPlaces] Overpass error:', response.status);
      return res.json({ success: true, places: [], source: 'overpass' });
    }

    const data     = await response.json();
    const elements = data.elements || [];

    const places = elements
      .map((el) => {
        // Ways have a `center` object; nodes have `lat`/`lon` directly
        const elLat = el.lat ?? el.center?.lat;
        const elLon = el.lon ?? el.center?.lon;
        if (!elLat || !elLon) return null;

        const tags = el.tags || {};
        const name = tags.name || tags['name:en'] || `${type.charAt(0).toUpperCase() + type.slice(1)} (unnamed)`;

        // Haversine distance
        const R    = 6371000;
        const dLat = ((elLat - parsedLat) * Math.PI) / 180;
        const dLon = ((elLon - parsedLng) * Math.PI) / 180;
        const a    =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((parsedLat * Math.PI) / 180) *
            Math.cos((elLat * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
        const distanceM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return {
          placeId:    `osm:${el.type}:${el.id}`,
          name,
          vicinity:   [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']].filter(Boolean).join(', ') || tags['addr:full'] || '',
          location:   { type: 'Point', coordinates: [elLon, elLat] },
          distanceM:  Math.round(distanceM),
          distanceKm: Math.round(distanceM / 100) / 10,
          phone:      tags.phone || tags['contact:phone'] || null,
          website:    tags.website || tags['contact:website'] || null,
          opening:    tags.opening_hours || null,
          types:      [type],
          source:     'openstreetmap',
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceM - b.distanceM);

    return res.json({ success: true, count: places.length, places, source: 'overpass' });
  } catch (error) {
    console.error('[getNearbyPlaces]', error);
    // Return empty gracefully — never crash the shelter page
    return res.json({ success: true, places: [], source: 'overpass' });
  }
};

/**
 * @desc  Update shelter details
 * @route PUT /api/shelters/:id
 * @access Private (admin / shelter_manager — own shelter only)
 */
export const updateShelter = async (req, res) => {
  try {
    let { name, type, location, totalCapacity, description, amenities, contacts } = req.body;

    if (name !== undefined && !name?.trim()) {
      return res.status(400).json({ success: false, message: 'Shelter name cannot be empty' });
    }

    // Ownership check: fetch shelter before updating
    const existing = await Shelter.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Shelter not found' });

    if (
      req.user.role === 'shelter_manager' &&
      existing.managedBy?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'You can only manage your own shelter' });
    }

    location  = location  ? safeParse(location,  null) : undefined;
    amenities = amenities ? safeParse(amenities, {})   : undefined;
    contacts  = contacts  ? safeParse(contacts,  [])   : undefined;

    if (location !== undefined && !location?.coordinates?.length) {
      return res.status(400).json({ success: false, message: 'Invalid location coordinates' });
    }

    const updates = {};
    if (name          !== undefined) updates.name          = name.trim();
    if (type          !== undefined) updates.type          = type;
    if (location      !== undefined) updates.location      = location;
    if (totalCapacity !== undefined) updates.totalCapacity = Number(totalCapacity);
    if (description   !== undefined) updates.description   = description?.trim();
    if (amenities     !== undefined) updates.amenities     = amenities;
    if (contacts      !== undefined) updates.contacts      = contacts;

    const shelter = await Shelter.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('managedBy', 'name email phone');

    if (!shelter) return res.status(404).json({ success: false, message: 'Shelter not found' });

    io.emit('shelterUpdated', shelter);

    return res.status(200).json({ success: true, message: 'Shelter updated', shelter });
  } catch (error) {
    console.error('[updateShelter]', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update shelter' });
  }
};

/**
 * @desc  Delete a shelter
 * @route DELETE /api/shelters/:id
 * @access Private (admin only)
 */
export const deleteShelter = async (req, res) => {
  try {
    const shelter = await Shelter.findByIdAndDelete(req.params.id);
    if (!shelter) return res.status(404).json({ success: false, message: 'Shelter not found' });

    io.emit('shelterDeleted', { shelterId: req.params.id });

    return res.status(200).json({ success: true, message: 'Shelter deleted' });
  } catch (error) {
    console.error('[deleteShelter]', error);
    return res.status(500).json({ success: false, message: 'Failed to delete shelter' });
  }
};

/**
 * @desc  Citizen checks in to a shelter
 * @route POST /api/shelters/:id/checkin
 * @access Private
 */
export const checkInShelter = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Pre-check: user already checked in elsewhere
    const elsewhere = await Shelter.findOne({ registeredOccupants: userId, _id: { $ne: id } }).select('name');
    if (elsewhere) {
      return res.status(409).json({
        success: false,
        message: `You are already checked in to "${elsewhere.name}". Please check out first.`,
      });
    }

    // Atomic check-in: only succeeds if shelter is open, has capacity, and user not already registered.
    // $expr compares currentOccupancy < totalCapacity at the DB level so two concurrent requests
    // cannot both add themselves when only 1 spot remains.
    const shelter = await Shelter.findOneAndUpdate(
      {
        _id:    id,
        status: { $in: ['active', 'preparing'] },
        registeredOccupants: { $ne: userId },
        $expr:  { $lt: ['$currentOccupancy', '$totalCapacity'] },
      },
      {
        $addToSet: { registeredOccupants: userId },
        $inc:      { currentOccupancy: 1 },
      },
      { new: true }
    );

    if (!shelter) {
      // Distinguish the failure reason
      const existing = await Shelter.findById(id).select('status currentOccupancy totalCapacity registeredOccupants');
      if (!existing)                                                    return res.status(404).json({ success: false, message: 'Shelter not found' });
      if (existing.status === 'closed')                                 return res.status(400).json({ success: false, message: 'This shelter is closed' });
      if (existing.registeredOccupants.some(u => u.equals(userId)))    return res.json({ success: true, message: 'Already checked in', shelter: existing });
      return res.status(400).json({ success: false, message: 'This shelter is full' });
    }

    // Auto-mark full if at capacity after this check-in
    if (shelter.autoCloseWhenFull && shelter.currentOccupancy >= shelter.totalCapacity && shelter.status === 'active') {
      shelter.status = 'full';
      await shelter.save();
    }

    io.emit('shelterOccupancyUpdated', {
      shelterId:        id,
      currentOccupancy: shelter.currentOccupancy,
      status:           shelter.status,
    });

    return res.json({ success: true, message: `Checked in to ${shelter.name}`, shelter });
  } catch (error) {
    console.error('[checkInShelter]', error);
    return res.status(500).json({ success: false, message: 'Failed to check in' });
  }
};

/**
 * @desc  Citizen checks out of a shelter
 * @route POST /api/shelters/:id/checkout
 * @access Private
 */
export const checkOutShelter = async (req, res) => {
  try {
    const { id }   = req.params;
    const userId   = req.user._id;

    const shelter = await Shelter.findById(id);
    if (!shelter) return res.status(404).json({ success: false, message: 'Shelter not found' });

    if (!shelter.registeredOccupants.some(uid => uid.equals(userId))) {
      return res.status(400).json({ success: false, message: 'You are not checked in to this shelter' });
    }

    shelter.registeredOccupants = shelter.registeredOccupants.filter(uid => !uid.equals(userId));
    shelter.currentOccupancy    = shelter.registeredOccupants.length;
    if (shelter.status === 'full') shelter.status = 'active';
    await shelter.save();

    io.emit('shelterOccupancyUpdated', {
      shelterId:        id,
      currentOccupancy: shelter.currentOccupancy,
      status:           shelter.status,
    });

    return res.json({ success: true, message: `Checked out of ${shelter.name}`, shelter });
  } catch (error) {
    console.error('[checkOutShelter]', error);
    return res.status(500).json({ success: false, message: 'Failed to check out' });
  }
};

/**
 * @desc  Get the shelter managed by the current user
 * @route GET /api/shelters/mine
 * @access Private (shelter_manager)
 */
export const getMyShelter = async (req, res) => {
  try {
    const shelter = await Shelter.findOne({ managedBy: req.user._id })
      .populate('managedBy', 'name email phone')
      .populate('registeredOccupants', 'name email avatar');

    if (!shelter) {
      return res.json({ success: true, shelter: null, message: 'No shelter assigned to you yet. Ask an admin to assign one.' });
    }

    return res.json({ success: true, shelter });
  } catch (error) {
    console.error('[getMyShelter]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch your shelter' });
  }
};

/**
 * @desc  Assign (or unassign) a shelter_manager to a shelter
 * @route PATCH /api/shelters/:id/assign-manager
 * @access Private (admin only)
 */
export const assignShelterManager = async (req, res) => {
  try {
    const { managerId } = req.body; // null to unassign

    const shelter = await Shelter.findById(req.params.id);
    if (!shelter) return res.status(404).json({ success: false, message: 'Shelter not found' });

    if (managerId) {
      // Validate the user exists and has the right role
      const manager = await User.findById(managerId).select('name email role');
      if (!manager) return res.status(404).json({ success: false, message: 'User not found' });
      if (manager.role !== 'shelter_manager') {
        return res.status(400).json({ success: false, message: 'User must have the shelter_manager role' });
      }

      // Remove this manager from any other shelter they were previously managing
      await Shelter.updateMany(
        { managedBy: managerId, _id: { $ne: shelter._id } },
        { $unset: { managedBy: '' } }
      );

      shelter.managedBy = managerId;
    } else {
      shelter.managedBy = undefined;
    }

    await shelter.save();

    const updated = await Shelter.findById(shelter._id).populate('managedBy', 'name email phone');
    io.emit('shelterUpdated', { shelterId: updated._id, managedBy: updated.managedBy });

    return res.json({ success: true, message: managerId ? 'Manager assigned' : 'Manager unassigned', shelter: updated });
  } catch (error) {
    console.error('[assignShelterManager]', error);
    return res.status(500).json({ success: false, message: 'Failed to assign manager' });
  }
};

