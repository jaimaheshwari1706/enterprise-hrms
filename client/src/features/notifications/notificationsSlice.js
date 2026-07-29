import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items: [],
  unreadCount: 0,
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setNotifications(state, action) {
      state.items = action.payload;
      state.unreadCount = action.payload.filter((n) => !n.isRead).length;
    },
    markAllRead(state) {
      state.items = state.items.map((n) => ({ ...n, isRead: true }));
      state.unreadCount = 0;
    },
  },
});

export const { setNotifications, markAllRead } = notificationsSlice.actions;
export default notificationsSlice.reducer;
