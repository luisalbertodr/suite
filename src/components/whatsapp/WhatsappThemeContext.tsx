import React, { createContext, useContext } from 'react';
import { waTheme } from './whatsappUtils';

export type WhatsappThemeTokens = typeof waTheme;

type WhatsappUiContextValue = {
  theme: WhatsappThemeTokens;
};

const WhatsappUiContext = createContext<WhatsappUiContextValue>({
  theme: waTheme,
});

export const WhatsappUiProvider: React.FC<{
  theme?: WhatsappThemeTokens;
  children: React.ReactNode;
}> = ({ theme = waTheme, children }) => (
  <WhatsappUiContext.Provider value={{ theme }}>{children}</WhatsappUiContext.Provider>
);

export function useWhatsappTheme(): WhatsappThemeTokens {
  return useContext(WhatsappUiContext).theme;
}
