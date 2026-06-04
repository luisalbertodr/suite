export interface MenuPermission {
  resource: string;
  action: string;
  label: string;
  description?: string;
}

/** Permisos de lectura que controlan la visibilidad de pestañas/secciones del menú. */
export const MENU_PERMISSIONS: MenuPermission[] = [
  { resource: 'dashboard', action: 'read', label: 'Dashboard', description: 'Ver el panel principal' },
  { resource: 'customers', action: 'read', label: 'Clientes', description: 'Ver y gestionar clientes' },
  { resource: 'articles', action: 'read', label: 'Artículos', description: 'Ver y gestionar productos' },
  { resource: 'planillas', action: 'read', label: 'Planillas', description: 'Ver y gestionar planillas' },
  { resource: 'quotes', action: 'read', label: 'Presupuestos', description: 'Ver y gestionar presupuestos' },
  { resource: 'presupuestos_n', action: 'read', label: 'PresupuestosN', description: 'Ver y gestionar presupuestos N' },
  { resource: 'invoices', action: 'read', label: 'Facturas', description: 'Ver y gestionar facturas' },
  { resource: 'delivery_notes', action: 'read', label: 'Alb. Entrada', description: 'Ver y gestionar albaranes de entrada' },
  { resource: 'delivery_notes_out', action: 'read', label: 'Alb. Salida', description: 'Ver y gestionar albaranes de salida' },
  { resource: 'suppliers', action: 'read', label: 'Proveedores', description: 'Ver y gestionar proveedores' },
  { resource: 'sales', action: 'read', label: 'TPV', description: 'Acceso al terminal de punto de venta' },
  { resource: 'agenda', action: 'read', label: 'Agenda', description: 'Ver y gestionar citas' },
  { resource: 'marketing', action: 'read', label: 'Marketing', description: 'Ver y gestionar leads de marketing' },
  { resource: 'whatsapp', action: 'read', label: 'WhatsApp', description: 'Ver chats y leer mensajes de WhatsApp' },
  { resource: 'phone', action: 'read', label: 'Llamadas (todas)', description: 'Ver todas las llamadas de la centralita' },
  { resource: 'phone', action: 'read_missed', label: 'Llamadas (solo perdidas)', description: 'Ver solo llamadas perdidas y buzón de voz' },
  { resource: 'attendance', action: 'read', label: 'Fichaje', description: 'Registrar y ver fichajes' },
  { resource: 'documents', action: 'read', label: 'Gestión Documental', description: 'Gestionar documentos' },
  { resource: 'reports', action: 'read', label: 'Reportes', description: 'Ver reportes y estadísticas' },
  { resource: 'companies', action: 'read', label: 'Empresas', description: 'Gestionar información de empresas' },
  { resource: 'settings', action: 'read', label: 'Configuración', description: 'Acceso a configuración del sistema' },
];
