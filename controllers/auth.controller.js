const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
      birthDate,
      photos,
      prompts,
      pronouns,
      gender,
      sexuality,
      interestedIn,
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

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user profile with all the new fields
    if (firstName) user.firstName = firstName;
    if (birthDate) user.birthDate = new Date(birthDate);
    
    // Handle photos - if photos are provided as base64 array, upload to S3
    if (photos && Array.isArray(photos) && photos.length > 0) {
      const s3Service = require('../services/s3.service');
      
      // Check if photos are base64 strings or URLs
      const isBase64 = photos[0].startsWith('data:image') || photos[0].startsWith('/9j/') || photos[0].length > 100;
      
      if (isBase64) {
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
        try {
          const photoUrls = await s3Service.uploadMultipleImages(
            photos,
            'user-photos',
            userId.toString()
          );
          user.photos = photoUrls;
        } catch (uploadError) {
          console.error('Error uploading photos to S3:', uploadError);
          return res.status(500).json({ 
            success: false,
            message: 'Failed to upload photos', 
            error: uploadError.message 
          });
        }
      } else {
        // Photos are already URLs, just store them
        user.photos = photos;
      }
    }
    if (prompts) user.prompts = prompts;
    if (pronouns !== undefined) user.pronouns = pronouns;
    if (gender) user.gender = gender;
    if (sexuality !== undefined) user.sexuality = sexuality;
    if (interestedIn !== undefined) user.interestedIn = interestedIn;
    if (workplace !== undefined) user.workplace = workplace;
    if (jobTitle !== undefined) user.jobTitle = jobTitle;
    if (school !== undefined) user.school = school;
    if (educationLevel !== undefined) user.educationLevel = educationLevel;
    if (religiousBeliefs !== undefined) user.religiousBeliefs = religiousBeliefs;
    if (hometown !== undefined) user.hometown = hometown;
    if (languagesSpoken) user.languagesSpoken = languagesSpoken;
    if (datingIntentions !== undefined) user.datingIntentions = datingIntentions;
    if (height !== undefined) user.height = height;
    if (location) user.location = location;
    if (ethnicity !== undefined) user.ethnicity = ethnicity;
    if (zodiacSign !== undefined) user.zodiacSign = zodiacSign;
    if (drinkingStatus !== undefined) user.drinkingStatus = drinkingStatus;
    if (smokingStatus !== undefined) user.smokingStatus = smokingStatus;
    
    user.isProfileComplete = true;

    await user.save();

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
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
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
      'industry', 'studyOrWork', 'city', 'favoritePlaces'
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