const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Company = require('../models/Company');
const marketplaceConfig = require('../config/marketplace');

// Create admin user
exports.createAdmin = async (req, res) => {
  try {
    const { email, password, firstName, lastName, adminKey } = req.body;
    
    // Verify admin key
    if (!adminKey || adminKey !== process.env.ADMIN_SECRET_KEY) {
      return res.status(401).json({ message: 'Invalid admin key' });
    }
    
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create admin user
    const user = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'admin',
      isActive: true
    });
    
    await user.save();
    
    // Generate token
    const token = jwt.sign(
      { userId: user._id, role: 'admin' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );
    
    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: 'admin',
        isActive: true
      }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Register a new user
exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, companyName } = req.body;
    
    console.log(`Registration attempt: ${email}, Company: ${companyName}`);
    
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      console.log(`Registration failed: Email already exists - ${email}`);
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    
    // Check if company exists or create a new one
    let company;
    let isFirstUser = false;
    const isLgdealCompany = companyName === marketplaceConfig.managementCompany.name;
    
    if (companyName) {
      company = await Company.findOne({ name: companyName });
      
      if (company) {
        console.log(`Company already exists: ${companyName}`);
      } else {
        console.log(`Creating new company: ${companyName}`);
        company = new Company({
          name: companyName,
          description: `${companyName} organization`,
          status: isLgdealCompany ? 'active' : 'pending_review'
        });
        await company.save();
        isFirstUser = true;
        console.log(`New company created: ${company._id} with status: ${company.status}`);
      }
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Determine user role
    let userRole = 'manager';
    if (isFirstUser && !isLgdealCompany) {
      userRole = 'supervisor';
    } else if (isLgdealCompany && (isFirstUser || process.env.NODE_ENV !== 'production')) {
      userRole = 'supervisor';
    }
    
    // Create new user with empty cart
    const user = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      company: company ? company._id : null,
      role: userRole,
      isActive: isLgdealCompany ? true : (company && company.status === 'active' ? true : false),
      cart: {
        items: [],
        updatedAt: Date.now()
      }
    });
    
    await user.save();
    console.log(`User saved: ${user._id}`);
    
    // Add user to company's user list if company exists
    if (company) {
      company.users.push({
        user: user._id,
        role: userRole,
        isActive: user.isActive
      });
      await company.save();
      console.log(`User added to company users list`);
    }
    
    // Create token payload
    const payload = {
      userId: user._id,
      role: user.role,
      isLgdealSupervisor: isLgdealCompany && userRole === 'supervisor'
    };
    
    // Generate JWT token
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );
    
    console.log(`Registration successful: ${email}`);
    
    // Return token and user data
    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        company: company ? {
          id: company._id,
          name: company.name
        } : null,
        isLgdealSupervisor: isLgdealCompany && userRole === 'supervisor'
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log(`Login attempt: ${email}`);
    
    // Validate email and password
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }
    
    // Find user by email
    const user = await User.findOne({ email }).populate('company');
    
    if (!user) {
      console.log(`Login failed: User not found - ${email}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check if password is correct
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`Login failed: Password mismatch - ${email}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check if user is active
    if (!user.isActive) {
      console.log(`Login failed: Inactive account - ${email}`);
      return res.status(401).json({ message: 'Your account is not active. Please contact your administrator.' });
    }
    
    // Check if this user is a supervisor at LGDEAL LLC
    let isLgdealSupervisor = false;
    if (user.role === 'supervisor' && user.company && user.company.name === marketplaceConfig.managementCompany.name) {
      isLgdealSupervisor = true;
      console.log(`LGDEAL LLC supervisor login: ${email}`);
    }
    
    // Create token payload
    const payload = {
      userId: user._id,
      role: user.role,
      isLgdealSupervisor
    };
    
    // Generate JWT token
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );
    
    // Update user's last login time
    user.lastLogin = Date.now();
    
    // Инициализируем корзину, если её нет
    if (!user.cart) {
      user.cart = { items: [], updatedAt: Date.now() };
    }
    
    await user.save();
    
    console.log(`Login successful: ${email}. Cart items: ${user.cart.items.length}`);
    
    // Return token and user data
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        company: user.company ? {
          id: user.company._id,
          name: user.company.name
        } : null,
        isLgdealSupervisor
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { newPassword } = req.body;
    
    // Validate input
    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required' });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update password
    user.password = hashedPassword;
    await user.save();
    
    console.log(`Password changed for user: ${user.email}`);
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Server error during password change' });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId).populate('company');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if this user is a supervisor at LGDEAL LLC
    const isLgdealSupervisor = 
      user.role === 'supervisor' && 
      user.company && 
      user.company.name === marketplaceConfig.managementCompany.name;
    
    res.json({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      company: user.company ? {
        id: user.company._id,
        name: user.company.name,
        description: user.company.description
      } : null,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      isLgdealSupervisor
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Logout user
exports.logout = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    // Больше НЕ очищаем корзину при выходе из системы
    // Сохраняем корзину для будущего использования
    
    // Очищаем только cookie для анонимных пользователей
    res.clearCookie('cart_session_id');
    
    console.log(`User logged out successfully: ${userId}`);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    // Even if there's an error, return success to client
    res.json({ success: true, message: 'Logged out successfully' });
  }
}; 