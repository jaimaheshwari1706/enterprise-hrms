import { createSlice } from '@reduxjs/toolkit';

function getInitialMode() {
  const stored = localStorage.getItem('hrms-theme');
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const initialState = {
  mode: getInitialMode(), // 'light' | 'dark'
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    toggleTheme(state) {
      state.mode = state.mode === 'dark' ? 'light' : 'dark';
      localStorage.setItem('hrms-theme', state.mode);
    },
    setTheme(state, action) {
      state.mode = action.payload;
      localStorage.setItem('hrms-theme', action.payload);
    },
  },
});

export const { toggleTheme, setTheme } = themeSlice.actions;
export default themeSlice.reducer;
