import express from 'express';
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

// Create a new incident (triggers AI triage)
router.post('/', protect, createIncident);

// Get all incidents
router.get('/', protect, getAllIncidents);

// Get nearby active incidents
router.get('/nearby', protect, getNearbyIncidents);

// Update status of a specific incident
router.patch('/:id/status', protect, updateIncidentStatus);

// Update severity (priority) of a specific incident
router.patch('/:id/severity', protect, updateIncidentSeverity);

// Volunteer accepts an incident
router.post('/:id/accept', protect, acceptIncidentTask);

// Broadcast emergency alert (tied to an incident or standalone)
router.post('/broadcast-alert', protect, broadcastAlert);

// Upload media to a specific incident
router.post('/:id/media', protect, upload.array('media', 5), uploadIncidentMedia);

export default router;

