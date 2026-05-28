import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, Settings, ChevronDown, Moon, Sun } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from 'next-themes';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { CompanySwitcher } from './CompanySwitcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  const { data: company } = useQuery({
    queryKey: ['company', companyId, 'topbar-brand'],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('companies')
        .select('name, logo_url')
        .eq('id', companyId)
        .single();
      if (error) {
        console.error('Error fetching company for top bar:', error);
        return null;
      }
      return data as { name: string; logo_url: string | null };
    },
    enabled: !!companyId && !companyLoading,
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleDateClick = () => navigate('/agenda');
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const brandLabel = company?.name?.trim() || 'Lipoout';

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-12 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center justify-between h-full px-5">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {company?.logo_url ? (
            <img
              src={company.logo_url}
              alt={brandLabel}
              className="h-8 max-w-[220px] w-auto object-contain object-left"
            />
          ) : (
            <span className="text-sm font-semibold text-foreground truncate">{brandLabel}</span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <CompanySwitcher />

          <button
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
