import React, { useState, useEffect, useCallback } from 'react';
import { Lock } from 'lucide-react';

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export const Screensaver: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const resetTimer = useCallback(() => {
    setIsActive(false);
  }, []);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const startTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => setIsActive(true), INACTIVITY_TIMEOUT);
    };

    const handleActivity = () => {
      if (isActive) return; // Don't reset while screensaver is showing
      startTimer();
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
    startTimer();

    return () => {
      clearTimeout(timeout);
      events.forEach(e => window.removeEventListener(e, handleActivity));
    };
  }, [isActive]);

  // Update clock every second while screensaver is active
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  // Dismiss on any interaction
  useEffect(() => {
    if (!isActive) return;
    const dismiss = () => resetTimer();
    const events = ['mousedown', 'keydown', 'touchstart'];
    // Small delay to prevent instant dismissal
    const id = setTimeout(() => {
      events.forEach(e => window.addEventListener(e, dismiss, { once: true }));
    }, 300);
    return () => {
      clearTimeout(id);
      events.forEach(e => window.removeEventListener(e, dismiss));
    };
  }, [isActive, resetTimer]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center cursor-pointer select-none animate-in fade-in duration-700">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-blue-600/10 to-purple-600/10 blur-3xl" />
      </div>

      {/* Logo */}
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/20">
          <span className="text-3xl font-black text-white tracking-tighter">L</span>
        </div>
      </div>

      {/* Clock */}
      <div className="relative text-center">
        <p className="text-7xl sm:text-8xl font-extralight text-white tracking-wider tabular-nums">
          {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className="text-lg text-white/40 mt-3 font-light capitalize">
          {currentTime.toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
      </div>

      {/* Unlock hint */}
      <div className="absolute bottom-16 flex items-center gap-2 text-white/20">
        <Lock className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">Toca para desbloquear</span>
      </div>
    </div>
  );
};
