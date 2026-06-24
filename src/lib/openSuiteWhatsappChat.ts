import type { NavigateFunction } from 'react-router-dom';

export function normalizeWhatsappPhoneParam(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

/** Abre la pestaña WhatsApp de Suite con el teléfono indicado (conversación nueva o existente). */
export function openSuiteWhatsappChat(
  navigate: NavigateFunction,
  phone: string,
  name?: string | null,
): void {
  const digits = normalizeWhatsappPhoneParam(phone);
  if (!digits) return;
  const params = new URLSearchParams();
  params.set('phone', digits);
  if (name?.trim()) params.set('name', name.trim());
  navigate(`/whatsapp?${params.toString()}`);
}
