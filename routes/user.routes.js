const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');

// Define user routes
router.get('/profile', userController.getUserProfile);
// Add more user-related routes as needed

module.exports = router;