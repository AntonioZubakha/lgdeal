const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', authController.register);

// @route   POST api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', authController.login);

// @route   POST api/auth/create-admin
// @desc    Create admin user (protected by secret key)
// @access  Public (but protected by secret key)
router.post('/create-admin', authController.createAdmin);

// @route   GET api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', auth, authController.getMe);

// @route   POST api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', auth, authController.changePassword);

// @route   POST api/auth/logout
// @desc    Logout user and clear cart
// @access  Private
router.post('/logout', auth, authController.logout);

module.exports = router; 