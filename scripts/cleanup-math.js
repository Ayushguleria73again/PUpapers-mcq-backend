require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Question = require('../models/Question');

/**
 * PRODUCTION-READY MATH NORMALIZER (Server-Side)
 * This script deep-cleans your MongoDB collections to match the new standards.
 */
const normalizeText = (content) => {
    if (!content) return content;
    let cleaned = content;

    // 1. Structural Deduplication (Sandwich Patterns)
    const sandwichPattern = /([\[(][A-Z][\])])\s*=\s*([A-Z0-9\-\^\s]+)\s*\1\s*=\s*(\\[a-z]+\{[^}]+\})\s*\1\s*=\s*\2/gi;
    cleaned = cleaned.replace(sandwichPattern, (match, varName, plain, latex) => `${varName} = ${latex}`);

    // 2. Dimensional Analysis Normalization (ML2 -> M^2)
    cleaned = cleaned.replace(/([MLTPQ])(\-?\d+)/g, (match, variable, value) => `${variable}^{${value}}`);

    // 3. LaTeX Command Sanitization
    cleaned = cleaned.replace(/\\mathbf\{([^}]*)\}/g, '$1');
    cleaned = cleaned.replace(/\\text\{([^}]*)\}/g, '$1');

    // 4. Character Cleanup
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
        console.log('🚀 INITIALIZING MASTER MATH CLEANUP...');

        const questions = await Question.find({});
        console.log(`📊 PROCESSING ${questions.length} ENTRIES...`);

        let count = 0;
        for (const q of questions) {
            let changed = false;

            // Clean question text
            const newText = normalizeText(q.text);
            if (newText !== q.text) { q.text = newText; changed = true; }

            // Clean options
            const newOptions = q.options.map(o => normalizeText(o));
            if (JSON.stringify(newOptions) !== JSON.stringify(q.options)) { q.options = newOptions; changed = true; }

            // Clean explanation
            if (q.explanation) {
                const newExpl = normalizeText(q.explanation);
                if (newExpl !== q.explanation) { q.explanation = newExpl; changed = true; }
            }

            if (changed) {
                await q.save();
                count++;
                process.stdout.write('.');
            }
        }

        console.log(`\n\n✅ MIGRATION SUCCESSFUL!`);
        console.log(`✨ NORMALIZED: ${count} questions`);
        process.exit(0);
    } catch (err) {
        console.error('❌ MIGRATION FAILED:', err);
        process.exit(1);
    }
};

runMigration();
