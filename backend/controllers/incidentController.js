import Incident from '../models/Incident.js';
import { analyzeIncident } from '../utils/aiTriage.js';
import { io } from '../server.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Normalise uploaded Cloudinary files → media array for the schema */
const buildMediaArray = (files = []) =>
  files.map((file) => {
    let type = 'image';
    if (file.mimetype?.startsWith('video/'))             type = 'video';
    else if (file.mimetype?.startsWith('audio/'))        type = 'audio';
    else if (file.mimetype?.includes('pdf'))             type = 'document';

    return {
      url:      file.path,       // Cloudinary secure URL
      publicId: file.filename,   // Cloudinary public_id
      type,
      caption:  '',
    };
  });

/** Safe JSON parse — returns fallback on failure */
const safeParse = (value, fallback) => {
  if (typeof value !== 'string') return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};

// ── Controllers ────────────────────────────────────────────────────────────────

/**
 * @desc  Create a new incident with optional media & AI triage
 * @route POST /api/report        (multipart, with upload middleware)
 * @route POST /api/incidents     (JSON only)
 * @access Private
 */
export const createIncident = async (req, res) => {
  try {
    let { title, description, type, location, affectedCount, tags } = req.body;

    // ── Validate required fields ───────────────────────────────────────────────
    if (!title?.trim())       return res.status(400).json({ success: false, message: 'Incident title is required' });
    if (!description?.trim()) return res.status(400).json({ success: false, message: 'Description is required' });
    if (!type?.trim())        return res.status(400).json({ success: false, message: 'Incident type is required' });
    if (!location)            return res.status(400).json({ success: false, message: 'Location is required' });

    // Normalise multipart string fields
    location = safeParse(location, null);
    tags     = safeParse(tags, []);

    if (!location?.coordinates || !Array.isArray(location.coordinates) || location.coordinates.length < 2) {
      return res.status(400).json({ success: false, message: 'Invalid location: coordinates [lng, lat] are required' });
    }

    // ── Media ──────────────────────────────────────────────────────────────────
    const media = buildMediaArray(req.files);

    // ── AI Triage ─────────────────────────────────────────────────────────────
    const triageData = await analyzeIncident(title, description);

    // ── Save Incident ─────────────────────────────────────────────────────────
    const newIncident = new Incident({
      title:        title.trim(),
      description:  description.trim(),
      type,
      location,
      severity:     triageData.urgency || 'medium',
      reportedBy:   req.user._id,
      media,
      affectedCount: affectedCount ? Number(affectedCount) : (triageData.estimatedAffected || 0),
      aiTriage: {
        summary:              triageData.summary,
        recommendedActions:   triageData.recommendedActions,
        estimatedAffected:    triageData.estimatedAffected,
        riskScore:            triageData.riskScore,
        processedAt:          new Date(),
        modelUsed:            'gemini-2.0-flash',
      },
      tags: Array.isArray(tags) ? tags : [],
    });

    const savedIncident = await newIncident.save();

    // Broadcast to all dashboard clients
    io.emit('newIncident', savedIncident);

    return res.status(201).json({
      success:  true,
      message:  'Incident reported successfully',
      incident: savedIncident,
    });
  } catch (error) {
    console.error('[createIncident] Error:', error);

    // Multer / upload errors bubble up here
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File too large. Maximum 10 MB per file.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, message: 'Too many files. Maximum 5 files allowed.' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ success: false, message: 'Unexpected file field. Use "media" as the field name.' });
    }

    return res.status(500).json({ success: false, message: error.message || 'Server error while creating incident' });
  }
};

/**
 * @desc  Get all incidents (optionally filter by status / type)
 * @route GET /api/incidents
 * @access Private
 */
export const getAllIncidents = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type)   filter.type   = req.query.type;

    const incidents = await Incident.find(filter)
      .sort({ createdAt: -1 })
      .populate('reportedBy', 'name email avatar role');

    return res.status(200).json({
      success:   true,
      count:     incidents.length,
      incidents,
    });
  } catch (error) {
    console.error('[getAllIncidents] Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching incidents' });
  }
};

/**
 * @desc  Upload additional media to an existing incident
 * @route POST /api/incidents/:id/media
 * @access Private
 */
export const uploadIncidentMedia = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No media files uploaded' });
    }

    const newMedia = buildMediaArray(req.files);
    incident.media.push(...newMedia);
    await incident.save();

    return res.status(200).json({
      success: true,
      message: 'Media uploaded successfully',
      media:   incident.media,
    });
  } catch (error) {
    console.error('[uploadIncidentMedia] Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while uploading media' });
  }
};

/**
 * @desc  Update incident status
 * @route PATCH /api/incidents/:id/status
 * @access Private
 */
export const updateIncidentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    const VALID_STATUSES = ['reported', 'acknowledged', 'responding', 'resolved', 'closed'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const incident = await Incident.findById(id);
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });

    incident._updatedBy = req.user._id;
    incident.status     = status;

    // Always push to statusHistory when status changes
    incident.statusHistory.push({
      status,
      note:      note?.trim() || '',
      updatedBy: req.user._id,
      updatedAt: new Date(),
    });

    const updated = await incident.save();

    io.emit('incidentUpdated', { incidentId: id, status, note, updatedBy: req.user.name });

    return res.status(200).json({ success: true, message: 'Status updated', incident: updated });
  } catch (error) {
    console.error('[updateIncidentStatus] Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while updating status' });
  }
};

/**
 * @desc  Update incident severity
 * @route PATCH /api/incidents/:id/severity
 * @access Private
 */
export const updateIncidentSeverity = async (req, res) => {
  try {
    const { id } = req.params;
    const { severity } = req.body;

    const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];
    if (!VALID_SEVERITIES.includes(severity)) {
      return res.status(400).json({ success: false, message: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}` });
    }

    const incident = await Incident.findByIdAndUpdate(id, { severity }, { new: true, runValidators: true });
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });

    io.emit('incidentUpdated', { incidentId: id, severity, updatedBy: req.user.name });

    return res.status(200).json({ success: true, message: 'Severity updated', incident });
  } catch (error) {
    console.error('[updateIncidentSeverity] Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while updating severity' });
  }
};

/**
 * @desc  Broadcast an emergency alert
 * @route POST /api/incidents/broadcast-alert
 * @access Private
 */
export const broadcastAlert = async (req, res) => {
  try {
    const { incidentId, message, alertType } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: 'Alert message is required' });
    }

    const alertPayload = {
      incidentId,
      message:     message.trim(),
      alertType:   alertType || 'general',
      broadcastBy: req.user.name,
      broadcastAt: new Date(),
    };

    io.emit('alertBroadcast', alertPayload);

    return res.status(200).json({ success: true, message: 'Alert broadcast sent', alert: alertPayload });
  } catch (error) {
    console.error('[broadcastAlert] Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while broadcasting alert' });
  }
};

/**
 * @desc  Get nearby active incidents (geospatial)
 * @route GET /api/incidents/nearby?lng=&lat=&maxDistance=
 * @access Private
 */
export const getNearbyIncidents = async (req, res) => {
  try {
    const { lng, lat, maxDistance = 10000 } = req.query;

    if (!lng || !lat) {
      return res.status(400).json({ success: false, message: 'Longitude and latitude query params are required' });
    }

    const incidents = await Incident.find({
      location: {
        $near: {
          $geometry: {
            type:        'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: parseInt(maxDistance),
        },
      },
      status: { $nin: ['resolved', 'closed'] },
    }).populate('reportedBy', 'name avatar');

    return res.status(200).json({ success: true, count: incidents.length, incidents });
  } catch (error) {
    console.error('[getNearbyIncidents] Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching nearby incidents' });
  }
};

/**
 * @desc  Volunteer accepts an incident task
 * @route POST /api/incidents/:id/accept
 * @access Private
 */
export const acceptIncidentTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const incident = await Incident.findById(id);
    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    if (incident.assignedResponders.some(r => r.toString() === userId.toString())) {
      return res.status(400).json({ success: false, message: 'You have already accepted this task' });
    }

    incident.assignedResponders.push(userId);

    if (['reported', 'acknowledged'].includes(incident.status)) {
      incident.status = 'responding';
      incident.statusHistory.push({
        status:    'responding',
        note:      'Task accepted by responder',
        updatedBy: userId,
        updatedAt: new Date(),
      });
    }

    const updatedIncident = await incident.save();

    io.emit('incidentUpdated', {
      incidentId:         id,
      status:             incident.status,
      assignedResponders: updatedIncident.assignedResponders,
    });

    return res.status(200).json({ success: true, message: 'Task accepted successfully', incident: updatedIncident });
  } catch (error) {
    console.error('[acceptIncidentTask] Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while accepting task' });
  }
};
