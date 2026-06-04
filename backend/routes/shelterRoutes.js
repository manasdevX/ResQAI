import express from 'express';
import {
  getAllShelters,
  getShelterById,
  getShelterStats,
  getNearbyShelters,
  getNearbyPlaces,
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

// ── Read routes ───────────────────────────────────────────────────────────────

router.get('/',       protect, getAllShelters);
router.get('/stats',  protect, authorize('admin'), getShelterStats);
router.get('/nearby', protect, getNearbyShelters);
router.get('/places', protect, getNearbyPlaces);
router.get('/:id',    protect, getShelterById);

// ── Admin-only write routes ───────────────────────────────────────────────────

router.post('/',                  protect, authorize('admin'), createShelter);
router.put('/:id',                protect, authorize('admin'), updateShelter);
router.patch('/:id/occupancy',    protect, authorize('admin'), updateOccupancy);
router.patch('/:id/status',       protect, authorize('admin'), updateShelterStatus);
router.delete('/:id',             protect, authorize('admin'), deleteShelter);

// ── Citizen self check-in / check-out ─────────────────────────────────────────

router.post('/:id/checkin',  protect, checkInShelter);
router.post('/:id/checkout', protect, checkOutShelter);

export default router;
