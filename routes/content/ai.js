const express = require('express');
const router = express.Router();
const Question = require('../../models/Question');
const verifyToken = require('../../middleware/auth');
const aiModel = require('../../config/ai');

// @route   POST /explain
// @desc    Get AI-generated explanation for a question
// @access  Private
router.post('/explain', verifyToken, async (req, res) => {
  try {
    console.log(`[AI Request] Received explanation request for: ${req.body.questionId}`);
    const { questionId, userChoice } = req.body;
    if (!questionId) return res.status(400).json({ message: 'Question ID is required' });

    const question = await Question.findById(questionId).populate('subject', 'name');
    if (!question) return res.status(404).json({ message: 'Question not found' });

    if (!process.env.GEMINI_API_KEY) {
      console.error('[AI Error] GEMINI_API_KEY is missing');
      return res.status(503).json({ message: 'AI Service currently unavailable (API Key missing)' });
    }

    const optionsText = question.options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n');
    const correctLetter = String.fromCharCode(65 + question.correctOption);
    const userLetter = userChoice !== undefined && userChoice !== null ? String.fromCharCode(65 + userChoice) : 'N/A';

    const prompt = `
      ### System Instruction:
      You are an expert academic tutor for the Panjab University Common Entrance Test (PU CET).
      Provide a clear, logical, and educational step-by-step explanation.
      - If the user choice is provided and it is wrong, explain why it might be a common mistake.
      - Support LaTeX for math/science (use $ for inline, $$ for blocks).
      - Always use standard ASCII characters for quotes (avoid smart quotes).
      
      ### Question Details:
      Question: ${question.text}
      Options:
      ${optionsText}
      
      Correct Answer: ${correctLetter}
      User's Choice: ${userLetter}
    `;

    const response = await aiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });
    const result = await response.response;
    const text = result.text();
    
    res.json({ explanation: text });
  } catch (err) {
    console.error('AI Explanation Error:', err);
    res.status(500).json({ 
      message: 'Failed to generate AI explanation', 
      error: err.message // Send actual error to client for debugging
    });
  }
});

// @route   POST /chat
// @desc    General AI Chat for Admin Helpers
// @access  Private
router.post('/chat', verifyToken, async (req, res) => {
  try {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ message: 'Message is required' });

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ message: 'AI Service currently unavailable (API Key missing)' });
    }

    const systemPrompt = `
      You are an intelligent assistant helping an administrator manage content for an educational platform (PU CET exams).
      Context: ${context || 'General Admin Task'}
      
      Your goal is to help with:
      1. Drafting subject descriptions.
      2. Suggesting relevant topics or slugs.
      3. Formatting content in Markdown/LaTeX.
      4. Providing creative ideas for educational content.
      
      Keep responses concise, professional, and directly useful.
    `;

    const chat = aiModel.startChat({
        history: [
            {
                role: "user",
                parts: [{ text: systemPrompt }],
            },
            {
                role: "model",
                parts: [{ text: "Understood. I am ready to assist you with your content management tasks." }],
            },
        ],
    });

    const result = await chat.sendMessage(message);
    const text = result.response.text();

    res.json({ reply: text });
  } catch (err) {
    console.error('AI Chat Error:', err);
    res.status(500).json({ message: 'Failed to generate AI response' });
  }
});

module.exports = router;
