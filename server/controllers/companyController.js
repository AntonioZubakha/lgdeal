const User = require('../models/User');
const Company = require('../models/Company');
const CompanyApiConfig = require('../models/CompanyApiConfig');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Product = require('../models/Product');

// Получить всех пользователей компании
exports.getCompanyUsers = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Добавляем отладочную информацию
    console.log(`Getting company users for user: ${userId}`);
    console.log(`User data in request:`, req.user);
    
    // Если токен импрессонации и в нем уже есть company
    let companyId = req.user.company;
    
    if (!companyId) {
      // Если company нет в токене, берем из пользователя
      const currentUser = await User.findById(userId);
      if (!currentUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      companyId = currentUser.company;
      console.log(`Loaded company ID from user: ${companyId}`);
    } else {
      console.log(`Using company ID from token: ${companyId}`);
    }
    
    // Проверяем, есть ли у пользователя компания
    if (!companyId) {
      return res.status(400).json({ message: 'User is not associated with any company' });
    }
    
    // Находим компанию пользователя
    const company = await Company.findById(companyId)
      .populate('users.user', 'firstName lastName email role isActive');
    
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    
    return res.json({ 
      company: company.name,
      users: company.users
    });
  } catch (error) {
    console.error('Error getting company users:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Активация пользователя
exports.activateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;
    
    // Находим текущего пользователя
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Проверяем, является ли текущий пользователь супервайзером
    if (currentUser.role !== 'supervisor') {
      return res.status(403).json({ message: 'Only supervisors can activate users' });
    }
    
    // Находим пользователя для активации
    const userToActivate = await User.findById(userId);
    if (!userToActivate) {
      return res.status(404).json({ message: 'User to activate not found' });
    }
    
    // Проверяем, что оба пользователя из одной компании
    if (currentUser.company.toString() !== userToActivate.company.toString()) {
      return res.status(403).json({ message: 'You can only activate users from your company' });
    }
    
    // Активируем пользователя
    userToActivate.isActive = true;
    await userToActivate.save();
    
    // Обновляем статус пользователя в компании
    const company = await Company.findById(currentUser.company);
    const userIndex = company.users.findIndex(u => u.user.toString() === userId);
    
    if (userIndex !== -1) {
      company.users[userIndex].isActive = true;
      await company.save();
    }
    
    return res.json({ 
      message: 'User activated successfully',
      user: {
        id: userToActivate._id,
        email: userToActivate.email,
        firstName: userToActivate.firstName,
        lastName: userToActivate.lastName,
        isActive: userToActivate.isActive
      }
    });
  } catch (error) {
    console.error('Error activating user:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Изменение роли пользователя
exports.changeUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const currentUserId = req.user.userId;
    
    // Проверяем, что новая роль допустима
    if (!['supervisor', 'manager'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be supervisor or manager' });
    }
    
    // Находим текущего пользователя
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Проверяем, является ли текущий пользователь супервайзером
    if (currentUser.role !== 'supervisor') {
      return res.status(403).json({ message: 'Only supervisors can change user roles' });
    }
    
    // Находим пользователя для изменения роли
    const userToUpdate = await User.findById(userId);
    if (!userToUpdate) {
      return res.status(404).json({ message: 'User to update not found' });
    }
    
    // Проверяем, что оба пользователя из одной компании
    if (currentUser.company.toString() !== userToUpdate.company.toString()) {
      return res.status(403).json({ message: 'You can only update users from your company' });
    }
    
    // Если пытаемся понизить роль супервайзера до менеджера (своего или чужого),
    // проверим, останутся ли другие супервайзеры в компании
    if (userToUpdate.role === 'supervisor' && role === 'manager') {
      // Находим компанию пользователя
      const company = await Company.findById(currentUser.company);
      
      // Считаем количество активных супервайзеров в компании
      const supervisorsCount = company.users.filter(u => 
        u.role === 'supervisor' && 
        u.isActive === true && 
        u.user.toString() !== userId
      ).length;
      
      // Если нет других супервайзеров, запрещаем смену роли
      if (supervisorsCount === 0) {
        return res.status(400).json({ 
          message: 'Cannot change role. Company must have at least one supervisor.' 
        });
      }
    }
    
    // Обновляем роль пользователя
    userToUpdate.role = role;
    await userToUpdate.save();
    
    // Обновляем роль пользователя в компании
    const company = await Company.findById(currentUser.company);
    const userIndex = company.users.findIndex(u => u.user.toString() === userId);
    
    if (userIndex !== -1) {
      company.users[userIndex].role = role;
      await company.save();
    }
    
    return res.json({ 
      message: `User role changed to ${role} successfully`,
      user: {
        id: userToUpdate._id,
        email: userToUpdate.email,
        firstName: userToUpdate.firstName,
        lastName: userToUpdate.lastName,
        role: userToUpdate.role
      }
    });
  } catch (error) {
    console.error('Error changing user role:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Получить информацию о компании
exports.getCompanyInfo = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Получаем пользователя
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Проверяем, есть ли у пользователя компания
    if (!currentUser.company) {
      return res.status(400).json({ message: 'User is not associated with any company' });
    }
    
    // Находим компанию пользователя
    const company = await Company.findById(currentUser.company);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    
    // Возвращаем информацию о компании
    return res.json({
      id: company._id,
      name: company.name,
      description: company.description,
      details: company.details || {}
    });
  } catch (error) {
    console.error('Error getting company info:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Обновление информации о компании
exports.updateCompanyInfo = async (req, res) => {
  try {
    const { 
      name, description, details
    } = req.body;
    
    const userId = req.user.userId;
    
    // Находим текущего пользователя
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Проверяем, является ли текущий пользователь супервайзером
    if (currentUser.role !== 'supervisor') {
      return res.status(403).json({ message: 'Only supervisors can update company information' });
    }
    
    // Проверяем, есть ли у пользователя компания
    if (!currentUser.company) {
      return res.status(400).json({ message: 'User is not associated with any company' });
    }
    
    // Находим компанию пользователя
    const company = await Company.findById(currentUser.company);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    
    // Обновляем основные данные компании
    if (name) company.name = name;
    if (description) company.description = description;
    
    // Обновляем детальную информацию о компании
    if (details) {
      // Если еще нет объекта details, создаем его
      if (!company.details) {
        company.details = {};
      }
      
      // Обновляем основные контактные данные
      if (details.email) company.details.email = details.email;
      if (details.phone) company.details.phone = details.phone;
      
      // Обновляем юридический адрес
      if (details.legalAddress) {
        company.details.legalAddress = {
          ...company.details.legalAddress || {},
          ...details.legalAddress
        };
      }
      
      // Обновляем фактический адрес
      if (details.actualAddress) {
        company.details.actualAddress = {
          ...company.details.actualAddress || {},
          ...details.actualAddress
        };
      }
      
      // Обновляем адрес доставки
      if (details.shippingAddress) {
        company.details.shippingAddress = {
          ...company.details.shippingAddress || {},
          ...details.shippingAddress
        };
      }
      
      // Обновляем банковскую информацию
      if (details.bankInformation) {
        company.details.bankInformation = {
          ...company.details.bankInformation || {},
          ...details.bankInformation
        };
        
        // Обновляем информацию о корреспондентском банке
        if (details.bankInformation.correspondentBank) {
          company.details.bankInformation.correspondentBank = {
            ...company.details.bankInformation.correspondentBank || {},
            ...details.bankInformation.correspondentBank
          };
        }
      }
      
      // Обновляем налоговую информацию
      if (details.taxInformation) {
        company.details.taxInformation = {
          ...company.details.taxInformation || {},
          ...details.taxInformation
        };
      }
    }
    
    await company.save();
    
    return res.json({ 
      message: 'Company information updated successfully',
      company: {
        id: company._id,
        name: company.name,
        description: company.description,
        details: company.details
      }
    });
  } catch (error) {
    console.error('Error updating company information:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Конфигурация multer для загрузки файлов
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = 'uploads/logos';
    // Создаем директорию, если она не существует
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function(req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
}).single('logo');

// @route   POST api/company/logo
// @desc    Upload company logo
// @access  Private (supervisor only)
exports.uploadLogo = async (req, res) => {
  upload(req, res, async function(err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: 'File upload error: ' + err.message });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Please upload a file' });
      }

      // Получаем пользователя
      const currentUser = await User.findById(req.user.userId);
      if (!currentUser) {
        // Удаляем загруженный файл, если пользователь не найден
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: 'User not found' });
      }

      // Проверяем, есть ли у пользователя компания
      if (!currentUser.company) {
        // Удаляем загруженный файл, если у пользователя нет компании
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'User is not associated with any company' });
      }

      const company = await Company.findById(currentUser.company);
      if (!company) {
        // Удаляем загруженный файл, если компания не найдена
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: 'Company not found' });
      }

      // Проверяем роль пользователя
      const userInCompany = company.users.find(u => u.user.toString() === req.user.userId);
      if (!userInCompany || userInCompany.role !== 'supervisor') {
        // Удаляем загруженный файл, если у пользователя нет прав
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ message: 'Not authorized to upload company logo' });
      }

      // Удаляем старый логотип, если он существует
      if (company.details.logo && company.details.logo.filename) {
        const oldLogoPath = path.join('uploads/logos', company.details.logo.filename);
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
        }
      }

      // Обновляем информацию о логотипе в базе данных
      company.details.logo = {
        url: `/uploads/logos/${req.file.filename}`,
        filename: req.file.filename
      };
      await company.save();

      res.json({ 
        message: 'Logo uploaded successfully',
        logo: company.details.logo
      });
    } catch (err) {
      console.error('Error in uploadLogo:', err);
      // В случае ошибки удаляем загруженный файл
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ message: 'Server error' });
    }
  });
};

// Get all companies with their API configs
exports.getAllCompanies = async (req, res) => {
  try {
    // Add pagination, sorting, and filtering by status if needed in future
    const companies = await Company.find().populate('users.user', 'email firstName lastName role isActive').sort({ createdAt: -1 });
    res.json(companies);
  } catch (error) {
    console.error('Error getting all companies:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get companies awaiting onboarding review (for admin)
exports.getOnboardingRequests = async (req, res) => {
  try {
    const companies = await Company.find({ status: 'pending_review' })
      .populate('users.user', 'email firstName lastName role isActive')
      .sort({ createdAt: 1 }); // Show oldest first
    res.json(companies);
  } catch (error) {
    console.error('Error getting onboarding requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Approve a company (for admin)
exports.approveCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    if (company.status !== 'pending_review') {
      return res.status(400).json({ message: `Company is not pending review (status: ${company.status})` });
    }

    company.status = 'active';
    company.reviewedBy = req.user.userId; // Admin who approved
    company.reviewedAt = new Date();

    // Activate the first user of the company if they are a supervisor and not yet active
    if (company.users && company.users.length > 0) {
      const firstUserEntry = company.users[0];
      if (firstUserEntry.role === 'supervisor' && !firstUserEntry.isActive) {
        const userToActivate = await User.findById(firstUserEntry.user);
        if (userToActivate) {
          userToActivate.isActive = true;
          await userToActivate.save();
          firstUserEntry.isActive = true; // Also update in company's user array
          console.log(`Activated first supervisor ${userToActivate.email} for company ${company.name}`);
        }
      }
    }

    await company.save();
    res.json({ message: 'Company approved and first supervisor activated', company });
  } catch (error) {
    console.error('Error approving company:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Reject a company (for admin)
exports.rejectCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Allow rejection even if not strictly pending, e.g., to correct a mistake or if new info surfaces
    // However, typically this would be for 'pending_review' companies.

    company.status = 'rejected';
    company.reviewedBy = req.user.userId; // Admin who rejected
    company.reviewedAt = new Date();
    
    // Optionally: Add a reason for rejection from req.body if implemented later
    // company.rejectionReason = req.body.reason;

    await company.save();
    res.json({ message: 'Company rejected', company });
  } catch (error) {
    console.error('Error rejecting company:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get a single company
exports.getCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id).populate('apiConfig');
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    res.json(company);
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ message: 'Server error' });
  }
}; 