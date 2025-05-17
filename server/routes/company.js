const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Company = require('../models/Company');
const adminAuth = require('../middleware/adminAuth');

// @route   GET api/company/users
// @desc    Get all users in company
// @access  Private
router.get('/users', auth, companyController.getCompanyUsers);

// @route   PUT api/company/users/:userId/activate
// @desc    Activate user
// @access  Private (supervisor only)
router.put('/users/:userId/activate', auth, companyController.activateUser);

// @route   PUT api/company/users/:userId/role
// @desc    Change user role
// @access  Private (supervisor only)
router.put('/users/:userId/role', auth, companyController.changeUserRole);

// @route   GET api/company/info
// @desc    Get company information
// @access  Private
router.get('/info', auth, companyController.getCompanyInfo);

// @route   PUT api/company/info
// @desc    Update company information
// @access  Private (supervisor only)
router.put('/info', auth, companyController.updateCompanyInfo);

// @route   POST api/company/logo
// @desc    Upload company logo
// @access  Private (supervisor only)
router.post('/logo', auth, companyController.uploadLogo);

// ADMIN ROUTES FOR COMPANY MANAGEMENT

// @route   GET /api/company
// @desc    Get all companies (admin)
// @access  Private (Admin)
router.get('/', adminAuth, companyController.getAllCompanies);

// @route   GET /api/company/onboarding-requests
// @desc    Get companies pending review (admin)
// @access  Private (Admin)
router.get('/onboarding-requests', adminAuth, companyController.getOnboardingRequests);

// @route   PUT /api/company/:companyId/approve
// @desc    Approve a company (admin)
// @access  Private (Admin)
router.put('/:companyId/approve', adminAuth, companyController.approveCompany);

// @route   PUT /api/company/:companyId/reject
// @desc    Reject a company (admin)
// @access  Private (Admin)
router.put('/:companyId/reject', adminAuth, companyController.rejectCompany);

// @route   GET /api/company/:id
// @desc    Get single company by ID (admin or user of that company)
// @access  Private (Admin)
// This route must be last among GET routes with similar path structure
router.get('/:id', adminAuth, companyController.getCompany);

module.exports = router; 