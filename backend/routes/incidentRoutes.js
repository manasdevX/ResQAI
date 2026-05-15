import express from 'express';
import { uploadIncidentMedia } from '../controllers/incidentController.js';
import upload from '../middleware/upload.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Route to upload media to a specific incident
// Supports up to 5 files at a time
router.post('/:id/media', protect, upload.array('media', 5), uploadIncidentMedia);

export default router;
