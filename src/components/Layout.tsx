import React, { useEffect } from 'react';
import { TopBar } from './TopBar';
import { DockBar } from './DockBar';
import { Screensaver } from './Screensaver';
import { Toaster } from '@/components/ui/toaster';
import { useWhatsappIncomingNotifier } from '@/hooks/useWhatsappIncomingNotifier';
import { useMarketingUnread } from '@/hooks/useMarketingUnread';
import { useNotificationSoundOnIncrease } from '@/hooks/useNotificationSoundOnIncrease';
import { unlockNotificationAudio } from '@/lib/notificationSounds';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  useWhatsappIncomingNotifier();
  const { total: marketingUnread } = useMarketingUnread();
  useNotificationSoundOnIncrease(marketingUnread, 'marketing');
  useEffect(() => {
    unlockNotificationAudio();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Screensaver />
      <TopBar />
      <main className="pt-12 pb-24 px-4 sm:px-6">
        {children}
      </main>
      <DockBar />
      <Toaster />
    </div>
  );
};
