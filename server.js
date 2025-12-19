// Import main router and services
const mainRoutes = require('./routes/main.routes');
const socketService = require('./services/socket.service');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const morgan = require('morgan');

dotenv.config();

const app = express();
const server = http.createServer(app);
const startTime = Date.now();

// Initialize Socket.IO
socketService.initialize(server);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 image uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Could not connect to MongoDB', err));

// Health check route
app.get('/health', (req, res) => {
  const uptime = Date.now() - startTime;
  const uptimeSeconds = Math.floor(uptime / 1000);
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);
  const uptimeHours = Math.floor(uptimeMinutes / 60);
  const uptimeDays = Math.floor(uptimeHours / 24);

  // Format uptime
  const formatUptime = () => {
    if (uptimeDays > 0) {
      return `${uptimeDays}d ${uptimeHours % 24}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`;
    } else if (uptimeHours > 0) {
      return `${uptimeHours}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`;
    } else if (uptimeMinutes > 0) {
      return `${uptimeMinutes}m ${uptimeSeconds % 60}s`;
    } else {
      return `${uptimeSeconds}s`;
    }
  };

  // Check database connection
  const isDatabaseConnected = mongoose.connection.readyState === 1;
  const databaseStatus = {
    connected: isDatabaseConnected,
    readyState: mongoose.connection.readyState,
    readyStateText: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
    host: mongoose.connection.host,
    name: mongoose.connection.name
  };

  // Check Socket.IO status
  const socketIO = socketService.io;
  const isSocketIOConnected = socketIO !== null && socketIO !== undefined;
  const connectedUsersCount = socketService.connectedUsers ? socketService.connectedUsers.size : 0;

  // Memory usage
  const memoryUsage = process.memoryUsage();
  const formatBytes = (bytes) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  // Response object
  const healthStatus = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: require('./package.json').version,
    uptime: {
      milliseconds: uptime,
      seconds: uptimeSeconds,
      formatted: formatUptime()
    },
    database: databaseStatus,
    socketIO: {
      connected: isSocketIOConnected,
      connectedUsers: connectedUsersCount,
      engineVersion: socketIO ? socketIO.engine.protocol : null
    },
    memory: {
      rss: formatBytes(memoryUsage.rss),
      heapUsed: formatBytes(memoryUsage.heapUsed),
      heapTotal: formatBytes(memoryUsage.heapTotal),
      external: formatBytes(memoryUsage.external)
    },
    system: {
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid
    }
  };

  // Determine overall health status
  if (!isDatabaseConnected || !isSocketIOConnected) {
    healthStatus.status = 'DEGRADED';
    res.status(503);
  }

  res.json(healthStatus);
});

// Apply main router with API version prefix
app.use('/api/v1', mainRoutes);

const PORT = process.env.PORT || 8000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));