const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Apply authentication middleware to all chat routes
router.use(authMiddleware);

// Get chat rooms for the authenticated user
router.get('/rooms', chatController.getChatRooms);

// Get messages for a specific chat room
router.get('/rooms/:roomId/messages', chatController.getMessages);

// Send a message to a chat room
router.post('/rooms/:roomId/messages', chatController.sendMessage);

// Create or get chat room for two users
router.post('/rooms', chatController.createChatRoom);

// Mark messages as read in a chat room
router.put('/rooms/:roomId/read', chatController.markMessagesAsRead);

// Delete a message
router.delete('/messages/:messageId', chatController.deleteMessage);

// Get unread message count for the authenticated user
router.get('/unread-count', chatController.getUnreadCount);

module.exports = router; 