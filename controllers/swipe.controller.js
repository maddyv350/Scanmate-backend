const Swipe = require('../models/swipe.model');
const Connection = require('../models/connection.model');
const User = require('../models/user.model');
const Location = require('../models/location.model');
const chatService = require('../services/chat.service');

/**
 * Record a swipe action
 * POST /api/swipes
 */
const recordSwipe = async (req, res) => {
  try {
    const { targetUserId, swipeDirection, message } = req.body;
    const swiperId = req.user.userId; // From auth middleware - JWT contains userId, not id

    // Check if the user has dropped their location (required to swipe)
    const userLocation = await Location.getUserLocation(swiperId);
    if (!userLocation) {
      return res.status(403).json({
        success: false,
        message: 'You must drop your location first to swipe on profiles. Please drop your location to interact with other users.',
        error: 'Location not dropped'
      });
    }

    // Validate input
    if (!targetUserId || !swipeDirection) {
      return res.status(400).json({
        success: false,
        message: 'targetUserId and swipeDirection are required'
      });
    }

    if (!['right', 'left'].includes(swipeDirection)) {
      return res.status(400).json({
        success: false,
        message: 'swipeDirection must be either "right" or "left"'
      });
    }

    // Prevent self-swiping
    if (swiperId === targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot swipe on yourself'
      });
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found'
      });
    }

    // Check if user has already swiped on this target
    const existingSwipe = await Swipe.hasUserSwiped(swiperId, targetUserId);
    if (existingSwipe) {
      return res.status(409).json({
        success: false,
        message: 'You have already swiped on this user',
        existingSwipe: {
          direction: existingSwipe.swipeDirection,
          timestamp: existingSwipe.timestamp
        }
      });
    }

    // Create new swipe record
    const swipe = new Swipe({
      swiperId,
      targetUserId,
      swipeDirection,
      message: swipeDirection === 'right' ? message : null,
      timestamp: new Date()
    });

    await swipe.save();

    // If it's a right swipe, check for potential match
    let match = null;
    if (swipeDirection === 'right') {
      match = await swipe.checkForMatch();
      
      // If there's a match, create a connection, sync matches, and chat room
      if (match) {
        try {
          // Check if connection already exists
          let connection = await Connection.findOne({
            $or: [
              { senderId: swiperId, receiverId: targetUserId },
              { senderId: targetUserId, receiverId: swiperId }
            ],
            status: 'accepted',
            isActive: true
          });

          // Create connection if it doesn't exist
          if (!connection) {
            connection = new Connection({
              senderId: swiperId,
              receiverId: targetUserId,
              status: 'accepted',
              respondedAt: new Date(),
              isActive: true
            });
            await connection.save();
          }
          
          // Sync matches - add each user to the other's matches array
          const swiper = await User.findById(swiperId);
          const target = await User.findById(targetUserId);
          
          if (swiper && target) {
            // Add target to swiper's matches if not already there
            if (!swiper.matches.includes(targetUserId)) {
              swiper.matches.push(targetUserId);
              await swiper.save();
              console.log(`✅ Added ${targetUserId} to ${swiperId}'s matches`);
            }
            
            // Add swiper to target's matches if not already there
            if (!target.matches.includes(swiperId)) {
              target.matches.push(swiperId);
              await target.save();
              console.log(`✅ Added ${swiperId} to ${targetUserId}'s matches`);
            }
          }
          
          // Auto-create chat room for the match
          try {
            await chatService.createOrGetChatRoom(swiperId, targetUserId);
            console.log(`💬 Chat room created for match between ${swiperId} and ${targetUserId}`);
          } catch (chatError) {
            console.error('Error creating chat room:', chatError);
            // Don't fail the swipe if chat room creation fails
          }
          
          console.log(`🎉 New match created between ${swiperId} and ${targetUserId}`);
        } catch (connectionError) {
          console.error('Error creating connection or syncing matches:', connectionError);
          // Don't fail the swipe if connection creation fails
        }
      }
    }

    // Prepare response
    const response = {
      success: true,
      message: 'Swipe recorded successfully',
      data: {
        swipeId: swipe._id,
        swiperId,
        targetUserId,
        swipeDirection,
        timestamp: swipe.timestamp,
        isMatch: !!match
      }
    };

    // Add match details if there's a match
    if (match) {
      response.data.match = {
        matchId: match.matchId,
        timestamp: match.timestamp
      };
    }

    res.status(201).json(response);

  } catch (error) {
    console.error('Error recording swipe:', error);
    
    // Handle duplicate key error (shouldn't happen due to our check, but just in case)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You have already swiped on this user'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  recordSwipe
};
