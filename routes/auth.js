const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const verifyToken = require('../middleware/auth');
const { sendOTPEmail } = require('../utils/emailService');

// Helper to generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// @route   GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Check if user is verified
    if (!user.isVerified) {
      return res.status(403).json({ message: 'Email not verified', email: user.email });
    }
    
    res.json(user);
  } catch (err) {
    console.error('SERVER ERROR (ME):', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    
    let user = await User.findOne({ email });
    if (user && user.isVerified) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    if (user) {
      // Update existing unverified user
      user.fullName = fullName;
      user.password = password; // Pre-save hook will hash it
      user.otp = otp;
      user.otpExpires = otpExpires;
    } else {
      // Create new user
      user = new User({ 
        fullName, 
        email, 
        password,
        otp,
        otpExpires
      });
    }

    await user.save();

    // Send OTP Email
    const emailSent = await sendOTPEmail(email, fullName, otp);
    
    if (!emailSent) {
      return res.status(500).json({ message: 'Failed to send verification email' });
    }

    res.status(201).json({ 
      message: 'OTP sent to email. Please verify to complete signup.',
      email 
    });
  } catch (err) {
    console.error('SERVER ERROR (SIGNUP):', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    const user = await User.findOne({ 
      email, 
      otp, 
      otpExpires: { $gt: Date.now() } 
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Generate token for auto-login after verification
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ 
      message: 'Email verified successfully',
      user: { fullName: user.fullName, email: user.email }
    });
  } catch (err) {
    console.error('SERVER ERROR (VERIFY):', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/resend-otp
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.isVerified) return res.status(400).json({ message: 'Email already verified' });

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOTPEmail(email, user.fullName, otp);

    res.json({ message: 'OTP resent to email' });
  } catch (err) {
    console.error('SERVER ERROR (RESEND):', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ 
        message: 'Account not verified. Please check your email.',
        unverified: true,
        email: user.email 
      });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Required for SameSite=None
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Required for cross-domain
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ 
      message: 'Login successful',
      user: { fullName: user.fullName, email: user.email }
    });
  } catch (err) {
    console.error('SERVER ERROR (LOGIN):', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
