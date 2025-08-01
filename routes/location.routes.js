const express = require('express');
const router = express.Router();
const locationController = require('../controllers/location.controller');
const authMiddleware = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authMiddleware);

// Drop by location
router.post('/drop-by', locationController.dropByLocation);

// Get nearby users
router.get('/nearby-users', locationController.getNearbyUsers);

// Remove location
router.delete('/remove', locationController.removeLocation);

// Get current user location
router.get('/current', locationController.getCurrentUserLocation);

// Get daily drop count
router.get('/daily-drop-count', locationController.getDailyDropCount);

// Get drop score
router.get('/drop-score', locationController.getDropScore);

module.exports = router; 