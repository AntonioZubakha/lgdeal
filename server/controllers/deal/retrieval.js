const Deal = require('../../models/Deal');
const User = require('../../models/User');
const Company = require('../../models/Company');
const marketplaceConfig = require('../../config/marketplace');
const { getAllowedActions, determineUserRole } = require('./helpers'); // Assuming helpers are in the same dir

/**
 * Get all buyer's deals
 */
exports.getBuyerDeals = async (req, res) => {
  try {
    const userId = req.user.userId;
    const isLgdealSupervisor = req.user.isLgdealSupervisor;
    
    // Если пользователь является супервизором LGDEAL, возвращаем все buyer-to-lgdeal сделки
    if (isLgdealSupervisor) {
      const lgdealCompany = await Company.findOne({ name: marketplaceConfig.managementCompany.name });
      
      if (!lgdealCompany) {
        return res.status(500).json({ message: 'Management company not found' });
      }
      
      // Для супервизора LGDEAL возвращаем все сделки, где LGDEAL покупает (lgdeal-to-seller)
      const deals = await Deal.find({ 
        buyerCompanyId: lgdealCompany._id,
        dealType: 'lgdeal-to-seller'
      })
      .populate('products.product')
      .populate('sellerCompanyId', 'name')
      .populate({
        path: 'pairedDealId',
        select: 'buyerCompanyId',
        populate: {
          path: 'buyerCompanyId',
          select: 'name'
        }
      })
      .sort({ createdAt: -1 });
      
      return res.json(deals);
    }
    
    // Для обычных пользователей возвращаем только их сделки покупки
    const deals = await Deal.find({ 
      buyerId: userId,
      dealType: 'buyer-to-lgdeal'
    })
    .populate('products.product')
    .populate('sellerCompanyId', 'name')
    .populate({
      path: 'pairedDealId',
      select: 'sellerCompanyId',
      populate: {
        path: 'sellerCompanyId',
        select: 'name'
      }
    })
    .sort({ createdAt: -1 });
    
    return res.json(deals);
  } catch (error) {
    console.error('Error getting buyer deals:', error);
    return res.status(500).json({ message: 'Error getting deals', error: error.message });
  }
};

/**
 * Get all seller's deals
 */
exports.getSellerDeals = async (req, res) => {
  try {
    const userId = req.user.userId;
    const isLgdealSupervisor = req.user.isLgdealSupervisor;
    
    // Если пользователь является супервизором LGDEAL, возвращаем все lgdeal-to-seller сделки
    if (isLgdealSupervisor) {
      const lgdealCompany = await Company.findOne({ name: marketplaceConfig.managementCompany.name });
      
      if (!lgdealCompany) {
        return res.status(500).json({ message: 'Management company not found' });
      }
      
      // Для супервизора LGDEAL возвращаем все сделки, где LGDEAL продает (buyer-to-lgdeal)
      const deals = await Deal.find({ 
        sellerCompanyId: lgdealCompany._id,
        dealType: 'buyer-to-lgdeal'
      })
      .populate('products.product')
      .populate('buyerCompanyId', 'name')
      .populate({
        path: 'pairedDealId',
        select: 'sellerCompanyId',
        populate: {
          path: 'sellerCompanyId',
          select: 'name'
        }
      })
      .sort({ createdAt: -1 });
      
      return res.json(deals);
    }
    
    // Получаем компанию пользователя
    const user = await User.findById(userId);
    if (!user || !user.company) {
      return res.status(400).json({ message: 'User or user company not found' });
    }
    
    // Для обычных пользователей ищем сделки, где они или их компания являются продавцом
    const deals = await Deal.find({
      $or: [
        { sellerId: userId },
        { sellerCompanyId: user.company }
      ],
      dealType: 'lgdeal-to-seller'
    })
    .populate('products.product')
    .populate('buyerCompanyId', 'name')
    .populate({
      path: 'pairedDealId',
      select: 'buyerCompanyId',
      populate: {
        path: 'buyerCompanyId',
        select: 'name'
      }
    })
    .sort({ createdAt: -1 });
    
    return res.json(deals);
  } catch (error) {
    console.error('Error getting seller deals:', error);
    return res.status(500).json({ message: 'Error getting deals', error: error.message });
  }
};

exports.getDealById = async (req, res) => {
  try {
    const { dealId } = req.params;
    const userId = req.user.userId;
    const userIsLgdealAdmin = req.user.isLgdealSupervisor;
    
    // Get user's company
    const user = await User.findById(userId);
    if (!user || !user.company) {
      return res.status(400).json({ message: 'User or user company not found' });
    }

    const deal = await Deal.findById(dealId)
      .populate({
        path: 'products.product',
        select: 'shape carat color clarity price company'
      })
      .populate({
        path: 'products.suggestedAlternatives.product',
        select: 'shape carat color clarity price company'
      })
      .populate({
        path: 'products.suggestedAlternatives.pairedLgdealToSellerDealId',
        select: 'status stage dealNumber'
      })
      .populate('buyerId', 'email firstName lastName')
      .populate('sellerId', 'email firstName lastName')
      .populate('buyerCompanyId', 'name')
      .populate('sellerCompanyId', 'name')
      .populate({
        path: 'activityLog.performedBy',
        select: 'email firstName lastName'
      })
      .populate({
        path: 'negotiationDetails.proposedTerms.proposedBy',
        select: 'email firstName lastName'
      });
    
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }

    // Check user's access rights:
    // 1. User is LGDEAL supervisor
    // 2. User is the buyer
    // 3. User's company is the buyer company
    // 4. User is the seller
    // 5. User's company is the seller company
    const hasAccess = 
      userIsLgdealAdmin || 
      (deal.buyerId && deal.buyerId._id.toString() === userId) ||
      (deal.buyerCompanyId && deal.buyerCompanyId._id.toString() === user.company.toString()) ||
      (deal.sellerId && deal.sellerId._id.toString() === userId) ||
      (deal.sellerCompanyId && deal.sellerCompanyId._id.toString() === user.company.toString());

    if (!hasAccess) {
      return res.status(403).json({ message: 'Not authorized to view this deal' });
    }
    
    // Проверяем, прямая ли это сделка LGDEAL (без парной)
    const isDirectLgdealDeal = deal.dealType === 'buyer-to-lgdeal' && !deal.pairedDealIds?.length;
    
    // Determine user's role in this deal
    let userRole = determineUserRole(deal, userId, userIsLgdealAdmin, isDirectLgdealDeal);
    
    // Add user role to response for frontend use
    const response = {
      ...deal.toObject(),
      userRole,
      canEdit: userRole !== 'buyer' || deal.stage === 'request',
      allowedActions: getAllowedActions(deal, userRole, isDirectLgdealDeal),
      isDirectLgdealDeal // Добавляем флаг, указывающий на прямую сделку с LGDEAL
    };
    
    return res.json(response);
  } catch (error) {
    console.error('Error getting deal details:', error);
    return res.status(500).json({ message: 'Error getting deal details', error: error.message });
  }
};

exports.getSupervisorDashboardDeals = async (req, res) => {
  try {
    if (!req.user.isLgdealSupervisor) {
      return res.status(403).json({ message: 'Access denied. Supervisor role required.' });
    }

    const lgdealCompany = await Company.findOne({ name: marketplaceConfig.managementCompany.name });
    if (!lgdealCompany) {
      return res.status(500).json({ message: 'LGDEAL Management company not found' });
    }
    const lgdealCompanyId = lgdealCompany._id;

    let dashboardDeals = [];

    // 1. Get Main Customer Sales (buyer-to-lgdeal where LGDEAL is seller)
    const customerSales = await Deal.find({
      dealType: 'buyer-to-lgdeal',
      sellerCompanyId: lgdealCompanyId
    })
    .populate('buyerCompanyId', 'name')
    .populate('products.product', 'shape carat color clarity price')
    .populate({
        path: 'products.suggestedAlternatives.product', // For checking links later
        select: '_id' 
    })
    .populate({
        path: 'products.suggestedAlternatives.pairedLgdealToSellerDealId', // For checking links later
        select: '_id'
    })
    .sort({ createdAt: -1 })
    .lean(); // Use lean for performance and easy modification

    customerSales.forEach(deal => {
      dashboardDeals.push({
        ...deal,
        dashboardDealType: 'mainCustomerSale',
        // For main sales, counterparty is the buyer
        counterpartyName: deal.buyerCompanyId ? deal.buyerCompanyId.name : 'N/A',
        linkedToDealNumber: null 
      });
    });

    // 2. Get All LGDEAL Supplier Purchases (lgdeal-to-seller where LGDEAL is buyer)
    const supplierPurchases = await Deal.find({
      dealType: 'lgdeal-to-seller',
      buyerCompanyId: lgdealCompanyId
    })
    .populate('sellerCompanyId', 'name')
    .populate('products.product', 'shape carat color clarity price')
    .populate({
      path: 'pairedDealId', // This is the main buyer-to-lgdeal deal
      select: 'dealNumber products.product products.suggestedAlternatives.product products.suggestedAlternatives.pairedLgdealToSellerDealId',
      populate: [ // Nested populate
        { path: 'products.product', select: '_id' },
        { path: 'products.suggestedAlternatives.product', select: '_id' },
        { path: 'products.suggestedAlternatives.pairedLgdealToSellerDealId', select: '_id' }
      ]
    })
    .sort({ createdAt: -1 })
    .lean();

    supplierPurchases.forEach(sDeal => {
      let dashboardDealType = 'standaloneSupplierPurchase'; // Default
      let linkedToDealNumber = null;
      let isPrimary = false;
      let isAlternative = false;

      if (sDeal.pairedDealId && sDeal.products.length > 0) {
        linkedToDealNumber = sDeal.pairedDealId.dealNumber;
        const supplierProductPrimaryId = sDeal.products[0].product?._id?.toString();

        if (supplierProductPrimaryId) {
            // Check if it's for an original product in the paired main deal
            for (const mainProductEntry of sDeal.pairedDealId.products) {
                if (mainProductEntry.product?._id?.toString() === supplierProductPrimaryId) {
                    isPrimary = true;
                    break;
                }
            }

            if (isPrimary) {
                dashboardDealType = 'primarySupplierPurchase';
            } else {
                // Check if it's for a suggested alternative in the paired main deal
                for (const mainProductEntry of sDeal.pairedDealId.products) {
                    if (mainProductEntry.suggestedAlternatives && mainProductEntry.suggestedAlternatives.length > 0) {
                        for (const alt of mainProductEntry.suggestedAlternatives) {
                            if (alt.product?._id?.toString() === supplierProductPrimaryId && 
                                alt.pairedLgdealToSellerDealId?._id?.toString() === sDeal._id?.toString()) {
                                isAlternative = true;
                                break;
                            }
                        }
                    }
                    if (isAlternative) break;
                }
                if (isAlternative) {
                    dashboardDealType = 'alternativeSupplierPurchase';
                }
            }
        }
      }
      
      dashboardDeals.push({
        ...sDeal,
        dashboardDealType,
        // For supplier purchases, counterparty is the seller
        counterpartyName: sDeal.sellerCompanyId ? sDeal.sellerCompanyId.name : 'N/A',
        linkedToDealNumber
      });
    });

    // Sort all deals together by creation date
    dashboardDeals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json(dashboardDeals);

  } catch (error) {
    console.error('Error getting supervisor dashboard deals:', error);
    return res.status(500).json({ message: 'Error getting supervisor dashboard deals', error: error.message });
  }
}; 