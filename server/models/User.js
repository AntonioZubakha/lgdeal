const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Схема элемента корзины
const CartItemSchema = new Schema({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  dateAdded: {
    type: Date,
    default: Date.now
  }
});

// Схема пользователя
const UserSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: Schema.Types.ObjectId,
    ref: 'Company'
  },
  role: {
    type: String,
    enum: ['admin', 'supervisor', 'manager'],
    default: 'manager'
  },
  isActive: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: null
  },
  // Добавляем корзину как встроенный массив
  cart: {
    items: [CartItemSchema],
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }
});

// Обновляем дату последнего обновления корзины при изменении
UserSchema.pre('save', function(next) {
  if (this.isModified('cart.items')) {
    this.cart.updatedAt = Date.now();
  }
  next();
});

// Вспомогательные методы для работы с корзиной
UserSchema.methods.addToCart = function(productId) {
  const existingItemIndex = this.cart.items.findIndex(
    item => item.product.toString() === productId.toString()
  );

  if (existingItemIndex >= 0) {
    // Если товар уже в корзине, не добавляем его снова (каждый камень уникален)
    return Promise.resolve(this);
  } else {
    // Добавляем новый товар в корзину
    this.cart.items.push({
      product: productId,
      dateAdded: Date.now()
    });
  }
  
  this.cart.updatedAt = Date.now();
  return this.save();
};

UserSchema.methods.removeFromCart = function(itemId) {
  this.cart.items = this.cart.items.filter(
    item => item._id.toString() !== itemId.toString()
  );
  this.cart.updatedAt = Date.now();
  return this.save();
};

UserSchema.methods.clearCart = function() {
  this.cart.items = [];
  this.cart.updatedAt = Date.now();
  return this.save();
};

module.exports = mongoose.model('User', UserSchema); 