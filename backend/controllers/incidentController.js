import Incident from '../models/Incident.js';
import User from '../models/User.js';
import { analyzeIncident } from '../utils/aiTriage.js';
import { io } from '../server.js';

// Incident type → skill keywords for targeted dispatch
const INCIDENT_SKILL_MAP = {
  fire:           ['firefighting', 'fire', 'rescue'],
  flood:          ['water rescue', 'swimming', 'flood', 'search and rescue'],
  earthquake:     ['search and rescue', 'structural', 'earthquake'],
  medical:        ['medical', 'first aid', 'cpr', 'paramedic', 'nurse', 'doctor', 'healthcare'],
  accident:       ['first aid', 'traffic', 'accident', 'driving'],
  violence:       ['law enforcement', 'security', 'conflict'],
  infrastructure: ['engineering', 'electrical', 'infrastructure'],
  chemical:       ['hazmat', 'chemical', 'decontamination'],
  landslide:      ['search and rescue', 'geology', 'landslide'],
  cyclone:        ['evacuation', 'rescue', 'cyclone'],
  other:          [],
};

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

    // ── Duplicate detection ────────────────────────────────────────────────────
    // Prevent spam: block if this user already reported an active incident
    // within 500 m of this location in the last 30 minutes.
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60_000);
    const duplicate = await Incident.findOne({
      reportedBy: req.user._id,
      status:     { $nin: ['resolved', 'closed'] },
      createdAt:  { $gte: thirtyMinutesAgo },
      location: {
        $near: {
          $geometry:   location,
          $maxDistance: 500, // metres
        },
      },
    }).select('_id title');

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'A similar incident was already reported from this location. Please check your existing reports.',
        existingIncidentId: duplicate._id,
      });
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

    // ── Smart Dispatch ─────────────────────────────────────────────────────────
    // Run asynchronously so it never delays the HTTP response.
    // Find available responders; prefer skill-matched, fall back to all available.
    setImmediate(async () => {
      try {
        const keywords = INCIDENT_SKILL_MAP[type] || [];
        const available = await User.find({ role: 'responder', isAvailable: true, isActive: true })
          .select('_id skills');

        let targets = keywords.length
          ? available.filter(r =>
              r.skills?.some(s => keywords.some(kw => s.includes(kw) || kw.includes(s)))
            )
          : [];
        // No skill-matched responders → notify all available ones
        if (!targets.length) targets = available;

        const dispatchPayload = {
          incidentId:   savedIncident._id,
          title:        savedIncident.title,
          type:         savedIncident.type,
          severity:     savedIncident.severity,
          location:     savedIncident.location,
          isSOS:        savedIncident.isSOS || false,
          aiSummary:    savedIncident.aiTriage?.summary || null,
          dispatchedAt: new Date(),
        };

        targets.forEach(r => io.to(`user:${r._id}`).emit('newIncidentAssigned', dispatchPayload));
        console.log(`[dispatch] Incident ${savedIncident._id} → ${targets.length} responder(s) (type: ${type})`);
      } catch (dispatchErr) {
        console.error('[dispatch]', dispatchErr.message);
      }
    });

    // ── Auto-escalation ────────────────────────────────────────────────────────
    // If nobody accepts within 15 minutes, alert all admins via their socket room.
    const escalationIncidentId = savedIncident._id;
    setTimeout(async () => {
      try {
        const fresh = await Incident.findById(escalationIncidentId)
          .select('assignedResponders status title type severity');
        if (
          !fresh ||
          fresh.assignedResponders.length > 0 ||
          ['resolved', 'closed'].includes(fresh.status)
        ) return;

        const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
        const escalationPayload = {
          incidentId:  fresh._id,
          title:       fresh.title,
          type:        fresh.type,
          severity:    fresh.severity,
          message:     'No responder accepted this incident in 15 minutes. Manual assignment needed.',
          escalatedAt: new Date(),
        };
        admins.forEach(a => io.to(`user:${a._id}`).emit('incidentEscalated', escalationPayload));
        console.log(`[escalation] Incident ${escalationIncidentId} escalated to ${admins.length} admin(s)`);
      } catch (escalationErr) {
        console.error('[escalation]', escalationErr.message);
      }
    }, 15 * 60_000);

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
    if (req.query.status)   filter.status   = req.query.status;
    if (req.query.type)     filter.type     = req.query.type;
    if (req.query.severity) filter.severity = req.query.severity;

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const skip  = (page - 1) * limit;

    const [incidents, total] = await Promise.all([
      Incident.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('reportedBy', 'name email avatar role'),
      Incident.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count:   incidents.length,
      total,
      page,
      pages:   Math.ceil(total / limit),
      hasMore: skip + incidents.length < total,
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

    incident.status = status;

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

    const parsedLng = parseFloat(lng);
    const parsedLat = parseFloat(lat);
    if (parsedLng < -180 || parsedLng > 180 || parsedLat < -90 || parsedLat > 90) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates' });
    }

    const incidents = await Incident.find({
      location: {
        $near: {
          $geometry: {
            type:        'Point',
            coordinates: [parsedLng, parsedLat],
          },
          $maxDistance: Math.min(parseInt(maxDistance) || 10000, 200000), // cap at 200 km
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
 * @desc  Create an SOS emergency incident
 * @route POST /api/incidents/sos
 * @access Private
 */
export const createSOSIncident = async (req, res) => {
  try {
    const { location, description } = req.body;

    if (!location?.coordinates || location.coordinates.length < 2) {
      return res.status(400).json({ success: false, message: 'GPS coordinates are required for SOS' });
    }

    const incident = new Incident({
      title:       `SOS Emergency — ${req.user.name}`,
      description: description?.trim() || 'Emergency SOS activated. Immediate assistance required.',
      type:        'other',
      severity:    'critical',
      isSOS:       true,
      location,
      reportedBy:  req.user._id,
      statusHistory: [{
        status:    'reported',
        note:      'SOS auto-generated',
        updatedBy: req.user._id,
        updatedAt: new Date(),
      }],
    });

    const saved = await incident.save();

    io.emit('sosAlert', {
      incidentId: saved._id,
      user:       { name: req.user.name, _id: req.user._id, avatar: req.user.avatar },
      location,
      createdAt:  saved.createdAt,
    });
    io.emit('newIncident', saved);

    return res.status(201).json({ success: true, incident: saved });
  } catch (error) {
    console.error('[createSOSIncident] Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create SOS incident' });
  }
};

/**
 * @desc  Volunteer accepts an incident task
 * @route POST /api/incidents/:id/accept
 * @access Private (responder / admin)
 */
export const acceptIncidentTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Atomic add: the $ne filter ensures we only modify the document when the
    // user is NOT already in assignedResponders. Two concurrent requests cannot
    // both pass this filter, so duplicate assignments are impossible.
    const incident = await Incident.findOneAndUpdate(
      { _id: id, assignedResponders: { $ne: userId } },
      { $addToSet: { assignedResponders: userId } },
      { new: true },
    ).populate('reportedBy', '_id');

    if (!incident) {
      // Distinguish "not found" from "already assigned"
      const exists = await Incident.exists({ _id: id });
      if (!exists) return res.status(404).json({ success: false, message: 'Incident not found' });
      return res.status(400).json({ success: false, message: 'You have already accepted this task' });
    }

    // Update status to 'responding' if still in an early stage
    if (['reported', 'acknowledged'].includes(incident.status)) {
      incident.status = 'responding';
      incident.statusHistory.push({
        status:    'responding',
        note:      'Task accepted by responder',
        updatedBy: userId,
        updatedAt: new Date(),
      });
      await incident.save();
    }

    // Broadcast assignment update to all dashboard clients
    io.emit('incidentUpdated', {
      incidentId:         id,
      status:             incident.status,
      assignedResponders: incident.assignedResponders,
    });

    // SOS acknowledgment — notify the original reporter via their personal socket room
    if (incident.isSOS && incident.reportedBy) {
      const reporterId = incident.reportedBy._id ?? incident.reportedBy;
      io.to(`user:${reporterId}`).emit('sosAcknowledged', {
        incidentId:     id,
        responder:      { name: req.user.name, avatar: req.user.avatar || null },
        message:        'Your SOS has been received. A responder is on their way.',
        acknowledgedAt: new Date(),
      });
    }

    return res.status(200).json({ success: true, message: 'Task accepted successfully', incident });
  } catch (error) {
    console.error('[acceptIncidentTask] Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while accepting task' });
  }
};
