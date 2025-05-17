const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const User = require('../models/User');
const Company = require('../models/Company');
const Product = require('../models/Product');
const jwt = require('jsonwebtoken');
const commandController = require('../controllers/commandController');

// @route   GET api/admin/users
// @desc    Get all users
// @access  Admin only
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password').populate('company', 'name');
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/admin/companies
// @desc    Get all companies
// @access  Admin only
router.get('/companies', adminAuth, async (req, res) => {
  try {
    const companies = await Company.find().populate('users.user', 'email firstName lastName role isActive');
    res.json(companies);
  } catch (err) {
    console.error('Error fetching companies:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/admin/companies/:id
// @desc    Get company by ID with detailed info
// @access  Admin only
router.get('/companies/:id', adminAuth, async (req, res) => {
  try {
    const companyId = req.params.id;
    
    const company = await Company.findById(companyId)
      .populate('users.user', 'email firstName lastName role isActive');
      
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    
    // Получаем продукты компании
    const products = await Product.find({ company: companyId });
    
    res.json({
      company,
      stats: {
        userCount: company.users.length,
        productCount: products.length
      }
    });
  } catch (err) {
    console.error('Error fetching company details:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/admin/users/:id
// @desc    Get user profile by ID
// @access  Admin only
router.get('/users/:id', adminAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await User.findById(userId)
      .select('-password')
      .populate('company', 'name');
      
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Если пользователь привязан к компании, получаем информацию о его продуктах
    let products = [];
    if (user.company) {
      products = await Product.find({ 
        company: user.company._id 
      }).limit(10); // Ограничиваем для предварительного просмотра
    }
    
    res.json({
      user,
      products: products,
      stats: {
        productCount: products.length
      }
    });
  } catch (err) {
    console.error('Error fetching user details:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT api/admin/users/:id/company
// @desc    Change user's company
// @access  Admin only
router.put('/users/:id/company', adminAuth, async (req, res) => {
  try {
    const { companyId } = req.body;
    const userId = req.params.id;
    
    // Проверяем существование пользователя
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Проверяем существование компании
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    
    // Если пользователь уже был в другой компании, удаляем его оттуда
    if (user.company) {
      const oldCompany = await Company.findById(user.company);
      if (oldCompany) {
        oldCompany.users = oldCompany.users.filter(u => u.user.toString() !== userId);
        await oldCompany.save();
      }
    }
    
    // Обновляем компанию пользователя
    user.company = companyId;
    await user.save();
    
    // Добавляем пользователя в новую компанию
    company.users.push({
      user: userId,
      role: user.role,
      isActive: user.isActive
    });
    await company.save();
    
    res.json({
      message: `User transferred to company "${company.name}" successfully`,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        company: company.name,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (err) {
    console.error('Error changing user company:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT api/admin/companies/:id
// @desc    Update company information
// @access  Admin only
router.put('/companies/:id', adminAuth, async (req, res) => {
  try {
    const companyId = req.params.id;
    const { name, description } = req.body;
    
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    
    // Обновляем данные компании
    if (name) company.name = name;
    if (description) company.description = description;
    
    await company.save();
    
    res.json({
      message: 'Company updated successfully',
      company
    });
  } catch (err) {
    console.error('Error updating company:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT api/admin/users/:id/activate
// @desc    Activate/deactivate user
// @access  Admin only
router.put('/users/:id/activate', adminAuth, async (req, res) => {
  try {
    const { activate } = req.body;
    const userId = req.params.id;
    
    // Находим пользователя
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Обновляем статус активации
    user.isActive = activate === true || activate === 'true';
    await user.save();
    
    // Также обновляем статус в компании, если пользователь привязан к компании
    if (user.company) {
      const company = await Company.findById(user.company);
      if (company) {
        const userInCompany = company.users.find(u => u.user.toString() === userId);
        if (userInCompany) {
          userInCompany.isActive = user.isActive;
          await company.save();
        }
      }
    }
    
    res.json({
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (err) {
    console.error('Error updating user activation status:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT api/admin/users/:id/role
// @desc    Change user role
// @access  Admin only
router.put('/users/:id/role', adminAuth, async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.params.id;
    
    // Проверяем валидность роли
    if (!['admin', 'supervisor', 'manager'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified' });
    }
    
    // Находим пользователя
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Обновляем роль
    user.role = role;
    await user.save();
    
    // Также обновляем роль в компании, если пользователь привязан к компании
    if (user.company) {
      const company = await Company.findById(user.company);
      if (company) {
        const userInCompany = company.users.find(u => u.user.toString() === userId);
        if (userInCompany) {
          userInCompany.role = role;
          await company.save();
        }
      }
    }
    
    res.json({
      message: `User role changed to ${role} successfully`,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (err) {
    console.error('Error updating user role:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT api/admin/users/:id/transfer
// @desc    Transfer user to another company
// @access  Admin only
router.put('/users/:id/transfer', adminAuth, async (req, res) => {
  try {
    const { newCompanyId } = req.body;
    const userId = req.params.id;
    
    // Проверяем существование пользователя
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Проверяем существование новой компании
    const newCompany = await Company.findById(newCompanyId);
    if (!newCompany) {
      return res.status(404).json({ message: 'New company not found' });
    }
    
    // Удаляем пользователя из текущей компании, если он привязан к ней
    if (user.company) {
      const oldCompany = await Company.findById(user.company);
      if (oldCompany) {
        oldCompany.users = oldCompany.users.filter(u => u.user.toString() !== userId);
        await oldCompany.save();
      }
    }
    
    // Привязываем пользователя к новой компании
    user.company = newCompanyId;
    await user.save();
    
    // Добавляем пользователя в список пользователей новой компании
    newCompany.users.push({
      user: userId,
      role: user.role,
      isActive: user.isActive
    });
    await newCompany.save();
    
    res.json({
      message: `User transferred to ${newCompany.name} successfully`,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        company: newCompany.name,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (err) {
    console.error('Error transferring user:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/admin/impersonate/:id
// @desc    Get impersonation token for a user
// @access  Admin only
router.get('/impersonate/:id', adminAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Проверяем существование пользователя
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Генерируем JWT токен с данными пользователя и указываем его компанию
    const token = jwt.sign(
      { 
        userId: user._id,
        company: user.company, // Добавляем компанию прямо в токен
        impersonated: true 
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1h' }
    );
    
    res.json({
      token,
      message: 'Impersonation token generated successfully'
    });
  } catch (err) {
    console.error('Error generating impersonation token:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/admin/execute-command
// @desc    Execute administrative command
// @access  Admin with LGDEAL supervisor privileges only
router.post('/execute-command', adminAuth, commandController.executeCommand);

// @route   GET api/admin/check-command-permission
// @desc    Check if user has command line permissions
// @access  Admin only
router.get('/check-command-permission', adminAuth, async (req, res) => {
  try {
    const { userId } = req.user;
    
    // Get user from database with company info
    const user = await User.findById(userId).populate('company');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user is a supervisor at LGDEAL LLC
    const hasLgdealSupervisorRole = user.role === 'supervisor' && 
      user.company && 
      user.company.name === require('../config/marketplace').managementCompany.name;
    
    return res.json({
      hasCommandPermission: hasLgdealSupervisorRole,
      userDetails: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyName: user.company ? user.company.name : null,
        requiredCompanyName: require('../config/marketplace').managementCompany.name
      }
    });
  } catch (err) {
    console.error('Error checking command permissions:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 