const mongoose = require('mongoose');
const Swipe = require('../models/swipe.model');
const Connection = require('../models/connection.model');
const User = require('../models/user.model');
const Location = require('../models/location.model');
const chatService = require('../services/chat.service');
const socketService = require('../services/socket.service');

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
          // Ensure ObjectId consistency
          const swiperObjectId = mongoose.Types.ObjectId.isValid(swiperId) 
            ? new mongoose.Types.ObjectId(swiperId) 
            : swiperId;
          const targetObjectId = mongoose.Types.ObjectId.isValid(targetUserId) 
            ? new mongoose.Types.ObjectId(targetUserId) 
            : targetUserId;

          // Check if connection already exists in either direction
          let connection = await Connection.findOne({
            $or: [
              { senderId: swiperObjectId, receiverId: targetObjectId },
              { senderId: targetObjectId, receiverId: swiperObjectId }
            ]
          });

          // Create or update connection
          if (!connection) {
            // Create new connection
            connection = new Connection({
              senderId: swiperObjectId,
              receiverId: targetObjectId,
              status: 'accepted',
              respondedAt: new Date(),
              isActive: true,
              sentAt: new Date()
            });
            try {
              await connection.save();
            } catch (saveError) {
              // If save fails due to unique constraint (race condition), find existing
              if (saveError.code === 11000) {
                connection = await Connection.findOne({
                  $or: [
                    { senderId: swiperObjectId, receiverId: targetObjectId },
                    { senderId: targetObjectId, receiverId: swiperObjectId }
                  ]
                });
              } else {
                throw saveError;
              }
            }
          }

          // Update connection status if needed
          if (connection && connection.status !== 'accepted') {
            connection.status = 'accepted';
            connection.respondedAt = new Date();
            connection.isActive = true;
            await connection.save();
          }
          
          // Sync matches - add each user to the other's matches array
          const swiper = await User.findById(swiperObjectId);
          const target = await User.findById(targetObjectId);
          
          if (swiper && target) {
            // Convert matches to strings for comparison
            const swiperMatchesStr = swiper.matches.map(m => m.toString());
            const targetMatchesStr = target.matches.map(m => m.toString());
            const targetUserIdStr = targetObjectId.toString();
            const swiperIdStr = swiperObjectId.toString();
            
            // Add target to swiper's matches if not already there
            if (!swiperMatchesStr.includes(targetUserIdStr)) {
              swiper.matches.push(targetObjectId);
              await swiper.save();
              console.log(`✅ Added ${targetUserIdStr} to ${swiperIdStr}'s matches`);
            }
            
            // Add swiper to target's matches if not already there
            if (!targetMatchesStr.includes(swiperIdStr)) {
              target.matches.push(swiperObjectId);
              await target.save();
              console.log(`✅ Added ${swiperIdStr} to ${targetUserIdStr}'s matches`);
            }
          }
          
          // Auto-create chat room for the match
          let chatRoom = null;
          try {
            chatRoom = await chatService.createOrGetChatRoom(swiperId, targetUserId);
            console.log(`💬 Chat room created for match between ${swiperId} and ${targetUserId}`);
          } catch (chatError) {
            console.error('Error creating chat room:', chatError);
            // Don't fail the swipe if chat room creation fails
          }
          
          // Send socket notification to both users about the match
          try {
            const swiperUser = await User.findById(swiperObjectId).select('firstName photos');
            const targetUser = await User.findById(targetObjectId).select('firstName photos');
            
            const matchData = {
              matchId: match.matchId,
              timestamp: match.timestamp,
              otherUser: {
                id: targetUser._id.toString(),
                firstName: targetUser.firstName || '',
                photo: targetUser.photos && targetUser.photos.length > 0 ? targetUser.photos[0] : null
              },
              chatRoom: chatRoom ? {
                roomId: chatRoom.roomId,
                participants: chatRoom.participants.map(p => p._id?.toString() || p.toString())
              } : null
            };

            // Notify the swiper (current user)
            socketService.sendToUser(swiperId, 'new_match', matchData);

            // Notify the target user about the match
            const targetMatchData = {
              ...matchData,
              otherUser: {
                id: swiperUser._id.toString(),
                firstName: swiperUser.firstName || '',
                photo: swiperUser.photos && swiperUser.photos.length > 0 ? swiperUser.photos[0] : null
              }
            };
            socketService.sendToUser(targetUserId, 'new_match', targetMatchData);

            console.log(`📢 Match notifications sent to ${swiperId} and ${targetUserId}`);
          } catch (socketError) {
            console.error('Error sending match notifications:', socketError);
            // Don't fail the swipe if socket notification fails
          }
          
          console.log(`🎉 New match created between ${swiperId} and ${targetUserId}`);
        } catch (connectionError) {
          console.error('Error creating connection or syncing matches:', connectionError);
          // Don't fail the swipe if connection creation fails, but log it
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
