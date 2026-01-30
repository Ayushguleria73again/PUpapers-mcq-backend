const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const verifyToken = require('../middleware/auth');
const { sendOTPEmail, sendPasswordResetEmail } = require('../utils/emailService');

// Helper to generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// @route   GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User profile not found. Please login again.' });
    
    // Check if user is verified
    if (!user.isVerified) {
      return res.status(403).json({ message: 'Your email is not verified yet. Please verify to access your profile.', email: user.email });
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
      return res.status(400).json({ message: 'An account with this email already exists. Please login instead.' });
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
      return res.status(500).json({ message: 'We could not send the verification email. Please try signing up again.' });
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
      return res.status(400).json({ message: 'The code you entered is invalid or has expired. Please request a new one.' });
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

    if (!user) return res.status(404).json({ message: 'No account found with this email addressed.' });
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
    if (!user) {
      return res.status(401).json({ message: 'No account found with this email. Please sign up first.' });
    }
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password. Please try again.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ 
        message: 'Your email is not verified. We sent a new code to your email.',
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
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  res.json({ message: 'Logged out successfully' });
});

// @route   DELETE /api/auth/account
router.delete('/account', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1. Delete all user results
    const Result = require('../models/Result');
    await Result.deleteMany({ user: userId });

    // 2. Delete user
    const user = await User.findByIdAndDelete(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 3. Clear cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });

    res.json({ message: 'Account and all data deleted successfully' });
  } catch (err) {
    console.error('SERVER ERROR (DELETE ACCOUNT):', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { fullName, bio, phone, institution } = req.body;
    
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (fullName) user.fullName = fullName;
    if (bio !== undefined) user.bio = bio;
    if (phone !== undefined) user.phone = phone;
    if (institution !== undefined) user.institution = institution;

    await user.save();
    
    // Return updated user without password
    const updatedUser = await User.findById(req.user.userId).select('-password');
    res.json(updatedUser);
  } catch (err) {
    console.error('SERVER ERROR (PROFILE UPDATE):', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/profile-image
// Reuse the common upload config
const { upload } = require('../config/cloudinary');
router.post('/profile-image', verifyToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.profileImage = req.file.path;
    await user.save();

    res.json({ url: req.file.path });
  } catch (err) {
    console.error('SERVER ERROR (PROFILE IMAGE):', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/bookmarks
// @desc    Toggle bookmark for a question
// @access  Private
router.post('/bookmarks', verifyToken, async (req, res) => {
  try {
    const { questionId } = req.body;
    if (!questionId) return res.status(400).json({ message: 'Question ID is required' });

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isBookmarked = user.bookmarks.includes(questionId);

    if (isBookmarked) {
      user.bookmarks = user.bookmarks.filter(id => id.toString() !== questionId);
    } else {
      user.bookmarks.push(questionId);
    }

    await user.save();
    res.json({ bookmarks: user.bookmarks });
  } catch (err) {
    console.error('Bookmark Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/bookmarks
// @desc    Get all bookmarked questions
// @access  Private
router.get('/bookmarks', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate({
      path: 'bookmarks',
      populate: { path: 'subject', select: 'name slug' }
    });
    
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user.bookmarks);
  } catch (err) {
    console.error('Fetch Bookmarks Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

// Re-import email service to include new function


// @route   POST /api/auth/forgot-password
// @desc    Initiate password reset
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      // For security, checking existence blindly is risky, but for this UX we'll return 404 or generic
      return res.status(404).json({ message: 'We couldn\'t find an account with that email address.' });
    }

    const otp = generateOTP();
    user.resetPasswordOtp = otp;
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await user.save();

    await sendPasswordResetEmail(email, user.fullName, otp);

    res.json({ message: 'Password reset code sent to your email' });
  } catch (err) {
    console.error('Forgot Password Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with OTP
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ 
      email, 
      resetPasswordOtp: otp, 
      resetPasswordExpires: { $gt: Date.now() } 
    });

    if (!user) {
      return res.status(400).json({ message: 'This reset code is invalid or has expired. Please try again.' });
    }

    // Password hashing is handled by pre('save') hook, but we need to set it directly
    user.password = newPassword; 
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();

    res.json({ message: 'Password reset successfully. You can now login.' });
  } catch (err) {
    console.error('Reset Password Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
