import express from 'express';
import {
  getAllShelters,
  getShelterById,
  getNearbyShelters,
  getNearbyPlaces,
  getMyShelter,
  createShelter,
  updateShelter,
  updateOccupancy,
  updateShelterStatus,
  deleteShelter,
  checkInShelter,
  checkOutShelter,
} from '../controllers/shelterController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Public-ish (protected) routes ─────────────────────────────────────────────

// GET all shelters (with optional ?status=active&type=hospital filters)
router.get('/', protect, getAllShelters);

// GET nearby shelters — must be BEFORE /:id to avoid param collision
router.get('/nearby', protect, getNearbyShelters);

// GET real places from OpenStreetMap Overpass API
router.get('/places', protect, getNearbyPlaces);

// GET the shelter managed by the currently logged-in user — must be BEFORE /:id
router.get('/mine', protect, getMyShelter);

// GET a single shelter
router.get('/:id', protect, getShelterById);

// ── Write routes ──────────────────────────────────────────────────────────────

// POST create a new shelter (Admin/Shelter Manager)
router.post('/', protect, authorize('admin', 'shelter_manager'), createShelter);

// PUT update shelter details (Admin/Shelter Manager)
router.put('/:id', protect, authorize('admin', 'shelter_manager'), updateShelter);

// PATCH update occupancy (Admin/Shelter Manager)
router.patch('/:id/occupancy', protect, authorize('admin', 'shelter_manager'), updateOccupancy);

// PATCH update shelter status (Admin/Shelter Manager)
router.patch('/:id/status', protect, authorize('admin', 'shelter_manager'), updateShelterStatus);

// Citizen self check-in / check-out
router.post('/:id/checkin',  protect, checkInShelter);
router.post('/:id/checkout', protect, checkOutShelter);

// DELETE remove a shelter (Admin only)
router.delete('/:id', protect, authorize('admin'), deleteShelter);

export default router;
