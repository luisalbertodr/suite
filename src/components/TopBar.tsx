import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, LogOut, Settings, ChevronDown, Moon, Sun } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from 'next-themes';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { useWorkCenterBranding } from '@/hooks/useWorkCenterBranding';
import { useBillingScopeRoute } from '@/hooks/useBillingScopeRoute';
import { BillingScopeToggle } from '@/components/BillingScopeToggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const { isMultiEntity, loading: wcLoading } = useWorkCenter();
  const { displayName, logoUrlLight, logoUrlDark, isLoading: brandingLoading } = useWorkCenterBranding();
  const { enabled: billingScopeEnabled } = useBillingScopeRoute();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleDateClick = () => navigate('/agenda');
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  const activeTheme = resolvedTheme ?? theme;
  const logoUrl = activeTheme === 'dark' ? (logoUrlDark || logoUrlLight) : logoUrlLight;

  const brandLabel = displayName.trim() || 'Lipoout';
  const showBrandSkeleton = (companyLoading || brandingLoading) && !displayName;
  const showBillingToggle = isMultiEntity && !wcLoading && !pathname.startsWith('/whatsapp');

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-12 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center justify-between h-full px-5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {showBrandSkeleton ? (
            <span className="h-6 w-32 rounded bg-muted animate-pulse" aria-hidden />
          ) : (
            <>
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt=""
                  className="h-10 w-auto max-w-[220px] shrink-0 self-end object-contain object-center"
                />
              )}
              {!logoUrl && (
                <span className="text-sm font-semibold text-foreground truncate">{brandLabel}</span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {showBillingToggle && (
            <BillingScopeToggle disabled={!billingScopeEnabled} />
          )}

          <button
            type="button"
            onClick={toggleTheme}
            className="relative p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label="Cambiar tema"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-foreground/60" />
            )}
          </button>

          <NotificationBell />

          <button
            type="button"
            onClick={handleDateClick}
            className="flex items-center gap-2 text-xs text-foreground/60 hover:text-foreground/80 transition-colors"
          >
            <span className="font-medium tabular-nums">
              {currentDateTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="hidden xs:inline">
              {currentDateTime.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors outline-none">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-xs font-medium text-foreground/70 hidden sm:block max-w-[120px] truncate">
                {user?.email?.split('@')[0]}
              </span>
              <ChevronDown className="h-3 w-3 text-foreground/40" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="text-xs" onClick={() => navigate('/configuracion')}>
                <Settings className="h-3.5 w-3.5 mr-2" />
                Configuración
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs text-destructive" onClick={signOut}>
                <LogOut className="h-3.5 w-3.5 mr-2" />
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
