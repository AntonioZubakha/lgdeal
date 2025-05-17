const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

/**
 * Additional marketplace routes
 */

// @route   GET /api/marketplace/lgdeal
// @desc    Get LGDEAL LLC info (placeholder)
// @access  Public
router.get('/lgdeal', (req, res) => {
  res.json({
    name: 'LGDEAL LLC',
    description: 'LGDEAL management company',
    status: 'active'
  });
});

module.exports = router; 