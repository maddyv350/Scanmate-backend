const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Basic info
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  
  // Profile fields
  birthDate: {
    type: Date
  },
  photos: [{
    type: String,  // URLs to photo storage (max 4)
    validate: {
      validator: function(v) {
        return this.photos.length <= 4;
      },
      message: 'Maximum 4 photos allowed'
    }
  }],
  prompts: [{
    type: String,
    maxlength: 500,
    validate: {
      validator: function(v) {
        return this.prompts.length <= 3;
      },
      message: 'Maximum 3 prompts allowed'
    }
  }],
  pronouns: {
    type: String,
    trim: true
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Non-binary', 'Other']
  },
  sexuality: {
    type: String,
    enum: ['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Pansexual', 'Asexual', 'Other']
  },
  interestedIn: {
    type: String,
    enum: ['Men', 'Women', 'Non-binary people', 'Everyone']
  },
  workplace: {
    type: String,
    trim: true
  },
  jobTitle: {
    type: String,
    trim: true
  },
  school: {
    type: String,
    trim: true
  },
  educationLevel: {
    type: String,
    enum: ['High School', 'Some College', 'Associate Degree', 'Bachelor Degree', 'Master Degree', 'Doctorate', 'Other']
  },
  religiousBeliefs: {
    type: String,
    trim: true
  },
  hometown: {
    type: String,
    trim: true
  },
  languagesSpoken: [{
    type: String,
    trim: true
  }],
  datingIntentions: {
    type: String,
    enum: ['Long term', 'Short term', 'Other']
  },
  height: {
    type: Number,  // in centimeters
    min: 100,
    max: 250
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  ethnicity: {
    type: String,
    trim: true
  },
  zodiacSign: {
    type: String,
    enum: ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']
  },
  drinkingStatus: {
    type: String,
    enum: ['Never', 'Rarely', 'Socially', 'Often', 'Prefer not to say']
  },
  smokingStatus: {
    type: String,
    enum: ['Never', 'Rarely', 'Socially', 'Often', 'Prefer not to say']
  },
  
  // App functionality fields
  isProfileComplete: {
    type: Boolean,
    default: false
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  matches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  settings: {
    maxDistance: {
      type: Number,
      default: 50  // in kilometers
    },
    agePreference: {
      min: {
        type: Number,
        default: 18
      },
      max: {
        type: Number,
        default: 100
      }
    },
    showProfile: {
      type: Boolean,
      default: true
    },
    notificationsEnabled: {
      type: Boolean,
      default: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create a 2dsphere index for location-based queries
userSchema.index({ location: '2dsphere' });

// Virtual for age
userSchema.virtual('age').get(function() {
  if (!this.birthDate) return null;
  return Math.floor((new Date() - this.birthDate) / (365.25 * 24 * 60 * 60 * 1000));
});

// Middleware to update the 'updatedAt' field on save
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('User', userSchema);