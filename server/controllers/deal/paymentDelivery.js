const Deal = require('../../models/Deal');
const { determineUserRole } = require('./helpers');

/**
 * Upload an invoice for a deal
 */
exports.uploadInvoice = async (req, res) => {
  try {
    const { dealId } = req.params;
    const userId = req.user.userId;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No invoice file uploaded' });
    }
    
    const invoice = {
      filename: req.file.filename,
      url: `/uploads/invoices/${req.file.filename}`,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    };
    
    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Проверяем, прямая ли это сделка LGDEAL (без парной)
    const isDirectLgdealDeal = deal.dealType === 'buyer-to-lgdeal' && !deal.pairedDealIds?.length;
    
    // Authorization: only LGDEAL supervisor or seller can upload invoice
    const userIsSeller = deal.sellerId && deal.sellerId.toString() === userId;
    const isLgdealAdmin = req.user.isLgdealSupervisor;
    
    // Special case: LGDEAL supervisors can act as sellers for buyer-to-lgdeal deals
    const isLgdealSellerRole = isLgdealAdmin && deal.dealType === 'buyer-to-lgdeal' && !isDirectLgdealDeal;
    
    // Special case for direct LGDEAL deals (admin acts as seller)
    const isLgdealDualRoleAsSeller = isDirectLgdealDeal && isLgdealAdmin;
    
    if (!userIsSeller && !isLgdealSellerRole && !isLgdealDualRoleAsSeller) {
      return res.status(403).json({ 
        message: 'Not authorized to upload invoice for this deal' 
      });
    }
    
    deal.paymentDetails.invoiceFilename = req.file.filename;
    deal.invoiceUrl = `/api/deal/${dealId}/invoice/${req.file.filename}`;
    deal.status = 'invoice_pending'; // Update status to reflect invoice is now pending payment
    
    // Add to activity log
    deal.activityLog.push({
      action: 'message_sent', 
      performedBy: userId,
      details: `Invoice ${req.file.originalname} uploaded by ${determineUserRole(deal, userId, isLgdealAdmin, isDirectLgdealDeal)}`
    });
    
    deal.lastActionAt = Date.now(); // Update lastActionAt
    await deal.save();
    
    // Return populated deal
    const populatedDeal = await Deal.findById(dealId)
      .populate('buyerId', 'email firstName lastName')
      .populate('sellerId', 'email firstName lastName')
      .populate('buyerCompanyId', 'name')
      .populate('sellerCompanyId', 'name')
      .populate({
        path: 'activityLog.performedBy',
        select: 'email firstName lastName'
      });
    
    res.json({ 
      message: 'Invoice uploaded successfully', 
      deal: populatedDeal, 
      isDirectLgdealDeal 
    });
  } catch (error) {
    console.error('Error uploading invoice:', error);
    // It's good practice to also log the validation errors if they occur
    if (error.name === 'ValidationError') {
      console.error('Validation Errors:', error.errors);
    }
    res.status(500).json({ message: 'Error uploading invoice', error: error.message });
  }
};

/**
 * Upload shipping documents for a deal
 */
exports.uploadShippingDocuments = async (req, res) => {
  try {
    const { dealId } = req.params;
    const userId = req.user.userId;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No shipping documents uploaded' });
    }
    
    const documents = req.files.map(file => ({
      filename: file.filename,
      url: `/uploads/shipping/${file.filename}`,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    }));
    
    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Проверяем, прямая ли это сделка LGDEAL (без парной)
    const isDirectLgdealDeal = deal.dealType === 'buyer-to-lgdeal' && !deal.pairedDealIds?.length;
    
    // Authorization: only LGDEAL supervisor or seller can upload
    const userIsSeller = deal.sellerId && deal.sellerId.toString() === userId;
    const isLgdealAdmin = req.user.isLgdealSupervisor;
    
    const isLgdealSellerRole = isLgdealAdmin && deal.dealType === 'buyer-to-lgdeal' && !isDirectLgdealDeal;
    const isLgdealDualRoleAsSeller = isDirectLgdealDeal && isLgdealAdmin;
    
    if (!userIsSeller && !isLgdealSellerRole && !isLgdealDualRoleAsSeller) {
      return res.status(403).json({ 
        message: 'Not authorized to upload shipping documents for this deal' 
      });
    }
    
    if (!deal.shippingDocuments) {
      deal.shippingDocuments = [];
    }
    deal.shippingDocuments.push(...documents);
    deal.status = 'shipping_documents_uploaded'; // Update status
    
    // Add to activity log
    deal.activityLog.push({
      action: 'shipping_docs_uploaded',
      performedBy: userId,
      details: `${documents.length} shipping document(s) uploaded by ${determineUserRole(deal, userId, isLgdealAdmin, isDirectLgdealDeal)}`
    });
    
    deal.lastActionAt = Date.now(); // Update lastActionAt
    await deal.save();
    
    // Return populated deal
    const populatedDeal = await Deal.findById(dealId)
      .populate('buyerId', 'email firstName lastName')
      .populate('sellerId', 'email firstName lastName')
      .populate('buyerCompanyId', 'name')
      .populate('sellerCompanyId', 'name')
      .populate({
        path: 'activityLog.performedBy',
        select: 'email firstName lastName'
      });
      
    res.json({ 
      message: 'Shipping documents uploaded successfully', 
      deal: populatedDeal,
      isDirectLgdealDeal 
    });
  } catch (error) {
    console.error('Error uploading shipping documents:', error);
    res.status(500).json({ 
      message: 'Error uploading shipping documents', 
      error: error.message 
    });
  }
};

/**
 * Add a tracking number to a deal
 */
exports.addTrackingNumber = async (req, res) => {
  try {
    const { dealId } = req.params;
    const { trackingNumber, carrier } = req.body;
    const userId = req.user.userId;
    
    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Проверяем, прямая ли это сделка LGDEAL (без парной)
    const isDirectLgdealDeal = deal.dealType === 'buyer-to-lgdeal' && !deal.pairedDealIds?.length;
    
    // Authorization: only LGDEAL supervisor or seller can add tracking
    const userIsSeller = deal.sellerId && deal.sellerId.toString() === userId;
    const isLgdealAdmin = req.user.isLgdealSupervisor;
    
    const isLgdealSellerRole = isLgdealAdmin && deal.dealType === 'buyer-to-lgdeal' && !isDirectLgdealDeal;
    const isLgdealDualRoleAsSeller = isDirectLgdealDeal && isLgdealAdmin;
    
    if (!userIsSeller && !isLgdealSellerRole && !isLgdealDualRoleAsSeller) {
      return res.status(403).json({ 
        message: 'Not authorized to add tracking number for this deal' 
      });
    }
    
    if (!deal.shippingDetails) {
      deal.shippingDetails = {};
    }
    deal.shippingDetails.trackingNumber = trackingNumber;
    deal.shippingDetails.carrier = carrier;
    deal.status = 'shipped'; // Update status
    
    // Add to activity log
    deal.activityLog.push({
      action: 'shipment_initiated',
      performedBy: userId,
      details: `Tracking number ${trackingNumber} (${carrier}) added by ${determineUserRole(deal, userId, isLgdealAdmin, isDirectLgdealDeal)}`
    });
    
    deal.lastActionAt = Date.now(); // Update lastActionAt
    await deal.save();
    
    // Return populated deal
    const populatedDeal = await Deal.findById(dealId)
      .populate('buyerId', 'email firstName lastName')
      .populate('sellerId', 'email firstName lastName')
      .populate('buyerCompanyId', 'name')
      .populate('sellerCompanyId', 'name')
      .populate({
        path: 'activityLog.performedBy',
        select: 'email firstName lastName'
      });
      
    res.json({ 
      message: 'Tracking number added successfully', 
      deal: populatedDeal,
      isDirectLgdealDeal
    });
  } catch (error) {
    console.error('Error adding tracking number:', error);
    res.status(500).json({ message: 'Error adding tracking number', error: error.message });
  }
};

/**
 * Download an invoice for a deal
 */
exports.downloadInvoice = async (req, res) => {
  try {
    const { dealId } = req.params;
    const userId = req.user.userId;
    
    // Find the deal
    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Check if user is authorized (buyer, seller of this deal, or LGDEAL admin)
    const userIsBuyer = deal.buyerId && deal.buyerId.toString() === userId;
    const userIsSeller = deal.sellerId && deal.sellerId.toString() === userId;
    const userIsLgdealAdmin = req.user.isLgdealSupervisor; // Assuming isLgdealSupervisor for admin rights
    
    if (!userIsBuyer && !userIsSeller && !userIsLgdealAdmin) {
      return res.status(403).json({ message: 'Not authorized to view this invoice' });
    }
    
    // Check if there's an invoice available
    // Updated to check deal.invoice.url which is the new structure
    if (!deal.invoice || !deal.invoice.url) {
      return res.status(404).json({ message: 'No invoice found for this deal' });
    }
    
    // Получаем относительный URL инвойса из новой структуры
    const invoiceUrl = deal.invoice.url;
    
    // Перенаправляем пользователя на файл инвойса
    // For security, consider serving the file through a stream instead of direct redirect if files are sensitive
    // However, given the current structure with /uploads/, redirect is likely the existing pattern.
    return res.redirect(invoiceUrl);
    
  } catch (error) {
    console.error('Error downloading invoice:', error);
    return res.status(500).json({ message: 'Error downloading invoice', error: error.message });
  }
}; 