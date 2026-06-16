-- Metadatos de plantillas + seed INDIBA Deep Beauty 2024 por empresa.

ALTER TABLE public.consentimiento_plantillas
  ADD COLUMN IF NOT EXISTS codigo TEXT,
  ADD COLUMN IF NOT EXISTS keywords TEXT,
  ADD COLUMN IF NOT EXISTS orden INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_consentimiento_plantillas_company_codigo
  ON public.consentimiento_plantillas (company_id, codigo)
  WHERE codigo IS NOT NULL;

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version
)
SELECT
  c.id,
  'indiba_deep_beauty_2024',
  'Radiofrecuencia INDIBA',
  'Consentimiento INDIBA® Deep Beauty (2024)',
  $indiba$DOCUMENTO DE CONSENTIMIENTO INFORMADO

TRATAMIENTO MEDIANTE RADIOFRECUENCIA MONOPOLAR CAPACITIVA / RESISTIVA DE 448 kHz:
INDIBA® DEEP BEAUTY

El personal especializado de {empresa} me ha explicado a {nombre}, con DNI nº {dni}, domicilio en {direccion}, teléfono {telefono}, e-mail {email}, de forma clara y comprensible el tratamiento que me va a aplicar ({tratamiento}), atendido/a por {profesional}.

1. INTRODUCCIÓN

La radiofrecuencia aplicada para fines estéticos es una tecnología habitual y muy utilizada en el entorno de la estética. Se aplica mediante múltiples dispositivos en el mercado que se caracterizan y diferencian entre ellos por la frecuencia y el tipo de electrodo con los que trabajan.

El objetivo de este documento es facilitar un consentimiento informado al paciente en relación a la tecnología conocida como Radiofrecuencia Monopolar Capacitiva / Resistiva de 448 kHz y denominación comercial INDIBA® Deep Beauty, cuyas indicaciones son: reducción de arrugas y líneas de expresión, mejora del aspecto de bolsas y ojeras, efecto lifting antiedad, redefinición del óvalo facial, modelación de la silueta, mejora de la celulitis, estrías, flacidez, reafirmación de senos y bienestar integral.

La tecnología en la que se basa INDIBA® DEEP BEAUTY fue introducida, desarrollada, investigada y patentada por la compañía INDIBA, S.A. hace treinta años y se comercializa en la actualidad en múltiples países de Europa, Asia y América.

2. FUNDAMENTO DE LA TÉCNICA, EFECTOS BIOLÓGICOS

Este método consiste en aplicar al paciente una corriente que circula por el tejido a tratar a través de dos electrodos colocados en la superficie corporal del mismo y en posiciones habitualmente contrapuestas (espalda / cara, espalda / abdomen, espalda / pecho y abdomen / glúteos fundamentalmente). Con este efecto se consigue un incremento local de la temperatura (hipertermia) que explica parte de los efectos conseguidos.

La técnica permite mejorar el estado y la apariencia de los tejidos tratados. En particular:
1. Mejora el aspecto de la piel
2. Combate la flacidez, reafirma los tejidos y ayuda a remodelar la cara y el cuerpo
3. Reduce la celulitis
4. Favorece la eliminación de productos del metabolismo celular

3. CONTRAINDICACIONES, ADVERTENCIAS Y EFECTOS SECUNDARIOS

3.1 Contraindicaciones

El tratamiento está contraindicado en las siguientes situaciones:
• Utilización de marcapasos u otro tipo de implantes electrónicos
• Embarazo
• Piel no intacta (heridas abiertas o quemaduras recientes)
• Tromboflebitis
• Es un tratamiento de uso externo y no debe utilizarse por vía endocavitaria (bucal, vaginal o rectal)
• Personas que sufren de falta de sensibilidad (insensibilidad congénita al dolor, lesiones nerviosas, paraplejia o expuestos a tratamientos farmacológicos que reduzcan la sensibilidad al dolor y al calor)
• Alergia conocida al níquel, al cromo o alguno de los componentes de la crema de aplicación

3.2 Precauciones

• La persona a tratar no debe entrar en contacto con partes conductoras o tomas de tierra que pudieran generar vías indeseadas para la circulación de corrientes de radiofrecuencia
• Las personas hipotensas sometidas a tratamiento pueden sufrir una caída en la tensión arterial. Si esto sucediera, debe detenerse el tratamiento hasta restablecer los niveles normales
• En tratamientos faciales, y en modo resistivo, deberán retirarse dentaduras removibles antes del tratamiento
• El paciente deberá quitarse anillos, pendientes, piercings y otros objetos metálicos
• Si el paciente está bajo terapia con anticoagulantes orales, debe consultar a su médico antes de iniciar un tratamiento con INDIBA®
• INDIBA® está indicado solamente para el tratamiento en adultos
• En pacientes de edad avanzada con alteraciones cutáneas, deberá realizarse el tratamiento con precaución
• Se debe informar antes del tratamiento si se ha padecido previamente episodios de alergias cutáneas a productos cosméticos

3.3 Efectos secundarios

Tras aplicar el tratamiento es normal que el paciente perciba una sensación de incremento de la temperatura en la zona tratada. Asimismo, suele producirse un eritema cuya intensidad dependerá de múltiples factores. Dicho enrojecimiento es inocuo y remite, en general, al cabo de unas horas.

3.4 Otros riesgos

La aplicación de la radiofrecuencia que no siga las instrucciones del fabricante puede incrementar el riesgo de quemaduras locales en la zona de contacto de los electrodos. En tratamientos faciales y de bolsas de ojos, pueden producirse molestias leves por acceso accidental de crema conductora a la mucosa ocular; son transitorias.

4. DECLARACIÓN DE LA PERSONA A TRATAR

He comprendido las explicaciones que se me han facilitado en un lenguaje claro y sencillo.

El profesional que me ha atendido me ha permitido realizar todas las observaciones y me ha aclarado todas las dudas que le he planteado.

Comprendo que en cualquier momento y sin necesidad de dar ninguna explicación, puedo revocar el consentimiento que ahora presto.

Por ello, manifiesto que estoy satisfecho/a con la información recibida y que comprendo el alcance y los riesgos del tratamiento.

Eximo al personal aplicador, a la clínica o centro de aplicación, a sus empleados y al fabricante del producto de responsabilidades sobre consecuencias derivadas de la no veracidad en esta declaración, o de no haber informado sobre razones que contraindiquen o impidan el tratamiento.

CONSIENTO

Que se me realice el tratamiento de INDIBA® Deep Beauty para:
• Reducción de arrugas y líneas de expresión
• Mejora del aspecto de bolsas y ojeras
• Efecto lifting antiedad
• Redefinición del óvalo facial
• Modelación de la silueta
• Anticelulitis, antiestrías, antiflacidez
• Acción tensora del pecho
• Bienestar general

En {fecha}

Firma y sello del profesional que aplica el tratamiento          Firma del/de la beneficiario/a del tratamiento

PROTECCIÓN DE DATOS (LOPDGDD)

En cumplimiento de lo establecido en la Ley Orgánica 03/2018, de 13 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD), le informamos que los datos personales que facilite quedarán incorporados y serán tratados en los ficheros de {empresa}, con el fin de informarle sobre nuevos servicios, productos y/o promociones.

Asimismo el cliente presta su consentimiento a {empresa} para que, por cualquier medio de comunicación, incluido el correo electrónico o equivalente, le envíe comunicaciones comerciales o promocionales relativas a sus productos y servicios. El cliente podrá ejercer en cualquier momento su derecho de acceso, rectificación, cancelación y oposición de sus datos, y revocar la autorización concedida, notificándolo mediante correo electrónico a info@lipoout.com o por correo postal a LIPOOUT — Rda. de Outeiro, 219 - Bajo 15007 — A Coruña.

REVOCACIÓN

El/la beneficiario/a del tratamiento puede revocar el consentimiento prestado en cualquier momento, mediante solicitud escrita y firmada.$indiba$,
  'indiba,radiofrecuencia,capacitiva,resistiva,448,deep beauty',
  10,
  true,
  1
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'indiba_deep_beauty_2024'
);
