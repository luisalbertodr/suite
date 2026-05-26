import React from 'react';
import { TopBar } from './TopBar';
import { DockBar } from './DockBar';
import { Screensaver } from './Screensaver';
import { useWhatsappIncomingNotifier } from '@/hooks/useWhatsappIncomingNotifier';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  useWhatsappIncomingNotifier();
  return (
    <div className="min-h-screen bg-background">
      <Screensaver />
      <TopBar />
      <main className="pt-12 pb-24 px-4 sm:px-6">
        {children}
      </main>
      <DockBar />
    </div>
  );
};
