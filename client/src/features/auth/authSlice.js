import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from '../../api/authApi';

// status: 'idle' (not yet checked) | 'loading' | 'authenticated' | 'unauthenticated'
const initialState = {
  user: null, // { id, email, role, employee }
  accessToken: null,
  status: 'idle',
  error: null,
};

// Called on every full page load/refresh. Tries to silently exchange the
// httpOnly refresh-token cookie for a new access token; if that succeeds
// we're still logged in, otherwise we're not. This is what lets a user
// refresh the browser without being kicked back to /login.
export const bootstrapAuth = createAsyncThunk(
  'auth/bootstrap',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await authApi.refreshToken();
      return data.data; // { accessToken, user }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Not authenticated');
    }
  },
  {
    // Guards against duplicate concurrent bootstrap calls (React StrictMode
    // double-invokes effects in dev, firing this twice on every mount). The
    // refresh token is single-use/rotated server-side, so two concurrent
    // calls would race — one succeeds, one gets a stale-token 401 — and
    // whichever settles last wins the final auth state, sometimes wiping out
    // an otherwise-valid session. Bailing out here means only the first call
    // in flight ever reaches the network.
    condition: (_, { getState }) => getState().auth.status === 'idle',
  }
);

export const loginUser = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const { data } = await authApi.login(credentials);
    return data.data; // { accessToken, user }
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Login failed');
  }
});

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  try {
    await authApi.logout();
  } catch {
    // Even if the server call fails, we still clear local state below.
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAccessToken(state, action) {
      state.accessToken = action.payload;
    },
    logout(state) {
      state.user = null;
      state.accessToken = null;
      state.status = 'unauthenticated';
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapAuth.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(bootstrapAuth.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.status = 'authenticated';
      })
      .addCase(bootstrapAuth.rejected, (state) => {
        state.user = null;
        state.accessToken = null;
        state.status = 'unauthenticated';
      })
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.status = 'authenticated';
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'unauthenticated';
        state.error = action.payload;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.status = 'unauthenticated';
      });
  },
});

export const { setAccessToken, logout, clearAuthError } = authSlice.actions;
export default authSlice.reducer;

// Selectors
export const selectCurrentUser = (state) => state.auth.user;
export const selectAuthStatus = (state) => state.auth.status;
export const selectIsAuthenticated = (state) => state.auth.status === 'authenticated';
