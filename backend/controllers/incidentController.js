import Incident from '../models/Incident.js';
import { analyzeIncident } from '../utils/aiTriage.js';

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
