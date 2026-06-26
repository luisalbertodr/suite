import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  formatInbodyQualityAlert,
  resolveInbodyDataQuality,
  type InbodyDataQuality,
} from '@/lib/inbodyQuality';
import type { InbodyMeasurement } from '@/lib/inbodyMeasurements';
import {
  suiteTopBannerSurfaceClassName,
  useSuiteTopBanner,
} from '@/contexts/SuiteTopBannerContext';

interface Props {
  measurement: InbodyMeasurement;
  siblings: InbodyMeasurement[];
  onSelectReference?: (id: string) => void;
  compact?: boolean;
}

export function InbodyQualityAlert({ measurement, siblings, onSelectReference, compact }: Props) {
  const quality: InbodyDataQuality = resolveInbodyDataQuality(measurement, siblings);
  const show = quality.status === 'suspicious' && quality.needs_repeat;

  const reference = quality.reference_measurement_id
    ? siblings.find((m) => m.id === quality.reference_measurement_id) ?? null
    : null;

  const alert = formatInbodyQualityAlert(quality, reference);

  const content = useMemo(() => {
    if (!show) return null;
    return (
      <div className={suiteTopBannerSurfaceClassName()}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <div className="space-y-1 min-w-0">
            <p className={`font-medium ${compact ? 'text-xs' : 'text-sm'}`}>{alert.title}</p>
            <p className="text-xs">{alert.body}</p>
            {alert.issues.length > 0 ? (
              <ul className="list-disc pl-4 text-[11px] opacity-90">
                {alert.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        {reference && onSelectReference ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 h-7 text-xs border-amber-400/60 bg-white/60 hover:bg-white dark:bg-transparent"
            onClick={() => onSelectReference(reference.id)}
          >
            Ver sesión de referencia
          </Button>
        ) : null}
      </div>
    );
  }, [alert, compact, onSelectReference, reference, show]);

  useSuiteTopBanner(`inbody-quality-${measurement.id}`, content);
  return null;
}
