const express = require('express');
const router = express.Router();
const Subject = require('../../models/Subject');
const Question = require('../../models/Question');
const User = require('../../models/User');
const verifyToken = require('../../middleware/auth');
const verifyAdmin = require('../../middleware/admin');

// @route   GET /questions
// @desc    Get questions by subject slug or ID
// @access  Private
router.get('/questions', verifyToken, async (req, res) => {
  try {
    const { subjectId, slug, chapterId } = req.query;
    let query = {};

    if (subjectId) {
      query.subject = subjectId;
    } else if (slug) {
      const subject = await Subject.findOne({ slug });
      if (!subject) {
        return res.status(404).json({ message: 'Subject not found' });
      }
      query.subject = subject._id;
    }
    
    // Check if user is Premium
    if (req.user && req.user.userId) {
        const user = await User.findById(req.user.userId);
        if (!user || !user.isPremium) {
            return res.status(403).json({ 
                message: 'Chapter practice is a Premium feature.',
                code: 'PREMIUM_ONLY'
            });
        }
    }

    // Filter by chapter if provided
    if (chapterId) {
        query.chapter = chapterId;
    }

    // Anti-repeat: Exclude questions already attempted by the user
    if (req.user && req.user.userId) {
        const user = await User.findById(req.user.userId);
        if (user && user.attemptedQuestions && user.attemptedQuestions.length > 0) {
            // Check if there are any questions left for this subject after excluding attempted ones
            const remainingCount = await Question.countDocuments({ ...query, _id: { $nin: user.attemptedQuestions } });
            if (remainingCount > 0) {
                query._id = { $nin: user.attemptedQuestions };
            } else {
                // If all found questions were attempted, we reset for this subject or just show random
                console.log(`[Anti-Repeat] User ${req.user.userId} has exhausted questions for subject/chapter. Allowing repeats.`);
            }
        }
    }

    // Filter by difficulty if provided and not 'all'
    if (req.query.difficulty && req.query.difficulty !== 'all') {
        query.difficulty = req.query.difficulty;
    }

    const questions = await Question.find(query).populate('subject', 'name slug');
    res.json(questions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /questions
// @desc    Add a new question
// @access  Private (Admin only)
router.post('/questions', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { text, subjectId, chapterId, options, correctOption, explanation, difficulty } = req.body;

    const question = new Question({
      text,
      subject: subjectId,
      chapter: chapterId,
      options,
      correctOption,
      explanation,
      difficulty
    });

    await question.save();
    res.json(question);
  } catch (err) {
    console.error('Error creating question:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /questions/:id
// @desc    Update a question
// @access  Private (Admin only)
router.put('/questions/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { text, subjectId, chapterId, options, correctOption, explanation, difficulty } = req.body;

    const question = await Question.findByIdAndUpdate(
        req.params.id,
        { 
            text, 
            subject: subjectId, 
            chapter: chapterId || null, 
            options, 
            correctOption, 
            explanation, 
            difficulty 
        },
        { new: true }
    );

    if (!question) return res.status(404).json({ message: 'Question not found' });

    res.json(question);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /questions/:id
// @desc    Delete a question
// @access  Private (Admin only)
router.delete('/questions/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) return res.status(404).json({ message: 'Question not found' });

    await question.deleteOne();
    res.json({ message: 'Question deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /pucet-exam
// @desc    Get questions for full PUCET mock test (PCB/PCM)
// @access  Private
router.get('/pucet-exam', verifyToken, async (req, res) => {
  try {
    const { stream } = req.query; // 'PCB' or 'PCM'
    if (!stream || !['PCB', 'PCM'].includes(stream)) {
      return res.status(400).json({ message: 'Valid stream (PCB or PCM) is required' });
    }

    // Define subject slugs for the stream
    const subjectSlugs = ['physics-11th-12th', 'chemistry'];
    if (stream === 'PCB') subjectSlugs.push('biology');
    else subjectSlugs.push('mathematics');

    // Find subject IDs
    const subjects = await Subject.find({ slug: { $in: subjectSlugs } });
    if (subjects.length < 3) {
      return res.status(404).json({ message: 'One or more subjects for this stream not found' });
    }

    // Get user to check limits
    if (req.user && req.user.userId) {
        const user = await User.findById(req.user.userId);
        
        // Check Free Limit (Max 5 attempts for non-premium)
        if (user && !user.isPremium && user.freeTestsTaken >= 5) {
            return res.status(403).json({ 
                message: 'Free limit reached', 
                code: 'LIMIT_REACHED',
                isPremium: false
            });
        }

        if (user) attemptedIds = user.attemptedQuestions || [];
    }

    const perSubjectCount = 20;
    let allQuestions = [];

    // Fetch random questions from each subject
    for (const sub of subjects) {
      // Try to find questions NOT attempted first
      let subQuestions = await Question.aggregate([
        { $match: { subject: sub._id, _id: { $nin: attemptedIds } } },
        { $sample: { size: perSubjectCount } }
      ]);
      
      // If we don't have enough new questions, top up with random ones
      if (subQuestions.length < perSubjectCount) {
        const needed = perSubjectCount - subQuestions.length;
        const extraQuestions = await Question.aggregate([
            { $match: { subject: sub._id, _id: { $in: attemptedIds } } },
            { $sample: { size: needed } }
        ]);
        subQuestions = [...subQuestions, ...extraQuestions];
      }
      
      // Populate subject manually since aggregate doesn't do it automatically like .find().populate()
      const populated = subQuestions.map(q => ({
        ...q,
        subject: { _id: sub._id, name: sub.name, slug: sub.slug }
      }));
      
      allQuestions = [...allQuestions, ...populated];
    }

    // Final shuffle of the combined pool
    for (let i = allQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allQuestions[i], allQuestions[allQuestions[j]]] = [allQuestions[j], allQuestions[i]];
    }

    res.json(allQuestions);
  } catch (err) {
    console.error('PUCET Exam Fetch Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
