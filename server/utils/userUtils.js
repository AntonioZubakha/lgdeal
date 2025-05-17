const jwt = require('jsonwebtoken');
const marketplaceConfig = require('../config/marketplace');

/**
 * Check if user is a LGDEAL LLC supervisor
 */
const isLgdealSupervisor = (user) => {
  return (
    user.role === 'supervisor' && 
    user.company && 
    user.company.name === marketplaceConfig.managementCompany.name
  );
};

/**
 * Verify and decode JWT token
 */
const verifyToken = (token, secret = process.env.JWT_SECRET || 'secret') => {
  try {
    return jwt.verify(token, secret);
  } catch (err) {
    return null;
  }
};

module.exports = {
  isLgdealSupervisor,
  verifyToken
}; 