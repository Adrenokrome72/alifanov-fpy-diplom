import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./features/authSlice";
import filesReducer from "./features/filesSlice";
import foldersReducer from "./features/foldersSlice";
import adminReducer from "./features/adminSlice";

const store = configureStore({
  reducer: {
    auth: authReducer,
    files: filesReducer,
    folders: foldersReducer,
    admin: adminReducer,
  },
});

export default store;
