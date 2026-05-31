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
        // Log full Cloudinary error details for debugging via Render logs
        console.error('[upload] Error name   :', err.name);
        console.error('[upload] Error message:', err.message);
        console.error('[upload] Error http_code:', err.http_code);
        console.error('[upload] Error stack  :', err.stack);

        // Cloudinary credential / auth failure — don't expose raw provider errors
        if (/unexpected status code - (401|403)/i.test(err.message || '')) {
          return res.status(503).json({
            success: false,
            code:    'UPLOAD_UNAVAILABLE',
            message: 'Media upload is temporarily unavailable. You can still submit your report without attachments.',
          });
        }
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  },
  createIncident
);

export default router;
