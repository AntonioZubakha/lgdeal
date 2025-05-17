/**
 * Скрипт миграции корзин из отдельной коллекции в модель пользователя
 * 
 * Запуск: node server/scripts/migrateCart.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Загружаем переменные окружения
dotenv.config();

// Определяем схемы для работы с существующими данными
const CartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
    min: 1
  },
  dateAdded: {
    type: Date,
    default: Date.now
  }
});

const CartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [CartItemSchema],
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const OldCart = mongoose.model('Cart', CartSchema);
const User = mongoose.model('User');

// Функция миграции
const migrateCartsToUsers = async () => {
  try {
    // Подключение к MongoDB
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lgdx';
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(`Подключено к MongoDB: ${mongoose.connection.host}`);

    // Находим все корзины
    const carts = await OldCart.find();
    console.log(`Найдено ${carts.length} корзин для миграции`);

    // Для каждой корзины обновляем соответствующего пользователя
    let migratedCount = 0;
    let errorCount = 0;

    for (const cart of carts) {
      try {
        // Находим пользователя
        const user = await User.findById(cart.user);
        
        if (!user) {
          console.log(`Пользователь не найден для корзины: ${cart._id}`);
          errorCount++;
          continue;
        }

        // Обновляем корзину пользователя
        user.cart = {
          items: cart.items,
          updatedAt: cart.updatedAt || Date.now()
        };

        await user.save();
        console.log(`Корзина перенесена для пользователя: ${user.email}`);
        migratedCount++;
      } catch (err) {
        console.error(`Ошибка при миграции корзины ${cart._id}:`, err);
        errorCount++;
      }
    }

    console.log(`Миграция завершена.`);
    console.log(`Успешно перенесено: ${migratedCount}`);
    console.log(`Ошибки: ${errorCount}`);

    // Подчищаем коллекцию корзин (опционально)
    // Раскомментируйте, если хотите удалить старые данные после успешной миграции
    // await OldCart.deleteMany({});
    // console.log('Старая коллекция корзин очищена');

  } catch (error) {
    console.error('Ошибка миграции:', error);
  } finally {
    // Отключаемся от БД
    await mongoose.disconnect();
    console.log('Отключено от MongoDB');
  }
};

// Запускаем миграцию
migrateCartsToUsers(); 