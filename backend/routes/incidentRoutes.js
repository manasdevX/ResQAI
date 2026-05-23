import express from 'express';
import multer from 'multer';
import {
  createIncident,
  createSOSIncident,
  uploadIncidentMedia,
  getAllIncidents,
  updateIncidentStatus,
  updateIncidentSeverity,
  broadcastAlert,
  getNearbyIncidents,
  acceptIncidentTask,
} from '../controllers/incidentController.js';
import upload from '../middleware/upload.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

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

// SOS emergency — must be before /:id routes
router.post('/sos', protect, createSOSIncident);

// Get all incidents
router.get('/', protect, getAllIncidents);

// Get nearby active incidents
router.get('/nearby', protect, getNearbyIncidents);

// Broadcast emergency alert (Admin/Responder only)
router.post('/broadcast-alert', protect, authorize('admin', 'responder'), broadcastAlert);

// Update status of a specific incident (Admin/Responder only)
router.patch('/:id/status', protect, authorize('admin', 'responder'), updateIncidentStatus);

// Update severity (priority) of a specific incident (Admin/Responder only)
router.patch('/:id/severity', protect, authorize('admin', 'responder'), updateIncidentSeverity);

// Volunteer accepts an incident (Responder only)
router.post('/:id/accept', protect, authorize('responder', 'admin'), acceptIncidentTask);

// Upload media to a specific incident
router.post('/:id/media', protect, withUpload('media', 5), uploadIncidentMedia);

export default router;
