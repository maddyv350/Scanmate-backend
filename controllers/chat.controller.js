const chatService = require('../services/chat.service');

class ChatController {
  // Get chat rooms for the authenticated user
  async getChatRooms(req, res) {
    try {
      const userId = req.user.userId;
      const chatRooms = await chatService.getChatRoomsForUser(userId);
      
      res.json({
        success: true,
        data: chatRooms
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get messages for a specific chat room
  async getMessages(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.userId;
      const { limit = 50, offset = 0 } = req.query;

      const messages = await chatService.getMessagesForRoom(
        roomId, 
        userId, 
        parseInt(limit), 
        parseInt(offset)
      );
      
      res.json({
        success: true,
        data: messages
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Send a message
  async sendMessage(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.userId;
      const { content, messageType = 'text', metadata = {} } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Message content is required'
        });
      }

      const message = await chatService.sendMessage(
        roomId,
        userId,
        content.trim(),
        messageType,
        metadata
      );
      
      res.json({
        success: true,
        data: message
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Create or get chat room for two users
  async createChatRoom(req, res) {
    try {
      const userId = req.user.userId;
      const { otherUserId } = req.body;

      if (!otherUserId) {
        return res.status(400).json({
          success: false,
          message: 'Other user ID is required'
        });
      }

      const chatRoom = await chatService.createOrGetChatRoom(userId, otherUserId);
      
      res.json({
        success: true,
        data: {
          roomId: chatRoom.roomId,
          participants: chatRoom.participants
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Mark messages as read
  async markMessagesAsRead(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.userId;

      await chatService.markMessagesAsRead(roomId, userId);
      
      res.json({
        success: true,
        message: 'Messages marked as read'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Delete a message
  async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      const userId = req.user.userId;

      await chatService.deleteMessage(messageId, userId);
      
      res.json({
        success: true,
        message: 'Message deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get unread message count
  async getUnreadCount(req, res) {
    try {
      const userId = req.user.userId;
      const unreadCount = await chatService.getUnreadCount(userId);
      
      res.json({
        success: true,
        data: { unreadCount }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new ChatController(); 