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
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Public-ish (protected) routes ─────────────────────────────────────────────

// GET all shelters (with optional ?status=active&type=hospital filters)
router.get('/', protect, getAllShelters);

// GET nearby shelters — must be BEFORE /:id to avoid param collision
router.get('/nearby', protect, getNearbyShelters);

// GET a single shelter
router.get('/:id', protect, getShelterById);

// ── Write routes ──────────────────────────────────────────────────────────────

// POST create a new shelter (Admin/Shelter Manager)
router.post('/', protect, authorize('admin', 'shelter_manager'), createShelter);

// PATCH update occupancy (Admin/Shelter Manager)
router.patch('/:id/occupancy', protect, authorize('admin', 'shelter_manager'), updateOccupancy);

// PATCH update shelter status (Admin/Shelter Manager)
router.patch('/:id/status', protect, authorize('admin', 'shelter_manager'), updateShelterStatus);

// DELETE remove a shelter (Admin only)
router.delete('/:id', protect, authorize('admin'), deleteShelter);

export default router;
