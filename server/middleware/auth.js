const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isLgdealSupervisor, verifyToken } = require('../utils/userUtils');

/**
 * Authentication middleware for protected routes
 */
const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('x-auth-token');

    // Check if no token
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Token is not valid' });
    }
    
    // Add user from payload to request
    req.user = decoded;
    
    // Add debug information
    console.log(`Auth middleware - User ID: ${decoded.userId}, Role: ${decoded.role}`);
    
    // Additional check for user activation
    const user = await User.findById(decoded.userId).populate('company');
    
    if (!user) {
      console.log(`Auth middleware - User not found: ${decoded.userId}`);
      return res.status(401).json({ message: 'Account not activated or user not found' });
    }
    
    // Check if user is active, a LGDEAL supervisor, or an admin
    const hasLgdealSupervisorRole = isLgdealSupervisor(user);
    if (!user.isActive && !hasLgdealSupervisorRole && user.role !== 'admin') {
      console.log(`Auth middleware - User not active: ${decoded.userId}`);
      return res.status(401).json({ message: 'Account not activated or user not found' });
    }
    
    // Add company information and LGDEAL flags to req.user
    req.user.company = user.company;
    req.user.isLgdealSupervisor = hasLgdealSupervisorRole || decoded.isLgdealSupervisor;
    req.user.isLgdealAdmin = hasLgdealSupervisorRole || decoded.isLgdealSupervisor;
    
    console.log(`Auth middleware - User company: ${user.company?.name || 'none'}`);
    if (req.user.isLgdealSupervisor) {
      console.log(`Auth middleware - LGDEAL supervisor detected`);
    }
    
    // Check if this is an impersonation token
    if (decoded.isImpersonation) {
      console.log('Impersonation token detected');
      // Additional checks for impersonation tokens could be added here
    }

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = auth; 