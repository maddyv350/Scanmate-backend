const mongoose = require('mongoose');

const swipeSchema = new mongoose.Schema({
  swiperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  swipeDirection: {
    type: String,
    enum: ['right', 'left'],
    required: true
  },
  message: {
    type: String,
    maxlength: 500,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // For future cooldown functionality
  cooldownExpiresAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Compound index to ensure unique swipes per user pair
swipeSchema.index({ swiperId: 1, targetUserId: 1 }, { unique: true });

// Index for efficient querying of user's swipe history
swipeSchema.index({ swiperId: 1, timestamp: -1 });

// Index for finding potential matches (right swipes)
swipeSchema.index({ targetUserId: 1, swipeDirection: 1, isActive: 1 });

// Virtual for checking if this swipe could lead to a match
swipeSchema.virtual('isRightSwipe').get(function() {
  return this.swipeDirection === 'right';
});

// Static method to get user's swipe history
swipeSchema.statics.getUserSwipeHistory = function(userId) {
  return this.find({ 
    swiperId: userId, 
    isActive: true 
  })
  .select('targetUserId swipeDirection timestamp')
  .sort({ timestamp: -1 });
};

// Static method to check if user has swiped on target
swipeSchema.statics.hasUserSwiped = function(swiperId, targetUserId) {
  return this.findOne({ 
    swiperId, 
    targetUserId, 
    isActive: true 
  });
};

// Static method to find potential matches (mutual right swipes)
swipeSchema.statics.findPotentialMatches = function(userId) {
  return this.aggregate([
    // Find all right swipes by the user
    {
      $match: {
        swiperId: mongoose.Types.ObjectId(userId),
        swipeDirection: 'right',
        isActive: true
      }
    },
    // Look for mutual right swipes
    {
      $lookup: {
        from: 'swipes',
        let: { targetUserId: '$targetUserId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$swiperId', '$$targetUserId'] },
                  { $eq: ['$targetUserId', mongoose.Types.ObjectId(userId)] },
                  { $eq: ['$swipeDirection', 'right'] },
                  { $eq: ['$isActive', true] }
                ]
              }
            }
          }
        ],
        as: 'mutualSwipe'
      }
    },
    // Only return if there's a mutual swipe
    {
      $match: {
        'mutualSwipe.0': { $exists: true }
      }
    },
    // Return the target user ID
    {
      $project: {
        targetUserId: 1,
        timestamp: 1
      }
    }
  ]);
};

// Instance method to check if this swipe created a match
swipeSchema.methods.checkForMatch = async function() {
  if (this.swipeDirection !== 'right') return null;
  
  const Swipe = this.constructor;
  const mutualSwipe = await Swipe.findOne({
    swiperId: this.targetUserId,
    targetUserId: this.swiperId,
    swipeDirection: 'right',
    isActive: true
  });
  
  return mutualSwipe ? {
    matchId: this._id,
    mutualSwipeId: mutualSwipe._id,
    timestamp: this.timestamp
  } : null;
};

// Pre-save middleware to handle cooldown logic
swipeSchema.pre('save', function(next) {
  // Set cooldown expiration (e.g., 30 days for left swipes, 90 days for right swipes)
  if (!this.cooldownExpiresAt) {
    const cooldownDays = this.swipeDirection === 'right' ? 90 : 30;
    this.cooldownExpiresAt = new Date(Date.now() + (cooldownDays * 24 * 60 * 60 * 1000));
  }
  next();
});

module.exports = mongoose.model('Swipe', swipeSchema);
