const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config({ path: './.env' });

const listUsers = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) throw new Error('MONGODB_URI is not defined in .env');

    await mongoose.connect(mongoUri);
    console.log('Connected to DB');

    const users = await User.find({}, 'email fullName role');
    console.log('Users found:', users);
    process.exit(0);

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

listUsers();
