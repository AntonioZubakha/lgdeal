const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const cookieParser = require('cookie-parser');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true // Разрешить cookies
}));

// Parse JSON body
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: false }));

// Parse Cookies
app.use(cookieParser());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Debugging middleware - log all incoming requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working'
  });
});

// MongoDB Connection
const connectDB = async () => {
  try {
    // Use 127.0.0.1 instead of localhost to avoid IPv6 issues
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lgdx';
    
    console.log(`Attempting to connect to MongoDB at: ${mongoURI}`);
    
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // Timeout after 30 seconds
    };
    
    const conn = await mongoose.connect(mongoURI, options);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

// Connect to database
connectDB();

// Handling database connection events
mongoose.connection.on('error', (err) => {
  console.error(`MongoDB connection error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB connection disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.info('MongoDB connection reestablished');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  } catch (error) {
    console.error(`Error during MongoDB connection close: ${error.message}`);
    process.exit(1);
  }
});

// Routes
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/company');
const inventoryRoutes = require('./routes/inventory');
const marketplaceRoutes = require('./routes/marketplace');
const adminRoutes = require('./routes/admin');
const marketplaceExtraRoutes = require('./routes/marketplaceExtra');
const cartRoutes = require('./routes/cart');
const dealRoutes = require('./routes/deal');
const companyApiRoutes = require('./routes/companyApi');

// Initialize sync scheduler
require('./scripts/syncScheduler');

app.use('/api/auth', authRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/marketplace', marketplaceExtraRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/deal', dealRoutes);
app.use('/api/company-api', companyApiRoutes);

// Default route
app.get('/', (req, res) => {
  res.send('LGDX API is running');
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 