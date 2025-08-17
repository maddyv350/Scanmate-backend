const Swipe = require('../models/swipe.model');
const Connection = require('../models/connection.model');
const User = require('../models/user.model');

/**
 * Record a swipe action
 * POST /api/swipes
 */
const recordSwipe = async (req, res) => {
  try {
    const { targetUserId, swipeDirection, message } = req.body;
    const swiperId = req.user.userId; // From auth middleware - JWT contains userId, not id

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
      
      // If there's a match, create a connection
      if (match) {
        try {
          const connection = new Connection({
            senderId: swiperId,
            receiverId: targetUserId,
            status: 'accepted',
            respondedAt: new Date(),
            isActive: true
          });
          
          await connection.save();
          
          console.log(`🎉 New match created between ${swiperId} and ${targetUserId}`);
        } catch (connectionError) {
          console.error('Error creating connection:', connectionError);
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

/**
 * Get user's swipe history
 * GET /api/swipes/history
 */
const getSwipeHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 50, direction } = req.query;

    // Build query
    const query = { swiperId: userId, isActive: true };
    if (direction && ['right', 'left'].includes(direction)) {
      query.swipeDirection = direction;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Get swipes with pagination
    const swipes = await Swipe.find(query)
      .select('targetUserId swipeDirection timestamp message')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('targetUserId', 'userName userPhoto age gender');

    // Get total count for pagination
    const total = await Swipe.countDocuments(query);

    // Extract just the user IDs for the simple response format
    const swipedUserIds = swipes.map(swipe => swipe.targetUserId._id.toString());

    res.json({
      success: true,
      data: {
        swipedUsers: swipedUserIds,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        },
        details: swipes.map(swipe => ({
          targetUserId: swipe.targetUserId._id,
          userName: swipe.targetUserId.userName,
          userPhoto: swipe.targetUserId.userPhoto,
          age: swipe.targetUserId.age,
          gender: swipe.targetUserId.gender,
          swipeDirection: swipe.swipeDirection,
          timestamp: swipe.timestamp,
          message: swipe.message
        }))
      }
    });

  } catch (error) {
    console.error('Error getting swipe history:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get potential matches (mutual right swipes)
 * GET /api/swipes/matches
 */
const getPotentialMatches = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;

    // Get potential matches
    const matches = await Swipe.findPotentialMatches(userId);
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);
    const paginatedMatches = matches.slice(skip, skip + limitNum);

    // Get user details for matches
    const matchDetails = await Promise.all(
      paginatedMatches.map(async (match) => {
        const user = await User.findById(match.targetUserId)
          .select('userName userPhoto age gender bio');
        
        return {
          userId: match.targetUserId,
          userName: user?.userName || 'Unknown User',
          userPhoto: user?.userPhoto,
          age: user?.age,
          gender: user?.gender,
          bio: user?.bio,
          matchedAt: match.timestamp
        };
      })
    );

    res.json({
      success: true,
      data: {
        matches: matchDetails,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total: matches.length,
          pages: Math.ceil(matches.length / limitNum)
        }
      }
    });

  } catch (error) {
    console.error('Error getting potential matches:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete a swipe (for testing or user request)
 * DELETE /api/swipes/:swipeId
 */
const deleteSwipe = async (req, res) => {
  try {
    const { swipeId } = req.params;
    const userId = req.user.userId;

    const swipe = await Swipe.findById(swipeId);
    
    if (!swipe) {
      return res.status(404).json({
        success: false,
        message: 'Swipe not found'
      });
    }

    // Only allow user to delete their own swipes
    if (swipe.swiperId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own swipes'
      });
    }

    // Soft delete by setting isActive to false
    swipe.isActive = false;
    await swipe.save();

    res.json({
      success: true,
      message: 'Swipe deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting swipe:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  recordSwipe,
  getSwipeHistory,
  getPotentialMatches,
  deleteSwipe
};
