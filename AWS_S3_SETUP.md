# AWS S3 Setup Guide

This guide will help you configure AWS S3 for image storage in the Scanmate backend.

## Prerequisites

1. AWS Account
2. S3 Bucket created in AWS Console
3. IAM User with S3 permissions

## Step 1: Create S3 Bucket

1. Go to AWS S3 Console
2. Click "Create bucket"
3. Choose a unique bucket name (e.g., `scanmate-images`)
4. Select your preferred region (e.g., `us-east-1`)
5. **Important**: Uncheck "Block all public access" or configure bucket policy for public read access
6. Click "Create bucket"

## Step 2: Configure Bucket Policy for Public Read Access

1. Go to your bucket → Permissions → Bucket Policy
2. Add the following policy (replace `YOUR_BUCKET_NAME` with your actual bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```

## Step 3: Create IAM User with S3 Permissions

1. Go to IAM Console → Users → Add users
2. Create a new user (e.g., `scanmate-s3-user`)
3. Attach the policy `AmazonS3FullAccess` or create a custom policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```

4. Create Access Key for the user
5. Save the Access Key ID and Secret Access Key securely

## Step 4: Configure Environment Variables

Add the following to your `.env` file:

```env
AWS_ACCESS_KEY_ID=your-access-key-id-here
AWS_SECRET_ACCESS_KEY=your-secret-access-key-here
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-bucket-name
```

## Step 5: Install Dependencies

Run the following command in your backend directory:

```bash
npm install aws-sdk
```

## Step 6: Test the Setup

The S3 service will automatically be initialized when the server starts. Check the console logs for any configuration warnings.

## API Endpoints

### Upload Profile Photo
- **POST** `/api/v1/auth/upload-profile-photo`
- **Body**: `{ "photoBase64": "data:image/jpeg;base64,..." }`
- **Response**: `{ "success": true, "profilePhotoPath": "https://..." }`

### Upload Multiple Photos
- **POST** `/api/v1/auth/upload-photos`
- **Body**: `{ "photos": ["data:image/jpeg;base64,...", ...] }`
- **Response**: `{ "success": true, "photos": ["https://...", ...] }`

### Complete Profile (with photos)
- **POST** `/api/v1/auth/complete-profile`
- **Body**: `{ "photos": ["data:image/jpeg;base64,...", ...], ... }`
- Photos will be automatically uploaded to S3 if provided as base64

## Folder Structure in S3

Images are organized in folders:
- `profile-photos/` - Profile pictures
- `user-photos/` - User gallery photos

## Troubleshooting

### Error: "AWS_S3_BUCKET_NAME is not configured"
- Make sure all environment variables are set in your `.env` file
- Restart the server after adding environment variables

### Error: "Access Denied"
- Check IAM user permissions
- Verify bucket policy allows public read access
- Ensure ACL is set to 'public-read' in upload params

### Images not accessible publicly
- Verify bucket policy allows public read
- Check CORS configuration if accessing from web app
- Ensure ACL is set correctly in upload params

## CORS Configuration (if needed)

If accessing images from a web app, configure CORS:

1. Go to bucket → Permissions → CORS
2. Add:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

