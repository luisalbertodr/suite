import type { QuestionnaireField, QuestionnaireSection, QuestionnaireVisitMode } from '@/lib/questionnaireTypes';

function t(key: string, label: string, extra?: Partial<QuestionnaireField>): QuestionnaireField {
  return { key, label, type: 'text', ...extra };
}

function ta(key: string, label: string, extra?: Partial<QuestionnaireField>): QuestionnaireField {
  return { key, label, type: 'textarea', fullWidth: true, ...extra };
}

function sg(key: string, label: string, options: string[], extra?: Partial<QuestionnaireField>): QuestionnaireField {
  return { key, label, type: 'single', options, ...extra };
}

function ml(key: string, label: string, options: string[]): QuestionnaireField {
  return { key, label, type: 'multi', options, fullWidth: true };
}

function yn(key: string, label: string, extra?: Partial<QuestionnaireField>): QuestionnaireField {
  return { key, label, type: 'boolean', ...extra };
}

function dt(key: string, label: string, extra?: Partial<QuestionnaireField>): QuestionnaireField {
  return { key, label, type: 'date', ...extra };
}

/** Secciones rellenadas por el cliente en tablet. */
export const FACIAL_CORPORAL_PATIENT_SECTIONS: QuestionnaireSection[] = [
  {
    id: 'visita_actual',
    title: 'Motivo de esta visita',
    role: 'patient',
    description: 'Indique el motivo de la cita de hoy. El resto de datos se conservan del cuestionario inicial.',
    visitModes: ['follow_up'],
    fields: [
      ta('motivo_consulta_actual', 'Motivo de la consulta de hoy (tratamiento, zona, objetivo…)', {
        required: true,
      }),
      ta(
        'cambios_salud_desde_ultimo',
        '¿Ha cambiado algo en su salud, medicación, embarazo o hábitos desde el último cuestionario?',
        {
          placeholder: 'Deje en blanco si no ha cambiado nada.',
        },
      ),
      yn('confirma_datos_vigentes', 'Confirmo que el resto de mis datos médicos y de hábitos siguen siendo correctos', {
        required: true,
      }),
    ],
  },
  {
    id: 'datos_interes',
    title: 'Datos de interés',
    role: 'patient',
    description: 'Información general sobre su consulta y tratamientos previos.',
    visitModes: ['initial'],
    fields: [
      ta('motivo_consulta', 'Motivo de la consulta (higiene, arrugas, manchas, depilación, etc.)', {
        required: true,
      }),
      ta('tratamientos_previos', 'Tratamientos estéticos o médico-estéticos realizados anteriormente y resultados'),
    ],
  },
  {
    id: 'habitos_vida',
    title: 'Hábitos de vida',
    role: 'patient',
    description: 'Estilo de vida, alimentación y descanso.',
    visitModes: ['initial'],
    readOnlyInFollowUp: true,
    fields: [
      t('fuma', '¿Fuma? ¿Cuánto?'),
      t('alcohol', 'Consumo de alcohol'),
      t('agua_infusiones', 'Agua / infusiones (cantidad diaria)'),
      t('deporte', '¿Practica deporte?'),
      t('deporte_frecuencia', 'Frecuencia del deporte'),
      t('dieta', '¿Está haciendo algún tipo de dieta?'),
      t('pierde_peso_facil', '¿Pierde peso fácilmente?'),
      t('ansiedad_stress', 'Ansiedad / estrés / nerviosismo'),
      t('horas_sueno', 'Horas de sueño habituales'),
    ],
  },
  {
    id: 'exposicion_sol',
    title: 'Exposición solar y fotosensibilidad',
    role: 'patient',
    description: 'Importante para tratamientos faciales, corporales, láser e IPL.',
    visitModes: ['initial'],
    readOnlyInFollowUp: true,
    fields: [
      t('sol_uva', '¿Sol natural o UVA?'),
      t('sol_frecuencia', 'Frecuencia de exposición al sol / UVA'),
      t('ultima_exposicion_sol', 'Última exposición al sol o solarium'),
      t('luz_azul', 'Exposición habitual a luz azul (pantallas, LED…)'),
      ta(
        'reaccion_piel_sol',
        '¿Cómo reacciona su piel tras exposición al sol? (enrojecimiento, manchas, ampollas…)',
      ),
    ],
  },
  {
    id: 'salud_hormonal',
    title: 'Salud hormonal y ciclo',
    role: 'patient',
    description: 'Relevante para tratamientos faciales, corporales y depilación.',
    visitModes: ['initial'],
    readOnlyInFollowUp: true,
    fields: [
      t('trastornos_menstruales', 'Trastornos menstruales (irregular, dolor, menopausia…)'),
      t('anticonceptivos', 'Métodos anticonceptivos'),
      t('embarazos_previos', 'Embarazos previos (natural / cesárea)'),
      t('embarazo', '¿Embarazo actual?'),
      t('lactancia', '¿Lactancia?'),
      t('tratamiento_fertilidad', 'Tratamiento de fertilidad'),
      t('signos_virilizacion', 'Signos de virilización / hirsutismo'),
    ],
  },
  {
    id: 'cuidado_piel',
    title: 'Cuidado de la piel',
    role: 'patient',
    visitModes: ['initial'],
    readOnlyInFollowUp: true,
    fields: [
      ta('cuidado_piel_dia', 'Rutina de cuidado — DÍA'),
      ta('cuidado_piel_noche', 'Rutina de cuidado — NOCHE'),
    ],
  },
  {
    id: 'contraindicaciones',
    title: 'Antecedentes médicos y contraindicaciones',
    role: 'patient',
    description: 'Enfermedades, medicación e implantes que debemos conocer antes de cualquier tratamiento.',
    visitModes: ['initial'],
    readOnlyInFollowUp: true,
    fields: [
      ta('enfermedad_grave', '¿Padece diabetes, hepatitis, cardiopatías u otra enfermedad grave?'),
      ta('enfermedades_infecciosas', 'Enfermedades infecto-contagiosas'),
      ta('dispositivo_metalico', '¿Dispositivo electrónico, metálico, implantes, marcapasos o DIU metálico?'),
      ta('problema_circulatorio', '¿Problema circulatorio? (varices, trombosis, tromboflebitis)'),
      ta('problemas_organos', '¿Problemas cardíacos, epilepsia, hígado, riñón o vesícula?'),
      ta(
        'problemas_musculo_oseo',
        '¿Problemas muscular u óseo? (hernias, protusiones, escoliosis, fibromialgia, osteoporosis)',
      ),
      ta(
        'problemas_hormonales',
        '¿Problemas hormonales? (hipotiroidismo, hipertiroidismo, ovarios poliquísticos)',
      ),
      ta('problemas_cicatrizacion', '¿Problemas de cicatrización?'),
      ta('enfermedad_cutanea', '¿Enfermedad cutánea, alergia, irritaciones, injerto o cicatriz reciente?'),
      t('hernia_hiato', '¿Hernia de hiato?'),
      ta('alergia_materiales', '¿Alergia a níquel, cromo, ácido salicílico u otros?'),
      ta('medicacion', 'Medicación habitual (incl. laxantes, suplementos, hormonas, isotretinoína/Roaccután…)'),
      ta(
        'tratamiento_med_estetico',
        'Tratamientos médico-estéticos previos (bótox, ácido hialurónico, hilos, rellenos, cirugía…)',
      ),
      t('tratamiento_med_cuando', '¿Cuándo fue el último tratamiento médico-estético?'),
      t('peeling_6m', '¿Peeling químico en los últimos 6 meses?'),
      t('cirugia_ultimo_ano', '¿Intervención quirúrgica en el último año?'),
    ],
  },
  {
    id: 'depilacion_laser',
    title: 'Depilación / láser / IPL',
    role: 'patient',
    description: 'Solo si va a recibir depilación láser, IPL o eléctrica. Si no aplica, puede dejarlo en blanco.',
    visitModes: ['initial'],
    readOnlyInFollowUp: true,
    fields: [
      ta('depilacion_zona_historia', 'Historia de la zona a tratar (desde cuándo, evolución, lesiones previas)'),
      ta('depilacion_metodos_previos', 'Métodos de depilación utilizados anteriormente (cera, láser, eléctrica…)'),
      t('pelo_sobre_lunar', '¿Pelo localizado sobre lunares o nevus?'),
      sg('sensibilidad_dolor', 'Sensibilidad al dolor o a la corriente', ['Baja', 'Media', 'Alta']),
      t('medicacion_isotretinoina', '¿Isotretinoína (Roaccután) o despigmentantes en el último año?'),
    ],
  },
];

export const FACIAL_CORPORAL_EMPLOYEE_SECTIONS: QuestionnaireSection[] = [
  {
    id: 'datos_tecnicos',
    title: 'Datos técnicos de la piel',
    role: 'employee',
    fields: [
      dt('first_session_date', 'Fecha 1ª sesión'),
      ta('alteracion_estetica', 'Alteración estética a mejorar', { required: true }),
      t('tiempo_instauracion', 'Desde cuándo la padece (tiempo de instauración)'),
      sg('fototipo', 'Fototipo', ['I', 'II', 'III', 'IV', 'V', 'VI']),
      ta('observaciones', 'Observaciones', { fullWidth: true }),
      sg('coloracion', 'Coloración', ['Normal', 'Amarillenta', 'Rojiza', 'Grisácea']),
      sg('textura', 'Textura', ['Normal', 'Fina', 'Gruesa', 'Áspera']),
      sg('brillo', 'Brillo', ['Zonas brillantes', 'Zonas mates']),
      sg('aspecto_general', 'Aspecto general', ['Lozano', 'Fatigado', 'Desvitalizado', 'Envejecido']),
      sg('aspecto_poro', 'Aspecto del poro', ['Normal', 'Dilatado', 'Ocluido']),
      sg('hidratacion', 'Grado de hidratación', [
        'Normal',
        'Deshidratada',
        'Muy deshidratada',
        'Hiperhidratada',
      ]),
      sg('secrecion_sebacea', 'Secreción sebácea', ['Normal', 'Alípica', 'Seborreica', 'Mixta']),
      ml('vascularizacion', 'Vascularización', [
        'Eritrosis/eritemas',
        'Telangiectasias',
        'Couperosis',
        'Rosácea',
        'Punto rubí',
        'Araña vascular',
        'Angioma',
      ]),
      ml('flacidez', 'Flacidez cutánea', ['Párpados', 'Mentón', 'Óvalo', 'Mejillas']),
      ml('otras_alteraciones', 'Otras alteraciones estéticas', ['Cicatrices', 'Queloides']),
      ml('envejecimiento', 'Envejecimiento', ['Cronológico', 'Mecánico', 'Fotoenvejecimiento']),
      ml('tipo_lesion_pigmentaria', 'Tipo de lesión pigmentaria', [
        'Hipercromías por fotosensibilización',
        'Efélides',
        'Lentigos',
        'Vitíligo',
        'Hipercromías post-cicatrices de acné',
        'Melasma',
        'Acromías',
        'Pigmentaciones seniles',
      ]),
      sg('pigmentacion_color', 'Coloración hiperpigmentación', [
        'Amarilla',
        'Parda',
        'Violácea',
        'Rojiza',
      ]),
      sg('pigmentacion_contorno', 'Contorno hiperpigmentación', ['Regular', 'Irregular/difuso']),
      ml('pigmentacion_localizacion', 'Localización hiperpigmentación', [
        'Frente',
        'Mejillas',
        'Párpados',
        'Labio superior',
        'Mentón',
      ]),
      t('pigmentacion_otra_zona', 'Otra zona (pigmentación)'),
      ml('factores_hiperpigmentacion', 'Factores aparición hiperpigmentación', [
        'Embarazo',
        'Estimulación hormonal',
        'Estimulación lumínica',
        'Genéticos',
        'Otros factores (medicación, alimentos, cosméticos)',
      ]),
      ta('factores_hiperpigmentacion_otros', 'Otros factores (medicación, alimentos, cosméticos…)'),
      t('luz_wood', 'Luz de Wood (melasma epidérmico / dérmico / mixto)'),
    ],
  },
  {
    id: 'datos_depilacion',
    title: 'Datos técnicos depilación',
    role: 'employee',
    description: 'Completar cuando el tratamiento sea depilación láser, IPL o eléctrica.',
    fields: [
      sg('tipo_pelo', 'Tipo de pelo', ['Grueso', 'Fino']),
      sg('densidad_pelo', 'Densidad de pelo', ['Escasa', 'Media', 'Densa']),
      ta('diagnostico_depilacion', 'Diagnóstico y plan de tratamiento depilación'),
    ],
  },
];

export const FACIAL_CORPORAL_PATIENT_PERSONAL_FIELDS: QuestionnaireField[] = [
  t('situacion_personal', 'Situación personal actual'),
];

type ClinicalProfileBuckets = {
  habitos: Record<string, unknown>;
  contraindicaciones: Record<string, unknown>;
  depilacion: Record<string, unknown>;
};

const PROFILE_SECTION_MAP: Record<string, keyof ClinicalProfileBuckets> = {
  habitos_vida: 'habitos',
  exposicion_sol: 'habitos',
  salud_hormonal: 'habitos',
  cuidado_piel: 'habitos',
  contraindicaciones: 'contraindicaciones',
  depilacion_laser: 'depilacion',
};

export function patientSectionsForVisitMode(mode: QuestionnaireVisitMode): QuestionnaireSection[] {
  return FACIAL_CORPORAL_PATIENT_SECTIONS.filter(
    (s) => !s.visitModes || s.visitModes.includes(mode),
  );
}

export function profileBucketForSection(sectionId: string): keyof ClinicalProfileBuckets | null {
  return PROFILE_SECTION_MAP[sectionId] ?? null;
}

export function allPatientFieldKeys(): string[] {
  const keys = new Set<string>();
  for (const section of FACIAL_CORPORAL_PATIENT_SECTIONS) {
    for (const field of section.fields) keys.add(field.key);
  }
  for (const field of FACIAL_CORPORAL_PATIENT_PERSONAL_FIELDS) keys.add(field.key);
  return [...keys];
}
