const { syncCompanyProducts } = require('../controllers/companyApiController');
const CompanyApiConfig = require('../models/CompanyApiConfig');
const mongoose = require('mongoose');
const config = require('./veer-krupa-config.json');

async function testApiSync() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://127.0.0.1:27017/lgdx', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Create API configuration
    const apiConfig = new CompanyApiConfig({
      company: '681f811cc81c0d72e7d5bf9e', // Veer Krupa company ID
      config: {
        url: config.url,
        requestType: config.requestType,
        headers: new Map(Object.entries(config.headers)),
        params: new Map(Object.entries(config.params)),
        dataKey: config.dataKey,
        filter: new Map(Object.entries(config.filter))
      },
      syncSchedule: config.syncSchedule,
      isActive: true
    });
    
    // Save configuration
    await apiConfig.save();
    console.log('API configuration saved');
    
    // Test sync
    await syncCompanyProducts(apiConfig._id);
    console.log('Sync completed successfully');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

testApiSync(); 