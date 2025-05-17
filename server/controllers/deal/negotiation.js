const Deal = require('../../models/Deal');
const { determineUserRole } = require('./helpers');

/**
 * Submit a negotiation proposal
 */
exports.submitNegotiationProposal = async (req, res) => {
  try {
    const { dealId } = req.params;
    const { price, deliveryTerms, additionalTerms, shippingCost } = req.body;
    const userId = req.user.userId;
    
    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Validate deal stage
    if (deal.stage !== 'negotiation') {
      return res.status(400).json({ 
        message: `Cannot submit proposal when deal is in ${deal.stage} stage` 
      });
    }

    // Validate deal status for new proposals
    const validStatusesForNewProposal = ['negotiating', 'terms_proposed', 'seller_counter_offer'];
    if (!validStatusesForNewProposal.includes(deal.status)) {
      return res.status(400).json({ 
        message: `Cannot submit proposal when deal status is ${deal.status}` 
      });
    }
    
    // Проверяем, прямая ли это сделка LGDEAL (без парной)
    const isDirectLgdealDeal = deal.dealType === 'buyer-to-lgdeal' && !deal.pairedDealIds?.length;
    
    // Check if user is authorized
    const userIsBuyer = deal.buyerId && deal.buyerId.toString() === userId;
    const userIsSeller = deal.sellerId && deal.sellerId.toString() === userId;
    const userIsLgdealAdmin = req.user.isLgdealSupervisor;
    
    // Special case for LGDEAL admin acting as seller in buyer-to-lgdeal deals
    const isLgdealSellerRole = userIsLgdealAdmin && deal.dealType === 'buyer-to-lgdeal' && !isDirectLgdealDeal;
    
    // Special case for LGDEAL admin acting as buyer in lgdeal-to-seller deals
    const isLgdealBuyerRole = userIsLgdealAdmin && deal.dealType === 'lgdeal-to-seller';
    
    // Special case for direct LGDEAL deals
    const isLgdealDualRole = isDirectLgdealDeal && userIsLgdealAdmin;
    
    if (!userIsBuyer && !userIsSeller && !isLgdealSellerRole && !isLgdealBuyerRole && !isLgdealDualRole) {
      return res.status(403).json({ message: 'Not authorized to submit proposals for this deal' });
    }

    // Get user role for logging
    let userRole = determineUserRole(deal, userId, userIsLgdealAdmin, isDirectLgdealDeal); // Used helper here
        
    // Initialize negotiation details if not exist
    if (!deal.negotiationDetails) {
      deal.negotiationDetails = {
        startDate: new Date(),
        proposedTerms: []
      };
    }

    // Validate total price
    if (typeof price !== 'number' || price <= 0) {
      return res.status(400).json({ message: 'Invalid total price' });
    }

    // Calculate total discount
    const originalTotal = deal.products.reduce((sum, item) => sum + item.price, 0);
    const totalDiscountPercent = ((originalTotal - price) / originalTotal) * 100;
    
    // Validate total discount
    const maxDiscount = userIsLgdealAdmin ? 30 : 20;
    if (totalDiscountPercent > maxDiscount) {
      return res.status(400).json({ 
        message: `Total discount of ${totalDiscountPercent.toFixed(1)}% exceeds maximum allowed ${maxDiscount}%` 
      });
    }

    // Calculate individual product prices proportionally
    const discountRatio = price / originalTotal;
    const proposedProducts = deal.products.map(item => ({
      product: item.product,
      price: item.price * discountRatio,
      originalPrice: item.price,
      discountPercent: totalDiscountPercent
    }));

    // Validate shipping cost if provided
    if (typeof shippingCost === 'number' && shippingCost < 0) {
      return res.status(400).json({ message: 'Shipping cost cannot be negative' });
    }
    
    // Create the proposal
    const proposal = {
      proposedBy: userId,
      proposedDate: new Date(),
      price: price,
      products: proposedProducts,
      deliveryTerms,
      additionalTerms,
      status: 'proposed',
      shippingCost: typeof shippingCost === 'number' ? shippingCost : deal.shippingDetails?.cost
    };
    
    // Add proposal to deal
    deal.negotiationDetails.proposedTerms.push(proposal);
    
    // Update deal status based on who made the proposal
    if (userIsBuyer || isLgdealBuyerRole) {
      deal.status = 'terms_proposed';
    } else if (userIsSeller || isLgdealSellerRole) {
      // Check if seller is maintaining original prices
      const isOriginalPrice = additionalTerms && 
        (additionalTerms.includes('maintains original price') || 
         additionalTerms.includes('no negotiation'));
      
      deal.status = isOriginalPrice ? 'seller_final_offer' : 'seller_counter_offer';
    } else if (isLgdealDualRole) {
      // Для прямых сделок LGDEAL, выбираем статус в зависимости от контекста
      if (deal.status === 'negotiating' || deal.status === 'terms_proposed') {
        // Если админ LGDEAL отвечает на предложение покупателя, это counter offer
        const isOriginalPrice = additionalTerms && 
          (additionalTerms.includes('maintains original price') || 
           additionalTerms.includes('no negotiation'));
        
        deal.status = isOriginalPrice ? 'seller_final_offer' : 'seller_counter_offer';
      } else {
        // Если админ LGDEAL делает первое предложение, это terms_proposed
        deal.status = 'terms_proposed';
      }
    }
    
    // Add to activity log
    deal.activityLog.push({
      action: 'terms_proposed',
      performedBy: userId,
      details: `New terms proposed by ${userRole}: ${totalDiscountPercent.toFixed(1)}% total discount${
        typeof shippingCost === 'number' ? `, Shipping $${shippingCost}` : ''
      }`
    });
    
    deal.lastActionAt = Date.now(); // Update lastActionAt
    await deal.save();
    
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
        path: 'negotiationDetails.proposedTerms.proposedBy',
        select: 'email firstName lastName'
      });
    
    return res.json({
      message: 'Negotiation proposal submitted successfully',
      deal: populatedDeal,
      isDirectLgdealDeal // Добавляем флаг для информирования фронтенда
    });
  } catch (error) {
    console.error('Error submitting negotiation proposal:', error);
    return res.status(500).json({ message: 'Error submitting proposal', error: error.message });
  }
};

/**
 * Accept negotiation terms
 */
exports.acceptNegotiationTerms = async (req, res) => {
  try {
    const { dealId, proposalIndex } = req.params;
    const userId = req.user.userId;
    
    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Make sure deal is in negotiation stage
    if (deal.stage !== 'negotiation') {
      return res.status(400).json({ message: 'Deal is not in negotiation stage' });
    }
    
    // Check if negotiation details and proposal exist
    if (!deal.negotiationDetails || 
        !deal.negotiationDetails.proposedTerms || 
        !deal.negotiationDetails.proposedTerms[proposalIndex]) {
      return res.status(404).json({ message: 'Proposal not found' });
    }
    
    const proposal = deal.negotiationDetails.proposedTerms[proposalIndex];
    
    // Проверяем, прямая ли это сделка LGDEAL (без парной)
    const isDirectLgdealDeal = deal.dealType === 'buyer-to-lgdeal' && !deal.pairedDealIds?.length;
    
    // Check if user is authorized (should be the counterparty, not the proposer)
    const proposerId = proposal.proposedBy.toString();
    const userIsBuyer = deal.buyerId && deal.buyerId.toString() === userId;
    const userIsSeller = deal.sellerId && deal.sellerId.toString() === userId;
    const userIsLgdealAdmin = req.user.isLgdealSupervisor;
    
    // Special case: LGDEAL supervisors can act as sellers for buyer-to-lgdeal deals
    const isLgdealSellerRole = userIsLgdealAdmin && deal.dealType === 'buyer-to-lgdeal' && !isDirectLgdealDeal;
    
    // Special case: LGDEAL supervisors can act as buyers for lgdeal-to-seller deals
    const isLgdealBuyerRole = userIsLgdealAdmin && deal.dealType === 'lgdeal-to-seller';
    
    // Special case: Для прямых сделок LGDEAL администратор может одобрить свое же предложение
    const isDualRoleLgdeal = isDirectLgdealDeal && userIsLgdealAdmin;
    
    // User cannot accept their own proposal and must be part of the deal
    // Исключение: для прямых сделок LGDEAL администратор может принять свое предложение
    const isProposer = proposerId === userId;
    const isPartOfDeal = userIsBuyer || userIsSeller || isLgdealSellerRole || isLgdealBuyerRole || isDualRoleLgdeal;
    const canAcceptOwnProposal = isDualRoleLgdeal && isProposer;
    
    if ((isProposer && !canAcceptOwnProposal) || !isPartOfDeal) {
      return res.status(403).json({ message: 'Not authorized to accept this proposal' });
    }
    
    // Update proposal status
    proposal.status = 'accepted';
    deal.negotiationDetails.proposedTerms[proposalIndex] = proposal;
    
    // Set final terms
    deal.negotiationDetails.finalTerms = {
      price: proposal.price,
      products: proposal.products,
      deliveryTerms: proposal.deliveryTerms,
      additionalTerms: proposal.additionalTerms,
      acceptedDate: new Date(),
      shippingCost: proposal.shippingCost || deal.shippingDetails?.cost || 0
    };
    
    // If proposal has a shipping cost, update the deal's shipping cost
    const finalShippingCost = proposal.shippingCost || deal.shippingDetails?.cost || 0;
    if (!deal.shippingDetails) {
      deal.shippingDetails = {};
    }
    deal.shippingDetails.cost = finalShippingCost;
    
    deal.negotiationDetails.endDate = new Date();
    
    // Автоматически переходим на стадию payment_delivery и статус awaiting_invoice
    deal.stage = 'payment_delivery';
    deal.status = 'awaiting_invoice';
    
    // Определяем кто принял условия для лога
    let acceptedBy = determineUserRole(deal, userId, userIsLgdealAdmin, isDirectLgdealDeal); // Used helper
    if(acceptedBy === 'LGDEAL dual-role') acceptedBy = 'LGDEAL administrator (dual role)';
    else if (acceptedBy === 'LGDEAL buyer'); // No change needed
    else if (acceptedBy === 'LGDEAL seller'); // No change needed
    else if (acceptedBy === 'buyer') acceptedBy = 'Buyer';
    else if (acceptedBy === 'seller') acceptedBy = 'Seller';
    else acceptedBy = 'Unknown'; // Fallback
        
    console.log(`Deal ${dealId}: ${acceptedBy} accepted terms, moving to payment stage`);
    
    // Add to activity log
    deal.activityLog.push({
      action: 'terms_accepted',
      performedBy: userId,
      details: `Terms accepted by ${acceptedBy}: Price $${proposal.price}${typeof proposal.shippingCost === 'number' ? `, Shipping $${proposal.shippingCost}` : ''}, moving to payment stage`
    });
    
    deal.lastActionAt = Date.now(); // Update lastActionAt for the main deal
    await deal.save();
    
    // If this deal is an lgdeal-to-seller and its terms are accepted by LGDEAL (buyer),
    // and it's paired with a buyer-to-lgdeal deal, update the paired deal status as well.
    if (deal.dealType === 'lgdeal-to-seller' && userRole === 'Buyer' && deal.pairedDealId) {
      const pairedBuyerDeal = await Deal.findById(deal.pairedDealId);
      if (pairedBuyerDeal) {
        // Logic to check if the buyer-to-lgdeal deal should also progress
        // This might involve checking if all paired seller deals are accepted, etc.
        // For now, a simple status update example:
        pairedBuyerDeal.status = 'negotiating'; // Or a specific status indicating supplier terms accepted
        pairedBuyerDeal.activityLog.push({
          action: 'status_changed',
          performedBy: userId, // System action triggered by LGDEAL user
          details: `Terms for paired supplier deal ${deal.dealNumber} accepted by LGDEAL.`
        });
        pairedBuyerDeal.lastActionAt = Date.now(); // Update lastActionAt for the paired deal
        await pairedBuyerDeal.save();
      }
    }
    
    // Return full deal details to ensure client gets the latest status
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
        path: 'negotiationDetails.proposedTerms.proposedBy',
        select: 'email firstName lastName'
      });
    
    console.log(`Deal ${dealId} populated deal after accepting terms:`, {
      status: populatedDeal.status,
      stage: populatedDeal.stage,
      buyerId: populatedDeal.buyerId ? (populatedDeal.buyerId._id || populatedDeal.buyerId) : 'none',
      sellerId: populatedDeal.sellerId ? (populatedDeal.sellerId._id || populatedDeal.sellerId) : 'none',
      proposedTermsCount: populatedDeal.negotiationDetails?.proposedTerms?.length || 0,
      hasFinaTerms: !!populatedDeal.negotiationDetails?.finalTerms,
      isDirectLgdealDeal
    });
    
    return res.json({
      message: 'Negotiation terms accepted successfully, moved to payment stage',
      deal: populatedDeal,
      isDirectLgdealDeal
    });
  } catch (error) {
    console.error('Error accepting negotiation terms:', error);
    return res.status(500).json({ message: 'Error accepting terms', error: error.message });
  }
}; 