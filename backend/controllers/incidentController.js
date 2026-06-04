import mongoose from 'mongoose';
import Incident from '../models/Incident.js';
import User from '../models/User.js';
import { analyzeIncident } from '../utils/aiTriage.js';
import { io } from '../server.js';
import { notify } from '../utils/notify.js';
import { uploadToCloudinary, sanitizePublicId, resolveResourceType } from '../middleware/upload.js';

const badId = (res) => res.status(400).json({ success: false, message: 'Invalid ID format' });

const VALID_INCIDENT_TYPES = [
  'fire', 'flood', 'earthquake', 'cyclone', 'landslide',
  'accident', 'medical_emergency', 'building_collapse', 'chemical_spill', 'riot', 'sos', 'other',
];

// Sensible initial severity by type — AI refines this async
const SEVERITY_BY_TYPE = {
  earthquake:        'critical',
  building_collapse: 'critical',
  chemical_spill:    'critical',
  sos:               'critical',
  fire:              'high',
  flood:             'high',
  cyclone:           'high',
  medical_emergency: 'high',
  landslide:         'high',
  accident:          'medium',
  riot:              'medium',
  other:             'medium',
};

// Incident type → skill keywords for targeted dispatch
// Keys must match Incident model enum exactly
const INCIDENT_SKILL_MAP = {
  fire:              ['firefighting', 'fire', 'rescue'],
  flood:             ['water rescue', 'swimming', 'flood', 'search and rescue'],
  earthquake:        ['search and rescue', 'structural', 'earthquake'],
  medical_emergency: ['medical', 'first aid', 'cpr', 'paramedic', 'nurse', 'doctor', 'healthcare'],
  accident:          ['first aid', 'traffic', 'accident', 'driving'],
  riot:              ['law enforcement', 'security', 'conflict'],
  building_collapse: ['engineering', 'structural', 'search and rescue'],
  chemical_spill:    ['hazmat', 'chemical', 'decontamination'],
  landslide:         ['search and rescue', 'geology', 'landslide'],
  cyclone:           ['evacuation', 'rescue', 'cyclone'],
  sos:               ['search and rescue', 'first aid', 'rescue', 'medical'],
  other:             [],
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Upload req.files buffers to Cloudinary; log failures but skip rather than aborting. */
const uploadMediaFiles = async (files = [], folder = 'resqai_incidents') => {
  const media   = [];
  const skipped = [];
  for (const file of files) {
    try {
      const resource_type = resolveResourceType(file.mimetype);
      const public_id     = `${Date.now()}_${sanitizePublicId(file.originalname)}`;

      const result = await uploadToCloudinary(file.buffer, file.mimetype, {
        folder,
        resource_type,
        public_id,
      });

      let type = 'image';
      if (file.mimetype?.startsWith('video/'))      type = 'video';
      else if (file.mimetype?.startsWith('audio/')) type = 'audio';
      else if (file.mimetype?.includes('pdf'))      type = 'document';

      media.push({ url: result.secure_url, publicId: result.public_id, type, caption: '' });
    } catch (err) {
      // Log error details for diagnostics but do NOT abort the whole submission.
      // The caller will surface a mediaWarning to the client.
      console.error(
        `[upload] Failed: "${file.originalname}" — HTTP ${err.http_code ?? err.status ?? 'unknown'} | ${err.message}`
      );
      skipped.push(file.originalname);
    }
  }
  return { media, skipped };
};


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

    if (!VALID_INCIDENT_TYPES.includes(type.trim())) {
      return res.status(400).json({ success: false, message: `Invalid incident type. Must be one of: ${VALID_INCIDENT_TYPES.join(', ')}` });
    }

    // Normalise multipart string fields
    location = safeParse(location, null);
    tags     = safeParse(tags, []);

    if (!location?.coordinates || !Array.isArray(location.coordinates) || location.coordinates.length < 2) {
      return res.status(400).json({ success: false, message: 'Invalid location: coordinates [lng, lat] are required' });
    }

    const [lng, lat] = location.coordinates;
    if (typeof lng !== 'number' || typeof lat !== 'number' ||
        lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates: longitude must be -180 to 180, latitude -90 to 90' });
    }

    // ── Duplicate detection ────────────────────────────────────────────────────
    // Only treat it as a duplicate when the SAME user reports the SAME incident
    // TYPE at the same spot within 30 min. Genuinely different emergencies at one
    // location (e.g. an SOS beacon followed by a flood report) are distinct and
    // must both be allowed. SOS beacons (isSOS) never block a regular report.
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60_000);
    const duplicate = await Incident.findOne({
      reportedBy: req.user._id,
      type:       type.trim(),
      isSOS:      { $ne: true },
      status:     { $nin: ['resolved', 'closed'] },
      createdAt:  { $gte: thirtyMinutesAgo },
      location:   { $near: { $geometry: location, $maxDistance: 500 } },
    }).select('_id title');

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'A similar incident was already reported from this location. Please check your existing reports.',
        existingIncidentId: duplicate._id,
      });
    }

    // ── Media ──────────────────────────────────────────────────────────────────
    const { media, skipped: skippedFiles } = await uploadMediaFiles(req.files);

    // ── Save incident immediately — AI runs async so user gets instant response ─
    const newIncident = new Incident({
      title:         title.trim(),
      description:   description.trim(),
      type:          type.trim(),
      location,
      severity:      SEVERITY_BY_TYPE[type.trim()] || 'medium',
      reportedBy:    req.user._id,
      media,
      affectedCount: affectedCount ? Number(affectedCount) : 0,
      aiTriage:      null,
      tags:          Array.isArray(tags) ? tags : [],
      statusHistory: [{
        status:    'reported',
        note:      '',
        updatedBy: req.user._id,
        updatedAt: new Date(),
      }],
    });

    const savedIncident = await newIncident.save();
    io.emit('newIncident', savedIncident);

    // Respond immediately — don't make the user wait for AI
    res.status(201).json({
      success:  true,
      message:  'Incident reported successfully',
      incident: savedIncident,
      ...(skippedFiles.length > 0 && { mediaWarning: `${skippedFiles.length} file(s) could not be uploaded and were skipped.` }),
    });

    // ── AI triage (async — fires after HTTP response is sent) ──────────────────
    setImmediate(async () => {
      try {
        const mediaUrls = media.map(m => m.url);
        const triage = await analyzeIncident(title.trim(), description.trim(), type.trim(), mediaUrls);

        if (!triage.aiAvailable) {
          // Always emit so the UI stops showing "AI in progress..." and shows "unavailable"
          io.emit('incidentUpdated', {
            incidentId:      savedIncident._id,
            aiTriageDone:    true,
            aiTriageSuccess: false,
          });
          return;
        }

        const updated = await Incident.findByIdAndUpdate(
          savedIncident._id,
          {
            severity: triage.urgency,
            aiTriage: {
              summary:            triage.summary,
              recommendedActions: triage.recommendedActions,
              estimatedAffected:  triage.estimatedAffected,
              riskScore:          triage.riskScore,
              processedAt:        new Date(),
              modelUsed:          triage.modelUsed || 'gemini-2.0-flash',
            },
          },
          { returnDocument: 'after' }
        );

        if (updated) {
          io.emit('incidentUpdated', {
            incidentId:      updated._id,
            severity:        updated.severity,
            aiTriage:        updated.aiTriage,
            aiTriageDone:    true,
            aiTriageSuccess: true,
          });
        }
      } catch (aiErr) {
        console.error('[createIncident] Async AI triage failed:', aiErr.message);
        io.emit('incidentUpdated', {
          incidentId:      savedIncident._id,
          aiTriageDone:    true,
          aiTriageSuccess: false,
        });
      }
    });

    // ── Smart dispatch to skill-matched responders ─────────────────────────────
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
        if (!targets.length) targets = available;

        const dispatchPayload = {
          incidentId:   savedIncident._id,
          title:        savedIncident.title,
          type:         savedIncident.type,
          severity:     savedIncident.severity,
          location:     savedIncident.location,
          isSOS:        false,
          dispatchedAt: new Date(),
        };

        targets.forEach(r => io.to(`user:${r._id}`).emit('newIncidentAssigned', dispatchPayload));
        console.log(`[dispatch] Incident ${savedIncident._id} → ${targets.length} responder(s) (type: ${type})`);
      } catch (dispatchErr) {
        console.error('[dispatch]', dispatchErr.message);
      }
    });

    // ── Auto-escalation after 15 minutes if unaccepted ────────────────────────
    const escalationId = savedIncident._id;
    setTimeout(async () => {
      try {
        const fresh = await Incident.findById(escalationId)
          .select('assignedResponders status title type severity');
        if (!fresh || fresh.assignedResponders.length > 0 || ['resolved', 'closed'].includes(fresh.status)) return;

        const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
        admins.forEach(a => io.to(`user:${a._id}`).emit('incidentEscalated', {
          incidentId:  fresh._id,
          title:       fresh.title,
          type:        fresh.type,
          severity:    fresh.severity,
          message:     'No responder accepted this incident in 15 minutes. Manual assignment needed.',
          escalatedAt: new Date(),
        }));
        console.log(`[escalation] Incident ${escalationId} escalated to ${admins.length} admin(s)`);
      } catch (escalationErr) {
        console.error('[escalation]', escalationErr.message);
      }
    }, 15 * 60_000);

  } catch (error) {
    console.error('[createIncident] Error:', error);

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

    // ── Role-based data isolation ──────────────────────────────────────────────
    // Citizens can ONLY see their own incidents
    if (req.user.role === 'citizen') {
      filter.reportedBy = req.user._id;
    }

    // Responders can filter to only their assignments (?assignedTo=me)
    if (req.query.assignedTo === 'me' && ['responder', 'admin'].includes(req.user.role)) {
      filter.assignedResponders = req.user._id;
    }

    // Standard query filters
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
        .populate('reportedBy', 'name email avatar role')
        .populate('assignedResponders', 'name email avatar role isAvailable'),
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
    if (!mongoose.isValidObjectId(req.params.id)) return badId(res);
    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    // Authorization check
    const isAdmin = req.user.role === 'admin';
    const isReporter = incident.reportedBy.equals(req.user._id);
    const isResponder = req.user.role === 'responder' && incident.assignedResponders.some(id => id.equals(req.user._id));

    if (!isAdmin && !isReporter && !isResponder) {
      return res.status(403).json({ success: false, message: 'Not authorized to upload media for this incident' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No media files uploaded' });
    }

    const { media: newMedia, skipped: skippedFiles } = await uploadMediaFiles(req.files);
    if (!newMedia.length) {
      return res.status(503).json({ success: false, message: 'Media upload failed. Please try again.' });
    }
    incident.media.push(...newMedia);
    await incident.save();

    return res.status(200).json({
      success: true,
      message: skippedFiles.length > 0
        ? `${newMedia.length} file(s) uploaded. ${skippedFiles.length} failed and were skipped.`
        : 'Media uploaded successfully',
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
    if (!mongoose.isValidObjectId(id)) return badId(res);
    const { status, note } = req.body;

    const VALID_STATUSES = ['reported', 'acknowledged', 'responding', 'resolved', 'closed', 'false_alarm'];
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

    // Notify the reporter when their incident status changes (skip self-updates)
    const STATUS_NOTIFY = {
      acknowledged: 'Your incident has been acknowledged by responders',
      responding:   'Responders are on their way to your incident',
      resolved:     'Your incident has been marked as resolved',
      closed:       'Your incident has been closed',
    };
    if (incident.reportedBy && STATUS_NOTIFY[status]) {
      if (!incident.reportedBy.equals(req.user._id)) {
        notify(incident.reportedBy, {
          type:  'incident_status',
          title: `Incident ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          body:  `"${incident.title}" — ${STATUS_NOTIFY[status]}`,
          link:  `/incidents/${incident._id}`,
        });
      }
    }

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
    if (!mongoose.isValidObjectId(id)) return badId(res);
    const { severity } = req.body;

    const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];
    if (!VALID_SEVERITIES.includes(severity)) {
      return res.status(400).json({ success: false, message: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}` });
    }

    const incident = await Incident.findByIdAndUpdate(id, { severity }, { returnDocument: 'after', runValidators: true });
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });

    io.emit('incidentUpdated', { incidentId: id, severity, updatedBy: req.user.name });

    return res.status(200).json({ success: true, message: 'Severity updated', incident });
  } catch (error) {
    console.error('[updateIncidentSeverity] Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while updating severity' });
  }
};

const ALERT_EMOJI = { evacuation: '🚨', medical: '🚑', shelter: '🏠', general: '📢' };

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

    const VALID_ALERT_TYPES = ['evacuation', 'medical', 'shelter', 'general'];
    const resolvedType = VALID_ALERT_TYPES.includes(alertType) ? alertType : 'general';

    const alertPayload = {
      incidentId:  incidentId || undefined,
      message:     message.trim(),
      alertType:   resolvedType,
      broadcastBy: req.user.name,
      broadcastAt: new Date(),
    };

    // Emit real-time banner to every connected socket
    io.emit('alertBroadcast', alertPayload);

    // Persist as a notification for every active user so it appears in the
    // notification bell (online users get the socket push; offline users see it
    // on next login). Fire-and-forget — never block the HTTP response.
    const notifTitle = `${ALERT_EMOJI[resolvedType]} ${resolvedType.charAt(0).toUpperCase() + resolvedType.slice(1)} Alert`;
    User.find({ isActive: true }).select('_id').lean().then(async (users) => {
      if (!users.length) return;
      try {
        const Notification = (await import('../models/Notification.js')).default;
        await Notification.insertMany(
          users.map(u => ({
            recipient: u._id,
            type:      'alert',
            title:     notifTitle,
            body:      message.trim(),
          })),
          { ordered: false }
        );
        // Push the bell notification to every currently connected user's room
        const notifPayload = {
          type:      'alert',
          title:     notifTitle,
          body:      message.trim(),
          read:      false,
          createdAt: new Date(),
        };
        users.forEach(u => io.to(`user:${u._id}`).emit('notification', notifPayload));
      } catch (err) {
        console.error('[broadcastAlert] notification persist error:', err.message);
      }
    }).catch(err => console.error('[broadcastAlert] user query error:', err.message));

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
      type:        'sos',
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

    // The reporter is in distress — flag them as not-safe so the "Mark Safe"
    // control surfaces on their home screen until they confirm they're okay.
    await User.updateOne({ _id: req.user._id }, { isSafe: false });

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
    if (!mongoose.isValidObjectId(id)) return badId(res);
    const userId = req.user._id;

    // Atomic add: the $ne filter ensures we only modify the document when the
    // user is NOT already in assignedResponders. Two concurrent requests cannot
    // both pass this filter, so duplicate assignments are impossible.
    const incident = await Incident.findOneAndUpdate(
      { _id: id, assignedResponders: { $ne: userId } },
      { $addToSet: { assignedResponders: userId } },
      { returnDocument: 'after' },
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

/**
 * @desc  Admin manually assigns a responder to an incident
 * @route POST /api/incidents/:id/assign
 * @access Private (admin)
 */
export const assignResponder = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return badId(res);
    const { responderId } = req.body;
    if (responderId && !mongoose.isValidObjectId(responderId)) return badId(res);

    if (!responderId) return res.status(400).json({ success: false, message: 'responderId is required' });

    const [incident, responder] = await Promise.all([
      Incident.findById(id),
      User.findById(responderId).select('name email avatar role isActive'),
    ]);

    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });
    if (!responder) return res.status(404).json({ success: false, message: 'Responder not found' });
    if (!['responder', 'admin'].includes(responder.role)) {
      return res.status(400).json({ success: false, message: 'User is not a responder or admin' });
    }
    if (!responder.isActive) {
      return res.status(400).json({ success: false, message: 'Responder account is inactive' });
    }

    const updatedIncident = await Incident.findByIdAndUpdate(
      id,
      { $addToSet: { assignedResponders: responderId } },
      { new: true }
    );

    notify(responderId, {
      type:  'assignment',
      title: 'You have been assigned to an incident',
      body:  `"${incident.title}" — assigned by ${req.user.name}`,
      link:  '/volunteer/assignments',
    });

    await updatedIncident.populate('assignedResponders', 'name email avatar role isAvailable');
    io.emit('incidentUpdated', { incidentId: id, assignedResponders: updatedIncident.assignedResponders });

    return res.json({ success: true, message: `${responder.name} assigned`, incident: updatedIncident });
  } catch (error) {
    console.error('[assignResponder]', error);
    return res.status(500).json({ success: false, message: 'Failed to assign responder' });
  }
};

/**
 * @desc  Admin unassigns a responder from an incident
 * @route DELETE /api/incidents/:id/assign/:responderId
 * @access Private (admin)
 */
export const unassignResponder = async (req, res) => {
  try {
    const { id, responderId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(responderId)) return badId(res);

    const incident = await Incident.findById(id);
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });

    incident.assignedResponders = incident.assignedResponders.filter(r => !r.equals(responderId));
    await incident.save();

    await incident.populate('assignedResponders', 'name email avatar role isAvailable');
    io.emit('incidentUpdated', { incidentId: id, assignedResponders: incident.assignedResponders });

    return res.json({ success: true, message: 'Responder unassigned', incident });
  } catch (error) {
    console.error('[unassignResponder]', error);
    return res.status(500).json({ success: false, message: 'Failed to unassign responder' });
  }
};

/**
 * @desc  Get a single incident by ID
 * @route GET /api/incidents/:id
 * @access Private
 */
export const getIncidentById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return badId(res);
    const incident = await Incident.findById(req.params.id)
      .populate('reportedBy', 'name email avatar role phone')
      .populate('assignedResponders', 'name email avatar role isAvailable')
      .populate('statusHistory.updatedBy', 'name role');

    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    return res.json({ success: true, incident });
  } catch (error) {
    console.error('[getIncidentById]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch incident' });
  }
};

/**
 * @desc  Delete an incident
 * @route DELETE /api/incidents/:id
 * @access Private (admin can delete any; reporter can delete own within 24h if still 'reported')
 */
export const deleteIncident = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return badId(res);

    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });

    const isAdmin    = req.user.role === 'admin';
    const isReporter = incident.reportedBy.equals(req.user._id);
    const ageMs      = Date.now() - new Date(incident.createdAt).getTime();
    const isRecent   = ageMs < 24 * 60 * 60_000; // within 24 hours

    // Citizens can only delete their own, recent, unaccepted reports
    if (!isAdmin && !(isReporter && isRecent && incident.status === 'reported')) {
      return res.status(403).json({
        success: false,
        message: isReporter
          ? 'You can only delete your own reports within 24 hours and before a responder accepts them.'
          : 'Not authorized to delete this incident',
      });
    }

    // Best-effort Cloudinary cleanup — log failures but don't abort
    if (incident.media?.length) {
      try {
        const { v2: cloudinary } = await import('cloudinary');
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
          api_key:    process.env.CLOUDINARY_API_KEY?.trim(),
          api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
        });
        await Promise.allSettled(
          incident.media
            .filter(m => m.publicId)
            .map(m => cloudinary.uploader.destroy(m.publicId, { resource_type: m.type === 'video' ? 'video' : 'image' }))
        );
      } catch (cleanupErr) {
        console.error('[deleteIncident] Cloudinary cleanup failed:', cleanupErr.message);
      }
    }

    await incident.deleteOne();
    io.emit('incidentDeleted', { incidentId: req.params.id });

    return res.json({ success: true, message: 'Incident deleted successfully' });
  } catch (error) {
    console.error('[deleteIncident]', error);
    return res.status(500).json({ success: false, message: 'Failed to delete incident' });
  }
};

/**
 * @desc  Re-run AI triage on an existing incident
 * @route POST /api/incidents/:id/triage
 * @access Private (admin / responder)
 *
 * Useful when AI was unavailable at report time (rate-limited, quota hit, etc.).
 * Returns immediately with { queued: true } and runs the analysis asynchronously,
 * pushing the result via the existing incidentUpdated socket event.
 */
export const retryAITriage = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return badId(res);

    const incident = await Incident.findById(req.params.id)
      .select('title description type aiTriage media');
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });

    // Respond immediately — analysis is async
    res.json({ success: true, queued: true, message: 'AI analysis queued. Results will appear automatically.' });

    // Run analysis asynchronously
    setImmediate(async () => {
      try {
        const mediaUrls = (incident.media || []).map(m => m.url);
        const triage = await analyzeIncident(incident.title, incident.description, incident.type, mediaUrls);

        if (!triage.aiAvailable) {
          io.emit('incidentUpdated', { incidentId: incident._id, aiTriageDone: true, aiTriageSuccess: false });
          return;
        }

        const updated = await Incident.findByIdAndUpdate(
          incident._id,
          {
            severity: triage.urgency,
            aiTriage: {
              summary:            triage.summary,
              recommendedActions: triage.recommendedActions,
              estimatedAffected:  triage.estimatedAffected,
              riskScore:          triage.riskScore,
              processedAt:        new Date(),
              modelUsed:          triage.modelUsed || 'gemini',
            },
          },
          { returnDocument: 'after' }
        );

        if (updated) {
          io.emit('incidentUpdated', {
            incidentId:      updated._id,
            severity:        updated.severity,
            aiTriage:        updated.aiTriage,
            aiTriageDone:    true,
            aiTriageSuccess: true,
          });
        }
      } catch (err) {
        console.error('[retryAITriage] async error:', err.message);
        io.emit('incidentUpdated', { incidentId: incident._id, aiTriageDone: true, aiTriageSuccess: false });
      }
    });
  } catch (error) {
    console.error('[retryAITriage]', error);
    return res.status(500).json({ success: false, message: 'Failed to queue AI triage' });
  }
};
