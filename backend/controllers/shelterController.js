import Shelter from '../models/Shelter.js';
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

    const shelters = await Shelter.find(filter)
      .populate('managedBy', 'name email phone')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, count: shelters.length, shelters });
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
    const { delta } = req.body; // +1 check-in, -1 check-out, any integer
    if (typeof delta !== 'number') {
      return res.status(400).json({ success: false, message: '"delta" must be a number (e.g. 1 or -1)' });
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

    const newOccupancy = shelter.currentOccupancy + delta;
    if (newOccupancy < 0) {
      return res.status(400).json({ success: false, message: 'Occupancy cannot go below 0' });
    }
    if (newOccupancy > shelter.totalCapacity) {
      return res.status(400).json({ success: false, message: 'Exceeds total capacity' });
    }

    shelter.currentOccupancy = newOccupancy;
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
 * @desc  Get real hospitals/shelters from Google Places API
 * @route GET /api/shelters/places?lat=&lng=&type=&radius=
 * @access Private
 */
export const getNearbyPlaces = async (req, res) => {
  try {
    const { lat, lng, type = 'hospital', radius = 5000 } = req.query;
    const key = process.env.GOOGLE_MAPS_API_KEY;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'lat and lng are required' });
    }
    const parsedPlacesLng = parseFloat(lng);
    const parsedPlacesLat = parseFloat(lat);
    if (parsedPlacesLng < -180 || parsedPlacesLng > 180 || parsedPlacesLat < -90 || parsedPlacesLat > 90) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates' });
    }
    if (!key) {
      return res.status(503).json({ success: false, message: 'Nearby places search is not available (Google Maps API key not configured)' });
    }

    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${Math.min(parseInt(radius), 50000)}&type=${type}&key=${key}`;
    const response = await fetch(url);
    const data     = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[getNearbyPlaces] Google API error:', data.status, data.error_message);
      return res.json({ success: true, places: [] });
    }

    const places = (data.results || []).map(p => ({
      placeId:  p.place_id,
      name:     p.name,
      vicinity: p.vicinity,
      location: {
        type:        'Point',
        coordinates: [p.geometry.location.lng, p.geometry.location.lat],
      },
      rating:   p.rating || null,
      isOpen:   p.opening_hours?.open_now ?? null,
      types:    p.types || [],
      icon:     p.icon,
    }));

    return res.json({ success: true, count: places.length, places });
  } catch (error) {
    console.error('[getNearbyPlaces]', error);
    return res.json({ success: true, places: [] });
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
