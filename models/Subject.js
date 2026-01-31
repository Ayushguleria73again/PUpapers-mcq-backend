const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  streams: {
    type: [String],
    enum: ['medical', 'non-medical', 'commerce', 'arts'],
    default: []
  },
  image: {
    type: String, // URL to the subject image
    default: 'https://placehold.co/400x300?text=Subject'
  },
  description: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Subject', subjectSchema);
