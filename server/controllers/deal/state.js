const Deal = require('../../models/Deal');
const Product = require('../../models/Product');
const {
  determineUserRole,
  isValidStageTransition,
  isValidStatusTransition,
  processProductsOnDealEnd,
  getAllowedActions
} = require('./helpers');

/**
 * Update deal stage (admin/LGDEAL only)
 */
exports.updateDealStage = async (req, res) => {
  try {
    const { dealId } = req.params;
    const { stage, status, notes, shippingCost, negotiationDetails } = req.body;
    const userId = req.user.userId;
    
    // Find the deal
    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Проверяем, прямая ли это сделка LGDEAL (без парной)
    const isDirectLgdealDeal = deal.dealType === 'buyer-to-lgdeal' && !deal.pairedDealIds?.length;
    
    // Determine user's role
    const userRole = determineUserRole(deal, userId, req.user.isLgdealSupervisor, isDirectLgdealDeal);
    if (!userRole) {
      return res.status(403).json({ message: 'Not authorized to update this deal' });
    }

    // Validate stage transition if stage is being updated
    if (stage && stage !== deal.stage) {
      if (!isValidStageTransition(deal.stage, stage)) {
        return res.status(400).json({ 
          message: `Invalid stage transition from ${deal.stage} to ${stage}` 
        });
      }
    }

    // Validate status transition if status is being updated
    if (status && status !== deal.status) {
      if (!isValidStatusTransition(deal.status, status, stage || deal.stage)) {
        return res.status(400).json({ 
          message: `Invalid status transition from ${deal.status} to ${status} in ${stage || deal.stage} stage` 
        });
      }
    }

    // Update shipping cost if provided and valid
    if (typeof shippingCost === 'number') {
      if (shippingCost < 0) {
        return res.status(400).json({ message: 'Shipping cost cannot be negative' });
      }
      if (!deal.shippingDetails) {
        deal.shippingDetails = {};
      }
      const previousCost = deal.shippingDetails.cost;
      deal.shippingDetails.cost = shippingCost;

      // Add separate log entry for shipping cost change
      deal.activityLog.push({
        action: 'stage_changed',
        performedBy: userId,
        details: `Shipping cost ${previousCost ? 'updated' : 'set'} to $${shippingCost.toFixed(2)}`
      });
    }

    // Special validation for negotiation details
    if (stage === 'payment_delivery' && deal.stage === 'negotiation') {
      // Get current shipping cost from the deal
      const currentShippingCost = deal.shippingDetails?.cost || 0;

      // If moving directly to payment without negotiation, create default terms
      if (!deal.negotiationDetails || !deal.negotiationDetails.proposedTerms || deal.negotiationDetails.proposedTerms.length === 0) {
        const originalProducts = deal.products.map(item => ({
          product: item.product,
          price: item.price,
          originalPrice: item.price,
          discountPercent: 0
        }));

        const totalPrice = originalProducts.reduce((sum, item) => sum + item.price, 0);

        deal.negotiationDetails = {
          startDate: new Date(),
          endDate: new Date(),
          proposedTerms: [{
            proposedBy: userId,
            proposedDate: new Date(),
            price: totalPrice,
            products: originalProducts,
            deliveryTerms: `Standard shipping: $${currentShippingCost}`,
            additionalTerms: 'Original terms accepted without negotiation',
            status: 'accepted',
            shippingCost: currentShippingCost
          }],
          finalTerms: {
            price: totalPrice,
            products: originalProducts,
            deliveryTerms: `Standard shipping: $${currentShippingCost}`,
            additionalTerms: 'Original terms accepted without negotiation',
            acceptedDate: new Date(),
            shippingCost: currentShippingCost
          }
        };
      } else if (negotiationDetails) {
        // If negotiationDetails is provided, validate and use it
        if (!negotiationDetails.finalTerms) {
          return res.status(400).json({ 
            message: 'Final terms are required when moving to payment stage' 
          });
        }

        // Validate final terms
        const { price, products } = negotiationDetails.finalTerms;
        if (typeof price !== 'number' || price <= 0) {
          return res.status(400).json({ message: 'Invalid final price' });
        }

        if (products) {
          for (const product of products) {
            if (typeof product.price !== 'number' || product.price <= 0) {
              return res.status(400).json({ 
                message: `Invalid price for product ${product.product}` 
              });
            }
          }
        }

        // Ensure shipping cost is preserved in negotiation details
        if (!negotiationDetails.finalTerms.shippingCost) {
          negotiationDetails.finalTerms.shippingCost = currentShippingCost;
        }

        deal.negotiationDetails = negotiationDetails;
      } else {
        // Use the last proposal as final terms
        const lastProposal = deal.negotiationDetails.proposedTerms.slice(-1)[0];
        
        deal.negotiationDetails.finalTerms = {
          price: lastProposal.price,
          products: lastProposal.products,
          deliveryTerms: lastProposal.deliveryTerms || `Standard shipping: $${currentShippingCost}`,
          additionalTerms: lastProposal.additionalTerms,
          acceptedDate: new Date(),
          shippingCost: lastProposal.shippingCost || currentShippingCost
        };
      }

      // Always ensure shipping cost is preserved in deal.shippingDetails
      if (!deal.shippingDetails) {
        deal.shippingDetails = {};
      }
      deal.shippingDetails.cost = deal.negotiationDetails.finalTerms.shippingCost;
    }

    // Update deal fields
    if (stage) deal.stage = stage;
    if (status) deal.status = status;
    if (notes) deal.notes = notes;
    
    // Add to activity log with shipping cost information when moving to negotiation stage
    const logDetails = stage === 'negotiation' && deal.stage !== 'negotiation'
      ? `Deal stage changed to ${stage} status changed to ${status} by ${userRole}. Shipping cost set to $${deal.shippingDetails?.cost?.toFixed(2) || '0.00'}`
      : `Deal ${stage ? `stage changed to ${stage}` : ''} ${status ? `status changed to ${status}` : ''} by ${userRole}`;

    deal.activityLog.push({
      action: 'stage_changed',
      performedBy: userId,
      details: logDetails
    });
    
    // Проверяем перевод сделки в статус "completed" или "cancelled"
    // const oldStatus = deal.status; // This was in original, but seems unused after commenting out
    // const oldStage = deal.stage; // This was in original, but seems unused after commenting out
    
    // Сохраняем сделку
    deal.lastActionAt = Date.now();
    await deal.save();
    
    // Обрабатываем продукты при завершении или отмене сделки
    if ((status === 'completed' && stage === 'completed') || status === 'cancelled') {
      await processProductsOnDealEnd(deal, status, userId);
    }
    
    // Return populated deal
    const populatedDeal = await Deal.findById(dealId)
      .populate({
        path: 'products.product',
        select: 'shape carat color clarity price'
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

    // Add user role and allowed actions to response
    const response = {
      message: 'Deal updated successfully',
      deal: {
        ...populatedDeal.toObject(),
        userRole,
        allowedActions: getAllowedActions(populatedDeal, userRole, isDirectLgdealDeal),
        isDirectLgdealDeal
      }
    };
    
    return res.json(response);
  } catch (error) {
    console.error('Error updating deal stage:', error);
    return res.status(500).json({ message: 'Error updating deal stage', error: error.message });
  }
};

/**
 * Confirm delivery and complete deal
 */
exports.confirmDelivery = async (req, res) => {
  try {
    const { dealId } = req.params;
    const userId = req.user.userId;
    
    // Find the deal
    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Check if deal is in the correct stage and status
    if (deal.stage !== 'payment_delivery' || deal.status !== 'shipped') {
      return res.status(400).json({ 
        message: 'Deal is not in the correct stage for confirming delivery' 
      });
    }
    
    // Проверяем, прямая ли это сделка LGDEAL (без парной)
    const isDirectLgdealDeal = deal.dealType === 'buyer-to-lgdeal' && !deal.pairedDealIds?.length;
    
    // Check if user is authorized (buyer of this deal or LGDEAL admin)
    const userIsBuyer = deal.buyerId && deal.buyerId.toString() === userId;
    const userIsLgdealAdmin = req.user.isLgdealSupervisor;
    const isLgdealBuyerRole = userIsLgdealAdmin && deal.dealType === 'lgdeal-to-seller';
    
    // Для прямых сделок LGDEAL администратор LGDEAL может подтверждать доставку самостоятельно
    const canConfirmDirectLgdeal = isDirectLgdealDeal && userIsLgdealAdmin;
    
    if (!userIsBuyer && !isLgdealBuyerRole && !canConfirmDirectLgdeal) {
      return res.status(403).json({ 
        message: 'Not authorized to confirm delivery for this deal' 
      });
    }
    
    // Update deal status
    deal.stage = 'completed';
    deal.status = 'completed';
    
    // Add delivery confirmation details
    if (!deal.deliveryDetails) {
      deal.deliveryDetails = {}; // Should this be shippingDetails?
    }
    
    // It seems deliveryDetails might be legacy. Let's ensure shippingDetails is also updated if used.
    deal.deliveryDetails.deliveredDate = new Date();
    deal.deliveryDetails.confirmedBy = userId;
    // If shippingDetails is the preferred structure, update it as well:
    if (deal.shippingDetails) {
        deal.shippingDetails.deliveredDate = new Date();
        deal.shippingDetails.deliveryConfirmedBy = userId;
    } else {
        deal.shippingDetails = {
            deliveredDate: new Date(),
            deliveryConfirmedBy: userId
        };
    }
    
    // Определяем роль пользователя для логирования
    let userRoleLogging = 'buyer';
    if (isDirectLgdealDeal && userIsLgdealAdmin) {
      userRoleLogging = 'LGDEAL dual-role';
    } else if (isLgdealBuyerRole) {
      userRoleLogging = 'LGDEAL buyer';
    }
    
    // Add to activity log
    deal.activityLog.push({
      action: 'delivery_confirmed',
      performedBy: userId,
      details: `${userRoleLogging} confirmed delivery and completed the deal`
    });
    
    deal.lastActionAt = Date.now();
    await deal.save();

    // If the main deal is buyer-to-lgdeal and completed, complete paired lgdeal-to-seller deals
    if (deal.dealType === 'buyer-to-lgdeal' && deal.status === 'completed' && deal.pairedDealIds && deal.pairedDealIds.length > 0) {
      for (const pairedDealId of deal.pairedDealIds) {
        const pairedSellerDeal = await Deal.findById(pairedDealId);
        if (pairedSellerDeal && pairedSellerDeal.status !== 'completed' && pairedSellerDeal.status !== 'cancelled') {
          pairedSellerDeal.stage = 'completed';
          pairedSellerDeal.status = 'completed';
          pairedSellerDeal.completedAt = Date.now();
          pairedSellerDeal.activityLog.push({
            action: 'deal_completed',
            performedBy: userId, // System action triggered by user confirming main deal
            details: 'Paired deal automatically completed as main deal was delivered and confirmed.'
          });
          pairedSellerDeal.lastActionAt = Date.now(); // Update lastActionAt for the paired deal
          await pairedSellerDeal.save();
        }
      }
    }
    
    // Process products - mark as sold and add to blacklist
    await processProductsOnDealEnd(deal, 'completed', userId);
    
    // Return updated deal
    const populatedDeal = await Deal.findById(dealId)
      .populate({
        path: 'products.product',
        select: 'shape carat color clarity price'
      })
      .populate('buyerId', 'email firstName lastName')
      .populate('sellerId', 'email firstName lastName')
      .populate('buyerCompanyId', 'name')
      .populate('sellerCompanyId', 'name')
      .populate({
        path: 'activityLog.performedBy',
        select: 'email firstName lastName'
      });
    
    // Determine user role for response
    const responseUserRole = determineUserRole(populatedDeal, userId, req.user.isLgdealSupervisor, isDirectLgdealDeal);
    
    return res.json({
      message: 'Delivery confirmed and deal completed successfully',
      deal: {
        ...populatedDeal.toObject(),
        userRole: responseUserRole,
        allowedActions: getAllowedActions(populatedDeal, responseUserRole, isDirectLgdealDeal),
        isDirectLgdealDeal
      }
    });
  } catch (error) {
    console.error('Error confirming delivery:', error);
    return res.status(500).json({ 
      message: 'Error confirming delivery', 
      error: error.message 
    });
  }
};

// Новый контроллер для выбора альтернативного продукта
exports.selectAlternativeProduct = async (req, res) => {
  try {
    const { dealId, originalProductId, alternativeProductId } = req.params;
    const userId = req.user.userId;

    if (!req.user.isLgdealSupervisor) {
      return res.status(403).json({ message: 'Only LGDEAL Supervisors can select alternative products.' });
    }

    const deal = await Deal.findById(dealId).populate('products.product').populate('products.suggestedAlternatives.product');
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }

    if (deal.dealType !== 'buyer-to-lgdeal') {
        return res.status(400).json({ message: 'Alternative products can only be selected for buyer-to-lgdeal deals.' });
    }

    const productEntry = deal.products.find(p => p.product._id.toString() === originalProductId);
    if (!productEntry) {
      return res.status(404).json({ message: 'Original product not found in this deal.' });
    }

    const alternativeSuggestion = productEntry.suggestedAlternatives.find(
      alt => alt.product && alt.product._id.toString() === alternativeProductId
    );

    if (!alternativeSuggestion || !alternativeSuggestion.product) {
      return res.status(404).json({ message: 'Selected alternative product is not a valid suggestion for this item.' });
    }
    
    const alternativeProductDetails = await Product.findById(alternativeProductId);
    if (!alternativeProductDetails) {
        return res.status(404).json({ message: 'Alternative product details not found.' });
    }

    // Mark original product and set selected alternative
    productEntry.originalProductStruckOut = true;
    productEntry.selectedAlternativeProduct = alternativeProductId;
    
    // Store the original price before updating
    productEntry.originalPriceBeforeSwap = productEntry.price;

    // Update price of this item in the deal to the alternative product's price
    productEntry.price = alternativeProductDetails.price;

    // Recalculate total deal amount
    deal.amount = deal.products.reduce((total, p) => total + p.price, 0);
    
    // Add to activity log
    const originalProductName = `${productEntry.product.shape} ${productEntry.product.carat}ct`;
    const alternativeProductName = `${alternativeProductDetails.shape} ${alternativeProductDetails.carat}ct`;
    deal.activityLog.push({
      action: 'stage_changed', // Or a new more specific action like 'product_substituted'
      performedBy: userId,
      details: `LGDEAL Manager replaced product ${originalProductName} with ${alternativeProductName}. New price for item: $${productEntry.price.toFixed(2)}. New deal total: $${deal.amount.toFixed(2)}.`
    });

    deal.lastActionAt = Date.now();
    await deal.save();

    // --- Автоматическая отмена связанных сделок --- //
    const idsToCancel = [];

    // 1. Найти и добавить ID сделки lgdeal-to-seller для ОРИГИНАЛЬНОГО замененного продукта
    //    (Если оригинальный продукт не был от LGDEAL изначально)
    if (deal.pairedDealIds && deal.pairedDealIds.length > 0) {
      const originalLgdealToSellerDeal = await Deal.findOne({
        _id: { $in: deal.pairedDealIds }, // Ищем среди парных сделок основной buyer-to-lgdeal сделки
        "products.0.product": productEntry.product._id // Где первый продукт совпадает с оригинальным
      });
      if (originalLgdealToSellerDeal && originalLgdealToSellerDeal.status !== 'cancelled' && originalLgdealToSellerDeal.status !== 'completed') {
        idsToCancel.push(originalLgdealToSellerDeal._id);
      }
    }

    // 2. Найти и добавить ID сделок lgdeal-to-seller для НЕВЫБРАННЫХ альтернатив
    if (productEntry.suggestedAlternatives && productEntry.suggestedAlternatives.length > 0) {
      for (const altSuggestion of productEntry.suggestedAlternatives) {
        if (altSuggestion.product && altSuggestion.product._id.toString() !== alternativeProductId && altSuggestion.pairedLgdealToSellerDealId) {
          // Проверим статус этой сделки перед добавлением в список на отмену
          const suggestedDeal = await Deal.findById(altSuggestion.pairedLgdealToSellerDealId);
          if (suggestedDeal && suggestedDeal.status !== 'cancelled' && suggestedDeal.status !== 'completed') {
            idsToCancel.push(altSuggestion.pairedLgdealToSellerDealId);
          }
        }
      }
    }
    
    if (idsToCancel.length > 0) {
      const uniqueIdsToCancel = [...new Set(idsToCancel)]; // Убираем дубликаты на всякий случай
      
      await Deal.updateMany(
        { _id: { $in: uniqueIdsToCancel } },
        {
          $set: {
            stage: 'cancelled',
            status: 'cancelled',
            updatedAt: new Date(),
            "requestDetails.rejectionReason": `Automatically cancelled due to alternative selection in parent deal ${deal.dealNumber}`
          },
          $push: {
            activityLog: {
              action: 'deal_cancelled',
              performedBy: userId, // System action initiated by LGDEAL manager
              timestamp: new Date(),
              details: `Deal automatically cancelled as an alternative product was chosen in the main buyer deal ${deal.dealNumber}.`
            }
          }
        }
      );
      console.log(`Automatically cancelled ${uniqueIdsToCancel.length} associated lgdeal-to-seller deals.`);
    }
    // --- Конец автоматической отмены --- //

    // Populate again for response
    const populatedDeal = await Deal.findById(dealId)
      .populate({
        path: 'products.product',
        select: 'shape carat color clarity price company'
      })
      .populate({
        path: 'products.suggestedAlternatives.product',
        select: 'shape carat color clarity price company'
      })
      .populate({ // Populate the newly selected alternative product
        path: 'products.selectedAlternativeProduct',
        select: 'shape carat color clarity price company'
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
      
    // Determine user role for response
    const isDirectLgdealDeal = populatedDeal.dealType === 'buyer-to-lgdeal' && (!populatedDeal.pairedDealIds || populatedDeal.pairedDealIds.length === 0);
    const userRole = determineUserRole(populatedDeal, userId, req.user.isLgdealSupervisor, isDirectLgdealDeal);

    return res.json({
      message: 'Alternative product selected and deal updated.',
      deal: {
        ...populatedDeal.toObject(),
        userRole,
        allowedActions: getAllowedActions(populatedDeal, userRole, isDirectLgdealDeal),
        isDirectLgdealDeal
      }
    });

  } catch (error) {
    console.error('Error selecting alternative product:', error);
    if (error.name === 'ValidationError') {
        console.error('Validation Errors:', error.errors);
    }
    return res.status(500).json({ message: 'Error selecting alternative product', error: error.message });
  }
}; 