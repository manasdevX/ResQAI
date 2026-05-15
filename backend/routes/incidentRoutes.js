import express from 'express';
import { createIncident, uploadIncidentMedia, getAllIncidents } from '../controllers/incidentController.js';
import upload from '../middleware/upload.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Route to create a new incident (triggers AI triage)
router.post('/', protect, createIncident);

// Route to get all incidents
router.get('/', protect, getAllIncidents);

// Route to upload media to a specific incident
// Supports up to 5 files at a time
router.post('/:id/media', protect, upload.array('media', 5), uploadIncidentMedia);

export default router;
