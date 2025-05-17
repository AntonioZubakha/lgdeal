const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isLgdealSupervisor, verifyToken } = require('../utils/userUtils');

/**
 * Admin authentication middleware
 * Checks if the user has admin privileges or is a supervisor at LGDEAL LLC
 */
module.exports = async function(req, res, next) {
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
    
    // Add user from payload
    req.user = decoded;
    
    // If the token already contains isLgdealSupervisor flag, use that
    if (decoded.isLgdealSupervisor) {
      req.user.isLgdealAdmin = true;
      console.log('Admin access granted via LGDEAL supervisor flag in token');
      return next();
    }
    
    // Find user in database with company info
    const user = await User.findById(decoded.userId).populate('company');
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    // Check if user is an admin OR a supervisor at LGDEAL LLC
    const isAdmin = user.role === 'admin';
    const hasLgdealSupervisorRole = isLgdealSupervisor(user);
    
    if (!isAdmin && !hasLgdealSupervisorRole) {
      return res.status(403).json({ message: 'Access denied: Admin privileges required' });
    }
    
    // Add admin flags to request
    req.user.isLgdealAdmin = hasLgdealSupervisorRole;
    req.user.isLgdealSupervisor = hasLgdealSupervisorRole;
    
    console.log(`Admin access granted. isAdmin: ${isAdmin}, isLgdealSupervisor: ${hasLgdealSupervisorRole}`);
    
    next();
  } catch (err) {
    console.error('Admin auth middleware error:', err);
    res.status(401).json({ message: 'Token is not valid' });
  }
}; 