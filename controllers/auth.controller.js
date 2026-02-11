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

    // Create and return JWT token - convert _id to string
    const userId = newUser._id.toString();
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.status(201).json({ token, userId });
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

      // Generate a unique temporary email to avoid duplicate key errors on null email
      // This will be replaced when user completes profile
      const tempEmail = `temp_${phoneNumber.replace(/[^0-9]/g, '')}_${Date.now()}@temp.findly.app`;

      try {
        user = new User({
          phoneNumber,
          email: tempEmail,
          password: hashedPassword,
          isProfileComplete: false,
        });

        await user.save();
        console.log(`✅ Created new OTP-first user ${user._id} for ${phoneNumber}`);
      } catch (saveError) {
        // If save fails due to duplicate key, check if user was created by another request
        if (saveError.code === 11000) {
          user = await User.findOne({ phoneNumber });
          if (!user) {
            // If still not found, rethrow the error
            throw saveError;
          }
          console.log(`🔓 OTP login for existing user ${user._id} (found after save conflict)`);
        } else {
          throw saveError;
        }
      }
    } else {
      console.log(`🔓 OTP login for existing user ${user._id}`);
    }

    // Issue JWT - convert _id to string
    const userId = user._id.toString();
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({
      token,
      userId,
      isProfileComplete: user.isProfileComplete,
    });
  } catch (error) {
    console.error('❌ Error verifying OTP:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Server error', error: error.message || error.toString() });
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

    // Create and return JWT token - convert _id to string
    const userId = user._id.toString();
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, userId, isProfileComplete: user.isProfileComplete });
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
    console.log(`📋 Received fields: ${Object.keys(req.body || {}).join(', ')}`);
    console.log(`📦 Content-Type: ${req.get('Content-Type')}`);
    console.log(`📸 Multipart files: ${req.files ? req.files.length : 0}`);
    console.log(`🔍 languagesSpoken:`, req.body?.languagesSpoken, typeof req.body?.languagesSpoken);
    console.log(`🔍 zodiacSign:`, req.body?.zodiacSign, typeof req.body?.zodiacSign);
    console.log(`🔍 Field types:`, {
      interestedIn: Array.isArray(interestedIn) ? 'array' : typeof interestedIn,
      religiousBeliefs: Array.isArray(religiousBeliefs) ? 'array' : typeof religiousBeliefs,
      pronouns: Array.isArray(pronouns) ? 'array' : typeof pronouns,
    });

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Helper function to parse comma-separated strings to arrays
    const parseArray = (value) => {
      if (value == null || value === '') return undefined;
      if (typeof value === 'string' && (value === 'null' || value.trim() === '')) return undefined;
      if (Array.isArray(value)) return value.length ? value : undefined;
      if (typeof value === 'string') {
        // Handle stringified arrays like "[ 'Women' ]"
        if (value.startsWith('[') && value.endsWith(']')) {
          try {
            const cleaned = value.slice(1, -1).trim();
            const arr = cleaned.split(',').map(v => v.trim().replace(/^['"]|['"]$/g, '')).filter(v => v);
            return arr.length ? arr : undefined;
          } catch (e) {
            console.error('Error parsing array string:', e);
          }
        }
        // Handle comma-separated strings
        const arr = value.split(',').map(v => v.trim()).filter(v => v && v !== 'null');
        return arr.length ? arr : undefined;
      }
      return [value];
    };

    const safeString = (v) => (v != null && v !== '' && String(v).trim() !== '' && String(v) !== 'null' ? String(v).trim() : undefined);

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
    
    // Handle photos from multipart upload
    if (req.files && req.files.length > 0) {
      console.log(`📸 Processing ${req.files.length} photos from multipart upload`);
      
      const s3Service = require('../services/s3.service');
      
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
      
      try {
        console.log(`⬆️ Uploading ${req.files.length} photos to S3...`);
        const photoUrls = await s3Service.uploadMultipleFiles(
          req.files,
          'user-photos',
          userId.toString()
        );
        console.log(`✅ Successfully uploaded ${photoUrls.length} photos to S3`);
        user.photos = photoUrls;
      } catch (uploadError) {
        console.error('❌ Error uploading photos to S3:', uploadError);
        return res.status(500).json({ 
          success: false,
          message: 'Failed to upload photos to S3', 
          error: uploadError.message
        });
      }
    }
    
    // Update other profile fields (parse arrays from multipart form data)
    if (prompts) user.prompts = parseArray(prompts);
    if (pronouns !== undefined) user.pronouns = parseArray(pronouns);
    if (gender) user.gender = gender;
    if (sexuality !== undefined) user.sexuality = sexuality;
    if (interestedIn !== undefined) user.interestedIn = parseArray(interestedIn);
    if (relationshipType !== undefined) user.relationshipType = relationshipType;
    if (workplace !== undefined) user.workplace = workplace;
    if (jobTitle !== undefined) user.jobTitle = jobTitle;
    if (school !== undefined) user.school = school;
    if (educationLevel !== undefined) user.educationLevel = educationLevel;
    if (religiousBeliefs !== undefined) user.religiousBeliefs = parseArray(religiousBeliefs);
    if (hometown !== undefined) user.hometown = hometown;
    const languagesParsed = parseArray(req.body?.languagesSpoken ?? languagesSpoken);
    if (languagesParsed && languagesParsed.length > 0) user.languagesSpoken = languagesParsed;
    if (datingIntentions !== undefined) user.datingIntentions = datingIntentions;
    if (height !== undefined) user.height = parseFloat(height);
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
    const zodiacValue = safeString(req.body?.zodiacSign ?? zodiacSign);
    if (zodiacValue) user.zodiacSign = zodiacValue;
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

// Helper to parse value into array for schema array fields (handles string or array from client)
function parseArrayValue(value) {
  if (value == null) return undefined;
  if (Array.isArray(value)) return value.map(v => (v != null ? String(v).trim() : '')).filter(Boolean);
  if (typeof value === 'string') {
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(v => String(v).trim()).filter(Boolean) : [value.trim()];
      } catch (_) { /* fallback to comma split */ }
    }
    return value.split(',').map(v => v.trim()).filter(Boolean);
  }
  return [String(value)];
}

exports.updateProfileField = async (req, res) => {
  try {
    const { userId } = req.user;
    const { field, value } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate field name to prevent injection (include aliases: languages -> languagesSpoken, zodiac -> zodiacSign)
    const allowedFields = [
      'firstName', 'lastName', 'birthDate', 'profilePhotoPath', 'purposes',
      'description', 'gender', 'hideGender', 'socials', 'nationality',
      'industry', 'studyOrWork', 'city', 'favoritePlaces',
      // Extended profile fields
      'photos', 'prompts', 'pronouns', 'sexuality', 'interestedIn',
      'relationshipType', 'workplace', 'jobTitle', 'school', 'educationLevel',
      'religiousBeliefs', 'hometown', 'languagesSpoken', 'languages', 'datingIntentions',
      'height', 'ethnicity', 'zodiacSign', 'zodiac', 'drinkingStatus', 'smokingStatus'
    ];

    if (!allowedFields.includes(field)) {
      return res.status(400).json({ message: 'Invalid field name' });
    }

    // Map aliases to schema field names and normalize array/string values
    const schemaField = field === 'zodiac' ? 'zodiacSign' : field === 'languages' ? 'languagesSpoken' : field;
    const arrayFields = ['languagesSpoken', 'pronouns', 'religiousBeliefs', 'interestedIn', 'prompts', 'photos'];

    if (arrayFields.includes(schemaField)) {
      const parsed = parseArrayValue(value);
      user[schemaField] = parsed != null ? parsed : value;
    } else if (schemaField === 'zodiacSign') {
      user.zodiacSign = value != null && value !== '' ? String(value).trim() : undefined;
    } else if (schemaField !== field) {
      // alias: languages -> languagesSpoken already handled above
      user[schemaField] = value;
    } else {
      user[field] = value;
    }

    // Update legacy fields for backward compatibility
    if (field === 'firstName' || field === 'lastName') {
      user.name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    if (field === 'birthDate') {
      user.dateOfBirth = value ? new Date(value) : undefined;
    }
    if (field === 'description') {
      user.bio = value;
    }

    await user.save();

    res.json({
      message: 'Field updated successfully',
      field: schemaField,
      value: user[schemaField]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
