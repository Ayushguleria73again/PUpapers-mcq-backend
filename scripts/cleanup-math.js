require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Question = require('../models/Question');

/**
 * MASTER MATH RE-NORMALIZER
 * Specialized in converting escaped LaTeX (\[ \], \\times) into clean Markdown Math.
 */
const normalizeText = (content) => {
    if (!content) return content;
    let cleaned = content;

    // 1. Convert \[ \] wrappers to $$
    cleaned = cleaned.replace(/\\\[/g, '$$$$');
    cleaned = cleaned.replace(/\\\]/g, '$$$$');

    // 2. Unescape double backslashes for commands
    cleaned = cleaned.replace(/\\\\([a-z]+)/g, '\\$1');

    // 3. Dimensional Analysis Normalization (ML2 -> M^{2})
    cleaned = cleaned.replace(/([MLTPQ])(\-?\d+)/g, (match, variable, value) => `${variable}^{${value}}`);

    // 4. Character standardizations
    cleaned = cleaned.replace(/−/g, '-');
    cleaned = cleaned.replace(/×/g, '\\times');

    // 5. Line-level deduplication
    const lines = cleaned.split('\n');
    const uniqueLines = [];
    let last = '';
    for (const line of lines) {
        if (line.trim() && line.trim() === last) continue;
        uniqueLines.push(line);
        last = line.trim();
    }
    
    return uniqueLines.join('\n').trim();
};

const runMigration = async () => {
    try {
        await connectDB();
        console.log('🚀 INITIALIZING ESCAPED LATEX NORMALIZER...');

        const questions = await Question.find({});
        console.log(`📊 PROCESSING ${questions.length} ENTRIES...`);

        let count = 0;
        for (const q of questions) {
            let changed = false;

            const newText = normalizeText(q.text);
            if (newText !== q.text) { q.text = newText; changed = true; }

            const newOptions = q.options.map(o => normalizeText(o));
            if (JSON.stringify(newOptions) !== JSON.stringify(q.options)) { q.options = newOptions; changed = true; }

            if (q.explanation) {
                const newExpl = normalizeText(q.explanation);
                if (newExpl !== q.explanation) { q.explanation = newExpl; changed = true; }
            }

            if (changed) {
                await q.save();
                count++;
            }
        }

        console.log(`\n✅ NORMALIZATION COMPLETE!`);
        console.log(`✨ UPDATED: ${count} questions`);
        process.exit(0);
    } catch (err) {
        console.error('❌ FAILED:', err);
        process.exit(1);
    }
};

runMigration();
