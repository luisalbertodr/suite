import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

export type TopBarContent = {
  title?: React.ReactNode;
  actions?: React.ReactNode;
};

type TopBarContentContextValue = {
  content: TopBarContent;
  setContent: React.Dispatch<React.SetStateAction<TopBarContent>>;
};

const TopBarContentContext = createContext<TopBarContentContextValue | null>(null);

export const TopBarContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [content, setContent] = useState<TopBarContent>({});

  useEffect(() => {
    setContent({});
  }, [location.pathname]);

  const value = useMemo(() => ({ content, setContent }), [content]);

  return (
    <TopBarContentContext.Provider value={value}>
      {children}
    </TopBarContentContext.Provider>
  );
};

export function useTopBarContent(): TopBarContentContextValue {
  const context = useContext(TopBarContentContext);
  if (!context) {
    throw new Error('useTopBarContent must be used within TopBarContentProvider');
  }
  return context;
}

export function useRegisterTopBarContent(content: TopBarContent, deps: React.DependencyList = []) {
  const { setContent } = useTopBarContent();

  useEffect(() => {
    setContent(content);
    return () => setContent({});
    // `deps` lets each screen decide when dynamic actions must be refreshed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setContent, ...deps]);
}
