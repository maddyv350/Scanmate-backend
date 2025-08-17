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

/**
 * @route   GET /api/swipes/history
 * @desc    Get user's swipe history
 * @access  Private
 * @query   { page?, limit?, direction? }
 */
router.get('/history', swipeController.getSwipeHistory);

/**
 * @route   GET /api/swipes/matches
 * @desc    Get potential matches (mutual right swipes)
 * @access  Private
 * @query   { page?, limit? }
 */
router.get('/matches', swipeController.getPotentialMatches);

/**
 * @route   DELETE /api/swipes/:swipeId
 * @desc    Delete a swipe (soft delete)
 * @access  Private
 */
router.delete('/:swipeId', swipeController.deleteSwipe);

module.exports = router;
