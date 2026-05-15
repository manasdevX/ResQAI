import Incident from '../models/Incident.js';
import { analyzeIncident } from '../utils/aiTriage.js';
import { io } from '../server.js';

// Create a new incident and run AI triage (Handles both JSON and multipart/form-data)
export const createIncident = async (req, res) => {
  try {
    let { title, description, type, location, affectedCount, tags } = req.body;

    // If location is sent as a string (multipart/form-data), parse it
    if (typeof location === 'string') {
      try { location = JSON.parse(location); } catch (e) { /* ignore */ }
    }
    
    // If tags is sent as a string (multipart/form-data), parse it
    if (typeof tags === 'string') {
      try { tags = JSON.parse(tags); } catch (e) { /* ignore */ }
    }

    // Process uploaded files if any
    let media = [];
    if (req.files && req.files.length > 0) {
      media = req.files.map(file => {
        let type = 'image';
        if (file.mimetype.startsWith('video/')) type = 'video';
        else if (file.mimetype.startsWith('audio/')) type = 'audio';
        else if (file.mimetype.includes('pdf')) type = 'document';

        return {
          url: file.path,
          publicId: file.filename,
          type: type,
          caption: ''
        };
      });
    }

    // Run AI triage asynchronously based on title and description
    const triageData = await analyzeIncident(title, description);

    // Create incident using user input, media, and AI output
    const newIncident = new Incident({
      title,
      description,
      type,
      location,
      severity: triageData.urgency || 'medium', // Map AI urgency to severity
      reportedBy: req.user._id, // Assuming auth middleware sets req.user
      media,
      affectedCount: affectedCount || triageData.estimatedAffected,
      aiTriage: {
        summary: triageData.summary,
        recommendedActions: triageData.recommendedActions,
        estimatedAffected: triageData.estimatedAffected,
        riskScore: triageData.riskScore,
        processedAt: new Date(),
        modelUsed: 'gemini-1.5-flash',
      },
      tags: tags || [],
    });

    const savedIncident = await newIncident.save();

    // Emit real-time event to all connected clients
    io.emit('newIncident', savedIncident);

    res.status(201).json({
      success: true,
      message: 'Incident reported successfully',
      incident: savedIncident,
    });
  } catch (error) {
    console.error('Error creating incident:', error);
    res.status(500).json({ success: false, message: 'Server error while creating incident' });
  }
};

// Fetch all incidents (optionally filter by status/type)
export const getAllIncidents = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    
    // We want to fetch mostly active ones or all, sorting by newest
    const incidents = await Incident.find(filter).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: incidents.length,
      incidents,
    });
  } catch (error) {
    console.error('Error fetching incidents:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching incidents' });
  }
};

// Controller to handle media upload for an existing incident
export const uploadIncidentMedia = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find incident
    const incident = await Incident.findById(id);

    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No media files uploaded' });
    }

    // Process uploaded files
    const newMedia = req.files.map(file => {
      // Determine type based on mimetype
      let type = 'image';
      if (file.mimetype.startsWith('video/')) type = 'video';
      else if (file.mimetype.startsWith('audio/')) type = 'audio';
      else if (file.mimetype.includes('pdf')) type = 'document';

      return {
        url: file.path,
        publicId: file.filename,
        type: type,
        caption: req.body.caption || ''
      };
    });

    // Add media to incident
    incident.media.push(...newMedia);
    await incident.save();

    res.status(200).json({
      success: true,
      message: 'Media uploaded successfully',
      media: incident.media
    });
  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({ success: false, message: 'Server error while uploading media' });
  }
};

// Update incident status (acknowledged → responding → resolved → closed)
export const updateIncidentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    const allowed = ['reported', 'acknowledged', 'responding', 'resolved', 'closed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const incident = await Incident.findById(id);
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });

    // Store updatedBy for the pre-save hook
    incident._updatedBy = req.user._id;
    incident.status = status;
    if (note) {
      incident.statusHistory.push({ status, note, updatedBy: req.user._id, updatedAt: new Date() });
    }

    const updated = await incident.save();

    // Broadcast status change to all connected clients
    io.emit('incidentUpdated', { incidentId: id, status, note, updatedBy: req.user.name });

    res.status(200).json({ success: true, message: 'Status updated', incident: updated });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ success: false, message: 'Server error while updating status' });
  }
};

// Update incident severity / priority
export const updateIncidentSeverity = async (req, res) => {
  try {
    const { id } = req.params;
    const { severity } = req.body;

    const allowed = ['low', 'medium', 'high', 'critical'];
    if (!allowed.includes(severity)) {
      return res.status(400).json({ success: false, message: 'Invalid severity value' });
    }

    const incident = await Incident.findByIdAndUpdate(
      id,
      { severity },
      { new: true, runValidators: true }
    );
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });

    // Broadcast severity change
    io.emit('incidentUpdated', { incidentId: id, severity, updatedBy: req.user.name });

    res.status(200).json({ success: true, message: 'Severity updated', incident });
  } catch (error) {
    console.error('Error updating severity:', error);
    res.status(500).json({ success: false, message: 'Server error while updating severity' });
  }
};

// Broadcast an emergency alert to all connected clients
export const broadcastAlert = async (req, res) => {
  try {
    const { incidentId, message, alertType } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Alert message is required' });
    }

    const alertPayload = {
      incidentId,
      message,
      alertType: alertType || 'general',   // general | evacuation | shelter | medical
      broadcastBy: req.user.name,
      broadcastAt: new Date(),
    };

    // Emit to all connected clients (civilians + responders)
    io.emit('alertBroadcast', alertPayload);

    res.status(200).json({ success: true, message: 'Alert broadcast sent', alert: alertPayload });
  } catch (error) {
    console.error('Error broadcasting alert:', error);
    res.status(500).json({ success: false, message: 'Server error while broadcasting alert' });
  }
};

// Fetch nearby incidents using MongoDB geospatial queries
export const getNearbyIncidents = async (req, res) => {
  try {
    const { lng, lat, maxDistance = 10000 } = req.query; // maxDistance default 10km (10000 meters)

    if (!lng || !lat) {
      return res.status(400).json({ success: false, message: 'Longitude and latitude are required' });
    }

    // Must ensure Incident schema has a 2dsphere index on location
    // Wait, the schema should have `location: { type: 'Point', coordinates: [lng, lat] }` and an index.
    const incidents = await Incident.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: parseInt(maxDistance),
        },
      },
      status: { $nin: ['resolved', 'closed'] }, // Optionally only show active ones to volunteers
    });

    res.status(200).json({
      success: true,
      count: incidents.length,
      incidents,
    });
  } catch (error) {
    console.error('Error fetching nearby incidents:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching nearby incidents' });
  }
};

