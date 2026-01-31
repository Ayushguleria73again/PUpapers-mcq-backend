const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Subject = require('../../models/Subject');
const Result = require('../../models/Result');
const User = require('../../models/User');
const verifyToken = require('../../middleware/auth');

// @route   POST /results
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
      percentage,
      questions: req.body.questions || [] // Now expects array of objects { question, timeTaken, userChoice, isCorrect }
    });

    await result.save();

    // Update user's attempted questions (extract IDs from new structure)
    if (req.body.questions && req.body.questions.length > 0) {
        const questionIds = req.body.questions.map(q => q.question);
        
        // 1. Update User Stats
        await User.findByIdAndUpdate(req.user.userId, {
            $addToSet: { attemptedQuestions: { $each: questionIds } },
            $inc: { freeTestsTaken: 1 }
        });

        // 2. Update Question Global Stats (Average Time)
        // We do this asynchronously so we don't block the response too long
        // or we await it if consistency is critical. Let's await for now.
        const Question = require('../../models/Question');
        
        for (const qStat of req.body.questions) {
            // Using findOneAndUpdate to atomically increment count and update average
            // Formula for new Average: NewAvg = ((OldAvg * OldCount) + NewValue) / (OldCount + 1)
            // Since Mongo doesn't support arithmetic using current field values easily in simple update,
            // we will fetch and save.
            
            try {
                const question = await Question.findById(qStat.question);
                if (question) {
                    const oldAvg = question.averageTime || 0;
                    const oldCount = question.attemptCount || 0;
                    const newTime = qStat.timeTaken || 0;

                    // Calculate new average
                    // Avoid huge outliers? Maybe cap time at 300s? logic for another day.
                    const newAvg = ((oldAvg * oldCount) + newTime) / (oldCount + 1);

                    question.averageTime = newAvg;
                    question.attemptCount = oldCount + 1;
                    await question.save();
                }
            } catch (err) {
                console.error(`Failed to update stats for q ${qStat.question}:`, err);
            }
        }
    }

    res.json(result);
  } catch (err) {
    console.error('Error saving result:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /progress
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

// @route   GET /history
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

// @route   GET /leaderboard
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
          profileImage: '$userInfo.profileImage',
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

module.exports = router;
