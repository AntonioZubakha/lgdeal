/**
 * Script to set up LGDEAL LLC company and create admin users
 * Run with: node scripts/setup-lgdeal.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import models
const User = require('../models/User');
const Company = require('../models/Company');
const marketplaceConfig = require('../config/marketplace');

// LGDEAL LLC company name from config
const LGDEAL_NAME = marketplaceConfig.managementCompany.name;

/**
 * Connect to MongoDB with retry logic
 */
const connectDB = async (retries = 5, delay = 5000) => {
  try {
    console.log('Connecting to MongoDB...');
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lgdx';
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      retryWrites: true
    });
    
    console.log('MongoDB Connected!');
    return true;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    
    if (retries > 0) {
      console.log(`Retrying connection in ${delay/1000} seconds... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return connectDB(retries - 1, delay);
    } else {
      console.error('Maximum retries reached. Exiting...');
      process.exit(1);
    }
  }
};

/**
 * Create admin user if none exists
 */
const createAdminUser = async () => {
  try {
    // Check if admin already exists
    const adminExists = await User.findOne({ role: 'admin' });
    
    if (adminExists) {
      console.log('Admin user already exists:', adminExists.email);
      return adminExists;
    }
    
    // Admin credentials
    const adminEmail = 'admin@example.com';
    const adminPassword = 'admin123'; // This should be changed in production
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    // Create admin user
    const adminUser = new User({
      email: adminEmail,
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      isActive: true
    });
    
    await adminUser.save();
    console.log('Admin user created:', adminEmail);
    return adminUser;
  } catch (error) {
    console.error('Error creating admin user:', error);
    throw error;
  }
};

/**
 * Create LGDEAL LLC company if it doesn't exist
 */
const createLgdealCompany = async () => {
  try {
    // Check if LGDEAL LLC already exists
    const companyExists = await Company.findOne({ name: LGDEAL_NAME });
    
    if (companyExists) {
      console.log('LGDEAL LLC company already exists:', companyExists._id);
      return companyExists;
    }
    
    // Create LGDEAL LLC company
    const lgdealCompany = new Company({
      name: LGDEAL_NAME,
      description: 'Management company for the marketplace',
      details: {
        email: 'admin@lgdeal.com',
        phone: '+1 (555) 123-4567',
        legalAddress: {
          country: 'USA',
          address: '123 Market St',
          city: 'San Francisco',
          region: 'CA',
          zipCode: '94105'
        }
      },
      users: []
    });
    
    await lgdealCompany.save();
    console.log('LGDEAL LLC company created:', lgdealCompany._id);
    return lgdealCompany;
  } catch (error) {
    console.error('Error creating LGDEAL LLC company:', error);
    throw error;
  }
};

/**
 * Create LGDEAL LLC supervisor
 */
const createLgdealSupervisor = async (company) => {
  try {
    // Check if LGDEAL LLC supervisor already exists
    const supervisorExists = await User.findOne({ 
      company: company._id,
      role: 'supervisor'
    });
    
    if (supervisorExists) {
      console.log('LGDEAL LLC supervisor already exists:', supervisorExists.email);
      return supervisorExists;
    }
    
    // Supervisor credentials
    const supervisorEmail = 'supervisor@lgdeal.com';
    const supervisorPassword = 'supervisor123'; // This should be changed in production
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(supervisorPassword, 10);
    
    // Create supervisor user
    const supervisorUser = new User({
      email: supervisorEmail,
      password: hashedPassword,
      firstName: 'LGDEAL',
      lastName: 'Supervisor',
      role: 'supervisor',
      company: company._id,
      isActive: true
    });
    
    await supervisorUser.save();
    console.log('LGDEAL LLC supervisor created:', supervisorEmail);
    
    // Add user to company's users list
    company.users.push({
      user: supervisorUser._id,
      role: 'supervisor',
      isActive: true,
      addedAt: new Date()
    });
    
    await company.save();
    console.log('Supervisor added to LGDEAL LLC company');
    
    return supervisorUser;
  } catch (error) {
    console.error('Error creating LGDEAL LLC supervisor:', error);
    throw error;
  }
};

/**
 * Main setup function
 */
const setupLgdeal = async () => {
  try {
    // Connect to MongoDB with retry logic
    await connectDB();
    
    // Create admin user
    const admin = await createAdminUser();
    
    // Create LGDEAL LLC company
    const lgdealCompany = await createLgdealCompany();
    
    // Create LGDEAL supervisor
    const supervisor = await createLgdealSupervisor(lgdealCompany);
    
    console.log('LGDEAL LLC setup completed successfully!');
    console.log('=========================================');
    console.log('Admin user:', admin.email);
    console.log('LGDEAL LLC company:', lgdealCompany.name);
    console.log('LGDEAL LLC supervisor:', supervisor.email);
    console.log('=========================================');
    console.log('You can now log in with these accounts to access the system.');
  } catch (error) {
    console.error('Error during LGDEAL LLC setup:', error);
  } finally {
    // Disconnect from MongoDB
    try {
      await mongoose.disconnect();
      console.log('MongoDB disconnected');
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error);
    }
    process.exit(0);
  }
};

// Run the setup
setupLgdeal(); 