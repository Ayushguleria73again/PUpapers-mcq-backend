const express = require('express');
const router = express.Router();

const subjectsRoutes = require('./subjects');
const chaptersRoutes = require('./chapters');
const questionsRoutes = require('./questions');
const resultsRoutes = require('./results');
const aiRoutes = require('./ai');

// Mount the modular routes
// Note: The files themselves define the full paths relative to /api/content
// So we just mount them all at root level of this router
router.use('/', subjectsRoutes);
router.use('/', chaptersRoutes);
router.use('/', questionsRoutes);
router.use('/', resultsRoutes);
router.use('/', aiRoutes);

module.exports = router;
