import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import themeReducer from '../features/theme/themeSlice';
import notificationsReducer from '../features/notifications/notificationsSlice';

// Only truly global, cross-page state lives here: authentication, theme,
// and notifications (for the navbar badge count). Everything else (form
// state, table filters, modal open/closed) stays as local component state.
export const store = configureStore({
  reducer: {
    auth: authReducer,
    theme: themeReducer,
    notifications: notificationsReducer,
  },
});
