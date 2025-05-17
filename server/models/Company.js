const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending_review', 'active', 'rejected', 'suspended'],
    default: 'pending_review'
  },
  users: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['supervisor', 'manager'],
      required: true
    },
    isActive: {
      type: Boolean,
      default: false
    }
  }],
  details: {
    email: String,
    phone: String,
    logo: {
      url: String,
      filename: String
    },
    legalAddress: {
      country: String,
      city: String,
      street: String,
      building: String,
      office: String,
      postalCode: String
    },
    actualAddress: {
      country: String,
      city: String,
      street: String,
      building: String,
      office: String,
      postalCode: String
    },
    shippingAddress: {
      country: String,
      city: String,
      street: String,
      building: String,
      office: String,
      postalCode: String
    },
    bankInformation: {
      bankName: String,
      accountNumber: String,
      swiftCode: String,
      correspondentBank: {
        bankName: String,
        accountNumber: String,
        swiftCode: String
      }
    },
    taxInformation: {
      taxNumber: String,
      vatNumber: String
    }
  },
  apiConfig: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompanyApiConfig'
  },
  reviewedAt: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Company', companySchema); 