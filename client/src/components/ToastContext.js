import { createContext } from 'react';

// Split out from ToastProvider.jsx so that file exports only the component —
// react-refresh's only-export-components rule needs a component-only file
// to keep Fast Refresh reliable, and useToast (a hook) needs a home too.
export const ToastContext = createContext(null);
