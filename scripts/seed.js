const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Subject = require('../models/Subject');
const Chapter = require('../models/Chapter');
const Question = require('../models/Question');

// Load env vars
dotenv.config({ path: '../.env' });

const subjects = [
  {
    name: 'Physics',
    slug: 'physics',
    image: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?q=80&w=400&auto=format&fit=crop',
    description: 'Master the laws of nature, from mechanics to quantum physics.'
  },
  {
    name: 'Chemistry',
    slug: 'chemistry',
    image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=400&auto=format&fit=crop',
    description: 'Explore the composition, structure, and properties of matter.'
  },
  {
    name: 'Biology',
    slug: 'biology',
    image: 'https://images.unsplash.com/photo-1530210124550-912dc1381cb8?q=80&w=400&auto=format&fit=crop',
    description: 'Dive into the study of life and living organisms.'
  },
  {
    name: 'Mathematics',
    slug: 'mathematics',
    image: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?q=80&w=400&auto=format&fit=crop',
    description: 'Solve complex problems with logic and numbers.'
  }
];

const sampleChapters = {
  physics: [
    { name: 'Mechanics', slug: 'mechanics', description: 'Motion, forces, and energy.' },
    { name: 'Thermodynamics', slug: 'thermodynamics', description: 'Heat, work, and entropy.' },
    { name: 'Electromagnetism', slug: 'electromagnetism', description: 'Electric and magnetic fields.' }
  ],
  chemistry: [
    { name: 'Organic Chemistry', slug: 'organic-chemistry', description: 'Carbon-based compounds.' },
    { name: 'Inorganic Chemistry', slug: 'inorganic-chemistry', description: 'Metals and non-metals.' },
    { name: 'Physical Chemistry', slug: 'physical-chemistry', description: 'Reaction rates and thermodynamics.' }
  ],
  biology: [
    { name: 'Cell Biology', slug: 'cell-biology', description: 'Structure and function of cells.' },
    { name: 'Genetics', slug: 'genetics', description: 'Heredity and variation.' },
    { name: 'Ecology', slug: 'ecology', description: 'Organisms and their environment.' }
  ],
  mathematics: [
    { name: 'Calculus', slug: 'calculus', description: 'Limits, derivatives, and integrals.' },
    { name: 'Algebra', slug: 'algebra', description: 'Equations and inequalities.' },
    { name: 'Trigonometry', slug: 'trigonometry', description: 'Triangles and waves.' }
  ]
};

const sampleQuestions = {
  physics: [
    {
      text: 'What is the SI unit of Force?',
      options: ['Newton', 'Joule', 'Pascal', 'Watt'],
      correctOption: 0,
      difficulty: 'easy',
      explanation: 'The SI unit of force is the Newton (N), named after Sir Isaac Newton. Unlike Joule (Energy), Pascal (Pressure), or Watt (Power), the Newton defines the force required to accelerate 1 kg of mass at 1 m/s².'
    },
    {
      text: 'Which law states that for every action, there is an equal and opposite reaction?',
      options: ['Newton\'s First Law', 'Newton\'s Second Law', 'Newton\'s Third Law', 'Law of Conservation of Momentum'],
      correctOption: 2,
      difficulty: 'easy',
      explanation: 'Newton\'s Third Law of Motion states that for every action (force) in nature, there is an equal and opposite reaction. This means forces always occur in pairs.'
    }
  ],
  chemistry: [
    {
      text: 'What is the atomic number of Carbon?',
      options: ['6', '8', '12', '14'],
      correctOption: 0,
      difficulty: 'easy',
      explanation: 'Carbon has an atomic number of 6, meaning it has 6 protons in its nucleus. 8 is Oxygen, 12 is Magnesium (or Carbon\'s atomic mass), and 14 is Silicon.'
    },
    {
      text: 'Which gas is evolved when dilute hydrochloric acid reacts with zinc metal?',
      options: ['Oxygen', 'Chlorine', 'Hydrogen', 'Carbon dioxide'],
      correctOption: 2,
      difficulty: 'medium',
      explanation: 'When a metal like Zinc reacts with a dilute acid like HCl, it displaces hydrogen from the acid, releasing Hydrogen gas (H₂) and forming Zinc Chloride (ZnCl₂).'
    }
  ],
  biology: [
    {
      text: 'Which organelle is known as the powerhouse of the cell?',
      options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi apparatus'],
      correctOption: 1,
      difficulty: 'easy',
      explanation: 'Mitochondria are called the powerhouse of the cell because they are responsible for producing energy in the form of ATP (Adenosine Triphosphate) through cellular respiration.'
    },
    {
      text: 'What is the basic unit of classification?',
      options: ['Kingdom', 'Phylum', 'Family', 'Species'],
      correctOption: 3,
      difficulty: 'medium',
      explanation: 'Species is the basic and lowest unit of biological classification (Taxonomy). A species is a group of organisms that can interbreed to produce fertile offspring.'
    }
  ],
  mathematics: [
    {
      text: 'What is the derivative of x^2?',
      options: ['x', '2x', '2', 'x^2'],
      correctOption: 1,
      difficulty: 'easy',
      explanation: 'Using the power rule of differentiation, d/dx(x^n) = nx^(n-1). Here n=2, so the derivative is 2x^(2-1) = 2x.'
    },
    {
      text: 'What is the value of sin(90°)?',
      options: ['0', '1', '1/2', 'Infinity'],
      correctOption: 1,
      difficulty: 'easy',
      explanation: 'In trigonometry, the value of sine starts at 0 for 0° and reaches a maximum of 1 at 90°. Therefore, sin(90°) = 1.'
    }
  ]
};

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
    console.log('Old data cleared.');

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
