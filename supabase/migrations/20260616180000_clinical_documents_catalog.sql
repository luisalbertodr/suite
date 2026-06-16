-- Catálogo documental clínico: consentimientos, cuestionarios, seguimientos y medicina.

ALTER TABLE public.consentimiento_plantillas
  ADD COLUMN IF NOT EXISTS document_kind TEXT NOT NULL DEFAULT 'consent',
  ADD COLUMN IF NOT EXISTS tracking_family TEXT,
  ADD COLUMN IF NOT EXISTS requires_measurements BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked_tracking_codigo TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'estetica',
  ADD COLUMN IF NOT EXISTS measurement_assets JSONB,
  ADD COLUMN IF NOT EXISTS source_filename TEXT,
  ADD COLUMN IF NOT EXISTS source_modified_at TIMESTAMPTZ;

ALTER TABLE public.historial_clinico
  ADD COLUMN IF NOT EXISTS tracking_family TEXT,
  ADD COLUMN IF NOT EXISTS plantilla_codigo TEXT,
  ADD COLUMN IF NOT EXISTS consentimiento_id UUID REFERENCES public.consentimientos(id) ON DELETE SET NULL;

ALTER TABLE public.historial_clinico_revisiones
  ADD COLUMN IF NOT EXISTS session_data JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_historial_clinico_tracking
  ON public.historial_clinico (customer_id, tracking_family, fecha DESC);

-- Plantillas canónicas de seguimiento (medidas adjuntas en frontend /clinical/*)

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'consentimiento_imagenes_redes_docx',
  'Administrativo / LOPD',
  'consentimiento imagenes redes',
  $consentimiento_imagenes_redes_docx$AUTORIZACIÓN PARA LA PUBLICACIÓN DE IMÁGENES DE CLIENTES POR LIPOOUT
Con la inclusión de las nuevas tecnologías dentro de las comunicaciones, publicaciones y acciones comerciales que puede realizar LIPOOUT y la posibilidad de que en estas puedan aparecer imágenes que ha proporcionado a nuestra empresa dentro del vínculo comercial existente. 
Y dado que el derecho a la propia imagen está reconocido al artículo 18 de la Constitución y regulado por la Ley 1/1982, de 5 de mayo, sobre el derecho al honor, a la intimidad personal y familiar y a la propia imagen y el Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo, de 27 de abril de 2016, relativo a la protección de las personas físicas en lo que respecta al tratamiento de datos personales y a la libre circulación de estos datos, 
Don/Doña _____________________________________________ con DNI _____________________ autorizo a Lipoout a un uso comercial de mis imágenes facilitadas dentro de la relación comercial con nuestra empresa y para poder ser publicadas en: 
· La página web y perfiles en redes sociales de la empresa. 
       . Fotografías o publicaciones de ámbito relacionado con nuestro sector. 
En ________________________________, a _____ de ____________ de 20__ 
FIRMADO: (Nombre y apellidos del cliente)$consentimiento_imagenes_redes_docx$,
  'consentimiento,imagenes,redes,docx',
  19,
  true,
  1,
  'admin',
  NULL,
  false,
  NULL,
  'estetica',
  NULL,
  'consentimiento imagenes redes.docx',
  '2020-01-25T13:02:46'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'consentimiento_imagenes_redes_docx'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'consentimiento_imagenes_clientes_docx',
  'Administrativo / LOPD',
  'consentimiento-imagenes-clientes',
  $consentimiento_imagenes_clientes_docx$AUTORIZACIÓN PARA LA PUBLICACIÓN DE IMÁGENES DE CLIENTES POR XXEMPRESAXX 
Con la inclusión de las nuevas tecnologías dentro de las comunicaciones, publicaciones y acciones comerciales que puede realizar XXEMPRESAXX y la posibilidad de que en estas puedan aparecer los datos personales y/o imágenes que ha proporcionado a nuestra empresa dentro del vínculo comercial existente. 
Y dado que el derecho a la propia imagen está reconocido al artículo 18 de la Constitución y regulado por la Ley 1/1982, de 5 de mayo, sobre el derecho al honor, a la intimidad personal y familiar y a la propia imagen y el Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo, de 27 de abril de 2016, relativo a la protección de las personas físicas en lo que respecta al tratamiento de datos personales y a la libre circulación de estos datos, 
XXEMPRESAXX pide su consentimiento para poder publicar los datos personales que nos ha facilitado o imágenes en las cuales aparezcan individualmente o en grupo que con carácter comercial se puedan realizar con nuestra empresa. 
Don/Doña _____________________________________________ con DNI _____________________ autorizo a XXEMPRESAXX a un uso comercial de mis datos personales facilitados dentro de la relación comercial con nuestra empresa y para poder ser publicados en: 
· La página web y perfiles en redes sociales de la empresa. 
· Filmaciones destinadas a difusión comercial. 
· Fotografías para revistas o publicaciones de ámbito relacionado con nuestro sector. 
En ________________________________, a _____ de ____________ de 20__ 
FIRMADO: (Nombre y apellidos del cliente)$consentimiento_imagenes_clientes_docx$,
  'consentimiento,imagenes,clientes,docx',
  18,
  true,
  1,
  'admin',
  NULL,
  false,
  NULL,
  'estetica',
  NULL,
  'consentimiento-imagenes-clientes.docx',
  '2020-01-25T12:52:20'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'consentimiento_imagenes_clientes_docx'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'ley_de_proteccion_de_datos_doc',
  'Administrativo / LOPD',
  'Ley de protección de datos',
  $ley_de_proteccion_de_datos_doc$En cumplimiento de lo establecido en la Ley Org
nica 03/2018, de 13 de diciembre, de Protecci
a de derechos digitales (LOPDGDD) le informamos que los datos personales que facilite quedar
n tratados en los ficheros de LIPOOUT, con el fin de informarle sobre nuevos servicios, productos y/o promociones.
Asimismo el cliente presta su consentimiento a LIPOOUT para que, por cualquier medio de comunicaci
n, incluido el correo electr
nico o equivalente, le env
e comunicaciones comerciales o promocionales relativas a sus productos y servicios.
 ejercer en cualquier momento su derecho de acceso, rectificaci
n de sus datos, y revocar la autorizaci
n concedida para que LIPOOUT env
nica ofertas o comunicaciones publicitarias y promocionales, notific
ndolo mediante correo electr
nico a info@lipoout.com o por correo postal a LIPOOUT- Rda. de Outeiro, 219 - Bajo 15007 - A Coru
a, mediante solicitud escrita y firmada que contenga los siguientes datos: nombre, apellidos, domicilio a efectos de notificaciones, fotocopia del DNI o pasaporte, y petici
n en que se concreta la solicitud. A efectos informativos, se designa como responsable del fichero a Mar
a del Mar Lamas Pernas, con domicilio en la direcci
DocumentSummaryInformation$ley_de_proteccion_de_datos_doc$,
  'ley,protección,datos,doc',
  23,
  true,
  1,
  'admin',
  NULL,
  false,
  NULL,
  'estetica',
  NULL,
  'Ley de protección de datos.doc',
  '2021-07-27T15:56:28'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'ley_de_proteccion_de_datos_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  '01_consentimiento_informado_cosmelan_1_doc',
  'Tratamiento estético',
  '01 Consentimiento informado COSMELAN',
  $d_01_consentimiento_informado_cosmelan_1_doc$"lg mesoestetic gris RGB
\\SRVDATOS\Comun\Carpeta Consulta Comercial\Info productos\LOGOS\logos mesoestetic\baja\mesoestetic\lg mesoestetic gris RGB.jpg
%DOCUMENTO DE CONSENTIMIENTO INFORMADO
DocumentSummaryInformation$d_01_consentimiento_informado_cosmelan_1_doc$,
  'consentimiento,informado,cosmelan,doc',
  25,
  true,
  1,
  'consent',
  NULL,
  false,
  'tracking_aesthetic',
  'estetica',
  NULL,
  '01 Consentimiento informado COSMELAN (1).doc',
  '2021-09-16T12:49:26'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = '01_consentimiento_informado_cosmelan_1_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'cconsentimiento_skydermic_odt',
  'Medicina estética',
  'Cconsentimiento SKYDERMIC',
  $cconsentimiento_skydermic_odt$Cconsentimiento SKYDERMIC

[Documento importado desde Cconsentimiento SKYDERMIC.odt. Revise el contenido en Configuración → Consentimientos si la extracción automática fue incompleta.]$cconsentimiento_skydermic_odt$,
  'cconsentimiento,skydermic,odt,medicina,medico',
  40,
  true,
  1,
  'consent',
  NULL,
  false,
  'tracking_aesthetic',
  'medicina',
  NULL,
  'Cconsentimiento SKYDERMIC.odt',
  '2025-10-23T12:36:58'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'cconsentimiento_skydermic_odt'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'ci_implantes_hidroxiapatita_calcica_pdf',
  'Tratamiento estético',
  'CI-Implantes-Hidroxiapatita-Calcica',
  $ci_implantes_hidroxiapatita_calcica_pdf$DOCUMENTO INFORMATIVO 
Y CONFORMIDAD 
 
CONSENTIMIENTO INFORMADO PARA IMPLANTES CON HIDROXIAPATITA CÁLCICA 
En cumplimiento de la Ley 41/2002, básica reguladora de la autonomía del paciente y de 
derechos y obligaciones en materia de información y documentación clínica (BOE 15-11-02), le 
ofrecemos por escrito y de manera comprensible, información  sobre IMPLANTES CON 
HIDROXIAPATITA CÁLCICA . No obstante, dicha información le ha sido ya sucintamente 
facilitada de forma oral por el médico que suscribe, que asimismo y a requerimiento de Vd. ha 
ido contestando a todas las preguntas objeto de su interés y relacionadas con el tratamiento. 
El presente documento no es sino la trascripción gráfica de dicha información, a fin de facilitar 
su comprensión y motivar una autorización reflexiva y pausada. 
Es importante que lea esta información de forma clara y completa. Por favor firme o ponga sus 
iniciales en cada página para indicar así que la ha leído y firme el documento  de 
consentimiento para el procedimiento propuesto por su médico. 
En _______________________, a ____ de __________ ______________________ de _______  
Nombre del paciente _ __________________________________________________________ 
Fecha de nacimiento _ ___________________________ DNI____________________________ 
Domicilio _ ____________________________________________________________________ 
Población _____________________________________________________________________ 
Teléfonos _____________________________________________________________________ 
 
DECLARO: 
Que por el presente documento REQUIERO Y AUTORIZO al Doctor/a ____________________ _ 
____________________________, licenciado/graduado en Medicina y ___________________ 
con el número de colegiado ____________________ que realice en mi persona, el tratamiento 
conocido como IMPLANTES CON HIDROXIAPATITA CÁLCICA marca ______________________ 
por ser éste el escogido por mí frente a las alternativas ________________________________ 
He sido correctamente informado, y los acepto, los riesgos comúnmente conocidos de la pre -
medicación, la anestesia y/o el tratamiento que me han de realizar. 
CONSIENTO, en caso de ser necesario, en la administración de anestesia local dada por o bajo 
la dirección del Dr/a __________________________________________________________ 
CONOZCO y ACEPTO la capacitación profesional del facultativo para realizar este tratamiento. 
Las sustancias y aparatos empleados han sido autorizados para su uso en medicina estética y 
ostenta la marca CE y número de registro sanitario correspondiente. 
CONFIRMO que el tratamiento mencionado, me ha sido explicado a fondo, por el facultativo 
en palabras comprensibles para mí, los riesgos típicos que tiene, los efectos no deseados, los 
riesgos característicos a mi persona, así como las molestias o, en ocasiones, dolores que puedo 
sentir teniendo un post -tratamiento normal. Se me han explicado, igualmente otras opciones 
existentes que están disponibles en el mercado, con pros y contras de cada una de ellas. 
Teniendo esto en cuenta he escogido el tratamiento anteriormente descrito. 
También se me ha informado, en términos de probabilidades, de los resultados del 
procedimiento según referencias de la literatura científica contrastada y de la experiencia 
previa del profesional en la realización de estos procedimientos. 
BREVE EXPLICACION DEL TRATAMIENTO: 
La hidroxiapatita cálcica es un implante apirógeno semisólido,  claro, estéril y  cohesionado 
compuesto por micropartículas  ( 25-45 micras) de hidroxiapatita cálcica   biocompatibles 
biodegradables suspendidas en un gel portador de agua estéril para inyección, glicerina  y 
carboximetilcelulosa de sodio. Indicado para la corrección de defectos de los tejidos blandos, 
congénitos, adquiridos o post traumáticos Después del primer tratamiento pueden ser 
necesarias una o más inyecciones adicionales de hidroxiapatita cálcica   para conseguir el nivel 
deseado de corrección. Para mantener la corrección puede ser necesario repetir las 
inyecciones al cabo del tiempo (después de 6 a 18 meses). La necesidad de volver a inyectar 
varía según el lugar y depende de diversos factores. 
ACEPTO que puedan ocurrir los RIESGOS Y COMPLICACIONES descritos por la ciencia médica 
como inherentes a este tratamiento. Los principales riesgos que me han sido explicados son:  
• Riesgo y complicaciones comunes a cualquier tratamiento estético, entre otros , 
reacciones alérgicas a la sustancia empleada o a la anestesia (por lo general leves, que 
remiten bajo el tratamiento adecuado o incluso sin tratamiento), hematomas, edemas, 
infección, o inflamación que remitirán generalmente en poco tiempo sin necesidad de 
ser tratados. 
• Riesgos y complicaciones específicos de este tratamiento que me han sido explicados y 
que asumo y acepto. Especialmente: resultado insuficiente, o excesivo, reacción 
inmunológica al producto, granulomas, nódulos, alteraciones de la pigmentac ión, 
infecciones diferidas, etc. 
• La hidroxiapatita cálcica  es radiopaca, por lo que puede ser visible en radiografías 
simples y tomografías.      
CONTRAINDICACIONES: Enfermedades graves o descompensadas, infección activa en la zona, 
diabetes descompensada, antecedentes de c icatrización anómala, gestación, lactancia, herpes 
local recidivante, coagulopatías, enfermedades de colágeno descompensadas o graves  
TRAS EL TRATAMIENTO se me ha recomendado evitar la movilización brusca de la zona 
(gestos, alimentos muy duros), los masajes sobre la zona, el consumo de alcohol y la aplicación 
de maquillaje, la exposición directa al sol o al UVA, las saunas y baños de vapor, la práctica d e 
ejercicio muy intenso, y apoyarme sobre la zona tratada. 
He sido correctamente informado, incluso por escrito (documentos de información) y/o 
mediante imágenes, de las características de este tratamiento: de sus fundamentos, de la 
forma y detalles de su realización, de sus mecanismos de acción, de sus efectos inmediatos, 
del proceso y evolución que seguiré en los siguientes días, semanas o meses, de los 
tratamientos complementarios necesarios, de las atenciones y precauciones que debo adoptar 
en l las próxima s horas o días, de la variabilidad en el tiempo necesario para el completo 
restablecimiento; aceptando, por lo tanto, que no se me puede asegurar la fecha en que podré 
reincorporarme a mis actividades habituales (afectivas, sociales, laborales y deportivas). 
DOY FE de no haber omitido o alterado datos al exponer mi historial y antecedentes clínico 
quirúrgicos, especialmente los referidos a alergias y enfermedades o riesgos personales. 
La Historia Clínica y el resultado de las pruebas que se han efectuado al paciente no 
desaconsejan practicar el procedimiento médico indicado, al no aparecer, a priori, riesgos que 
puedan ser determinantes del fracaso de la técnica objetivamente considerada y que pretende 
el cumplimiento de sus expectativas. 
RECONOZCO que en el curso del tratamiento pueden  surgir condiciones no previstas que 
hagan necesario un cambio de lo anteriormente planeado y doy aquí mi expresa autorización 
para el tratamiento de las mismas, incluyendo, traslado a centro hospitalario. En caso de 
complicaciones durante el tratamiento  autorizo al Centro a solicitar la necesaria ayuda de 
otros especialistas, según su mejor juicio profesional. 
SE ME HA INFORMADO que la cantidad de producto que es necesario para conseguir el efecto 
deseado se me ha comunicado de forma orientativa, siendo imposible de antemano conocer la 
cantidad exacta de producto que es necesario, por la diferente forma de absorción/reacción 
de cada paciente. Los resultados se obtienen con mayor efectividad si el tratamiento realizado 
se complementa con otros tratamientos que potenciarán sus efectos. 
He sido informado de la necesidad de que, si durante el tratamiento se produjese una punción 
accidental del personal sanitario con mi sangre, de acuerdo con la buena praxis médica, se 
realicen las determinaciones analíticas procedentes en mi sangre, en lo relativo a posibles 
patologías de transmisión hemática, para la adopción de las medidas profilácticas más 
adecuadas. 
ME COMPROMETO a seguir fielmente, en lo mejor de mis posibilidades, las instrucciones del 
médico para antes, durante y después del tratamiento antes mencionado. Quedando bajo mi 
responsabilidad el cumplimiento de las medidas pos-tratamiento recomendadas por el Centro, 
así como acudir a las visitas de control indicadas por el médico.  
COMPRENDO que el fin del tratamiento es mejorar mi apariencia existiendo la posibilidad de 
que alguna imperfección persista y que el resultado pueda no ser el esperado por mí. En este 
sentido, se me informa que el resultado estético del tratamiento depende de factores como la 
facilidad de cicatrización, formación o no de queloides . Sé que la medicina no es una ciencia 
exacta y que nadie puede garantizar la perfección absoluta. Comprendo que el resultado 
pueda no ser el esperado por mí y reconozco que no se me ha dado, en absoluto, tal garantía. 
El acto médico podría no agotarse en sí mismo y podría ser necesaria una actuación 
terapéutica posterior para lograr el objetivo por el que se está consintiendo. 
El coste del tratamiento incluye diversos cargos por los servicios prestados. El total incluye los 
honorarios de su médico, el cos to de los materiales, equipo o producto. Los cargos cobrados 
por este procedimiento no incluyen los costos futuros potenciales para los procedimientos 
adicionales que usted elija o requiera a fin de revisar, optimizar o completar su resultado. 
Puede haber costos adicionales en caso de que surjan co mplicaciones debido al tratamiento . 
Los cargos por tratamientos secundarios relacionados con las revisiones y que no hayan sido 
previamente pactados también serán su responsabilidad. Al firmar el consentimiento para este 
procedimiento, usted reconoce que ha sido informado acerca de sus riesgos y consecuencias y 
acepta la responsabilidad de las decisiones clínicas que se tomaron junto con los costos 
económicos de todos los tratamientos futuros. 
AUTORIZO la obtención de fotografías y vídeos para una correcta valoración diagnóstica y para 
el control de la evaluación y de los resultados. Asimismo, autorizo a que se me practiquen 
fotografías de la zona intervenida que puedan ser utilizadas con fines científicos, docentes o 
médicos, quedando entendido que su uso no constituya ninguna violación a la intimidad o 
confidencialidad, a las que tengo derecho. 
Los datos de carácter personal serán tratados por LA CLÍNICA para el estudio y posterior 
prestación de los servicios solicitados; y en consecuencia, para la gestión administrativa y 
económica del paciente. Finalidad basada en el consentimiento expreso prestado por usted al 
inicio de su relación con LA CLÍNICA. Los datos personales no se cederán a terceros salvo en los 
casos que exista una obligación legal o/y contractual y se conservarán durante el tiempo 
necesario para determinar las posibles responsabilidades legales que se pudieran derivar; y en 
todo caso, su historial clínico, como mínimo durante un plazo de cinco años contados desde la 
fecha del alta del último proceso asistencial. Puede ejercitar sus derechos de acceso, 
rectificación, supresión y portabilidad de sus datos, de limitación y oposición a su tratamiento, 
así como a no ser objeto de decisiones basadas únicamente en el tratamiento automatizado de 
sus datos ante LA CLÍNICA en cualquier momento. 
Sé que la firma y otorgamiento de este consentimiento no supone ningún tipo de renuncia a 
reclamaciones futuras tanto de orden médico como legal. Sé también que puedo desdecirme 
de la firma de este consentimiento en cualquier momento previo a la realización del 
tratamiento. 
He podido aclarar todas mis dudas acerca de todo lo anteriormente expuesto y he entendido 
totalmente este DOCUMENTO DE CONSENTIMIENTO reafirmándome en todas y cada uno de 
sus puntos y con la firma del documento ratifico y consiento que el tratamiento se realice. 
Fecha y lugar 
El médico Firma del paciente Representante legal 
 
 
 
Igualmente he sido informado, y me doy plenamente por enterado, de que el presente 
consentimiento podrá ser revocado por el abajo firmante en cualquier momento, así como 
que, en su caso, dicha revocación deberá hacerse por escrito, habiendo, además, recibido 
amplia información de las consecuencias de mi decisión. 
El médico Firma del paciente Representante legal$ci_implantes_hidroxiapatita_calcica_pdf$,
  'implantes,hidroxiapatita,calcica,pdf',
  47,
  true,
  1,
  'consent',
  NULL,
  false,
  'tracking_aesthetic',
  'estetica',
  NULL,
  'CI-Implantes-Hidroxiapatita-Calcica.pdf',
  '2026-04-29T19:13:56'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'ci_implantes_hidroxiapatita_calcica_pdf'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'ci_laser_fraccionado_pdf',
  'Medicina estética',
  'CI-Laser-Fraccionado',
  $ci_laser_fraccionado_pdf$DOCUMENTO INFORMATIVO 
Y CONFORMIDAD 
 
DOCUMENTO DE CONSENTIMIENTO INFORMADO 
PARA TRATAMIENTO DE LÁSER FRACCIONADO 
 
En cumplimiento de la Ley 41/2002, básica reguladora de la autonomía del paciente y de 
derechos y obligaciones en materia de información y documentación clínica (BOE 15 -11-02), le 
ofrecemos por escrito y de manera comprensible, información sobre LÁSER FRACCIONADO. 
No obstante, dicha información le ha sido ya sucintamente facilitada de forma oral por el 
médico que suscribe, que asimismo y a requerimiento de Vd. ha ido contestando a todas las 
preguntas objeto de su interés y relacionadas con el tratamiento. El presente documento no es 
sino la trascripción gráfica de dicha información, a fin de facilitar su comprensión y motivar 
una autorización reflexiva y pausada. 
Es importante que lea esta información de forma clara y completa. Por favor firme o ponga sus 
iniciales en cada página para indicar así que la ha leído y firme el documento  de 
consentimiento para el procedimiento propuesto por su médico. 
En _______________________, a ____ de ________________________________ de _______  
Nombre del paciente ___________________________________________________________  
Fecha de nacimiento ____________________________ DNI____________________________  
Domicilio _____________________________________________________________________  
Población _____________________________________________________________________ 
Teléfonos _____________________________________________________________________ 
 
DECLARO: 
Que por el presente documento REQUIERO Y AUTORIZO al Doctor/a ____________________ _ 
____________________________, licenciado/graduado en Medicina y ___________________ 
con el número de colegiado ____________________ que realice en mi persona, el tratamiento 
conocido como LÁSER FRACCIONADO, por ser éste el escogido por m í frente a las alternativas 
___________________________________________________________________________ 
CONOZCO y ACEPTO la capacitación profesional del facultativo para realizar este tratamiento. 
Las sustancias y aparatos empleados han sido autorizados para su uso en medicina estética y 
ostenta la marca CE y número de registro sanitario correspondiente. 
CONFIRMO que el tratamiento mencionado, me ha sido explicado a fondo, por el facultativo 
en palabras comprensibles para mí, los riesgos típicos que tiene, los efectos no deseados, los 
riesgos característicos a mi persona, así como las molestias o, en ocasiones, dolores que puedo 
sentir teniendo un post -tratamiento normal. Se me han explicado, igualmente otras opciones 
existentes que están disponibles en el mercado, con pros y contras de cada una de ellas. 
 
 
Teniendo esto en cuenta he escogido el tratamiento anteriormente descrito. 
También se me ha informado, en términos de probabilidades, de los resultados del 
procedimiento según referencias de la literatura científica contrastada y de la experiencia 
previa del profesional en la realización de estos procedimientos. 
 
BREVE EXPLICACION DEL TRATAMIENTO: 
El láser fraccionado es un sistema láser (CO2 o Erbio) fraccionado por un filtro con multitud de 
canales microscópicos, especialmente diseñado para conseguir una regeneración rápida de la 
piel, los cuales fraccionan el rayo de láser, haciendo que su llegada a la superficie de la piel sea 
de forma muy dividida, consiguiendo que sea regenerada de forma rápida y eficaz por el tejido 
no impactado entre los microcanales resultando una pie l tersa, fresca y suave . El resultado 
clínico puede variar en distintas pieles, zonas corporales y condiciones personales.  
El equipo que se va a utilizar en este caso es _____________________________________ 
El tratamiento se realiza sin anestesia o bajo anestesia tópica o local. 
ME COMPROMETO al uso de las gafas de protección ocular durante todo el proceso de 
emisión de la luz láser.  
Indicaciones:  
• Piel apagada, mate y desvitalizada, a cualquier edad. 
• Estrías y cicatrices. 
• Arrugas finas del área peribucal (código de barras) o periocular (patas de gallo). 
• Prevención del foto-envejecimiento, sobre todo en pieles muy expuestas al sol. 
• Grandes fumadores. 
ACEPTO que puedan ocurrir los RIESGOS Y COMPLICACIONES descritos por la ciencia médica 
como inherentes a este tipo de tratamiento. Entre ellos:  
• Riesgos y complicaciones comunes a cualquier tratamiento médico -estético, como: 
hematomas, edemas o inflamación. 
• Riesgos a corto plazo y transitorios: aparición de eritema (enrojecimiento), ligera 
sensación dolorosa, infección, hematomas , edemas que deberán ser tratados 
adecuadamente. 
• Riesgos y complicaciones específicos de este tratamiento que me han sido explicados y 
que asumo y acepto, como ampollas, costras, y decoloración transitoria de la piel, así 
como efectos raros como cicatrices y alteración de la coloración permanente.  
 
 
• Riesgos y complicaciones achacables al procedimiento anestésico (tópico o local). 
CONTRAINDICACIONES: Antecedentes de respuesta anómala a la luz, enfermedades graves o 
descompensadas, infección activa en la zona, diabetes o enfermedades autoinmunes 
descompensadas, antecedentes de cicatrización anómala, gestación, toma de retinoides en los 
últimos 6 meses, pacientes con herpes simple recidivante en el área a tratar salvo tratamiento 
preventivo. 
He sido correctamente informado, incluso por escrito (documentos de información) y/o 
mediante imágenes, de las características de este tratamiento: de sus fundamentos, de la 
forma y detalles de su realización, de sus mecanismos de acción, de sus efectos inmediatos, 
del proceso y evolución que seguiré en los siguientes días, semanas o meses, de los 
tratamientos complementarios necesarios, de las atenciones y precauciones que debo adoptar 
en las próximas horas o días, de la variabilidad en el tiempo necesario para el completo 
restablecimiento; aceptando, por lo tanto, que no se me puede asegurar la fecha en que podré 
reincorporarme a mis actividades habituales (afectivas, sociales, laborales y deportivas). 
DOY FE de no haber omitido o alterado datos al exponer mi historial y antecedentes clínico 
quirúrgicos, especialmente los referidos a alergias y enfermedades o riesgos personales. 
La Historia Clínica y el resultado de las pruebas que se han efectuado al paciente no 
desaconsejan practicar el procedimiento médico indicado, al no aparecer, a priori, riesgos que 
puedan ser determinantes del fracaso de la técnica objetivamente considerada y que pretende 
el cumplimiento de sus expectativas. 
RECONOZCO que en el curso del tratamiento pueden  surgir condiciones no previstas que 
hagan necesario un cambio de lo anteriormente planeado y doy aquí mi expresa autorización 
para el tratamiento de las mismas, incluyendo, traslado a centro hospitalario. En caso de 
complicaciones durante el tratamiento autorizo  al Centro a solicitar la necesaria ayuda de 
otros especialistas, según su mejor juicio profesional. 
SE ME HA INFORMADO que el número de sesiones que es necesario para conseguir el efecto 
deseado se me ha comunicado de forma orientativa, siendo imposible de antemano conocer la 
cantidad exacta número de sesiones que son necesarias, por la diferente forma de 
absorción/reacción de cada paciente.  Los resultados se obtienen con mayor efectividad si el 
tratamiento realizado se complementa con otros tratamientos que potenciarán sus efectos. 
He sido informado de la necesidad de que, si durante el tratamiento se produjese una punción 
accidental del personal sanitario con mi sangre, de acuerdo con la buena praxis médica, se 
realicen las determinaciones analíticas procedentes en mi sangre, en lo relativo a posibles 
patologías de transmisión hemática, para la adopción de las medidas profilácticas más 
adecuadas. 
ME COMPROMETO a seguir fielmente, en lo mejor de mis posibilidades, las instrucciones del 
médico para antes, durante y después del tratamiento antes mencionado. Quedando bajo mi 
responsabilidad el cumplimiento de las medidas pos-tratamiento recomendadas por el Centro, 
así como acudir a las visitas de control indicadas por el médico.  
 
 
COMPRENDO que el fin del tratamiento es mejorar mi apariencia existiendo la posibilidad de 
que alguna imperfección persista y que el resultado pueda no ser el esperado por mí. En este 
sentido, se me informa que el resultado estético del tratamiento depende de factores como la 
facilidad de cicatrización, formación o no de queloides . Sé que la medicina no es una ciencia 
exacta y que nadie puede garantizar la perfección absoluta. Comprendo que el resultado 
pueda no ser el esperado por mí y reconozco que no se me ha dado, en absoluto, tal garantía. 
El acto médico podría no agotarse en sí mismo y podría ser necesaria una actuación 
terapéutica posterior para lograr el objetivo por el que se está consintiendo. 
El coste del tratamiento incluye diversos cargos por los servicios prestados. El total incluye los 
honorarios de su médico, el costo de los materiales, equipo o producto. Los cargos cobrados 
por este procedimiento no incluyen los costos futuros potenciales para los procedimientos 
adicionales que usted elija o requiera a fin de revisar, optimizar o completar su resultado. 
Puede haber costos adicionales en caso de que surjan complicaciones debido al tratamiento. 
Los cargos por tratamientos secundarios relacionados  con las revisiones y que no hayan sido 
previamente pactados también serán su responsabilidad. Al firmar el consentimiento para este 
procedimiento, usted reconoce que ha sido informado acerca de sus riesgos y consecuencias y 
acepta la responsabilidad de las decisiones clínicas que se tomaron junto con los costos 
económicos de todos los tratamientos futuros. 
AUTORIZO la obtención de fotografías y vídeos para una correcta valoración diagnóstica y para 
el control de la evaluación y de los resultados. Asimismo, autorizo a que se me practiquen 
fotografías de la zona intervenida que puedan ser utilizadas con fines científicos, docentes o 
médicos, quedando entendido que su uso no constituya ninguna violación a la intimidad o 
confidencialidad, a las que tengo derecho. 
Los datos de carácter personal serán tratados por LA CLÍNICA para el estudio y posterior 
prestación de los servicios solicitados; y en consecuencia, para la gestión administrativa y 
económica del paciente. Finalidad basada en el consentimiento expreso prestado por usted al 
inicio de su relación con LA CLÍNICA. Los datos personales no se cederán a terceros salvo en los 
casos que exista una obligación legal o/y contractual y se conservarán durante el tiempo 
necesario para determinar las posibles responsabilidades legales que se pudieran derivar; y en 
todo caso, su historial clínico, como mínimo durante un plazo de cinco años contados desde la 
fecha del alta del último proceso asistencial. Puede ejercitar sus derechos de acceso, 
rectificación, supresión y portabilidad de sus datos, de limitación y oposición a su tratamiento, 
así como a no ser objeto de decisiones basadas únicamente en el tratamiento automatizado de 
sus datos ante LA CLÍNICA en cualquier momento. 
Sé que la firma y otorgamiento de este consentimiento no supone ningún tipo de renuncia a 
reclamaciones futuras tanto de orden médico como legal. Sé también que puedo desdecirme 
de la firma de este consentimiento en cualquier momento previo a la realización del 
tratamiento. 
He podido aclarar todas mis dudas acerca de todo lo anteriormente expuesto y he entendido 
totalmente este DOCUMENTO DE CONSENTIMIENTO reafirmándome en todas y cada uno de 
sus puntos y con la firma del documento ratifico y consiento que el tratamiento se realice.  
 
 
Fecha y lugar 
El médico Firma del paciente Representante legal 
 
 
 
Igualmente he sido informado, y me doy plenamente por enterado, de que el presente 
consentimiento podrá ser revocado por el abajo firmante en cualquier momento, así como 
que, en su caso, dicha revocación deberá hacerse por escrito, habiendo, además, recibido 
amplia información de las consecuencias de mi decisión. 
El médico Firma del paciente Representante legal$ci_laser_fraccionado_pdf$,
  'laser,fraccionado,pdf,medicina,medico',
  48,
  true,
  1,
  'consent',
  NULL,
  false,
  'tracking_depilacion',
  'medicina',
  NULL,
  'CI-Laser-Fraccionado.pdf',
  '2026-05-27T12:37:15'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'ci_laser_fraccionado_pdf'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'consent_inf_peelings_qu_imicos_doc',
  'Tratamiento estético',
  'CONSENT. INF. PEELINGS QU+ìMICOS',
  $consent_inf_peelings_qu_imicos_doc$CONSENT. INF. PEELINGS QU+ìMICOS

[Documento importado desde CONSENT. INF. PEELINGS QU+ìMICOS.doc. Revise el contenido en Configuración → Consentimientos si la extracción automática fue incompleta.]$consent_inf_peelings_qu_imicos_doc$,
  'consent,inf,peelings,micos,doc',
  5,
  true,
  1,
  'consent',
  NULL,
  false,
  'tracking_aesthetic',
  'estetica',
  NULL,
  'CONSENT. INF. PEELINGS QU+ìMICOS.doc',
  '2015-11-30T16:04:40'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'consent_inf_peelings_qu_imicos_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'consentimiento_electrica_doc',
  'Depilación',
  'Consentimiento ELÉCTRICA',
  $consentimiento_electrica_doc$CONSENTIMIENTO INFORMADO PARA LA DEPILACI
Este documento ha sido preparado para informarle sobre la t
ctrica, su forma de aplicaci
n y sus posibles riesgos.
Es importante que lea esta informaci
n de forma cuidadosa y completa, comprendiendo su significado o preguntando en caso de duda, y finalmente firme el consentimiento informado.
n oral y escrita por parte del centro Lipoout.
ctrica es la mejor forma de eliminar vello rebelde de forma definitiva.
nea para aquellas zonas del cuerpo que no sean muy extensas ya que se trata de una t
cnica pelo a pelo. O para zonas tras haber terminado su tratamiento con l
n pelo rebelde que a pesar de estar debilitado contin
e apareciendo de forma aislada. En este caso la depilaci
ctrica es un complemento perfecto  ya que trata el fol
culo de manera individual. As
 conseguiremos la depilaci
Otra de sus ventajas es que elimina vello de cualquier color y grosor, independientemente del fototipo de piel del paciente. 
El tratamiento consiste en la introducci
n de una aguja especialmente dise
ada para este tratamiento, de alta precisi
n y extremadamente fina por debajo de la dermis que consigue llegar hasta el fol
culo piloso. De este modo se logra aplicar una leve descarga que destruir
 todas las funciones del mismo. La finalidad de esta descarga es que la producci
e y sea totalmente definitiva, aunque para ello sean necesarias varias sesiones de tratamiento. Es preciso realizar esta t
cnica de forma individual, es decir, aplicando la corriente pelo a pelo. 
INDICACIONES Y PRECAUCIONES
 mismo, se debe evitar la exposici
n al sol o bronceado artificial 24 horas antes y posteriores a una sesi
n se recomienda la utilizaci
n de pantalla solar que proteger
- No aplicar maquillajes ni cremas en la zona depilada hasta transcurridas al menos 24-48 horas despu
- Utilizar jabones neutros y aclarar con abundante agua. Secarse a 
- En zona de axilas se recomienda evitar uso de desodorante al menos durante 7 d
ticos en contacto con la zona tratada. Preferible tejidos naturales como algod
Se considera un procedimiento seguro con m
nimos efectos secundarios, pero como cualquier procedimiento puede entra
ar un cierto grado de riesgo y es importante que usted comprenda los riesgos asociados a esta t
n individual de someterse a un tratamiento se basa en la comparaci
n del riesgo con el beneficio potencial. Usted deber
a comentar cada una de ellas con la persona que le propone realizar el tratamiento  para mejorar su comprensi
n de molestia o posible dolor es muy variable de unas personas a otras y de unas zonas a otras, pero siempre se pueden recurrir a t
cnicas, como la aplicaci
o, para minimizar esa molestia.
 Eritema: es normal que despu
n, la piel aparezca ligeramente enrojecida. Es un proceso transitorio que desaparecer
meno poco frecuente, pero puede aparecer en algunos tipos de piel o como una respuesta cut
nea exagerada. Evitar su desprendimiento forzado.
simo y puede ser debido a una hipersensibilidad cut
nea, o a una dosis excesiva para ese tipo de piel (aunque dos pieles parezcan iguales y se pueda pensar en una dosis similar, a veces la respuesta cut
ES IMPORTANTE QUE HAYA LE
DO CUIDADOSAMENTE LA INFORMACI
N ANTERIOR Y HAYAN SIDO RESPONDIDAS TODAS SUS PREGUNTAS ANTES DE QUE FIRME ESTE CONSENTIMIENTO
CONSENTIMIENTO PARA LA DEPILACI
Estoy satisfecho/a con la explicaci
n recibida, asumiendo personalmente todos y cada uno de los riesgos antes se
alados y que pudieran sucederme como consecuencia de la aplicaci
n del tratamiento antes se
Doy fe de no haber omitido o alterado datos al exponer mi historial y antecedentes cl
rgicos, especialmente los referidos a alergias y enfermedades, medicaci
n, o riesgos personales.
Y OTORGO MI CONSENTIMIENTO para que me sea realizado el tratamiento mediante el
Entiendo que este consentimiento puede ser revocado por mi en cualquier momento antes de la realizaci
 conste firmo el presente documento.
Firma de la persona a tratar y n
Firma del tutor/a de la persona a tratar en caso de que fuese menor de edad y n
DocumentSummaryInformation$consentimiento_electrica_doc$,
  'consentimiento,eléctrica,doc',
  21,
  true,
  1,
  'consent',
  NULL,
  false,
  'tracking_depilacion',
  'estetica',
  NULL,
  'Consentimiento ELÉCTRICA.doc',
  '2021-02-11T13:12:08'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'consentimiento_electrica_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'consentimiento_fotorrejuvenecimiento_doc',
  'Tratamiento estético',
  'Consentimiento FOTORREJUVENECIMIENTO',
  $consentimiento_fotorrejuvenecimiento_doc$CONSENTIMIENTO INFORMADO DE FOTORREJUVENECIMIENTO
Este documento ha sido preparado para informarle sobre el Fotorrejuvenecimiento (manchas y arrugas) con luz pulsada, su forma de aplicaci
n y sus posibles riesgos.
Es importante que lea esta informaci
n de forma cuidadosa y completa, comprendiendo su significado o preguntando en caso de duda, y finalmente firme el consentimiento informado.
n oral y escrita por parte del centro Lipoout.
Antes de empezar el tratamiento se debe evitar la exposici
n al sol o al bronceado artificial durante las 2-4 semanas anteriores y posteriores a una sesi
n se debe utilizar la  filtros o pantallas solares que proteger
El tratamiento consiste en la aplicaci
n de un gel de contacto en la zona, para despu
s aplicar pulsos de luz sobre la zona interesada de la piel y eventualmente en el resto del territorio para uniformizar la superficie cut
A nivel de las pigmentaciones la luz act
a sobre el pigmento que se encuentra acumulado a nivel de las hiperpigmentaciones haciendo que 
ste se caliente, destruya y sea expulsado del cuerpo o eliminado por c
lulas de defensa. El tipo de piel as
sticas de las hiperpigmentaciones guiar
n al terapeuta para escoger los par
s adecuados. En el tratamiento de arrugas la luz act
lulas de la piel para que formen col
Se suelen realizar de 6 a 12 sesiones con una frecuencia de 21 d
mo vaya respondiendo el tratamiento.
Los beneficios que se obtienen son varios: es una t
cnica no invasiva altamente efectiva. Pero no hay que olvidar que el envejecimiento cut
neo se ve acelerado por la exposici
 necesario cuidar la piel con pantalla solar o disminuyendo la exposici
RIESGOS DEL FOTORREJUVENECIMIENTO CON IPL (LUZ PULSADA)
Se considera un procedimiento seguro con m
nimos efectos secundarios, pero como cualquier procedimiento puede entra
ar un cierto grado de riesgo y es importante que usted comprenda los riesgos asociados a esta t
n individual de someterse a un tratamiento se basa en la comparaci
n del riesgo con el beneficio potencial. Aunque en la mayor
a de personas tratadas no se presentan estas complicaciones, usted deber
a comentar cada una de ellas con la persona que le propone realizar el tratamiento  para mejorar su comprensi
n de molestia o posible dolor es muy variable de unas personas a otras y de unas zonas a otras, pero siempre se pueden recurrir a t
cnicas, como la aplicaci
o, para minimizar esa molestia.
 Eritema: es normal que despu
n de fotorrejuvenecimiento, la piel aparezca ligeramente enrojecida y las manchas tratadas muestren un color m
s oscuro, signo de efectividad de la sesi
n de tratamiento. Con el tiempo la mancha se descamar
 mostrando una piel rosada, y es muy importante proteger esta piel de la exposici
n solar puesto que es cuando mayor riesgo presenta de hiperpigmentaciones.
culas o ampollas: es un fen
meno muy poco frecuente, pero puede aparecer en algunos tipos de piel o como una respuesta cut
nea exagerada. Mayor frecuencia en personas reci
n bronceadas por lo que debe indicar al terapeuta si se ha expuesto al sol o UVA.
simo y puede ser debido a una hipersensibilidad cut
nea, o a una dosis excesiva para ese tipo de piel (aunque dos pieles parezcan iguales y se pueda pensar en una dosis similar, a veces la respuesta cut
nea es diferente), y/o un reciente exposici
 Alteraciones de la pigmentaci
n: ya sea en forma de hipocrom
as (manchas claras) o hipercrom
as (manchas oscuras), son posibles, pero suelen ser autolimitados en el tiempo. Sin embargo, pueden ser de evoluci
s larga o incluso permanentes en casos en los que previamente han aparecido  quemaduras, con la exposici
n previa o posterior al sol o con un riesgo personal inherente de pigmentaci
n que presentan determinadas personas. Para minimizar este riesgo, se recomienda evitar la exposici
n al sol o al bronceado artificial.
n: es importante que nos informe de ello, pues ciertos f
rmacos pueden producir reacciones de fotosensibilizaci
n al ser aplicada la luz pulsada. Como consecuencia, se debe evitar el tratamiento durante el consumo de ciertos f
ES IMPORTANTE QUE HAYA LE
DO CUIDADOSAMENTE LA INFORMACI
N ANTERIOR Y HAYAN SIDO RESPONDIDAS TODAS SUS PREGUNTAS ANTES DE QUE FIRME ESTE CONSENTIMIENTO
CONSENTIMIENTO PARA EL FOTORREJUVENECIMIENTO (MANCHAS Y ARRUGAS)
Estoy satisfecho/a con la explicaci
n recibida, asumiendo personalmente todos y cada uno de los riesgos antes se
alados y que pudieran sucederme como consecuencia de la aplicaci
n del tratamiento antes se
Doy fe de no haber omitido o alterado datos al exponer mi historial y antecedentes cl
rgicos, especialmente los referidos a alergias y enfermedades, medicaci
n, o riesgos personales.
Y OTORGO MI CONSENTIMIENTO para que me sea realizado el tratamiento mediante luz pulsada. 
Entiendo que este consentimiento puede ser revocado por mi en cualquier momento antes de la realizaci
 conste firmo el presente documento.
Firma de la persona a tratar y n
Firma del tutor/a de la persona a tratar en caso de que fuese menor de edad y n
DocumentSummaryInformation$consentimiento_fotorrejuvenecimiento_doc$,
  'consentimiento,fotorrejuvenecimiento,doc',
  22,
  true,
  1,
  'consent',
  NULL,
  false,
  'tracking_aesthetic',
  'estetica',
  NULL,
  'Consentimiento FOTORREJUVENECIMIENTO.doc',
  '2021-04-28T15:31:14'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'consentimiento_fotorrejuvenecimiento_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'consentimiento_hialuronico_pdf',
  'Medicina estética',
  'consentimiento HIALURÓNICO',
  $consentimiento_hialuronico_pdf$DOCUMENTO INFORMATIVO 
Y CONFORMIDAD 
 
 
DOCUMENTO DE CONSENTIMIENTO INFORMADO 
PARA IMPLANTES CON ÁCIDO HIALURÓNICO 
 
En cumplimiento de la Ley 41/2002, básica reguladora de la autonomía del paciente y de 
derechos y obligaciones en materia de información y documentación clínica (BOE 15 -11-02), le 
ofrecemos por escrito y de manera comprensible, información sobre IMPLANTES CON ÁCIDO 
HIALURÓNICO. No obstante, dicha información le ha sido ya sucintamente facilitada de forma 
oral por el médico que suscribe, que asimismo y a requerimiento de Vd. ha ido contestando a 
todas las preguntas objeto de su interés y relacionadas con el tratamiento. El presente 
documento no es sino la trascripción gráfica de dicha información, a fin de facilitar su 
comprensión y motivar una autorización reflexiva y pausada. 
Es importante que lea esta información de forma clara y completa. Por favor firme o ponga sus 
iniciales en cada página para indicar así que la ha leído y firme el documento  de 
consentimiento para el procedimiento propuesto por su médico. 
En _______________________, a ____ de ________________________________ de _______  
Nombre del paciente ___________________________________________________________  
Fecha de nacimiento ____________________________ DNI____________________________  
Domicilio _____________________________________________________________________  
Población _____________________________________________________________________ 
Teléfonos _____________________________________________________________________ 
 
DECLARO: 
Que por el presente documento REQUIERO Y AUTORIZO al Doctor/a _____________________ 
____________________________, licenciado/graduado en Medicina y ___________________ 
con el número de colegiado _______ _____________ que realice en mi persona el tratamiento 
conocido como IMPLANTES CON ÁCIDO HIALURÓNICO por ser éste el escogido por mí frente a 
las alternativas _______________________________________________________________ 
He sido correctamente informado, y los acepto, los riesgos comúnmente conocidos de la pre -
medicación, la anestesia y/o el tratamiento que me han de realizar. 
CONSIENTO, en caso de ser necesario, en la administración de anestesia local o tópica dada 
por o bajo la dirección del Dr/a _________________________________________________ 
CONOZCO y ACEPTO la capacitación profesional del facultativo para realizar este tratamiento. 
Las sustancias y aparatos empleados han sido autorizados para su uso en medicina estética y 
ostenta la marca CE y número de registro sanitario correspondiente. 
CONFIRMO que el tratamiento mencionado, me ha sido explicado a fondo, por el facultativo 
en palabras comprensibles para mí, los riesgos típicos que tiene, los efectos no deseados, los 
riesgos característicos a mi persona, así como las molestias o, en ocasiones, dolores que puedo 
sentir teniendo un post -tratamiento normal. Se me han explicado, igualmente otras opciones 
existentes que están disponibles en el mercado, con pros y contras de cada una de ellas. 
Teniendo esto en cuenta he escogido el tratamiento anteriormente descrito. 
También se me ha informado, en términos de probabilidades, de los resultados del 
procedimiento según referencias de la literatura científica contrastada y de la experiencia 
previa del profesional en la realización de estos procedimientos. 
BREVE EXPLICACION DEL TRATAMIENTO: 
El ácido hialurónico es una sustancia presente en los diferentes tejidos de todas las especies 
animales, cuya función en la estructura de la piel, es mantener la elasticidad de la misma. Y la 
hidratación, ya que tiene la capacidad de retener a su alrededor una gran cantidad de agua 
aportando volumen a los tejidos.  
Como producto sanitario, e l ácido hialurónico es un bio-implante en forma de gel estéril, no 
pirogénico, claro, incoloro y transparente, compuesto por molécul as entrecruzadas de 
hyaluronano, que se inyecta de forma subcutánea con el fin de restaurar o corregir 
inestetismos o defectos cutáneos congénitos o adquiridos . Su uso se inició en 1996, y puede 
ser de origen animal (de la cresta del gallo y globo ocular de los peces) o de origen biológico 
(extractos de cultivo de bacterias, tecnología NASHA) , que es el que actualmente se usa en 
medicina estética (todos los preparados inyectables para estét ica pueden contener impurezas 
en mayor o menor grado). No necesita test de alergia y tras su inyección se integra de manera 
natural en los tejidos, sin alterar las características de la piel. Es un producto reabsorbible, es 
decir que el organismo lo degrada hasta hacerlo desaparecer en un periodo de tiempo 
variable. Sus efectos beneficiosos para la piel son una mayor hidratación y mientras dura el 
efecto del implante, un mayor volumen a la dermis.  
Fundamentalmente hay dos tipos de ácido hialurónico: el llamado no reticulado (similar al que 
de forma natural tenemos en la piel, la unión entre sus moléculas es muy ligera), indicado para 
hidratación profunda de la piel, pero que no rellena y es de corta duración  y el reticulado que 
mediante tecnología química (BDDE o VycrossTM) consigue un ácido hialurónico con moléculas 
más unidas entre sí, de consistencia más densa y estable que rellena y perdura más tiempo en 
el organismo, esto dependerá de la marca, indicación y tipo elegido  (peso molecular, mono o 
bifásico,  densidad, etc.). 
El ácido hialur ónico cuenta con un antídoto conocido como hialuronidasa, que puede ser 
usado en caso de presentarse diversos efectos adversos. 
En este caso el producto es (marca) _____________________________, lote (pegar etiqueta) 
Después del primer tratamiento pueden ser necesarias una o más inyecciones adicionales de 
ácido hialurónico para conseguir  el nivel deseado de corrección, aunque no se debe inyectar 
de forma repetida en la misma zona (máximo 2 -3 veces con intervalos de un mes). Una vez 
reabsorbido el producto, para mantener la corrección será necesario repetir las inyecciones al 
cabo del tiempo (después de 6 a 24 meses). El intervalo y frecuencia de volver a inyectar varía 
según el tipo de ácido hialurónico y depende de diversos factores, como área tratada, tipo de 
piel, técnica de inyección, estilo de vida (exposición solar y tabaquismo), así y sobre todo por la 
composición y marca del producto inyectado. 
El tratamiento se realiza sin anestesia o bajo anestesia tópica o local. 
ACEPTO que puedan ocurrir los RIESGOS Y COMPLICACIONES descritos por la ciencia médica 
como inherentes a este tipo de tratamiento. Entre ellos:  
• Riesgos a corto plazo: dolor, eritema, hematomas, edemas o inflamación que remitirán 
generalmente en poco tiempo sin necesidad de ser tratados. Para su prevención se me 
ha indicado evitar la toma de anticoagulante  y Vitamina E  en los días previos. 
Reacciones alérgicas (incluido el angiedema, que debe ser tratado de forma inmediata 
por el médico)  parestesias, blanqueamiento transitorio de la piel (requerirá el 
tratamiento con hialuronidasa ), nódulos, reacción granulomatosa, infección, herpes, 
que deberán ser tratados adecuadamente, sobre todo si persisten más de una semana. 
Asimetrías. Como complicación que reviste la mayor gravedad se ha descrito la 
oclusión vascular arteria l que requiere entre otras medi das la inyección inmediata de 
hialuronidasa para prevenir la necrosis y sus secuelas. 
• Riesgos a largo plazo o tardíos : resultado insuficiente  o excesivo, rea cción 
inmunológica al producto local o a distancia, nódulos, migración, dolor, granulomas 
entre un 0 ,02-1% según la literatura  (reacción a cuerpo extraño), necrosis, 
engrosamiento de la piel, inflamación cíclica o periódica de labios o zonas infiltradas 
coincidiendo con los periodos menstruales, alteraciones de la pigmentació n de la piel 
transitorias o permanentes infecciones diferidas, etc. 
• Riesgos y complicaciones achacables al procedimiento anestésico (tópico o local). 
CONTRAINDICACIONES: Alergia conocida al ácido hialurónico o a los excipientes del producto, 
enfermedades graves o descompensadas,  determinadas enfermedades autoinmunes (el 
médico descartar á cuales: esclerodermia, etc. ) o con terapia inmunológica,  toma de 
inmunosupresores, infección activa en la zona, diabetes descompensada, antecedentes de 
cicatrización anómala,  implantes permanentes previos en la zona, gestación , lactancia y 
menores de 18 años. 
TRAS EL TRATAMIENTO se me ha recomendado aplicar frío local, evitar la movilización brusca 
de la zona (gestos, alimentos muy duros), los masajes sobre la zona, el consumo de alcohol y la 
aplicación de maquillaje hasta pasados mínimo 12 horas , la exposición directa al sol o al UVA, 
las saunas y baños de vapor,  los cambios bruscos de temperatura, la práctica de ejercicio muy 
intenso, y apoyarme sobre la zona tratada.  
SE ME HA INFORMADO que el tratamiento consiste en una sesión, con una revisión y retoque 
si procede, a las cuatro semanas. El volumen de producto necesario para conseguir el efecto 
deseado se me ha comunicado de forma orientativa, siendo imposible de antemano conocer el 
volumen exacto, por la diferente forma de reacción de cada paciente. En caso de desear más 
producto del previamente pactado deberé ser informado previamente. La duración 
aproximada del producto me ha sido indicada según el prospecto del fabricante, en este caso 
__________________________ aunque reconozco que mis circunstancias personales podrían 
propiciar una variación dentro de lo previsto entre __________________________________ 
He sido correctamente informado, incluso por escrito (documentos de información) y/o 
mediante imágenes, de las características de este tratamiento: de sus fundamentos, de la 
forma y detalles de su realización, de sus mecanismos de acción, de sus efectos inmediatos, 
del proceso y evolución que seguiré en los siguientes días, semanas o meses, de los 
tratamientos complementarios necesarios, de las atenciones y precauciones que debo adoptar 
en llas próximas horas o días, de la variabilidad en el tiempo necesari o para el completo 
restablecimiento; aceptando, por lo tanto, que no se me puede asegurar la fecha en que podré 
reincorporarme a mis actividades habituales (afectivas, sociales, laborales y deportivas). 
DOY FE de no haber omitido o alterado datos al exponer mi historial y antecedentes clínico 
quirúrgicos, especialmente los referidos a alergias y enfermedades o riesgos personales. 
La Historia Clínica y el resultado de las pruebas que se han efectuado al paciente no 
desaconsejan practicar el procedimiento médico indicado, al no aparecer, a priori, riesgos que 
puedan ser determinantes del fracaso de la técnica objetivamente considerada y que pretende 
el cumplimiento de sus expectativas. 
RECONOZCO que en el curso del tratamiento pueden surgir condiciones no previstas  o de las 
descritas que hagan necesario un cambio de lo anteriormente planeado y doy aquí mi expresa 
autorización para el tratamiento de las mismas, incluyendo,  la inyección de hialuronidasa 
urgente sin test de alergia previo y el traslado a centro hospitalario. En caso de complicaciones 
durante el tratamiento autorizo al Centro a solicitar la necesaria ayuda de otros especialistas, 
según su mejor juicio profesional. 
Los resultados pueden ser mejorados si el tratamiento realizado se complementa con otros 
tratamientos que potenciarán sus efectos (como toxina botulínica, peelings y otros). 
He sido informado de la necesidad de que, si durante el tratamiento se produjese una punción 
accidental del personal sanitario con mi sangre, de acuerdo con la buena praxis médica, se 
realicen las determinaciones analíticas procedentes en mi sangre, en lo relativo a posibles 
patologías de transmisión hemática, para la adopción de las medidas profilácticas más 
adecuadas. 
ME COMPROMETO a seguir fielmente, en lo mejor de mis posibilidades, las instrucciones del 
médico para antes, durante y después del tratamiento antes mencionado. Quedando bajo mi 
responsabilidad el cumplimiento de las medidas pos-tratamiento recomendadas por el Centro, 
así como acudir a las visitas de control indicadas por el médico.  
COMPRENDO que el fin del tratamiento es mejorar mi apariencia existiendo la posibilidad de 
que alguna imperfección persista y que el resultado pueda no ser el esperado por mí. En este 
sentido, se me informa que el resultado estético del tratamiento depende de factores como la 
facilidad de cicatrizaci ón, formación o no de queloides.  Sé que la medicina no es una ciencia 
exacta y que nadie puede garantizar la perfección absoluta. Comprendo que el resultado 
pueda no ser el esperado por mí y reconozco que no se me ha dado, en absoluto, tal garantía. 
El acto médico podría no agotarse en sí mismo y podría ser necesaria una actuación 
terapéutica posterior para lograr el objetivo por el que se está consintiendo. 
El coste del tratamiento incluye diversos cargos por los servicios prestados. El total incluye los 
honorarios de su médico, el costo de los materiales, equipo o producto. Los cargos cobrados 
por este procedimiento no incluyen los costos futuros potenciales para los procedimientos 
adicionales que usted elija o requiera a fin de revisar, optimizar o completar su resultado. 
Puede haber costos adicionales en caso de que surjan complicaciones debido al tratamiento. 
Los cargos por tratamientos secundarios relacionados  con las revisiones y que no hayan sido 
previamente pactados también serán su responsabilidad. Al firmar el consentimiento para este 
procedimiento, usted reconoce que ha sido informado acerca de sus riesgos y consecuencias y 
acepta la responsabilidad de las decisiones clínicas que se tomaron junto con los costos 
económicos de todos los tratamientos futuros. 
AUTORIZO la obtención de fotografías y vídeos para una correcta valoración diagnóstica y para 
el control de la evaluación y de los resultados. Asimismo, autorizo a que se me practiquen 
fotografías de la zona intervenida que puedan ser utilizadas con fines científicos, docentes o 
médicos, quedando entendido que su uso no constituya ninguna violación a la intimidad o 
confidencialidad, a las que tengo derecho. 
Los datos de carácter personal serán tratados por LA CLÍNICA para el estudio y posterior 
prestación de los servicios solicitados; y en consecuencia, para la gestión administrativa y 
económica del paciente. Finalidad basada en el consentimiento expreso prestado por usted al 
inicio de su relación con LA CLÍNICA. Los datos personales no se cederán a terceros salvo en los 
casos que exista una obligación legal o/y contractual y se conservarán durante el tiempo 
necesario para determinar las posibles responsabilidades legales que se pudieran derivar; y en 
todo caso, su historial clínico, como mínimo durante un plazo de cinco años contados desde la 
fecha del alta del último proceso asistencial. Puede ejercitar sus derechos de acceso, 
rectificación, supresión y portabilidad de sus datos, de limitación y oposición a su tratamiento, 
así como a no ser objeto de decisiones basadas únicamente en el tratamiento automatizado de 
sus datos ante LA CLÍNICA en cualquier momento. 
Sé que la firma y otorgamiento de este consentimiento no supone ningún tipo de renuncia a 
reclamaciones futuras tanto de orden médico como legal. Sé también que puedo desdecirme 
de la firma de este consentimiento en cualquier momento previo a la realización del 
tratamiento. 
He podido aclarar todas mis dudas acerca de todo lo anteriormente expuesto y he entendido 
totalmente este DOCUMENTO DE CONSENTIMIENTO reafirmándome en todas y cada uno de 
sus puntos y con la firma del documento ratifico y consiento que el tratamiento se realice.  
Fecha y lugar 
El médico Firma del paciente Representante legal 
 
 
 
 
Igualmente he sido informado, y me doy plenamente por enterado, de que el presente 
consentimiento podrá ser revocado por el abajo firmante en cualquier momento, así como 
que, en su caso, dicha revocación deberá hacerse por escrito, habiendo, además, recibido 
amplia información de las consecuencias de mi decisión. 
El médico Firma del paciente Representante legal$consentimiento_hialuronico_pdf$,
  'consentimiento,hialurónico,pdf,medicina,medico',
  43,
  true,
  1,
  'consent',
  NULL,
  false,
  NULL,
  'medicina',
  NULL,
  'consentimiento HIALURÓNICO.pdf',
  '2026-02-03T13:23:38'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'consentimiento_hialuronico_pdf'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'consentimiento_indiba_doc_modificado_2024_doc',
  'Tratamiento estético',
  'CONSENTIMIENTO INDIBA.doc MODIFICADO 2024',
  $consentimiento_indiba_doc_modificado_2024_doc$%DOCUMENTO DE CONSENTIMIENTO INFORMADO
TRATAMIENTO MEDIANTE RADIOFRECUENCIA MONOPOLAR CAPACITIVA / RESISTIVA DE 448 kHz : 
El personal especializado de LIPOOUT me ha explicado a 
. de forma clara y comprensible el tratamiento que me va a aplicar.
La radiofrecuencia aplicada para fines est
a habitual y muy utilizada en el entorno de la est
tica. Se aplica mediante m
ltiples dispositivos en el mercado que se caracterizan y diferencian entre ellos por la frecuencia y el tipo de electrodo con los que trabajan. El objetivo de este documento es facilitar un consentimiento informado al paciente en relaci
a conocida como Radiofrecuencia Monopolar Capacitiva / Resistiva de 448 kHz y denominaci
 Deep Beauty, cuyas indicaciones son: reducci
n, mejora del aspecto de bolsas y ojeras, efecto lifting antiedad, redefinici
n de la silueta, mejora de la celulitis, estr
as, flacidez, reafirmaci
n de senos y bienestar integral . La tecnolog
a en la que se basa INDIBA
 DEEP BEAUTY fue introducida, desarrollada, investigada y patentada por la compa
a INDIBA, S.A. hace treinta a
os y se comercializa en la actualidad en m
ses de Europa, Asia y Am
   2.  CONTRAINDICACIONES, ADVERTENCIAS Y EFECTOS SECUNDARIOS
2.1. CONTRAINDICACIONES:
n de marcapasos u otro tipo de implantes electr
Piel no intacta (heridas abiertas o quemaduras recientes).
Es un tratamiento de uso externo y no debe utilizarse por v
a endocavitaria (bucal, vaginal o rectal).
Personas que sufren de falta de sensibilidad (insensibilidad cong
nita al dolor, lesiones nerviosas, paraplejia o expuestos a tratamientos farmacol
gicos que reduzcan la sensibilidad al dolor y al calor).
quel, al cromo o alguno de los componentes de la crema de aplicaci
 bajo terapia con anticoagulantes orales, debe consultar a su m
dico antes de iniciar un tratamiento con INDIBA
*Se debe informar antes del tratamiento si se ha padecido previamente episodios de alergias cut
2.2. EFECTOS SECUNDARIOS: 
Tras aplicar el tratamiento es normal que el paciente perciba una sensaci
n de incremento de la temperatura en la zona tratada que forma parte del mecanismo de acci
n. Asimismo, suele producirse un eritema. Dicho enrojecimiento es inocuo y remite, en general, al cabo de unas horas.
n de la radiofrecuencia existe el riesgo de inducci
n de quemaduras locales en la zona de contacto de los electrodos (activo y/de retorno) con la piel. En caso de producirse alguna quemadura, 
cter local, circunscrita al territorio en contacto directo con los electrodos. En tratamientos faciales y de bolsas de ojos, pueden producirse molestias leves (congesti
rpados y/u ojos, lagrimeo) por acceso accidental de crema de aplicaci
n de crema conductora a la mucosa ocular. En caso de manifestarse, estas molestias son de car
cter transitorio y no requieren de otras medidas correctoras.
N DE LA PERSONA A TRATAR 
He comprendido las explicaciones que se me han facilitado en un lenguaje claro y sencillo. 
El profesional que me ha atendido me ha permitido realizar todas las observaciones y me ha aclarado todas las dudas que le he planteado. 
Comprendo que en cualquier momento y sin necesidad de dar ninguna explicaci
n, puedo revocar el consentimiento que ahora presto, mediante la firma de este documento. 
Por ello, manifiesto que estoy satisfecho con la informaci
n recibida y que comprendo el alcance y los riesgos del tratamiento. 
, eximo al personal aplicador, a la cl
nica o centro de aplicaci
n, a sus empleados y al fabricante del producto de responsabilidades sobre consecuencias derivadas de la no veracidad en esta declaraci
n, o de no haber informado sobre razones que contraindiquen o impidan el tratamiento.
Que se me realice el tratamiento de INDIBA
Fdo: El/ La beneficiario del tratamiento:                        Representante legal:
En cumplimiento de lo establecido en la Ley Org
nica 03/2018, de 13 de diciembre, de Protecci
a de derechos digitales (LOPDGDD) le informamos que los datos personales que facilite quedar
n tratados en los ficheros de LIPOOUT, con el fin de informarle sobre nuevos servicios, productos y/o promociones.
Asimismo el cliente presta su consentimiento a LIPOOUT para que, por cualquier medio de comunicaci
n, incluido el correo electr
nico o equivalente, le env
e comunicaciones comerciales o promocionales relativas a sus productos y servicios.
 ejercer en cualquier momento su derecho de acceso, rectificaci
n de sus datos, y revocar la autorizaci
n concedida para que LIPOOUT env
nica ofertas o comunicaciones publicitarias y promocionales, notific
ndolo mediante correo electr
nico a info@lipoout.com o por correo postal a LIPOOUT- Rda. de Outeiro, 219 - Bajo 15007 - A Coru
a, mediante solicitud escrita y firmada que contenga los siguientes datos: nombre, apellidos, domicilio a efectos de notificaciones, fotocopia del DNI o pasaporte, y petici
n en que se concreta la solicitud. A efectos informativos, se designa como responsable del fichero a Mar
a del Mar Lamas Pernas, con domicilio en la direcci
DocumentSummaryInformation$consentimiento_indiba_doc_modificado_2024_doc$,
  'consentimiento,indiba,doc,modificado,2024,radiofrecuencia',
  46,
  true,
  1,
  'consent',
  NULL,
  true,
  'tracking_aesthetic',
  'estetica',
  '{"male": "/clinical/medidas-hombre.jpg", "female": "/clinical/medidas-mujer.docx"}'::jsonb,
  'CONSENTIMIENTO INDIBA.doc MODIFICADO 2024.doc',
  '2026-04-28T17:10:20'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'consentimiento_indiba_doc_modificado_2024_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'consentimiento_informado_lipomassage_pdf',
  'Tratamiento estético',
  'Consentimiento informado Lipomassage',
  $consentimiento_informado_lipomassage_pdf$BR INQUIRY SL DISTRIBUIDOR OFICIAL LPG SYSTEMS ESPAÑA Y ANDORRA 
C/Fructuós Gelabert 2-4, 4t5ª 08970 SAN JOAN DESPÍ tel. 931060073 info@brinq.es 
 
 
CONSENTIMIENTO INFORMADO 
    TRATAMIENTO LIPOMASSAGE® BY ENDERMOLOGIE® DE LPG SYSTEMS® 
 
 
Este es un documento de consentimiento informado que ha sido elaborado con el fin de informar al 
cliente final acerca de  las aplicaciones de  Lipomassage® by Endermologie®, técnica creada por la  
empresa LPG  Systems® para el tratamiento de la celulitis, grasa localizada y remodelación corporal. 
Para la aplicación de dicha técnica se utiliza el  equipo LPG CELLU M6*, el cuál  moviliza  el tejido 
conjuntivo dérmico e hipodérmico  mediante dos rodillos  motorizados e i ndependientes y una bomba 
de aspiración  regulable. Esta singularidad tecnológica , exclusiva y patentada por LPG  Systems®,  
permite reproducir la comúnmente denominada “pinza rodada” , controlando por tanto  la profundidad 
y forma del pliegue de tejido . Unido al uso mecánico  del equipo es imprescindible una formación 
cualificada  por parte del terapeuta  que realice los tratamientos médico-estéticos. El curso de 
formación para el uso de estos equipos es de carácter obligatorio, puesto que una ap licación metódica 
y exhaustiva de los protocolos marcados por LPG®  en función de la valoración  inicial serán clave para la 
consecución de los objetivos  buscados.  
 
Este documento  también hace re ferencia a los posibles riesgos y  contraindicaciones de la t écnica 
Lipomassage® by Endermologie®, tal como establece la Ley General de Sanidad publicada por el B.O.E . 
del 29 -4-86- nº 102, apto.6 del artículo 10, que dice textualmente: “… siendo preciso el previo 
consentimiento escrito del usuario para la realización de cualquier in tervención…” 
Es importante que lea esta información de forma cuidadosa y completa. Por favor, ponga sus iniciales 
en cada página, indicando de esta forma que  la ha leído, y firme el consentimiento para el tratamiento 
que se propone realizar. 
 
INTRODUCCIÓN 
 
Lipomassage® by Endermologie® es una té cnica no quirúrgica basada en el principio de MECANO-
ESTIMULACIÓN, la cual, per mite una activación celular mediante la mecanización del tejido conjuntivo. 
Su finalidad principal, como ya ha sido mencionado anteriormente, es la de tr atar la denominada 
“celulitis” y los problemas de  grasa localizada de determinadas áreas corporales, principalmente: 
brazos, espalda, abdo men, nalgas, caderas y  muslos. Para realizar los tratamientos se utiliza una malla 
que cubre el cuerpo por completo, dejando al descubierto únicamente la cabeza, el cuello y las manos; 
su finalidad es la  de preservar la intimidad e higiene del cliente y facilitar  las maniobras de 
desplazamiento del cabezal de tratamiento.   Existen numerosos estudios científicos de entida des 
independientes a LPG  Systems® que demuestran la efectividad de la técnica, tanto desde el punto de 
vista fisiológico como estético. La celulitis se trata  actuando básicamente sobre los tejidos conjuntivos 
hipodérmicos, estimulando la vascularización, l a eliminación de las toxinas y los  intercambios 
intercelulares. Lipomassage® by Endermologie, basándose en  los principios fisiológicos , reduce la 
retención de líquidos, favoreciendo el funcionamiento de los s istemas venoso y linfático. Se favorece 
una remodelación del cu erpo y una reducción de volumen corporal, así como una potenciación de  la 
lipólisis (destrucción de la grasa)  en los niveles más profundos, tanto en el hombre como en la mujer.  A  
nivel epidérmico se produce  una exfoliación que elimina las células muertas  y le devue lve a la piel un 
mejor aspecto . De esta forma, la técnica ofrece una  respuesta a los principales problemas estétic os, 
adaptándose a las particularidades de cada persona. 
Si bien Lipomassage® by Endermologie® es un tratamiento no invasivo destinado al campo esté tico, se 
produce una mejora de los resultados  cuando se realizan  tratamientos antes y después  de otras 
técnicas quirúrgicas  invasivas, tales como la liposucción o la abdominopla stia. Deberán tenerse en 
cuenta en estos casos las posibles contraindicaciones  médicas que puedan desaconsejar temporal o 
permanentemente la aplicación estética  de la técnica Lipomassage® by Endermologie®. 
La candidata  o candidato  idóneo para la aplicación de la técnica Lipomassage® by Endermologie® es 
aquella persona afectada de celulitis o con sobrecargas de gr asa localizada con un peso corporal cercano 
a la normalidad  o con ligero sobrepeso. Para potenciar los resultados, la persona  combinará el 
tratamiento con una gran ingesta de líquidos, ejercicio y dieta. 
 
 
BR INQUIRY SL DISTRIBUIDOR OFICIAL LPG SYSTEMS ESPAÑA Y ANDORRA 
C/Fructuós Gelabert 2-4, 4t5ª 08970 SAN JOAN DESPÍ tel. 931060073 info@brinq.es 
 
*Existen diferentes modelos de Cellu M6 (IP/ST, Keymodule i/s, Integral/Endermolab) 
En aquellos casos en los que debido a  una gran pérdida de peso y de volumen corporal aparece una piel 
descolgada en exceso, es posible que únicamente con  el protocolo de reafirmación de  Lipomassage® by 
Endermologie® no pueda reafirmarse completamente. Se requerirán entonces técnicas quirúrgicas  o no, 
adicionales para eliminar el exceso de piel y reafirmar los tejidos.  
Las irregularidades del contorno corporal también pueden ser mejoradas con la técnica Lipomassage® 
by Endermologie. Hay que indicar que , a diferencia de la Liposucción, este tratamiento no elimina 
definitivamente las sobrecargas de grasa localizada, pero si mejora visiblemente las alteraciones del 
contorno; por tanto, no se trata de un tratamiento sustituto de la liposucción.  
 
RIESGOS Y CONTRAINDICACIONES 
 
Lipomassage® by Endermologie® es  una técnica  basada en la mecanización tisular  ampliamente 
contrastada y demostrada científicamen te que no prese nta un gran número de contraindicaciones 
generales. Las contraindicaciones son las mismas que las de cualqu ier otra técnica que movilice el tejido 
conjuntivo, y dependen del estado del cliente.  No obstante, es importante que pregunte  a su terapeuta  
las dudas  que le surjan acerca de este apartado.   
Es conveniente no tratar de forma directa las heridas abierta s, las mucosas, las zonas infectadas, las 
zonas intracavitarias y los ojos. La técnica no se aplica localmente en los siguientes casos:  
  
- Eventración, hernia abdominal 
 - Angiomas 
 - Varices dolorosas 
 - Lipoma 
 - Queloides 
 - Vitíligo 
  
Para protocolos corporales de belleza, las contraindicaciones son las siguientes: 
 
 - Embarazo (el protocolo de drenaje no está contraindicado) 
 - Infección, erupción cutánea 
 - Cáncer en curso de evolución 
 - Flebitis 
 - Tratamiento anticoagulante o enfermedad que impida la coagulación de la sangre 
 - Lipoaspiración reciente, inferior a 6 meses (sólo bajo  control y seguimiento médico)  
 - Cirugía reciente (consultar con el médico o 6 meses como precaución)  
 
Otros aspectos a tener en cuenta serán los siguientes:   
 
- Hematomas: es infrecuente que aparezcan cardenales o hematomas superficiales durante o 
con posterioridad a una sesión. Puede ser debido principalmente a dos razones: una previa 
fragilidad capilar de los vasos sanguíneos superficiales; esta situación no requiere  tratamiento 
adicional, pero debe producirse una total reabsorción antes de producirse una exposición 
continuada al sol, ya que de otra manera se favorecería la aparición de manchas solares.  
Otra posible razón pued e deberse a un exceso de aspiración  sobre el tejido que esta siendo 
tratado. Esta debe considerarse una mala aplicación por parte del personal que realiza el 
tratamiento, puesto que en la técnica Lipomassage® by Endermologie® las pre siones de 
aspiración que se utilizan son mínimas (lo suficiente para conseguir el  pliegue cut áneo). Hay 
que destacar que la efectividad de la  técnica no se basa en la vacuoterapia, sino en la 
mecanización de los tejidos que realizan los rodillos motorizados.  
 
- Efectos a largo plazo:  pueden ocurrir alteraciones posteriores en el conto rno corporal como 
resultado del proceso de envejecimiento, por pérdida o ganancia de peso, embarazo u otras 
circunstancias no relacionadas con la técnica Lipomassage® by Endermologie®. 
 
 
 
 
BR INQUIRY SL DISTRIBUIDOR OFICIAL LPG SYSTEMS ESPAÑA Y ANDORRA 
C/Fructuós Gelabert 2-4, 4t5ª 08970 SAN JOAN DESPÍ tel. 931060073 info@brinq.es 
 
 
NOTA FINAL 
 
Los documentos de consentimiento informado se emplean para comunicar in formación acerca de un 
tratamiento propuesto para una enfermedad o condición determinada, así como para mostrar  los  
 
riesgos y posibles alternativas de tratamiento. El proceso de consentimiento informado pretende 
satisfacer las necesidades de información del cliente final en la mayoría de las circunstancias. Sin 
embargo, no debe considerarse que los documentos de consentimiento informado incluyan todos los 
aspectos sobre otros métodos de tratamiento o riesgo posibles.  
 LEA CUIDADOSAMENTE LA INFORMACIÓN ANT ERIOR ANTES DE FIRMAR EL CONSENTIMIENTO DE LA 
SIGUIENTE PÁGINA.  
CONSENTIMIENTO PARA LA APLICACIÓN DE LA TÉCNICA LIPOMASSAGE® BY ENDERMOLOGIE ® 
 
1. Por la presente doy mi autorización para realizar el tratamiento a la persona o personas previamente 
formadas en la técnica  Lipomassage® by Endermologie® y designadas por el 
Centro___________________________ para tal efecto. 
 
2. He leído, comprendido y firmado las páginas del folleto informativo adjunto: “Consentimiento 
informado. Tratamiento de  Lipomassage® by Endermologie®”. Así mismo, se me ha preguntado si 
quiero una información más detallada, pero estoy satisfecho/a con las explicaciones y aclaraciones 
recibidas.  
 
 
3. Doy fe de no haber omitido o alterado datos al exponer mis antecedentes médicos, especialmente los 
referidos a alergias y enfermedades o riesgos personales. 
 
4. Estoy de acuerdo en que no se me ha dado garantía por parte de nadie en cuanto al resultado del 
tratamiento con Lipomassage® by Endermologie ®. 
 
5. Doy el consentimiento para ser fotografiada /o en el transcurso de las sesiones que dura el 
tratamiento, incluyendo cualquier parte de mi cuerpo, con el fin de poder objetivar los resultados 
estéticos de la técnica. Puesto que en ningún caso será revelada mi identidad, autorizo la custodia de 
dichas imágenes al  Centro en cuestión. 
 
6. En el caso de que e l/la cliente fuera un/una menor de edad, nosotros, representante legales del/de la 
mismo/a consentimos que se realice el tratamiento y confirmamos haber comprendido lo antes dicho.  
 
7 .ME HA SIDO EXPLICADO DE FORMA COMPRENSIBLE: 
 
a. EL TRATAMIENTO CITADO ANTERIORMENTE O PROCEDIMIENTO A REALIZAR 
 b. LOS PROCEDIMIENTOS ALTERNATIVOS Y DIFERENCIAS CON OTROS MÉTODOS   DE   TRATAMIENTO 
 c. LOS RIESGOS Y CONTRAINDICACIONES DEL TRATAMIENTO PROPUESTO 
 
Firme en el siguiente consentimiento: 
 
DOY EL CONSENTIMIENTO PA RA EL TRATAMIENTO O PROCEDIMIENTO, Y LOS PUNTOS CITADOS ARRIBA 
(1-6), excepto en punto número: ________________________________________ 
 
 
En _______________________________________, a _________ _de_____________________ de 20__ 
 
Recibí copia firmada del presente documento, 
 
Cliente (Nombre, apellidos y firma):_____________________________________________________  
 
Consentimiento adaptado a  las directrices de la Sociedad Española de Cirugía Plástica, Reparadora y Estética (SECPRE) 
Versión 2004$consentimiento_informado_lipomassage_pdf$,
  'consentimiento,informado,lipomassage,pdf',
  8,
  true,
  1,
  'consent',
  NULL,
  true,
  'tracking_aesthetic',
  'estetica',
  '{"male": "/clinical/medidas-hombre.jpg", "female": "/clinical/medidas-mujer.docx"}'::jsonb,
  'Consentimiento informado Lipomassage.pdf',
  '2016-08-31T18:44:06'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'consentimiento_informado_lipomassage_pdf'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'consentimiento_ipl_doc',
  'Depilación',
  'Consentimiento IPL',
  $consentimiento_ipl_doc$Consentimiento IPL

[Documento importado desde Consentimiento IPL.doc. Revise el contenido en Configuración → Consentimientos si la extracción automática fue incompleta.]$consentimiento_ipl_doc$,
  'consentimiento,ipl,doc',
  7,
  true,
  1,
  'consent',
  NULL,
  false,
  'tracking_depilacion',
  'estetica',
  NULL,
  'Consentimiento IPL.doc',
  '2016-01-18T11:41:08'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'consentimiento_ipl_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'consentimiento_laser_doc',
  'Depilación',
  'Consentimiento LASER',
  $consentimiento_laser_doc$lCONSENTIMIENTO INFORMADO DE LA INFORMACI
N RECIBIDA SOBRE FOTODEPILACI
N CON LIGHT SHEER O LUZ PULSADA (IPL)
CONSENTIMIENTO INFORMADO SOBRE LA FOTODEPILACI
N CON FULL LASER SYSTEM-SHR O LUZ PULSADA (IPL)
A a.....................................................
Que por el presente documento REQUIERO Y AUTORIZO a los profesionales de LIPOOUT a que realicen en mi persona la depilaci
ser y/o luz pulsada (IPL) que a continuaci
El centro y su equipo utilizan para la depilaci
n el equipo SHR SYSTEM Y/O NORA que produce un calentamiento selectivo del fol
culo piloso que conduce a su destrucci
n sin afectar a los tejidos circundantes. Se me ha informado de que la depilaci
n completa de una zona se consigue en varias sesiones, en funci
n del tipo de pelo y de la zona corporal tratada.
Pudieran incluir: herpes simple, tratamientos m
dicos fotosensibilizantes, embarazo o lactancia, diabetes y tener un historial de cicatrices queloideas o procesos malignos, as
 como una reciente exposici
n al sol o si se planea dicha exposici
s se me ha informado de que debo comunicar al personal del centro el consumo de cualquier sustancia farmacol
gica y el cambio de mi estado basal (embarazo, enfermedad, alergia,...). Est
 desaconsejado, igualmente, en pieles muy bronceadas o que acaben de recibir rayos UVA., aumentando en estos casos el riesgo de quemadura.
El tratamiento normalmente es poco molesto y no suele presentar complicaciones, pero entiendo la posibilidad de EFECTOS SECUNDARIOS que se producen raramente, como la aparici
n de zonas de hiper o hipopigmentaci
n transitoria, quemaduras, que suelen ser transitorias, p
rpuras cicatrices y erupciones acneiformes, as
rmicos pasajeros como enrojecimiento, quemaz
n leve, moraduras temporales y decoloraci
n transitoria de la piel.
RIESGOS INHERENTES AL CLIENTE Y A SUS CIRCUNSTANCIAS PERSONALES:
Se me ha informado que despu
s del tratamiento es normal que la zona presente un eritema o edema normalmente ligero e incluso puede que aparezca alguna ampolla intrad
rmica, pero estos efectos, por lo general, ir
n remitiendo a las pocas horas, aunque en alg
n caso pudieran llegar a ser m
s persistentes. No obstante en un tratamiento con luz de alta intensidad nunca se debe descartar el riesgo de que en la zona tratada pudiera aparecer alguna quemadura de primer o segundo grado. Sobre todo el riesgo es mayor en las pieles oscuras o que hayan estado expuesta al sol recientemente y presenta una alta concentraci
n cambio en la pigmentaci
n) que por lo general siempre ha sido transitorio y tratado adecuadamente remite al poco tiempo.
CONFIRMO que el tratamiento mencionado, me ha sido explicado a fondo, por un profesional en palabras comprensibles para m
, los riesgos que tiene, los efectos no deseados, los riesgos caracter
 como las molestias o, en ocasiones, dolores que puedo sentir teniendo una evoluci
n normal. Se me ha explicado, igualmente otras opciones de depilaci
n disponibles en el mercado, con pros y contras de cada uno de ellas. Teniendo esto en cuenta he escogido el procedimiento de DEPILACI
SER Y/O LUZ PULSADA (IPL) explicado como tratamiento no invasivo para depilaci
ME COMPROMETO a seguir fielmente, en lo mejor de mis posibilidades, las instrucciones del profesional para antes, durante y despu
s del tratamiento antes mencionado. Quedando bajo mi responsabilidad el cumplimiento de las medidas de fotoprotecci
n recomendadas por el centro Lipoout, especialmente el evitar completamente la exposici
n de las zonas tratadas al sol y a las radiaciones UVA durante un periodo de 15 d
s con Luz Pulsada y 3 antes y 3 despu
SER SHR SYSTEM, ya que de no realizarse, se favorece la aparici
n de los efectos secundarios enumerados anteriormente.
DOY FE de no haber omitido o alterado datos al exponer mi historial y antecedentes cl
rgicos, especialmente los referidos a alergias y enfermedades o riesgos personales.
AUTORIZO a que se me practiquen fotograf
as de la zona tratada, quedando entendido que su uso no constituya ninguna violaci
n a la intimidad o confidencialidad, a las que tengo derecho.
ACEPTO que el resultado cl
a en diferentes tipos de piel y con las diferentes tonalidades y localizaci
RECONOZCO que los resultados esperables de un tratamiento nunca son milagrosos, sino que est
n sometidos a las limitaciones de la t
cnica, los resultados son de un 90% de 
xitos, aunque existe un 10% de casos en los que por motivos no bien conocidos no se consigue la reducci
COMPRENDO que el resultado pueda no ser el esperado por m
. Reconozco que no se me ha dado en absoluto tal garant
a. Son necesarias generalmente un m
nimo de 8 sesiones para obtener resultados sastifactorios.
ME CONSTA que mis datos van a ser tratados de forma automatizada, lo cual autorizo.
Se me ha informado, igualmente, de mi derecho a rechazar o revocar este consentimiento.
He podido aclarar mis dudas acerca de todo lo anteriormente expuesto y he entendido totalmente este DOCUMENTO DE CONSENTIMIENTO reafirm
ndome en todos y cada uno de sus puntos y con la firma del documento ratifico y consiento que el tratamiento se realice.
En cumplimiento de lo establecido en la Ley Org
nica 03/2018, de 6 de Diciembre del 2018 de Protecci
a  de Derechos Digitales (LOPDGDD) le informamos que los datos personales que facilite quedar
n tratados en los ficheros de LIPOOUT, con el fin de informarle sobre nuevos servicios, productos y/o promociones.Asimismo el cliente presta su consentimiento a LIPOOUT para que, por cualquier medio de comunicaci
n, incluido el correo electr
nico o equivalente, le env
e comunicaciones comerciales o promocionales relativas a sus productos y servicios.El cliente podr
 ejercer en cualquier momento su derecho de acceso, rectificaci
n de sus datos, y revocar la autorizaci
n concedida para que LIPOOUT env
nica ofertas o comunicaciones publicitarias y promocionales, notific
ndolo mediante correo electr
nico a info@lipoout.com o por correo postal a LIPOOUT- Rda. de Outeiro, 219 - Bajo 15007 - A Coru
a, mediante solicitud escrita y firmada que contenga los siguientes datos: nombre, apellidos, domicilio a efectos de notificaciones, fotocopia del DNI o pasaporte, y petici
n en que se concreta la solicitud. A efectos informativos, se designa como responsable del fichero a Mar
a del Mar Lamas Pernas, con domicilio en la direcci
DocumentSummaryInformation$consentimiento_laser_doc$,
  'consentimiento,laser,doc',
  24,
  true,
  1,
  'consent',
  NULL,
  false,
  'tracking_depilacion',
  'estetica',
  NULL,
  'Consentimiento LASER.doc',
  '2021-07-27T16:06:00'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'consentimiento_laser_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'consentimiento_laser_fotoestimulacion_doc',
  'Depilación',
  'Consentimiento LASER fotoestimulacion',
  $consentimiento_laser_fotoestimulacion_doc$lCONSENTIMIENTO INFORMADO DE LA INFORMACI
N RECIBIDA SOBRE FOTODEPILACI
N CON LIGHT SHEER O LUZ PULSADA (IPL)
CONSENTIMIENTO INFORMADO SOBRE LA FOTODEPILACI
N CON FULL LASER SYSTEM-SHR O LUZ PULSADA (IPL)
Que por el presente documento REQUIERO Y AUTORIZO a los profesionales de LIPOOUT a que realicen en mi persona la depilaci
ser y/o luz pulsada (IPL) que a continuaci
El centro y su equipo utilizan para la depilaci
n el equipo SHR SYSTEM Y/O NORA que produce un calentamiento selectivo del fol
culo piloso que conduce a su destrucci
n sin afectar a los tejidos circundantes. Se me ha informado de que la depilaci
n completa de una zona se consigue en varias sesiones, en funci
n del tipo de pelo y de la zona corporal tratada.
Pudieran incluir: herpes simple, tratamientos m
dicos fotosensibilizantes, embarazo o lactancia, diabetes y tener un historial de cicatrices queloideas o procesos malignos, as
 como una reciente exposici
n al sol o si se planea dicha exposici
s se me ha informado de que debo comunicar al personal del centro el consumo de cualquier sustancia farmacol
gica y el cambio de mi estado basal (embarazo, enfermedad, alergia,...). Est
 desaconsejado, igualmente, en pieles muy bronceadas o que acaben de recibir rayos UVA., aumentando en estos casos el riesgo de quemadura.
El tratamiento normalmente es poco molesto y no suele presentar complicaciones, pero entiendo la posibilidad de EFECTOS SECUNDARIOS que se producen raramente, como la aparici
n de zonas de hiper o hipopigmentaci
n transitoria, quemaduras, que suelen ser transitorias, p
rpuras cicatrices y erupciones acneiformes, as
rmicos pasajeros como enrojecimiento, quemaz
n leve, moraduras temporales y decoloraci
n transitoria de la piel. Excepcionalmente puede haber una estimulaci
RIESGOS INHERENTES AL CLIENTE Y A SUS CIRCUNSTANCIAS PERSONALES:
Se me ha informado que despu
s del tratamiento es normal que la zona presente un eritema o edema normalmente ligero e incluso puede que aparezca alguna ampolla intrad
rmica, pero estos efectos, por lo general, ir
n remitiendo a las pocas horas, aunque en alg
n caso pudieran llegar a ser m
s persistentes. No obstante en un tratamiento con luz de alta intensidad nunca se debe descartar el riesgo de que en la zona tratada pudiera aparecer alguna quemadura de primer o segundo grado. Sobre todo el riesgo es mayor en las pieles oscuras o que hayan estado expuesta al sol recientemente y presenta una alta concentraci
n cambio en la pigmentaci
n) que por lo general siempre ha sido transitorio y tratado adecuadamente remite al poco tiempo.
CONFIRMO que el tratamiento mencionado, me ha sido explicado a fondo, por un profesional en palabras comprensibles para m
, los riesgos que tiene, los efectos no deseados, los riesgos caracter
sticos de mi persona, as
 como las molestias o, en ocasiones, dolores que puedo sentir teniendo una evoluci
n normal. Se me ha explicado, igualmente otras opciones de depilaci
n disponibles en el mercado, con pros y contras de cada uno de ellas. Teniendo esto en cuenta he escogido el procedimiento de DEPILACI
SER Y/O LUZ PULSADA (IPL) explicado como tratamiento no invasivo para depilaci
ME COMPROMETO a seguir fielmente, en lo mejor de mis posibilidades, las instrucciones del profesional para antes, durante y despu
s del tratamiento antes mencionado. Quedando bajo mi responsabilidad el cumplimiento de las medidas de fotoprotecci
n recomendadas por el centro Lipoout, especialmente el evitar completamente la exposici
n de las zonas tratadas al sol y a las radiaciones UVA durante un periodo de 15 d
s con Luz Pulsada y 3 antes y 3 despu
SER SHR SYSTEM, ya que de no realizarse, se favorece la aparici
n de los efectos secundarios enumerados anteriormente.
DOY FE de no haber omitido o alterado datos al exponer mi historial y antecedentes cl
rgicos, especialmente los referidos a alergias y enfermedades o riesgos personales.
AUTORIZO a que se me practiquen fotograf
as de la zona tratada, quedando entendido que su uso no constituya ninguna violaci
n a la intimidad o confidencialidad, a las que tengo derecho.
ACEPTO que el resultado cl
a en diferentes tipos de piel y con las diferentes tonalidades y localizaci
RECONOZCO que los resultados esperables de un tratamiento nunca son milagrosos, sino que est
n sometidos a las limitaciones de la t
cnica, los resultados son de un 90% de 
xitos, aunque existe un 10% de casos en los que por motivos no bien conocidos no se consigue la reducci
COMPRENDO que el resultado pueda no ser el esperado por m
. Reconozco que no se me ha dado en absoluto tal garant
a. Son necesarias generalmente un m
nimo de 8 sesiones para obtener resultados satisfactorios.
ME CONSTA que mis datos van a ser tratados de forma automatizada, lo cual autorizo.
Se me ha informado, igualmente, de mi derecho a rechazar o revocar este consentimiento.
He podido aclarar mis dudas acerca de todo lo anteriormente expuesto y he entendido totalmente este DOCUMENTO DE CONSENTIMIENTO reafirm
ndome en todos y cada uno de sus puntos y con la firma del documento ratifico y consiento que el tratamiento se realice.
nica 15/1999, de Protecci
cter Personal, sus datos ser
n incluidos en un fichero del que es responsable el Centro LIPOOUT, inscrito en el Registro de la Agencia de Protecci
La finalidad de esta recogida de datos ser
 la de mantener la relaci
n establecida entre el cliente y el Centro LIPOOUT. Vd. da, como titular de los datos, su consentimiento y autorizaci
n de los mismos en el fichero del centro LIPOOUT. En cualquier caso, podr
 ejercitar gratuitamente los derechos de acceso, rectificaci
ndose al Centro LIPOOUT, con direcci
ndolo mediante correo electr
 HYPERLINK "mailto:info@lipoout.com"
 con los siguientes datos: nombre, apellidos, domicilio a efecto de notificaciones, fotocopia DNI o pasaporte y petici
n en que concreta la solicitud. 
DocumentSummaryInformation$consentimiento_laser_fotoestimulacion_doc$,
  'consentimiento,laser,fotoestimulacion,doc',
  33,
  true,
  1,
  'consent',
  NULL,
  false,
  'tracking_depilacion',
  'estetica',
  NULL,
  'Consentimiento LASER fotoestimulacion.doc',
  '2024-03-20T17:44:23'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'consentimiento_laser_fotoestimulacion_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'consentimiento_lesiones_vasculares_electrocoagulacion_fotoesclerosis_pdf',
  'Tratamiento estético',
  'CONSENTIMIENTO Lesiones-Vasculares-Electrocoagulacion-Fotoesclerosis',
  $consentimiento_lesiones_vasculares_electrocoagulacion_fotoesclerosis_pdf$DOCUMENTO INFORMATIVO 
Y CONFORMIDAD 
 
 
DOCUMENTO DE CONSENTIMIENTO INFORMADO PARA TRATAMIENTO DE LESIONES 
VASCULARES CON ELECTROCOAGULACIÓN, LÁSER O IPL / FOTOESCLEROSIS 
 
 
En cumplimiento de la Ley 41/2002, básica reguladora de la autonomía del paciente y de 
derechos y obligaciones en materia de información y documentación clínica (BOE 15 -11-02), le 
ofrecemos por escrito y de manera comprensible, información sobre ELECTROCOAGULACIÓN Y 
FOTOESCLEROSIS. No obstante , dicha información le ha sido ya sucintamente facilitada de 
forma oral por el médico que suscribe, que asimismo y a requerimiento de Vd. ha ido 
contestando a todas las preguntas objeto de su interés y relacionadas con el tratamiento. El 
presente documento no es sino la trascripción gráfica de dicha información, a fin de facilitar su 
comprensión y motivar una autorización reflexiva y pausada. 
Es importante que lea esta información de forma clara y completa. Por favor firme o ponga sus 
iniciales en cada página para indicar así que la ha leído y firme el documento de consentimiento 
para el procedimiento propuesto por su médico. 
En _______________________, a ____ de ________________________________ de _______  
Nombre del paciente ___________________________________________________________  
Fecha de nacimiento ____________________________ DNI____________________________  
Domicilio __ ___________________________________________________________________ 
Población _____________________________________________________________________ 
Teléfonos _____________________________________________________________________ 
DECLARO: 
Que por el presente documento REQUIERO Y AUTORIZO al Doctor/a ____________________ _ 
____________________________, licenciado/graduado en Medicina y ___________________ 
con el número de colegiado ____________________ que realice en mi persona, el tratamiento 
conocido como  TRATAMIENTO CON ELECTROCOAGULACIÓN,  LÁSER O IPL DE LESIONES 
VASCULARES o FOTOESCLEROSIS, por ser éste el escogido por m í  frente a las alternativas 
_____________________________________________________________________________ 
CONOZCO y ACEPTO la capacitación profesional del facultativo para realizar este tratamiento 
Las sustancias y aparatos empleados han sido autorizados para su uso en medicina estética y 
ostenta la marca CE y número de registro sanitario correspondiente  
CONFIRMO que el tratamiento mencionado, me ha sido explicado a fondo, por el facultativo en 
palabras comprensibles para mí, los riesgos típicos que tiene, los efectos no deseados, los 
riesgos característicos a mi persona, así como las molestias o, en ocasiones, dolores que puedo 
sentir teniendo un post -tratamiento normal. Se me han explicado, igualmente otras opciones 
existentes que están disponibles en el mercado, con pros y contras de cada una de ellas. 
Teniendo esto en cuenta he escogido el tratamiento anteriormente descrito. 
También se me ha informado, en términos de probabilidades, de los resultados del 
procedimiento según referencias de la literatura científica contrastada y de la experiencia previa 
del profesional en la realización de estos procedimientos. 
BREVE EXPLICACION DEL TRATAMIENTO: 
El tratamiento consiste en la utilización terapéutica de sistemas de radiofrecuencia o luz, para 
la mejora, reducció n y eliminación de lesiones vasculares tales como puntos rubí, arañas y 
manchas vasculares de nacimiento. También es un tratamiento eficaz para inesteticismos 
faciales como las rojeces de la cara (cuperosis), pequeñas arañas en mejillas y dorso de la nariz 
(telangiectasias), e incluso problemas dermatológicos más complejos como la rosácea.  
¿En qué consiste el tratamiento? 
La tecnología a aplicar consiste en la utilización  de un sistema energético de tres  tipos 
diferentes, radiofrecuencia, luz pulsada intensa y láser de Nd:YAG, diodo, entre otros. 
La liberación controlada de energía produce una lesión limitada a la luz de los vasos sanguíneos 
o de la lesión vascular sin dañar los tejidos adyacentes, consiguiéndose de esta manera la 
oclusión y posterior desaparición del vaso. 
La respuesta terapéutica, dependerá  del color y calibre de la lesión, y por su mecanismo de acción 
los resultados no se aprecian de forma inmediata, consiguiéndose un aclaramiento paulatino de 
las mismas de manera que suelen ser precisas varias sesiones p ara alcanzar los objetivos 
deseables, siendo en ocasiones difícil, en función del tipo de lesión, el aclaramiento total. 
Contraindicaciones 
• Embarazo 
• Fármacos fotosensibilizantes 
• Fármacos anticoagulantes 
• Exposición reciente al sol o lámparas de rayos UVA 
Para la buena conclusión de la intervención realizada, es conveniente seguir las precauciones 
siguientes: 
No tomar el sol ni radiaciones ultravioleta (UVA) durante un mes antes del tratamiento, durante 
el tiempo que se está realizando éste , así como dos meses después de la última sesión del 
tratamiento. Debe usar un fotoprotector de factor de protección alto que se le prescribirá en la 
consulta. 
No aplicar tratamientos agresivos, irritantes o pigmentados (como cremas o lociones 
autobronceadoras, peelings, etc.) en la zona que se va a tratar los 10 días previos al tratamiento. 
No deben usarse cosméticos grasos o pigmentados en los primeros días tras el tratamiento. 
Durante las 48 horas anteriores al tratamiento y durante los 3 días siguientes al mismo NO 
deberá tomar ácido acetilsalicílico (aspirina) ni ningún derivado del mismo. 
Si está tomando medicación deberá comunicarlo a su terapeuta. 
En todos los casos, se le protegerá la vista con gafas especiales mien tras se realiza el 
tratamiento. 
Efectos secundarios y complicaciones 
La electrocoagulación y  fotoesclerosis vascular son procedimientos de tipo ambulatorio, no 
incapacitantes desde el punto de vista social o laboral, y que puede n repetirse tantas veces 
como sea necesario . No obstante pueden aparecer efectos secundarios y complicaciones, 
generalmente leves, como las citadas a continuación: 
• Los efectos secundarios más frecuentes están ligados a la reacción inflamatoria del área 
tratada, con hinchazón y enr ojecimiento pasajero de la piel, hematomas,  vesículas, 
ampollas, púrpura intensa que puede durar hasta 15 días, infecciones, hemorragias, 
costras. 
• En casos excepcionales, y por una predisposición del paciente, pueden aparecer cambios 
en la pigmentación de la piel que pueden demorar semanas en desaparecer, igualmente 
podrían acontecer casos de cicatrización anómala de la zona tratada. 
Normas para después del tratamiento 
• Evitar el ejercicio físico intenso 24 horas después. 
• Evitar baños calientes durante las 24 horas posteriores (se recomienda ducha rápida). 
• En caso de sensación de quemazón pueden aplicarse compresas frías. 
• Deberá evitarse la exposición al sol, durante dos semanas después de realizado el 
tratamiento. Igualmente deberá hacerse uso de fotoprotección solar para prevenir la 
aparición de posibles efectos secundarios o complicaciones. 
En todo momento mientras se me aplique el láser deberé usar la protección ocular adecuada. 
He sido correctamente informado, incluso por escrito (documentos de información) y/o 
mediante imágenes, de las características de este tratamiento: de sus fundamentos, de la forma 
y detalles de su realización, de sus mecanismos de acción, de sus efectos inmediatos, del proceso 
y evolución que seguiré en los siguientes días, semanas o meses, de los tratamientos 
complementarios necesarios, de las atenciones y precauciones que debo adoptar en l las 
próximas horas o días,  de la variabilidad en el tiempo necesari o para el completo 
restablecimiento; aceptando, por lo tanto, que no se me puede asegurar la fecha en que podré 
reincorporarme a mis actividades habituales (afectivas, sociales, laborales y deportivas). 
DOY FE de no haber omitido o alterado datos al exponer mi historial y antecedentes clínico 
quirúrgicos, especialmente los referidos a alergias y enfermedades o riesgos personales. 
La Historia Clínica y el resultado de las pruebas que se han efectuado al paciente no 
desaconsejan practicar el procedimiento médico indicado, al no aparecer, a priori, riesgos que 
puedan ser determinantes del fracaso de la técnica objetivamente considerada y que pretende 
el cumplimiento de sus expectativas. 
RECONOZCO que en el curso del tratamiento pueden surgir condiciones no previstas que hagan 
necesario un cambio de lo anteriormente planeado y doy aquí mi expresa autorización para el 
tratamiento de las mismas, incluyendo, traslado a centro hospitalario. En  caso de 
complicaciones durante el tratamiento autorizo al Centro a solicitar la necesaria ayuda de otros 
especialistas, según su mejor juicio profesional. 
SE ME HA INFORMADO que el número de sesiones necesarias (en este caso suele ser una)  para 
conseguir el efecto deseado se me ha comunicado de forma orientativa, siendo imposible de 
antemano conocer la cantidad exacta del número de sesiones que son necesarias, por la 
diferente forma de absorción/reacción de cada paciente. Los resultados se obtienen con mayor 
efectividad si el tratamiento realizado se complementa con otros tratamientos que potenciarán 
sus efectos. 
He sido informado de la necesidad de que, si durante el tratamiento se produjese una punción 
accidental del personal sanitario con mi sangre, de acuerdo con la buena praxis médica, se 
realicen las determinaciones analíticas procedentes en mi sangre, en lo relativo a posibles 
patologías de transmisión hemática, para la adopción de las medidas profilácticas más 
adecuadas. 
ME COMPROMETO a seguir fielmente, en lo mejor de mis posibilidades, las instrucciones del 
médico para antes, durante y después del tratamiento antes mencionado. Quedando bajo mi 
responsabilidad el cumplimiento de las medidas pos-tratamiento recomendadas por el Centro, 
así como acudir a las visitas de control indicadas por el médico.  
COMPRENDO que el fin del tratamiento es mejorar mi apariencia existiendo la posibilidad de 
que alguna imperfección persista y que el resultado pueda no ser el esperado por mí. En este 
sentido, se me informa que el resultado estético del tratamiento depende  de factores como la 
facilidad de cicatrización, formación o no de queloides . Sé que la medicina no es una ciencia 
exacta y que nadie puede garantizar la perfección absoluta. Comprendo que el resultado pueda 
no ser el esperado por mí y reconozco que no se me ha dado, en absoluto, tal garantía. 
El acto médico podría no agotarse en sí mismo y podría ser necesaria una actuación terapéutica 
posterior para lograr el objetivo por el que se está consintiendo. 
El coste del tratamiento incluye diversos cargos por los servicios prestados. El total incluye los 
honorarios de su médico, el costo de los materiales, equipo o producto. Los cargos cobrados por 
este procedimiento no incluyen los costos futuros potenciales para lo s procedimientos 
adicionales que usted elija o requiera a fin de revisar, optimizar o completar su resultado. Puede 
haber costos adicionales en caso de que surjan complicaciones debido al tratamiento. Los cargos 
por tratamientos secundarios relacionados con las revisiones y que no hayan sido previamente 
pactados también serán su responsabilidad. Al firmar el consentimiento para este 
procedimiento, usted reconoce que ha sido informado acerca de sus riesgos y consecuencias y 
acepta la responsabilidad de las decisiones clínicas que se tomaron junto con los costos 
económicos de todos los tratamientos futuros. 
AUTORIZO la obtención de fotografías y vídeos para una correcta valoración diagnóstica y para 
el control de la evaluación y de los resultados. Asimismo, autorizo a que se me practiquen 
fotografías de la zona tratada que puedan ser utilizadas con fines científicos, docentes o 
médicos, quedando entendido que su uso no constituya ninguna violación a la intimidad o 
confidencialidad, a las que tengo derecho. 
Los datos de carácter personal serán tratados por LA CLÍNICA para el estudio y posterior 
prestación de los servicios solicitados; y en consecuencia, para la gestión administrativa y 
económica del paciente. Finalidad basada en el consentimiento expreso pres tado por usted al 
inicio de su relación con LA CLÍNICA. Los datos personales no se cederán a terceros salvo en los 
casos que exista una obligación legal o/y contractual y se conservarán durante el tiempo 
necesario para determinar las posibles responsabilidades legales que se pudieran derivar; y en 
todo caso, su historial clínico, como mínimo durante un plazo de cinco años contados desde la 
fecha del alta del último proceso asistencial. Puede ejercitar sus derechos de acceso, 
rectificación, supresión y portabilidad de sus datos, de limitación y oposición a su tratamiento, 
así como a no ser objeto de decisiones basadas únicamente en el tratamiento automatizado de 
sus datos ante LA CLÍNICA en cualquier momento. 
Sé que la firma y otorgamiento de este consentimiento no supone ningún tipo de renuncia a 
reclamaciones futuras tanto de orden médico como legal. Sé también que puedo desdecirme de 
la firma de este consentimiento en cualquier momento previo a la realización del tratamiento. 
He podido aclarar todas mis dudas acerca de todo lo anteriormente expuesto y he entendido 
totalmente este DOCUMENTO DE CONSENTIMIENTO reafirmándome en todas y cada uno de sus 
puntos y con la firma del documento ratifico y consiento que el tratamiento se realice.  
Fecha y lugar  
El médico Firma del paciente Representante legal 
 
 
 
Igualmente he sido informado, y me doy plenamente por enterado, de que el presente 
consentimiento podrá ser revocado por el abajo firmante en cualquier momento, así como que, 
en su caso, dicha revocación deberá hacerse por escrito, habiendo, además, recibido amplia 
información de las consecuencias de mi decisión. 
El médico Firma del paciente Representante legal$consentimiento_lesiones_vasculares_electrocoagulacion_fotoesclerosis_pdf$,
  'consentimiento,lesiones,vasculares,electrocoagulacion,fotoesclerosis,pdf',
  41,
  true,
  1,
  'consent',
  NULL,
  false,
  'tracking_aesthetic',
  'estetica',
  NULL,
  'CONSENTIMIENTO Lesiones-Vasculares-Electrocoagulacion-Fotoesclerosis.pdf',
  '2025-11-28T10:48:21'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'consentimiento_lesiones_vasculares_electrocoagulacion_fotoesclerosis_pdf'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'consentimiento_lpg_corporal_doc',
  'Tratamiento estético',
  'Consentimiento LPG CORPORAL',
  $consentimiento_lpg_corporal_doc$ndose en los principios fisiol
gicos, reduce la retenci
quidos, favoreciendo el funcionamiento de los sistemas venoso y linf
tico. Se favorece una remodelaci
n del cuerpo y una reducci
n de volumen corporal, as
. Hay que indicar que, a diferencia de la Liposucci
n, este tratamiento no elimina definitivamente las sobrecargas de grasa localizada, pero si mejora visiblemente las alteraciones del contorno; por tanto, no se trata de un tra
DocumentSummaryInformation$consentimiento_lpg_corporal_doc$,
  'consentimiento,lpg,corporal,doc,endermologie',
  10,
  true,
  1,
  'consent',
  NULL,
  true,
  'tracking_aesthetic',
  'estetica',
  '{"male": "/clinical/medidas-hombre.jpg", "female": "/clinical/medidas-mujer.docx"}'::jsonb,
  'Consentimiento LPG CORPORAL.doc',
  '2018-01-04T12:49:18'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'consentimiento_lpg_corporal_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'consentimiento_lpg_facial_doc',
  'Tratamiento estético',
  'Consentimiento LPG FACIAL',
  $consentimiento_lpg_facial_doc$Consentimiento LPG FACIAL

[Documento importado desde Consentimiento LPG FACIAL.doc. Revise el contenido en Configuración → Consentimientos si la extracción automática fue incompleta.]$consentimiento_lpg_facial_doc$,
  'consentimiento,lpg,facial,doc,endermologie',
  9,
  true,
  1,
  'consent',
  NULL,
  true,
  'tracking_aesthetic',
  'estetica',
  '{"male": "/clinical/medidas-hombre.jpg", "female": "/clinical/medidas-mujer.docx"}'::jsonb,
  'Consentimiento LPG FACIAL.doc',
  '2016-09-05T20:10:08'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'consentimiento_lpg_facial_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'consentimiento_microneedling_rtf',
  'Tratamiento estético',
  'CONSENTIMIENTO MICRONEEDLING',
  $consentimiento_microneedling_rtf$CONSENTIMIENTO INFORMADO TRATAMIENTO MICRONEEDLING

El microneedling es un procedimiento estético que implica la realización de punturas en la piel con un dispositivo dotado de microagujas estériles con la intención de favorecer la penetración de sustancias activas con efecto en la piel.

CONFIRMO  que se me ha explicado a fondo y en palabras comprensibles los riesgos típicos que tiene, efectos no deseados, así como las molestias que en ocasiones puedo sentir.
ACEPTO que puedan ocurrir RIESGOS Y COMPLICACIONES inherentes a este tratamiento como son:
aparición de hematomas, rojeces, inflamación, alergia , decoloración, etc , todos ellos de carácter TRANSITORIO y que remiten poco a poco sin necesidad de ser tratados generalmente.

CONTRAINDICACIONES:
Embarazo, lactancia, enfermedades cutáneas activas, infecciones localizadas,  algunos tratamientos faciales previos(menos de 6 meses)

PRECAUCIONES:
No tomar aspirina o derivados la semana anterior al tratamiento, no gimnasio, saunas o piscina hasta tres días después del tratamiento. No se aconseja tomar el sol o rayos UVA ni maquillarse los días posteriores.

Se me informa que el fin del tratamiento es mejorar la apariencia de la piel existiendo la posibilidad de que alguna imperfección persista y que el resultado depende también de factores individuales.

ME COMPROMETO a seguir las instrucciones del profesional antes, durante y después del tratamiento mencionado, asi mismo, DOY FE de no haber omitido o alterado datos al responder al cuestionario inicial.

Declaración del paciente:

Con el presente afirmo, que he contestado a todas las preguntas sinceramente según mi leal entender y saber.
Si hay alguna variación o cambio en mi estado, informaré inmediatamente al centro.
Declaro que el tratamiento que se me aplicará es por riesgo propio.
En cumplimiento de lo establecido en la Ley Orgánica 03/2018, de 6 de Diciembre del 2018 de Protección de Datos  y garantía  de Derechos Digitales (LOPDGDD) le informamos que los datos personales que facilite quedarán incorporados y serán tratados en los ficheros de LIPOOUT, con el fin de informarle sobre nuevos servicios, productos y/o promociones.Asimismo el cliente presta su consentimiento a LIPOOUT para que, por cualquier medio de comunicación, incluido el correo electrónico o equivalente, le envíe comunicaciones comerciales o promocionales relativas a sus productos y servicios.El cliente podrá ejercer en cualquier momento su derecho de acceso, rectificación, cancelación y oposición de sus datos, y revocar la autorización concedida para que LIPOOUT envíe por vía electrónica ofertas o comunicaciones publicitarias y promocionales, notificándolo mediante correo electrónico a info@lipoout.com o por correo postal a LIPOOUT- Rda. de Outeiro, 219 - Bajo 15007 - A Coruña, mediante solicitud escrita y firmada que contenga los siguientes datos: nombre, apellidos, domicilio a efectos de notificaciones, fotocopia del DNI o pasaporte, y petición en que se concreta la solicitud. A efectos informativos, se designa como responsable del fichero a María del Mar Lamas Pernas, con domicilio en la dirección antes indicada.

Nombre y apellidos: …………………………………………………………………………………………………………DNI:…………………………………………….…

En Coruña a……………………….de ………………………………….. del 20……….

Fdo: El interesado/ representante legal:$consentimiento_microneedling_rtf$,
  'consentimiento,microneedling,rtf',
  27,
  true,
  1,
  'consent',
  NULL,
  false,
  'tracking_aesthetic',
  'estetica',
  NULL,
  'CONSENTIMIENTO MICRONEEDLING.rtf',
  '2021-09-22T21:36:02'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'consentimiento_microneedling_rtf'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'consentimiento_peeling_quimico_doc',
  'Tratamiento estético',
  'consentimiento peeling químico',
  $consentimiento_peeling_quimico_doc$CONSENTIMIENTO INFORMADO PEELING QU
MICO SUPERFICIAL Y MEDIO
El personal especializado de LIPOOUT  ha explicado a Don/d
que me han explicado que es conveniente proceder seg
n a recibir TRATAMIENTO MEDIANTE PEELING QUIMICO SUPERFICIAL MEDIO.
cnica es eliminar las capas m
s superficicales de la piel.
2.El tratamiento consiste en eliminar las capas m
s superficiales de la piel mediante la aplicaci
mico, lo que se obitne produciendo unaligera descamaci
n y consecuente reepitelizaci
ndose diversos peelings qu
n el criterio de la profesional (
 indicada en cicatrices superficiales, pigmentaciones, arrugas y cualquier proceso que afecte a la epidermis. La profesional me ha explicado que para obtener mejores resultados puede ser coveniente repetir el tratamiento.
4. Comprendo que  a pesar de la adecuada elecci
n pueden presentarse efectos secundarios, como ardor,escozor, rojez, descamaci
n leve, erupciones acneiformes, hiper o hipopigmentaciones.
La profesional me ha advertido que no puedo exponerme al sol despu
n, siendo obligatorio usar la protecci
n solar de mesoestetic pautada como me indique la profesional inclusive ante cualquier fuente lum
nica que sea de manera continua tales como ordeandores, m
Es importante que la profesional conozca mis antecedentes personales de posible alergias a medicacmentos, medicaciones actuales, antecedentes de herpes o antecedentes personales o familiares de queloides.
adidos teniendo en cuenta mis ciscunstancias personales  son
He comprendido las explicaciones que se me han facilitado claramente y que el profesional me ha aclarado todas las dudas que le he planteado.
en puedo revocar en cualquier momento y sin necesidad de dar explicacines el consentimiento que ahora presto.
Estoy satisfecho/a con la informaci
n recibida y que comprendo el alcance y los riesgos del tratamiento, confirmando asi mismo que la informaci
n facilitada es verdadera y correcta,aceptando la informaci
Eximo al personal aplicador,al centro y al fabricante del producto de reclamaciones posibles.
Que se me realice el TRATAMIENTO MEDIANTE PEELING QU
Fdo: La profesional                          Fdo:El/la paciente                                           Fdo:El representante
DocumentSummaryInformation$consentimiento_peeling_quimico_doc$,
  'consentimiento,peeling,químico,doc',
  14,
  true,
  1,
  'consent',
  NULL,
  false,
  'tracking_aesthetic',
  'estetica',
  NULL,
  'consentimiento peeling químico .doc',
  '2019-01-30T16:03:40'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'consentimiento_peeling_quimico_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'consentimiento_presoterapia_doc',
  'Tratamiento estético',
  'Consentimiento PRESOTERAPIA',
  $consentimiento_presoterapia_doc$CONSENTIMIENTO INFORMADO PRESOTERAPIA
Este documento ha sido preparado para informarle sobre la t
cnica de PRESOTERAPIA , su forma de aplicaci
n y sus posibles riesgos.
Es importante que lea esta informaci
n de forma cuidadosa y completa, comprendiendo su significado o preguntando en caso de duda, y finalmente firme el consentimiento informado.
n oral y escrita por parte del centro Lipoout.
utico utilizado para el drenaje , reducci
n de los edemas venosos y linf
ticos, produciendo una activaci
n de retorno, tanto venosa como linf
tica, estimulando la reabsorci
quidos intersticiales y el drenaje de estos l
quidos hacia los filtros org
Se trata de un equipo basado en un compresor, que introduce aire en unas botas y cintura neum
ticas, en los que se introduce el cuerpo a tratar, y que se inflan los compartimentos de manera separada, ejerciendo as
 una serie de presiones sincronizadas con un sentido centr
peto que es el encargado de realizar el drenaje de la zona.
INDICACIONES DE LA PRESOTERAPIA 
n de retorno venosa y linf
-Mantenimiento de la normal circulaci
n de varices: pesadez de piernas, edema, retenci
CONTRAINDICACIONES DE LA PRESOTERAPIA
Se considera un procedimiento seguro con m
nimos efectos secundarios, pero como cualquier procedimiento puede entra
ar un cierto grado de riesgo y es importante que usted comprenda los riesgos asociados a esta t
n individual de someterse a un tratamiento se basa en la comparaci
n del riesgo con el beneficio potencial. Aunque en la mayor
a de personas tratadas no se presentan estas complicaciones, usted deber
a comentar cada una de ellas con la persona que le propone realizar el tratamiento  para mejorar su comprensi
-Tromboflebits o flebotrombosis recientes.
-Varices importantes, tortuosas.
-Trastornos importantes de la tensi
aca/respiratora/renal importante.
Que se me realice el tratamiento de PRESOTERAPIA
Entiendo que este consentimiento puede ser revocado por mi en cualquier momento antes de la realizaci
Fdo: El/ La beneficiario del tratamiento:
DocumentSummaryInformation$consentimiento_presoterapia_doc$,
  'consentimiento,presoterapia,doc',
  32,
  true,
  1,
  'consent',
  NULL,
  false,
  'tracking_aesthetic',
  'estetica',
  NULL,
  'Consentimiento PRESOTERAPIA.doc',
  '2023-06-12T13:07:54'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'consentimiento_presoterapia_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'consentimientotoxina_pdf',
  'Medicina estética',
  'ConsentimientoTOXINA',
  $consentimientotoxina_pdf$DOCUMENTO INFORMATIVO 
Y CONFORMIDAD 
 
 
DOCUMENTO DE CONSENTIMIENTO INFORMADO 
PARA TRATAMIENTO CON TOXINA BOTULÍNICA 
 
En cumplimiento de la Ley 41/2002, básica reguladora de la autonomía del paciente y de 
derechos y obligaciones en materia de información y documentación clínica (BOE 15 -11-02), le 
ofrecemos por escrito y de manera comprensible, información sobre TRATAMIENTO CON 
TOXINA BOTULÍNICA. No obstante, dicha información le ha sido ya sucintamente facilitada de 
forma oral por el médico que suscribe, que asimismo y a requerimiento de Vd. ha ido 
contestando a todas las preguntas objeto de su interés y relacionadas con el tratamiento. El 
presente documento no es sino la trascripción gráfica de dicha información, a fin de facilitar su 
comprensión y motivar una autorización reflexiva y pausada. 
Es importante que lea esta información de forma clara y completa. Por favor firme o ponga sus 
iniciales en cada página para indicar así que la ha leído y firme el documento de 
consentimiento para el procedimiento propuesto por su médico. 
En _______________________, a ____ de  ________________________________ de _______  
Nombre del paciente ___________________________________________________________  
Fecha de nacimiento ____________________________ DNI____________________________  
Domicilio _____________________________________________________________________  
Población _____________________________________________________________________ 
Teléfonos _____________________________________________________________________ 
 
DECLARO: 
Que por el presente documento REQUIERO Y AUTORIZO al Doctor/a ____________________ _ 
____________________________, licenciado/graduado en Medicina y ___________________ 
con el número de colegiado _______ ____________________ que realice en mi persona , el 
tratamiento conocido como TOXINA BOTULÍNICA PARA ELIMINACIÓN DE ARRUGAS ,  
marca___________________________________ lote _________________________ por ser 
éste el escogido por mí frente a ___________________________________________________ 
CONOZCO y ACEPTO la capacitación profesional del facultativo para realizar este tratamiento. 
Las sustancias y aparatos empleados han sido autorizados para su uso en medicina estética y 
ostenta la marca CE y número de registro sanitario correspondiente. 
CONFIRMO que el tratamiento mencionado, me ha sido explicado a fondo, por el facultativo 
en palabras comprensibles para mí, los riesgos típicos que tiene, los efectos no deseados, los 
riesgos característicos a mi persona, así como las molestias o, en ocasiones, dolores que puedo 
sentir teniendo un post -tratamiento normal. Se me han explicado, igualmente otras opciones 
existentes que están disponibles en el mercado, con pros y contras de cada una de ellas. 
Teniendo esto en cuenta he escogido el tratamiento anteriormente descrito. 
También se me ha informado, en términos de probabilidades, de los resultados del 
procedimiento según referencias de la literatura científica contrastada y de la experiencia 
previa del profesional en la realización de estos procedimientos. 
BREVE EXPLICACION DEL TRATAMIENTO: 
La inyección de toxina botulínica tipo A causa la parálisis o reducción selectiva y temporal de la 
contracción en la musculatura en la que se ha inyectado , durante un periodo mínimo de 12 
semanas, mediante el bloqueo de  las terminaciones nerviosas colinérgicas periféricas. Su 
aplicación en medicina estética es para relajar las arrugas del entrecejo y periorbiculares (patas 
de gallo). La mejoría de las mismas no suele ser inmediata sino que se produce de forma 
paulatina durante la semana posterior al tratamiento, por lo que h abitualmente se realiza una 
revisión a las 2 semanas del tratamiento inicial para corregir las irregularidades que hayan 
podido quedar, tras lo cual no es conveniente la reinyección hasta pasadas como mínimo 12 
semanas, debido a que las reinyecciones repetidas y demasiado frecuentes podrían inducir la 
formación de anticuerpos anti -toxina, lo que podría crear resistencia al tratamiento, lo que 
disminuiría la efectividad de posteriores tratamientos con toxina botulínica tipo A incluso para 
otras indicaciones no estéticas (oftalmológicas, neurológicas,  etc.). El máximo efecto suele ser  
a las 5 o 6 semanas de la inyección.  
Como todo medicamento, el médico debe decidir la dosificación del mismo , que lo hará de 
forma personalizada, sin sobrepasar las dosis máximas indicadas. Todas las marcas de toxina 
autorizadas en España se presentan en forma liofilizada por lo que el médico debe reconstituir 
la solución con suero fitológico estéril de acuerdo con las indicaciones de cada fabricante y 
dosificar según el mismo.   
CONTRAINDICACIONES: Alergia a la toxina botulínica tipo A o a cualquiera de los excipientes 
del medicamento. Miastenia gravis o Síndrome de Eaton Lambert (enfermedades que afectan 
a la musculatura). Antecedentes de disfagia o deglución (tragar) y en general de alteraciones 
de la movilidad muscular  (ELA, EM) deben ser valoradas previamente la relación 
riesgo/beneficio por el médico responsable . Infección o inflamación en la zona.  No se 
recomienda la toma concomitante de antibióticos aminoglucósidos, espectinomicina o 
medicamentos que puedan interferir en la transmisión neuromuscular.  Menores de 18 años, 
mujeres embarazadas, o en edad fértil que no tomen medidas anticonceptivas, ni lactantes.   
ACEPTO que puedan ocurrir los RIESGOS Y COMPLICACIONES descritos por la ciencia médica 
como inherentes a  este tratamiento, lo cual suele presentarse en un 25%. Entre otros los 
principales EFECTOS SECUNDARIOS que me han sido explicados son los siguientes: 
• Muy frecuentes (más de un 10%): dolor, hematomas, eritema, edemas o inflamación 
(incluso de los p árpados) en la zona inyectada, que remitirán generalmente en poco 
tiempo sin necesidad de ser tratados. 
• Frecuentes (entre 1-10%):  
o Dolor de cabeza. 
o Náuseas. 
o Cambios en la sensibilidad cutánea (entumecimiento, tirantez). Serían temporales 
resolviéndose espontáneamente a los pocos días. 
o Debilidad muscular localizada. 
o Ptosis palpebral. Caída de cejas, son transitorias, pero pueden requerir de 
tratamiento específico. 
o Asimetría. Puede no conseguirse un aspecto simétrico de la zona tratada tras un 
único tratamiento con toxina botulínica, por lo que pueden ser necesarios 
tratamientos adicionales. 
o Resultado insuficiente: Pueden ser necesarios varios tratamientos con toxina 
botulínica, seriados y separados en el tiempo adecuado para obtener el resultado 
estético deseado. 
• Poco frecuentes (entre 1% y 1‰):  
o Infección. La infección después de este tipo de tratamiento es muy rara. Si ocurre 
una infección puede ser necesario tratamiento adicional incluyendo antibióticos. 
o Reacciones alérgicas. Se han descrito reacciones de eritema generalizado o local, 
picores, de tipo transitorio, que pueden durar unos días. Las reacciones alérgicas 
pueden requerir tratamiento adicional. 
o Reacciones adversas posiblemente relacionadas con la diseminación a distancia de 
la toxina lejos del sitio de inyección, como por ejemplo debilidad muscular, 
dificultad para tragar, estreñimiento o neumonía provocada por la presencia de 
comida o líquidos no deseados en las vías respiratorias, que puede ser mortal. Es 
por esto que no se recomienda aplicar toxina en pacientes con antecedentes de 
disfagia y deglución o en zonas situadas cerca de la musculatura implicada en estas 
funciones. 
o Alteraciones visuales transitorias (podrían ser un problema para conduci r) que 
remiten en horas o días. 
o Otros transitorios: malestar, mareos, vértigos, estrabismo, diminución de la 
audición, dolor abdominal, desmayos, etc. 
He sido correctamente informado, incluso por escrito (documentos de información) y/o 
mediante imágenes, de las características de este tratamiento: de sus fundamentos, de la 
forma y detalles de su realización, de sus mecanismos de acción, de sus efectos inmediatos, 
del proceso y evolución que seguiré en los siguientes días, semanas o meses, de los 
tratamientos complementarios  si fueran  necesarios, de las atenciones y pr ecauciones que 
debo adoptar en las próximas horas o días, de la variabilidad en el tiempo necesario para el 
completo restablecimiento; aceptando, por lo tanto, que no se me puede asegurar la fecha en 
que podré reincorporarme a mis actividades habituales (afectivas, sociales, laborales y 
deportivas). 
DOY FE de no haber omitido o alterado datos al exponer mi historial y antecedentes clínico 
quirúrgicos, especialmente los referidos a alergias y enfermedades o riesgos personales. 
La Historia Clínica y el resultado de las pruebas que se han efectuado al paciente no 
desaconsejan practicar el procedimiento médico indicado, al no aparecer, a priori, riesgos que 
puedan ser determinantes del fracaso de la técnica objetivamente considerada y que pretende 
el cumplimiento de sus expectativas. 
RECONOZCO que en el curso del tratamiento pueden surgir condiciones no previstas que 
hagan necesario un cambio de lo anteriormente planeado y doy aquí mi expresa autorización 
para el tratamiento de las mismas, incluyendo, traslado a centro hospitalario. En caso de 
complicaciones durante el tratamiento autorizo  al Centro a solicitar la necesaria ayuda de 
otros especialistas, según su mejor juicio profesional. 
SE ME HA INFORMADO que la  cantidad de medicamento que es necesario para conseguir el 
efecto deseado se me ha comunicado de forma orientativa, siendo imposible de antemano 
conocer la cantidad exacta de medicamento, por la diferente forma de absorción/reacción de 
cada paciente. Los resultados se obtienen con mayor efectividad si el tratamiento realizado se  
complementa con  las medidas post -tratamiento que se me han facilitado (y/o otros  
tratamientos que potenciarán sus efectos  (sustancia de relleno en arruga s muy profundas, 
peeling, etc.). 
He sido informado de la necesidad de que, si durante el tratamiento se produjese una punción 
accidental del personal sanitario con mi sangre, de acuerdo con la buena praxis médica, se 
realicen las determinaciones analíticas procedentes en mi sangre, en lo relativo a posibles 
patologías de transmisión hemática, para la adopción de las medidas profilácticas más 
adecuadas. 
ME COMPROMETO a seguir fielmente, en lo mejor de mis posibilidades, las instrucciones del 
médico para antes, durante y después del tratamiento antes mencionado. Quedando bajo mi 
responsabilidad el cumplimiento de las medidas pos -tratamiento recomendadas por el Centro  
(dormir boca arriba, no realizar ejercicio, etc.), así como acudir a las visitas de control indicadas 
por el médico.  
COMPRENDO que el fin del tratamiento es mejorar mi apariencia existiendo la posibilidad de 
que alguna imperfección persista y que el resultado pueda no ser el esperado por mí. En este 
sentido, se me informa que el resultado estético del tratamiento depende de factores  como la 
fuerza muscular en esa zona, la antigüedad de mis arrugas, etc.  Sé que la medicina no es una 
ciencia exacta y que nadie puede garantizar la perfección absoluta. Comprendo que el 
resultado pueda no ser el esperado por mí y reconozco que no se me ha dado, en absoluto, tal 
garantía. 
El acto médico podría no agotarse en sí mismo y podría ser necesaria una actuación 
terapéutica posterior para lograr el objetivo por el que se está consintiendo. 
El coste del tratamiento incluye diversos cargos por los servicios prestados. El total incluye los 
honorarios de su médico, el costo de los materiales, equipo o producto. Los cargos cobrados 
por este procedimiento no incluyen los costos futuros potenciales para los procedimientos 
adicionales que usted elija o requiera a fin de revisar, optimizar o completar su resultado. 
Puede haber costos adicionales en caso de que surjan complicaciones debido al tratamiento. 
Los cargos por tratamientos secundarios relacionados con las revisiones y que no hayan sido 
previamente pactados también serán su responsabilidad. Al firmar el consentimiento para este 
procedimiento, usted reconoce que ha sido informado acerca de sus riesgos y consecuencias y 
acepta la responsabilidad de las decisiones clínicas que se tomaron junto con los costos 
económicos de todos los tratamientos futuros. 
AUTORIZO la obtención de fotografías y vídeos para una correcta valoración diagnóstica y para 
el control de la evaluación y de los resultados. Asimismo, autorizo a que se me practiquen 
fotografías de la zona tratada que puedan ser utilizadas con fines científicos, docentes o 
médicos, quedando entendido que su uso no constituya ninguna violación a la intimidad o 
confidencialidad, a las que tengo derecho. 
Los datos de carácter personal serán tratados por LA CLÍNICA para el estudio y posterior 
prestación de los servicios solicitados; y en consecuencia, para la gestión administrativa y 
económica del paciente. Finalidad basada en el consentimiento expreso prestado por usted al 
inicio de su relación con LA CLÍNICA. Los datos personales no se cederán a terceros salvo en los 
casos que exista una obligación legal o/y contractual y se conservarán durante el tiempo 
necesario para determinar las posibles responsabilidades legales que se pudieran derivar; y en 
todo caso, su historial clínico, como mínimo durante un plazo de cinco años contados desde la 
fecha del alta del último proceso asistencial. Puede ejercitar sus derechos de acceso, 
rectificación, supresión y portabilidad de sus datos, de limitación y oposición a su tratamiento, 
así como a no ser objeto de decisiones basadas únicamente en el tratamiento automatizado de 
sus datos ante LA CLÍNICA en cualquier momento. 
Sé que la firma y otorgamiento de este consentimiento no supone ningún tipo de renuncia a 
reclamaciones futuras tanto de orden médico como legal. Sé también que puedo desdecirme 
de la firma de este consentimiento en cualquier momento previo a la realización del 
tratamiento. 
He podido aclarar todas mis dudas acerca de todo lo anteriormente expuesto y he entendido 
totalmente este DOCUMENTO DE CONSENTIMIENTO reafirmándome en todas y cada uno de 
sus puntos y con la firma del documento ratifico y consiento que el tratamiento se realice.  
Fecha y lugar 
El médico Firma del paciente Representante legal 
 
 
 
 
Igualmente he sido informado, y me doy plenamente por enterado, de que el presente 
consentimiento podrá ser revocado por el abajo firmante en cualquier momento, así como 
que, en su caso, dicha revocación deberá hacerse por escrito, habiendo, además, recibido 
amplia información de las consecuencias de mi decisión. 
El médico Firma del paciente Representante legal$consentimientotoxina_pdf$,
  'consentimientotoxina,pdf,medicina,medico',
  42,
  true,
  1,
  'consent',
  NULL,
  false,
  'tracking_aesthetic',
  'medicina',
  NULL,
  'ConsentimientoTOXINA.pdf',
  '2026-02-03T13:23:26'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'consentimientotoxina_pdf'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'laser_neauvia_odt',
  'Medicina estética',
  'LASER NEAUVIA',
  $laser_neauvia_odt$LASER NEAUVIA- Lo realizaremos en la cabina 2 (de cara a sanidad) no por otra cosa.-Se pueden maquillar desde el primer momento.-Tienen que estar sin sol hasta que caen las costras, después ya podría ir a la playa.-Las costras tienen que caerse solas, no se puede exfoliar.-El láser tiene una revisión anual (el primer año incluída) después hay que contratar un servicio de mantenimiento.- Tiene 50000 disparos.- Trabajamos de centro hacia exterior.-Después del tratamiento aplicamos ya en cabina la cremita calmante y le damos para casa el sobre de mascarilla para aplicar por la noche.- 2 días antes sin exposición de la zona al sol- Este láser NO QUEMA.- No hay problema en pasar por encima de lunares ni pelo, este láser no actúa en melanina.- Facial y cuello suele ir junto. El escote a parte con otro precio.- Resultados desde el primer momento.-Las sesiones son una vez al mes.-Desinfectamos la piel antes de empezar con clorexidina transparente y secamos.- Se puede hacer en cualquier época del año.-Buenos resultados en estrías rojas (blancas no)-Apto para todos los fototipos.- Entre sesiones se pueden hacer cualquier tipo de tratamiento.- Después del tratamiento se podría poner la luz led para bajar inflamación.-El cabezal se limpiar entre clientes con clorexidina y gasa.- Si están con antibiótico no se hace, con rosacea activa tampoco y con acné activo tampoco. Se trabaja en PIELES SANAS. - La emla hay que dejarla por lo menos 30 minutos para trabajar bien con osmosis.- Si están usando retinol, tienen que dejarlo 4 días antes de la sesión y 4 días después.- Si son propensas a herpes tiene que dar la Dra receta para prevención.- La aplicación de exoxomas después no está recomendada ya que no abre canales.$laser_neauvia_odt$,
  'laser,neauvia,odt,medicina,medico',
  44,
  true,
  1,
  'consent',
  NULL,
  false,
  'tracking_depilacion',
  'medicina',
  NULL,
  'LASER NEAUVIA.odt',
  '2026-03-09T15:22:13'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'laser_neauvia_odt'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'lltd_y_tfbd_1_docx',
  'Tratamiento estético',
  'LLTD Y TFBD',
  $lltd_y_tfbd_1_docx$LLTD Y TFBD

[Documento importado desde LLTD Y TFBD (1).docx. Revise el contenido en Configuración → Consentimientos si la extracción automática fue incompleta.]$lltd_y_tfbd_1_docx$,
  'lltd,tfbd,docx',
  39,
  true,
  1,
  'consent',
  NULL,
  false,
  NULL,
  'estetica',
  NULL,
  'LLTD Y TFBD (1).docx',
  '2025-10-22T17:32:33'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'lltd_y_tfbd_1_docx'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'medidas_mujer_docx',
  'Tratamiento estético',
  'medidas mujer',
  $medidas_mujer_docx$MEDIDAS
Nº DE SESIONES						0		5		10
				ESPALDA ALTA ………………
				ESPALDA BAJA ………………
				CINTURA ………………………
				CADERA  ………………………
				MUSLO ………………………..
				RODILLA ……………………..
				GEMELO …………………….$medidas_mujer_docx$,
  'medidas,mujer,docx',
  1,
  true,
  1,
  'consent',
  NULL,
  false,
  NULL,
  'estetica',
  NULL,
  'medidas mujer.docx',
  '2013-11-27T17:54:54'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'medidas_mujer_docx'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'cuestionario_corporal_doc',
  'Cuestionario / diagnóstico',
  'Cuestionario CORPORAL',
  $cuestionario_corporal_doc$.........................................
 nuestro centro? (amigo, TV, carteler
Cantidad de agua que suele beber al d
?...........................................................................................................................
Tendencia ansiedad, nerviosismo, estr
Cuidados corporales en casa
Ha realizado alguna vez alg
n tratamiento?...............................................................................................
n problema respiratorio, card
aco, epilepsia, diabetes?
l?..................................................................................
lico, implantes (marcapasos/DIU)?
l?..................................................................................
 en trat. de fertilidad, embarazada o es lactante?
l?..................................................................................
mero de embarazos?............ 
rea?..................................................
Ha padecido o padece alguna de las siguientes enfermedades:
n problema circulatorio como varices, trombosis, tromboflebitis?
l?..................................................................................
seo o muscular como hernias, protusiones, escoliosis, esclerosis, fibromialgia u osteoporosis?
l?..................................................................................
Ha tenido desprendimiento de retina o posee alguna lente intraocular?
n problema relacionado con el o
l?..................................................................................
n problema hormonal como hipotiroidismo, hipertiroidismo, ovarios poliqu
l?..................................................................................
Tiene el colesterol alto (superior a 300mg/dl)?
Tiene alguna enfermedad cut
n de la piel, alergia, irritaciones, alg
l?..................................................................................
CUESTIONARIO INFORMATIVO
 tomando actualmente alguna medicaci
 sirve?.......................................................
Ha sufrido alguna intervenci
l?..................................................................................
n, infiltraciones, etc.)
Hace cuanto?..........................................................
Con el presente afirmo, que he contestado a todas las preguntas sinceramente seg
n mi leal entender y saber.
n o cambio en mi estado, informar
 inmediatamente al centro.
Declaro que el tratamiento que se me aplicar
En cumplimiento de lo establecido en la Ley Org
nica 15/1999, de 13 de diciembre, de Protecci
cter Personal le informamos que los datos personales que facilite quedar
n tratados en los ficheros de LIPOOUT, con el fin de informarle sobre nuevos servicios, productos y/o promociones.Asimismo el cliente presta su consentimiento a LIPOOUT para que, por cualquier medio de comunicaci
n, incluido el correo electr
nico o equivalente, le env
e comunicaciones comerciales o promocionales relativas a sus productos y servicios.El cliente podr
 ejercer en cualquier momento su derecho de acceso, rectificaci
n de sus datos, y revocar la autorizaci
n concedida para que LIPOOUT env
nica ofertas o comunicaciones publicitarias y promocionales, notific
ndolo mediante correo electr
nico a info@lipoout.com o por correo postal a LIPOOUT- Rda. de Outeiro, 219 - Bajo 15007 - A Coru
a, mediante solicitud escrita y firmada que contenga los siguientes datos: nombre, apellidos, domicilio a efectos de notificaciones, fotocopia del DNI o pasaporte, y petici
n en que se concreta la solicitud. A efectos informativos, se designa como responsable del fichero a Mar
a del Mar Lamas Pernas, con domicilio en la direcci
TICO Y PLAN DE TRATAMIENTO:
DocumentSummaryInformation$cuestionario_corporal_doc$,
  'cuestionario,corporal,doc',
  15,
  true,
  1,
  'questionnaire',
  NULL,
  false,
  'tracking_aesthetic',
  'estetica',
  NULL,
  'Cuestionario CORPORAL.doc',
  '2019-03-13T18:12:28'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'cuestionario_corporal_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'cuestionario_de_seguimiento_dieta_doc',
  'Cuestionario / diagnóstico',
  'Cuestionario DE SEGUIMIENTO DIETA',
  $cuestionario_de_seguimiento_dieta_doc$Cuestionario DE SEGUIMIENTO DIETA

[Documento importado desde Cuestionario DE SEGUIMIENTO DIETA.doc. Revise el contenido en Configuración → Consentimientos si la extracción automática fue incompleta.]$cuestionario_de_seguimiento_dieta_doc$,
  'cuestionario,seguimiento,dieta,doc',
  3,
  true,
  1,
  'questionnaire',
  NULL,
  false,
  'tracking_aesthetic',
  'estetica',
  NULL,
  'Cuestionario DE SEGUIMIENTO DIETA.doc',
  '2014-08-05T19:43:16'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'cuestionario_de_seguimiento_dieta_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'cuestionario_depilacion_electrica_doc',
  'Cuestionario / diagnóstico',
  'Cuestionario DEPILACIÓN ELÉCTRICA',
  $cuestionario_depilacion_electrica_doc$HISTORIA DE LA ZONA A TRATAR
Alguna enfermedad actual:  Diabetes   Hipertensi
n arterial   Hepatitis   Reumatismos   Trastornos suprarrenales
as(marcapasos)   Problemas de coagulaci
rgicas o enfermedades padecidas:
lico, hilos de oro, marcapasos o DIU?
Enfermedades infecto contagiosas:
Problemas de cicatrizaci
 tomando alguna medicaci
es para regular hormonas o cantidad de pelo?)
Alteraciones en el ciclo:                                      Menopausia/premenopausia:
Problemas hormonales: hirsutismo, ovarios poliqu
HISTORIA DE LA ZONA A TRATAR
Pelo localizado sobre pecas o nevus?
gicas en la zona a tratar (psoriasis, infecciones, heridas,
ndo padece el problema? 
Lo relaciona con alguna posible causa?(Medicaci
n utilizados anteriormente y, 
STICO Y PLAN DE TRATAMIENTO (depender
Tipo de pelo:  Grueso      Fino                                 Densidad de pelo:
Sensibilidad al dolor o corriente:
Con el presente afirmo, que he contestado a todas las preguntas sinceramente seg
n mi leal entender y saber.
n o cambio en mi estado, informar
 inmediatamente al centro.
Declaro que el tratamiento que se me aplicar
En cumplimiento de lo establecido en la Ley Org
nica 15/1999, de 13 de diciembre, de Protecci
cter Personal le informamos que los datos personales que facilite quedar
n tratados en los ficheros de LIPOOUT, con el fin de informarle sobre nuevos servicios, productos y/o promociones.Asimismo el cliente presta su consentimiento a LIPOOUT 
para que, por cualquier medio de comunicaci
n, incluido el correo electr
nico o equivalente, le env
e comunicaciones comerciales o promocionales relativas a sus productos y servicios
 ejercer en cualquier momento su derecho de acceso, rectificaci
n de sus datos, y revocar la autorizaci
n concedida para que LIPOOUT env
nica ofertas o comunicaciones publicitarias y promocionales, notific
ndolo mediante correo electr
nico a info@lipoout.com o por correo postal a LIPOOUT- Rda. de Outeiro, 219 - Bajo 15007
a, mediante solicitud escrita y firmada que contenga los siguientes datos: nombre, apellidos, domicilio a efectos de notificaciones, fotocopia del DNI o pasaporte, y petici
 la solicitud. A efectos informativos, se designa como responsable del fichero a Mar
a del Mar Lamas Pernas, con domicilio en la direcci
         Representante legaL
       SEGUIMIENTO DEPILACI
TIPO DE AGUJA OBSERVACIONES
DocumentSummaryInformation$cuestionario_depilacion_electrica_doc$,
  'cuestionario,depilación,eléctrica,doc',
  30,
  true,
  1,
  'questionnaire',
  NULL,
  false,
  'tracking_depilacion',
  'estetica',
  NULL,
  'Cuestionario DEPILACIÓN ELÉCTRICA.doc',
  '2022-12-02T16:17:42'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'cuestionario_depilacion_electrica_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'cuestionario_dieta_doc',
  'Cuestionario / diagnóstico',
  'cuestionario DIETA',
  $cuestionario_dieta_doc$cuestionario DIETA

[Documento importado desde cuestionario DIETA.doc. Revise el contenido en Configuración → Consentimientos si la extracción automática fue incompleta.]$cuestionario_dieta_doc$,
  'cuestionario,dieta,doc',
  2,
  true,
  1,
  'questionnaire',
  NULL,
  false,
  'tracking_aesthetic',
  'estetica',
  NULL,
  'cuestionario DIETA.doc',
  '2014-06-05T12:43:54'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'cuestionario_dieta_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'cuestionario_facial_doc',
  'Cuestionario / diagnóstico',
  'Cuestionario FACIAL',
  $cuestionario_facial_doc$.........................................
 nuestro centro? (amigo, TV, carteler
Motivo de la consulta? (higiene, flacidez, arrugas, hidrataci
Tratamientos realizados anteriormente?.................................................................................................
 tal el resultado?...............................................................................................................................
..Ansiedad, nerviosismo, estr
Cuidados faciales habituales: D
aco, epilepsia o diabetes?
l?..................................................................................
nico (marcapasos) o implantes met
l?..................................................................................
 en trat. de fertilidad, embarazada o en lactancia? 
l?..................................................................................
Tiene sensibilidad o alg
l?..................................................................................
Tiene alguna lente intraocular o alg
n problema relacionado con los ojos?
l?..................................................................................
 tipo?.......................................................................
geno o alguna sustancia de relleno) o cirug
l?..................................................................................
ncer, tumor o neoplasia?
nto tiempo hace?.........................................................
CUESTIONARIO INFORMATIVO
 tomando actualmente alguna medicaci
 sirve?.......................................................
Ha sufrido alguna intervenci
l?..................................................................................
Con el presente afirmo, que he contestado a todas las preguntas sinceramente seg
n mi leal entender y saber.
n o cambio en mi estado, informar
 inmediatamente al centro.
Declaro que el tratamiento que se me aplicar
En cumplimiento de lo establecido en la Ley Org
nica 15/1999, de 13 de diciembre, de Protecci
cter Personal le informamos que los datos personales que facilite quedar
n tratados en los ficheros de LIPOOUT, con el fin de informarle sobre nuevos servicios, productos y/o promociones.Asimismo el cliente presta su consentimiento a LIPOOUT para que, por cualquier medio de comunicaci
n, incluido el correo electr
nico o equivalente, le env
e comunicaciones comerciales o promocionales relativas a sus productos y servicios.El cliente podr
 ejercer en cualquier momento su derecho de acceso, rectificaci
n de sus datos, y revocar la autorizaci
n concedida para que LIPOOUT env
nica ofertas o comunicaciones publicitarias y promocionales, notific
ndolo mediante correo electr
nico a info@lipoout.com o por correo postal a LIPOOUT- Rda. de Outeiro, 219 - Bajo 15007 - A Coru
a, mediante solicitud escrita y firmada que contenga los siguientes datos: nombre, apellidos, domicilio a efectos de notificaciones, fotocopia del DNI o pasaporte, y petici
n en que se concreta la solicitud. A efectos informativos, se designa como responsable del fichero a Mar
a del Mar Lamas Pernas, con domicilio en la direcci
Fina......Gruesa......Deshidratada en superficie......Deshidratada en profundidad......Al
Comedones...... Quistes......N
dulos......Queloides......Verrugas......Herpes......Otras
Alteraciones de la pigmentaci
Alteraciones de la queratinizaci
Alteraciones vasculares: Telangiectasias
STICO Y PLAN DE TRATAMIENTO:
...................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................
DocumentSummaryInformation$cuestionario_facial_doc$,
  'cuestionario,facial,doc',
  16,
  true,
  1,
  'questionnaire',
  NULL,
  false,
  'tracking_aesthetic',
  'estetica',
  NULL,
  'Cuestionario FACIAL.doc',
  '2019-12-20T21:07:10'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'cuestionario_facial_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'cuestionario_facial_corporal_2026_logo_docx',
  'Cuestionario / diagnóstico',
  'Cuestionario Facial-Corporal 2026 logo',
  $cuestionario_facial_corporal_2026_logo_docx$DATOS PERSONALES
Nombre y apellidos………………………………………………………..………………………………………………………………….
Dirección:……………………………………………………………………………………………………………………………………...
Teléfono:……………………………………………………Mail:…………………………………………………………………………...
Fecha de nacimiento:……………………………………..Fecha 1ª sesión……………………………………………………………...
Ocupación actual:…………………………………………………….	Situación personal actual:……….……………………………….
DATOS DE INTERÉS
Motivo de la consulta ( higiene, arrugas, manchas etc)………………………………………………………………………………….
Tratamientos realizados anteriormente y resultados ……………………………………………………………………………………. ………………………………………………………………………………………………………………………………………………….
HÁBITOS
Fuma: ¿cuánto?……………………………………………....	Alcohol………………Agua/ infusiones, cantidad………………
¿Deporte?…………………………………….	Frecuencia:…………………………………………………………………………
¿ Sol ó UVA? ………………...…………..…………………. …………...   Frecuencia:………………………..……....……………….
 ¿La última vez que se expuso al sol?......…………………Exposición luz azul……………………………………………………….
Trastornos menstruales(irregular, dolor, menopausia…)………………………………………………………………………………..
Métodos anticonceptivos ……………………………………..¿Está haciendo algún tipo de dieta?………………………………….
 ……….………………………………………………………...¿Pierde peso fácilmente? ……………………………………………….
Ansiedad/stress/nerviosismo ………………………………....Horas de sueño……………..CUIDADO DE LA PIEL:……………... DIA…………………………………………………………………………………………………………………………………………….. ………………………………………………………………………………………………………………………………………………….
NOCHE………………………………………………………………………………………………………………………………………..
POSIBLES CONTRAINDICACIONES
Embarazo:natural...  cesárea …. Lactancia…..Tratamiento fertilidad…..Signos virilización………………………………………..
¿Padece alguna enfermedad grave?.......................................………………………………………………………………………….
¿Dispositivo electrónico, metálico, implantes, marcapasos, DIU metálico?…………………………………………………………...
¿Problema circulatorio?:varices, trombosis, tromboflebitis:……………………………………………………………………………..
¿Problemas: cardíaco/epilepsia/ hígado/piedras riñón ó vesícula?¿Problemas muscular/óseo (hernias, protusiones, escoliosis, fibromialgia, osteoporosis? ¿Problemas hormonales:hipotiroidismo, hipertiroidismo, ovarios poliquísticos? ¿Enfermedad cutánea, alergia, irritaciones ,injerto, cicatriz reciente? 
¿HERNIA DE HIATO? ¿ALERGIA NIQUEL/CROMO/SALICÍLICO,OTROS?…………………………………………………………………………………………………………………………………………………..…………………………………………………………………………………………………………………………………………………
¿Toma algún tipo de medicamento? ¿Para qué?(laxantes, suplementos alimenticios)……………………………………………..………………………………………………………………………………………………………………………………………………….
¿Ha realizado algún tratamiento médico-estético ( bótox, hialurónico, colágeno, hilos ó alguna sustancia de relleno
cirugía plástica?…………………………………………………………………………………………………………………………….
¿Hace cuánto?………………………….¿Peeling químico en los últimos 6 meses?………………………………………………..
¿Intervención quirúrgica en el último año?……………………………………………………………………………………………...
DATOS TÉCNICOS DE LA PIEL
Alteración estética a mejorar………………………………………………………………………………………………………….
Desde cuando la padece (tiempo de instauración)…………………………………………………………………………………...
FOTOTIPO:   I    II   III   IV    V     VI   
OBSERVACIONES:…………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………
………………………………………………………………………………………………………………………………………………….………………………………………………………………………………………………………………………………………………….
………………………………………………………………………………………………………………………………………………….
Envejecimiento: Cronológico…. Mecánico….Fotoenvejecimiento….	
              Hipercromías por fotosensibilización    Efélides  Lentigos	 Vitíligo	
Tipo de lesión pigmentaria       Hipercromías post-cicatrices de acné      Melasma     Acromías
		 Pigmentaciones seniles		
Características de la hiperpigmentación:
Coloración:			 Amarilla		 Parda			 Violácea			 Rojiza
Contorno:			 Regular		 Irregular/difuso
Localización:		 Frente		 Mejillas			 Párpados
 Labio superior	 Mentón			 Otra zona:………………………………...
Factores relacionados con la aparición de la hiperpigmentación:
 Embarazo		 Estimulación hormonal			 Estimulación lumínica		 Genéticos
 Otros factores (medicación, alimentos, sustancias químicas, cosméticos)		Especificar:…………………………………………………………………………………………………………………………………...
Luz de Wood: melasma epidérmico...dérmico….mixto…..
Declaración del paciente:
Con el presente afirmo, que he contestado a todas las preguntas sinceramente según mi leal entender y saber.
Si hay alguna variación o cambio en mi estado, informaré inmediatamente al centro.
Declaro que el tratamiento que se me aplicará es por riesgo propio.
En cumplimiento de lo establecido en la Ley Orgánica 03/2018, de 6 de Diciembre del 2018 de Protección de Datos  y garantía  de Derechos Digitales (LOPDGDD) le informamos que los datos personales que facilite quedarán incorporados y serán tratados en los ficheros de LIPOOUT, con el fin de informarle sobre nuevos servicios, productos y/o promociones.Asimismo el cliente presta su consentimiento a LIPOOUT para que, por cualquier medio de comunicación, incluido el correo electrónico o equivalente, le envíe comunicaciones comerciales o promocionales relativas a sus productos y servicios.El cliente podrá ejercer en cualquier momento su derecho de acceso, rectificación, cancelación y oposición de sus datos, y revocar la autorización concedida para que LIPOOUT envíe por vía electrónica ofertas o comunicaciones publicitarias y promocionales, notificándolo mediante correo electrónico a info@lipoout.com o por correo postal a LIPOOUT- Rda. de Outeiro, 219 - Bajo 15007 - A Coruña, mediante solicitud escrita y firmada que contenga los siguientes datos: nombre, apellidos, domicilio a efectos de notificaciones, fotocopia del DNI o pasaporte, y petición en que se concreta la solicitud. A efectos informativos, se designa como responsable del fichero a María del Mar Lamas Pernas, con domicilio en la dirección antes indicada.
Nombre y apellidos: ……………………………………………………………………………………………………………..
DNI:…………………………………………..Edad:……………….Altura:…………………...
FIRMA:$cuestionario_facial_corporal_2026_logo_docx$,
  'cuestionario,facial,corporal,2026,logo,docx',
  50,
  true,
  1,
  'questionnaire',
  NULL,
  false,
  'tracking_aesthetic',
  'estetica',
  NULL,
  'Cuestionario Facial-Corporal 2026 logo.docx',
  '2026-06-15T17:21:06'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'cuestionario_facial_corporal_2026_logo_docx'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'cuestionario_laser_o_ipl_6_10_17_doc',
  'Cuestionario / diagnóstico',
  'Cuestionario LÁSER O IPL 6.10.17',
  $cuestionario_laser_o_ipl_6_10_17_doc$HISTORIA DE LA ZONA A TRATAR
n tipo de enfermedad: diabetes, hepatitis, cardiopat
as, problemas de coagulaci
n de la sangre (sintron),
Problemas hormonales: ginecol
gicos, menstruales, ovarios poliqu
sticos, tiroides, premenopausia, menopausia,
Enfermedades infecto contagiosas:
Problemas de cicatrizaci
 (ROACUTAM) o despigmentante (con 
 tomando alguna medicaci
es para regular hormonas o cantidad de pelo?)
n UV (sol natural o solarium):
mo reacciona tu piel tras una exposici
HISTORIA DE LA ZONA A TRATAR
n utilizados anteriormente y, 
STICO Y PLAN DE TRATAMIENTO (depender
Tipo de pelo:  Grueso      Fino                                 Densidad de pelo:
neo : I, II, III, IV, V, VI
- Marcas de quemaduras antiguas ( + de 6 meses)
- Antecedentes  o presencia de melasma
- Antecedentes o presencia de l
Con el presente afirmo, que he contestado a todas las preguntas sinceramente seg
n mi leal entender y saber.
n o cambio en mi estado, informar
 inmediatamente al centro.
Declaro que el tratamiento que se me aplicar
En cumplimiento de lo establecido en la Ley Org
nica 03/2018, de 6 de Diciembre del 2018 de Protecci
a  de Derechos Digitales (LOPDGDD) le informamos que los datos personales que facilite quedar
n tratados en los ficheros de LIPOOUT, con el fin de informarle sobre nuevos servicios, productos y/o promociones.Asimismo el cliente presta su consentimiento a LIPOOUT para que, por cualquier medio de comunicaci
n, incluido el correo electr
nico o equivalente, le env
e comunicaciones comerciales o promocionales relativas a sus productos y servicios.El cliente podr
 ejercer en cualquier momento su derecho de acceso, rectificaci
n de sus datos, y revocar la autorizaci
n concedida para que LIPOOUT env
nica ofertas o comunicaciones publicitarias y promocionales, notific
ndolo mediante correo electr
nico a info@lipoout.com o por correo postal a LIPOOUT- Rda. de Outeiro, 219 - Bajo 15007 - A Coru
a, mediante solicitud escrita y firmada que contenga los siguientes datos: nombre, apellidos, domicilio a efectos de notificaciones, fotocopia del DNI o pasaporte, y petici
n en que se concreta la solicitud. A efectos informativos, se designa como responsable del fichero a Mar
a del Mar Lamas Pernas, con domicilio en la direcci
         Representante legal
SEGUIMIENTO FOTODEPILACI
DocumentSummaryInformation$cuestionario_laser_o_ipl_6_10_17_doc$,
  'cuestionario,láser,ipl,doc',
  35,
  true,
  1,
  'questionnaire',
  NULL,
  false,
  'tracking_depilacion',
  'estetica',
  NULL,
  'Cuestionario LÁSER O IPL 6.10.17.doc',
  '2024-06-15T11:53:24'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'cuestionario_laser_o_ipl_6_10_17_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'diagn_ostico_facial_peelings_qu_imicos_doc',
  'Cuestionario / diagnóstico',
  'DIAGN+ôSTICO FACIAL PEELINGS QU+ìMICOS',
  $diagn_ostico_facial_peelings_qu_imicos_doc$DIAGN+ôSTICO FACIAL PEELINGS QU+ìMICOS

[Documento importado desde DIAGN+ôSTICO FACIAL PEELINGS QU+ìMICOS.doc. Revise el contenido en Configuración → Consentimientos si la extracción automática fue incompleta.]$diagn_ostico_facial_peelings_qu_imicos_doc$,
  'diagn,stico,facial,peelings,micos,doc',
  6,
  true,
  1,
  'questionnaire',
  NULL,
  false,
  'tracking_aesthetic',
  'estetica',
  NULL,
  'DIAGN+ôSTICO FACIAL PEELINGS QU+ìMICOS.doc',
  '2015-11-30T16:05:12'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'diagn_ostico_facial_peelings_qu_imicos_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'diagnostico_facial_tratamientos_despigmentantes_doc',
  'Cuestionario / diagnóstico',
  'DIAGNóSTICO FACIAL TRATAMIENTOS DESPIGMENTANTES',
  $diagnostico_facial_tratamientos_despigmentantes_doc$W                                                                                       
LIPOOUT                                                                                       
Motivo de la consulta ( higiene, arrugas, manchas etc)
Tratamientos realizados anteriormente y resultados 
Agua/ infusiones, cantidad
ltima vez que se expuso al sol?......
...Trastornos menstruales(irregular, dolor, menopausia...)
Ansiedad/stress/nerviosismo 
Cuidado de la piel, DIA:
POSIBLES CONTRAINDICACIONES
Embarazo:natural...  ces
..Tratamiento fertilidad
Padece alguna enfermedad?........................................
Problema respiratorio/card
aco/diabetes/dispositivo electr
?(laxantes, suplementos alimenticios)
 alguna sustancia de relle
Desde cuando la padece (tiempo de instauraci
FOTOTIPO:   I    II   III   IV    V     VI   
as por fotosensibilizaci
                        
as post-cicatrices de acn
sticas de la hiperpigmentaci
Factores relacionados con la aparici
 Otros factores (medicaci
n, alimentos, sustancias qu
Luz de Wood: melasma epid
Con el presente afirmo, que he contestado a todas las preguntas sinceramente seg
n mi leal entender y saber.
n o cambio en mi estado, informar
 inmediatamente al centro.
Declaro que el tratamiento que se me aplicar
En cumplimiento de lo establecido en la Ley Org
nica 15/1999, de 13 de diciembre, de Protecci
cter Personal le informamos que los datos personales que facilite quedar
n tratados en los ficheros de LIPOOUT, con el fin de informarle sobre nuevos servicios, productos y/o promociones.Asimismo el cliente presta su consentimiento a LIPOOUT para que, por cualquier medio de comunicaci
n, incluido el correo electr
nico o equivalente, le env
e comunicaciones comerciales o promocionales relativas a sus productos y servicios.El cliente podr
 ejercer en cualquier momento su derecho de acceso, rectificaci
n de sus datos, y revocar la autorizaci
n concedida para que LIPOOUT env
nica ofertas o comunicaciones publicitarias y promocionales, notific
ndolo mediante correo electr
nico a info@lipoout.com o por correo postal a LIPOOUT- Rda. de Outeiro, 219 - Bajo 15007 - A Coru
a, mediante solicitud escrita y firmada que contenga los siguientes datos: nombre, apellidos, domicilio a efectos de notificaciones, fotocopia del DNI o pasaporte, y petici
n en que se concreta la solicitud. A efectos informativos, se designa como responsable del fichero a Mar
a del Mar Lamas Pernas, con domicilio en la direcci
DocumentSummaryInformation$diagnostico_facial_tratamientos_despigmentantes_doc$,
  'diagnóstico,facial,tratamientos,despigmentantes,doc',
  17,
  true,
  1,
  'questionnaire',
  NULL,
  false,
  'tracking_aesthetic',
  'estetica',
  NULL,
  'DIAGNóSTICO FACIAL TRATAMIENTOS DESPIGMENTANTES.doc',
  '2019-12-20T21:07:14'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'diagnostico_facial_tratamientos_despigmentantes_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'ficha_seguimiento_de_micropigmentacion_doc',
  'Seguimiento por sesiones',
  'Ficha seguimiento de micropigmentación',
  $ficha_seguimiento_de_micropigmentacion_doc$Ficha seguimiento de micropigmentación

[Documento importado desde Ficha seguimiento de micropigmentación.doc. Revise el contenido en Configuración → Consentimientos si la extracción automática fue incompleta.]$ficha_seguimiento_de_micropigmentacion_doc$,
  'ficha,seguimiento,micropigmentación,doc',
  37,
  true,
  1,
  'tracking',
  'aesthetic',
  false,
  NULL,
  'estetica',
  NULL,
  'Ficha seguimiento de micropigmentación.doc',
  '2025-08-07T11:12:33'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'ficha_seguimiento_de_micropigmentacion_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'hoja_de_seguimiento_doc',
  'Seguimiento por sesiones',
  'HOJA DE SEGUIMIENTO',
  $hoja_de_seguimiento_doc$HOJA DE SEGUIMIENTO

[Documento importado desde HOJA DE SEGUIMIENTO.doc. Revise el contenido en Configuración → Consentimientos si la extracción automática fue incompleta.]$hoja_de_seguimiento_doc$,
  'hoja,seguimiento,doc',
  28,
  true,
  1,
  'tracking',
  'aesthetic',
  true,
  NULL,
  'estetica',
  '{"male": "/clinical/medidas-hombre.jpg", "female": "/clinical/medidas-mujer.docx"}'::jsonb,
  'HOJA DE SEGUIMIENTO.doc',
  '2022-08-18T17:22:06'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'hoja_de_seguimiento_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'tracking_depilacion',
  'Seguimiento por sesiones',
  'Seguimiento depilación (láser / IPL / eléctrica)',
  $tracking_depilacion$Plantilla de seguimiento cronológico por sesiones para depilación (láser, IPL y depilación eléctrica).

Cada sesión queda registrada en el historial del tratamiento con fecha, zona, parámetros y observaciones.$tracking_depilacion$,
  'laser,ipl,depilacion,electrica,fotodepilacion,session',
  1,
  true,
  1,
  'tracking',
  'depilacion',
  false,
  NULL,
  'estetica',
  NULL,
  'SEGUIMIENTO FOTODEPILACION.doc',
  '2026-06-16T09:47:47'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'tracking_depilacion'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'seguimiento_depilacion_eletrica_doc',
  'Seguimiento por sesiones',
  'seguimiento depilación elétrica',
  $seguimiento_depilacion_eletrica_doc$seguimiento depilación elétrica

[Documento importado desde seguimiento depilación elétrica.doc. Revise el contenido en Configuración → Consentimientos si la extracción automática fue incompleta.]$seguimiento_depilacion_eletrica_doc$,
  'seguimiento,depilación,elétrica,doc,laser,ipl,depilacion,electrica',
  20,
  true,
  1,
  'tracking',
  'depilacion',
  false,
  NULL,
  'estetica',
  NULL,
  'seguimiento depilación elétrica.doc',
  '2021-02-11T12:50:02'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'seguimiento_depilacion_eletrica_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'seguimiento_fotodepilacion_doc',
  'Seguimiento por sesiones',
  'SEGUIMIENTO FOTODEPILACIÓN',
  $seguimiento_fotodepilacion_doc$SEGUIMIENTO FOTODEPILACIÓN

[Documento importado desde SEGUIMIENTO FOTODEPILACIÓN.doc. Revise el contenido en Configuración → Consentimientos si la extracción automática fue incompleta.]$seguimiento_fotodepilacion_doc$,
  'seguimiento,fotodepilación,doc,laser,ipl,depilacion,electrica',
  13,
  true,
  1,
  'tracking',
  'depilacion',
  false,
  NULL,
  'estetica',
  NULL,
  'SEGUIMIENTO FOTODEPILACIÓN.doc',
  '2019-01-25T11:45:08'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'seguimiento_fotodepilacion_doc'
);

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  'tracking_aesthetic',
  'Seguimiento por sesiones',
  'Seguimiento tratamientos (facial / corporal / INDIBA / LPG…)',
  $tracking_aesthetic$Plantilla de seguimiento cronológico por sesiones para tratamientos estéticos (facial, corporal, radiofrecuencia INDIBA, LPG, presoterapia, etc.).

Incluye referencia de medidas corporales según sexo del cliente.$tracking_aesthetic$,
  'facial,corporal,indiba,lpg,radiofrecuencia,lpg,session',
  2,
  true,
  1,
  'tracking',
  'aesthetic',
  true,
  NULL,
  'estetica',
  '{"male": "/clinical/medidas-hombre.jpg", "female": "/clinical/medidas-mujer.docx"}'::jsonb,
  'HOJA DE SEGUIMIENTO.doc',
  '2026-06-16T09:47:47'::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = 'tracking_aesthetic'
);

UPDATE public.consentimiento_plantillas
SET
  document_kind = 'consent',
  linked_tracking_codigo = 'tracking_aesthetic',
  requires_measurements = true,
  category = 'estetica',
  measurement_assets = '{"male":"/clinical/medidas-hombre.jpg","female":"/clinical/medidas-mujer.docx"}'::jsonb
WHERE codigo = 'indiba_deep_beauty_2024';
