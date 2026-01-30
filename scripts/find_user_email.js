const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config({ path: './.env' });

const findUser = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ name: new RegExp('Ayush Guleria', 'i') }) || await User.findOne({ fullName: new RegExp('Ayush Guleria', 'i') });
    
    if (user) {
        console.log(`FOUND_EMAIL:${user.email}`);
    } else {
        console.log('User not found');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

findUser();
