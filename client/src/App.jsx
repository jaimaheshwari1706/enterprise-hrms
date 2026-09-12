import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { bootstrapAuth } from './features/auth/authSlice';
import { ToastProvider } from './components/ToastProvider';

export default function App() {
  const dispatch = useDispatch();

  // On every fresh page load, try to silently restore the session from the
  // httpOnly refresh-token cookie (see authSlice.bootstrapAuth). The theme
  // class is applied by the theme slice itself before the first render.
  useEffect(() => {
    dispatch(bootstrapAuth());
  }, [dispatch]);

  return (
    <ToastProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ToastProvider>
  );
}
