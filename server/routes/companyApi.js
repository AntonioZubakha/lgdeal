const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const companyApiController = require('../controllers/companyApiController');

// Get API configuration for a company
router.get('/:companyId', adminAuth, companyApiController.getApiConfig);

// Update API configuration
router.put('/:companyId', adminAuth, companyApiController.updateApiConfig);

// Trigger manual sync
router.post('/:companyId/sync', adminAuth, companyApiController.triggerSync);

// Ручной сброс статуса синхронизации
router.post('/:companyId/reset-sync', adminAuth, companyApiController.resetSyncStatus);

router.get('/config/:companyId', companyApiController.getApiConfig);
router.post('/config/:companyId', companyApiController.updateApiConfig);
router.post('/sync/:companyId', companyApiController.triggerSync);
router.get('/sync/queue/status', companyApiController.getSyncQueueStatus);

module.exports = router; 