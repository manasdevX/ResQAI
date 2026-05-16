import express from 'express';
import {
  getAllShelters,
  getShelterById,
  getNearbyShelters,
  createShelter,
  updateOccupancy,
  updateShelterStatus,
  deleteShelter,
} from '../controllers/shelterController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Public-ish (protected) routes ─────────────────────────────────────────────

// GET all shelters (with optional ?status=active&type=hospital filters)
router.get('/', protect, getAllShelters);

// GET nearby shelters — must be BEFORE /:id to avoid param collision
router.get('/nearby', protect, getNearbyShelters);

// GET a single shelter
router.get('/:id', protect, getShelterById);

// ── Write routes ──────────────────────────────────────────────────────────────

// POST create a new shelter
router.post('/', protect, createShelter);

// PATCH update occupancy (+/- delta)
router.patch('/:id/occupancy', protect, updateOccupancy);

// PATCH update shelter status
router.patch('/:id/status', protect, updateShelterStatus);

// DELETE remove a shelter (admin)
router.delete('/:id', protect, deleteShelter);

export default router;
