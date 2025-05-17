const { verifyToken } = require('../utils/userUtils');

/**
 * Middleware для опциональной аутентификации
 * Пытается авторизовать пользователя по токену, но не блокирует запрос,
 * если токен не предоставлен или недействителен
 */
const optionalAuth = (req, res, next) => {
  // Получить токен из заголовка
  const token = req.header('x-auth-token');

  // Если токен отсутствует, просто пропускаем аутентификацию
  if (!token) {
    return next();
  }

  // Проверить токен
  const decoded = verifyToken(token);
  if (decoded) {
    // Добавить данные пользователя в запрос
    req.user = decoded;
  } else {
    console.log('Optional auth: Invalid token');
  }
  
  next();
};

module.exports = optionalAuth; 