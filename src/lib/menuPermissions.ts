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
  {
    resource: 'clinical_history',
    action: 'read',
    label: 'Historial clínico',
    description: 'Ver la pestaña Historial clínico en la ficha del cliente (por defecto Medicina)',
  },
  { resource: 'articles', action: 'read', label: 'Artículos', description: 'Ver y gestionar productos' },
  { resource: 'planillas', action: 'read', label: 'Planillas', description: 'Ver y gestionar planillas' },
  { resource: 'quotes', action: 'read', label: 'Presupuestos', description: 'Ver y gestionar presupuestos' },
  { resource: 'presupuestos_n', action: 'read', label: 'PresupuestosN', description: 'Ver y gestionar presupuestos N' },
  { resource: 'invoices', action: 'read', label: 'Facturas', description: 'Ver y gestionar facturas' },
  {
    resource: 'bank_movements',
    action: 'read',
    label: 'Movimientos bancarios',
    description: 'Ver e importar movimientos bancarios en Facturación (por defecto solo admin; por empresa)',
  },
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
  { resource: 'reports', action: 'read', label: 'Ver reportes', description: 'Acceso a la pestaña y sección de reportes' },
  { resource: 'recent_activity', action: 'read', label: 'Ver actividad reciente', description: 'Ver el historial de actividad en Inicio' },
  { resource: 'statistics', action: 'read', label: 'Ver estadísticas', description: 'Ver cuadro de mandos, tarjetas y gráficos de Inicio' },
  { resource: 'companies', action: 'read', label: 'Empresas', description: 'Gestionar información de empresas' },
  { resource: 'settings', action: 'read', label: 'Configuración', description: 'Acceso a configuración del sistema' },
  {
    resource: 'incentives',
    action: 'read',
    label: 'Incentivos (bolsa de horas)',
    description: 'Ver la bolsa de horas libres y solicitar tiempo',
  },
  {
    resource: 'incentives_board',
    action: 'read',
    label: 'Incentivos (tablero en Inicio)',
    description: 'Ver el tablero propio si el usuario está vinculado a una empleada. Los admins ven todas.',
  },
  {
    resource: 'incentives',
    action: 'manage',
    label: 'Incentivos (administrar)',
    description: 'Configurar reglas, imputar ventas y aprobar solicitudes',
  },
];
