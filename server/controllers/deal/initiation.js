const Deal = require('../../models/Deal');
const Product = require('../../models/Product');
const User = require('../../models/User');
const Company = require('../../models/Company');
const Counter = require('../../models/Counter');
const marketplaceConfig = require('../../config/marketplace');
const { findAlternativeProducts } = require('../deal/helpers');

/**
 * Initialize a new deal from cart items
 * This will create:
 * 1. One buyer-to-LGDEAL deal containing all products (100% price)
 * 2. Multiple LGDEAL-to-seller deals grouped by seller (96% price) 
 *    (только для продуктов не из стока LGDEAL)
 */
exports.initiateDealFromCart = async (req, res) => {
  try {
    const buyerId = req.user.userId;
    const { cartItemIds, shippingAddress } = req.body;
    
    if (!cartItemIds || !Array.isArray(cartItemIds) || cartItemIds.length === 0) {
      return res.status(400).json({ message: 'No cart items specified for checkout' });
    }

    // Get buyer's info with cart items
    const buyer = await User.findById(buyerId).populate('cart.items.product');
    if (!buyer || !buyer.company) {
      return res.status(400).json({ message: 'Buyer or buyer company not found' });
    }

    const buyerCompany = await Company.findById(buyer.company);
    if (!buyerCompany) {
      return res.status(400).json({ message: 'Buyer company not found' });
    }

    // Find LGDEAL LLC company (management company)
    const lgdealCompany = await Company.findOne({ name: marketplaceConfig.managementCompany.name });
    if (!lgdealCompany) {
      return res.status(500).json({ message: 'Management company not found' });
    }

    // Group cart items by seller company
    const sellerGroups = new Map(); // Map<sellerId, { company, products, totalAmount }>
    const allProducts = []; // Array to keep track of all products for buyer's deal
    const productIdsInDeal = []; // Array to keep track of all product IDs to mark as onDeal
    const lgdealProducts = []; // Array to keep track of products from LGDEAL inventory
    const alternativeLgdealToSellerDealIds = []; // Moved declaration here
    let totalBuyerAmount = 0;

    // Initialize letterSuffixAlternative for unique deal numbers for alternatives' L2S deals
    let letterSuffixAlternative = 0; // Start with 0 or 'a' if you prefer alpha, ensure it increments correctly
    const buyerDealNumberPlaceholder = "PENDING_BUYER_DEAL_NUMBER"; // Placeholder for notes in alt deals

    // Validate all products first
    for (const cartItemId of cartItemIds) {
      const cartItem = buyer.cart.items.find(item => 
        item._id.toString() === cartItemId
      );

      if (!cartItem || !cartItem.product) {
        return res.status(400).json({ message: `Cart item ${cartItemId} or its product not found` });
      }

      const product = cartItem.product;
      if (!product.price || product.price <= 0) {
        return res.status(400).json({ message: `Invalid price for product ${product._id}` });
      }

      const sellerCompany = await Company.findById(product.company);
      if (!sellerCompany) {
        return res.status(400).json({ message: `Seller company not found for product ${product._id}` });
      }

      const productPrice = product.price;
      totalBuyerAmount += productPrice;

      productIdsInDeal.push(product._id);

      // Ищем альтернативы для КАЖДОГО продукта в корзине
      // Убедимся, что `product` содержит поля, необходимые для findAlternativeProducts (shape, carat, color, clarity)
      const foundAlternatives = await findAlternativeProducts(product); // Returns populated product objects
      
      const alternativesForThisProduct = [];
      // Вспомогательный массив для ID созданных сделок lgdeal-to-seller для альтернатив
      // const alternativeLgdealToSellerDealIds = []; // Removed from here

      for (const altProduct of foundAlternatives) {
        // altProduct УЖЕ должен быть полным объектом продукта из findAlternativeProducts
        if (!altProduct || !altProduct.company) {
          console.warn(`Alternative product ${altProduct?._id} is missing company info, skipping deal creation for it.`);
          alternativesForThisProduct.push({ product: altProduct._id, pairedLgdealToSellerDealId: null });
          continue;
        }

        const altSellerCompany = await Company.findById(altProduct.company);
        if (!altSellerCompany) {
          console.warn(`Seller company not found for alternative product ${altProduct._id}, skipping deal creation.`);
          alternativesForThisProduct.push({ product: altProduct._id, pairedLgdealToSellerDealId: null });
          continue;
        }

        // Find a seller from the alternative product's company
        const altSeller = await User.findOne({ 
          company: altSellerCompany._id,
          role: 'supervisor'
        }) || await User.findOne({
          company: altSellerCompany._id,
          role: 'manager'
        }) || await User.findOne({
          company: altSellerCompany._id,
          isActive: true
        });

        if (!altSeller) {
          console.warn(`No active seller found for company ${altSellerCompany.name} (alternative product ${altProduct._id}), skipping deal creation.`);
          alternativesForThisProduct.push({ product: altProduct._id, pairedLgdealToSellerDealId: null });
          continue;
        }
        
        // Generate deal number for the alternative's lgdeal-to-seller deal
        // We need a more robust way to generate unique deal numbers for these, perhaps a different counter or suffix
        const altLgdealToSellerDealNumber = `${await Counter.getNextValue('sellerDealNumber', 100001, 6)}alts${letterSuffixAlternative++}`;


        const altLgdealToSellerDeal = new Deal({
          dealNumber: altLgdealToSellerDealNumber,
          amount: altProduct.price * 0.96, // LGDEAL buys at 96%
          fee: altProduct.price * 0.96 * 0.04, // 4% fee on the 96% amount
          stage: 'request',
          status: 'pending', // This deal also starts as a request to the alternative's seller
          dealType: 'lgdeal-to-seller',
          buyerId: null, // LGDEAL is buyer
          buyerCompanyId: lgdealCompany._id,
          sellerId: altSeller._id,
          sellerCompanyId: altSellerCompany._id,
          lgdealCompanyId: lgdealCompany._id,
          products: [{ product: altProduct._id, price: altProduct.price * 0.96 }],
          // This pairedDealId points to the main buyer-to-lgdeal deal
          // We might need another field to specify which *product entry* in the main deal this alternative refers to.
          pairedDealId: null, // Placeholder, will be set after main buyer deal is saved
          requestDetails: {
            requestDate: new Date(),
            requestedBy: buyerId, // Initiated by the original buyer's action
            notes: `LGDEAL purchase request for alternative to product in deal ${buyerDealNumberPlaceholder}` 
                   // buyerDealNumberPlaceholder will be replaced later
          },
          shippingDetails: { // Shipping from alternative seller to LGDEAL
            cost: marketplaceConfig.defaultInternalShippingCost || 15.00, 
            shippingAddress: { /* LGDEAL's receiving address */ } 
          },
          activityLog: [{
            action: 'deal_created',
            performedBy: buyerId, // System action triggered by buyer
            details: `System created LGDEAL-to-seller deal for alternative product ${altProduct.shape} ${altProduct.carat}ct.`
          }],
          lastActionAt: Date.now() // Explicitly set on creation
        });
        // Temporary: Fill LGDEAL shipping address for alternative seller deals
        altLgdealToSellerDeal.shippingDetails.shippingAddress = {
            recipient: lgdealCompany.name,
            street: lgdealCompany.details?.shippingAddress?.address || lgdealCompany.details?.legalAddress?.address || '',
            city: lgdealCompany.details?.shippingAddress?.city || lgdealCompany.details?.legalAddress?.city || '',
            state: lgdealCompany.details?.shippingAddress?.region || lgdealCompany.details?.legalAddress?.region || '',
            postalCode: lgdealCompany.details?.shippingAddress?.zipCode || lgdealCompany.details?.legalAddress?.zipCode || '',
            country: lgdealCompany.details?.shippingAddress?.country || lgdealCompany.details?.legalAddress?.country || ''
        };


        try {
          const savedAltLgdealToSellerDeal = await altLgdealToSellerDeal.save();
          alternativesForThisProduct.push({ 
            product: altProduct._id, 
            pairedLgdealToSellerDealId: savedAltLgdealToSellerDeal._id 
          });
          alternativeLgdealToSellerDealIds.push(savedAltLgdealToSellerDeal._id); // Keep track for later update
        } catch (saveError) {
          console.error(`Failed to save lgdeal-to-seller deal for alternative ${altProduct._id}:`, saveError);
          alternativesForThisProduct.push({ product: altProduct._id, pairedLgdealToSellerDealId: null });
        }
      }
      
      allProducts.push({
        product: product._id,
        price: productPrice,
        suggestedAlternatives: alternativesForThisProduct
      });

      // Проверяем, принадлежит ли продукт компании LGDEAL
      const isLgdealProduct = sellerCompany._id.toString() === lgdealCompany._id.toString();
      
      if (isLgdealProduct) {
        // Добавляем продукт LGDEAL в список lgdealProducts для дальнейшей специальной обработки
        lgdealProducts.push({
          productId: product._id,
          price: productPrice,
          originalProductData: product 
        });
        continue; // Пропускаем создание сделки LGDEAL-продавец для этого продукта
      }

      // Для продуктов от других продавцов
      // Find a seller from the company
      const seller = await User.findOne({ 
        company: sellerCompany._id,
        role: 'supervisor'
      }) || await User.findOne({
        company: sellerCompany._id,
        role: 'manager'
      }) || await User.findOne({
        company: sellerCompany._id,
        isActive: true
      });

      if (!seller) {
        return res.status(400).json({ message: `No active seller found for company ${sellerCompany.name}` });
      }

      // Add to seller groups (only for non-LGDEAL products)
      const sellerKey = seller._id.toString();
      if (!sellerGroups.has(sellerKey)) {
        sellerGroups.set(sellerKey, {
          seller,
          company: sellerCompany,
          products: [],
          totalAmount: 0
        });
      }

      const group = sellerGroups.get(sellerKey);
      const sellerProductPrice = productPrice * 0.96; // 96% of original price
      group.products.push({
        product: product._id,
        price: sellerProductPrice
      });
      group.totalAmount += sellerProductPrice;
    }

    // Generate deal number for buyer's deal
    const buyerDealNumber = await Counter.getNextValue('buyerDealNumber', 1, 6);
    
    // Create buyer's deal
    const buyerToLgdealDeal = new Deal({
      dealNumber: buyerDealNumber,
      amount: totalBuyerAmount,
      fee: 0,
      stage: 'request',
      status: 'pending',
      dealType: 'buyer-to-lgdeal',
      buyerId: buyerId,
      buyerCompanyId: buyerCompany._id,
      sellerId: null,
      sellerCompanyId: lgdealCompany._id,
      lgdealCompanyId: lgdealCompany._id,
      products: allProducts,
      requestDetails: {
        requestDate: new Date(),
        requestedBy: buyerId,
        notes: 'Deal initiated from cart checkout'
      },
      shippingDetails: {
        cost: 30.00, // Default shipping cost
        shippingAddress: {
          recipient: buyerCompany.name,
          street: shippingAddress.address,
          city: shippingAddress.city,
          state: shippingAddress.region,
          postalCode: shippingAddress.zipCode,
          country: shippingAddress.country
        }
      },
      activityLog: [{
        action: 'deal_created',
        performedBy: buyerId,
        details: 'Buyer initiated deal for products purchase'
      }],
      lastActionAt: Date.now() // Explicitly set on creation
    });

    const savedBuyerDeal = await buyerToLgdealDeal.save();

    // NOW, update all created lgdeal-to-seller deals (for alternatives) with the ID of the main buyer deal
    if (alternativeLgdealToSellerDealIds.length > 0) {
      await Deal.updateMany(
        { _id: { $in: alternativeLgdealToSellerDealIds } },
        { 
          pairedDealId: savedBuyerDeal._id,
          // Also update the notes with the final buyerDealNumber
          $set: { 
            "requestDetails.notes": `LGDEAL purchase request for alternative to product in deal #${savedBuyerDeal.dealNumber}` 
          }
        }
      );
    }

    // Create seller deals (только для продуктов НЕ из LGDEAL)
    const sellerDeals = [];
    let letterSuffix = 'a';

    for (const [sellerId, group] of sellerGroups) {
      const sellerDealNumber = `${await Counter.getNextValue('sellerDealNumber', 100001, 6)}${letterSuffix}`;
      letterSuffix = String.fromCharCode(letterSuffix.charCodeAt(0) + 1);

      const lgdealToSellerDeal = new Deal({
        dealNumber: sellerDealNumber,
        amount: group.totalAmount,
        fee: group.totalAmount * 0.04, // 4% fee
        stage: 'request',
        status: 'pending',
        dealType: 'lgdeal-to-seller',
        buyerId: null,
        buyerCompanyId: lgdealCompany._id,
        sellerId: group.seller._id,
        sellerCompanyId: group.company._id,
        lgdealCompanyId: lgdealCompany._id,
        products: group.products,
        pairedDealId: savedBuyerDeal._id,
        requestDetails: {
          requestDate: new Date(),
          requestedBy: buyerId,
          notes: 'Deal initiated from cart checkout - seller side'
        },
        shippingDetails: {
          cost: 30.00, // Default shipping cost
          shippingAddress: {
            recipient: lgdealCompany.name,
            street: lgdealCompany.details?.shippingAddress?.address || lgdealCompany.details?.legalAddress?.address || '',
            city: lgdealCompany.details?.shippingAddress?.city || lgdealCompany.details?.legalAddress?.city || '',
            state: lgdealCompany.details?.shippingAddress?.region || lgdealCompany.details?.legalAddress?.region || '',
            postalCode: lgdealCompany.details?.shippingAddress?.zipCode || lgdealCompany.details?.legalAddress?.zipCode || '',
            country: lgdealCompany.details?.shippingAddress?.country || lgdealCompany.details?.legalAddress?.country || ''
          }
        },
        activityLog: [{
          action: 'deal_created',
          performedBy: buyerId,
          details: 'System created seller-side deal'
        }],
        lastActionAt: Date.now() // Explicitly set on creation
      });

      const savedSellerDeal = await lgdealToSellerDeal.save();
      sellerDeals.push(savedSellerDeal._id);
    }

    // Update buyer's deal with paired deals
    if (sellerDeals.length > 0) {
      savedBuyerDeal.pairedDealIds = sellerDeals;
      savedBuyerDeal.lastActionAt = Date.now(); // Update before save
      await savedBuyerDeal.save();
    }

    // Если все продукты из LGDEAL, статус сделки сразу меняем на "negotiation" и "negotiating",
    // так как нет необходимости ждать принятия от продавца (LGDEAL сам является продавцом)
    if (sellerDeals.length === 0 && lgdealProducts.length > 0) {
      savedBuyerDeal.stage = 'negotiation';
      savedBuyerDeal.status = 'negotiating';
      savedBuyerDeal.activityLog.push({
        action: 'stage_changed',
        performedBy: buyerId,
        details: 'Direct LGDEAL purchase - automatically moved to negotiation stage'
      });
      savedBuyerDeal.lastActionAt = Date.now(); // Update before save
      await savedBuyerDeal.save();
    }

    // Mark products as being on deal
    if (productIdsInDeal.length > 0) {
      await Product.updateMany(
        { _id: { $in: productIdsInDeal } },
        { 
          onDeal: true, 
          dealId: savedBuyerDeal._id,
          status: 'OnDeal'
        }
      );
    }

    // Remove items from cart
    buyer.cart.items = buyer.cart.items.filter(item => 
      !cartItemIds.includes(item._id.toString())
    );
    buyer.cart.updatedAt = Date.now();
    await buyer.save();

    return res.status(201).json({
      message: 'Deals initiated successfully',
      buyerDeal: savedBuyerDeal._id,
      sellerDeals: sellerDeals
    });
  } catch (error) {
    console.error('Error initiating deals:', error);
    return res.status(500).json({ message: 'Error initiating deals', error: error.message });
  }
}; 