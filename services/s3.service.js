const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

// Validate S3 configuration
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !BUCKET_NAME) {
  console.warn('⚠️  AWS S3 configuration missing. Image uploads will fail.');
  console.warn('Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME in your .env file');
}

class S3Service {

  /**
   * Upload a buffer/image file to S3
   * @param {Buffer} buffer - Image buffer
   * @param {string} mimetype - MIME type (e.g., 'image/jpeg')
   * @param {string} folder - Folder path in S3
   * @param {string} userId - User ID for file naming
   * @returns {Promise<string>} - Public URL of uploaded image
   */
  async uploadBuffer(buffer, mimetype, folder, userId) {
    try {
      if (!BUCKET_NAME) {
        throw new Error('AWS_S3_BUCKET_NAME is not configured');
      }

      // Determine extension from mimetype
      const extension = mimetype.split('/')[1] || 'jpg';
      
      // Validate buffer size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (buffer.length > maxSize) {
        throw new Error(`Image size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`);
      }
      
      // Generate unique filename
      const filename = `${userId}_${uuidv4()}.${extension}`;
      const key = `${folder}/${filename}`;
      
      // Upload to S3
      // Note: ACL is removed because newer S3 buckets don't support ACLs
      // Public access is handled via bucket policy instead
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      };
      
      const result = await s3.upload(uploadParams).promise();
      
      console.log(`✅ Image uploaded to S3: ${result.Location}`);
      return result.Location;
    } catch (error) {
      console.error('❌ Error uploading image to S3:', error);
      throw new Error(`Failed to upload image to S3: ${error.message}`);
    }
  }

  /**
   * Delete an image from S3
   * @param {string} imageUrl - Full S3 URL or key
   * @returns {Promise<void>}
   */
  async deleteImage(imageUrl) {
    try {
      if (!BUCKET_NAME) {
        console.warn('⚠️  Cannot delete image: AWS_S3_BUCKET_NAME is not configured');
        return;
      }

      if (!imageUrl) {
        return; // No URL to delete
      }

      // Extract key from URL if full URL is provided
      let key = imageUrl;
      if (imageUrl.includes(BUCKET_NAME)) {
        const urlParts = imageUrl.split(`${BUCKET_NAME}/`);
        key = urlParts[1];
      } else if (imageUrl.includes('amazonaws.com')) {
        // Extract key from full S3 URL
        const urlParts = imageUrl.split('.com/');
        key = urlParts[1]?.split('?')[0]; // Remove query parameters if any
      }
      
      if (!key) {
        console.warn(`⚠️  Could not extract S3 key from URL: ${imageUrl}`);
        return;
      }
      
      const deleteParams = {
        Bucket: BUCKET_NAME,
        Key: key,
      };
      
      await s3.deleteObject(deleteParams).promise();
      console.log(`✅ Image deleted from S3: ${key}`);
    } catch (error) {
      console.error('❌ Error deleting image from S3:', error);
      // Don't throw - deletion failures shouldn't break the app
    }
  }

  /**
   * Upload multiple files from multer
   * @param {Array<Express.Multer.File>} files - Array of multer file objects
   * @param {string} folder - Folder path in S3
   * @param {string} userId - User ID for file naming
   * @returns {Promise<Array<string>>} - Array of public URLs
   */
  async uploadMultipleFiles(files, folder, userId) {
    try {
      console.log(`📤 Uploading ${files.length} files to S3 (multipart)`);
      
      const uploadPromises = files.map((file, index) => {
        console.log(`   File ${index + 1}: ${file.originalname} (${(file.size / 1024).toFixed(2)} KB)`);
        return this.uploadBuffer(file.buffer, file.mimetype, folder, `${userId}_${index}`);
      });
      
      const urls = await Promise.all(uploadPromises);
      console.log(`✅ Successfully uploaded ${urls.length} files to S3`);
      return urls;
    } catch (error) {
      console.error('❌ Error uploading multiple files to S3:', error);
      throw new Error(`Failed to upload files to S3: ${error.message}`);
    }
  }
}

module.exports = new S3Service();

