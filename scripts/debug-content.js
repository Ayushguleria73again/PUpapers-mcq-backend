const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Subject = require('../models/Subject');
const Chapter = require('../models/Chapter');

const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const checkContent = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');

    const subjects = await Subject.find({});
    console.log(`Found ${subjects.length} subjects:`);

    for (const sub of subjects) {
        const chapters = await Chapter.find({ subject: sub._id });
        console.log(`- [${sub.name}] (Slug: ${sub.slug}, ID: ${sub._id}) -> ${chapters.length} chapters`);
        chapters.forEach(c => console.log(`   * ${c.name} (Slug: ${c.slug})`));
    }

    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkContent();
