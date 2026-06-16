-- Mensajes WhatsApp campañas Lipoout (Body Sculpt + Método Skin).

UPDATE public.meta_forms
SET
  whatsapp_automation_enabled = true,
  whatsapp_reminder_delay_hours = 3,
  whatsapp_initial_message = $body1$Hola {nombre}, qué tal. ¡Muchas gracias por tu interés en nuestro tratamiento Body Sculpt & Lift! 🔥

He visto en el formulario que te interesa especialmente la zona de {respuesta_zona} y que confirmas que puedes venir a nuestro centro aquí en A Coruña. ¡Perfecto!

Queremos que consigas ese abdomen firme y definido que buscas. Para activar tu tarifa promocional de *99€* (que incluye el Análisis Corporal Profesional), solo necesitamos agendar tu sesión.

¿Te vendría mejor venir por la mañana o por la tarde esta semana? 😊$body1$,
  whatsapp_reminder_message = $body2$¡Hola de nuevo, {nombre}! Pasaba rápido por aquí porque como viste en el anuncio, este mes solo tenemos 5 plazas con el descuento de *99€* activo y ya nos quedan las últimas. ⏳

No queremos que te quedes sin tu tratamiento sin cirugía.

Si sigues interesada/o, dime qué día te cuadra y te aseguro tu plaza en un momento. ¿Te viene bien el {propuesta_dia_1} o el {propuesta_dia_2}?$body2$,
  whatsapp_reply_1_message = NULL,
  whatsapp_reply_2_message = NULL,
  whatsapp_reply_invalid_message = NULL,
  updated_at = now()
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND form_name = 'Body Sculpt';

UPDATE public.meta_forms
SET
  whatsapp_automation_enabled = true,
  whatsapp_reminder_delay_hours = 3,
  whatsapp_initial_message = $skin1$Hola {nombre}, ¡un placer saludarte! Te escribo de Lipoout en A Coruña por el formulario que acabas de rellenar. ✨

He visto que te gustaría mejorar el aspecto de tu piel, centrándote sobre todo en {respuesta_zona}. Es una zona fantástica para trabajar con nuestro Método Skin Lipoout y recuperar ese efecto glow natural sin agujas ni dolor.

Ya tienes reservada tu tarifa especial de *119€* (con el Análisis Facial incluido). Para dejar tu cita cerrada, ¿qué día te vendría mejor pasarte por el centro? 📅$skin1$,
  whatsapp_reminder_message = $skin2$¡Hola {nombre}! Te escribo de nuevo porque las plazas de la promoción para el Método Skin Lipoout vuelan (solo activamos 5 este mes) y no me gustaría que perdieras la oportunidad de lucir esa piel firme y rejuvenecida por solo *119€*.

¿Te reservo un hueco para esta semana y te realizamos el análisis facial? Dime si prefieres venir por la mañana o por la tarde y te doy opciones. ¡Un saludo! 👋$skin2$,
  whatsapp_reply_1_message = NULL,
  whatsapp_reply_2_message = NULL,
  whatsapp_reply_invalid_message = NULL,
  updated_at = now()
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND form_name = 'Método Skin Lipoout';
