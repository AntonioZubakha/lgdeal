const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Company = require('../models/Company');
const marketplaceConfig = require('../config/marketplace');

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lgdx', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

db.once('open', async () => {
  console.log('Connected to MongoDB');
  
  try {
    // Get args
    const args = process.argv.slice(2);
    const email = args[0];
    
    if (!email) {
      console.error('Please provide a user email');
      console.log('Usage: node make-lgdeal-supervisor.js user@example.com');
      process.exit(1);
    }
    
    // Find user by email
    const user = await User.findOne({ email }).populate('company');
    
    if (!user) {
      console.error(`User with email ${email} not found`);
      process.exit(1);
    }
    
    console.log(`Found user: ${user.firstName} ${user.lastName}, Role: ${user.role}`);
    
    // Find or create LGDEAL LLC company
    let lgdealCompany = await Company.findOne({ name: marketplaceConfig.managementCompany.name });
    
    if (!lgdealCompany) {
      console.log('Creating LGDEAL LLC company...');
      lgdealCompany = new Company({
        name: marketplaceConfig.managementCompany.name,
        description: 'Management company for the lab-grown diamond marketplace',
        users: []
      });
      await lgdealCompany.save();
      console.log('LGDEAL LLC company created');
    } else {
      console.log('LGDEAL LLC company found');
    }
    
    // Update user to be a supervisor
    user.role = 'supervisor';
    
    // If user was in another company, remove them from there
    if (user.company && user.company._id.toString() !== lgdealCompany._id.toString()) {
      const oldCompany = await Company.findById(user.company._id);
      if (oldCompany) {
        console.log(`Removing user from old company: ${oldCompany.name}`);
        oldCompany.users = oldCompany.users.filter(u => u.user.toString() !== user._id.toString());
        await oldCompany.save();
      }
    }
    
    // Update user's company to LGDEAL LLC
    user.company = lgdealCompany._id;
    await user.save();
    
    // Add user to LGDEAL LLC company's users if not already there
    const userInCompany = lgdealCompany.users.find(u => u.user.toString() === user._id.toString());
    if (!userInCompany) {
      lgdealCompany.users.push({
        user: user._id,
        role: 'supervisor',
        isActive: true,
        addedAt: new Date()
      });
      await lgdealCompany.save();
    }
    
    console.log(`User ${user.email} is now a supervisor at LGDEAL LLC`);
    console.log('User can now use the command line interface');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}); 