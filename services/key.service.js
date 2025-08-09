const crypto = require('crypto');

class KeyService {
  // In-memory storage for shared keys (in production, use Redis or database)
  static sharedKeys = new Map();

  // Generate a shared key for a chat room
  static generateSharedKey(roomId) {
    const key = crypto.randomBytes(32).toString('base64');
    this.sharedKeys.set(roomId, key);
    console.log(`🔑 Generated shared key for room: ${roomId}`);
    return key;
  }

  // Get shared key for a chat room
  static getSharedKey(roomId) {
    const key = this.sharedKeys.get(roomId);
    if (!key) {
      console.log(`🔑 No shared key found for room: ${roomId}, generating new one`);
      return this.generateSharedKey(roomId);
    }
    return key;
  }

  // Check if a shared key exists for a room
  static hasSharedKey(roomId) {
    return this.sharedKeys.has(roomId);
  }

  // Remove shared key for a room (when room is deleted)
  static removeSharedKey(roomId) {
    this.sharedKeys.delete(roomId);
    console.log(`🔑 Removed shared key for room: ${roomId}`);
  }

  // Get all room IDs that have shared keys
  static getRoomIds() {
    return Array.from(this.sharedKeys.keys());
  }

  // Clear all keys (for testing or maintenance)
  static clearAllKeys() {
    this.sharedKeys.clear();
    console.log('🔑 Cleared all shared keys');
  }
}

module.exports = KeyService;
