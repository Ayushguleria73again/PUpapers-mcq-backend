const rateLimit = require('express-rate-limit');

// General API Limiter: 100 reqs per 15 mins
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

// Strict Auth Limiter: 10 reqs per hour (Prevent brute force)
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 15 login/signup attempts per hour
  standardHeaders: true, 
  legacyHeaders: false,
  message: {
    message: 'Too many login attempts. Please try after 1hr.'
  }
});

module.exports = { apiLimiter, authLimiter };
