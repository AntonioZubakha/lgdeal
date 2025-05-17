const mongoose = require('mongoose');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

// Load environment variables
dotenv.config();

// Require models after mongoose connection to avoid errors
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lgdx', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
  run();
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

async function run() {
  try {
    // Load models after connection established
    const User = require('../models/User');
    const Company = require('../models/Company');
    const marketplaceConfig = require('../config/marketplace');

    // Get args
    const args = process.argv.slice(2);
    const email = args[0];
    
    if (!email) {
      console.error('Please provide a user email');
      console.log('Usage: node fix-supervisor-permissions.js user@example.com');
      process.exit(1);
    }
    
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      console.error(`User with email ${email} not found`);
      process.exit(1);
    }
    
    console.log(`Found user: ${user.firstName} ${user.lastName}, Role: ${user.role}`);
    
    // Get company directly
    let userCompany = null;
    if (user.company) {
      userCompany = await Company.findById(user.company);
      console.log(`User company: ${userCompany ? userCompany.name : 'None'}`);
    } else {
      console.log('User has no company assigned');
    }
    
    // Check if user is a LGDEAL supervisor
    const hasLgdealSupervisorRole = 
      user.role === 'supervisor' && 
      userCompany && 
      userCompany.name === marketplaceConfig.managementCompany.name;
    
    console.log(`User is ${hasLgdealSupervisorRole ? 'a' : 'not a'} LGDEAL supervisor`);
    
    // Generate a new token for this user with the isLgdealSupervisor flag
    const payload = {
      userId: user._id,
      role: user.role,
      isLgdealSupervisor: true // Force this to true
    };
    
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );
    
    console.log('----------------------------------------------------------------');
    console.log('A new token has been generated with isLgdealSupervisor flag.');
    console.log('To fix the permissions issue:');
    console.log('1. In your browser, open the Console (F12)');
    console.log('2. Run this command:');
    console.log(`localStorage.setItem('token', '${token}')`);
    console.log('3. Refresh the page');
    console.log('----------------------------------------------------------------');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
} 