const mongoose = require('mongoose');
const CompanyApiConfig = require('../models/CompanyApiConfig');

// Set strictQuery to suppress deprecation warning
mongoose.set('strictQuery', false);

async function createVeerKrupaConfig() {
  try {
    // Use 127.0.0.1 instead of localhost to avoid IPv6 issues
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lgdx', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // Timeout after 30 seconds
    });

    const config = new CompanyApiConfig({
      company: '681f811cc81c0d72e7d5bf9e', // Veer Krupa company ID
      isActive: true,
      config: {
        url: 'https://drc.api.dharmatech.in/v1/all-stock',
        requestType: 'get',
        headers: new Map([
          ['Authorization', '{token}']
        ]),
        params: new Map([
          ['token', 'QVviu5WJNEU']
        ]),
        dataKey: 'data',
        filter: new Map([
          ['is_lab_grown', true],
          ['is_active', true]
        ])
      },
      syncSchedule: {
        frequency: 'daily',
        timeOfDay: '00:00'
      }
    });

    await config.save();
    console.log('Veer Krupa API configuration created successfully');
  } catch (error) {
    console.error('Error creating Veer Krupa config:', error);
  } finally {
    await mongoose.disconnect();
  }
}

createVeerKrupaConfig(); 