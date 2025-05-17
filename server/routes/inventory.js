const express = require('express');
const router = express.Router();
const multer = require('multer');
const inventoryController = require('../controllers/inventoryController');
const auth = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// Ensure the temporary upload directory exists
const tempUploadDir = path.join(__dirname, '../uploads/inventory_temp');
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

// Configure multer for disk storage for inventory files
const inventoryStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempUploadDir);
  },
  filename: function (req, file, cb) {
    // Create a unique filename to avoid conflicts
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExt = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + fileExt);
  }
});

const upload = multer({ 
  storage: inventoryStorage,
  limits: {
    fileSize: 90 * 1024 * 1024, // Limit file size to 80MB
  },
  fileFilter: (req, file, cb) => {
    // Accept only xlsx, xls and csv files
    if (file.originalname.match(/\.(xlsx|xls|csv)$/)) {
      return cb(null, true);
    }
    cb(new Error('Only .xlsx, .xls or .csv files are allowed!'));
  }
});

// @route   POST api/inventory/upload
// @desc    Upload inventory file (xlsx or csv)
// @access  Private
router.post('/upload', auth, upload.single('file'), inventoryController.uploadInventory);

// @route   GET api/inventory
// @desc    Get company inventory
// @access  Private
router.get('/', auth, inventoryController.getInventory);

// @route   PUT api/inventory/:id
// @desc    Update a product
// @access  Private
router.put('/:id', auth, inventoryController.updateProduct);

// @route   GET api/inventory/:id
// @desc    Get a single product
// @access  Private
router.get('/:id', auth, inventoryController.getProduct);

module.exports = router; 