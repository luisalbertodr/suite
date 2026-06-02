export type InbodyMetricId =
  | 'weight_kg'
  | 'smm_kg'
  | 'body_fat_kg'
  | 'tbw_kg'
  | 'ffm_kg'
  | 'bmi'
  | 'pbf_pct'
  | 'whr'
  | 'bmr_kcal'
  | 'muscle_control_kg'
  | 'fat_control_kg'
  | 'segmental_lean'
  | 'segmental_fat'
  | 'segment_lean_eval'
  | 'segment_fat_pbf'
  | 'impedance'
  | 'inbody_status';

export interface InbodyGlossaryEntry {
  /** Siglas mostradas en tablas (MME, PGC…) */
  shortLabel: string;
  /** Nombre completo en español */
  fullName: string;
  /** Qué mide */
  description: string;
  /** Cómo interpretar el valor y el estado */
  interpretation: string;
}

export const INBODY_GLOSSARY: Record<InbodyMetricId, InbodyGlossaryEntry> = {
  weight_kg: {
    shortLabel: 'Peso',
    fullName: 'Peso corporal',
    description: 'Masa total del cuerpo en kilogramos.',
    interpretation:
      'Compare con el rango normal (banda verde). Por debajo: bajo peso relativo a su referencia InBody; por encima: sobrepeso. El rango depende de sexo, edad y talla.',
  },
  smm_kg: {
    shortLabel: 'MME',
    fullName: 'Masa muscular esquelética (MME)',
    description:
      'Músculo voluntario de brazos, piernas y tronco. Es el indicador principal de músculo funcional, distinto de la masa magra total.',
    interpretation:
      'Valores dentro del rango normal indican musculatura adecuada para su perfil. Por debajo: posible déficit muscular; por encima: mayor desarrollo muscular. Útil para seguir entrenamiento de fuerza.',
  },
  body_fat_kg: {
    shortLabel: 'Masa grasa',
    fullName: 'Masa grasa corporal',
    description: 'Kilogramos de tejido adiposo subcutáneo e visceral estimados por bioimpedancia.',
    interpretation:
      'Dentro del rango: adiposidad saludable según InBody. Por encima: exceso de grasa; por debajo: adiposidad muy baja (valorar contexto clínico).',
  },
  tbw_kg: {
    shortLabel: 'ACT',
    fullName: 'Agua corporal total (ACT)',
    description: 'Suma del agua intracelular y extracelular. Suele representar la mayor parte del peso corporal.',
    interpretation:
      'Desviaciones pueden reflejar hidratación, retención o deshidratación. Compare siempre en condiciones similares (misma hora, ayuno, hidratación).',
  },
  ffm_kg: {
    shortLabel: 'MLG',
    fullName: 'Masa libre de grasa (MLG)',
    description: 'Todo el peso que no es grasa: músculo, hueso, agua, órganos y proteínas.',
    interpretation:
      'Aumentos suelen indicar ganancia de masa magra o agua; descensos, pérdida de masa magra o deshidratación. Complementa la MME para ver el cuadro global.',
  },
  bmi: {
    shortLabel: 'IMC',
    fullName: 'Índice de masa corporal (IMC)',
    description: 'Relación peso/talla² (kg/m²). Criterio epidemiológico de peso, no de composición.',
    interpretation:
      'Normal según InBody no implica composición óptima. Úselo junto con PGC y MME: una persona puede tener IMC normal y alto porcentaje de grasa.',
  },
  pbf_pct: {
    shortLabel: 'PGC',
    fullName: 'Porcentaje de grasa corporal (PGC)',
    description: 'Proporción de grasa respecto al peso total. Referencia clave en diagnóstico de obesidad por InBody.',
    interpretation:
      'Rangos normales varían por sexo y edad. Por encima: obesidad por grasa; por debajo: grasa muy baja. Es uno de los mejores indicadores para seguir recomposición corporal.',
  },
  whr: {
    shortLabel: 'RCC',
    fullName: 'Relación cintura-cadera (RCC)',
    description: 'Perímetro de cintura dividido por el de cadera. Estima distribución de grasa (androida vs ginoide).',
    interpretation:
      'Valores altos sugieren grasa abdominal (riesgo metabólico). Normal: patrón más periférico. El rango de referencia depende del sexo.',
  },
  bmr_kcal: {
    shortLabel: 'MB',
    fullName: 'Metabolismo basal (MB)',
    description: 'Energía diaria (kcal) que el cuerpo consume en reposo absoluto para funciones vitales.',
    interpretation:
      'Sube con más masa magra/músculo y baja con déficit calórico prolongado o menos masa activa. Base orientativa para planificar ingesta calórica.',
  },
  muscle_control_kg: {
    shortLabel: 'Control músculo',
    fullName: 'Control de músculo',
    description:
      'Kg de masa muscular esquelética a ganar (+) o perder (−) para alcanzar el objetivo óptimo según InBody.',
    interpretation:
      'Valor positivo: conviene ganar ese kg de MME; negativo: reducir (poco frecuente). Cero: en objetivo. Guía práctica para entrenamiento.',
  },
  fat_control_kg: {
    shortLabel: 'Control grasa',
    fullName: 'Control de grasa',
    description: 'Kg de grasa a perder (−) o ganar (+) para entrar en el rango normal de composición.',
    interpretation:
      'Negativo: kg de grasa recomendados a perder; positivo: ganancia de grasa sugerida (ej. bajo peso); cero: en rango. No es una prescripción médica.',
  },
  segmental_lean: {
    shortLabel: 'Masa magra segm.',
    fullName: 'Masa magra segmental',
    description: 'Distribución de la masa magra por brazos, tronco y piernas (vista frontal anatómica).',
    interpretation:
      'Permite detectar desequilibrios entre lados o segmentos (ej. pierna dominante vs no dominante). Compare simetría derecha/izquierda.',
  },
  segmental_fat: {
    shortLabel: 'Grasa segm.',
    fullName: 'Grasa segmental',
    description: 'Porcentaje y kg de grasa en cada segmento corporal.',
    interpretation:
      'Muestra dónde se acumula la grasa (abdomen, extremidades…). Los rangos normales dependen del sexo y los calcula el InBody.',
  },
  segment_lean_eval: {
    shortLabel: '% normal magra',
    fullName: 'Evaluación de masa magra segmental (% normal)',
    description: 'Porcentaje respecto al valor de referencia InBody para ese segmento, sexo y edad (100 % = ideal).',
    interpretation:
      '90–110 %: Normal. Por debajo de 90 %: Bajo (déficit relativo en ese segmento). Por encima de 110 %: Alto (exceso relativo).',
  },
  segment_fat_pbf: {
    shortLabel: 'PGC segm.',
    fullName: 'PGC segmental',
    description: 'Porcentaje de grasa en cada brazo, tronco o pierna.',
    interpretation:
      'No use umbrales fijos de 90–110 % aquí: compare con el informe InBody y la evolución propia. Tronco alto suele indicar grasa central.',
  },
  impedance: {
    shortLabel: 'Impedancia',
    fullName: 'Impedancia eléctrica (Ω)',
    description:
      'Resistencia del tejido a corriente alterna a 20 y 100 kHz, por segmento. Dato técnico del cálculo de composición.',
    interpretation:
      'Valores más bajos suelen asociarse a más agua/masa magra en el segmento. Sirve sobre todo para control de calidad y seguimiento técnico, no para interpretación clínica directa.',
  },
  inbody_status: {
    shortLabel: 'Estado',
    fullName: 'Estado (Bajo / Normal / Alto)',
    description: 'Clasificación automática respecto al rango de referencia InBody para su sexo, edad y talla.',
    interpretation:
      'Bajo: por debajo del mínimo normal. Normal: dentro del rango. Alto: por encima del máximo. En masa magra segmental, Normal = 90–110 % del ideal.',
  },
};

/** Texto accesible (aria-label / title) combinando nombre, definición e interpretación. */
export function inbodyMetricAriaLabel(id: InbodyMetricId): string {
  const e = INBODY_GLOSSARY[id];
  return `${e.fullName} (${e.shortLabel}). ${e.description} ${e.interpretation}`;
}

export function inbodyMetricTitle(id: InbodyMetricId): string {
  const e = INBODY_GLOSSARY[id];
  return `${e.fullName}: ${e.description}`;
}

/** Parámetros de gráfica → entrada del glosario */
export function inbodyGlossaryForChartParam(
  id: string,
): InbodyMetricId | null {
  if (id in INBODY_GLOSSARY) return id as InbodyMetricId;
  if (id.startsWith('lean_')) return 'segmental_lean';
  if (id.startsWith('fat_')) return 'segmental_fat';
  return null;
}
