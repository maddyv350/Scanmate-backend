const express = require('express');
const router = express.Router();
const swipeController = require('../controllers/swipe.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Apply authentication middleware to all swipe routes
router.use(authMiddleware);

/**
 * @route   POST /api/swipes
 * @desc    Record a swipe action (right or left)
 * @access  Private
 * @body    { targetUserId, swipeDirection, message? }
 */
router.post('/', swipeController.recordSwipe);

module.exports = router;
