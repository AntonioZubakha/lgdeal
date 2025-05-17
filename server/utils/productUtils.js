const { v4: uuidv4 } = require('uuid');

// Default values for different data types
const DEFAULT_VALUES = {
  STRING: '',
  NUMBER: 0,
  BOOLEAN: false
};

// Shape mapping for normalization
const SHAPE_MAPPING = {
  'Round': ['RD', 'RB', 'RBC', 'B', 'BR', 'RN', 'RND', 'BRILLIANT', 'raund', 'ROUND', 'Round', 'R', 'Round Brilliant'],
  'Oval': ['OV', 'OB', 'O', 'OMB', 'OVL', 'OVEL', 'S.OVAL', 'OMB', 'Ashoka', 'STEP OVAL', 'OVAL MODIFIED', 'OMB', 'Oval Polygon Step', 'Oval Step', 'OVAL', 'Oval', 'OV/L', 'Oval Modified', 'Oval Brilliant'],
  'Pear': ['P', 'PSH', 'PB', 'PS', 'PMB', 'PB*', 'PE', 'SGP-100', 'PR', 'Pear Modified', 'PEAR', 'Pear', 'Pear Shape', 'Pear Brilliant', 'PS', 'PEAR SHAPE'],
  'Cushion': ['CU CRISS', 'CB', 'C', 'CUN', 'CUS', 'CUSH', 'CU', 'CS', 'SQ Cushion', 'S CUSHION', 'SQ CU', 'sq.cushion', 'CUSHION BRLN', 'CUSHION MODIFIED', 'CM', 'S.CUSHION', 'SQ. CUSHION MODIFIED', 'LONG CUSHION', 'CM-4', 'CM-4', 'CM-4', 'CMB', 'CU', 'CU-M', 'Cushion mod', 'LONG CUSHION', 'L.CUS', 'Long cushion', 'SQ.CUSHION MB', 'SQ. CUSHION BRILLIAN', 'CUSHION LONG', 'CUSHION BRILLANT', 'SQ.CUSHION BRILLANT', 'CUSHION MODIFIED BRILLANT', 'Cushion Mixed', 'Elongated cusion', 'SQUARE CUSHION MODIFIED', 'SQ.CB', 'Cushion Square', 'SCB', 'Square Cushion', 'SQ.CUSHION MB', 'SQ. CUSHION BRILLIAN', 'Cushion Modified', 'LONG CUSHION', 'CUSHION MODIFIED', 'CUSIHON BRSQ', 'SQ. CU', 'L.V.Cushion', 'Rectangular Cushion Antique', 'RECTANGULAR CUSHION MIXED CUT', 'CUSHION ANTIQUE BRILLIANT', 'CUSHION', 'Cushion', 'CUS', 'Cushion Brilliant', 'Cushion Modified Brilliant', 'Elongated Cushion'],
  'Radiant': ['RA', 'RAD', 'R', 'RAD', 'RA', 'RC', 'RDN', 'CRB', 'RCRB', 'RADI', 'LG.RAD', 'LR', 'RADIANTB', 'RADIANT', 'RN', 'Rediant', 'CSMB', 'SQ.RADIANT', 'SQUARE RADIANT', 'SQUERE RADIANT', 'LONG RADIANT', 'L RADIANT', 'SQ RAD', 'S L.Radiant', 'L.Radiant', '.V.L. Radiant', 'cornered rectangular modified', 'cornered rectangular', 'cornered modified', 'rectangular', 'rectangular modified', 'RADIANT', 'Radiant', 'RAD', 'Radiant Cut', 'Square Radiant', 'Rectangular Radiant'],
  'Asscher': ['AS', 'A', 'CSS', 'CSSC', 'AC', 'Assher', 'ACCER', 'SQ.EMERALD', 'SEM', 'SE', 'ASHER', 'ASH', 'ASSCHER', 'Asscher', 'Asher', 'ASSCH', 'Asscher Cut'],
  'Princess': ['PS', 'PRN', 'PRN', 'PRIN', 'PN', 'PC', 'PRI', 'SMB', 'BEZEL PRINCESS', 'Rectangular Princess', 'PRINCESS', 'Princess', 'PR', 'Princess Cut', 'Square Princess', 'SQ. PRINCESS'],
  'Emerald': ['EM', 'EMRALD', 'Emerald', 'E', 'EC', 'EMR', 'EMERALD 4STEP', 'ASYMEMERALD4S', 'EM-HD', 'MODIFIED EMERALD', 'EMERALD MODIFIED', 'Square Emerald', 'SQEM', 'SQ EM', 'SQ-EM', 'SQ.EM', 'Sq.emerald', 'SQE', 'SQ EMD', 'S.EM', 'S.EMERALD', 'Sq.Emerald', 'SQ EMERALD', 'EMERALD', 'Emerald', 'EM', 'Emerald Cut', 'Octagonal Emerald', 'Rectangular Emerald'],
  'Baguette': ['BA', 'BAG', 'BG', 'BT', 'RC', 'RSC', 'BAGUETTE', 'Baguette', 'BAG', 'Step Cut Baguette', 'Straight Baguette', 'Tapered Baguette'],
  'Marquise': ['MQ', 'MQB', 'M', 'MQ', 'MB', 'MAQ', 'MARQUISH', 'MARQ', 'S.MARQUISE', 'MQS', 'Marquise Modified', 'Marquise Step', 'MARQUISE', 'Marquise', 'MAR', 'Marquise Brilliant', 'MQ', 'MS'],
  'Heart': ['HT', 'HS', 'H', 'HS', 'HT', 'MHRC', 'MHB', 'HB', 'HE', 'HB', 'S.HEART', 'ROSE HEART', 'HRT JODI', 'Heart-P8-P8', 'HRT', 'Heart Modified', 'HEART', 'Heart', 'H', 'Heart Shape', 'Heart Brilliant', 'HS'],
  'Trillion': ['Tr', 'Trill', 'TRILLION', 'Trillion', 'TR', 'Trilliant', 'Trillian', 'Triangle', 'TRI', 'Triangular Brilliant', 'Triangular', 'Triangular Modified Brilliant'],
  'Other': ['MODIFIED SHIELD STEP CUT', 'HALFMOON', 'X-TREE', 'TURTLE', 'TULIP', 'PANTHER', 'OV-ROSE', 'MAHAVIR', 'KITE-FLAT', 'KING', 'ICE CREAM', 'HORSE', 'HAMSA', 'GOAT', 'GANPATI', 'FLORO', 'FISH TAIL', 'FISH', 'FIRE', 'EURO CUT', 'EM-ROSE', 'CARRE', 'CADILLAC', 'ALPHABET', 'cut cornered rectangular mixed cut', 'PENS', 'PENTAGON STEP', 'PIE', 'MODIFIED PIE MIXED', 'KITE', 'tapered', 'PENTAGON', 'Modified Octagon Step', 'Cornered Rectangular Modified', 'Hexagonal Step', 'HFM (Half moon) shape', 'HFM', 'Cornered Rectangular Modified', 'CARR', 'HEXAGONE', 'Criss EM', 'round cornered modified', 'Heptagonal Step', 'Old Euro', 'Old European', 'CAPRI', 'HARMONIA', 'FUSION', 'OLD EUROPEAN', 'Old European shape', 'Old mine', 'Old mine2', 'OLD MINE 2', 'Long kite', 'SCB', 'CMB', 'BRIOLETTE', 'BCM', 'SE MARQUISE', 'SEQ', 'Criss EM', 'ASHOKA', 'CRISS', 'CM-B', 'TEPPER', 'RTG', 'CRMB', 'RECTANGLE', 'RCRMB', 'Shield', 'SH', 'Square', 'SQ', 'MSB', 'MDSQB', 'SQUAR MOD', 'Star', 'S', 'ST', 'Trapezoid', 'TP', 'TRAP', 'TRAPB', 'TZ', 'Trapeze', 'X', 'BAT', 'FXS', 'BUTTERFLY', 'Pentagonal', 'PEN', 'SX', 'SEM', 'SE', 'Tapered Baguette', 'TBAG', 'Tapered Bullet', 'TBU', 'Tapered Bullet', 'Briolette', 'BRIO', 'BRIOLET', 'BT', 'Bullets', 'BU', 'CUX', 'CM', 'CMB', 'CRC', 'CSC', 'CX', 'SCMB', 'SCX', 'CSMB', 'EuropeanCut', 'EU', 'European', 'Flanders', 'FL', 'FC', 'Half Moon', 'HM', 'HMB', 'Hexagonal', 'HEX', 'HEXA', 'Hexagon', 'Kite', 'K', 'KT', 'KITE', 'Lozenge', 'LOZ', 'Octagonal', 'Octagonal Modified', 'OC', 'Octagon', 'Old Miner', 'OM', 'CSMB', 'CMB', 'SEM', 'CRMB', 'TRAPEZOID', 'Old Mine Round', 'Oval Leo', 'Marquise Leo', 'OTHER', 'Other', 'Unique', 'Special', 'Fancy', 'Custom', 'Irregular', 'Mixed', 'Specialty', 'Miscellaneous', 'Old Mine']
};

// Column mappings to identify fields in uploaded files
const COLUMN_MAPPINGS = {
  shape: ['shape'],
  carat: ['carat', 'weight'],
  color: ['color', 'col', 'color_value'],
  clarity: ['clarity', 'cla', 'purity'],
  cut: ['cut'],
  polish: ['polish', 'pol'],
  symmetry: ['symmetry', 'sym'],
  price: ['price', 'total price', 'cost', 'amount', 'net_value', 'total_price', 'final_price', 'totalprice'],
  pricePerCarat: ['price_per_carat', 'ppc', 'per_carat_price', 'price per carat', 'cost per carat', 'priceperct'],
  location: ['location', 'country', 'city', 'state'],
  technology: ['technology', 'type', 'growth_type'],
  photo: ['photo', 'image', 'diamond_image', 'image_url', 'picture_url', 'certificate_image', 'imagelink', 'image link', 'diamond image', 'diamond image link'],
  video: ['video', 'diamond_video', 'video_url', 'movie_url', 'videolink', 'diamond video', 'video link', 'diamond video link'],
  measurements: ['measurements', 'dims', 'dimensions', 'measure', 'size', 'meas'],
  measurement1: ['measurement1', 'measurement 1', 'meas1', 'x1', 'length', 'dim1', 'l', 'len', 'measurements_length'],
  measurement2: ['measurement2', 'measurement 2', 'meas2', 'x2', 'width', 'dim2', 'w', 'wid', 'measurements_width'],
  measurement3: ['measurement3', 'measurement 3', 'meas3', 'x3', 'height', 'depth', 'dim3', 'h', 'measurements_depth'],
  tableSize: ['table size', 'table', 'table_percent', 'table %'],
  crownHeight: ['crown height', 'crown', 'crown_height'],
  pavilionDepth: ['pavilion depth', 'pavilion', 'pavilion_depth'],
  girdle: ['girdle', 'girdle_condition', 'girdle_thin', 'girdle_thick', 'girdle_per', 'girdle %'],
  culet: ['culet', 'culet_condition', 'culet_size'],
  totalDepth: ['total depth', 'depth', 'dp', 'depth_percent', 'depth %'],
  fluorescence: ['fluorescence', 'flour', 'fluorescence_intensity', 'fluorescence_color'],
  ha: ['h&a', 'hearts and arrows', 'ha', 'heart_arrow'],
  certificateInstitute: ['certificate institute', 'lab', 'certificate', 'grading_lab', 'laboratory'],
  certificateNumber: [
    'certificate_number',
    'certificate number',
    'cert no',
    'certificate #',
    'cert #',
    'cert',
    'certificate no',
    'cert_no',
    'certno',
    'cert.no',
    'cert_number',
    'certificate.number',
    'report no',
    'report number',
    'report #',
    'report',
    'report_number',
  ],
  overtone: ['overtone'],
  intensity: ['intensity'],
  id: ['id', 'stock no', 'stock number', 'stock #', 'stone id', 'diamond id', 'stock_id', 'stockid', 'ref_no'],
  status: ['status', 'availability', 'stock status', 'product status', 'avail']
};

/**
 * Normalize shape name based on predefined mapping
 * @param {string} shape - The shape value to normalize
 * @returns {string} - Normalized shape name
 */
const normalizeShape = (shape) => {
  if (!shape) return '';
  
  const normalizedShape = shape.trim().toUpperCase();
  
  // First check if it's a direct match with a standard shape
  for (const [standardShape, variations] of Object.entries(SHAPE_MAPPING)) {
    if (standardShape.toUpperCase() === normalizedShape) {
      return standardShape;
    }
  }
  
  // Then check variations
  for (const [standardShape, variations] of Object.entries(SHAPE_MAPPING)) {
    if (variations.some(v => v.toUpperCase() === normalizedShape)) {
      return standardShape;
    }
  }
  
  // If no match found, return original shape
  return shape;
};

/**
 * Determine stone type based on color
 * @param {string} color - The color value
 * @returns {string} - The determined stone type
 */
const determineStoneType = (color) => {
  if (!color) return 'diamond';
  
  const colorLower = color.toLowerCase();
  // Check for fancy colors
  if (colorLower.includes('pink') || 
      colorLower.includes('blue') || 
      colorLower.includes('yellow') || 
      colorLower.includes('green')) {
    return 'fancy diamond';
  }
  return 'diamond';
};

/**
 * Format field value based on field name
 * @param {string} fieldName - The field name
 * @param {*} value - The value to format
 * @returns {string} - Formatted value
 */
const formatFieldValue = (fieldName, value) => {
  if (!value) return DEFAULT_VALUES.STRING;
  
  const stringValue = String(value).trim();
  if (!stringValue) return DEFAULT_VALUES.STRING;
  
  return stringValue;
};

/**
 * Validate URL
 * @param {string} url - The URL to validate
 * @returns {string} - Validated URL or empty string
 */
const validateUrl = (url) => {
  if (!url) return DEFAULT_VALUES.STRING;
  
  const stringUrl = String(url).trim();
  if (!stringUrl) return DEFAULT_VALUES.STRING;
  
  try {
    // Simple check if string starts with http/https
    if (stringUrl.startsWith('http://') || stringUrl.startsWith('https://')) {
      return stringUrl;
    }
    return DEFAULT_VALUES.STRING;
  } catch (error) {
    return DEFAULT_VALUES.STRING;
  }
};

/**
 * Parse measurements in various formats
 * @param {string} measurements - The measurements string
 * @returns {Object} - Object containing measurement1, measurement2, measurement3
 */
const parseMeasurements = (measurements) => {
  if (!measurements) return { measurement1: 0, measurement2: 0, measurement3: 0 };
  
  // Handle different measurement formats
  const result = { measurement1: 0, measurement2: 0, measurement3: 0 };
  
  // Convert to string to ensure consistent handling
  const measurementsStr = String(measurements).trim();
  
  // If empty, return defaults
  if (!measurementsStr) return result;
  
  // Common patterns for separating dimensions
  // Format 1: "7.26*7.30*4.60" or "7.26x7.30x4.60" or "7.26-7.30-4.60"
  const delimiterRegex = /(\d+\.?\d*)\s*[\*xX\-]\s*(\d+\.?\d*)\s*[\*xX\-]\s*(\d+\.?\d*)/;
  
  // Format 2: "7.26 7.30 4.60" (space separated)
  const spaceRegex = /^(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)$/;
  
  // Format 3: "7.26,7.30,4.60" (comma separated)
  const commaRegex = /(\d+\.?\d*)\s*,\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)/;
  
  // Format 4: "7.26/7.30/4.60" (slash separated)
  const slashRegex = /(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/;
  
  // Try each format in order
  let match = measurementsStr.match(delimiterRegex) || 
              measurementsStr.match(spaceRegex) || 
              measurementsStr.match(commaRegex) ||
              measurementsStr.match(slashRegex);
  
  if (match) {
    result.measurement1 = parseFloat(match[1]) || 0;
    result.measurement2 = parseFloat(match[2]) || 0;
    result.measurement3 = parseFloat(match[3]) || 0;
    return result;
  }
  
  // Try to handle more complex formats or malformed data
  const allNumbers = measurementsStr.match(/\d+\.?\d*/g);
  if (allNumbers && allNumbers.length >= 3) {
    // Use the first three numbers found
    result.measurement1 = parseFloat(allNumbers[0]) || 0;
    result.measurement2 = parseFloat(allNumbers[1]) || 0;
    result.measurement3 = parseFloat(allNumbers[2]) || 0;
    return result;
  } else if (allNumbers && allNumbers.length === 2) {
    // If only two numbers, use them and leave height as 0
    result.measurement1 = parseFloat(allNumbers[0]) || 0;
    result.measurement2 = parseFloat(allNumbers[1]) || 0;
    return result;
  } else if (allNumbers && allNumbers.length === 1) {
    // If only one number, assume it's the length
    result.measurement1 = parseFloat(allNumbers[0]) || 0;
    return result;
  }
  
  return result;
};

/**
 * Find the matching field name from column mappings
 * @param {string} headerName - The header name to find a match for
 * @returns {string|null} - The matching field name or null
 */
const findMatchingField = (headerName) => {
  const lowerHeader = headerName.toLowerCase().trim();
  
  for (const [fieldName, variations] of Object.entries(COLUMN_MAPPINGS)) {
    if (variations.some(v => lowerHeader === v.toLowerCase())) {
      return fieldName;
    }
  }
  
  return null; // No match found
};

/**
 * Helper function to get value from multiple possible field names
 * @param {Object} product - The product object
 * @param {string} primaryField - Primary field name to check first
 * @param {Array} alternativeFields - Alternative field names to check if primary is missing
 * @returns {*} - The found value or null
 */
const getFieldValue = (product, primaryField, alternativeFields = []) => {
  if (product[primaryField] !== undefined) return product[primaryField];
  for (const field of alternativeFields) {
    if (product[field] !== undefined) return product[field];
  }
  return null;
};

/**
 * Validate diamond color
 * @param {string} color - The color value to validate
 * @returns {Object} - Object with normalized color and isValid flag
 */
const validateDiamondColor = (color) => {
  if (!color) {
    return {
      normalizedColor: '',
      isValid: false
    };
  }
  
  // Normalize to uppercase
  const normalizedColor = String(color).trim().toUpperCase();
  
  // Only allow D, E, F, G colors
  const allowedColors = ['D', 'E', 'F', 'G'];
  
  return {
    normalizedColor,
    isValid: allowedColors.includes(normalizedColor)
  };
};

/**
 * Check if a product status is valid for import
 * @param {string} status - The product status value
 * @returns {Object} - Object with normalized status and isValid flag
 */
const validateProductStatus = (status) => {
  if (!status) {
    return { 
      normalizedStatus: 'available', 
      isValid: true 
    };
  }
  
  const statusStr = String(status).trim().toLowerCase();
  
  // Allowed status values that will be normalized to 'available'
  const allowedValues = ['available', '1', 'on stock', 'onstock', 'in stock', 'instock', 'yes', 'true', 'g'];
  
  if (allowedValues.includes(statusStr)) {
    return { 
      normalizedStatus: 'available', 
      isValid: true 
    };
  }
  
  // Any other status value means product should not be imported
  return { 
    normalizedStatus: statusStr, 
    isValid: false 
  };
};

/**
 * Process a product object into standardized format
 * @param {Object} product - The product data to process
 * @param {string} companyId - The company ID
 * @param {Object} stats - Statistics object to track skipped products
 * @returns {Object|null} - The processed product or null if it should be filtered out
 */
const processProduct = (product, companyId, stats) => {
  // Normalize all keys of the input product to lowercase
  const normalizedProduct = {};
  if (product && typeof product === 'object') { // Ensure product is an object
    for (const key in product) {
      if (Object.prototype.hasOwnProperty.call(product, key)) {
        normalizedProduct[key.toLowerCase()] = product[key];
      }
    }
  }

  // Check product status - if not valid, return null to filter it out
  const statusValidation = validateProductStatus(getFieldValue(normalizedProduct, 'status', COLUMN_MAPPINGS.status.slice(1)));
  if (!statusValidation.isValid) {
    stats.skippedInvalidStatus++; 
    return { data: null, reason: 'invalid_status' };
  }
  
  // Check color - if not valid white diamond color (D, E, F, G), return null to filter it out
  const colorRaw = getFieldValue(normalizedProduct, 'color', COLUMN_MAPPINGS.color.slice(1));
  const colorValidation = validateDiamondColor(colorRaw);
  if (!colorValidation.isValid) {
    stats.skippedInvalidColor++; 
    return { data: null, reason: 'invalid_color' };
  }
  
  const shapeRaw = getFieldValue(normalizedProduct, 'shape', COLUMN_MAPPINGS.shape.slice(1));
  const normalizedShape = normalizeShape(shapeRaw);
  
  // Process measurements (handle different input formats)
  let measurements = {
    measurement1: 0,
    measurement2: 0,
    measurement3: 0
  };
  
  const measurementsCombinedRaw = getFieldValue(normalizedProduct, 'measurements', COLUMN_MAPPINGS.measurements.slice(1));
  if (measurementsCombinedRaw) {
    measurements = parseMeasurements(measurementsCombinedRaw);
  }
  
  // Individual measurement fields override combined measurements if present
  const m1Raw = getFieldValue(normalizedProduct, 'measurement1', COLUMN_MAPPINGS.measurement1.slice(1));
  if (m1Raw !== null && m1Raw !== undefined) {
    measurements.measurement1 = parseFloat(m1Raw) || 0;
  }
  
  const m2Raw = getFieldValue(normalizedProduct, 'measurement2', COLUMN_MAPPINGS.measurement2.slice(1));
  if (m2Raw !== null && m2Raw !== undefined) {
    measurements.measurement2 = parseFloat(m2Raw) || 0;
  }
  
  const m3Raw = getFieldValue(normalizedProduct, 'measurement3', COLUMN_MAPPINGS.measurement3.slice(1));
  if (m3Raw !== null && m3Raw !== undefined) {
    measurements.measurement3 = parseFloat(m3Raw) || 0;
  }
  
  // Process prices
  const caratRaw = getFieldValue(normalizedProduct, 'carat', COLUMN_MAPPINGS.carat.slice(1));
  const carat = parseFloat(caratRaw) || 0;

  const priceRaw = getFieldValue(normalizedProduct, 'price', COLUMN_MAPPINGS.price.slice(1));
  let price = parseFloat(priceRaw) || 0;

  const pricePerCaratRaw = getFieldValue(normalizedProduct, 'pricePerCarat', COLUMN_MAPPINGS.pricePerCarat.slice(1));
  let pricePerCarat = parseFloat(pricePerCaratRaw) || 0;

  // Calculate missing price fields
  if (carat > 0) {
    if (price > 0 && pricePerCarat === 0) {
      pricePerCarat = price / carat;
    } else if (pricePerCarat > 0 && price === 0) {
      price = pricePerCarat * carat;
    }
  }
  
  price = parseFloat(price.toFixed(2));
  pricePerCarat = parseFloat(pricePerCarat.toFixed(2));
  
  // NEW VALIDATIONS START HERE
  // 1. Clarity validation
  const clarityRaw = getFieldValue(normalizedProduct, 'clarity', COLUMN_MAPPINGS.clarity.slice(1));
  const clarity = formatFieldValue('clarity', clarityRaw)?.toUpperCase() || '';
  const allowedClarities = ['VS2', 'VS1', 'VVS2', 'VVS1', 'EX', 'IF'];
  if (!allowedClarities.includes(clarity)) {
    stats.skippedInvalidClarity = (stats.skippedInvalidClarity || 0) + 1;
    return { data: null, reason: 'invalid_clarity' };
  }

  // 2. Price validation (0-150000)
  if (!(price >= 0 && price <= 150000)) {
    stats.skippedInvalidPrice = (stats.skippedInvalidPrice || 0) + 1;
    return { data: null, reason: 'invalid_price' };
  }

  // 3. Carat validation (0.3-100)
  if (!(carat >= 0.3 && carat <= 100)) {
    stats.skippedInvalidCarat = (stats.skippedInvalidCarat || 0) + 1;
    return { data: null, reason: 'invalid_carat' };
  }
  // NEW VALIDATIONS END HERE
  
  const photoUrl = validateUrl(getFieldValue(normalizedProduct, 'photo', COLUMN_MAPPINGS.photo.slice(1)));
  const videoUrl = validateUrl(getFieldValue(normalizedProduct, 'video', COLUMN_MAPPINGS.video.slice(1)));

  // 4. Media validation (at least photo or video must be present)
  if (!photoUrl && !videoUrl) {
    stats.skippedMissingMedia = (stats.skippedMissingMedia || 0) + 1;
    return { data: null, reason: 'missing_media' };
  }

  const certNumRaw = getFieldValue(normalizedProduct, 'certificateNumber', COLUMN_MAPPINGS.certificateNumber.slice(1));
  const certificateNumber = certNumRaw ? String(certNumRaw).trim() : DEFAULT_VALUES.STRING;

  const certInstRaw = getFieldValue(normalizedProduct, 'certificateInstitute', COLUMN_MAPPINGS.certificateInstitute.slice(1));
  const certificateInstitute = formatFieldValue('certificateInstitute', certInstRaw)?.toUpperCase() || '';

  // Return processed product with standardized fields
  // ID and Link will be set by the calling controller
  const processedData = {
    // id: field WILL BE SET BY CALLER
    company: companyId,
    shape: normalizedShape,
    carat: carat,
    color: colorValidation.normalizedColor, // Use normalized color
    stoneType: getFieldValue(normalizedProduct, 'stoneType') || determineStoneType(colorValidation.normalizedColor),
    overtone: formatFieldValue('overtone', getFieldValue(normalizedProduct, 'overtone', COLUMN_MAPPINGS.overtone.slice(1))),
    intensity: formatFieldValue('intensity', getFieldValue(normalizedProduct, 'intensity', COLUMN_MAPPINGS.intensity.slice(1))),
    clarity: clarity, // Use the validated clarity
    cut: formatFieldValue('cut', getFieldValue(normalizedProduct, 'cut', COLUMN_MAPPINGS.cut.slice(1)))?.toUpperCase() || '',
    polish: formatFieldValue('polish', getFieldValue(normalizedProduct, 'polish', COLUMN_MAPPINGS.polish.slice(1)))?.toUpperCase() || '',
    price: price,
    pricePerCarat: pricePerCarat,
    symmetry: formatFieldValue('symmetry', getFieldValue(normalizedProduct, 'symmetry', COLUMN_MAPPINGS.symmetry.slice(1)))?.toUpperCase() || '',
    location: formatFieldValue('location', getFieldValue(normalizedProduct, 'location', COLUMN_MAPPINGS.location.slice(1))),
    technology: formatFieldValue('technology', getFieldValue(normalizedProduct, 'technology', COLUMN_MAPPINGS.technology.slice(1))),
    photo: photoUrl, // Use validated photo URL
    video: videoUrl, // Use validated video URL
    sold: Boolean(getFieldValue(normalizedProduct, 'sold')) || DEFAULT_VALUES.BOOLEAN,
    measurement1: measurements.measurement1,
    measurement2: measurements.measurement2,
    measurement3: measurements.measurement3,
    tableSize: parseFloat(getFieldValue(normalizedProduct, 'tableSize', COLUMN_MAPPINGS.tableSize.slice(1))) || DEFAULT_VALUES.NUMBER,
    crownHeight: parseFloat(getFieldValue(normalizedProduct, 'crownHeight', COLUMN_MAPPINGS.crownHeight.slice(1))) || DEFAULT_VALUES.NUMBER,
    pavilionDepth: parseFloat(getFieldValue(normalizedProduct, 'pavilionDepth', COLUMN_MAPPINGS.pavilionDepth.slice(1))) || DEFAULT_VALUES.NUMBER,
    girdle: formatFieldValue('girdle', getFieldValue(normalizedProduct, 'girdle', COLUMN_MAPPINGS.girdle.slice(1)))?.toUpperCase() || '',
    culet: formatFieldValue('culet', getFieldValue(normalizedProduct, 'culet', COLUMN_MAPPINGS.culet.slice(1)))?.toUpperCase() || '',
    totalDepth: parseFloat(getFieldValue(normalizedProduct, 'totalDepth', COLUMN_MAPPINGS.totalDepth.slice(1))) || DEFAULT_VALUES.NUMBER,
    fluorescence: formatFieldValue('fluorescence', getFieldValue(normalizedProduct, 'fluorescence', COLUMN_MAPPINGS.fluorescence.slice(1)))?.toUpperCase() || '',
    ha: getFieldValue(normalizedProduct, 'ha', COLUMN_MAPPINGS.ha.slice(1)) || DEFAULT_VALUES.STRING,
    certificateInstitute: certificateInstitute,
    certificateNumber: certificateNumber, // Now a string
    status: statusValidation.normalizedStatus,
    // link: field WILL BE SET BY CALLER
  };
  return { data: processedData, reason: null }; // Return object with data and null reason on success
};

/**
 * Format product data for update
 * @param {Object} data - The data to format
 * @returns {Object} - The formatted data
 */
const formatProductData = (data) => {
  // Check product status - normalize if valid
  const statusValidation = validateProductStatus(data.status);
  
  // Check color - if not valid white diamond color (D, E, F, G), use empty string
  const colorValidation = validateDiamondColor(data.color);
  const normalizedColor = colorValidation.isValid ? colorValidation.normalizedColor : '';
  
  // Process measurements if they exist in combined format
  let measurements = {
    measurement1: 0,
    measurement2: 0,
    measurement3: 0
  };
  
  if (data.measurements) {
    measurements = parseMeasurements(data.measurements);
  }
  
  // Individual measurements override combined ones
  if (data.measurement1 !== undefined) {
    measurements.measurement1 = parseFloat(data.measurement1) || 0;
  } else if (data.length !== undefined) {
    measurements.measurement1 = parseFloat(data.length) || 0;
  }
  
  if (data.measurement2 !== undefined) {
    measurements.measurement2 = parseFloat(data.measurement2) || 0;
  } else if (data.width !== undefined) {
    measurements.measurement2 = parseFloat(data.width) || 0;
  }
  
  if (data.measurement3 !== undefined) {
    measurements.measurement3 = parseFloat(data.measurement3) || 0;
  } else if (data.height !== undefined) {
    measurements.measurement3 = parseFloat(data.height) || 0;
  }

  const formattedData = {
    ...data,
    shape: normalizeShape(data.shape),
    carat: parseFloat(data.carat) || 0,
    color: normalizedColor,
    clarity: data.clarity?.toUpperCase() || '',
    cut: data.cut?.toUpperCase() || '',
    polish: data.polish?.toUpperCase() || '',
    symmetry: data.symmetry?.toUpperCase() || '',
    fluorescence: data.fluorescence?.toUpperCase() || '',
    lab: data.lab?.toUpperCase() || '',
    certificateNumber: typeof data.certificateNumber === 'string' 
      ? data.certificateNumber.toUpperCase() 
      : data.certificateNumber || '',
    pricePerCarat: parseFloat((parseFloat(data.pricePerCarat) || 0).toFixed(2)),
    totalPrice: parseFloat((parseFloat(data.totalPrice) || 0).toFixed(2)),
    measurement1: measurements.measurement1,
    measurement2: measurements.measurement2,
    measurement3: measurements.measurement3,
    depth: parseFloat(data.depth) || 0,
    table: parseFloat(data.table) || 0,
    girdle: data.girdle?.toUpperCase() || '',
    culet: data.culet?.toUpperCase() || '',
    comments: data.comments || '',
    status: statusValidation.normalizedStatus,
    location: data.location || '',
    lastUpdated: new Date(),
    history: data.history || []
  };

  // Calculate total price if not provided
  if (!formattedData.totalPrice && formattedData.carat && formattedData.pricePerCarat) {
    formattedData.totalPrice = parseFloat((formattedData.carat * formattedData.pricePerCarat).toFixed(2));
  }

  return formattedData;
};

module.exports = {
  DEFAULT_VALUES,
  SHAPE_MAPPING,
  COLUMN_MAPPINGS,
  normalizeShape,
  determineStoneType,
  formatFieldValue,
  validateUrl,
  parseMeasurements,
  findMatchingField,
  getFieldValue,
  processProduct,
  formatProductData,
  validateProductStatus,
  validateDiamondColor
}; 