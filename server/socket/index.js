const jwt = require('jsonwebtoken');
const Deal = require('../models/Deal');

// Секретный ключ для JWT - используем значение из переменной окружения или временное для разработки
// ВНИМАНИЕ: Для продакшена всегда должен быть настроен JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET || 'lgdx_default_secret_dev_only';

// Инициализация Socket.io
function initializeSocket(server) {
  const io = require('socket.io')(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET not set in environment variables. Using default secret for development only.');
  }

  // Middleware для проверки аутентификации пользователей через токен
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Проверка токена
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.userId;
      
      // Получение ID сделки из запроса
      const dealId = socket.handshake.query.dealId;
      if (dealId) {
        socket.dealId = dealId;
        
        // Проверяем право пользователя на доступ к сделке
        const deal = await Deal.findById(dealId);
        if (!deal) {
          return next(new Error('Deal not found'));
        }
        
        // Проверка, является ли пользователь покупателем, продавцом или администратором LGDEAL
        const userIsBuyer = deal.buyerId && deal.buyerId.toString() === decoded.userId;
        const userIsSeller = deal.sellerId && deal.sellerId.toString() === decoded.userId;
        const userIsLgdealAdmin = decoded.isLgdealSupervisor;
        
        if (!userIsBuyer && !userIsSeller && !userIsLgdealAdmin) {
          return next(new Error('Not authorized to access this deal'));
        }
      }
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error(`Authentication error: ${error.message}`));
    }
  });

  // Обработка подключения клиентов
  io.on('connection', (socket) => {
    console.log(`User ${socket.userId} connected to socket.io`);
    
    // Если указана сделка, подписываем пользователя на обновления по этой сделке
    if (socket.dealId) {
      socket.join(`deal:${socket.dealId}`);
      console.log(`User ${socket.userId} subscribed to updates for deal ${socket.dealId}`);
    }
    
    // Отключение клиента
    socket.on('disconnect', () => {
      console.log(`User ${socket.userId} disconnected from socket.io`);
    });
  });

  // Функция для отправки обновлений по сделке всем подписанным пользователям
  const emitDealUpdate = async (dealId) => {
    try {
      // Получаем обновленные данные сделки со всеми связанными данными
      const updatedDeal = await Deal.findById(dealId)
        .populate({
          path: 'products.product',
          select: 'shape carat color clarity price'
        })
        .populate('buyerId', 'email firstName lastName')
        .populate('sellerId', 'email firstName lastName')
        .populate('buyerCompanyId', 'name')
        .populate('sellerCompanyId', 'name')
        .populate({
          path: 'activityLog.performedBy',
          select: 'email firstName lastName'
        })
        .populate({
          path: 'negotiationDetails.proposedTerms.proposedBy',
          select: 'email firstName lastName'
        });
      
      if (!updatedDeal) {
        console.error(`Cannot emit update for deal ${dealId}: Deal not found`);
        return;
      }
      
      // Отправляем обновление всем в комнате deal:dealId
      io.to(`deal:${dealId}`).emit('deal_updated', updatedDeal);
      console.log(`Emitted deal update for dealId: ${dealId}`);
    } catch (error) {
      console.error(`Error emitting deal update for dealId ${dealId}:`, error);
    }
  };

  // Возвращаем объект с сокетом и вспомогательными функциями
  return {
    io,
    emitDealUpdate
  };
}

module.exports = initializeSocket; 