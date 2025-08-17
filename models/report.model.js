const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  // Reporter (the user who is reporting)
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Reported user (the user being reported)
  reportedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Report reason
  reason: {
    type: String,
    enum: [
      'Inappropriate behavior',
      'Harassment',
      'Fake profile',
      'Spam',
      'Underage',
      'Violence',
      'Other'
    ],
    required: true
  },
  
  // Additional details
  description: {
    type: String,
    maxlength: 1000,
    trim: true
  },
  
  // Evidence (screenshots, etc.)
  evidence: [{
    type: String  // URLs to evidence files
  }],
  
  // Report status
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending'
  },
  
  // Admin notes
  adminNotes: {
    type: String,
    maxlength: 1000
  },
  
  // Related chat room (if report is about chat)
  chatRoomId: {
    type: String
  },
  
  // Related message (if report is about a specific message)
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  reviewedAt: {
    type: Date
  },
  
  resolvedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
reportSchema.index({ reporterId: 1, reportedUserId: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ createdAt: -1 });

// Static method to get reports by status
reportSchema.statics.getReportsByStatus = function(status) {
  return this.find({ status })
    .populate('reporterId', 'firstName lastName email')
    .populate('reportedUserId', 'firstName lastName email')
    .sort({ createdAt: -1 });
};

// Static method to get reports for a user
reportSchema.statics.getReportsForUser = function(userId) {
  return this.find({ reportedUserId: userId })
    .populate('reporterId', 'firstName lastName email')
    .sort({ createdAt: -1 });
};

// Static method to check if user has been reported by another user
reportSchema.statics.hasBeenReportedBy = function(reportedUserId, reporterId) {
  return this.findOne({ reportedUserId, reporterId, status: { $ne: 'dismissed' } });
};

module.exports = mongoose.model('Report', reportSchema);
