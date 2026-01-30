const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const Chapter = require('../models/Chapter');
const Question = require('../models/Question');
const Result = require('../models/Result');
const verifyToken = require('../middleware/auth');
const verifyAdmin = require('../middleware/admin');
const { upload } = require('../config/cloudinary');
const openai = require('../config/ai');

// @route   GET /api/content/subjects
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

// @route   GET /api/content/chapters
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

// @route   GET /api/content/questions
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
    
    // Filter by chapter if provided
    if (chapterId) {
        query.chapter = chapterId;
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

// @route   POST /api/content/results
// @desc    Save quiz result
// @access  Private
router.post('/results', verifyToken, async (req, res) => {
  try {
    const { subjectId, score, totalQuestions } = req.body;

    const percentage = (score / totalQuestions) * 100;

    const result = new Result({
      user: req.user.userId,
      subject: subjectId,
      score,
      totalQuestions,
      percentage
    });

    await result.save();
    res.json(result);
  } catch (err) {
    console.error('Error saving result:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/content/progress
// @desc    Get user progress stats
// @access  Private
router.get('/progress', verifyToken, async (req, res) => {
  try {
    const results = await Result.find({ user: req.user.userId }).populate('subject', 'name image');

    const totalTests = results.length;
    const totalScore = results.reduce((acc, curr) => acc + curr.score, 0);
    const maxScorePossible = results.reduce((acc, curr) => acc + curr.totalQuestions, 0);
    
    // Calculate overall average percentage
    const avgPercentage = totalTests > 0 
      ? Math.round(results.reduce((acc, curr) => acc + curr.percentage, 0) / totalTests)
      : 0;

    // Calculate level based on tests taken (simple gamification)
    const level = Math.floor(totalTests / 5) + 1;

    // Group recent activity
    const recentActivity = results
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5) // Last 5 tests
      .map(r => ({
        id: r._id,
        subject: r.subject ? r.subject.name : 'Unknown',
        score: `${r.score}/${r.totalQuestions}`,
        date: r.createdAt.toLocaleDateString(),
        points: `+${Math.round(r.percentage / 10)}` // Mock points calculation
      }));

    // Calculate Subject Mastery Breakdown
    const allSubjects = await Subject.find().sort({ name: 1 });
    const subjectProgress = allSubjects.map(sub => {
      const subResults = results.filter(r => r.subject && r.subject._id.toString() === sub._id.toString());
      const testsCount = subResults.length;
      const avgAcc = testsCount > 0 
        ? Math.round(subResults.reduce((acc, curr) => acc + curr.percentage, 0) / testsCount)
        : 0;
      
      return {
        id: sub._id,
        name: sub.name,
        slug: sub.slug,
        image: sub.image,
        testsCount,
        accuracy: avgAcc
      };
    });
    
    res.json({
      totalTests,
      avgPercentage,
      level,
      recentActivity,
      subjectProgress
    });
  } catch (err) {
    console.error('Error fetching progress:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/content/history
// @desc    Get full quiz history
// @access  Private
router.get('/history', verifyToken, async (req, res) => {
  try {
    const results = await Result.find({ user: req.user.userId })
      .populate('subject', 'name image slug')
      .sort({ createdAt: -1 });

    const history = results.map(r => ({
      id: r._id,
      subject: r.subject ? r.subject.name : 'Unknown',
      slug: r.subject ? r.subject.slug : '',
      score: r.score,
      totalQuestions: r.totalQuestions,
      percentage: Math.round(r.percentage),
      date: r.createdAt.toLocaleDateString() + ' ' + r.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

    res.json(history);
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/content/chapters
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

// @route   POST /api/content/upload
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

// @route   POST /api/content/subjects
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

// @route   POST /api/content/questions
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

// @route   GET /api/content/leaderboard
// @desc    Get leaderboard stats (top students)
// @access  Public
router.get('/leaderboard', async (req, res) => {
  try {
    const { subjectId } = req.query;
    
    let matchStage = {};
    if (subjectId && subjectId !== 'all') {
      matchStage = { subject: new mongoose.Types.ObjectId(subjectId) };
    }

    const leaderboard = await Result.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$user',
          totalScore: { $sum: '$score' },
          totalQuestions: { $sum: '$totalQuestions' },
          testsTaken: { $sum: 1 },
          avgPercentage: { $avg: '$percentage' }
        }
      },
      { $sort: { totalScore: -1, avgPercentage: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $project: {
          _id: 1,
          name: '$userInfo.fullName',
          totalScore: 1,
          totalQuestions: 1,
          testsTaken: 1,
          avgPercentage: { $round: ['$avgPercentage', 2] }
        }
      }
    ]);

    res.json(leaderboard);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/content/subjects/:id
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

// @route   DELETE /api/content/chapters/:id
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

// @route   DELETE /api/content/questions/:id
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

// @route   PUT /api/content/subjects/:id
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

// @route   PUT /api/content/chapters/:id
// @desc    Update a chapter
// @access  Private (Admin only)
router.put('/chapters/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { name, slug, description, subjectId } = req.body;
    
    // If subjectId is changing, we should probably check if the new slug exists in that subject
    // For now assuming simple update
    
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

// @route   PUT /api/content/questions/:id
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

// @route   POST /api/content/explain
// @desc    Get AI-generated explanation for a question
// @access  Private
router.post('/explain', verifyToken, async (req, res) => {
  try {
    const { questionId, userChoice } = req.body;
    if (!questionId) return res.status(400).json({ message: 'Question ID is required' });

    const question = await Question.findById(questionId).populate('subject', 'name');
    if (!question) return res.status(404).json({ message: 'Question not found' });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ message: 'AI Service currently unavailable (API Key missing)' });
    }

    const optionsText = question.options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n');
    const correctLetter = String.fromCharCode(65 + question.correctOption);
    const userLetter = userChoice !== undefined && userChoice !== null ? String.fromCharCode(65 + userChoice) : 'N/A';

    const prompt = `
      You are an expert tutor for the Panjab University Common Entrance Test (PU CET).
      Explain the following multiple-choice question step-by-step.
      
      Question: ${question.text}
      Options:
      ${optionsText}
      
      Correct Answer: ${correctLetter}
      User's Choice: ${userLetter}

      Requirement:
      1. Provide a clear, logical, and educational explanation.
      2. If the user was wrong, gently explain why their choice might be a common mistake.
      3. Use professional, encouraging tone.
      4. Support LaTeX for mathematical or scientific formulas (use $ for inline and $$ for blocks).
      5. Keep it concise but comprehensive (max 300 words).
      6. Return findings in clean Markdown.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Efficient and high quality for this task
      messages: [
        { role: "system", content: "You are a helpful academic tutor specializing in PU CET exam preparation." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    });

    res.json({ explanation: response.choices[0].message.content });
  } catch (err) {
    console.error('AI Explanation Error:', err);
    res.status(500).json({ message: 'Failed to generate AI explanation' });
  }
});

module.exports = router;
