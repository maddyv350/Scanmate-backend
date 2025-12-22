# Scanmate Backend API Endpoints

Base URL: `http://43.204.209.39:8000/api/v1`

All endpoints are prefixed with `/api/v1` unless otherwise specified.

## Health & Status

### GET `/health`
- **Description**: Health check endpoint
- **Auth**: Not required
- **Response**: Server status, uptime, database connection, Socket.IO status, memory usage

### GET `/`
- **Description**: API information
- **Auth**: Not required
- **Response**: API version, available endpoints

---

## Authentication (`/api/v1/auth`)

### POST `/api/v1/auth/register`
- **Description**: Register a new user
- **Auth**: Not required
- **Body**: User registration data

### POST `/api/v1/auth/login`
- **Description**: Login user
- **Auth**: Not required
- **Body**: Login credentials

### POST `/api/v1/auth/complete-profile`
- **Description**: Complete user profile
- **Auth**: Required (Bearer token)

### GET `/api/v1/auth/user/profile`
- **Description**: Get user profile
- **Auth**: Required (Bearer token)

### GET `/api/v1/auth/profile-for-completion`
- **Description**: Get profile data for completion
- **Auth**: Required (Bearer token)

### PATCH `/api/v1/auth/update-profile-field`
- **Description**: Update a specific profile field
- **Auth**: Required (Bearer token)

### POST `/api/v1/auth/upload-profile-photo`
- **Description**: Upload profile photo
- **Auth**: Required (Bearer token)

---

## User Management (`/api/v1/user`)

### POST `/api/v1/user/block`
- **Description**: Block a user
- **Auth**: Required (Bearer token)

### POST `/api/v1/user/unblock`
- **Description**: Unblock a user
- **Auth**: Required (Bearer token)

### GET `/api/v1/user/blocked`
- **Description**: Get list of blocked users
- **Auth**: Required (Bearer token)

### GET `/api/v1/user/blocked/:otherUserId`
- **Description**: Check if a user is blocked
- **Auth**: Required (Bearer token)
- **Params**: `otherUserId` - ID of the user to check

### POST `/api/v1/user/report`
- **Description**: Report a user
- **Auth**: Required (Bearer token)

### GET `/api/v1/user/reports`
- **Description**: Get all reports (Admin)
- **Auth**: Required (Bearer token)

### GET `/api/v1/user/reports/:userId`
- **Description**: Get reports for a specific user
- **Auth**: Required (Bearer token)
- **Params**: `userId` - ID of the user

### PUT `/api/v1/user/reports/:reportId/status`
- **Description**: Update report status
- **Auth**: Required (Bearer token)
- **Params**: `reportId` - ID of the report

---

## Location (`/api/v1/location`)

### POST `/api/v1/location/drop-by`
- **Description**: Drop location pin
- **Auth**: Required (Bearer token)

### GET `/api/v1/location/nearby-users`
- **Description**: Get nearby users
- **Auth**: Required (Bearer token)

### DELETE `/api/v1/location/remove`
- **Description**: Remove user's location
- **Auth**: Required (Bearer token)

### GET `/api/v1/location/current`
- **Description**: Get current user location
- **Auth**: Required (Bearer token)

### GET `/api/v1/location/daily-drop-count`
- **Description**: Get daily drop count
- **Auth**: Required (Bearer token)

### GET `/api/v1/location/drop-score`
- **Description**: Get drop score
- **Auth**: Required (Bearer token)

---

## Connections (`/api/v1/connection`)

### POST `/api/v1/connection/send`
- **Description**: Send connection request
- **Auth**: Required (Bearer token)

### PUT `/api/v1/connection/:connectionId/accept`
- **Description**: Accept connection request
- **Auth**: Required (Bearer token)
- **Params**: `connectionId` - ID of the connection

### PUT `/api/v1/connection/:connectionId/reject`
- **Description**: Reject connection request
- **Auth**: Required (Bearer token)
- **Params**: `connectionId` - ID of the connection

### PUT `/api/v1/connection/:connectionId/withdraw`
- **Description**: Withdraw connection request
- **Auth**: Required (Bearer token)
- **Params**: `connectionId` - ID of the connection

### GET `/api/v1/connection/received`
- **Description**: Get received connection requests
- **Auth**: Required (Bearer token)

### GET `/api/v1/connection/sent`
- **Description**: Get sent connection requests
- **Auth**: Required (Bearer token)

### GET `/api/v1/connection/active`
- **Description**: Get active connections
- **Auth**: Required (Bearer token)

### GET `/api/v1/connection/received-likes`
- **Description**: Get received likes (users who swiped right on current user)
- **Auth**: Required (Bearer token)
- **Query**: `{ page?, limit? }`
- **Response**: List of users who liked the current user (excluding users already swiped by current user)

---

## Chat (`/api/v1/chat`)

### GET `/api/v1/chat/rooms`
- **Description**: Get chat rooms for authenticated user
- **Auth**: Required (Bearer token)

### GET `/api/v1/chat/rooms/:roomId/messages`
- **Description**: Get messages for a specific chat room
- **Auth**: Required (Bearer token)
- **Params**: `roomId` - ID of the chat room

### POST `/api/v1/chat/rooms/:roomId/messages`
- **Description**: Send a message to a chat room
- **Auth**: Required (Bearer token)
- **Params**: `roomId` - ID of the chat room

### POST `/api/v1/chat/rooms`
- **Description**: Create or get chat room for two users
- **Auth**: Required (Bearer token)

### PUT `/api/v1/chat/rooms/:roomId/read`
- **Description**: Mark messages as read in a chat room
- **Auth**: Required (Bearer token)
- **Params**: `roomId` - ID of the chat room

### DELETE `/api/v1/chat/messages/:messageId`
- **Description**: Delete a message
- **Auth**: Required (Bearer token)
- **Params**: `messageId` - ID of the message

### GET `/api/v1/chat/unread-count`
- **Description**: Get unread message count for authenticated user
- **Auth**: Required (Bearer token)

---

## Encryption (`/api/v1/encryption`)

### GET `/api/v1/encryption/rooms/:roomId/key`
- **Description**: Get shared key for a chat room
- **Auth**: Required (Bearer token)
- **Params**: `roomId` - ID of the chat room

### POST `/api/v1/encryption/rooms/:roomId/key`
- **Description**: Generate new shared key for a chat room
- **Auth**: Required (Bearer token)
- **Params**: `roomId` - ID of the chat room

### POST `/api/v1/encryption/test`
- **Description**: Test encryption/decryption
- **Auth**: Required (Bearer token)
- **Body**: `{ content, roomId }`

---

## Swipes (`/api/v1/swipes`)

### POST `/api/v1/swipes`
- **Description**: Record a swipe action (right or left)
- **Auth**: Required (Bearer token)
- **Body**: `{ targetUserId, swipeDirection, message? }`

### GET `/api/v1/swipes/history`
- **Description**: Get user's swipe history
- **Auth**: Required (Bearer token)
- **Query**: `{ page?, limit?, direction? }`

### GET `/api/v1/swipes/matches`
- **Description**: Get potential matches (mutual right swipes)
- **Auth**: Required (Bearer token)
- **Query**: `{ page?, limit? }`

### DELETE `/api/v1/swipes/:swipeId`
- **Description**: Delete a swipe (soft delete)
- **Auth**: Required (Bearer token)
- **Params**: `swipeId` - ID of the swipe

---

## Socket.IO

The backend also supports Socket.IO for real-time communication. Connect to:
- **URL**: `http://43.204.209.39:8000`
- **Protocol**: Socket.IO

---

## Authentication

Most endpoints require authentication using Bearer tokens:
```
Authorization: Bearer <your_access_token>
```

Tokens are obtained from the `/api/v1/auth/login` or `/api/v1/auth/register` endpoints.

