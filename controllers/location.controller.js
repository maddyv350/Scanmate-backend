const mongoose = require('mongoose');
const Location = require('../models/location.model');
const User = require('../models/user.model');

/** Location document stores Male/Female/Other; User profile uses Man/Woman/Non-binary. */
const LOCATION_TO_USER_GENDER = { Male: 'Man', Female: 'Woman', Other: 'Non-binary' };

/**
 * Maps viewer "Who would you like to date?" (interestedIn) to allowed profile genders.
 * @returns {Set<string>|null} null = no filter (Everyone, missing, or empty)
 */
function mapInterestedInToAllowedGenders(interestedIn) {
  if (!interestedIn || !Array.isArray(interestedIn) || interestedIn.length === 0) return null;
  if (interestedIn.includes('Everyone')) return null;
  const allowed = new Set();
  for (const label of interestedIn) {
    if (label === 'Men') allowed.add('Man');
    else if (label === 'Women') allowed.add('Woman');
    else if (label === 'Non-binary people') allowed.add('Non-binary');
  }
  return allowed;
}

function resolveUserGenderForNearby(user, location) {
  if (user && user.gender) return user.gender;
  if (location && location.gender && LOCATION_TO_USER_GENDER[location.gender]) {
    return LOCATION_TO_USER_GENDER[location.gender];
  }
  return null;
}

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

      // Map User gender (Man/Woman/Non-binary) to Location enum (Male/Female/Other)
      const genderMap = { Man: 'Male', Woman: 'Female', 'Non-binary': 'Other' };
      const locationGender = (user.gender && genderMap[user.gender]) || 'Other';

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
        gender: locationGender,
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

      // Check if the requesting user has dropped their location
      const userLocation = await Location.getUserLocation(userId);
      if (!userLocation) {
        return res.status(403).json({
          success: false,
          message: 'You must drop your location first to view other profiles. Please drop your location to see nearby users.',
          error: 'Location not dropped'
        });
      }

      console.log('✅ User has active location drop, proceeding with nearby users search');

      const viewer = await User.findById(userId).select('interestedIn');
      const allowedGenders = mapInterestedInToAllowedGenders(viewer?.interestedIn);

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

      const hasValidCoords = (loc) => loc.location?.coordinates && Array.isArray(loc.location.coordinates) && loc.location.coordinates.length >= 2;

      const usersWithDistance = nearbyUsers
        .filter(location => {
          if (!hasValidCoords(location)) {
            console.log('⚠️ Skipping location missing coordinates:', location._id);
            return false;
          }
          const locationUserId = location.userId?._id || location.userId;
          const locationUserIdStr = locationUserId ? locationUserId.toString() : '';

          const isNotCurrentUser = locationUserIdStr !== userId.toString();
          const isNotConnected = !connectedUserIds.includes(locationUserIdStr);
          const isNotSwiped = !swipedUserIds.includes(locationUserIdStr);

          let shouldShow = isNotCurrentUser && isNotConnected && isNotSwiped;

          if (shouldShow && allowedGenders !== null) {
            const profileUser = location.userId && typeof location.userId === 'object'
              ? location.userId
              : null;
            const candidateGender = resolveUserGenderForNearby(profileUser, location);
            if (allowedGenders.size === 0) {
              shouldShow = false;
            } else if (!candidateGender || !allowedGenders.has(candidateGender)) {
              shouldShow = false;
            }
          }

          console.log(`👤 User ${locationUserIdStr}: current=${!isNotCurrentUser ? 'FILTERED' : 'OK'}, connected=${!isNotConnected ? 'FILTERED' : 'OK'}, swiped=${!isNotSwiped ? 'FILTERED' : 'OK'} -> ${shouldShow ? 'SHOW' : 'FILTERED'}`);

          return shouldShow;
        })
        .map(location => {
          const coords = location.location?.coordinates;
          const lat = Array.isArray(coords) && coords.length >= 2 ? coords[1] : parseFloat(latitude);
          const lng = Array.isArray(coords) && coords.length >= 2 ? coords[0] : parseFloat(longitude);
          const distance = calculateDistance(
            parseFloat(latitude),
            parseFloat(longitude),
            lat,
            lng
          );

          const user = location.userId;
          const dropScore = 0;
          const connects = 0;
          const purposes = [];

          const userPhotos = user?.photos && Array.isArray(user.photos) ? user.photos : [];
          const userPrompts = user?.prompts && Array.isArray(user.prompts) ? user.prompts : [];
          const firstPhoto = userPhotos[0] || location.userPhoto || null;

          let age = location.age;
          if ((age == null || age === 0) && user?.birthDate) {
            const birth = new Date(user.birthDate);
            const now = new Date();
            age = Math.floor((now - birth) / (365.25 * 24 * 60 * 60 * 1000));
          }

          const gender = resolveUserGenderForNearby(user, location);

          console.log(`📍 User ${location.userName} at distance ${distance.toFixed(2)}km`);

          return {
            id: location._id,
            userId: user?._id || location.userId,
            userName: location.userName,
            userPhoto: firstPhoto,
            photos: userPhotos,
            prompts: userPrompts,
            coordinates: {
              latitude: lat,
              longitude: lng
            },
            droppedAt: location.droppedAt,
            expiresAt: location.expiresAt,
            isActive: location.isActive,
            userBio: location.userBio || null,
            age: age || null,
            gender: gender,
            distance: distance,
            dropScore: dropScore,
            connects: connects,
            purposes: purposes,
            firstName: user?.firstName ?? null,
            lastName: user?.lastName ?? null,
            birthDate: user?.birthDate ?? null,
            sexuality: user?.sexuality ?? null,
            pronouns: user?.pronouns ?? null,
            height: user?.height ?? null,
            ethnicity: user?.ethnicity ?? null,
            zodiacSign: user?.zodiacSign ?? null,
            smokingStatus: user?.smokingStatus ?? null,
            drinkingStatus: user?.drinkingStatus ?? null,
            datingIntentions: user?.datingIntentions ?? null,
            relationshipType: user?.relationshipType ?? null,
            jobTitle: user?.jobTitle ?? null,
            workplace: user?.workplace ?? null,
            school: user?.school ?? null,
            educationLevel: user?.educationLevel ?? null,
            hometown: user?.hometown ?? null,
            languagesSpoken: user?.languagesSpoken ?? null,
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
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers
  return distance;
}

module.exports = locationController; 