import express from 'express';
import multer from 'multer';
import {
  createIncident,
  createSOSIncident,
  uploadIncidentMedia,
  getAllIncidents,
  getIncidentById,
  updateIncidentStatus,
  updateIncidentSeverity,
  broadcastAlert,
  getNearbyIncidents,
  acceptIncidentTask,
  assignResponder,
  unassignResponder,
  retryAITriage,
  deleteIncident,
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

// Broadcast emergency alert — MUST be before /:id to avoid param collision
router.post('/broadcast-alert', protect, authorize('admin', 'responder'), broadcastAlert);

// Get a single incident by ID — must be before all /:id/sub-path routes
router.get('/:id', protect, getIncidentById);

// Update status of a specific incident (Admin/Responder only)
router.patch('/:id/status', protect, authorize('admin', 'responder'), updateIncidentStatus);

// Update severity (priority) of a specific incident (Admin/Responder only)
router.patch('/:id/severity', protect, authorize('admin', 'responder'), updateIncidentSeverity);

// Volunteer accepts an incident (Responder only)
router.post('/:id/accept', protect, authorize('responder', 'admin'), acceptIncidentTask);

// Admin assigns / unassigns a responder
router.post('/:id/assign',                  protect, authorize('admin'), assignResponder);
router.delete('/:id/assign/:responderId',   protect, authorize('admin'), unassignResponder);

// Retry AI triage on an incident that didn't get it (admin / responder only)
router.post('/:id/triage', protect, authorize('admin', 'responder'), retryAITriage);

// Upload media to a specific incident
router.post('/:id/media', protect, withUpload('media', 5), uploadIncidentMedia);

// Delete an incident (admin: any; citizen: own + within 24h + still 'reported')
router.delete('/:id', protect, deleteIncident);

export default router;
