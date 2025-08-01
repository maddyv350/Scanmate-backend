const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
  // Unique identifier for the chat room
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Participants in the chat (should be exactly 2 for dating app)
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  
  // Connection that created this chat room
  connectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Connection',
    required: true
  },
  
  // Last message in the chat for preview
  lastMessage: {
    content: String,
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  
  // Unread message counts for each participant
  unreadCounts: {
    type: Map,
    of: Number,
    default: new Map()
  },
  
  // Whether the chat is active
  isActive: {
    type: Boolean,
    default: true
  },
  
  // When the chat was created
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  // When the chat was last updated
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
chatRoomSchema.index({ participants: 1 });
chatRoomSchema.index({ connectionId: 1 });
chatRoomSchema.index({ updatedAt: -1 });

// Static method to find or create chat room for two users
chatRoomSchema.statics.findOrCreateChatRoom = async function(user1Id, user2Id, connectionId) {
  const participants = [user1Id, user2Id].sort();
  
  let chatRoom = await this.findOne({
    participants: { $all: participants, $size: participants.length }
  });
  
  if (!chatRoom) {
    const roomId = `chat_${participants.join('_')}_${Date.now()}`;
    chatRoom = new this({
      roomId,
      participants,
      connectionId,
      unreadCounts: new Map()
    });
    await chatRoom.save();
  }
  
  return chatRoom;
};

// Static method to get chat rooms for a user
chatRoomSchema.statics.getChatRoomsForUser = function(userId) {
  return this.find({
    participants: userId,
    isActive: true
  })
  .populate('participants', 'firstName lastName profilePhotoPath')
  .populate('lastMessage.senderId', 'firstName lastName')
  .sort({ updatedAt: -1 });
};

// Static method to get a specific chat room
chatRoomSchema.statics.getChatRoom = function(roomId) {
  return this.findOne({ roomId })
    .populate('participants', 'firstName lastName profilePhotoPath')
    .populate('lastMessage.senderId', 'firstName lastName');
};

// Method to update last message
chatRoomSchema.methods.updateLastMessage = function(message) {
  this.lastMessage = {
    content: message.content,
    senderId: message.senderId,
    timestamp: message.timestamp || new Date()
  };
  this.updatedAt = new Date();
  return this.save();
};

// Method to increment unread count for a user
chatRoomSchema.methods.incrementUnreadCount = function(userId) {
  const currentCount = this.unreadCounts.get(userId.toString()) || 0;
  this.unreadCounts.set(userId.toString(), currentCount + 1);
  return this.save();
};

// Method to reset unread count for a user
chatRoomSchema.methods.resetUnreadCount = function(userId) {
  this.unreadCounts.set(userId.toString(), 0);
  return this.save();
};

module.exports = mongoose.model('ChatRoom', chatRoomSchema); 