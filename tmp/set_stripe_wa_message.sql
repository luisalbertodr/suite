UPDATE stripe_config
SET payment_success_whatsapp_message = '¡Gracias {nombre}! Hemos recibido tu señal de 10,00 €. Tu cita en Lipoout queda confirmada. Si necesitas algo, responde a este mensaje.',
    updated_at = now()
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
RETURNING left(payment_success_whatsapp_message, 60) AS msg_preview;
