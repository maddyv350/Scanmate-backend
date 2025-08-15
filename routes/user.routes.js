const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');

// Block/Unblock routes
router.post('/block', userController.blockUser);
router.post('/unblock', userController.unblockUser);
router.get('/blocked', userController.getBlockedUsers);
router.get('/blocked/:otherUserId', userController.isUserBlocked);

// Report routes
router.post('/report', userController.reportUser);

// Admin routes (these should be protected with admin middleware)
router.get('/reports', userController.getAllReports);
router.get('/reports/:userId', userController.getReportsForUser);
router.put('/reports/:reportId/status', userController.updateReportStatus);

module.exports = router;