const mongoose = require('mongoose');

// Set strictQuery to suppress deprecation warning
mongoose.set('strictQuery', false);

const CompanyApiConfigSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  config: {
    url: {
      type: String,
      required: true,
      trim: true
    },
    requestType: {
      type: String,
      enum: ['get', 'post'],
      default: 'get'
    },
    headers: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    params: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    dataKey: {
      type: String,
      default: 'data'
    },
    filter: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: new Map()
    }
  },
  lastSync: {
    type: Date,
    default: null
  },
  syncStatus: {
    type: String,
    enum: ['idle', 'in_progress', 'success', 'error'],
    default: 'idle'
  },
  lastSyncError: {
    type: String,
    default: null
  },
  syncSchedule: {
    frequency: {
      type: String,
      enum: ['daily', 'hourly', 'manual'],
      default: 'daily'
    },
    timeOfDay: {
      type: String,
      default: '00:00' // For daily syncs
    }
  },
  tokenAuthConfig: {
    enabled: { type: Boolean, default: false },
    url: String,
    requestType: { type: String, enum: ['get', 'post'], default: 'post' },
    // For simple key-value params in token URL or simple form data in body
    params: { type: mongoose.Schema.Types.Mixed, default: {} }, 
    headers: { type: mongoose.Schema.Types.Mixed, default: {} },
    // For complex JSON body or specific string body for token request
    bodyPayload: { type: mongoose.Schema.Types.Mixed, default: {} }, 
    bodyEncodeType: { type: String, enum: ['json', 'form', 'string'], default: 'json' },
    // How to extract token(s) from response. Example: "data.token" or for multiple: {accessToken: "data.access_token", refreshToken: "data.refresh_token"}
    tokensPathInResponse: { type: mongoose.Schema.Types.Mixed, default: 'token' }, 
    // How to use the token(s) in the main request
    // Example for single token: { name: "token", placement: "header", format: "Bearer {token}"} 
    // Example for multiple: [{ name: "accessToken", placement: "header", format: "Bearer {accessToken}"}, { name: "userId", placement: "param"}]
    tokenUsage: [{ 
      nameInResponse: String, // Key used in tokensPathInResponse if it's an object (e.g. "accessToken")
      placeholderName: String, // Placeholder in main request URL/params/headers (e.g., "{token}" or "{accessToken}")
      placement: { type: String, enum: ['header', 'param', 'url_segment'], required: true },
      // If placement is 'header', this is the full header line, e.g., "Authorization: Bearer {token}" or just the header name if value is separate
      // If placement is 'param', this is the param name.
      // If placement is 'url_segment', this is not used directly here but placeholderName is used in main URL.
      destinationName: String 
    }]
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CompanyApiConfig', CompanyApiConfigSchema); 