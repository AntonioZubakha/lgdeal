const Product = require('../models/Product');

// Shape mapping for normalization
const SHAPE_MAPPING = {
  'Round': ['RD', 'RB', 'RBC', 'B', 'BR', 'RN', 'RND', 'BRILLIANT', 'raund', 'ROUND', 'Round', 'R', 'Round Brilliant'],
  'Oval': ['OV', 'OB', 'O', 'OMB', 'OVL', 'OVEL', 'S.OVAL', 'OMB', 'Ashoka', 'STEP OVAL', 'OVAL MODIFIED', 'OMB', 'Oval Polygon Step', 'Oval Step', 'OVAL', 'Oval', 'OV/L', 'Oval Modified', 'Oval Brilliant'],
  'Pear': ['P', 'PSH', 'PB', 'PS', 'PMB', 'PB*', 'PE', 'SGP-100', 'PR', 'Pear Modified', 'PEAR', 'Pear', 'Pear Shape', 'Pear Brilliant', 'PS', 'PEAR SHAPE'],
  'Cushion': ['CU CRISS', 'CB', 'C', 'CUN', 'CUS', 'CUSH', 'CU', 'CS', 'CUSHION', 'Cushion'],
  'Radiant': ['RA', 'RAD', 'R', 'RADIANT', 'Radiant'],
  'Asscher': ['AS', 'A', 'ASSCHER', 'Asscher'],
  'Princess': ['PS', 'PRN', 'PRINCESS', 'Princess'],
  'Emerald': ['EM', 'E', 'EMERALD', 'Emerald'],
  'Baguette': ['BA', 'BAG', 'BAGUETTE', 'Baguette'],
  'Marquise': ['MQ', 'M', 'MARQUISE', 'Marquise'],
  'Heart': ['HT', 'H', 'HEART', 'Heart'],
  'Trillion': ['TR', 'TRILLION', 'Trillion']
};

// Clarity mapping for normalization
const CLARITY_MAPPING = {
  'IF': ['IF', 'Internally Flawless', 'FL'],
  'VVS1': ['VVS1'],
  'VVS2': ['VVS2'],
  'VS1': ['VS1'],
  'VS2': ['VS2'],
  'EX': ['EX', 'Excellent']
};

// Grade mapping for normalization (used for symmetry, polish, and cut)
const GRADE_MAPPING = {
  'FR': ['FR', 'FAIR', 'Fair', 'F'],
  'GD': ['GD', 'GOOD', 'Good', 'G'],
  'VG': ['VG', 'VERY GOOD', 'Very Good', 'VeryGood'],
  'EX': ['EX', 'EXCELLENT', 'Excellent', 'E'],
  'ID': ['ID', 'IDEAL', 'Ideal', 'I']
};

// Color mapping for normalization
const COLOR_MAPPING = {
  'D': ['D'],
  'E': ['E'],
  'F': ['F'],
  'G': ['G']
};

// Function to normalize shape name
const normalizeShape = (shape) => {
  if (!shape) return '';
  
  const normalizedShape = shape.trim();
  
  // First check if it's a direct match with a standard shape
  for (const [standardShape, variations] of Object.entries(SHAPE_MAPPING)) {
    if (standardShape.toLowerCase() === normalizedShape.toLowerCase()) {
      return standardShape;
    }
  }
  
  // Then check variations
  for (const [standardShape, variations] of Object.entries(SHAPE_MAPPING)) {
    if (variations.some(v => v.toLowerCase() === normalizedShape.toLowerCase())) {
      return standardShape;
    }
  }
  
  // If no match found, return original shape
  return shape;
};

// Function to normalize clarity grade
const normalizeClarity = (clarity) => {
  if (!clarity) return '';
  
  const normalizedClarity = clarity.trim().toUpperCase();
  
  // Direct match check
  for (const [standardClarity, variations] of Object.entries(CLARITY_MAPPING)) {
    if (standardClarity === normalizedClarity) {
      return standardClarity;
    }
  }
  
  // Check variations
  for (const [standardClarity, variations] of Object.entries(CLARITY_MAPPING)) {
    if (variations.some(v => v === normalizedClarity)) {
      return standardClarity;
    }
  }
  
  return clarity;
};

// Function to normalize grade (symmetry, polish, cut)
const normalizeGrade = (grade) => {
  if (!grade) return '';
  
  const normalizedGrade = grade.trim().toUpperCase();
  
  // Direct match check
  for (const [standardGrade, variations] of Object.entries(GRADE_MAPPING)) {
    if (standardGrade === normalizedGrade) {
      return standardGrade;
    }
  }
  
  // Check variations
  for (const [standardGrade, variations] of Object.entries(GRADE_MAPPING)) {
    if (variations.some(v => v.toUpperCase() === normalizedGrade)) {
      return standardGrade;
    }
  }
  
  return grade;
};

// Function to normalize color
const normalizeColor = (color) => {
  if (!color) return '';
  
  const normalizedColor = color.trim().toUpperCase();
  
  // Direct match check
  for (const [standardColor, variations] of Object.entries(COLOR_MAPPING)) {
    if (standardColor === normalizedColor) {
      return standardColor;
    }
  }
  
  // Check variations
  for (const [standardColor, variations] of Object.entries(COLOR_MAPPING)) {
    if (variations.some(v => v === normalizedColor)) {
      return standardColor;
    }
  }
  
  return color;
};

// Get products with filtering
exports.getProducts = async (req, res) => {
  try {
    console.log('Received marketplace request with query:', req.query);
    
    const { 
      shape, 
      weight, 
      clarity, 
      symmetry, 
      polish, 
      cut, 
      color, 
      length, 
      width, 
      height,
      // Support alternative field names for measurements
      len, l,
      wid, w,
      h, 
      table, 
      depth, 
      ratio 
    } = req.query;

    // Build filter object
    const filter = {
      // Only show products that are not in active deals
      onDeal: false,
      // Only show products that are not sold
      sold: false
    };

    // Shape filter
    if (shape) {
      if (shape.includes(',')) {
        const shapeArray = shape.split(',').map(s => normalizeShape(s.trim()));
        filter.shape = { $in: shapeArray };
      } else if (shape !== 'All') {
        filter.shape = normalizeShape(shape);
      }
    }
    
    // Clarity filter
    if (clarity) {
      if (clarity.includes(',')) {
        const clarityArray = clarity.split(',').map(c => normalizeClarity(c.trim()));
        filter.clarity = { $in: clarityArray };
      } else if (clarity !== 'All') {
        filter.clarity = normalizeClarity(clarity);
      }
    }

    // Symmetry filter
    if (symmetry) {
      if (symmetry.includes(',')) {
        const symmetryArray = symmetry.split(',').map(s => normalizeGrade(s.trim()));
        console.log('Normalized symmetry array:', symmetryArray);
        filter.symmetry = { $in: symmetryArray };
      } else if (symmetry !== 'All') {
        const normalizedSymmetry = normalizeGrade(symmetry);
        console.log('Normalized symmetry:', normalizedSymmetry);
        filter.symmetry = normalizedSymmetry;
      }
    }

    // Polish filter
    if (polish) {
      if (polish.includes(',')) {
        const polishArray = polish.split(',').map(p => normalizeGrade(p.trim()));
        console.log('Normalized polish array:', polishArray);
        filter.polish = { $in: polishArray };
      } else if (polish !== 'All') {
        const normalizedPolish = normalizeGrade(polish);
        console.log('Normalized polish:', normalizedPolish);
        filter.polish = normalizedPolish;
      }
    }

    // Cut filter
    if (cut) {
      if (cut.includes(',')) {
        const cutArray = cut.split(',').map(c => normalizeGrade(c.trim()));
        console.log('Normalized cut array:', cutArray);
        filter.cut = { $in: cutArray };
      } else if (cut !== 'All') {
        const normalizedCut = normalizeGrade(cut);
        console.log('Normalized cut:', normalizedCut);
        filter.cut = normalizedCut;
      }
    }
    
    // Color filter
    if (color) {
      if (color.includes(',')) {
        const colorArray = color.split(',').map(c => normalizeColor(c.trim()));
        console.log('Normalized color array:', colorArray);
        filter.color = { $in: colorArray };
      } else if (color !== 'All') {
        const normalizedColor = normalizeColor(color);
        console.log('Normalized color:', normalizedColor);
        filter.color = normalizedColor;
      }
    }
    
    // Weight filter (carat)
    if (weight) {
      if (weight.includes(',')) {
        const [min, max] = weight.split(',').map(w => parseFloat(w.trim()));
        
        if (!isNaN(min) || !isNaN(max)) {
          const weightFilter = {};
          
          if (!isNaN(min)) {
            weightFilter.$gte = min;
          }
          
          if (!isNaN(max)) {
            weightFilter.$lte = max;
          }

          filter.carat = weightFilter;
        }
      }
    }

    // Length filter (measurement1) - handle alternative field names
    const lengthValue = length || len || l;
    if (lengthValue) {
      if (lengthValue.includes(',')) {
        const [min, max] = lengthValue.split(',').map(l => parseFloat(l.trim()));
        
        if (!isNaN(min) || !isNaN(max)) {
          const lengthFilter = {};
          
          if (!isNaN(min)) {
            lengthFilter.$gte = min;
          }
          
          if (!isNaN(max)) {
            lengthFilter.$lte = max;
          }

          filter.measurement1 = lengthFilter;
        }
      }
    }

    // Width filter (measurement2) - handle alternative field names
    const widthValue = width || wid || w;
    if (widthValue) {
      if (widthValue.includes(',')) {
        const [min, max] = widthValue.split(',').map(w => parseFloat(w.trim()));
        
        if (!isNaN(min) || !isNaN(max)) {
          const widthFilter = {};
          
          if (!isNaN(min)) {
            widthFilter.$gte = min;
          }
          
          if (!isNaN(max)) {
            widthFilter.$lte = max;
          }

          filter.measurement2 = widthFilter;
        }
      }
    }

    // Height filter (measurement3) - handle alternative field names
    const heightValue = height || h;
    if (heightValue) {
      if (heightValue.includes(',')) {
        const [min, max] = heightValue.split(',').map(h => parseFloat(h.trim()));
        
        if (!isNaN(min) || !isNaN(max)) {
          const heightFilter = {};
          
          if (!isNaN(min)) {
            heightFilter.$gte = min;
          }
          
          if (!isNaN(max)) {
            heightFilter.$lte = max;
          }

          filter.measurement3 = heightFilter;
        }
      }
    }

    // Table filter (tableSize)
    if (table) {
      if (table.includes(',')) {
        const [min, max] = table.split(',').map(t => parseFloat(t.trim()));
        
        if (!isNaN(min) || !isNaN(max)) {
          const tableFilter = {};
          
          if (!isNaN(min)) {
            tableFilter.$gte = min;
          }
          
          if (!isNaN(max)) {
            tableFilter.$lte = max;
          }

          filter.tableSize = tableFilter;
        }
      }
    }

    // Depth filter (totalDepth)
    if (depth) {
      if (depth.includes(',')) {
        const [min, max] = depth.split(',').map(d => parseFloat(d.trim()));
        
        if (!isNaN(min) || !isNaN(max)) {
          const depthFilter = {};
          
          if (!isNaN(min)) {
            depthFilter.$gte = min;
          }
          
          if (!isNaN(max)) {
            depthFilter.$lte = max;
          }

          filter.totalDepth = depthFilter;
        }
      }
    }

    // Ratio filter (calculated as measurement1/measurement2)
    if (ratio) {
      if (ratio.includes(',')) {
        const [min, max] = ratio.split(',').map(r => parseFloat(r.trim()));
        
        if (!isNaN(min) || !isNaN(max)) {
          // For ratio filtering, we need to use the $expr operator 
          // to calculate ratio on the fly from measurement1 and measurement2
          const ratioExpr = { $expr: {} };
          const divExpr = { $divide: ["$measurement1", "$measurement2"] };
          
          if (!isNaN(min) && !isNaN(max)) {
            ratioExpr.$expr = { 
              $and: [
                { $gte: [divExpr, min] },
                { $lte: [divExpr, max] }
              ]
            };
          } else if (!isNaN(min)) {
            ratioExpr.$expr = { $gte: [divExpr, min] };
          } else if (!isNaN(max)) {
            ratioExpr.$expr = { $lte: [divExpr, max] };
          }
          
          // Merge the ratio expression into the filter
          if (Object.keys(ratioExpr.$expr).length > 0) {
            // Make sure we only apply the ratio filter to products with valid measurements
            const validMeasurements = { 
              measurement1: { $gt: 0 }, 
              measurement2: { $gt: 0 } 
            };
            
            // If we already have filters, use $and to combine them
            if (Object.keys(filter).length > 0) {
              filter.$and = filter.$and || [];
              filter.$and.push(validMeasurements);
              filter.$and.push(ratioExpr);
            } else {
              // If no other filters, combine valid measurements and ratio directly
              Object.assign(filter, validMeasurements, ratioExpr);
            }
          }
        }
      }
    }

    console.log('Applying filter:', JSON.stringify(filter, null, 2));

    // Fetch products with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1000;
    const skip = (page - 1) * limit;

    // Always sort by price ascending to show best deals first
    const sort = { price: 1 };

    const products = await Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(filter);
    const totalIncludingOnDeal = await Product.countDocuments({
      ...filter,
      onDeal: { $in: [true, false] } // Remove onDeal filter
    });

    const hiddenDueToDeals = totalIncludingOnDeal - total;
    console.log(`Found ${products.length} products out of ${total} total matches (${hiddenDueToDeals} products hidden due to being in active deals)`);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      products,
      hiddenProductsInfo: {
        hiddenDueToDeals,
        message: hiddenDueToDeals > 0 ? 
          `${hiddenDueToDeals} additional products match your criteria but are currently in active deals` : 
          null
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
}; 