import React from 'react';
import { TopBar } from './TopBar';
import { DockBar } from './DockBar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="pt-12 pb-24 px-4 sm:px-6">
        {children}
      </main>
      <DockBar />
    </div>
  );
};
