import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from '../../api/authApi';

// status: 'idle' (not yet checked) | 'loading' | 'authenticated' | 'unauthenticated'
const initialState = {
  user: null, // { id, email, role, employee }
  accessToken: null,
  status: 'idle',
  error: null,
  // Set when the session ended without the user asking for it (refresh
  // token expired/revoked) so the login page can explain what happened.
  sessionExpired: false,
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
    return rejectWithValue(err.response?.data?.message || (err.response ? 'Login failed' : 'Unable to reach the server. Please try again.'));
  }
});

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  try {
    await authApi.logout();
  } catch {
    // Even if the server call fails, we still clear local state below.
  }
});

export const refreshCurrentUser = createAsyncThunk('auth/me', async () => {
  const { data } = await authApi.me();
  return data.data.user;
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
    sessionExpired(state) {
      state.user = null;
      state.accessToken = null;
      state.status = 'unauthenticated';
      state.sessionExpired = true;
    },
    clearAuthError(state) {
      state.error = null;
      state.sessionExpired = false;
    },
    updateCurrentEmployee(state, action) {
      if (state.user) state.user.employee = action.payload;
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
        state.sessionExpired = false;
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
        state.sessionExpired = false;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'unauthenticated';
        state.error = action.payload;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.status = 'unauthenticated';
        state.sessionExpired = false;
      })
      .addCase(refreshCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const { setAccessToken, logout, sessionExpired, clearAuthError, updateCurrentEmployee } = authSlice.actions;
export default authSlice.reducer;

// Selectors
export const selectCurrentUser = (state) => state.auth.user;
export const selectAuthStatus = (state) => state.auth.status;
export const selectIsAuthenticated = (state) => state.auth.status === 'authenticated';
export const selectSessionExpired = (state) => state.auth.sessionExpired;
export const selectIsHR = (state) => ['HR_ADMIN', 'SUPER_ADMIN'].includes(state.auth.user?.role);
