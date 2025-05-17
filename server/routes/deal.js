const express = require('express');
const router = express.Router();
// Old import - remove later if dealController becomes empty
// const dealController = require('../controllers/dealController'); 

// New imports from specific controller files
const { initiateDealFromCart } = require('../controllers/deal/initiation');
const { getBuyerDeals, getSellerDeals, getDealById } = require('../controllers/deal/retrieval');
const { updateDealStage, confirmDelivery, selectAlternativeProduct } = require('../controllers/deal/state');
const { submitNegotiationProposal, acceptNegotiationTerms } = require('../controllers/deal/negotiation');
const { uploadInvoice, uploadShippingDocuments, addTrackingNumber, downloadInvoice } = require('../controllers/deal/paymentDelivery');
const dealRetrievalController = require('../controllers/deal/retrieval');

// Import any remaining functions from the original controller (if any)
// We will remove this once all functions are moved and dealController.js is empty or deleted
// const dealController = require('../controllers/dealController');

const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// @route   POST api/deal/initiate
// @desc    Initiate a new deal from cart items
// @access  Private
router.post('/initiate', auth, initiateDealFromCart);

// @route   GET api/deal/buyer
// @desc    Get all deals where user is buyer
// @access  Private
router.get('/buyer', auth, getBuyerDeals);

// @route   GET api/deal/seller
// @desc    Get all deals where user is seller
// @access  Private
router.get('/seller', auth, getSellerDeals);

// Route for supervisor dashboard deals - MUST be before /:dealId
router.get('/supervisor-dashboard', auth, dealRetrievalController.getSupervisorDashboardDeals);

// @route   GET api/deal/:dealId
// @desc    Get deal by ID
// @access  Private
router.get('/:dealId', auth, getDealById);

// @route   PUT api/deal/:dealId/stage
// @desc    Update deal stage (admin/LGDEAL only)
// @access  Private (LGDEAL Supervisor or involved parties with specific conditions)
router.put('/:dealId/stage', auth, updateDealStage);

// @route   POST api/deal/:dealId/confirm-delivery
// @desc    Confirm delivery and complete the deal
// @access  Private
router.post('/:dealId/confirm-delivery', auth, confirmDelivery);

// @route   POST api/deal/:dealId/negotiation/propose
// @desc    Submit a negotiation proposal
// @access  Private
router.post('/:dealId/negotiation/propose', auth, submitNegotiationProposal);

// @route   POST api/deal/:dealId/negotiation/accept/:proposalIndex
// @desc    Accept negotiation terms
// @access  Private
router.post('/:dealId/negotiation/accept/:proposalIndex', auth, acceptNegotiationTerms);

// @route   POST api/deal/:dealId/invoice
// @desc    Upload an invoice for a deal
// @access  Private
router.post('/:dealId/invoice', auth, upload.single('invoice'), uploadInvoice); // 'invoice' is the field name for the file

// @route   GET api/deal/:dealId/invoice/download
// @desc    Download an invoice for a deal
// @access  Private
router.get('/:dealId/invoice/download', auth, downloadInvoice);

// @route   POST api/deal/:dealId/shipping-documents
// @desc    Upload shipping documents for a deal
// @access  Private
router.post('/:dealId/shipping-documents', auth, upload.array('shippingDocuments', 5), uploadShippingDocuments); // 'shippingDocuments' is field name, max 5 files

// @route   POST api/deal/:dealId/tracking
// @desc    Add a tracking number to a deal
// @access  Private
router.post('/:dealId/tracking', auth, addTrackingNumber);

// @route   POST api/deal/:dealId/product/:originalProductId/select-alternative/:alternativeProductId
// @desc    Select an alternative product for a deal
// @access  Private (LGDEAL Supervisor)
router.post(
  '/:dealId/product/:originalProductId/select-alternative/:alternativeProductId',
  auth,
  selectAlternativeProduct
);

// @route   PUT api/deal/:dealId/approve
// @desc    Approve LGDEAL request (for buyer-to-lgdeal)
// @access  Private (LGDEAL Supervisor)
// This route might be part of 'updateDealStage' now, or a new specific controller
// router.put('/:dealId/approve', auth, dealController.approveLgdealRequest);

// @route   PUT api/deal/:dealId/reject
// @desc    Reject LGDEAL request (for buyer-to-lgdeal)
// @access  Private (LGDEAL Supervisor)
// This route might be part of 'updateDealStage' now, or a new specific controller
// router.put('/:dealId/reject', auth, dealController.rejectLgdealRequest);

module.exports = router; 