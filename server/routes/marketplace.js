const express = require('express');
const router = express.Router();
const { getProducts } = require('../controllers/marketplaceController');

// Get products with optional filtering
router.get('/', getProducts);

module.exports = router; 