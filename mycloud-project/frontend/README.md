# Frontend (React Application)

## Описание
Это фронтенд-часть облачного хранилища файлов, построенная на React с использованием Redux Toolkit для управления состоянием. Приложение предоставляет интерфейс для аутентификации, управления файлами и папками, а также административной панели.

## Структура папок и файлов
- `src/` - Исходный код приложения
  - `components/` - React компоненты (Login, FileManager, AdminPanel и др.)
  - `features/` - Redux slices для управления состоянием (auth, files, folders, admin)
  - `utils/` - Вспомогательные функции (clipboard, formatBytes, toast)
  - `styles/` - CSS файлы для стилизации
  - `App.jsx` - Главный компонент приложения
  - `index.jsx` - Точка входа
  - `store.js` - Конфигурация Redux store
  - `api.js` - Функции для взаимодействия с API
- `public/` - Статические файлы (index.html)
- `package.json` - Зависимости и скрипты
- `webpack.config.js` - Конфигурация Webpack
- `jest.setup.js` - Настройка Jest для тестирования

