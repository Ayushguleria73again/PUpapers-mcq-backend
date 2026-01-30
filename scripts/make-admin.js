const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config({ path: './.env' });

const makeAdmin = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI; 
    // Fixed: Use correct env var name MONGODB_URI from .env
    if (!mongoUri) throw new Error('MONGODB_URI is not defined in .env');

    await mongoose.connect(mongoUri);
    console.log('Connected to DB');

    const email = process.argv[2];
    if (!email) {
      console.log('Please provide an email: node scripts/make-admin.js <email>');
      process.exit(1);
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found');
      process.exit(1);
    }

    user.role = 'admin';
    await user.save();
    console.log(`Success! ${user.fullName} (${user.email}) is now an Admin.`);
    process.exit(0);

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

makeAdmin();
