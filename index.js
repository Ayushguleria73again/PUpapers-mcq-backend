require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const contentRoutes = require('./routes/content');

// Security & Performance Middleware
const helmet = require('helmet');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 5001; 

// Connect to Database
connectDB();

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Use robust CORS package
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'https://p-upapers-mcq-frontend.vercel.app',
    process.env.CLIENT_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));



// app.use(helmet({
//   crossOriginResourcePolicy: { policy: "cross-origin" }
// })); // Secure Headers with cross-origin access
app.use(compression()); // Compress responses

app.use(express.json({ limit: '5mb' })); // Allow larger payloads for images/content
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());

// Data Security (Manual Sanitization for Express 5 stability)
// const sanitize = (obj) => {
//   if (!obj || typeof obj !== 'object') return obj;
//   Object.keys(obj).forEach(key => {
//     if (key.startsWith('$') || key.includes('.')) {
//       const newKey = key.replace(/^\$|\./g, '_');
//       obj[newKey] = obj[key];
//       delete obj[key];
//     }
//     if (typeof obj[key] === 'object') sanitize(obj[key]);
//   });
//   return obj;
// };

// app.use((req, res, next) => {
//   if (req.body) sanitize(req.body);
//   if (req.params) sanitize(req.params);
//   next();
// });

// XSS protection is handled by Helmet security headers (removed redundant middleware)

// Rate Limiting
const { apiLimiter } = require('./middleware/rateLimiter');
app.use('/api', apiLimiter);

// Health Check
app.get('/', (req, res) => res.json({ message: 'Server is running securely' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/contact', require('./routes/contact'));

// Error Handling Middleware
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
app.use(notFound);
app.use(errorHandler);

// Only listen if run directly (not when imported by Vercel)
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    // Close server & exit process
    server.close(() => process.exit(1));
  });
}

module.exports = app; // Export for Vercel
