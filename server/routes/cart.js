const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Product = require('../models/Product');
const mongoose = require('mongoose');

// @route   GET /api/cart
// @desc    Get user's cart
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    console.log("Cart GET - User ID:", req.user.userId);
    
    // Находим пользователя с его корзиной
    const user = await User.findById(req.user.userId)
      .populate('cart.items.product', 'shape carat caratWeight color clarity price photo imageUrl certificateInstitute certificateNumber');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Инициализируем корзину, если её нет
    if (!user.cart || !user.cart.items) {
      user.cart = { items: [], updatedAt: Date.now() };
      await user.save();
    }
    
    // Подсчитываем итоги (теперь каждый элемент считается за 1, т.к. каждый камень уникален)
    const totalItems = user.cart.items.length;
    const totalAmount = user.cart.items.reduce((sum, item) => {
      const price = item.product ? (item.product.price || 0) : 0;
      return sum + price;
    }, 0);
    
    return res.json({
      items: user.cart.items,
      totalItems,
      totalAmount
    });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/cart/add
// @desc    Add item to cart
// @access  Private
router.post('/add', auth, async (req, res) => {
  try {
    console.log("Cart ADD - User ID:", req.user.userId, "Product ID:", req.body.productId);
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    // Находим продукт по ID
    console.log("Attempting to find product with ID:", productId);
    let product;
    
    try {
      // First try MongoDB _id lookup
      if (mongoose.Types.ObjectId.isValid(productId)) {
        product = await Product.findById(productId);
        console.log("Custom findById called with:", productId);
      }
      
      // If not found or invalid ObjectId, try lookup by custom id field
      if (!product) {
        console.log("Not found by _id, trying 'id' field lookup");
        product = await Product.findOne({ id: productId });
      }
      
      // If still not found, try a direct string comparison with _id
      if (!product) {
        console.log("Not found by 'id' field, trying string _id comparison");
        const allProducts = await Product.find({}, '_id id').limit(1000);
        const matchProduct = allProducts.find(p => p._id.toString() === productId);
        
        if (matchProduct) {
          product = await Product.findById(matchProduct._id);
        }
      }
      
      console.log("Product search result:", product ? "Found" : "Not found");
    } catch (findError) {
      console.error("Error finding product:", findError);
      return res.status(500).json({ message: 'Error finding product' });
    }
    
    if (!product) {
      console.log("Product not found:", productId);
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if product is already sold
    if (product.sold) {
      return res.status(400).json({ message: 'Product is already sold' });
    }

    // Находим пользователя
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Инициализируем корзину, если её нет
    if (!user.cart) {
      user.cart = { items: [], updatedAt: Date.now() };
    }
    
    // Добавляем товар в корзину с помощью метода модели
    await user.addToCart(product._id);
    
    // Получаем обновлённого пользователя с заполненной корзиной
    const updatedUser = await User.findById(req.user.userId)
      .populate('cart.items.product', 'shape carat caratWeight color clarity price photo imageUrl certificateInstitute certificateNumber');
    
    // Подсчитываем итоги
    const totalItems = updatedUser.cart.items.length;
    const totalAmount = updatedUser.cart.items.reduce((sum, item) => {
      const price = item.product ? (item.product.price || 0) : 0;
      return sum + price;
    }, 0);
    
    return res.json({
      items: updatedUser.cart.items,
      totalItems,
      totalAmount
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/cart/remove/:itemId
// @desc    Remove item from cart
// @access  Private
router.delete('/remove/:itemId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Удаляем товар из корзины с помощью метода модели
    await user.removeFromCart(req.params.itemId);
    
    // Получаем обновлённого пользователя с заполненной корзиной
    const updatedUser = await User.findById(req.user.userId)
      .populate('cart.items.product', 'shape carat caratWeight color clarity price photo imageUrl certificateInstitute certificateNumber');
    
    // Подсчитываем итоги
    const totalItems = updatedUser.cart.items.length;
    const totalAmount = updatedUser.cart.items.reduce((sum, item) => {
      const price = item.product ? (item.product.price || 0) : 0;
      return sum + price;
    }, 0);
    
    return res.json({
      items: updatedUser.cart.items,
      totalItems,
      totalAmount
    });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/cart/clear
// @desc    Clear user's cart
// @access  Private
router.delete('/clear', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Очищаем корзину с помощью метода модели
    await user.clearCart();
    
    return res.json({
      items: [],
      totalItems: 0,
      totalAmount: 0
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 