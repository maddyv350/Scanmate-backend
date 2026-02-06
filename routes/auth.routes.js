const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);

// Complete profile with multipart support for photos
// Use upload.array('photos', 10) to accept up to 10 photos
router.post(
  '/complete-profile',
  authMiddleware,
  upload.array('photos', 10),
  authController.completeProfile
);

router.get('/user/profile', authMiddleware, authController.getUserProfile);
router.get('/profile-for-completion', authMiddleware, authController.getProfileForCompletion);
router.patch('/update-profile-field', authMiddleware, authController.updateProfileField);

module.exports = router;