const mongoose = require('mongoose');

const dealSchema = new mongoose.Schema({
  // Common fields for both deal types
  dealNumber: {
    type: String,
    unique: true,
    index: true
  },
  // Replace single productId with products array
  products: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    // New field for suggested alternative products for this specific product entry
    suggestedAlternatives: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      // Мы можем добавить сюда больше полей позже, если потребуется,
      // например, цена альтернативы, краткое описание отличий и т.д.
      pairedLgdealToSellerDealId: { // New field for the paired deal
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Deal',
        default: null
      }
    }],
    // New fields for selected alternative
    selectedAlternativeProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null
    },
    originalProductStruckOut: {
      type: Boolean,
      default: false
    },
    originalPriceBeforeSwap: {
      type: Number,
      default: null
    }
  }],
  amount: {
    type: Number,
    required: true
  },
  fee: {
    type: Number,
    default: 0
  },
  // Deal has stages instead of simple status
  stage: {
    type: String,
    enum: ['request', 'negotiation', 'payment_delivery', 'completed', 'cancelled'],
    default: 'request'
  },
  // More detailed status within each stage
  status: {
    type: String,
    enum: [
      'pending', 'approved', 'rejected', 
      'negotiating', 'terms_proposed', 'terms_accepted', 'seller_counter_offer', 'seller_final_offer',
      'awaiting_payment', 'payment_received', 'payment_verified',
      'awaiting_shipping', 'shipped', 'delivered', 
      'completed', 'cancelled', 'failed',
      'awaiting_invoice', 'invoice_pending'
    ],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  
  // Дополнительное поле для хранения URL инвойса (для обеспечения надежного доступа)
  invoiceUrl: {
    type: String
  },
  
  // Deal type: either buyer-to-lgdeal or lgdeal-to-seller
  dealType: {
    type: String,
    enum: ['buyer-to-lgdeal', 'lgdeal-to-seller'],
    required: true
  },
  
  // References to paired deals
  // For buyer-to-lgdeal deals: array of lgdeal-to-seller deals
  // For lgdeal-to-seller deals: reference to buyer-to-lgdeal deal
  pairedDealIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deal'
  }],
  pairedDealId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deal'
  },
  
  // Buyer fields - used in buyer-to-lgdeal deal
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  buyerCompanyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },
  
  // Seller fields - used in lgdeal-to-seller deal
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  sellerCompanyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },
  
  // LGDEAL company ID - included in both deal types
  lgdealCompanyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  
  // Request stage details
  requestDetails: {
    requestDate: {
      type: Date,
      default: Date.now
    },
    notes: String,
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvalDate: Date,
    rejectionReason: String
  },
  
  // Negotiation stage details
  negotiationDetails: {
    startDate: Date,
    endDate: Date,
    proposedTerms: [{
      proposedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      proposedDate: Date,
      price: Number,
      deliveryTerms: String,
      additionalTerms: String,
      status: {
        type: String,
        enum: ['proposed', 'accepted', 'rejected', 'countered'],
        default: 'proposed'
      }
    }],
    finalTerms: {
      price: Number,
      deliveryTerms: String,
      additionalTerms: String,
      acceptedDate: Date
    }
  },
  
  // Payment information
  paymentDetails: {
    method: {
      type: String,
      enum: ['credit_card', 'wire_transfer', 'escrow', 'other'],
      default: 'wire_transfer'
    },
    referenceNumber: String,
    paymentDate: Date,
    verificationDate: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    invoiceFilename: {
      type: String,
      required: false
    },
    notes: String
  },
  
  // Shipping information
  shippingDetails: {
    trackingNumber: String,
    carrier: String,
    shippedDate: Date,
    estimatedDelivery: Date,
    deliveredDate: Date,
    deliveryConfirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deliveryConfirmationDate: Date,
    cost: Number,
    shippingAddress: {
      recipient: String,
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String
    }
  },
  
  // Communication and activity history
  activityLog: [{
    action: {
      type: String,
      enum: [
        'deal_created', 'stage_changed', 'status_changed', 
        'message_sent', 'terms_proposed', 'terms_accepted',
        'payment_submitted', 'payment_verified', 
        'shipment_initiated', 'delivery_confirmed',
        'deal_completed', 'deal_cancelled'
      ]
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: String
  }],
  
  // Timestamps for deal lifecycle
  lastActionAt: { type: Date, default: Date.now } // Added for tracking time since last action
});

// Middleware to update `updatedAt` and `lastActionAt` on save, except for new documents for lastActionAt
dealSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  // Only update lastActionAt if it's not a new document being created
  // or if specific logic elsewhere has already set it for a new doc (e.g. in controller)
  // For now, let specific controller actions explicitly set lastActionAt for clarity on what constitutes an "action"
  // If it's a new document, the default: Date.now for lastActionAt already handles it.
  next();
});

// Add indices for faster queries
dealSchema.index({ stage: 1, status: 1 });
dealSchema.index({ dealType: 1 });
dealSchema.index({ pairedDealId: 1 });
dealSchema.index({ pairedDealIds: 1 });
dealSchema.index({ buyerId: 1 });
dealSchema.index({ sellerId: 1 });
dealSchema.index({ 'products.product': 1 });
dealSchema.index({ createdAt: 1 });
dealSchema.index({ 'requestDetails.requestedBy': 1 });

module.exports = mongoose.model('Deal', dealSchema); 