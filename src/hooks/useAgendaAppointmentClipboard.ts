import { useCallback, useEffect, useState } from 'react';
import {
  clearAgendaAppointmentClipboard,
  loadAgendaAppointmentClipboard,
  saveAgendaAppointmentClipboard,
  type AgendaAppointmentClipboardPayload,
} from '@/lib/agendaAppointmentClipboard';

export function useAgendaAppointmentClipboard() {
  const [clipboard, setClipboard] = useState<AgendaAppointmentClipboardPayload | null>(() =>
    loadAgendaAppointmentClipboard(),
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'suite:agenda:appointment-clipboard') return;
      setClipboard(loadAgendaAppointmentClipboard());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPayload = useCallback((payload: AgendaAppointmentClipboardPayload | null) => {
    if (payload) {
      saveAgendaAppointmentClipboard(payload);
      setClipboard(payload);
    } else {
      clearAgendaAppointmentClipboard();
      setClipboard(null);
    }
  }, []);

  const clear = useCallback(() => setPayload(null), [setPayload]);

  return { clipboard, setPayload, clear };
}
