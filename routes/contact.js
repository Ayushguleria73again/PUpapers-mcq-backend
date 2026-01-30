const express = require('express');
const router = express.Router();
const { sendContactEmail } = require('../utils/emailService');

// @route   POST /api/contact
// @desc    Send a contact message
// @access  Public
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Send Email
    const emailSent = await sendContactEmail(name, email, subject, message);

    if (emailSent) {
      return res.json({ message: 'Message sent successfully' });
    } else {
      // Even if email fails, we might want to log it and say success to user, OR return error. 
      // For now, let's return error so they know to try again.
      return res.status(500).json({ message: 'Failed to send message. Please try again later.' });
    }
  } catch (err) {
    console.error('SERVER ERROR (CONTACT):', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
