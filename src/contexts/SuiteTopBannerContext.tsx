import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { SUITE_TOP_BANNER_Z } from '@/lib/dialogLayers';

type BannerEntry = {
  id: string;
  content: React.ReactNode;
  order: number;
};

type SuiteTopBannerContextValue = {
  register: (id: string, content: React.ReactNode) => void;
  unregister: (id: string) => void;
};

const SuiteTopBannerContext = createContext<SuiteTopBannerContextValue | null>(null);

let orderCounter = 0;

export function SuiteTopBannerProvider({
  children,
  topClassName = 'top-14',
}: {
  children: React.ReactNode;
  topClassName?: string;
}) {
  const [banners, setBanners] = useState<BannerEntry[]>([]);

  const register = useCallback((id: string, content: React.ReactNode) => {
    setBanners((prev) => {
      const existing = prev.find((b) => b.id === id);
      if (existing) {
        return prev.map((b) => (b.id === id ? { ...b, content } : b));
      }
      orderCounter += 1;
      return [...prev, { id, content, order: orderCounter }];
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const value = useMemo(() => ({ register, unregister }), [register, unregister]);

  const sorted = useMemo(
    () => [...banners].sort((a, b) => a.order - b.order),
    [banners],
  );

  return (
    <SuiteTopBannerContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' && sorted.length > 0
        ? createPortal(
            <div
              className={cn(
                'fixed left-1/2 -translate-x-1/2 w-[min(100%,44rem)] max-w-3xl px-4',
                topClassName,
                'flex flex-col gap-2 pointer-events-none',
                SUITE_TOP_BANNER_Z,
              )}
              aria-live="polite"
            >
              {sorted.map((banner) => (
                <div
                  key={banner.id}
                  className="pointer-events-auto animate-in slide-in-from-top-4 fade-in duration-300"
                >
                  {banner.content}
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </SuiteTopBannerContext.Provider>
  );
}

export function useSuiteTopBanner(id: string, content: React.ReactNode | null | undefined) {
  const ctx = useContext(SuiteTopBannerContext);

  useEffect(() => {
    if (!ctx) return;
    if (content) {
      ctx.register(id, content);
    } else {
      ctx.unregister(id);
    }
    return () => ctx.unregister(id);
  }, [ctx, id, content]);
}

/** Aviso de texto simple en la franja superior. */
export function SuiteTopBannerText({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode | null | undefined;
}) {
  const content = useMemo(() => {
    if (!children) return null;
    return <div className={suiteTopBannerSurfaceClassName()}>{children}</div>;
  }, [children]);
  useSuiteTopBanner(id, content);
  return null;
}

/** Contenedor visual estándar para avisos (ámbar). */
export function suiteTopBannerSurfaceClassName(extra?: string) {
  return cn(
    'rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg',
    'dark:border-amber-800 dark:bg-amber-950/90 dark:text-amber-100',
    extra,
  );
}
