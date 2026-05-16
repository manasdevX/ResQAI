import express from 'express';
import multer from 'multer';
import { createIncident } from '../controllers/incidentController.js';
import upload from '../middleware/upload.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * POST /api/report
 * Unified endpoint: report an incident with optional media uploads.
 * Auth required. Multer errors are caught and returned as 400.
 */
router.post(
  '/',
  protect,
  (req, res, next) => {
    upload.array('media', 5)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE')
          return res.status(400).json({ success: false, message: 'File too large. Max 10 MB per file.' });
        if (err.code === 'LIMIT_FILE_COUNT')
          return res.status(400).json({ success: false, message: 'Too many files. Max 5 files allowed.' });
        return res.status(400).json({ success: false, message: err.message });
      }
      if (err) {
        // fileFilter rejection or other upload errors
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  },
  createIncident
);

export default router;
