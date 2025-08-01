const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/complete-profile', authMiddleware, authController.completeProfile);
router.get('/user/profile', authMiddleware, authController.getUserProfile);
router.get('/profile-for-completion', authMiddleware, authController.getProfileForCompletion);
router.patch('/update-profile-field', authMiddleware, authController.updateProfileField);
router.post('/upload-profile-photo', authMiddleware, authController.uploadProfilePhoto);

module.exports = router;