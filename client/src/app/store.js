import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import themeReducer from '../features/theme/themeSlice';

// Only truly global, cross-page state lives here: authentication and theme.
// Everything else (form state, table filters, modal open/closed, the
// notification feed) stays as local component state.
export const store = configureStore({
  reducer: {
    auth: authReducer,
    theme: themeReducer,
  },
});
