const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const KeyService = require('../services/key.service');
const EncryptionService = require('../services/encryption.service');

// Get shared key for a chat room
router.get('/rooms/:roomId/key', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;

    // In a real implementation, verify user is part of the chat room
    const sharedKey = KeyService.getSharedKey(roomId);
    
    res.json({
      success: true,
      data: {
        roomId,
        sharedKey
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Generate new shared key for a chat room
router.post('/rooms/:roomId/key', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;

    // In a real implementation, verify user is part of the chat room
    const sharedKey = KeyService.generateSharedKey(roomId);
    
    res.json({
      success: true,
      data: {
        roomId,
        sharedKey
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Test encryption/decryption
router.post('/test', authMiddleware, async (req, res) => {
  try {
    const { content, roomId } = req.body;
    
    if (!content || !roomId) {
      return res.status(400).json({
        success: false,
        message: 'Content and roomId are required'
      });
    }

    const sharedKey = KeyService.getSharedKey(roomId);
    const encrypted = EncryptionService.encryptMessage(content, sharedKey);
    const decrypted = EncryptionService.decryptMessage(encrypted, sharedKey);
    
    res.json({
      success: true,
      data: {
        original: content,
        encrypted,
        decrypted,
        isMatch: content === decrypted
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
