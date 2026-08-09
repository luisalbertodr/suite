import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatInbodyNumber } from '@/lib/inbodyMeasurements';
import {
  morphoExtrasForUi,
  type MorphoClinicalExtra,
  type MorphoExtraFidelity,
} from '@/lib/morphoInbodyView';
import type { InbodyMeasurement } from '@/lib/inbodyMeasurements';
import { cn } from '@/lib/utils';

function fidelityBadge(f: MorphoExtraFidelity) {
  if (f === 'good') {
    return (
      <Badge variant="outline" className="text-[9px] font-normal border-emerald-400/60 text-emerald-800">
        Fiel
      </Badge>
    );
  }
  if (f === 'orientative') {
    return (
      <Badge variant="outline" className="text-[9px] font-normal border-amber-400/60 text-amber-900">
        Orientativo
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[9px] font-normal border-rose-400/50 text-rose-800">
      Poco fiable
    </Badge>
  );
}

function ExtraValue({ e }: { e: MorphoClinicalExtra }) {
  if (typeof e.value === 'string') return <>{e.value}</>;
  return <>{formatInbodyNumber(e.value, e.decimals ?? 1, e.unit ? ` ${e.unit}` : '')}</>;
}

interface Props {
  measurement: InbodyMeasurement;
  className?: string;
}

/** Indicadores Morpho no presentes en el informe InBody clásico (filtrados por utilidad). */
export function MorphoClinicalExtrasPanel({ measurement, className }: Props) {
  const extras = morphoExtrasForUi(measurement);
  if (!extras.length) return null;

  return (
    <Card className={cn('border-teal-100/60 dark:border-teal-900/30', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
          Indicadores Morpho (complementarios)
          <Badge variant="secondary" className="text-[10px] font-normal">
            no InBody
          </Badge>
        </CardTitle>
        <p className="text-[10px] text-muted-foreground mt-1">
          Solo se muestran si aportan contexto. Los poco fiables (visceral, subcutánea heurística) se ocultan
          para no sesgar el diagnóstico frente a InBody.
        </p>
      </CardHeader>
      <CardContent>
        <ul className="grid sm:grid-cols-2 gap-3 text-xs">
          {extras.map((e) => (
            <li key={e.id} className="rounded-md border border-border/50 p-2.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{e.label}</span>
                {fidelityBadge(e.fidelity)}
              </div>
              <div className="text-base font-semibold tabular-nums">
                <ExtraValue e={e} />
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">{e.note}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
