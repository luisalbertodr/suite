
export interface Employee {
  id: string;
  name: string;
  color: string;
}

export interface TimeSlot {
  time: string;
  hour: number;
  minute: number;
}

export type AppointmentItemKind = 'service' | 'product' | 'bonus' | 'other';
export type BonusPaymentMode = 'none' | 'full' | '60' | '40';

/** Tramo horario ocupado por un ítem dentro de la cita (solo ítems con occupies_time). */
export interface AppointmentTimeSegment {
  clientKey: string;
  label: string;
  kind: AppointmentItemKind;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  recursoId?: string | null;
  recursoName?: string | null;
  recursoColor?: string | null;
  cabinaId?: string | null;
  cabinaName?: string | null;
}

export interface Appointment {
  id: string;
  employeeId: string;
  clientName: string;
  /** Ficha de cliente en BD, si existe */
  customerId?: string | null;
  description: string;
  serviceCode?: string;
  serviceName?: string;
  legacyEmployeeCode?: string;
  legacyClientCode?: string;
  legacyPlanincId?: number | null;
  legacyHourInText?: string;
  startTime: string; // formato HH:mm
  endTime: string;   // formato HH:mm
  date: string;      // formato YYYY-MM-DD
  color: string;
  /** Importe total calculado de los ítems de la cita. */
  totalAmount?: number;
  /** Tramos que reservan tiempo (para visualización en agenda). */
  timeSegments?: AppointmentTimeSegment[];
  /** Fin calculado según ítems que ocupan tiempo. */
  occupiedEndTime?: string;
  /** Etiquetas de ítems solo cobro (sin reserva de tiempo). */
  paymentOnlyLabels?: string[];
  status: 'confirmed' | 'pending' | 'cancelled';
  /** Cobro TPV / factura asociada a la cita. */
  paymentStatus?: 'paid' | 'invoiced' | 'pending_charge' | 'none';
}

/** Borrador de ítem de cita (UI); `clientKey` es estable en el cliente para listas y drag. */
export interface AppointmentItemDraft {
  clientKey: string;
  kind: AppointmentItemKind;
  label: string;
  duration_minutes: number;
  occupies_time: boolean;
  quantity?: number;
  unit_price?: number;
  bonus_payment_mode?: BonusPaymentMode;
  article_id?: string | null;
  customer_voucher_id?: string | null;
  /** Bono prepagado (`public.bonos`) del que se consume una sesión en la cita. */
  bono_id?: string | null;
  /** Índice en `bonos.coverage_items` cuando la sesión cubre una línea concreta. */
  bono_coverage_index?: number | null;
  cabina_id?: string | null;
  recurso_id?: string | null;
}
