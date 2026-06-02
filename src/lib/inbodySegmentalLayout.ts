export type InbodySegmentKey = 'right_arm' | 'left_arm' | 'trunk' | 'right_leg' | 'left_leg';

export type InbodySilhouetteSex = 'male' | 'female';

/** Siluetas por sexo (PNG fondo transparente) en public/inbody/. */
export const INBODY_SILHOUETTE_SRC: Record<InbodySilhouetteSex, string> = {
  male: '/inbody/body-silhouette-male.png',
  female: '/inbody/body-silhouette-female.png',
};

export type InbodyCalloutAnchor = {
  /** Posición % desde arriba del contenedor de datos */
  top: number;
  /** Posición % desde la izquierda */
  left: number;
  /** Alineación del bloque de texto */
  align: 'left' | 'center' | 'right';
  /** Ancho máximo del callout (% del contenedor) */
  maxWidth?: number;
  /** Desplazamiento fino en px */
  offsetX?: number;
  offsetY?: number;
};

/** Ajuste de la imagen dentro del panel (porcentajes del contenedor). */
export const INBODY_SILHOUETTE_FRAME: Record<InbodySilhouetteSex, {
  top: number;
  left: number;
  width: number;
  height: number;
  objectX: number;
  objectY: number;
}> = {
  male: { top: 2, left: 50, width: 56, height: 94, objectX: 50, objectY: 48 },
  female: { top: 2, left: 50, width: 52, height: 94, objectX: 50, objectY: 48 },
};

/**
 * Posiciones de etiquetas respecto al contenedor.
 * Vista frontal anatómica: brazo/pierna derechos del paciente = lado izquierdo de pantalla.
 * Ajusta estos valores si cambias la imagen en public/inbody/body-silhouette.png
 */
export const INBODY_CALLOUT_ANCHORS: Record<InbodySegmentKey, InbodyCalloutAnchor> = {
  /** Brazo derecho del paciente = lado izquierdo de pantalla */
  right_arm: { top: 14, left: 10, align: 'right', maxWidth: 32 },
  left_arm: { top: 14, left: 90, align: 'left', maxWidth: 32 },
  /** Tronco: lateral izquierdo, pegado al torso sin taparlo */
  trunk: { top: 42, left: 28, align: 'right', maxWidth: 34 },
  right_leg: { top: 68, left: 12, align: 'right', maxWidth: 30 },
  left_leg: { top: 68, left: 88, align: 'left', maxWidth: 30 },
};

export const INBODY_SEGMENT_LABELS: Record<
  InbodySegmentKey,
  { side: 'Derecho' | 'Izquierdo' | 'Tronco'; short: string }
> = {
  right_arm: { side: 'Derecho', short: 'BD' },
  left_arm: { side: 'Izquierdo', short: 'BI' },
  trunk: { side: 'Tronco', short: 'TR' },
  right_leg: { side: 'Derecho', short: 'PD' },
  left_leg: { side: 'Izquierdo', short: 'PI' },
};
