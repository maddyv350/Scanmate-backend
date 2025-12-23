const mongoose = require('mongoose');
const ChatRoom = require('../models/chat.model');
const Message = require('../models/message.model');
const Connection = require('../models/connection.model');
const User = require('../models/user.model');
const EncryptionService = require('./encryption.service');

class ChatService {
  // Get chat rooms for a user
  async getChatRoomsForUser(userId) {
    try {
      const chatRooms = await ChatRoom.getChatRoomsForUser(userId);

      // Format the response
      return chatRooms.map(room => {
        const otherParticipant = room.participants.find(p => p._id.toString() !== userId);

        // Skip rooms where we can't find the other participant
        if (!otherParticipant) {
          console.log('⚠️ Skipping chat room with no other participant:', room.roomId);
          return null;
        }

        const unreadCount = room.unreadCounts.get(userId) || 0;



        return {
          roomId: room.roomId,
          otherUser: {
            id: otherParticipant._id,
            firstName: otherParticipant.firstName || '',
            lastName: null, // User model doesn't have lastName
            profilePhotoPath: (otherParticipant.photos && otherParticipant.photos.length > 0)
              ? otherParticipant.photos[0]
              : null
          },
          lastMessage: room.lastMessage ? {
            content: room.lastMessage.content,
            senderId: room.lastMessage.senderId?._id,
            senderName: room.lastMessage.senderId?.firstName || '',
            timestamp: room.lastMessage.timestamp,
            isEncrypted: room.lastMessage.isEncrypted,
            messageHash: room.lastMessage.messageHash
          } : null,
          unreadCount,
          updatedAt: room.updatedAt
        };
      }).filter(room => room !== null); // Remove null rooms
    } catch (error) {
      throw new Error(`Failed to get chat rooms: ${error.message}`);
    }
  }

  // Get messages for a chat room
  async getMessagesForRoom(roomId, userId, limit = 50, offset = 0) {
    try {
      console.log(`🔍 Getting messages for room: ${roomId}, user: ${userId}`);
      
      // Validate user ID format
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        console.log(`❌ Invalid user ID format: ${userId}`);
        throw new Error('Invalid user ID format');
      }

      // Verify user exists
      const user = await User.findById(userId);
      if (!user) {
        console.log(`❌ User not found: ${userId}`);
        throw new Error('User not found');
      }
      console.log(`✅ User found: ${user.firstName} ${user.lastName}`);

      // Verify user is part of the chat room
      const chatRoom = await ChatRoom.getChatRoom(roomId);
      if (!chatRoom) {
        console.log(`❌ Chat room not found: ${roomId}`);
        throw new Error('Chat room not found');
      }

      console.log(`✅ Chat room found with ${chatRoom.participants.length} participants`);
      console.log(`👥 Participants: ${chatRoom.participants.map(p => p._id.toString())}`);

      if (!chatRoom.participants.some(p => p._id.toString() === userId)) {
        console.log(`❌ User ${userId} not authorized for room ${roomId}`);
        throw new Error('User not authorized to access this chat room');
      }

      console.log(`✅ User ${userId} authorized for room ${roomId}`);

      const messages = await Message.getMessagesForRoom(roomId, limit, offset);
      console.log(`📨 Found ${messages.length} messages for room ${roomId}`);

      // Mark messages as read
      try {
        await Message.markMessagesAsRead(roomId, userId);
        console.log(`✅ Marked messages as read for user ${userId} in room ${roomId}`);
      } catch (markReadError) {
        console.error(`❌ Error marking messages as read: ${markReadError.message}`);
        // Don't throw here, continue with getting messages
      }

      // Reset unread count for this user
      try {
        await chatRoom.resetUnreadCount(userId);
        console.log(`✅ Reset unread count for user ${userId} in room ${roomId}`);
      } catch (resetError) {
        console.error(`❌ Error resetting unread count: ${resetError.message}`);
        // Don't throw here, continue with getting messages
      }

      return messages.reverse().map(message => {
        // Handle case where senderId might not be populated
        const senderIdObj = message.senderId;
        const senderId = senderIdObj?._id || senderIdObj || null;
        const senderFirstName = senderIdObj?.firstName || '';
        const senderLastName = senderIdObj?.lastName || '';
        const senderPhotos = senderIdObj?.photos || [];
        
        return {
          id: message._id,
          roomId: message.roomId, // Include roomId in response
          content: message.content,
          messageType: message.messageType,
          metadata: message.metadata,
          senderId: senderId,
          senderName: senderIdObj ? `${senderFirstName} ${senderLastName}`.trim() : '',
          senderPhoto: senderPhotos.length > 0 ? senderPhotos[0] : (senderIdObj?.profilePhotoPath || null),
          status: message.status,
          timestamp: message.timestamp,
          isOwnMessage: senderId && senderId.toString() === userId,
          isEncrypted: message.isEncrypted || false,
          messageHash: message.messageHash || null
        };
      });
    } catch (error) {
      console.error(`❌ Error in getMessagesForRoom: ${error.message}`);
      console.error(`❌ Stack trace: ${error.stack}`);
      throw new Error(`Failed to get messages: ${error.message}`);
    }
  }

  // Send a message
  async sendMessage(roomId, senderId, content, messageType = 'text', metadata = {}, isEncrypted = false, messageHash = null) {
    try {
      console.log('📨 HTTP: Sending message to room', roomId, 'from user', senderId);

      // Verify user is part of the chat room
      const chatRoom = await ChatRoom.getChatRoom(roomId);
      if (!chatRoom) {
        throw new Error('Chat room not found');
      }

      if (!chatRoom.participants.some(p => p._id.toString() === senderId)) {
        throw new Error('User not authorized to send message to this chat room');
      }

      // Create the message
      const message = new Message({
        roomId,
        senderId,
        content,
        messageType,
        metadata,
        isEncrypted,
        messageHash
      });

      await message.save();
      console.log('📨 HTTP: Message saved with ID', message._id);

      // Update chat room's last message
      await chatRoom.updateLastMessage({
        content,
        senderId,
        timestamp: message.timestamp,
        isEncrypted,
        messageHash
      });

      // Increment unread count for other participants
      const otherParticipants = chatRoom.participants.filter(p => p._id.toString() !== senderId);
      for (const participant of otherParticipants) {
        await chatRoom.incrementUnreadCount(participant._id);
      }

      // Populate sender info
      await message.populate('senderId', 'firstName lastName profilePhotoPath');

      const messageData = {
        id: message._id,
        content: message.content,
        messageType: message.messageType,
        metadata: message.metadata,
        senderId: message.senderId._id,
        senderName: `${message.senderId.firstName} ${message.senderId.lastName}`,
        senderPhoto: message.senderId.profilePhotoPath,
        status: message.status,
        timestamp: message.timestamp,
        roomId,
        isEncrypted: message.isEncrypted,
        messageHash: message.messageHash
      };

      console.log('📨 HTTP: Emitting socket event for message', message._id);
      // Emit socket event for real-time delivery
      const socketService = require('./socket.service');
      socketService.sendToRoom(roomId, 'new_message', messageData);

      return messageData;
    } catch (error) {
      console.error('❌ HTTP: Error sending message:', error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  // Create or get chat room for two users
  async createOrGetChatRoom(user1Id, user2Id) {
    try {
      console.log('🔍 Creating chat room between users:', { user1Id, user2Id });

      // Check if there's an active connection between these users
      const connection = await Connection.findOne({
        $or: [
          { senderId: user1Id, receiverId: user2Id },
          { senderId: user2Id, receiverId: user1Id }
        ],
        status: 'accepted',
        isActive: true
      });

      console.log('🔍 Connection found:', connection ? {
        id: connection._id,
        senderId: connection.senderId,
        receiverId: connection.receiverId,
        status: connection.status,
        isActive: connection.isActive
      } : 'No connection found');

      if (!connection) {
        throw new Error('No active connection found between these users');
      }

      const chatRoom = await ChatRoom.findOrCreateChatRoom(user1Id, user2Id, connection._id);
      console.log('🔍 Chat room created/found:', chatRoom ? {
        roomId: chatRoom.roomId,
        participants: chatRoom.participants.map(p => p._id || p),
        connectionId: chatRoom.connectionId
      } : 'Failed to create');
      return chatRoom;
    } catch (error) {
      console.error('❌ Error in createOrGetChatRoom:', error.message);
      throw new Error(`Failed to create chat room: ${error.message}`);
    }
  }

  // Mark messages as read
  async markMessagesAsRead(roomId, userId) {
    try {
      const chatRoom = await ChatRoom.getChatRoom(roomId);
      if (!chatRoom) {
        throw new Error('Chat room not found');
      }

      if (!chatRoom.participants.some(p => p._id.toString() === userId)) {
        throw new Error('User not authorized to access this chat room');
      }

      await Message.markMessagesAsRead(roomId, userId);
      await chatRoom.resetUnreadCount(userId);

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to mark messages as read: ${error.message}`);
    }
  }

  // Delete a message (soft delete)
  async deleteMessage(messageId, userId) {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      if (message.senderId.toString() !== userId) {
        throw new Error('User not authorized to delete this message');
      }

      await message.softDelete();
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete message: ${error.message}`);
    }
  }

  // Get unread message count for a user
  async getUnreadCount(userId) {
    try {
      const chatRooms = await ChatRoom.find({
        participants: userId,
        isActive: true
      });

      let totalUnread = 0;
      for (const room of chatRooms) {
        const unreadCount = room.unreadCounts.get(userId) || 0;
        totalUnread += unreadCount;
      }

      return totalUnread;
    } catch (error) {
      throw new Error(`Failed to get unread count: ${error.message}`);
    }
  }
}

module.exports = new ChatService(); 