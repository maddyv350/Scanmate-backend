const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema({
  // The user who sent the connection request
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  
  // The user who received the connection request
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  
  // Status of the connection request
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
    default: 'pending',
  },
  
  // Message sent with the request (optional)
  message: {
    type: String,
    maxlength: 200,
  },
  
  // When the request was sent
  sentAt: {
    type: Date,
    default: Date.now,
  },
  
  // When the request was responded to (accepted/rejected)
  respondedAt: {
    type: Date,
  },
  
  // Whether the connection is active (for accepted connections)
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Index for efficient queries
connectionSchema.index({ senderId: 1, receiverId: 1 }, { unique: true });
connectionSchema.index({ status: 1 });
connectionSchema.index({ sentAt: -1 });

// Static method to get received requests for a user
connectionSchema.statics.getReceivedRequests = function(userId) {
  return this.find({
    receiverId: userId,
    status: 'pending',
  }).populate('senderId', 'firstName lastName profilePhotoPath description industry');
};

// Static method to get sent requests for a user
connectionSchema.statics.getSentRequests = function(userId) {
  return this.find({
    senderId: userId,
    status: { $in: ['pending', 'accepted', 'rejected'] },
  }).populate('receiverId', 'firstName lastName profilePhotoPath description industry');
};

// Static method to get active connections for a user
connectionSchema.statics.getActiveConnections = function(userId) {
  return this.find({
    $or: [
      { senderId: userId },
      { receiverId: userId }
    ],
    status: 'accepted',
    isActive: true,
  }).populate('senderId', 'firstName lastName profilePhotoPath description industry')
    .populate('receiverId', 'firstName lastName profilePhotoPath description industry');
};

// Static method to check if a connection request exists
connectionSchema.statics.checkConnectionExists = function(senderId, receiverId) {
  return this.findOne({
    $or: [
      { senderId, receiverId },
      { senderId: receiverId, receiverId: senderId }
    ]
  });
};

const Connection = mongoose.model('Connection', connectionSchema);

module.exports = Connection; 