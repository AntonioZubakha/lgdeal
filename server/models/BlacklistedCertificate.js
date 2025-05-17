const mongoose = require('mongoose');

const BlacklistedCertificateSchema = new mongoose.Schema({
  certificateNumber: {
    type: String,
    required: true,
    index: true,
    unique: true
  },
  reason: {
    type: String,
    enum: ['deal_cancelled', 'product_sold', 'manual_exclusion', 'other'],
    default: 'other'
  },
  dealId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deal',
    required: false
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('BlacklistedCertificate', BlacklistedCertificateSchema); 