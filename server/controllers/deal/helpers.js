const Product = require('../../models/Product');
const BlacklistedCertificate = require('../../models/BlacklistedCertificate');

// Placeholder for deal helper functions
module.exports = {};

// Helper function to determine LGDEAL roles
const determineLgdealRole = (deal, userIsLgdealAdmin) => {
  if (!userIsLgdealAdmin) return null;
  
  if (deal.dealType === 'buyer-to-lgdeal') {
    return 'seller'; // LGDEAL acts as seller
  } else if (deal.dealType === 'lgdeal-to-seller') {
    return 'buyer'; // LGDEAL acts as buyer
  }
  
  return null;
};

// Helper function to determine user's role in a deal
const determineUserRole = (deal, userId, userIsLgdealAdmin, isDirectLgdealDeal = false) => {
  const userIsBuyer = deal.buyerId && deal.buyerId.toString() === userId;
  const userIsSeller = deal.sellerId && deal.sellerId.toString() === userId;
  
  // Для прямых сделок LGDEAL (без парных сделок)
  if (isDirectLgdealDeal && userIsLgdealAdmin) {
    return 'LGDEAL dual-role';
  }
  
  // Стандартное определение роли
  const lgdealRole = determineLgdealRole(deal, userIsLgdealAdmin);
  
  if (userIsBuyer) return 'buyer';
  if (userIsSeller) return 'seller';
  if (lgdealRole) return `LGDEAL ${lgdealRole}`;
  
  return null;
};

// Helper function to validate deal stage transition
const isValidStageTransition = (currentStage, newStage) => {
  const stageOrder = ['request', 'negotiation', 'payment_delivery', 'completed', 'cancelled'];
  
  // Special case: can always move to cancelled
  if (newStage === 'cancelled') return true;
  
  const currentIndex = stageOrder.indexOf(currentStage);
  const newIndex = stageOrder.indexOf(newStage);
  
  // Can only move forward in stages (except for cancelled)
  return newIndex > currentIndex;
};

// Helper function to validate deal status transition
const isValidStatusTransition = (currentStatus, newStatus, stage) => {
  // If the new status is 'cancelled', it should generally be allowed,
  // especially if the target stage is also 'cancelled'.
  // The stage transition logic (isValidStageTransition) already handles if 'cancelled' stage is reachable.
  if (newStatus === 'cancelled') {
    return true;
  }

  const validTransitions = {
    request: {
      allowed: ['pending', 'approved', 'rejected', 'cancelled'],
      transitions: {
        'pending': ['approved', 'rejected', 'cancelled'], // Allow cancelling from pending
        'approved': [],
        'rejected': []
      }
    },
    negotiation: {
      negotiating: ['terms_proposed', 'seller_counter_offer', 'seller_final_offer', 'cancelled', 'awaiting_invoice'],
      terms_proposed: ['seller_counter_offer', 'seller_final_offer', 'awaiting_invoice', 'cancelled'],
      seller_counter_offer: ['terms_proposed', 'awaiting_invoice', 'cancelled'],
      seller_final_offer: ['awaiting_invoice', 'cancelled']
    },
    payment_delivery: {
      awaiting_invoice: ['invoice_pending', 'cancelled'],
      invoice_pending: ['awaiting_invoice', 'awaiting_payment', 'cancelled'],
      awaiting_payment: ['payment_received', 'cancelled'],
      payment_received: ['shipped', 'cancelled'],
      shipped: ['completed', 'cancelled']
    },
    completed: {
      completed: []
    },
    cancelled: {
      allowed: ['cancelled'],
      transitions: {
        // Technically, once cancelled, it shouldn't transition further.
        // However, if we want to allow setting status to 'cancelled' when stage becomes 'cancelled'
        // from various previous statuses:
        'pending': ['cancelled'],
        'approved': ['cancelled'],
        'rejected': ['cancelled'],
        'negotiating': ['cancelled'],
        'terms_proposed': ['cancelled'],
        'terms_accepted': ['cancelled'],
        'seller_counter_offer': ['cancelled'],
        'seller_final_offer': ['cancelled'],
        'awaiting_payment': ['cancelled'],
        'payment_received': ['cancelled'],
        'payment_verified': ['cancelled'],
        'awaiting_shipping': ['cancelled'],
        'shipped': ['cancelled'],
        'delivered': ['cancelled'],
        'awaiting_invoice': ['cancelled'],
        'invoice_pending': ['cancelled']
      }
    }
  };
  
  // Special case: if we're moving from negotiation to payment_delivery stage
  if (stage === 'payment_delivery' && 
      (currentStatus === 'terms_proposed' || 
       currentStatus === 'seller_counter_offer' || 
       currentStatus === 'seller_final_offer' || 
       currentStatus === 'negotiating')) {
    return newStatus === 'awaiting_invoice';
  }
  
  // Special case: if we're moving from request to negotiation stage
  if (stage === 'negotiation' && currentStatus === 'pending') {
    return newStatus === 'negotiating';
  }
  
  return validTransitions[stage]?.[currentStatus]?.includes(newStatus) || false;
};

/**
 * Обработка продуктов при завершении или отмене сделки
 * @param {Object} deal - Объект сделки
 * @param {String} status - Новый статус сделки ('completed' или 'cancelled')
 * @param {String} userId - ID пользователя, который выполняет действие
 */
const processProductsOnDealEnd = async (deal, status, userId) => {
  try {
    // Получаем все ID продуктов в сделке
    const productIds = deal.products.map(p => p.product);
    
    // Получаем информацию о продуктах
    const products = await Product.find({ _id: { $in: productIds } });
    
    // Формируем записи для черного списка
    const blacklistEntries = [];
    for (const product of products) {
      // Пропускаем продукты без номера сертификата
      if (!product.certificateNumber) continue;
      
      blacklistEntries.push({
        certificateNumber: product.certificateNumber.toString(),
        reason: status === 'completed' ? 'product_sold' : 'deal_cancelled',
        dealId: deal._id,
        addedBy: userId
      });
    }
    
    // Если сделка завершена успешно, помечаем продукты как проданные
    if (status === 'completed') {
      await Product.updateMany(
        { _id: { $in: productIds } },
        { status: 'Sold' }
      );
    } 
    // Если сделка отменена, удаляем продукты из системы
    else if (status === 'cancelled') {
      await Product.deleteMany({ _id: { $in: productIds } });
    }
    
    // Добавляем записи в черный список сертификатов, если они есть
    if (blacklistEntries.length > 0) {
      // Используем insertMany с опцией для игнорирования дубликатов
      await BlacklistedCertificate.insertMany(blacklistEntries, { 
        ordered: false // Продолжать вставку при дубликатах
      }).catch(err => {
        // Игнорируем ошибки дубликатов, но логируем другие ошибки
        if (!err.writeErrors || !err.writeErrors.every(e => e.code === 11000)) {
          console.error('Error adding certificates to blacklist:', err);
        }
      });
    }
  } catch (error) {
    console.error('Error processing products on deal end:', error);
    // Продолжаем выполнение, чтобы не блокировать процесс завершения сделки
  }
};

// Helper function to determine allowed actions based on deal state and user role
const getAllowedActions = (deal, userRole, isDirectLgdealDeal = false) => {
  const actions = new Set();
  
  // Для прямых сделок с LGDEAL (когда LGDEAL является и продавцом и покупателем)
  if (isDirectLgdealDeal && userRole === 'LGDEAL dual-role') {
    switch (deal.stage) {
      case 'request':
        actions.add('approve_request');
        actions.add('reject_request');
        actions.add('cancel_deal');
        break;
        
      case 'negotiation':
        actions.add('submit_proposal');
        actions.add('counter_offer');
        actions.add('accept_terms');
        actions.add('move_to_payment');
        actions.add('cancel_deal');
        break;
        
      case 'payment_delivery':
        if (deal.status === 'awaiting_invoice') {
          actions.add('upload_invoice');
        }
        if (deal.status === 'invoice_pending') {
          actions.add('accept_invoice');
          actions.add('reject_invoice');
        }
        if (deal.status === 'awaiting_payment') {
          actions.add('confirm_payment');
        }
        if (deal.status === 'payment_received') {
          actions.add('add_tracking');
        }
        if (deal.status === 'shipped') {
          actions.add('confirm_delivery');
        }
        if (deal.status !== 'shipped') {
          actions.add('cancel_deal');
        }
        break;
    }
    return Array.from(actions);
  }
  
  // Стандартная логика для обычных сделок
  switch (deal.stage) {
    case 'request':
      if (userRole === 'seller' || userRole === 'LGDEAL seller') {
        actions.add('approve_request');
        actions.add('reject_request');
      }
      actions.add('cancel_deal');
      break;
      
    case 'negotiation':
      if (userRole === 'buyer' || userRole === 'LGDEAL buyer') {
        actions.add('submit_proposal');
        actions.add('accept_terms');
        actions.add('move_to_payment');
      }
      if (userRole === 'seller' || userRole === 'LGDEAL seller') {
        actions.add('counter_offer');
        actions.add('reject_negotiation');
        actions.add('accept_terms');
      }
      actions.add('cancel_deal');
      break;
      
    case 'payment_delivery':
      if (deal.status === 'awaiting_invoice' && 
          (userRole === 'seller' || userRole === 'LGDEAL seller')) {
        actions.add('upload_invoice');
      }
      if (deal.status === 'invoice_pending' && 
          (userRole === 'buyer' || userRole === 'LGDEAL buyer')) {
        actions.add('accept_invoice');
        actions.add('reject_invoice');
      }
      if (deal.status === 'awaiting_payment' && 
          (userRole === 'seller' || userRole === 'LGDEAL seller')) {
        actions.add('confirm_payment');
      }
      if (deal.status === 'payment_received' && 
          (userRole === 'seller' || userRole === 'LGDEAL seller')) {
        actions.add('add_tracking');
      }
      if (deal.status === 'shipped' && 
          (userRole === 'buyer' || userRole === 'LGDEAL buyer')) {
        actions.add('confirm_delivery');
      }
      if (deal.status !== 'shipped') {
        actions.add('cancel_deal');
      }
      break;
  }
  
  return Array.from(actions);
};

const COLOR_GRADES = ['D', 'E', 'F', 'G'];

const getColorSearchCriteria = (primaryColor) => {
  const index = COLOR_GRADES.indexOf(primaryColor.toUpperCase());
  if (index === -1) {
    return [primaryColor]; // Should not happen with valid data, but as a fallback
  }
  const criteria = [COLOR_GRADES[index]];
  if (index > 0) {
    criteria.push(COLOR_GRADES[index - 1]); // Previous color
  }
  if (index < COLOR_GRADES.length - 1) {
    criteria.push(COLOR_GRADES[index + 1]); // Next color
  }
  return criteria;
};

const findAlternativeProducts = async (primaryProduct, limit = 3) => {
  if (!primaryProduct) {
    return [];
  }

  const colorCriteria = getColorSearchCriteria(primaryProduct.color);
  const weightLowerBound = primaryProduct.carat - 0.03;
  const weightUpperBound = primaryProduct.carat + 0.03;

  try {
    const alternatives = await Product.find({
      _id: { $ne: primaryProduct._id }, // Not the primary product itself
      shape: primaryProduct.shape,
      carat: { $gte: weightLowerBound, $lte: weightUpperBound },
      clarity: primaryProduct.clarity, // Exact match for now
      color: { $in: colorCriteria },
      sold: false,
      onDeal: false, // Ensure it's not already in another deal
      // TODO: Potentially add status: 'Active' or similar if such field exists
    })
    .sort({ carat: 1 }) // Simple sort by carat, can be refined
    .limit(limit)
    .select('_id price carat color clarity shape company'); // Добавили company в select, чтобы знать поставщика альтернативы

    return alternatives;
  } catch (error) {
    console.error('Error finding alternative products:', error);
    return [];
  }
};

module.exports = {
  determineLgdealRole,
  determineUserRole,
  isValidStageTransition,
  isValidStatusTransition,
  processProductsOnDealEnd,
  getAllowedActions,
  getColorSearchCriteria,
  findAlternativeProducts,
}; 