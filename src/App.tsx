import type { JSX } from 'react';
import { ToastProvider } from '@simcity/components/Toast';
import { Shell } from '@/shell/Shell';

export function App(): JSX.Element {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
