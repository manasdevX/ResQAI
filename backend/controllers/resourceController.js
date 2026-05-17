import ResourceRequest from '../models/ResourceRequest.js';
import { io } from '../server.js';

// @desc   Create a resource request (citizen)
// @route  POST /api/resources
// @access Private
export const createResourceRequest = async (req, res) => {
  try {
    const { type, description, urgency, location } = req.body;

    if (!type) {
      return res.status(400).json({ success: false, message: 'Resource type is required' });
    }
    if (!location?.coordinates || location.coordinates.length < 2) {
      return res.status(400).json({ success: false, message: 'Location coordinates [lng, lat] are required' });
    }

    const request = await ResourceRequest.create({
      type,
      description: description?.trim(),
      urgency:     urgency || 'medium',
      location,
      requestedBy: req.user._id,
    });

    const populated = await request.populate('requestedBy', 'name phone');
    io.emit('newResourceRequest', populated);

    return res.status(201).json({ success: true, request: populated });
  } catch (error) {
    console.error('[createResourceRequest]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc   Get nearby pending resource requests
// @route  GET /api/resources/nearby?lat=&lng=&maxDistance=
// @access Private
export const getNearbyResourceRequests = async (req, res) => {
  try {
    const { lat, lng, maxDistance = 20000 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'lat and lng are required' });
    }

    const parsedLng = parseFloat(lng);
    const parsedLat = parseFloat(lat);
    if (parsedLng < -180 || parsedLng > 180 || parsedLat < -90 || parsedLat > 90) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates' });
    }

    const requests = await ResourceRequest.find({
      location: {
        $near: {
          $geometry: {
            type:        'Point',
            coordinates: [parsedLng, parsedLat],
          },
          $maxDistance: Math.min(parseInt(maxDistance) || 20000, 200000), // cap at 200 km
        },
      },
      status: 'pending',
    }).populate('requestedBy', 'name phone avatar');

    return res.json({ success: true, count: requests.length, requests });
  } catch (error) {
    console.error('[getNearbyResourceRequests]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch resource requests' });
  }
};

// @desc   Get current user's own resource requests
// @route  GET /api/resources/mine
// @access Private
export const getMyResourceRequests = async (req, res) => {
  try {
    const requests = await ResourceRequest.find({ requestedBy: req.user._id })
      .sort({ createdAt: -1 })
      .populate('fulfilledBy', 'name avatar');

    return res.json({ success: true, requests });
  } catch (error) {
    console.error('[getMyResourceRequests]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch your requests' });
  }
};

// @desc   Get all resource requests (admin)
// @route  GET /api/resources
// @access Private (admin)
export const getAllResourceRequests = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type)   filter.type   = req.query.type;

    const requests = await ResourceRequest.find(filter)
      .sort({ createdAt: -1 })
      .populate('requestedBy', 'name email phone')
      .populate('fulfilledBy', 'name');

    return res.json({ success: true, count: requests.length, requests });
  } catch (error) {
    console.error('[getAllResourceRequests]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch requests' });
  }
};

// @desc   Fulfill a resource request (volunteer)
// @route  PATCH /api/resources/:id/fulfill
// @access Private
export const fulfillResourceRequest = async (req, res) => {
  try {
    const request = await ResourceRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Resource request not found' });
    }
    if (request.status === 'fulfilled') {
      return res.status(400).json({ success: false, message: 'This request has already been fulfilled' });
    }

    request.status      = 'fulfilled';
    request.fulfilledBy = req.user._id;
    request.fulfilledAt = new Date();
    await request.save();

    io.emit('resourceRequestFulfilled', {
      requestId:   request._id,
      fulfilledBy: req.user.name,
    });

    return res.json({ success: true, request });
  } catch (error) {
    console.error('[fulfillResourceRequest]', error);
    return res.status(500).json({ success: false, message: 'Failed to fulfill request' });
  }
};
