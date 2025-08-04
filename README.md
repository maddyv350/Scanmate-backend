# API Documentation

## Authentication

### Login api process
- **POST** `/api/v1/auth/login`
- **Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "password1234"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "token": "jwt_token_here",
      "user": {
        "id": "user_id",
        "firstName": "John",
        "lastName": "Doe",
        "email": "user@example.com"
      }
    }
  }
  ```

### Register
- **POST** `/api/v1/auth/register`
- **Body:**
  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "email": "user@example.com",
    "phoneNumber": "+1234567890",
    "password": "password123"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "token": "jwt_token_here",
      "user": {
        "id": "user_id",
        "firstName": "John",
        "lastName": "Doe",
        "email": "user@example.com"
      }
    }
  }
  ```

## User Management

### Get User Profile
- **GET** `/api/v1/user/profile`
- **Headers:** `Authorization: Bearer <token>`
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "id": "user_id",
      "firstName": "John",
      "lastName": "Doe",
      "email": "user@example.com",
      "phoneNumber": "+1234567890",
      "profilePhotoPath": "path/to/photo.jpg",
      "description": "About me...",
      "birthDate": "1990-01-01T00:00:00.000Z",
      "gender": "Male",
      "city": "New York",
      "industry": "Technology",
      "favoritePlaces": ["Cafes", "Restaurants"],
      "isProfileComplete": true
    }
  }
  ```

### Update User Profile
- **PUT** `/api/v1/user/profile`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "description": "Updated about me...",
    "birthDate": "1990-01-01",
    "gender": "Male",
    "city": "New York",
    "industry": "Technology",
    "favoritePlaces": ["Cafes", "Restaurants"]
  }
  ```

## Location Services

### Update User Location
- **POST** `/api/v1/location/update`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
  ```json
  {
    "latitude": 40.7128,
    "longitude": -74.0060
  }
  ```

### Get Nearby Users
- **GET** `/api/v1/location/nearby?radius=5000`
- **Headers:** `Authorization: Bearer <token>`
- **Response:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "user_id",
        "firstName": "Jane",
        "lastName": "Smith",
        "profilePhotoPath": "path/to/photo.jpg",
        "description": "About Jane...",
        "distance": 1200,
        "industry": "Marketing"
      }
    ]
  }
  ```

## Connection Management

### Send Connection Request
- **POST** `/api/v1/connection/send`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
  ```json
  {
    "receiverId": "target_user_id",
    "message": "Hi, I'd like to connect!"
  }
  ```

### Get Received Connection Requests
- **GET** `/api/v1/connection/received`
- **Headers:** `Authorization: Bearer <token>`
- **Response:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "connection_id",
        "sender": {
          "id": "sender_id",
          "firstName": "Jane",
          "lastName": "Smith",
          "profilePhotoPath": "path/to/photo.jpg",
          "description": "About Jane...",
          "industry": "Marketing"
        },
        "message": "Hi, I'd like to connect!",
        "sentAt": "2024-01-01T12:00:00.000Z",
        "status": "pending"
      }
    ]
  }
  ```

### Accept Connection Request
- **PUT** `/api/v1/connection/accept`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
  ```json
  {
    "connectionId": "connection_id"
  }
  ```

### Reject Connection Request
- **PUT** `/api/v1/connection/reject`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
  ```json
  {
    "connectionId": "connection_id"
  }
  ```

### Get Active Connections
- **GET** `/api/v1/connection/active`
- **Headers:** `Authorization: Bearer <token>`
- **Response:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "connection_id",
        "user": {
          "id": "user_id",
          "firstName": "Jane",
          "lastName": "Smith",
          "profilePhotoPath": "path/to/photo.jpg",
          "description": "About Jane...",
          "industry": "Marketing"
        },
        "connectedAt": "2024-01-01T12:00:00.000Z"
      }
    ]
  }
  ```

## Chat Services

### Get Chat Rooms
- **GET** `/api/v1/chat/rooms`
- **Headers:** `Authorization: Bearer <token>`
- **Response:**
  ```json
  {
    "success": true,
    "data": [
      {
        "roomId": "chat_room_id",
        "otherUser": {
          "id": "user_id",
          "firstName": "Jane",
          "lastName": "Smith",
          "profilePhotoPath": "path/to/photo.jpg"
        },
        "lastMessage": {
          "content": "Hello!",
          "senderId": "sender_id",
          "senderName": "Jane Smith",
          "timestamp": "2024-01-01T12:00:00.000Z"
        },
        "unreadCount": 2,
        "updatedAt": "2024-01-01T12:00:00.000Z"
      }
    ]
  }
  ```

### Get Messages for Chat Room
- **GET** `/api/v1/chat/rooms/{roomId}/messages?limit=50&offset=0`
- **Headers:** `Authorization: Bearer <token>`
- **Response:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "message_id",
        "content": "Hello!",
        "messageType": "text",
        "metadata": {},
        "senderId": "sender_id",
        "senderName": "Jane Smith",
        "senderPhoto": "path/to/photo.jpg",
        "status": "read",
        "timestamp": "2024-01-01T12:00:00.000Z",
        "isOwnMessage": false
      }
    ]
  }
  ```

### Send Message
- **POST** `/api/v1/chat/rooms/{roomId}/messages`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
  ```json
  {
    "content": "Hello!",
    "messageType": "text",
    "metadata": {}
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "id": "message_id",
      "content": "Hello!",
      "messageType": "text",
      "metadata": {},
      "senderId": "sender_id",
      "senderName": "John Doe",
      "senderPhoto": "path/to/photo.jpg",
      "status": "sent",
      "timestamp": "2024-01-01T12:00:00.000Z",
      "isOwnMessage": true
    }
  }
  ```

### Create Chat Room
- **POST** `/api/v1/chat/rooms`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
  ```json
  {
    "otherUserId": "target_user_id"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "roomId": "chat_room_id",
      "participants": ["user_id", "target_user_id"]
    }
  }
  ```

### Mark Messages as Read
- **PUT** `/api/v1/chat/rooms/{roomId}/read`
- **Headers:** `Authorization: Bearer <token>`
- **Response:**
  ```json
  {
    "success": true,
    "message": "Messages marked as read"
  }
  ```

### Delete Message
- **DELETE** `/api/v1/chat/messages/{messageId}`
- **Headers:** `Authorization: Bearer <token>`
- **Response:**
  ```json
  {
    "success": true,
    "message": "Message deleted successfully"
  }
  ```

### Get Unread Count
- **GET** `/api/v1/chat/unread-count`
- **Headers:** `Authorization: Bearer <token>`
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "unreadCount": 5
    }
  }
  ```

## Socket.IO Events

### Client to Server Events

#### Join Chat Room
```javascript
socket.emit('join_room', roomId);
```

#### Leave Chat Room
```javascript
socket.emit('leave_room', roomId);
```

#### Send Message
```javascript
socket.emit('send_message', {
  roomId: 'room_id',
  content: 'Hello!',
  messageType: 'text',
  metadata: {}
});
```

#### Start Typing
```javascript
socket.emit('typing_start', { roomId: 'room_id' });
```

#### Stop Typing
```javascript
socket.emit('typing_stop', { roomId: 'room_id' });
```

#### Mark Messages as Read
```javascript
socket.emit('mark_read', { roomId: 'room_id' });
```

### Server to Client Events

#### New Message
```javascript
socket.on('new_message', (message) => {
  console.log('New message:', message);
});
```

#### User Typing
```javascript
socket.on('user_typing', (data) => {
  console.log('User typing:', data);
});
```

#### User Stopped Typing
```javascript
socket.on('user_stopped_typing', (data) => {
  console.log('User stopped typing:', data);
});
```

#### Room Joined
```javascript
socket.on('room_joined', (data) => {
  console.log('Joined room:', data);
});
```

#### Room Left
```javascript
socket.on('room_left', (data) => {
  console.log('Left room:', data);
});
```

#### Message Sent Confirmation
```javascript
socket.on('message_sent', (data) => {
  console.log('Message sent:', data);
});
```

#### Messages Read
```javascript
socket.on('messages_read', (data) => {
  console.log('Messages read:', data);
});
```

#### Error
```javascript
socket.on('error', (data) => {
  console.log('Error:', data);
});
```

## Error Responses

All endpoints return error responses in the following format:

```json
{
  "success": false,
  "message": "Error description"
}
```

Common HTTP status codes:
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error 