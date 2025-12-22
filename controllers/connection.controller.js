const Connection = require('../models/connection.model');
const User = require('../models/user.model');
const Swipe = require('../models/swipe.model');

const connectionController = {
  // Send a connection request
  async sendConnectionRequest(req, res) {
    try {
      const senderId = req.user.userId;
      const { receiverId, message } = req.body;

      if (!receiverId) {
        return res.status(400).json({ message: 'Receiver ID is required' });
      }

      if (senderId === receiverId) {
        return res.status(400).json({ message: 'Cannot send request to yourself' });
      }

      // Check if receiver exists
      const receiver = await User.findById(receiverId);
      if (!receiver) {
        return res.status(404).json({ message: 'Receiver not found' });
      }

      // Check if connection already exists
      const existingConnection = await Connection.checkConnectionExists(senderId, receiverId);
      if (existingConnection) {
        return res.status(400).json({ message: 'Connection request already exists' });
      }

      // Create new connection request
      const connection = new Connection({
        senderId,
        receiverId,
        message: message || '',
      });

      await connection.save();

      // Populate sender details for response
      await connection.populate('senderId', 'firstName lastName profilePhotoPath description industry');

      res.status(201).json({
        id: connection._id,
        senderId: connection.senderId,
        receiverId: connection.receiverId,
        status: connection.status,
        message: connection.message,
        sentAt: connection.sentAt,
        sender: connection.senderId,
      });
    } catch (error) {
      console.error('Error sending connection request:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  // Accept a connection request
  async acceptConnectionRequest(req, res) {
    try {
      const userId = req.user.userId;
      const { connectionId } = req.params;

      const connection = await Connection.findById(connectionId);
      if (!connection) {
        return res.status(404).json({ message: 'Connection request not found' });
      }

      if (connection.receiverId.toString() !== userId) {
        return res.status(403).json({ message: 'Not authorized to accept this request' });
      }

      if (connection.status !== 'pending') {
        return res.status(400).json({ message: 'Request is not pending' });
      }

      connection.status = 'accepted';
      connection.respondedAt = new Date();
      connection.isActive = true;  // Set isActive to true when accepting
      await connection.save();

      // Populate both users for response
      await connection.populate('senderId', 'firstName lastName profilePhotoPath description industry');
      await connection.populate('receiverId', 'firstName lastName profilePhotoPath description industry');

      res.json({
        id: connection._id,
        senderId: connection.senderId,
        receiverId: connection.receiverId,
        status: connection.status,
        respondedAt: connection.respondedAt,
        isActive: connection.isActive,
        sender: connection.senderId,
        receiver: connection.receiverId,
      });
    } catch (error) {
      console.error('Error accepting connection request:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  // Reject a connection request
  async rejectConnectionRequest(req, res) {
    try {
      const userId = req.user.userId;
      const { connectionId } = req.params;

      const connection = await Connection.findById(connectionId);
      if (!connection) {
        return res.status(404).json({ message: 'Connection request not found' });
      }

      if (connection.receiverId.toString() !== userId) {
        return res.status(403).json({ message: 'Not authorized to reject this request' });
      }

      if (connection.status !== 'pending') {
        return res.status(400).json({ message: 'Request is not pending' });
      }

      connection.status = 'rejected';
      connection.respondedAt = new Date();
      await connection.save();

      res.json({
        id: connection._id,
        status: connection.status,
        respondedAt: connection.respondedAt,
      });
    } catch (error) {
      console.error('Error rejecting connection request:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  // Withdraw a sent connection request
  async withdrawConnectionRequest(req, res) {
    try {
      const userId = req.user.userId;
      const { connectionId } = req.params;

      const connection = await Connection.findById(connectionId);
      if (!connection) {
        return res.status(404).json({ message: 'Connection request not found' });
      }

      if (connection.senderId.toString() !== userId) {
        return res.status(403).json({ message: 'Not authorized to withdraw this request' });
      }

      if (connection.status !== 'pending') {
        return res.status(400).json({ message: 'Request is not pending' });
      }

      connection.status = 'withdrawn';
      await connection.save();

      res.json({
        id: connection._id,
        status: connection.status,
      });
    } catch (error) {
      console.error('Error withdrawing connection request:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  // Get received connection requests
  async getReceivedRequests(req, res) {
    try {
      const userId = req.user.userId;

      const requests = await Connection.getReceivedRequests(userId);

      res.json(requests.map(request => ({
        id: request._id,
        senderId: request.senderId._id,
        sender: {
          id: request.senderId._id,
          firstName: request.senderId.firstName,
          lastName: request.senderId.lastName,
          profilePhotoPath: request.senderId.profilePhotoPath,
          description: request.senderId.description,
          industry: request.senderId.industry,
        },
        message: request.message,
        sentAt: request.sentAt,
        status: request.status,
      })));
    } catch (error) {
      console.error('Error getting received requests:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  // Get sent connection requests
  async getSentRequests(req, res) {
    try {
      const userId = req.user.userId;

      const requests = await Connection.getSentRequests(userId);

      res.json(requests.map(request => ({
        id: request._id,
        receiverId: request.receiverId._id,
        receiver: {
          id: request.receiverId._id,
          firstName: request.receiverId.firstName,
          lastName: request.receiverId.lastName,
          profilePhotoPath: request.receiverId.profilePhotoPath,
          description: request.receiverId.description,
          industry: request.receiverId.industry,
        },
        message: request.message,
        sentAt: request.sentAt,
        status: request.status,
        respondedAt: request.respondedAt,
      })));
    } catch (error) {
      console.error('Error getting sent requests:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  // Get active connections
  async getActiveConnections(req, res) {
    try {
      const userId = req.user.userId;

      const connections = await Connection.getActiveConnections(userId);

      res.json(connections.map(connection => {
        const otherUser = connection.senderId._id.toString() === userId 
          ? connection.receiverId 
          : connection.senderId;

        return {
          id: connection._id,
          status: connection.status,
          isActive: connection.isActive,
          otherUser: {
            id: otherUser._id,
            firstName: otherUser.firstName,
            lastName: otherUser.lastName,
            profilePhotoPath: otherUser.profilePhotoPath,
            description: otherUser.description,
            industry: otherUser.industry,
          },
          connectedAt: connection.respondedAt,
        };
      }));
    } catch (error) {
      console.error('Error getting active connections:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  // Get received likes (users who swiped right on the current user)
  async getReceivedLikes(req, res) {
    try {
      const userId = req.user.userId;
      const { page = 1, limit = 50 } = req.query;

      // Build query - find swipes where current user is the target and direction is right
      const query = { 
        targetUserId: userId, 
        swipeDirection: 'right',
        isActive: true 
      };

      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const limitNum = parseInt(limit);

      // Get swipes with pagination, populate swiper details
      const swipes = await Swipe.find(query)
        .select('swiperId swipeDirection timestamp message')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('swiperId', 'userName userPhoto age gender bio');

      // Get total count for pagination
      const total = await Swipe.countDocuments(query);

      // Filter out users that the current user has already swiped on
      const swipedByCurrentUser = await Swipe.find({
        swiperId: userId,
        isActive: true
      }).select('targetUserId');

      const swipedUserIds = new Set(
        swipedByCurrentUser.map(swipe => swipe.targetUserId.toString())
      );

      // Format response - only include users not yet swiped by current user
      const receivedLikes = swipes
        .filter(swipe => {
          const swiperId = swipe.swiperId._id.toString();
          return !swipedUserIds.contains(swiperId);
        })
        .map(swipe => ({
          userId: swipe.swiperId._id,
          userName: swipe.swiperId.userName,
          userPhoto: swipe.swiperId.userPhoto,
          age: swipe.swiperId.age,
          gender: swipe.swiperId.gender,
          bio: swipe.swiperId.bio,
          likedAt: swipe.timestamp,
          message: swipe.message
        }));

      res.json({
        success: true,
        data: {
          likes: receivedLikes,
          pagination: {
            page: parseInt(page),
            limit: limitNum,
            total: receivedLikes.length,
            pages: Math.ceil(receivedLikes.length / limitNum)
          }
        }
      });

    } catch (error) {
      console.error('Error getting received likes:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },
};

module.exports = connectionController; 