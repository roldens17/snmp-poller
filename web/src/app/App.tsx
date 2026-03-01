import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';
import { ToastProvider as LegacyToastProvider } from '../legacy/components/ToastProvider';
import { ConfirmProvider as LegacyConfirmProvider } from '../legacy/components/ConfirmProvider';

export default function App() {
  return (
    <LegacyConfirmProvider>
      <LegacyToastProvider>
      <RouterProvider router={router} />
      <Toaster />
      </LegacyToastProvider>
    </LegacyConfirmProvider>
  );
}
