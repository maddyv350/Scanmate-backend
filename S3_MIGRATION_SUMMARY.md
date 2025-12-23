# S3 Image Storage Migration Summary

## ✅ Completed Changes

### 1. **Dependencies Added**
- `aws-sdk` - AWS SDK for Node.js (S3 integration)
- Updated `package.json` with required dependencies

### 2. **S3 Service Created** (`services/s3.service.js`)
- `uploadBase64Image()` - Uploads base64 images to S3
- `uploadBuffer()` - Uploads buffer/images to S3
- `uploadMultipleImages()` - Uploads multiple images at once
- `deleteImage()` - Deletes images from S3
- Includes validation, error handling, and size limits (10MB max)

### 3. **Updated Endpoints**

#### `POST /api/v1/auth/upload-profile-photo`
- Now uploads to S3 instead of storing paths
- Accepts `photoBase64` in request body
- Returns S3 public URL
- Automatically deletes old profile photo from S3

#### `POST /api/v1/auth/upload-photos` (NEW)
- Uploads multiple photos (max 4) to S3
- Accepts `photos` array of base64 images
- Returns array of S3 public URLs
- Automatically deletes old photos from S3

#### `POST /api/v1/auth/complete-profile`
- Updated to handle photos as base64 or URLs
- Automatically uploads base64 photos to S3
- Preserves existing URL-based photos

### 4. **Environment Variables Required**
Add these to your `.env` file:
```env
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-bucket-name
```

### 5. **S3 Folder Structure**
- `profile-photos/` - Profile pictures
- `user-photos/` - User gallery photos (up to 4)

## 📋 Setup Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure AWS credentials in `.env`:**
   - Get Access Key ID and Secret Access Key from AWS IAM
   - Set your bucket name and region

3. **Configure S3 Bucket:**
   - Enable public read access (via bucket policy)
   - Configure CORS if accessing from web app
   - See `AWS_S3_SETUP.md` for detailed instructions

4. **Restart server:**
   ```bash
   pm2 restart scanmate-backend
   # or
   npm start
   ```

## 🔄 Migration Notes

- **Existing images**: Old image paths/URLs will continue to work if they're already URLs
- **New uploads**: All new image uploads will go to S3
- **Automatic cleanup**: Old S3 images are automatically deleted when replaced

## 🧪 Testing

### Test Profile Photo Upload:
```bash
curl -X POST http://localhost:8000/api/v1/auth/upload-profile-photo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "photoBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  }'
```

### Test Multiple Photos Upload:
```bash
curl -X POST http://localhost:8000/api/v1/auth/upload-photos \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "photos": [
      "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
      "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
    ]
  }'
```

## ⚠️ Important Notes

1. **Bucket Policy**: Make sure your S3 bucket allows public read access
2. **CORS**: Configure CORS if accessing images from a web application
3. **File Size**: Maximum image size is 10MB
4. **Image Format**: Supports JPEG, PNG, GIF, WebP (auto-detected from base64)
5. **Security**: Keep AWS credentials secure, never commit them to git

## 📚 Documentation

- See `AWS_S3_SETUP.md` for detailed AWS setup instructions
- See `ENDPOINTS.md` for updated API documentation

