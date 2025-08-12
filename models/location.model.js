const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  userPhoto: {
    type: String,
    default: null,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],  // [longitude, latitude] format for MongoDB
      required: true
    }
  },
  droppedAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  userBio: {
    type: String,
    default: null,
  },
  age: {
    type: Number,
    default: 0,
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    default: 'Other',
  },
}, {
  timestamps: true,
});

// Index for geospatial queries
locationSchema.index({ location: '2dsphere' });
locationSchema.index({ userId: 1 });
locationSchema.index({ isActive: 1 });
locationSchema.index({ expiresAt: 1 });

// Method to check if location is still active
locationSchema.methods.isLocationActive = function() {
  return this.isActive && this.expiresAt > new Date();
};

// Static method to find nearby users
locationSchema.statics.findNearbyUsers = function(latitude, longitude, radiusInKm, currentUserId, connectedUserIds) {
  console.log('🔍 Finding nearby users at:', { latitude, longitude, radiusInKm });
  console.log('👤 Current user:', currentUserId);
  console.log('🤝 Connected users:', connectedUserIds);
  
  // Convert IDs to ObjectId if they're valid
  const convertToObjectId = (id) => {
    try {
      return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
    } catch (e) {
      console.error('Error converting ID:', id, e);
      return id;
    }
  };

  const idsToExclude = [currentUserId, ...connectedUserIds].map(convertToObjectId);
  console.log('🚫 IDs to exclude:', idsToExclude);

  const query = {
    isActive: true,
    expiresAt: { $gt: new Date() },
    userId: { $nin: idsToExclude }
  };

  console.log('🔍 Final query:', JSON.stringify(query, (key, value) => {
    if (key === 'userId' && value.$nin) {
      return { $nin: value.$nin.map(id => id.toString()) };
    }
    return value;
  }, 2));
  
  console.log('🔍 MongoDB query (no geospatial):', JSON.stringify(query, null, 2));
  
  return this.find(query)
    .populate('userId', 'firstName lastName profilePhotoPath birthDate gender description')
    .then(results => {
      console.log('🔍 Query results count:', results.length);
      results.forEach((result, index) => {
        console.log(`🔍 Result ${index + 1}:`, {
          userId: result.userId,
          userName: result.userName,
          coordinates: result.coordinates,
          isActive: result.isActive,
          expiresAt: result.expiresAt
        });
      });
      return results;
    });
};

// Static method to get user's current location
locationSchema.statics.getUserLocation = function(userId) {
  return this.findOne({
    userId: userId,
    isActive: true,
    expiresAt: { $gt: new Date() },
  });
};

// Static method to get daily drop count for a user
locationSchema.statics.getDailyDropCount = function(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return this.countDocuments({
    userId: userId,
    droppedAt: {
      $gte: today,
      $lt: tomorrow,
    },
  });
};

module.exports = mongoose.model('Location', locationSchema); 