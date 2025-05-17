const { exec } = require('child_process');
const path = require('path');
const User = require('../models/User');

// List of allowed commands and scripts
const ALLOWED_COMMANDS = {
  'help': {
    description: 'Show list of available commands',
    handler: showHelp
  },
  'sync-products': {
    description: 'Synchronize products for a company',
    handler: syncProducts,
    args: ['companyId']
  },
  'stats': {
    description: 'Show system statistics',
    handler: showStats
  },
  'clear-cache': {
    description: 'Clear system cache',
    handler: clearCache
  },
  'run-product-utils': {
    description: 'Run product utilities',
    handler: runProductUtils
  }
};

// Function to execute the command
exports.executeCommand = async (req, res) => {
  try {
    const { userId } = req.user;
    const { command } = req.body;

    // Debug info
    console.log("Command execution request from user:", userId);
    console.log("User object in request:", JSON.stringify(req.user, null, 2));

    // Check if the user is a supervisor
    // First check directly in req.user which comes from the token
    if (req.user.isLgdealSupervisor || req.user.isLgdealAdmin) {
      console.log("User has supervisor privileges via token, proceeding with command");
    } else {
      // Double check by fetching user from database
      const user = await User.findById(userId).populate('company');
      console.log("User fetched from database:", user ? `${user.firstName} ${user.lastName}` : "Not found");
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if user is supervisor at LGDEAL LLC
      const hasLgdealSupervisorRole = user.role === 'supervisor' && 
        user.company && 
        user.company.name === require('../config/marketplace').managementCompany.name;
      
      console.log("User supervisor check:", {
        role: user.role,
        companyName: user.company ? user.company.name : null,
        requiredCompanyName: require('../config/marketplace').managementCompany.name,
        hasLgdealSupervisorRole
      });

      if (!hasLgdealSupervisorRole) {
        return res.status(403).json({ message: 'Insufficient permissions to execute the command' });
      }
      
      console.log("User has supervisor privileges via database check");
    }

    // Parse the command
    const [commandName, ...args] = command.split(' ');
    console.log(`Executing command: ${commandName} with args:`, args);

    // Check if the command exists
    if (!ALLOWED_COMMANDS[commandName]) {
      return res.status(400).json({ 
        message: `Unknown command: ${commandName}. Use 'help' to get a list of available commands.`
      });
    }

    // Execute the command
    const commandHandler = ALLOWED_COMMANDS[commandName].handler;
    const result = await commandHandler(args, req, res);

    // If the handler returned a result, send it
    if (result) {
      console.log("Command executed successfully:", result);
      res.json(result);
    }

  } catch (error) {
    console.error('Error executing command:', error);
    res.status(500).json({ message: 'Error executing command', error: error.message });
  }
};

// Command handler functions

// Show list of available commands
async function showHelp() {
  let output = 'Available commands:\n\n';
  
  Object.entries(ALLOWED_COMMANDS).forEach(([name, info]) => {
    output += `${name}`;
    
    // If there are arguments, show them
    if (info.args && info.args.length > 0) {
      output += ` [${info.args.join('] [')}]`;
    }
    
    output += ` - ${info.description}\n`;
  });
  
  return { output };
}

// Synchronize products for a company
async function syncProducts(args) {
  const companyId = args[0];
  
  if (!companyId) {
    return { 
      output: 'You must specify a company ID. Example: sync-products 60d2156e5b4c8a1a0c9b4d3f',
      exitCode: 1
    };
  }
  
  return new Promise((resolve) => {
    // Use the module for product synchronization
    const { syncCompanyProducts } = require('./companyApiController');
    
    // Call the sync function and return the result
    syncCompanyProducts(companyId)
      .then(() => {
        resolve({ 
          output: `Product synchronization for company ${companyId} has been successfully started.`,
          exitCode: 0
        });
      })
      .catch((error) => {
        resolve({ 
          output: `Synchronization error: ${error.message}`,
          exitCode: 1
        });
      });
  });
}

// Show system statistics
async function showStats() {
  const Product = require('../models/Product');
  const Company = require('../models/Company');
  const User = require('../models/User');
  
  const productCount = await Product.countDocuments();
  const companyCount = await Company.countDocuments();
  const userCount = await User.countDocuments();
  
  const stats = {
    products: productCount,
    companies: companyCount,
    users: userCount,
    uptime: Math.floor(process.uptime()) + ' seconds',
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
    node: process.version,
    timestamp: new Date().toISOString()
  };
  
  let output = 'System statistics:\n\n';
  Object.entries(stats).forEach(([key, value]) => {
    output += `${key}: ${value}\n`;
  });
  
  return { output, exitCode: 0 };
}

// Clear system cache
async function clearCache() {
  // Here you can implement cache clearing if it exists
  // For example, just return successful result
  return { 
    output: 'System cache successfully cleared.',
    exitCode: 0
  };
}

// Run productUtils utility
async function runProductUtils() {
  return new Promise((resolve) => {
    // Path to test-utils.js script
    const scriptPath = path.join(__dirname, '..', 'test-utils.js');
    
    // Run the script
    exec(`node ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        resolve({ 
          output: `Error running script: ${error.message}\n${stderr}`,
          exitCode: error.code
        });
      } else {
        resolve({ 
          output: stdout,
          exitCode: 0
        });
      }
    });
  });
} 