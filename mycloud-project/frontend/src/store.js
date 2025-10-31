import { configureStore } from '@reduxjs/toolkit';
import authReducer from './features/authSlice';
import filesReducer from './features/filesSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    files: filesReducer,
  },
});

export default store;