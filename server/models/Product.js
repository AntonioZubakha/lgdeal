const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  shape: {
    type: String,
    trim: true,
    default: ''
  },
  carat: {
    type: Number,
    default: 0
  },
  color: {
    type: String,
    trim: true,
    default: ''
  },
  stoneType: {
    type: String,
    trim: true,
    default: 'diamond'
  },
  overtone: {
    type: String,
    trim: true,
    default: ''
  },
  intensity: {
    type: String,
    trim: true,
    default: ''
  },
  clarity: {
    type: String,
    trim: true,
    default: ''
  },
  cut: {
    type: String,
    trim: true,
    default: ''
  },
  polish: {
    type: String,
    trim: true,
    default: ''
  },
  price: {
    type: Number,
    default: 0
  },
  symmetry: {
    type: String,
    trim: true,
    default: ''
  },
  location: {
    type: String,
    trim: true,
    default: ''
  },
  technology: {
    type: String,
    trim: true,
    default: ''
  },
  photo: {
    type: String,
    trim: true,
    default: ''
  },
  video: {
    type: String,
    trim: true,
    default: ''
  },
  sold: {
    type: Boolean,
    default: false
  },
  onDeal: {
    type: Boolean,
    default: false
  },
  dealId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deal',
    default: null
  },
  status: {
    type: String,
    trim: true,
    default: 'available',
    enum: ['available', 'OnDeal', 'Sold', 'reserved', 'inactive']
  },
  measurement1: {
    type: Number,
    default: 0
  },
  measurement2: {
    type: Number,
    default: 0
  },
  measurement3: {
    type: Number,
    default: 0
  },
  tableSize: {
    type: Number,
    default: 0
  },
  crownHeight: {
    type: Number,
    default: 0
  },
  pavilionDepth: {
    type: Number,
    default: 0
  },
  girdle: {
    type: String,
    trim: true,
    default: ''
  },
  culet: {
    type: String,
    trim: true,
    default: ''
  },
  totalDepth: {
    type: Number,
    default: 0
  },
  fluorescence: {
    type: String,
    trim: true,
    default: ''
  },
  ha: {
    type: String,
    trim: true,
    default: ''
  },
  certificateInstitute: {
    type: String,
    trim: true,
    default: ''
  },
  certificateNumber: {
    type: String,
    trim: true,
    default: ''
  },
  link: {
    type: String,
    trim: true,
    default: ''
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// If MongoDB is not available, use in-memory data
if (global.products !== undefined) {
  console.log('Using in-memory Product model');
  
  // Mock methods for in-memory storage
  const Product = function(data) {
    Object.assign(this, data);
    this._id = Math.random().toString(36).substring(2, 15);
    
    // Initialize new fields if they don't exist
    if (this.onDeal === undefined) this.onDeal = false;
    if (this.dealId === undefined) this.dealId = null;
    if (this.status === undefined) this.status = 'available';
  };
  
  Product.find = async function(filter = {}) {
    console.log('In-memory Product.find called with filter:', filter);
    
    // Filter results based on all filter criteria
    let results = [...global.products];
    
    // OnDeal filter
    if (filter.onDeal !== undefined) {
      results = results.filter(p => p.onDeal === filter.onDeal);
    }
    
    // Status filter
    if (filter.status) {
      if (filter.status.$nin) {
        results = results.filter(p => !filter.status.$nin.includes(p.status));
      } else if (filter.status.$in) {
        results = results.filter(p => filter.status.$in.includes(p.status));
      } else {
        results = results.filter(p => p.status === filter.status);
      }
    }
    
    // DealId filter
    if (filter.dealId) {
      results = results.filter(p => p.dealId && p.dealId.toString() === filter.dealId.toString());
    }
    
    // Shape filter
    if (filter.shape) {
      if (filter.shape.$in) {
        results = results.filter(p => filter.shape.$in.includes(p.shape));
      } else {
        results = results.filter(p => p.shape === filter.shape);
      }
    }
    
    // Carat/weight filter
    if (filter.carat) {
      if (filter.carat.$gte) {
        results = results.filter(p => p.carat >= filter.carat.$gte);
      }
      if (filter.carat.$lte) {
        results = results.filter(p => p.carat <= filter.carat.$lte);
      }
    }
    
    // Clarity filter
    if (filter.clarity) {
      if (filter.clarity.$in) {
        results = results.filter(p => filter.clarity.$in.includes(p.clarity));
      } else {
        results = results.filter(p => p.clarity === filter.clarity);
      }
    }
    
    // Color filter
    if (filter.color) {
      if (filter.color.$in) {
        results = results.filter(p => filter.color.$in.includes(p.color));
      } else {
        results = results.filter(p => p.color === filter.color);
      }
    }
    
    // Cut filter
    if (filter.cut) {
      if (filter.cut.$in) {
        results = results.filter(p => filter.cut.$in.includes(p.cut));
      } else {
        results = results.filter(p => p.cut === filter.cut);
      }
    }
    
    // Polish filter
    if (filter.polish) {
      if (filter.polish.$in) {
        results = results.filter(p => filter.polish.$in.includes(p.polish));
      } else {
        results = results.filter(p => p.polish === filter.polish);
      }
    }
    
    // Symmetry filter
    if (filter.symmetry) {
      if (filter.symmetry.$in) {
        results = results.filter(p => filter.symmetry.$in.includes(p.symmetry));
      } else {
        results = results.filter(p => p.symmetry === filter.symmetry);
      }
    }
    
    // Length filter (measurement1)
    if (filter.measurement1) {
      if (filter.measurement1.$gte) {
        results = results.filter(p => p.measurement1 >= filter.measurement1.$gte);
      }
      if (filter.measurement1.$lte) {
        results = results.filter(p => p.measurement1 <= filter.measurement1.$lte);
      }
    }
    
    // Width filter (measurement2)
    if (filter.measurement2) {
      if (filter.measurement2.$gte) {
        results = results.filter(p => p.measurement2 >= filter.measurement2.$gte);
      }
      if (filter.measurement2.$lte) {
        results = results.filter(p => p.measurement2 <= filter.measurement2.$lte);
      }
    }
    
    // Height filter (measurement3)
    if (filter.measurement3) {
      if (filter.measurement3.$gte) {
        results = results.filter(p => p.measurement3 >= filter.measurement3.$gte);
      }
      if (filter.measurement3.$lte) {
        results = results.filter(p => p.measurement3 <= filter.measurement3.$lte);
      }
    }
    
    // Table size filter
    if (filter.tableSize) {
      if (filter.tableSize.$gte) {
        results = results.filter(p => p.tableSize >= filter.tableSize.$gte);
      }
      if (filter.tableSize.$lte) {
        results = results.filter(p => p.tableSize <= filter.tableSize.$lte);
      }
    }
    
    // Total depth filter
    if (filter.totalDepth) {
      if (filter.totalDepth.$gte) {
        results = results.filter(p => p.totalDepth >= filter.totalDepth.$gte);
      }
      if (filter.totalDepth.$lte) {
        results = results.filter(p => p.totalDepth <= filter.totalDepth.$lte);
      }
    }
    
    // Ratio filter (special case with $expr)
    if (filter.$and) {
      // Look for ratio expression in $and array
      const ratioExpr = filter.$and.find(item => item.$expr && (
        item.$expr.$and || 
        item.$expr.$gte || 
        item.$expr.$lte
      ));
      
      if (ratioExpr) {
        const exprObj = ratioExpr.$expr;
        
        if (exprObj.$and) {
          // Both min and max ratio specified
          const minRatio = exprObj.$and[0].$gte[1]; // Get min value
          const maxRatio = exprObj.$and[1].$lte[1]; // Get max value
          
          results = results.filter(p => {
            if (p.measurement1 > 0 && p.measurement2 > 0) {
              const ratio = p.measurement1 / p.measurement2;
              return ratio >= minRatio && ratio <= maxRatio;
            }
            return false;
          });
        } else if (exprObj.$gte) {
          // Only min ratio specified
          const minRatio = exprObj.$gte[1];
          
          results = results.filter(p => {
            if (p.measurement1 > 0 && p.measurement2 > 0) {
              const ratio = p.measurement1 / p.measurement2;
              return ratio >= minRatio;
            }
            return false;
          });
        } else if (exprObj.$lte) {
          // Only max ratio specified
          const maxRatio = exprObj.$lte[1];
          
          results = results.filter(p => {
            if (p.measurement1 > 0 && p.measurement2 > 0) {
              const ratio = p.measurement1 / p.measurement2;
              return ratio <= maxRatio;
            }
            return false;
          });
        }
      }
    }
    
    return results;
  };
  
  Product.countDocuments = async function(filter = {}) {
    const results = await this.find(filter);
    return results.length;
  };
  
  module.exports = Product;
} else {
  // If MongoDB is available, use the regular model
  const Product = mongoose.model('Product', ProductSchema);

  // Override findById to handle both _id and custom id field
  const originalFindById = Product.findById;

  Product.findById = async function(id) {
    console.log("Custom findById called with:", id);
    
    try {
      // First try the standard _id lookup
      let product;
      try {
        product = await originalFindById.call(this, id);
      } catch (error) {
        console.log("Error in _id lookup, possibly invalid ObjectId:", error.message);
        product = null;
      }
      
      if (product) {
        console.log("Found product by _id");
        return product;
      }
      
      // If not found, try looking up by 'id' field
      console.log("Product not found by _id, trying 'id' field lookup");
      const productByIdField = await this.findOne({ id: id });
      
      if (productByIdField) {
        console.log("Found product by 'id' field");
        return productByIdField;
      }
      
      // Try one more approach - check if any product has this as string representation of _id
      console.log("Trying string match on _id");
      const products = await this.find();
      for (const prod of products) {
        if (prod._id.toString() === id) {
          console.log("Found product by string _id match");
          return prod;
        }
      }
      
      console.log("Product not found by any method");
      return null;
    } catch (error) {
      console.error("Error in custom findById:", error);
      throw error;
    }
  };

  module.exports = Product;
} 