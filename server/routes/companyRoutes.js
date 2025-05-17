const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth'); // Assuming you have this middleware for admin-only routes

// @route   GET /api/company
// @desc    Get all companies (admin)
// @access  Private (Admin)
router.get('/', adminAuth, companyController.getAllCompanies);

// @route   GET /api/company/onboarding-requests
// @desc    Get companies pending review (admin)
// @access  Private (Admin)
// This route must be defined before any routes with parameters like /:id or /:companyId
router.get('/onboarding-requests', adminAuth, companyController.getOnboardingRequests);

// @route   GET /api/company/:id
// @desc    Get single company by ID (admin or user of that company)
// @access  Private (Admin) - Assuming adminAuth based on error context
router.get('/:id', adminAuth, companyController.getCompany);

// @route   PUT /api/company/:companyId/approve
// @desc    Approve a company (admin)
// @access  Private (Admin)
router.put('/:companyId/approve', adminAuth, companyController.approveCompany);

// @route   PUT /api/company/:companyId/reject
// @desc    Reject a company (admin)
// @access  Private (Admin)
router.put('/:companyId/reject', adminAuth, companyController.rejectCompany);

module.exports = router; 