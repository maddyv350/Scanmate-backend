const express = require('express');
const router = express.Router();
const connectionController = require('../controllers/connection.controller');
const authMiddleware = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Send connection request
router.post('/send', connectionController.sendConnectionRequest);

// Accept connection request
router.put('/:connectionId/accept', connectionController.acceptConnectionRequest);

// Reject connection request
router.put('/:connectionId/reject', connectionController.rejectConnectionRequest);

// Withdraw connection request
router.put('/:connectionId/withdraw', connectionController.withdrawConnectionRequest);

// Get received requests
router.get('/received', connectionController.getReceivedRequests);

// Get sent requests
router.get('/sent', connectionController.getSentRequests);

// Get active connections
router.get('/active', connectionController.getActiveConnections);

// Get received likes (users who swiped right on current user)
router.get('/received-likes', connectionController.getReceivedLikes);

module.exports = router; 