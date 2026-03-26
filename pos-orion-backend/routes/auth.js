const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Business = require('../models/Business'); // Import Business model

// Password validation function
const validatePassword = (password) => {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/(?=.*\d)/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return errors;
};

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Signup Route
router.post('/signup', [
  // Validation middleware
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').custom((value) => {
    const errors = validatePassword(value);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
    return true;
  }),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
  body('businessName').trim().notEmpty().withMessage('Business name is required'),
  body('businessType').isIn(['retail', 'restaurant', 'service', 'ecommerce', 'wholesale', 'salon', 'grocery', 'other'])
    .withMessage('Please select a valid business type'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('address').trim().notEmpty().withMessage('Address is required'),
  body('terms').equals('true').withMessage('You must agree to the Terms & Conditions')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        errors: [{
          field: 'email',
          message: 'Email already registered'
        }]
      });
    }

    // 1. Create Business First
    const business = new Business({
      name: req.body.businessName,
      type: req.body.businessType,
      phone: req.body.phone,
      address: req.body.address,  
      subscription: {
        plan: 'free',
        status: 'active',
        expiryDate: new Date(+new Date() + 30*24*60*60*1000) // 30 days free trial
      }
    });

    const savedBusiness = await business.save();

    // 2. Create User (Admin) with reference to the business
    const user = new User({
      fullName: req.body.fullName,
      email: req.body.email,
      password: req.body.password,
      role: 'admin',
      business: savedBusiness._id,
      isActive: true
    });

    const savedUser = await user.save();

    // 3. Update business with owner reference
    business.owner = savedUser._id;
    await business.save();

    // Generate JWT token
    const token = generateToken(savedUser._id);

    // Update last login
    savedUser.lastLogin = new Date();
    await savedUser.save();

    // Send response
    res.status(201).json({
      success: true,
      message: 'Account and business created successfully!',
      user: {
        id: savedUser._id,
        fullName: savedUser.fullName,
        email: savedUser.email,
        role: savedUser.role,
        business: {
          id: savedBusiness._id,
          name: savedBusiness.name,
          type: savedBusiness.type
        }
      },
      token
    });

  } catch (error) {
    console.error('Signup error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        errors: [{
          field: 'email',
          message: 'Email already registered'
        }]
      });
    }

    // Handle other errors
    res.status(500).json({
      success: false,
      message: 'Server error during signup',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Login Route
router.post('/login', [
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    
    // Find user and populate business info
    const user = await User.findOne({ email }).populate('business', 'name type');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Generate token
    const token = generateToken(user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        business: user.business
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;