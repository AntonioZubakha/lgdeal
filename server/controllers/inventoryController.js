const xlsx = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const User = require('../models/User');
const Company = require('../models/Company');
const Product = require('../models/Product');
const { v4: uuidv4 } = require('uuid');
const productUtils = require('../utils/productUtils');
const { generateProductReportXlsx } = require('../utils/reportUtils');
const telegramBot = require('../utils/telegramBot');
const syncQueue = require('../utils/syncQueue');

// Parse XLSX file
const parseXlsxFile = (filePath) => {
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  
  if (data.length < 2) {
    throw new Error('File doesn\'t contain enough rows. Need headers and at least one data row.');
  }
  
  const headers = data[0];
  const headerMap = {};
  
  // Map headers to field names
  headers.forEach((header, index) => {
    if (!header) return;
    const fieldName = productUtils.findMatchingField(header);
    if (fieldName) {
      headerMap[index] = fieldName;
    }
  });
  
  // Map rows to products
  const products = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const product = {};
    
    Object.entries(headerMap).forEach(([colIndex, fieldName]) => {
      const value = row[colIndex];
      if (value !== undefined) {
        product[fieldName] = value;
      }
    });
    
    // ID is NOT generated here anymore. It will be handled by processProducts and controllers.
    // if (!product.id) {
    //   product.id = uuidv4();
    // }
    
    products.push(product);
  }
  
  return products;
};

// Parse CSV file
const parseCsvFile = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const headerMap = {};
    let headerProcessed = false;
    
    const stream = fs.createReadStream(filePath);
    
    stream
      .pipe(csv())
      .on('headers', (headers) => {
        // Map headers to field names
        headers.forEach((header, index) => {
          const fieldName = productUtils.findMatchingField(header);
          if (fieldName) {
            headerMap[header] = fieldName;
          }
        });
        headerProcessed = true;
      })
      .on('data', (data) => {
        if (!headerProcessed) return;
        
        const product = {};
        
        Object.entries(data).forEach(([headerName, value]) => {
          const fieldName = headerMap[headerName];
          if (fieldName && value !== undefined) {
            product[fieldName] = value;
          }
        });
        
        // ID is NOT generated here anymore.
        // if (!product.id) {
        //   product.id = uuidv4();
        // }
        
        results.push(product);
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

// Renamed processProducts to _processInventoryFileInBackground and adapted
async function _processInventoryFileInBackground(filePath, userId, companyId, companyName, originalFileName, uploadMode = 'replace') {
  const startTime = Date.now();
  console.log(`[FileBGProcessing] Company: ${companyName} (${companyId}), File: ${originalFileName} - Starting background processing.`);
  let parsedProducts;
  const allProcessedProductsDetailed = [];
  const stats = {
    totalUploaded: 0, // Will be set after parsing
    processed: 0,
    created: 0,
    updated: 0,
    skippedByBlacklist: 0,
    skippedExistingOnDealOrSold: 0,
    skippedInvalidStatus: 0,
    skippedInvalidColor: 0,
    replacedOtherCompanyProduct: 0,
    skippedCheaperExistsOtherCompany: 0,
    skippedInvalidClarity: 0,
    skippedInvalidPrice: 0,
    skippedInvalidCarat: 0,
    skippedMissingMedia: 0
  };

  try {
    await telegramBot.sendSyncStartNotification(companyId, `${companyName} (File: ${originalFileName})`);
    console.log(`[FileBGProcessing] Company: ${companyName}, File: ${originalFileName} - Parsing file...`);

    const fileExt = path.extname(originalFileName).toLowerCase();
    if (fileExt === '.xlsx' || fileExt === '.xls') {
      parsedProducts = parseXlsxFile(filePath);
    } else if (fileExt === '.csv') {
      parsedProducts = await parseCsvFile(filePath);
    } else {
      throw new Error('Unsupported file format for background processing.');
    }
    stats.totalUploaded = parsedProducts.length;
    console.log(`[FileBGProcessing] Company: ${companyName}, File: ${originalFileName} - Parsed. Found ${stats.totalUploaded} products.`);
    await telegramBot.sendSyncProgressNotification(companyId, companyName, originalFileName, `File parsed. Found ${stats.totalUploaded} products. Starting data processing...`);

    console.log(`[FileBGProcessing] Company: ${companyName}, File: ${originalFileName} - Fetching blacklist and existing products...`);
    // Get certificate numbers from incoming products for blacklist check
    const incomingCertificateDetails = parsedProducts.map(p => ({
      number: productUtils.getFieldValue(p, 'certificateNumber', productUtils.COLUMN_MAPPINGS.certificateNumber.slice(1)),
      institute: productUtils.getFieldValue(p, 'certificateInstitute', productUtils.COLUMN_MAPPINGS.certificateInstitute.slice(1))
    }));

    const certificateNumbersToQuery = incomingCertificateDetails
      .map(detail => detail.number ? String(detail.number).trim() : null)
      .filter(num => num);

    const BlacklistedCertificate = require('../models/BlacklistedCertificate');
    const blacklistedCerts = await BlacklistedCertificate.find({
      certificateNumber: { $in: certificateNumbersToQuery }
    }).select('certificateNumber -_id');
    const blacklistedCertSet = new Set(blacklistedCerts.map(cert => cert.certificateNumber));

    const existingCompanyProducts = await Product.find({
      company: companyId,
      status: { $nin: ['OnDeal', 'Sold'] }
    });
    const existingProductsMap = new Map();
    existingCompanyProducts.forEach(p => {
      if (p.certificateNumber && p.certificateInstitute) {
        const key = `${p.certificateNumber}#${p.certificateInstitute}`.toUpperCase();
        existingProductsMap.set(key, p);
      }
    });

    const productsOnDealOrSold = await Product.find({
        company: companyId,
        status: { $in: ['OnDeal', 'Sold'] }
    });
    const onDealOrSoldCertKeySet = new Set();
    productsOnDealOrSold.forEach(p => {
        if (p.certificateNumber && p.certificateInstitute) {
            onDealOrSoldCertKeySet.add(`${p.certificateNumber}#${p.certificateInstitute}`.toUpperCase());
        }
    });
    console.log(`[FileBGProcessing] Company: ${companyName}, File: ${originalFileName} - Data fetching complete. Starting main product loop.`);

    const operations = [];
    const productsToPotentiallyDeleteIds = new Set(existingCompanyProducts.map(p => p._id.toString()));
    let processedCount = 0;

    for (const rawProduct of parsedProducts) {
      processedCount++;
      if (processedCount % 5000 === 0) {
        console.log(`[FileBGProcessing] Company: ${companyName}, File: ${originalFileName} - Processing product ${processedCount} of ${stats.totalUploaded}...`);
      }
      const processingResult = productUtils.processProduct(rawProduct, companyId, stats);
      if (!processingResult.data) { 
        allProcessedProductsDetailed.push({
          sourceProduct: rawProduct, status: 'Skipped', reason: processingResult.reason, systemId: null, finalData: null
        });
        continue;
      }
      const processedProductData = processingResult.data;
      const certNum = processedProductData.certificateNumber;
      const certInst = processedProductData.certificateInstitute;
      const currentProductCertKey = (certNum && certInst) ? `${certNum}#${certInst}`.toUpperCase() : null;

      if (certNum && blacklistedCertSet.has(certNum)) {
        stats.skippedByBlacklist++;
        allProcessedProductsDetailed.push({ sourceProduct: rawProduct, status: 'Skipped', reason: 'blacklisted', systemId: null, finalData: processedProductData });
        continue;
      }
      if (currentProductCertKey && onDealOrSoldCertKeySet.has(currentProductCertKey)) {
        stats.skippedExistingOnDealOrSold++;
        allProcessedProductsDetailed.push({ sourceProduct: rawProduct, status: 'Skipped', reason: 'on_deal_or_sold', systemId: null, finalData: processedProductData });
        continue;
      }
      
      let existingProductMatch = null;
      if (currentProductCertKey) {
        existingProductMatch = existingProductsMap.get(currentProductCertKey);
      }

      if (existingProductMatch) { 
        productsToPotentiallyDeleteIds.delete(existingProductMatch._id.toString()); 
        stats.updated++;
        const updatePayload = { ...processedProductData, id: existingProductMatch.id, link: `/product/${existingProductMatch.id}`, updatedAt: new Date() };
        operations.push({ updateOne: { filter: { _id: existingProductMatch._id }, update: { $set: updatePayload } } });
        allProcessedProductsDetailed.push({ sourceProduct: rawProduct, status: 'Updated', reason: null, systemId: existingProductMatch.id, finalData: updatePayload });
      } else { 
        let createThisProduct = true;
        if (certNum && certInst) { 
            const conflictingProduct = await Product.findOne({
                certificateNumber: certNum, certificateInstitute: certInst, company: { $ne: companyId }, status: { $nin: ['OnDeal', 'Sold'] } 
            });
            if (conflictingProduct) {
                if (processedProductData.price < conflictingProduct.price) {
                    operations.push({ deleteOne: { filter: { _id: conflictingProduct._id } } });
                    stats.replacedOtherCompanyProduct++;
                } else {
                    createThisProduct = false;
                    stats.skippedCheaperExistsOtherCompany++;
                    allProcessedProductsDetailed.push({ sourceProduct: rawProduct, status: 'Skipped', reason: 'cheaper_exists_other_company', systemId: null, finalData: processedProductData });
                }
            }
        }
        if (createThisProduct) {
          stats.created++;
          const newSystemId = uuidv4();
          const insertPayload = { ...processedProductData, id: newSystemId, company: companyId, link: `/product/${newSystemId}`, createdAt: new Date(), updatedAt: new Date(), onDeal: false, sold: false };
          operations.push({ insertOne: { document: insertPayload } });
          allProcessedProductsDetailed.push({ sourceProduct: rawProduct, status: 'Created', reason: null, systemId: newSystemId, finalData: insertPayload });
        }
      }
    }
    stats.processed = stats.created + stats.updated;
    console.log(`[FileBGProcessing] Company: ${companyName}, File: ${originalFileName} - Main product loop complete. Processed: ${stats.processed}, Created: ${stats.created}, Updated: ${stats.updated}.`);

    if (uploadMode === 'replace') {
      productsToPotentiallyDeleteIds.forEach(idToDelete => {
        operations.push({ deleteOne: { filter: { _id: idToDelete } } });
      });
    }

    if (operations.length > 0) {
      console.log(`[FileBGProcessing] Company: ${companyName}, File: ${originalFileName} - Executing ${operations.length} database operations...`);
      await Product.bulkWrite(operations, { ordered: false });
      console.log(`[FileBGProcessing] Company: ${companyName}, File: ${originalFileName} - Database operations complete.`);
    } else {
      console.log(`[FileBGProcessing] Company: ${companyName}, File: ${originalFileName} - No database operations to execute.`);
    }

    console.log(`[FileBGProcessing] Company: ${companyName}, File: ${originalFileName} - Generating report...`);
    let reportPath = null;
    try {
      reportPath = generateProductReportXlsx(allProcessedProductsDetailed, companyName || companyId.toString());
      console.log(`[FileBGProcessing] Company: ${companyName}, File: ${originalFileName} - Report generated at ${reportPath}`);
    } catch (reportError) {
      console.error(`[XLSX Report Error] Failed to generate report during file upload for company ${companyId}: ${reportError.message}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const statsForTelegram = {
      totalProducts: stats.totalUploaded, processed: stats.processed, created: stats.created, updated: stats.updated,
      skippedInvalidColor: stats.skippedInvalidColor, skippedInvalidStatus: stats.skippedInvalidStatus,
      skippedByBlacklist: stats.skippedByBlacklist, skippedOnDealOrSold: stats.skippedExistingOnDealOrSold,
      replacedOtherCompanyProduct: stats.replacedOtherCompanyProduct, skippedCheaperExistsOtherCompany: stats.skippedCheaperExistsOtherCompany,
      skippedInvalidClarity: stats.skippedInvalidClarity, skippedInvalidPrice: stats.skippedInvalidPrice,
      skippedInvalidCarat: stats.skippedInvalidCarat, skippedMissingMedia: stats.skippedMissingMedia,
      apiErrors: 0, skippedByApiFilter: 0, duration,
    };
    await telegramBot.sendSyncSuccessNotification(companyId, statsForTelegram, `${companyName} (File: ${originalFileName})`, reportPath);
    console.log(`[FileBGProcessing] Company: ${companyName}, File: ${originalFileName} - Successfully processed. Notifications sent.`);

  } catch (error) {
    console.error(`Error processing file ${originalFileName} for company ${companyName}:`, error);
    await telegramBot.sendSyncErrorNotification(companyId, error, `${companyName} (File: ${originalFileName})`);
  } finally {
    // Clean up the temporary file
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Successfully deleted temporary file: ${filePath}`);
      }
    } catch (e) {
      console.error(`Error deleting temporary file ${filePath}:`, e);
    }
  }
}

// Export uploadInventory function to handle file uploads
exports.uploadInventory = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    if (!req.user || !req.user.userId) {
        // Clean up uploaded file if user is not authenticated
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        return res.status(401).json({ message: 'User not authenticated' });
    }

    const userId = req.user.userId;
    const userInfo = await User.findById(userId).populate('company');

    if (!userInfo || !userInfo.company) {
      // Clean up uploaded file if user or company not found
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ message: 'User or company not found.' });
    }
    
    const companyId = userInfo.company._id;
    const companyName = userInfo.company.name || 'Unknown Company';
    const filePath = req.file.path;
    const originalFileName = req.file.originalname;
    const uploadMode = req.body.mode || 'replace';

    // Add to queue
    syncQueue.add(async () => {
      await _processInventoryFileInBackground(filePath, userId, companyId, companyName, originalFileName, uploadMode);
    })
    .then(() => {
      console.log(`File processing task for ${originalFileName} completed for company ${companyName}`);
    })
    .catch(error => {
      // This catch is for errors in adding to queue or unhandled promise rejections from the task itself,
      // though _processInventoryFileInBackground should handle its own errors and notify.
      console.error(`Error in syncQueue task for file ${originalFileName}:`, error);
      // Comment out the problematic call to sendGenericNotification
      // telegramBot.sendGenericNotification('ADMIN_OR_DEV_CHAT_ID', `Critical error in syncQueue for file ${originalFileName}, company ${companyName}: ${error.message}`);
       // Clean up the temporary file in case of critical queue error
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Cleaned up temporary file ${filePath} due to queue error.`);
            }
        } catch (e) {
            console.error(`Error deleting temporary file ${filePath} after queue error:`, e);
        }
    });

    res.status(202).json({ 
        message: `File '${originalFileName}' uploaded successfully and queued for processing. You will be notified upon completion.`,
        mode: uploadMode 
    });
    
  } catch (error) {
    console.error('Error in uploadInventory endpoint:', error);
    // Ensure uploaded file is cleaned up if an error occurs before queueing
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
            fs.unlinkSync(req.file.path);
        } catch (e) {
            console.error(`Error deleting temp file ${req.file.path} during uploadInventory error handling:`, e);
        }
    }
    res.status(500).json({ message: error.message || 'Server error during file upload initiation.' });
  }
};

// Get company inventory
exports.getInventory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!user.company) {
      return res.status(400).json({ message: 'User is not associated with any company' });
    }
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 200;
    const skip = (page - 1) * limit;
    
    // Counting total products
    const total = await Product.countDocuments({ company: user.company });
    
    // Get products with pagination
    const products = await Product.find({ company: user.company })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    res.json({
      products,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Error getting inventory:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get a single product
exports.getProduct = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!user.company) {
      return res.status(400).json({ message: 'User is not associated with any company' });
    }
    
    const productId = req.params.id;
    const product = await Product.findOne({ id: productId, company: user.company });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
    
  } catch (error) {
    console.error('Error getting product:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update a product (manual update, not part of bulk upload)
exports.updateProduct = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    
    if (!user || !user.company) {
      return res.status(400).json({ message: 'User or user company not found' });
    }
    
    const systemIdToUpdate = req.params.id; // This is our internal system ID (UUID)
    console.log('Updating product with internal system ID:', systemIdToUpdate);
    
    const productToUpdate = await Product.findOne({ id: systemIdToUpdate, company: user.company });
    
    if (!productToUpdate) {
      return res.status(404).json({ message: 'Product not found or not authorized' });
    }

    // Use a modified productUtils.formatProductData or a specific one for single updates.
    // For now, assuming req.body is already somewhat conformed. Critical fields like ID and company should not change here.
    const updateData = { ...req.body };
    delete updateData.id; // Prevent changing our system ID
    delete updateData.company; // Prevent changing company
    delete updateData.link; // Link is derived
    delete updateData.createdAt; // Should not be changed

    // Re-process/validate certain fields if necessary, e.g., color, status
    if (updateData.color) {
        const colorValidation = productUtils.validateDiamondColor(updateData.color);
        if (!colorValidation.isValid) {
            return res.status(400).json({ message: `Invalid color: ${updateData.color}. Only D, E, F, G allowed.`});
        }
        updateData.color = colorValidation.normalizedColor;
        updateData.stoneType = productUtils.determineStoneType(updateData.color);
    }
    if (updateData.status) {
        const statusValidation = productUtils.validateProductStatus(updateData.status);
        // Allow manual update to various statuses, not just 'available' like in bulk import
        updateData.status = statusValidation.normalizedStatus; 
        // but if it was invalid for import, it might still be invalid depending on enum
        if (!Product.schema.path('status').enumValues.includes(updateData.status)){
             return res.status(400).json({ message: `Invalid status: ${updateData.status}.`});
        }
    }
    if (updateData.certificateNumber) {
        updateData.certificateNumber = String(updateData.certificateNumber).trim();
    }
    if (updateData.certificateInstitute) {
        updateData.certificateInstitute = String(updateData.certificateInstitute).trim().toUpperCase();
    }

    // Update other fields as provided
    const finalUpdateData = { ...productToUpdate.toObject(), ...updateData };
    finalUpdateData.updatedAt = new Date();
    finalUpdateData.link = `/product/${productToUpdate.id}`; // Re-generate link with existing system ID
    
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productToUpdate._id }, // Match by MongoDB _id for safety
      { $set: finalUpdateData },
      { new: true }
    );
    
    if (!updatedProduct) {
      return res.status(404).json({ message: 'Failed to update product' });
    }
    
    console.log('Product updated successfully:', updatedProduct.id);
    res.json(updatedProduct);
    
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
}; 