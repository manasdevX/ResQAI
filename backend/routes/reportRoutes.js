import express from 'express';
import { createIncident } from '../controllers/incidentController.js';
import upload from '../middleware/upload.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Unified endpoint to report an incident with geolocation, AI metadata (handled in controller), and image uploads
router.post('/', protect, upload.array('media', 5), createIncident);

export default router;
