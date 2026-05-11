
export interface Employee {
  id: string;
  name: string;
  color: string;
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
  status: 'confirmed' | 'pending' | 'cancelled';
}

export interface TimeSlot {
  time: string;
  hour: number;
  minute: number;
}

export type AppointmentItemKind = 'service' | 'product' | 'bonus' | 'other';
export type BonusPaymentMode = 'none' | 'full' | '60' | '40';

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
}
