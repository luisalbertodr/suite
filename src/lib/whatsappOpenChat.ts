/** Persistencia del chat abierto en WhatsApp (sessionStorage) para sobrevivir remounts. */

export type WhatsappOpenChatState = {
  companyId: string;
  chatId: string;
  leadId?: string | null;
  leadName?: string | null;
};

const STORAGE_KEY = 'suite.whatsapp.openChat.v1';

export function readWhatsappOpenChat(
  companyId: string | null | undefined,
): WhatsappOpenChatState | null {
  if (!companyId || typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WhatsappOpenChatState;
    if (!parsed?.chatId || parsed.companyId !== companyId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeWhatsappOpenChat(state: WhatsappOpenChatState | null): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (!state?.chatId || !state.companyId) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / private mode */
  }
}
