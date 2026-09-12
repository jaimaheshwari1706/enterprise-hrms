import { createSlice } from '@reduxjs/toolkit';

const STORAGE_KEY = 'hrms-theme';

function readStoredMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    /* private mode / blocked storage */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyMode(mode) {
  document.documentElement.classList.toggle('dark', mode === 'dark');
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

// Applied synchronously when the store is created (before the first
// render) so a dark-mode user never sees a white flash.
const initialMode = readStoredMode();
document.documentElement.classList.toggle('dark', initialMode === 'dark');

const themeSlice = createSlice({
  name: 'theme',
  initialState: { mode: initialMode }, // 'light' | 'dark'
  reducers: {
    toggleTheme(state) {
      state.mode = state.mode === 'dark' ? 'light' : 'dark';
      applyMode(state.mode);
    },
    setTheme(state, action) {
      state.mode = action.payload;
      applyMode(state.mode);
    },
  },
});

export const { toggleTheme, setTheme } = themeSlice.actions;
export default themeSlice.reducer;
