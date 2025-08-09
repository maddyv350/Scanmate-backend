const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const locationRoutes = require('./location.routes');
const connectionRoutes = require('./connection.routes');
const chatRoutes = require('./chat.routes');
const encryptionRoutes = require('./encryption.routes');

// Import middleware
const authMiddleware = require('../middleware/auth.middleware');

// Mount routes with appropriate paths
router.use('/auth', authRoutes);
router.use('/user', authMiddleware, userRoutes);
router.use('/location', locationRoutes);
router.use('/connection', connectionRoutes);
router.use('/chat', chatRoutes);
router.use('/encryption', encryptionRoutes);

module.exports = router;
