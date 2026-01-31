const rateLimit = require('express-rate-limit');

// General API Limiter: 500 reqs per 15 mins (relaxed for better UX)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 500 : 10000, // Relaxed limits
  skip: (req) => process.env.NODE_ENV === 'development', // Skip in development
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

// Auth Limiter: 20 reqs per hour (Prevent brute force, relaxed for UX)
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'production' ? 20 : 1000, // Relaxed limits
  skip: (req) => process.env.NODE_ENV === 'development', // Skip in development
  standardHeaders: true, 
  legacyHeaders: false,
  message: {
    message: 'Too many login attempts. Please try after 1hr.'
  }
});

module.exports = { apiLimiter, authLimiter };
