const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Chat room this message belongs to
  roomId: {
    type: String,
    required: true
  },
  
  // Sender of the message
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Content of the message (encrypted)
  content: {
    type: String,
    required: true,
    maxlength: 2000 // Increased for encrypted content
  },
  
  // Message type (text, image, etc.)
  messageType: {
    type: String,
    enum: ['text', 'image', 'location'],
    default: 'text'
  },
  
  // Encryption fields
  isEncrypted: {
    type: Boolean,
    default: false
  },
  
  // Message hash for integrity verification
  messageHash: {
    type: String
  },
  
  // Additional data for non-text messages
  metadata: {
    imageUrl: String,
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    }
  },
  
  // Message status
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  
  // Timestamp when message was sent
  timestamp: {
    type: Date,
    default: Date.now
  },
  
  
  
  // Whether the message has been deleted
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
messageSchema.index({ roomId: 1, timestamp: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ timestamp: -1 });

// Static method to get messages for a chat room
messageSchema.statics.getMessagesForRoom = function(roomId, limit = 50, offset = 0) {
  return this.find({
    roomId,
    isDeleted: false
  })
  .populate('senderId', 'firstName lastName profilePhotoPath')
  .sort({ timestamp: -1 })
  .limit(limit)
  .skip(offset);
};

// Static method to get unread messages for a user in a room
messageSchema.statics.getUnreadMessages = function(roomId, userId) {
  return this.find({
    roomId,
    senderId: { $ne: userId },
    status: { $ne: 'read' },
    isDeleted: false
  });
};



// Static method to get message count for a room
messageSchema.statics.getMessageCount = function(roomId) {
  return this.countDocuments({
    roomId,
    isDeleted: false
  });
};

// Method to mark message as delivered
messageSchema.methods.markAsDelivered = function() {
  this.status = 'delivered';
  return this.save();
};

// Method to mark message as read
messageSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

// Method to soft delete message
messageSchema.methods.softDelete = function() {
  this.isDeleted = true;
  return this.save();
};

module.exports = mongoose.model('Message', messageSchema); 