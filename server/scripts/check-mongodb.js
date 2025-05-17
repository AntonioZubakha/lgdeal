/**
 * Script to check MongoDB connection
 * Run with: node scripts/check-mongodb.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Connect to MongoDB with retry logic
 */
const connectDB = async (retries = 3, delay = 3000) => {
  try {
    console.log('Attempting to connect to MongoDB...');
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lgdx';
    
    console.log(`URI: ${mongoURI}`);
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      retryWrites: true
    });
    
    console.log('✅ MongoDB Connected successfully!');
    
    // Get MongoDB version info
    const adminDb = mongoose.connection.db.admin();
    const serverInfo = await adminDb.serverInfo();
    console.log(`MongoDB version: ${serverInfo.version}`);
    
    // Check for LGDEAL LLC company
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('Available collections:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });
    
    // Check if companies collection exists and contains LGDEAL LLC
    if (collections.some(c => c.name === 'companies')) {
      const companiesCount = await db.collection('companies').countDocuments();
      console.log(`Companies in database: ${companiesCount}`);
      
      // Check for LGDEAL LLC
      const lgdealCompany = await db.collection('companies').findOne({ name: 'LGDEAL LLC' });
      if (lgdealCompany) {
        console.log('✅ LGDEAL LLC company found');
      } else {
        console.log('❌ LGDEAL LLC company not found. You should run setup-lgdeal.js script.');
      }
    }
    
    // Check for admin users
    if (collections.some(c => c.name === 'users')) {
      const usersCount = await db.collection('users').countDocuments();
      console.log(`Users in database: ${usersCount}`);
      
      // Check for admin users
      const adminUsers = await db.collection('users').countDocuments({ role: 'admin' });
      console.log(`Admin users found: ${adminUsers}`);
      
      if (adminUsers === 0) {
        console.log('❌ No admin users found. You should run setup-lgdeal.js script.');
      }
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error connecting to MongoDB: ${error.message}`);
    
    if (retries > 0) {
      console.log(`Retrying connection in ${delay/1000} seconds... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return connectDB(retries - 1, delay);
    } else {
      console.error('Maximum retries reached. Check your MongoDB connection:');
      console.error('1. Is MongoDB service running?');
      console.error('2. Check MongoDB connection string in .env file');
      console.error('3. Make sure no firewall is blocking the connection');
      process.exit(1);
    }
  }
};

// Run the connection check
const checkMongoDB = async () => {
  try {
    await connectDB();
  } catch (error) {
    console.error('Failed to check MongoDB connection:', error);
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

checkMongoDB(); 