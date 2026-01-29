const User = require('../models/User');

const verifyAdmin = async (req, res, next) => {
  try {
    // req.user is already set by verifyToken middleware
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await User.findById(req.user.userId);
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin rights required.' });
    }

    // Attach full user object (optional, but useful)
    req.user.role = user.role; 
    next();
  } catch (err) {
    console.error('Admin verification error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = verifyAdmin;
