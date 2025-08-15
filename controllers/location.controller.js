const mongoose = require('mongoose');
const Location = require('../models/location.model');
const User = require('../models/user.model');

const locationController = {
  // Drop by location
  async dropByLocation(req, res) {
    try {
      const { latitude, longitude } = req.body;
      const userId = req.user.userId;
      
      console.log('DropBy request - User ID:', userId);
      console.log('DropBy request - Coordinates:', { latitude, longitude });

      // Check daily drop limit
      const dailyDropCount = await Location.getDailyDropCount(userId);
      if (dailyDropCount >= 3) {
        return res.status(400).json({
          message: 'Daily drop limit reached. You can only drop 3 times per day.',
        });
      }

      // Get user data
      const user = await User.findById(userId);
      console.log('User lookup result:', user ? 'Found' : 'Not found');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Calculate age
      const age = user.birthDate ? Math.floor((new Date() - new Date(user.birthDate)) / (365.25 * 24 * 60 * 60 * 1000)) : 0;

      // Set expiration time (4 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 4);

      // Remove any existing active location for this user
      await Location.updateMany(
        { userId: userId, isActive: true },
        { isActive: false }
      );

      // Create new location
      const location = new Location({
        userId: userId,
        userName: `${user.firstName} ${user.lastName}`.trim(),
        userPhoto: user.profilePhotoPath,
        location: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)], // MongoDB uses [longitude, latitude] order
        },
        droppedAt: new Date(),
        expiresAt: expiresAt,
        isActive: true,
        userBio: user.description,
        age: age,
        gender: user.gender || 'Other',
      });

      await location.save();

      res.status(201).json({
        id: location._id,
        userId: location.userId,
        userName: location.userName,
        userPhoto: location.userPhoto,
        coordinates: {
          latitude: location.location.coordinates[1],
          longitude: location.location.coordinates[0]
        },
        droppedAt: location.droppedAt,
        expiresAt: location.expiresAt,
        isActive: location.isActive,
        userBio: location.userBio,
        age: location.age,
        gender: location.gender,
        dropScore: 0, // Placeholder - can be implemented later
        connects: 0,  // Placeholder - can be implemented later
        purposes: [], // Placeholder - can be implemented later
      });
    } catch (error) {
      console.error('Error dropping location:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ message: 'Server error' });
    }
  },

  // Get nearby users
  async getNearbyUsers(req, res) {
    try {
      const { latitude, longitude, radius = 1 } = req.query;
      const userId = req.user.userId;

      console.log('🔍 Getting nearby users for userId:', userId);
      console.log('📍 Search coordinates:', { latitude, longitude, radius });

      // Get active connections for the current user
      const Connection = require('../models/connection.model');
      console.log('🔍 Looking for active connections for user:', userId);
      
      // Get swipe history to filter out swiped users
      const Swipe = require('../models/swipe.model');
      console.log('🔍 Looking for swipe history for user:', userId);
      
      const swipedUsers = await Swipe.find({ 
        swiperId: userId, 
        isActive: true 
      }).select('targetUserId');
      
      const swipedUserIds = swipedUsers.map(swipe => swipe.targetUserId.toString());
      console.log('🚫 Swiped user IDs:', swipedUserIds);
      
      // Convert userId to ObjectId if it's not already
      const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
        ? new mongoose.Types.ObjectId(userId)
        : userId;

      console.log('🔍 Looking for connections with userObjectId:', userObjectId);

      const activeConnections = await Connection.find({
        $or: [
          { senderId: userObjectId, status: 'accepted', isActive: true },
          { receiverId: userObjectId, status: 'accepted', isActive: true }
        ]
      });
      
      console.log('🤝 Found active connections:', activeConnections.map(conn => ({
        id: conn._id,
        senderId: conn.senderId,
        receiverId: conn.receiverId,
        status: conn.status,
        isActive: conn.isActive
      })));

      // Extract connected user IDs
      const connectedUserIds = activeConnections.map(conn => 
        conn.senderId.toString() === userId.toString() ? conn.receiverId : conn.senderId
      );

      console.log('🤝 Connected user IDs:', connectedUserIds);

      const nearbyUsers = await Location.findNearbyUsers(
        parseFloat(latitude),
        parseFloat(longitude),
        parseFloat(radius),
        userId,
        connectedUserIds
      );

      console.log('📊 Found nearby users:', nearbyUsers.length);

      // Filter out current user, connected users, and swiped users, then calculate distances
      const usersWithDistance = nearbyUsers
        .filter(location => {
          // Handle both ObjectId and string comparisons
          const locationUserId = location.userId._id || location.userId;
          const locationUserIdStr = locationUserId.toString();
          
          const isNotCurrentUser = locationUserIdStr !== userId.toString();
          const isNotConnected = !connectedUserIds.includes(locationUserIdStr);
          const isNotSwiped = !swipedUserIds.includes(locationUserIdStr);
          
          const shouldShow = isNotCurrentUser && isNotConnected && isNotSwiped;
          
          console.log(`👤 User ${locationUserIdStr}: current=${!isNotCurrentUser ? 'FILTERED' : 'OK'}, connected=${!isNotConnected ? 'FILTERED' : 'OK'}, swiped=${!isNotSwiped ? 'FILTERED' : 'OK'} -> ${shouldShow ? 'SHOW' : 'FILTERED'}`);
          
          return shouldShow;
        })
        .map(location => {
          const distance = calculateDistance(
            parseFloat(latitude),
            parseFloat(longitude),
            location.location.coordinates[1],
            location.location.coordinates[0]
          );

          // Get user data from populated userId field
          const user = location.userId;
          const dropScore = 0; // Placeholder - can be implemented later
          const connects = 0;  // Placeholder - can be implemented later
          const purposes = []; // Placeholder - can be implemented later

          console.log(`📍 User ${location.userName} at distance ${distance.toFixed(2)}km`);

          return {
            id: location._id,
            userId: user?._id || location.userId,
            userName: location.userName,
            userPhoto: location.userPhoto,
            coordinates: {
          latitude: location.location.coordinates[1],
          longitude: location.location.coordinates[0]
        },
            droppedAt: location.droppedAt,
            expiresAt: location.expiresAt,
            isActive: location.isActive,
            userBio: location.userBio,
            age: location.age,
            gender: location.gender,
            distance: distance,
            dropScore: dropScore,
            connects: connects,
            purposes: purposes,
          };
        })
        .sort((a, b) => a.distance - b.distance);

      console.log('✅ Returning users:', usersWithDistance.length);

      res.json({
        users: usersWithDistance,
        count: usersWithDistance.length,
      });
    } catch (error) {
      console.error('Error getting nearby users:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  // Remove location
  async removeLocation(req, res) {
    try {
      const userId = req.user.userId;

      const result = await Location.updateMany(
        { userId: userId, isActive: true },
        { isActive: false }
      );

      if (result.modifiedCount > 0) {
        res.json({ message: 'Location removed successfully' });
      } else {
        res.status(404).json({ message: 'No active location found' });
      }
    } catch (error) {
      console.error('Error removing location:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  // Get current user location
  async getCurrentUserLocation(req, res) {
    try {
      const userId = req.user.userId;

      const location = await Location.getUserLocation(userId);

      if (!location) {
        return res.status(404).json({ message: 'No active location found' });
      }

      // Fetch user details to include dropScore, connects, purposes
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        id: location._id,
        userId: location.userId,
        userName: location.userName,
        userPhoto: location.userPhoto,
        coordinates: {
          latitude: location.location.coordinates[1],
          longitude: location.location.coordinates[0]
        },
        droppedAt: location.droppedAt,
        expiresAt: location.expiresAt,
        isActive: location.isActive,
        userBio: location.userBio,
        age: location.age,
        gender: location.gender,
        dropScore: 0, // Placeholder - can be implemented later
        connects: 0,  // Placeholder - can be implemented later
        purposes: [], // Placeholder - can be implemented later
      });
    } catch (error) {
      console.error('Error getting current user location:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  // Get daily drop count
  async getDailyDropCount(req, res) {
    try {
      const userId = req.user.userId;

      const count = await Location.getDailyDropCount(userId);

      res.json({ count: count });
    } catch (error) {
      console.error('Error getting daily drop count:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  // Get drop score (placeholder - you can implement scoring logic)
  async getDropScore(req, res) {
    try {
      const userId = req.user.userId;

      // Simple scoring based on total drops
      const totalDrops = await Location.countDocuments({ userId: userId });
      const score = Math.floor(totalDrops * 10); // 10 points per drop

      res.json({ score: score });
    } catch (error) {
      console.error('Error getting drop score:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
};

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return distance;
}

module.exports = locationController; 