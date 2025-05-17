const CompanyApiConfig = require('../models/CompanyApiConfig');
const Company = require('../models/Company');
const Product = require('../models/Product');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const syncQueue = require('../utils/syncQueue');
const telegramBot = require('../utils/telegramBot');
const productUtils = require('../utils/productUtils');
const { generateProductReportXlsx } = require('../utils/reportUtils');

// Get API config for a company
exports.getApiConfig = async (req, res) => {
  try {
    console.log('Getting API config for company:', req.params.companyId);
    const config = await CompanyApiConfig.findOne({ company: req.params.companyId })
      .populate('company', 'name');
    
    console.log('Found config:', config);
    
    if (!config) {
      return res.status(404).json({ message: 'API configuration not found' });
    }
    
    // Преобразуем Map в обычные объекты перед отправкой
    const responseConfig = config.toObject();
    
    console.log('Sending config to client:', responseConfig);
    res.json(responseConfig);
  } catch (error) {
    console.error('Error fetching API config:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create or update API config
exports.updateApiConfig = async (req, res) => {
  try {
    console.log('Updating API config for company:', req.params.companyId);
    console.log('Request body:', req.body);
    
    const { url, requestType, headers, params, dataKey, filter, syncSchedule, tokenAuthConfig } = req.body;
    
    let config = await CompanyApiConfig.findOne({ company: req.params.companyId });
    
    if (config) {
      console.log('Updating existing config');
      // Update existing config
      config.config.url = url;
      config.config.requestType = requestType;
      // Assign directly from req.body as they are now Mixed types
      if (headers !== undefined) config.config.headers = headers;
      if (params !== undefined) config.config.params = params;
      if (dataKey !== undefined) config.config.dataKey = dataKey; // dataKey is still a String
      if (filter !== undefined) config.config.filter = filter; // filter is Mixed
      
      if (syncSchedule) {
        config.syncSchedule = syncSchedule;
      }
      if (tokenAuthConfig) { // Handle tokenAuthConfig update
        config.tokenAuthConfig = tokenAuthConfig;
      }
    } else {
      console.log('Creating new config');
      
      const companyIdParam = String(req.params.companyId); 
      const requestBody = req.body || {}; 

      const { 
        url: bodyUrl, // Renamed to avoid conflict with outer scope url if any
        requestType: bodyRequestType, 
        headers: bodyHeaders, 
        params: bodyParams, 
        dataKey: bodyDataKey, 
        filter: bodyFilter, 
        syncSchedule: bodySyncSchedule, 
        tokenAuthConfig: bodyTokenAuthConfig // Make sure to destructure tokenAuthConfig
      } = requestBody;

      const companyExists = await Company.findById(companyIdParam);
      if (!companyExists) {
        console.warn(`Attempted to create API config for non-existent company: ${companyIdParam}`);
        return res.status(404).json({ message: `Company with ID ${companyIdParam} not found. Cannot create API config.` });
      }

      config = new CompanyApiConfig({
        company: companyIdParam,
        config: {
          url: bodyUrl, 
          requestType: bodyRequestType || 'get',
          headers: bodyHeaders || {},
          params: bodyParams || {},
          dataKey: (bodyDataKey === undefined ? 'data' : bodyDataKey), 
          filter: bodyFilter || {}
        },
        syncSchedule: bodySyncSchedule || { frequency: 'daily', timeOfDay: '00:00' },
        tokenAuthConfig: bodyTokenAuthConfig || { enabled: false } // Add tokenAuthConfig for new config
      });
    }
    
    // Обновляем ссылку на конфигурацию в модели Company
    const company = await Company.findById(req.params.companyId);
    if (company) {
      company.apiConfig = config._id;
      await company.save();
      console.log('Updated company with config reference');
    }
    
    await config.save();
    console.log('Saved config:', config);
    
    // Преобразуем Map в обычные объекты перед отправкой
    const responseConfig = config.toObject();
    
    console.log('Sending config to client:', responseConfig);
    res.json(responseConfig);
  } catch (error) {
    console.error('Error updating API config:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Trigger manual sync for a company
exports.triggerSync = async (req, res) => {
  try {
    const config = await CompanyApiConfig.findOne({ company: req.params.companyId });
    
    if (!config) {
      return res.status(404).json({ message: 'API configuration not found' });
    }
    
    // Get company name
    const company = await Company.findById(req.params.companyId);
    const companyName = company ? company.name : 'Unknown';
    
    // --- A. Сброс stuck-синхронизации по lastSync или updatedAt ---
    const FIVE_MIN = 5 * 60 * 1000;
    if (config.syncStatus === 'in_progress') {
      let stuck = false;
      if (config.lastSync && (Date.now() - new Date(config.lastSync).getTime() > FIVE_MIN)) stuck = true;
      if (!config.lastSync && config.updatedAt && (Date.now() - new Date(config.updatedAt).getTime() > FIVE_MIN)) stuck = true;
      if (stuck) {
        console.log('Resetting stuck sync status for company:', req.params.companyId);
        config.syncStatus = 'idle';
        config.lastSyncError = 'Previous sync was interrupted';
        await config.save();
      } else {
        return res.status(400).json({ message: 'Sync already in progress' });
      }
    }

    // --- B. Защита от дублирующихся задач в очереди ---
    if (syncQueue.getPendingCompanyIds && typeof syncQueue.getPendingCompanyIds === 'function') {
      const pendingIds = syncQueue.getPendingCompanyIds();
      if (pendingIds.includes(config._id.toString())) {
        return res.status(400).json({ message: 'Sync already queued' });
      }
    }
    
    // Start sync process
    config.syncStatus = 'in_progress';
    config.lastSyncError = null;
    await config.save();

    // Add sync task to queue
    const queueStatus = syncQueue.getStatus();
    console.log(`Adding sync task to queue. Current status: ${JSON.stringify(queueStatus)}`);
    
    // Send queue status notification and wait for it
    console.log('Sending queue status notification...');
    await telegramBot.sendQueueUpdateNotification({
      ...queueStatus,
      companyId: req.params.companyId,
      companyName
    });
    
    // --- C. Гарантированное обновление статуса при ошибках ---
    syncQueue.add(async () => {
      try {
        await syncCompanyProducts(config._id);
      } catch (error) {
        console.error(`Sync failed for company ${req.params.companyId}:`, error);
        await CompanyApiConfig.findByIdAndUpdate(config._id, {
          syncStatus: 'error',
          lastSyncError: error.message
        });
      }
    })
      .then(() => {
        console.log(`Sync completed for company ${req.params.companyId}`);
      });
    
    res.json({ 
      message: 'Sync task added to queue',
      queueStatus: {
        running: queueStatus.running,
        queued: queueStatus.queued + 1
      }
    });
  } catch (error) {
    console.error('Error triggering sync:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add new endpoint to get queue status
exports.getSyncQueueStatus = async (req, res) => {
  try {
    const status = syncQueue.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper function to get value from object by path string (e.g., 'data.token')
function getValueByPath(obj, path) {
  if (!path || typeof path !== 'string') { 
    if (path === '' && obj !== undefined) return obj; 
    return undefined;
  }
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

// New helper function to fetch authentication tokens
async function getAuthTokens(tokenAuthConfig) {
  console.log('Attempting to fetch auth tokens with config:', JSON.stringify(tokenAuthConfig, null, 2));
  if (!tokenAuthConfig || !tokenAuthConfig.enabled || !tokenAuthConfig.url) {
    console.log('Token auth is disabled or URL is missing.');
    return {};
  }

  const {
    url,
    requestType = 'post',
    params = {},
    headers = {},
    bodyPayload = {},
    bodyEncodeType = 'json',
    tokensPathInResponse = 'token', // Can be a string like 'data.token' or an object like { accessToken: 'data.access_token' }
  } = tokenAuthConfig;

  const tokenRequestConfig = {
    method: requestType,
    url: url,
    headers: headers, // Assuming headers is already an object
    params: params,   // Assuming params is already an object
  };

  if (requestType.toLowerCase() === 'post') {
    if (bodyEncodeType === 'json') {
      tokenRequestConfig.data = bodyPayload;
      if (!tokenRequestConfig.headers['Content-Type']) {
        tokenRequestConfig.headers['Content-Type'] = 'application/json';
      }
    } else if (bodyEncodeType === 'form') {
      tokenRequestConfig.data = new URLSearchParams(bodyPayload).toString();
      if (!tokenRequestConfig.headers['Content-Type']) {
        tokenRequestConfig.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    } else if (bodyEncodeType === 'string') {
      tokenRequestConfig.data = typeof bodyPayload === 'string' ? bodyPayload : JSON.stringify(bodyPayload);
      // User should set Content-Type header manually if needed for string type
    }
  }

  try {
    console.log('Token request config:', JSON.stringify(tokenRequestConfig, null, 2));
    const response = await axios(tokenRequestConfig);
    console.log('Token API response status:', response.status);
    console.log('Token API response data:', JSON.stringify(response.data, null, 2));

    const extractedTokens = {};
    if (typeof tokensPathInResponse === 'string') {
      const tokenValue = getValueByPath(response.data, tokensPathInResponse);
      if (tokenValue !== undefined) {
        extractedTokens.defaultToken = tokenValue; // Using a generic key for single string path
      } else {
        console.warn(`Could not extract token using path: ${tokensPathInResponse}`);
      }
    } else if (typeof tokensPathInResponse === 'object' && tokensPathInResponse !== null) {
      for (const key in tokensPathInResponse) {
        const path = tokensPathInResponse[key];
        const tokenValue = getValueByPath(response.data, path);
        if (tokenValue !== undefined) {
          extractedTokens[key] = tokenValue;
        } else {
          console.warn(`Could not extract token for key '${key}' using path: ${path}`);
        }
      }
    } else {
      console.warn('tokensPathInResponse is not a string or a valid object. Cannot extract tokens.');
      // Attempt to use raw response data if path is trivial like empty or '/'
      if (!tokensPathInResponse && response.data) {
         // If the entire response IS the token (e.g. a plain string token)
        if (typeof response.data === 'string' || typeof response.data === 'number') {
            extractedTokens.defaultToken = response.data;
        } else {
             console.warn('Raw response data is not a simple string/number, cannot directly use as token.');
        }
      }
    }
    
    if (Object.keys(extractedTokens).length === 0) {
        console.warn('No tokens were extracted. Check tokensPathInResponse and API response structure.');
    }

    console.log('Extracted tokens:', extractedTokens);
    return extractedTokens;

  } catch (error) {
    console.error('Error fetching auth tokens:', error.message);
    if (error.response) {
      console.error('Token API error response:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      });
    }
    throw new Error(`Failed to fetch authentication tokens: ${error.message}`); // Re-throw to be caught by syncCompanyProducts
  }
}

// Internal function to sync products
async function syncCompanyProducts(configId) {
  const config = await CompanyApiConfig.findById(configId);
  if (!config) return;
  
  const startTime = Date.now();
  const allProcessedProductsDetailed = []; // Initialize detailed log array

  const stats = {
    totalFromApi: 0,
    processed: 0,
    created: 0,
    updated: 0,
    skippedByBlacklist: 0,
    skippedExistingOnDealOrSold: 0,
    skippedInvalidStatus: 0,
    skippedInvalidColor: 0,
    apiErrors: 0,
    replacedOtherCompanyProduct: 0,
    skippedCheaperExistsOtherCompany: 0,
    skippedInvalidClarity: 0,
    skippedInvalidPrice: 0,
    skippedInvalidCarat: 0,
    skippedMissingMedia: 0,
    skippedByApiFilter: 0
  };

  try {
    const company = await Company.findById(config.company);
    const companyName = company ? company.name : 'Unknown Company'; // Added default for companyName
    const companyId = config.company;

    await telegramBot.sendSyncStartNotification(companyId, companyName);

    let acquiredAuthTokens = {};
    if (config.tokenAuthConfig && config.tokenAuthConfig.enabled && config.tokenAuthConfig.url) {
      try {
        acquiredAuthTokens = await getAuthTokens(config.tokenAuthConfig);
        if (Object.keys(acquiredAuthTokens).length === 0 && config.tokenAuthConfig.tokenUsage && config.tokenAuthConfig.tokenUsage.length > 0) {
          console.warn('Token authentication enabled, but no tokens were acquired. This might lead to sync failure.');
          // Potentially throw error if tokens are strictly required by any usage rule
        }
      } catch (tokenError) {
        stats.apiErrors++;
        config.syncStatus = 'error',
        config.lastSyncError = `Token acquisition failed: ${tokenError.message}`;
        await config.save();
        await telegramBot.sendSyncErrorNotification(companyId, new Error(config.lastSyncError), companyName);
        return;
      }
    }

    const requestConfig = {
      method: config.config.requestType,
      url: config.config.url,
      headers: { ...(config.config.headers || {}) },
      params: { ...(config.config.params || {}) },
      timeout: 60000 // Increased timeout to 60 seconds
    };

    if (config.tokenAuthConfig && config.tokenAuthConfig.enabled && config.tokenAuthConfig.tokenUsage && Object.keys(acquiredAuthTokens).length > 0) {
      config.tokenAuthConfig.tokenUsage.forEach(usageRule => {
        const tokenKey = usageRule.nameInResponse || 'defaultToken';
        const tokenValue = acquiredAuthTokens[tokenKey];
        if (tokenValue === undefined || tokenValue === null) return;
        const placeholder = usageRule.placeholderName;
        switch (usageRule.placement) {
          case 'header':
            if (usageRule.destinationName) {
              if (usageRule.destinationName.includes(placeholder)) {
                requestConfig.headers[usageRule.destinationName.split(':')[0].trim()] = usageRule.destinationName.replace(placeholder, tokenValue);
              } else {
                requestConfig.headers[usageRule.destinationName] = tokenValue.toString(); 
              }
            }
            break;
          case 'param':
            if (usageRule.destinationName) requestConfig.params[usageRule.destinationName] = tokenValue.toString();
            break;
          case 'url_segment':
            if (placeholder && requestConfig.url.includes(placeholder)) {
              requestConfig.url = requestConfig.url.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'g'), tokenValue.toString());
            }
            break;
        }
      });
    }

    const response = await axios(requestConfig).catch(err => {
        stats.apiErrors++;
        throw err; // Re-throw to be caught by outer try-catch
    });
    
    let apiProductsSource = getValueByPath(response.data, config.config.dataKey);
    if (!Array.isArray(apiProductsSource)) {
      stats.apiErrors++;
      throw new Error(`Expected array of products from API, got ${typeof apiProductsSource}. Path: '${config.config.dataKey}'`);
    }
    stats.totalFromApi = apiProductsSource.length; // Total before any of our filtering

    // Log first 5 raw products from API for inspection
    console.log(`[Sync Info] Company: ${companyId}, First 5 raw products from API (or fewer if less than 5):`);
    for (let i = 0; i < Math.min(5, apiProductsSource.length); i++) {
      console.log(`[Sync Info] Raw product ${i + 1}: ${JSON.stringify(apiProductsSource[i])}`);
    }

    let productsToProcess = apiProductsSource;
    // Apply API-level filters if they exist
    const apiFilters = config.config.filter ? Object.fromEntries(config.config.filter) : {};
    if (Object.keys(apiFilters).length > 0) {
      productsToProcess = apiProductsSource.filter(p => {
        const match = Object.entries(apiFilters).every(([key, value]) => productUtils.getFieldValue(p, key) === value);
        if (!match) {
          allProcessedProductsDetailed.push({
            sourceProduct: p,
            status: 'Skipped',
            reason: 'api_filter',
            systemId: null,
            finalData: null
          });
        }
        return match;
      });
      stats.skippedByApiFilter = apiProductsSource.length - productsToProcess.length;
    }

    const certificateNumbersToQuery = productsToProcess
      .map(p => {
          const certNoRaw = productUtils.getFieldValue(p, 'certificateNumber', productUtils.COLUMN_MAPPINGS.certificateNumber.slice(1));
          return certNoRaw ? String(certNoRaw).trim() : null;
      })
      .filter(num => num);

    const BlacklistedCertificate = require('../models/BlacklistedCertificate');
    const blacklistedCerts = await BlacklistedCertificate.find({ certificateNumber: { $in: certificateNumbersToQuery } }).select('certificateNumber -_id');
    const blacklistedCertSet = new Set(blacklistedCerts.map(cert => cert.certificateNumber));

    const existingCompanyProducts = await Product.find({ company: companyId, status: { $nin: ['OnDeal', 'Sold'] } });
    const existingProductsMap = new Map();
    existingCompanyProducts.forEach(p => {
      if (p.certificateNumber && p.certificateInstitute) {
        const key = `${p.certificateNumber}#${p.certificateInstitute}`.toUpperCase();
        existingProductsMap.set(key, p);
      }
    });

    const productsOnDealOrSold = await Product.find({ company: companyId, status: { $in: ['OnDeal', 'Sold'] } });
    const onDealOrSoldCertKeySet = new Set();
    productsOnDealOrSold.forEach(p => {
      if (p.certificateNumber && p.certificateInstitute) {
        onDealOrSoldCertKeySet.add(`${p.certificateNumber}#${p.certificateInstitute}`.toUpperCase());
      }
    });

    const operations = [];
    const productsToPotentiallyDeleteIds = new Set(existingCompanyProducts.map(p => p._id.toString()));

    for (const rawProduct of productsToProcess) { 
      const processingResult = productUtils.processProduct(rawProduct, companyId, stats);

      if (!processingResult.data) {
        allProcessedProductsDetailed.push({
          sourceProduct: rawProduct,
          status: 'Skipped',
          reason: processingResult.reason,
          systemId: null,
          finalData: null
        });
        continue;
      }
      const processedProductData = processingResult.data;

      const certNum = processedProductData.certificateNumber;
      const certInst = processedProductData.certificateInstitute;
      const currentProductCertKey = (certNum && certInst) ? `${certNum}#${certInst}`.toUpperCase() : null;

      if (certNum && blacklistedCertSet.has(certNum)) {
        stats.skippedByBlacklist++;
        allProcessedProductsDetailed.push({
          sourceProduct: rawProduct,
          status: 'Skipped',
          reason: 'blacklisted',
          systemId: null,
          finalData: processedProductData // Store processed data even if skipped later
        });
        continue;
      }
      if (currentProductCertKey && onDealOrSoldCertKeySet.has(currentProductCertKey)) {
        stats.skippedExistingOnDealOrSold++;
        allProcessedProductsDetailed.push({
          sourceProduct: rawProduct,
          status: 'Skipped',
          reason: 'on_deal_or_sold',
          systemId: null,
          finalData: processedProductData
        });
        continue;
      }
      
      let existingProductMatch = null;
      if (currentProductCertKey) {
        existingProductMatch = existingProductsMap.get(currentProductCertKey);
      }

      if (existingProductMatch) {
        productsToPotentiallyDeleteIds.delete(existingProductMatch._id.toString());
        stats.updated++;
        const updatePayload = {
          ...processedProductData,
          id: existingProductMatch.id, 
          link: `https://in-diamonds.com/product/${existingProductMatch.id}`,
          updatedAt: new Date()
        };
        operations.push({
          updateOne: {
            filter: { _id: existingProductMatch._id },
            update: { $set: updatePayload }
          }
        });
        allProcessedProductsDetailed.push({
          sourceProduct: rawProduct,
          status: 'Updated',
          reason: null,
          systemId: existingProductMatch.id,
          finalData: updatePayload
        });
      } else {
        let createThisProduct = true;

        if (certNum && certInst) {
            const conflictingProduct = await Product.findOne({
                certificateNumber: certNum,
                certificateInstitute: certInst,
                company: { $ne: companyId },
                status: { $nin: ['OnDeal', 'Sold'] }
            });

            if (conflictingProduct) {
                if (processedProductData.price < conflictingProduct.price) {
                    operations.push({
                        deleteOne: { filter: { _id: conflictingProduct._id } }
                    });
                    stats.replacedOtherCompanyProduct++;
                    // createThisProduct remains true
                } else {
                    createThisProduct = false;
                    stats.skippedCheaperExistsOtherCompany++;
                    allProcessedProductsDetailed.push({
                      sourceProduct: rawProduct,
                      status: 'Skipped',
                      reason: 'cheaper_exists_other_company',
                      systemId: null,
                      finalData: processedProductData
                    });
                }
            }
        }
        
        if (createThisProduct) {
            stats.created++;
            const newSystemId = uuidv4();
            const insertPayload = {
              ...processedProductData,
              id: newSystemId,
              company: companyId,
              link: `https://in-diamonds.com/product/${newSystemId}`,
              createdAt: new Date(),
              updatedAt: new Date(),
              onDeal: false,
              sold: false,
            };
            operations.push({
              insertOne: {
                document: insertPayload
              }
            });
            allProcessedProductsDetailed.push({
              sourceProduct: rawProduct,
              status: 'Created',
              reason: null,
              systemId: newSystemId,
              finalData: insertPayload
            });
        }
      }
    }
    stats.processed = stats.created + stats.updated;

    // For API sync, it's always a 'replace' logic for products not OnDeal/Sold
    productsToPotentiallyDeleteIds.forEach(idToDelete => {
      operations.push({ deleteOne: { filter: { _id: idToDelete } } });
    });

    if (operations.length > 0) {
      await Product.bulkWrite(operations, { ordered: false });
    }
    
    config.lastSync = new Date();
    config.syncStatus = 'success';
    config.lastSyncError = null; // Clear previous error on success
    await config.save();

    // console.log(`[Sync Success] Company: ${companyId}, Final Stats: ${JSON.stringify(stats, null, 2)}`); // Log final stats
    // console.log(`[Sync Success] Company: ${companyId}, Detailed Report Items: ${allProcessedProductsDetailed.length}`);
    // For now, just log the count. Later we'll generate XLSX.
    console.log(`[Sync Report] Company: ${companyId}, Total items in detailed report: ${allProcessedProductsDetailed.length}, Source API items: ${apiProductsSource.length}`);

    let reportPath = null; // Initialize reportPath
    try {
      reportPath = generateProductReportXlsx(allProcessedProductsDetailed, companyName || companyId.toString());
    } catch (reportError) {
      console.error(`[XLSX Report Error] Failed to generate report for company ${companyId}: ${reportError.message}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    await telegramBot.sendSyncSuccessNotification(companyId, {
      totalProducts: stats.totalFromApi,
      processed: stats.processed, 
      created: stats.created,
      updated: stats.updated,
      skippedInvalidColor: stats.skippedInvalidColor,
      skippedInvalidStatus: stats.skippedInvalidStatus,
      skippedByBlacklist: stats.skippedByBlacklist,
      skippedOnDealOrSold: stats.skippedExistingOnDealOrSold,
      duration,
      apiErrors: stats.apiErrors,
      replacedOtherCompanyProduct: stats.replacedOtherCompanyProduct, 
      skippedCheaperExistsOtherCompany: stats.skippedCheaperExistsOtherCompany,
      skippedInvalidClarity: stats.skippedInvalidClarity,
      skippedInvalidPrice: stats.skippedInvalidPrice,
      skippedInvalidCarat: stats.skippedInvalidCarat,
      skippedMissingMedia: stats.skippedMissingMedia,
      skippedByApiFilter: stats.skippedByApiFilter
    }, companyName, reportPath);
    
  } catch (error) {
    console.error(`Sync error for company ${config.company}:`, error.message);
    if (error.response) {
      console.error('API response error details:', {
        status: error.response.status,
        data: error.response.data,
        // headers: error.response.headers // Headers can be verbose
      });
    }
    
    config.syncStatus = 'error';
    config.lastSyncError = error.message;
    await config.save();

    console.error(`[Sync Error] Company: ${config.company}, Final Stats on Error: ${JSON.stringify(stats, null, 2)}`); // Log final stats even on error
    console.error(`[Sync Error Details] Company: ${config.company}, Error Message: ${error.message}`);

    const companyNameForError = (await Company.findById(config.company))?.name || 'Unknown Company';
    await telegramBot.sendSyncErrorNotification(config.company, error, companyNameForError);
    // Do not re-throw error here to allow syncQueue to complete this task gracefully
  }
}

// Export the sync function for the scheduler
exports.syncCompanyProducts = syncCompanyProducts;

// Ручной сброс статуса синхронизации для компании
exports.resetSyncStatus = async (req, res) => {
  try {
    const config = await CompanyApiConfig.findOne({ company: req.params.companyId });
    if (!config) return res.status(404).json({ message: 'API configuration not found' });
    config.syncStatus = 'idle';
    config.lastSyncError = 'Reset manually by admin';
    await config.save();
    res.json({ message: 'Sync status reset' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}; 