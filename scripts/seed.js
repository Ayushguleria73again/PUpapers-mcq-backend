const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const Subject = require('../models/Subject');
const Chapter = require('../models/Chapter');
const Question = require('../models/Question');
const Result = require('../models/Result');

// Load env vars
dotenv.config({ path: '../.env' });

// Load Data from JSON files
const dataDir = path.join(__dirname, '../data');
const subjects = JSON.parse(fs.readFileSync(path.join(dataDir, 'subjects.json'), 'utf-8'));
const sampleChapters = JSON.parse(fs.readFileSync(path.join(dataDir, 'chapters.json'), 'utf-8'));
const sampleQuestions = JSON.parse(fs.readFileSync(path.join(dataDir, 'questions.json'), 'utf-8'));

const seedDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in .env');
    }

    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected for Seeding...');

    // Clear existing data
    await Subject.deleteMany({});
    await Chapter.deleteMany({});
    await Question.deleteMany({});
    await Result.deleteMany({});
    console.log('Old data cleared (including Results).');

    // Insert Subjects
    const insertedSubjects = await Subject.insertMany(subjects);
    console.log(`Seeded ${insertedSubjects.length} subjects.`);

    let totalChapters = 0;
    let totalQuestions = 0;

    // Loop through each subject to add content
    for (const sub of insertedSubjects) {
      // 1. Create Chapters
      const chaptersList = sampleChapters[sub.slug] || [];
      const createdChapters = [];
      
      if (chaptersList.length > 0) {
          const chaptersWithId = chaptersList.map((c, idx) => ({
              ...c,
              subject: sub._id,
              order: idx
          }));
          const docs = await Chapter.insertMany(chaptersWithId);
          createdChapters.push(...docs);
          totalChapters += docs.length;
      }

      // 2. Create Questions (Distribute across chapters randomly for demo)
      const questionsList = sampleQuestions[sub.slug];
      if (questionsList) {
        const questionsWithId = questionsList.map((q, qIdx) => {
            // Assign to first chapter if available, or just subject
            const assignedChapter = createdChapters.length > 0 
                ? createdChapters[qIdx % createdChapters.length]._id 
                : null;
            
            return {
                ...q,
                subject: sub._id,
                chapter: assignedChapter
            };
        });
        await Question.insertMany(questionsWithId);
        totalQuestions += questionsWithId.length;
      }
    }
    
    console.log(`Seeded ${totalChapters} chapters.`);
    console.log(`Seeded ${totalQuestions} questions.`);

    process.exit(0);
  } catch (err) {
    console.error('Seeding Error:', err);
    process.exit(1);
  }
};

seedDatabase();
