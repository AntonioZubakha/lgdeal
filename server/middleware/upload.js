const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Настройка хранилища для файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dest = path.join(__dirname, '../uploads/invoices');
    
    // Убедимся, что директория существует
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    // Получаем ID сделки из параметров маршрута
    const dealId = req.params.dealId;
    
    // Создаем уникальное имя файла с ID сделки и оригинальным расширением файла
    const fileExt = path.extname(file.originalname);
    const fileName = `invoice-${dealId}-${Date.now()}${fileExt}`;
    
    cb(null, fileName);
  }
});

// Фильтр файлов - разрешаем только PDF
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Только PDF файлы разрешены'), false);
  }
};

// Экспортируем middleware для загрузки файлов
const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // Лимит размера файла - 5MB
  }
});

module.exports = upload; 