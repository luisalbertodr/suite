/** Variables disponibles en mensajes WhatsApp automáticos (Meta → Marketing). */
export const WHATSAPP_MESSAGE_TEMPLATE_VARS = [
  { key: 'nombre', description: 'Nombre de pila (o primera palabra del nombre completo)' },
  { key: 'nombre_completo', description: 'Nombre y apellidos' },
  { key: 'apellido', description: 'Apellidos' },
  { key: 'telefono', description: 'Teléfono del lead' },
  { key: 'email', description: 'Correo electrónico' },
  { key: 'oferta', description: 'Nombre de la campaña / oferta publicitaria (Meta)' },
  { key: 'campana', description: 'Alias de {oferta}' },
  { key: 'formulario', description: 'Nombre del formulario Meta configurado' },
  { key: 'cita', description: 'Fecha o texto de cita ficticia del lead' },
  { key: 'fecha_cita', description: 'Solo la fecha de cita (si existe)' },
  { key: 'origen', description: 'Origen del lead (Facebook, Instagram, Meta…)' },
  { key: 'link_pago', description: 'Enlace único para pagar la señal con Stripe' },
  { key: 'importe_senal', description: 'Importe de la señal formateado (p. ej. 50,00 €)' },
] as const;

export function whatsappTemplateVariablesHelpText(): string {
  return WHATSAPP_MESSAGE_TEMPLATE_VARS.map((v) => `{${v.key}} — ${v.description}`).join('\n');
}
