import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { bootstrapAuth } from './features/auth/authSlice';
import { ToastProvider } from './components/ToastProvider';

export default function App() {
  const dispatch = useDispatch();
  const mode = useSelector((state) => state.theme.mode);

  // Tailwind's dark: variant is driven by a "dark" class on <html>.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }, [mode]);

  // On every fresh page load, try to silently restore the session from the
  // httpOnly refresh-token cookie (see authSlice.bootstrapAuth).
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
