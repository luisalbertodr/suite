import React, { createContext, useContext } from 'react';
import type { PrefetchedMedia } from '@/hooks/useWhatsappMediaPrefetch';

type WhatsappChatContextValue = {
  activeChatId: string;
  relatedChatIds: string[];
  scrollRootRef: React.RefObject<HTMLElement | null>;
  prefetchLoading: boolean;
  prefetchReady: boolean;
  getPrefetchMedia: (messageId: string | null | undefined) => PrefetchedMedia | null;
};

const WhatsappChatContext = createContext<WhatsappChatContextValue>({
  activeChatId: '',
  relatedChatIds: [],
  scrollRootRef: { current: null },
  prefetchLoading: false,
  prefetchReady: true,
  getPrefetchMedia: () => null,
});

export function WhatsappChatProvider({
  activeChatId,
  relatedChatIds,
  scrollRootRef,
  prefetchLoading,
  prefetchReady,
  getPrefetchMedia,
  children,
}: WhatsappChatContextValue & { children: React.ReactNode }) {
  return (
    <WhatsappChatContext.Provider
      value={{
        activeChatId,
        relatedChatIds,
        scrollRootRef,
        prefetchLoading,
        prefetchReady,
        getPrefetchMedia,
      }}
    >
      {children}
    </WhatsappChatContext.Provider>
  );
}

export function useWhatsappChatContext(): WhatsappChatContextValue {
  return useContext(WhatsappChatContext);
}
