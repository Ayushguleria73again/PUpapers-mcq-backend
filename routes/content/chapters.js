const express = require('express');
const router = express.Router();
const Chapter = require('../../models/Chapter');
const Question = require('../../models/Question');
const verifyToken = require('../../middleware/auth');
const verifyAdmin = require('../../middleware/admin');

// @route   GET /chapters
// @desc    Get chapters by subject ID
// @access  Private
router.get('/chapters', verifyToken, async (req, res) => {
  try {
    const { subjectId } = req.query;
    if (!subjectId) {
      return res.status(400).json({ message: 'Subject ID is required' });
    }

    const chapters = await Chapter.find({ subject: subjectId }).sort({ order: 1, name: 1 });
    res.json(chapters);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /chapters
// @desc    Add a new chapter
// @access  Private (Admin only)
router.post('/chapters', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { name, slug, subjectId, description, order } = req.body;
    
    // Check if chapter slug exists for this subject
    let chapter = await Chapter.findOne({ slug, subject: subjectId });
    if (chapter) {
      return res.status(400).json({ message: 'Chapter already exists in this subject' });
    }

    chapter = new Chapter({
      name,
      slug,
      subject: subjectId,
      description,
      order
    });

    await chapter.save();
    res.json(chapter);
  } catch (err) {
    console.error('Error creating chapter:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /chapters/:id
// @desc    Update a chapter
// @access  Private (Admin only)
router.put('/chapters/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { name, slug, description, subjectId } = req.body;
    
    const chapter = await Chapter.findByIdAndUpdate(
        req.params.id,
        { name, slug, description, subject: subjectId },
        { new: true }
    );

    if (!chapter) return res.status(404).json({ message: 'Chapter not found' });

    res.json(chapter);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /chapters/:id
// @desc    Delete a chapter and its questions
// @access  Private (Admin only)
router.delete('/chapters/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const chapter = await Chapter.findById(req.params.id);
    if (!chapter) return res.status(404).json({ message: 'Chapter not found' });

    // Cascade delete questions
    await Question.deleteMany({ chapter: req.params.id });
    await chapter.deleteOne();

    res.json({ message: 'Chapter and associated questions deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
