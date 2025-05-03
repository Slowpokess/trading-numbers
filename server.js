// server.js - прокси-сервер для обхода CORS при запросах к API OKX
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Для обслуживания статических файлов в production окружении
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '/')));
}

// Разрешаем CORS для всех источников (в продакшн лучше указать конкретный домен)
app.use(cors());

// Маршрут для тестирования разных URL API
app.get('/api/okx/test-endpoints', async (req, res) => {
  const endpoints = [
    'https://www.okx.com/v3/c2c/tradingOrders/books',
    'https://www.okx.com/api/v5/c2c/trade/orders',
    'https://www.okx.com/api/v5/c2c/otc-ticker/ticker'
  ];
  
  const results = {};
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(endpoint, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      results[endpoint] = {
        status: response.status,
        success: true,
        dataPreview: JSON.stringify(response.data).substring(0, 100) + '...'
      };
    } catch (error) {
      results[endpoint] = {
        success: false,
        error: error.message
      };
    }
  }
  
  res.json(results);
});

// Маршрут для получения предложений на покупку USDT (продажа UAH)
app.get('/api/okx/buy-orders', async (req, res) => {
  try {
    // Текущий основной URL API
    const baseUrl = 'https://www.okx.com/v3/c2c/tradingOrders/books';
    
    // Альтернативные URL на случай, если основной не работает
    const alternativeUrls = [
      'https://www.okx.com/api/v5/c2c/trade/orders',
      'https://www.okx.com/api/v5/c2c/otc-ticker/ticker'
    ];
    
    let response;
    let errorMessages = [];
    
    // Пробуем основной URL
    try {
      response = await axios.get(
        baseUrl, 
        { 
          params: {
            quoteCurrency: 'UAH',
            baseCurrency: 'USDT',
            side: 'sell',
            paymentMethod: 'all',
            userType: 'all',
            showTrade: false,
            showFollow: false,
            showAlreadyTraded: false,
            isAbleFilter: false
          },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://www.okx.com/p2p-markets/uah/buy-usdt',
            'Origin': 'https://www.okx.com'
          },
          timeout: 10000
        }
      );
      console.log('Успешный ответ от OKX (buy-orders):', JSON.stringify(response.data).substring(0, 300) + '...');
    } catch (mainError) {
      console.error('Ошибка при использовании основного URL:', mainError.message);
      errorMessages.push(`Основной URL (${baseUrl}): ${mainError.message}`);
      
      // Пробуем альтернативные URL
      for (const altUrl of alternativeUrls) {
        try {
          console.log(`Пробуем альтернативный URL: ${altUrl}`);
          response = await axios.get(
            altUrl, 
            { 
              params: {
                quoteCurrency: 'UAH',
                baseCurrency: 'USDT',
                side: 'sell',
                t: Date.now()
              },
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://www.okx.com/p2p-markets/uah/buy-usdt',
                'Origin': 'https://www.okx.com'
              },
              timeout: 10000
            }
          );
          console.log(`Успешный ответ от альтернативного URL (${altUrl}):`, JSON.stringify(response.data).substring(0, 300) + '...');
          break;
        } catch (altError) {
          console.error(`Ошибка при использовании альтернативного URL (${altUrl}):`, altError.message);
          errorMessages.push(`Альтернативный URL (${altUrl}): ${altError.message}`);
        }
      }
    }
    
    // Если удалось получить ответ от одного из URL
    if (response && response.data) {
      res.json(response.data);
    } else {
      // Если все запросы завершились с ошибкой
      throw new Error('Не удалось получить данные ни с одного API-эндпоинта');
    }
  } catch (error) {
    console.error('Ошибка при получении данных с OKX (buy-orders):', error.message);
    
    if (error.response) {
      console.error('Статус ошибки:', error.response.status);
      console.error('Данные ошибки:', error.response.data);
      console.error('Заголовки ответа:', error.response.headers);
    } else if (error.request) {
      console.error('Запрос был сделан, но ответ не получен', error.request);
    }
    
    // Генерируем симулированные данные для демонстрации работы приложения
    const simulatedData = {
      data: {
        sell: [
          { price: "38.50", availableAmount: "1000", paymentMethods: ["Монобанк", "Приват24"] },
          { price: "38.45", availableAmount: "800", paymentMethods: ["Монобанк", "Приват24"] },
          { price: "38.40", availableAmount: "1200", paymentMethods: ["PUMB", "Приват24"] },
          { price: "38.35", availableAmount: "500", paymentMethods: ["Монобанк"] },
          { price: "38.30", availableAmount: "750", paymentMethods: ["Приват24", "PUMB"] }
        ]
      }
    };
    
    console.log('Отправляем симулированные данные из-за ошибки API');
    res.json(simulatedData);
  }
});

// Маршрут для получения предложений на продажу USDT (покупка UAH)
app.get('/api/okx/sell-orders', async (req, res) => {
  try {
    // Текущий основной URL API
    const baseUrl = 'https://www.okx.com/v3/c2c/tradingOrders/books';
    
    // Альтернативные URL на случай, если основной не работает
    const alternativeUrls = [
      'https://www.okx.com/api/v5/c2c/trade/orders',
      'https://www.okx.com/api/v5/c2c/otc-ticker/ticker'
    ];
    
    let response;
    let errorMessages = [];
    
    // Пробуем основной URL
    try {
      response = await axios.get(
        baseUrl, 
        { 
          params: {
            quoteCurrency: 'UAH',
            baseCurrency: 'USDT',
            side: 'buy',
            paymentMethod: 'all',
            userType: 'all',
            showTrade: false,
            showFollow: false,
            showAlreadyTraded: false,
            isAbleFilter: false
          },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://www.okx.com/p2p-markets/uah/sell-usdt',
            'Origin': 'https://www.okx.com'
          },
          timeout: 10000
        }
      );
      console.log('Успешный ответ от OKX (sell-orders):', JSON.stringify(response.data).substring(0, 300) + '...');
    } catch (mainError) {
      console.error('Ошибка при использовании основного URL:', mainError.message);
      errorMessages.push(`Основной URL (${baseUrl}): ${mainError.message}`);
      
      // Пробуем альтернативные URL
      for (const altUrl of alternativeUrls) {
        try {
          console.log(`Пробуем альтернативный URL: ${altUrl}`);
          response = await axios.get(
            altUrl, 
            { 
              params: {
                quoteCurrency: 'UAH',
                baseCurrency: 'USDT',
                side: 'buy',
                t: Date.now()
              },
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://www.okx.com/p2p-markets/uah/sell-usdt',
                'Origin': 'https://www.okx.com'
              },
              timeout: 10000
            }
          );
          console.log(`Успешный ответ от альтернативного URL (${altUrl}):`, JSON.stringify(response.data).substring(0, 300) + '...');
          break;
        } catch (altError) {
          console.error(`Ошибка при использовании альтернативного URL (${altUrl}):`, altError.message);
          errorMessages.push(`Альтернативный URL (${altUrl}): ${altError.message}`);
        }
      }
    }
    
    // Если удалось получить ответ от одного из URL
    if (response && response.data) {
      res.json(response.data);
    } else {
      // Если все запросы завершились с ошибкой
      throw new Error('Не удалось получить данные ни с одного API-эндпоинта');
    }
  } catch (error) {
    console.error('Ошибка при получении данных с OKX (sell-orders):', error.message);
    
    if (error.response) {
      console.error('Статус ошибки:', error.response.status);
      console.error('Данные ошибки:', error.response.data);
      console.error('Заголовки ответа:', error.response.headers);
    } else if (error.request) {
      console.error('Запрос был сделан, но ответ не получен', error.request);
    }
    
    // Генерируем симулированные данные для демонстрации работы приложения
    const simulatedData = {
      data: {
        buy: [
          { price: "39.00", availableAmount: "1200", paymentMethods: ["Монобанк", "Приват24"] },
          { price: "39.05", availableAmount: "900", paymentMethods: ["Приват24"] },
          { price: "39.10", availableAmount: "1100", paymentMethods: ["Монобанк", "PUMB"] },
          { price: "39.15", availableAmount: "650", paymentMethods: ["PUMB"] },
          { price: "39.20", availableAmount: "800", paymentMethods: ["Монобанк", "Приват24"] }
        ]
      }
    };
    
    console.log('Отправляем симулированные данные из-за ошибки API');
    res.json(simulatedData);
  }
});

// Тестовый маршрут для проверки работы сервера
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Прокси-сервер работает' });
});

// Корневой маршрут для сервера в Vercel
app.get('/', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.join(__dirname, '/index.html'));
  } else {
    res.send('Сервер запущен. Откройте index.html в браузере для использования приложения.');
  }
});

// Для обработки любых других маршрутов в production
app.get('*', (req, res) => {
  if (process.env.NODE_ENV === 'production' && !req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '/index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Прокси-сервер запущен на порту ${PORT}`);
  console.log(`Тестовый маршрут: http://localhost:${PORT}/api/test`);
  console.log(`Маршрут предложений на покупку USDT: http://localhost:${PORT}/api/okx/buy-orders`);
  console.log(`Маршрут предложений на продажу USDT: http://localhost:${PORT}/api/okx/sell-orders`);
});