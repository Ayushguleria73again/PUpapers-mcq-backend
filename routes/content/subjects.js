const express = require('express');
const router = express.Router();
const Subject = require('../../models/Subject');
const Chapter = require('../../models/Chapter');
const Question = require('../../models/Question');
const verifyToken = require('../../middleware/auth');
const verifyAdmin = require('../../middleware/admin');
const { upload } = require('../../config/cloudinary');

// @route   GET /subjects
// @desc    Get all subjects
// @access  Public
router.get('/subjects', async (req, res) => {
  try {
    const subjects = await Subject.find().sort({ name: 1 });
    res.json(subjects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /subjects
// @desc    Add a new subject
// @access  Private (Admin only)
router.post('/subjects', verifyToken, verifyAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, slug, description } = req.body;
    let image = req.body.image; // Fallback to string URL if provided

    if (req.file) {
      image = req.file.path; // Use Cloudinary URL if file upload exists
    }
    
    // Check if subject exists (by slug)
    let subject = await Subject.findOne({ slug });
    if (subject) {
      return res.status(400).json({ message: 'Subject already exists' });
    }

    subject = new Subject({
      name,
      slug,
      image,
      description
    });

    await subject.save();
    res.json(subject);
  } catch (err) {
    console.error('Error creating subject:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /subjects/:id
// @desc    Update a subject
// @access  Private (Admin only)
router.put('/subjects/:id', verifyToken, verifyAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, slug, description } = req.body;
    let image = req.body.image; 

    if (req.file) {
      image = req.file.path;
    }

    const updateData = { name, slug, description };
    if (image) updateData.image = image;

    const subject = await Subject.findByIdAndUpdate(
      req.params.id, 
      updateData,
      { new: true }
    );

    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    res.json(subject);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /subjects/:id
// @desc    Delete a subject and its chapters/questions
// @access  Private (Admin only)
router.delete('/subjects/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    // Cascade delete chapters and questions
    await Chapter.deleteMany({ subject: req.params.id });
    await Question.deleteMany({ subject: req.params.id });
    await subject.deleteOne();

    res.json({ message: 'Subject and associated content deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /upload
// @desc    Upload an image for markdown content
// @access  Private (Admin only)
router.post('/upload', verifyToken, verifyAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    res.json({ url: req.file.path });
  } catch (err) {
    console.error('Upload Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
