const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, password } = req.body;

    // Check if user already exists (by email or phone number)
    let userByEmail = await User.findOne({ email });
    let userByPhone = await User.findOne({ phoneNumber });
    
    if (userByEmail || userByPhone) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({
      firstName,
      lastName,
      name: `${firstName} ${lastName || ''}`.trim(), // Keep legacy name field
      email,
      phoneNumber,
      password: hashedPassword,
      isProfileComplete: false, // Set to false initially
    });

    await newUser.save();

    // Create and return JWT token
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.status(201).json({ token, userId: newUser._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Dev stub: always uses static OTP for now
const DEV_OTP_CODE = process.env.DEV_OTP_CODE || '111111';

exports.sendOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // In production, integrate SMS provider here.
    console.log(`📲 Sending OTP to ${phoneNumber} (dev stub uses ${DEV_OTP_CODE})`);

    return res.json({
      success: true,
      message: 'OTP sent',
      devHint: 'Use 111111 in development',
    });
  } catch (error) {
    console.error('❌ Error sending OTP:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP are required' });
    }

    if (otp !== DEV_OTP_CODE) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    let user = await User.findOne({ phoneNumber });

    if (!user) {
      const placeholderPassword = crypto.randomBytes(16).toString('hex');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(placeholderPassword, salt);

      user = new User({
        phoneNumber,
        password: hashedPassword,
        isProfileComplete: false,
      });

      await user.save();
      console.log(`✅ Created new OTP-first user ${user._id} for ${phoneNumber}`);
    } else {
      console.log(`🔓 OTP login for existing user ${user._id}`);
    }

    // Issue JWT
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({
      token,
      userId: user._id,
      isProfileComplete: user.isProfileComplete,
    });
  } catch (error) {
    console.error('❌ Error verifying OTP:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Update last active
    user.lastActive = new Date();
    await user.save();

    // Create and return JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, userId: user._id, isProfileComplete: user.isProfileComplete });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.completeProfile = async (req, res) => {
  try {
    const { userId } = req.user; // Assuming you have middleware to extract user from token
    const {
      firstName,
      lastName,
      email,
      emailVerified,
      birthDate,
      photos,
      prompts,
      pronouns,
      gender,
      sexuality,
      interestedIn,
      relationshipType,
      workplace,
      jobTitle,
      school,
      educationLevel,
      religiousBeliefs,
      hometown,
      languagesSpoken,
      datingIntentions,
      height,
      location,
      ethnicity,
      zodiacSign,
      drinkingStatus,
      smokingStatus
    } = req.body;

    console.log(`📝 Starting profile completion for user ${userId}`);
    console.log(`📋 Received fields: ${Object.keys(req.body).join(', ')}`);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user profile with all the new fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) {
      user.email = email;
      if (emailVerified !== undefined) {
        user.emailVerified = !!emailVerified;
      }
    }
    if (birthDate) user.birthDate = new Date(birthDate);
    
    // Handle photos - if photos are provided as base64 array, upload to S3
    if (photos && Array.isArray(photos) && photos.length > 0) {
      const s3Service = require('../services/s3.service');
      
      console.log(`📸 Processing ${photos.length} photos for user ${userId}`);
      console.log(`📋 First photo sample: ${photos[0]?.substring(0, 100)}...`);
      
      // Check if photos are base64 strings or URLs
      // More robust check: must start with data:image or be a URL
      const firstPhoto = photos[0]?.toString() || '';
      const isBase64 = firstPhoto.startsWith('data:image');
      const isUrl = firstPhoto.startsWith('http://') || firstPhoto.startsWith('https://');
      const isFilePath = firstPhoto.startsWith('/') && !firstPhoto.startsWith('http');
      
      console.log(`🔍 Photo format detection: isBase64=${isBase64}, isUrl=${isUrl}, isFilePath=${isFilePath}`);
      
      if (isFilePath) {
        console.error('❌ Received file paths instead of base64 images. File paths cannot be processed.');
        return res.status(400).json({
          success: false,
          message: 'Invalid photo format. Photos must be base64 encoded images or URLs.',
          error: 'File paths received instead of base64 data URLs'
        });
      }
      
      if (isBase64) {
        console.log('✅ Photos are base64 encoded, uploading to S3...');
        
        // Check S3 configuration before attempting upload
        if (!process.env.AWS_S3_BUCKET_NAME) {
          console.error('❌ AWS_S3_BUCKET_NAME is not configured');
          return res.status(500).json({
            success: false,
            message: 'S3 configuration missing. Please configure AWS_S3_BUCKET_NAME in environment variables.',
            error: 'AWS_S3_BUCKET_NAME not set'
          });
        }
        
        // Delete old photos from S3 if they exist
        if (user.photos && user.photos.length > 0) {
          console.log(`🗑️ Deleting ${user.photos.length} old photos from S3...`);
          for (const oldPhotoUrl of user.photos) {
            if (oldPhotoUrl && oldPhotoUrl.includes('amazonaws.com')) {
              try {
                await s3Service.deleteImage(oldPhotoUrl);
              } catch (deleteError) {
                console.error('⚠️ Error deleting old photo (non-fatal):', deleteError.message);
              }
            }
          }
        }
        
        // Upload new photos to S3
        try {
          console.log(`⬆️ Uploading ${photos.length} photos to S3...`);
          const photoUrls = await s3Service.uploadMultipleImages(
            photos,
            'user-photos',
            userId.toString()
          );
          console.log(`✅ Successfully uploaded ${photoUrls.length} photos to S3`);
          user.photos = photoUrls;
        } catch (uploadError) {
          console.error('❌ Error uploading photos to S3:', uploadError);
          console.error('Error details:', {
            message: uploadError.message,
            stack: uploadError.stack,
            code: uploadError.code
          });
          return res.status(500).json({ 
            success: false,
            message: 'Failed to upload photos to S3', 
            error: uploadError.message,
            details: process.env.NODE_ENV === 'development' ? uploadError.stack : undefined
          });
        }
      } else if (isUrl) {
        // Photos are already URLs, just store them
        console.log('✅ Photos are already URLs, storing as-is');
        user.photos = photos;
      } else {
        console.error('❌ Unknown photo format:', firstPhoto.substring(0, 200));
        return res.status(400).json({
          success: false,
          message: 'Invalid photo format. Photos must be base64 encoded images (data:image/...) or URLs (http://... or https://...).',
          error: 'Unknown photo format'
        });
      }
    }
    
    // Update other profile fields
    if (prompts) user.prompts = prompts;
    if (pronouns !== undefined) user.pronouns = pronouns;
    if (gender) user.gender = gender;
    if (sexuality !== undefined) user.sexuality = sexuality;
    if (interestedIn !== undefined) user.interestedIn = interestedIn;
    if (relationshipType !== undefined) user.relationshipType = relationshipType;
    if (workplace !== undefined) user.workplace = workplace;
    if (jobTitle !== undefined) user.jobTitle = jobTitle;
    if (school !== undefined) user.school = school;
    if (educationLevel !== undefined) user.educationLevel = educationLevel;
    if (religiousBeliefs !== undefined) user.religiousBeliefs = religiousBeliefs;
    if (hometown !== undefined) user.hometown = hometown;
    if (languagesSpoken) user.languagesSpoken = languagesSpoken;
    if (datingIntentions !== undefined) user.datingIntentions = datingIntentions;
    if (height !== undefined) user.height = height;
    if (location) {
      // Ensure location is in correct GeoJSON Point format
      if (location.type && location.coordinates && Array.isArray(location.coordinates) && location.coordinates.length === 2) {
        user.location = {
          type: 'Point',
          coordinates: [parseFloat(location.coordinates[0]), parseFloat(location.coordinates[1])]
        };
      } else if (location.latitude !== undefined && location.longitude !== undefined) {
        // Handle {latitude, longitude} format
        user.location = {
          type: 'Point',
          coordinates: [parseFloat(location.longitude), parseFloat(location.latitude)]
        };
      } else {
        console.warn('⚠️ Invalid location format, skipping location update');
      }
    }
    if (ethnicity !== undefined) user.ethnicity = ethnicity;
    if (zodiacSign !== undefined) user.zodiacSign = zodiacSign;
    if (drinkingStatus !== undefined) user.drinkingStatus = drinkingStatus;
    if (smokingStatus !== undefined) user.smokingStatus = smokingStatus;
    
    user.isProfileComplete = true;

    console.log('💾 Saving user profile...');
    try {
      await user.save();
      console.log('✅ Profile saved successfully');
    } catch (saveError) {
      console.error('❌ Error saving user profile:', saveError);
      console.error('Save error details:', {
        message: saveError.message,
        name: saveError.name,
        errors: saveError.errors,
        code: saveError.code
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to save profile',
        error: saveError.message,
        details: saveError.errors || (process.env.NODE_ENV === 'development' ? saveError.stack : undefined)
      });
    }

    res.json({ 
      message: 'Profile completed successfully', 
      isProfileComplete: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        email: user.email,
        isProfileComplete: user.isProfileComplete
      }
    });
  } catch (error) {
    console.error('❌ Unexpected error in completeProfile:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue,
      errors: error.errors
    });
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};


exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getProfileForCompletion = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return only the fields needed for profile completion
    const profileData = {
      firstName: user.firstName,
      lastName: user.lastName,
      birthDate: user.birthDate,
      profilePhotoPath: user.profilePhotoPath,
      purposes: user.purposes || [],
      description: user.description,
      gender: user.gender,
      hideGender: user.hideGender,
      socials: user.socials || {},
      nationality: user.nationality,
      industry: user.industry,
      studyOrWork: user.studyOrWork,
      city: user.city,
      favoritePlaces: user.favoritePlaces || [],
      isProfileComplete: user.isProfileComplete
    };
    
    res.json(profileData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateProfileField = async (req, res) => {
  try {
    const { userId } = req.user;
    const { field, value } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate field name to prevent injection
    const allowedFields = [
      'firstName', 'lastName', 'birthDate', 'profilePhotoPath', 'purposes',
      'description', 'gender', 'hideGender', 'socials', 'nationality',
      'industry', 'studyOrWork', 'city', 'favoritePlaces',
      // Extended profile fields
      'photos', 'prompts', 'pronouns', 'sexuality', 'interestedIn',
      'relationshipType', 'workplace', 'jobTitle', 'school', 'educationLevel',
      'religiousBeliefs', 'hometown', 'languagesSpoken', 'datingIntentions',
      'height', 'ethnicity', 'zodiacSign', 'drinkingStatus', 'smokingStatus'
    ];

    if (!allowedFields.includes(field)) {
      return res.status(400).json({ message: 'Invalid field name' });
    }

    // Update the field
    user[field] = value;
    
    // Update legacy fields for backward compatibility
    if (field === 'firstName' || field === 'lastName') {
      user.name = `${user.firstName} ${user.lastName || ''}`.trim();
    }
    if (field === 'birthDate') {
      user.dateOfBirth = new Date(value);
    }
    if (field === 'description') {
      user.bio = value;
    }

    await user.save();

    res.json({ 
      message: 'Field updated successfully',
      field,
      value: user[field]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.uploadProfilePhoto = async (req, res) => {
  try {
    const { userId } = req.user;
    const { photoBase64 } = req.body; // Expecting base64 image

    if (!photoBase64) {
      return res.status(400).json({ message: 'Photo data is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete old profile photo from S3 if exists
    const s3Service = require('../services/s3.service');
    if (user.profilePhotoPath && user.profilePhotoPath.includes('amazonaws.com')) {
      try {
        await s3Service.deleteImage(user.profilePhotoPath);
      } catch (deleteError) {
        console.error('Error deleting old profile photo:', deleteError);
        // Continue even if deletion fails
      }
    }

    // Upload new photo to S3
    const photoUrl = await s3Service.uploadBase64Image(
      photoBase64,
      'profile-photos',
      userId.toString()
    );

    // Update user with new photo URL
    user.profilePhotoPath = photoUrl;
    await user.save();

    res.json({ 
      success: true,
      message: 'Profile photo uploaded successfully',
      profilePhotoPath: user.profilePhotoPath
    });
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Upload multiple photos for user profile
exports.uploadPhotos = async (req, res) => {
  try {
    const { userId } = req.user;
    const { photos } = req.body; // Array of base64 images

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Photos array is required' 
      });
    }

    if (photos.length > 4) {
      return res.status(400).json({ 
        success: false,
        message: 'Maximum 4 photos allowed' 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const s3Service = require('../services/s3.service');
    
    // Delete old photos from S3 if they exist
    if (user.photos && user.photos.length > 0) {
      for (const oldPhotoUrl of user.photos) {
        if (oldPhotoUrl && oldPhotoUrl.includes('amazonaws.com')) {
          try {
            await s3Service.deleteImage(oldPhotoUrl);
          } catch (deleteError) {
            console.error('Error deleting old photo:', deleteError);
          }
        }
      }
    }

    // Upload new photos to S3
    const photoUrls = await s3Service.uploadMultipleImages(
      photos,
      'user-photos',
      userId.toString()
    );

    // Update user with new photo URLs
    user.photos = photoUrls;
    await user.save();

    res.json({ 
      success: true,
      message: 'Photos uploaded successfully',
      photos: user.photos
    });
  } catch (error) {
    console.error('Error uploading photos:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};