export type ConsentimientoPlantilla = {
  id: string;
  company_id: string;
  tipo: string;
  titulo: string;
  contenido: string;
  activo: boolean;
  version: number;
  codigo?: string | null;
  keywords?: string | null;
  orden?: number | null;
  document_kind?: string | null;
  tracking_family?: string | null;
  requires_measurements?: boolean | null;
  linked_tracking_codigo?: string | null;
  category?: string | null;
  measurement_assets?: { male?: string; female?: string } | null;
  source_filename?: string | null;
  created_at: string;
  updated_at: string;
};

export type ConsentimientoSnapshot = {
  customer_name?: string | null;
  customer_tax_id?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  company_name?: string | null;
  tratamiento?: string | null;
  profesional?: string | null;
  appointment_id?: string | null;
  appointment_date?: string | null;
  signed_at?: string | null;
  user_agent?: string | null;
};

export type Consentimiento = {
  id: string;
  customer_id: string;
  company_id: string;
  tipo: string;
  titulo: string;
  contenido: string | null;
  firmado: boolean | null;
  firma_url: string | null;
  fecha_firma: string | null;
  plantilla_id: string | null;
  plantilla_version: number | null;
  documento_pdf_url: string | null;
  datos_snapshot: ConsentimientoSnapshot | null;
  firmado_por_empleado_id: string | null;
  appointment_id: string | null;
  created_at: string;
};

export type ConsentimientoCustomer = {
  id: string;
  name: string;
  tax_id?: string | null;
  email?: string | null;
  phone?: string | null;
  phone_mobile?: string | null;
  address_street?: string | null;
  address_city?: string | null;
  address_postal_code?: string | null;
};

export type ConsentimientoSignContext = {
  customerId: string;
  companyId: string;
  customer?: ConsentimientoCustomer | null;
  appointmentId?: string | null;
  tratamiento?: string | null;
  profesional?: string | null;
  profesionalEmpleadoId?: string | null;
  consentId?: string | null;
  /** Si viene de agenda/documentación, abre directamente esta plantilla. */
  initialPlantillaId?: string | null;
};
