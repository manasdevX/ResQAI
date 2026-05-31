import express from 'express';
import multer from 'multer';
import { createIncident } from '../controllers/incidentController.js';
import upload from '../middleware/upload.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * POST /api/report
 * Files are buffered in memory by multer; Cloudinary upload happens inside
 * createIncident so upload failures never block incident creation.
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
      if (err) return res.status(400).json({ success: false, message: err.message });
      next();
    });
  },
  createIncident
);

export default router;
