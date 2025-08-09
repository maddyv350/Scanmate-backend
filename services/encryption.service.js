const crypto = require('crypto');

class EncryptionService {
  // Generate a random AES key
  static generateAESKey() {
    return crypto.randomBytes(32).toString('base64');
  }

  // Encrypt message content with AES
  static encryptMessage(content, key) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', Buffer.from(key, 'base64'));
      cipher.setAutoPadding(true);
      
      let encrypted = cipher.update(content, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // Combine IV and encrypted data
      const combined = Buffer.concat([iv, Buffer.from(encrypted, 'base64')]);
      return combined.toString('base64');
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  // Decrypt message content with AES
  static decryptMessage(encryptedContent, key) {
    try {
      const combined = Buffer.from(encryptedContent, 'base64');
      
      // Extract IV and encrypted data
      const iv = combined.slice(0, 16);
      const encrypted = combined.slice(16);
      
      const decipher = crypto.createDecipher('aes-256-cbc', Buffer.from(key, 'base64'));
      decipher.setAutoPadding(true);
      
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt message');
    }
  }

  // Generate message hash for integrity verification
  static generateMessageHash(content, timestamp) {
    const data = `${content}:${timestamp}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Verify message integrity
  static verifyMessageIntegrity(content, timestamp, hash) {
    const expectedHash = this.generateMessageHash(content, timestamp);
    return expectedHash === hash;
  }

  // Generate a secure random string
  static generateSecureRandom(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }
}

module.exports = EncryptionService;
