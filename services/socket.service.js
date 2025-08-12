const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const ChatRoom = require('../models/chat.model');
const Message = require('../models/message.model');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId
    this.userSockets = new Map(); // socketId -> userId
  }

  initialize(server) {
    this.io = require('socket.io')(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
        
        if (!token) {
          return next(new Error('Authentication error: Token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (!user) {
          return next(new Error('Authentication error: User not found'));
        }

        socket.userId = decoded.userId;
        socket.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.userId}`);
      
      // Store user connection
      this.connectedUsers.set(socket.userId, socket.id);
      this.userSockets.set(socket.id, socket.userId);

      // Join user to their personal room
      socket.join(`user_${socket.userId}`);

      // Handle joining chat rooms
      socket.on('join_room', (roomId) => {
        this.handleJoinRoom(socket, roomId);
      });

      // Handle leaving chat rooms
      socket.on('leave_room', (roomId) => {
        this.handleLeaveRoom(socket, roomId);
      });

      // Handle sending messages
      socket.on('send_message', async (data) => {
        await this.handleSendMessage(socket, data);
      });

      // Handle typing indicators
      socket.on('typing_start', (data) => {
        this.handleTypingStart(socket, data);
      });

      socket.on('typing_stop', (data) => {
        this.handleTypingStop(socket, data);
      });

      // Handle message read receipts
      socket.on('mark_read', async (data) => {
        await this.handleMarkRead(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  async handleJoinRoom(socket, roomId) {
    try {
      // Verify user is part of the chat room
      const chatRoom = await ChatRoom.getChatRoom(roomId);
      if (!chatRoom) {
        socket.emit('error', { message: 'Chat room not found' });
        return;
      }

      // Check if user is a participant in this chat room
      const isParticipant = chatRoom.participants.some(p => {
        const participantId = p._id ? p._id.toString() : p.toString();
        console.log(`🔍 Checking participant: ${participantId} vs socket user: ${socket.userId}`);
        return participantId === socket.userId;
      });
      
      if (!isParticipant) {
        console.log(`❌ User ${socket.userId} not authorized to join room ${roomId}`);
        console.log(`📋 Room participants: ${chatRoom.participants.map(p => p._id || p)}`);
        socket.emit('error', { message: 'Not authorized to join this chat room' });
        return;
      }

      socket.join(roomId);
      socket.emit('room_joined', { roomId });
      
      // Notify other participants
      socket.to(roomId).emit('user_joined', {
        roomId,
        userId: socket.userId,
        userName: `${socket.user.firstName} ${socket.user.lastName}`
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  }

  handleLeaveRoom(socket, roomId) {
    socket.leave(roomId);
    socket.emit('room_left', { roomId });
    
    // Notify other participants
    socket.to(roomId).emit('user_left', {
      roomId,
      userId: socket.userId,
      userName: `${socket.user.firstName} ${socket.user.lastName}`
    });
  }

  async handleSendMessage(socket, data) {
    try {
      const { roomId, content, messageType = 'text', metadata = {} } = data;

      if (!content || content.trim().length === 0) {
        socket.emit('error', { message: 'Message content is required' });
        return;
      }

      console.log('📨 Socket: Sending message to room', roomId, 'from user', socket.userId);

      // Verify user is part of the chat room
      const chatRoom = await ChatRoom.getChatRoom(roomId);
      if (!chatRoom) {
        socket.emit('error', { message: 'Chat room not found' });
        return;
      }

      if (!chatRoom.participants.some(p => p._id.toString() === socket.userId)) {
        socket.emit('error', { message: 'Not authorized to send message to this chat room' });
        return;
      }

      // Create the message
      const message = new Message({
        roomId,
        senderId: socket.userId,
        content: content.trim(),
        messageType,
        metadata
      });

      await message.save();
      console.log('📨 Socket: Message saved with ID', message._id);

      // Update chat room's last message
      await chatRoom.updateLastMessage({
        content: message.content,
        senderId: socket.userId,
        timestamp: message.timestamp
      });

      // Increment unread count for other participants
      const otherParticipants = chatRoom.participants.filter(p => p._id.toString() !== socket.userId);
      for (const participant of otherParticipants) {
        await chatRoom.incrementUnreadCount(participant._id);
      }

      // Populate sender info
      await message.populate('senderId', 'firstName lastName profilePhotoPath');

      const messageData = {
        id: message._id,
        content: message.content,
        messageType: message.messageType,
        metadata: message.metadata,
        senderId: message.senderId._id,
        senderName: `${message.senderId.firstName} ${message.senderId.lastName}`,
        senderPhoto: message.senderId.profilePhotoPath,
        status: message.status,
        timestamp: message.timestamp,
        roomId
      };

      console.log('📨 Socket: Emitting new_message to room', roomId);
      // Emit to all users in the room
      this.io.to(roomId).emit('new_message', messageData);

      // Send delivery confirmation to sender
      socket.emit('message_sent', {
        messageId: message._id,
        status: 'sent'
      });

    } catch (error) {
      console.error('❌ Socket: Error sending message:', error);
      socket.emit('error', { message: error.message });
    }
  }

  handleTypingStart(socket, data) {
    const { roomId } = data;
    socket.to(roomId).emit('user_typing', {
      roomId,
      userId: socket.userId,
      userName: `${socket.user.firstName} ${socket.user.lastName}`
    });
  }

  handleTypingStop(socket, data) {
    const { roomId } = data;
    socket.to(roomId).emit('user_stopped_typing', {
      roomId,
      userId: socket.userId
    });
  }

  async handleMarkRead(socket, data) {
    try {
      const { roomId } = data;
      
      // Mark messages as read
      await Message.markMessagesAsRead(roomId, socket.userId);
      
      // Reset unread count for this user
      const chatRoom = await ChatRoom.getChatRoom(roomId);
      if (chatRoom) {
        await chatRoom.resetUnreadCount(socket.userId);
      }

      // Notify other participants
      socket.to(roomId).emit('messages_read', {
        roomId,
        userId: socket.userId
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  }

  handleDisconnect(socket) {
    console.log(`User disconnected: ${socket.userId}`);
    
    // Remove from connected users
    this.connectedUsers.delete(socket.userId);
    this.userSockets.delete(socket.id);
  }

  // Utility methods
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  getUserSocketId(userId) {
    return this.connectedUsers.get(userId);
  }

  // Send notification to specific user
  sendToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  // Send notification to all users in a room
  sendToRoom(roomId, event, data) {
    this.io.to(roomId).emit(event, data);
  }

  // Broadcast to all connected users
  broadcast(event, data) {
    this.io.emit(event, data);
  }
}

module.exports = new SocketService(); 