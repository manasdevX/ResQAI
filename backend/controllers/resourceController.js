import mongoose from 'mongoose';
import ResourceRequest from '../models/ResourceRequest.js';
import User from '../models/User.js';
import { io } from '../server.js';

const badId = (res) => res.status(400).json({ success: false, message: 'Invalid ID format' });

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
      // Show both pending AND acknowledged so responders can see in-progress requests
      status: { $in: ['pending', 'acknowledged'] },
    })
      .populate('requestedBy', 'name phone avatar')
      .populate('acknowledgedBy', 'name avatar');

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
      .populate('requestedBy', 'name phone avatar')
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

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip  = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      ResourceRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('requestedBy', 'name email phone')
        .populate('fulfilledBy', 'name'),
      ResourceRequest.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      count:   requests.length,
      total,
      page,
      pages:   Math.ceil(total / limit),
      hasMore: skip + requests.length < total,
      requests,
    });
  } catch (error) {
    console.error('[getAllResourceRequests]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch requests' });
  }
};

// @desc   Acknowledge a resource request (volunteer — confirms receipt, marks in-progress)
// @route  PATCH /api/resources/:id/acknowledge
// @access Private
export const acknowledgeResourceRequest = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return badId(res);

    const request = await ResourceRequest.findOneAndUpdate(
      { _id: req.params.id, status: 'pending' },
      {
        status:         'acknowledged',
        acknowledgedBy: req.user._id,
        acknowledgedAt: new Date(),
      },
      { new: true }
    ).populate('requestedBy', 'name phone avatar')
     .populate('acknowledgedBy', 'name avatar');

    if (!request) {
      const exists = await ResourceRequest.findById(req.params.id).select('status');
      if (!exists) return res.status(404).json({ success: false, message: 'Resource request not found' });
      return res.status(400).json({
        success: false,
        message: exists.status === 'acknowledged' ? 'Request already acknowledged' : 'Request is already fulfilled',
      });
    }

    io.emit('resourceRequestAcknowledged', {
      requestId:      request._id,
      acknowledgedBy: req.user.name,
      request,
    });

    return res.json({ success: true, request });
  } catch (error) {
    console.error('[acknowledgeResourceRequest]', error);
    return res.status(500).json({ success: false, message: 'Failed to acknowledge request' });
  }
};

// @desc   Fulfill a resource request (volunteer)
// @route  PATCH /api/resources/:id/fulfill
// @access Private
export const fulfillResourceRequest = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return badId(res);

    // Can fulfill from either pending or acknowledged state
    const request = await ResourceRequest.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'fulfilled' } },
      { status: 'fulfilled', fulfilledBy: req.user._id, fulfilledAt: new Date() },
      { new: true }
    );

    if (!request) {
      const exists = await ResourceRequest.exists({ _id: req.params.id });
      if (!exists) return res.status(404).json({ success: false, message: 'Resource request not found' });
      return res.status(400).json({ success: false, message: 'This request has already been fulfilled' });
    }

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
