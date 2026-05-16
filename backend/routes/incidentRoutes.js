import express from 'express';
import multer from 'multer';
import {
  createIncident,
  uploadIncidentMedia,
  getAllIncidents,
  updateIncidentStatus,
  updateIncidentSeverity,
  broadcastAlert,
  getNearbyIncidents,
  acceptIncidentTask,
} from '../controllers/incidentController.js';
import upload from '../middleware/upload.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/** Inline multer error handler — wraps upload middleware */
const withUpload = (fieldName, maxCount) => (req, res, next) => {
  upload.array(fieldName, maxCount)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE')
        return res.status(400).json({ success: false, message: 'File too large. Max 10 MB per file.' });
      if (err.code === 'LIMIT_FILE_COUNT')
        return res.status(400).json({ success: false, message: 'Too many files. Max 5 files allowed.' });
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
};

// ── Routes ────────────────────────────────────────────────────────────────────

// Create a new incident (JSON only — no file upload here)
router.post('/', protect, createIncident);

// Get all incidents
router.get('/', protect, getAllIncidents);

// Get nearby active incidents
router.get('/nearby', protect, getNearbyIncidents);

// Broadcast emergency alert (must be BEFORE /:id routes to avoid param collision)
router.post('/broadcast-alert', protect, broadcastAlert);

// Update status of a specific incident
router.patch('/:id/status', protect, updateIncidentStatus);

// Update severity (priority) of a specific incident
router.patch('/:id/severity', protect, updateIncidentSeverity);

// Volunteer accepts an incident
router.post('/:id/accept', protect, acceptIncidentTask);

// Upload media to a specific incident
router.post('/:id/media', protect, withUpload('media', 5), uploadIncidentMedia);

export default router;
