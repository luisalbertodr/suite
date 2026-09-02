import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  buildSessionLimitAlerts,
  type WahaSessionLimits,
} from '@/lib/wahaSessionLimits';

interface Props {
  limits: WahaSessionLimits | null | undefined;
  compact?: boolean;
  className?: string;
}

export const WhatsappSessionLimitsAlert: React.FC<Props> = ({
  limits,
  compact = false,
  className = '',
}) => {
  const alerts = buildSessionLimitAlerts(limits);
  if (alerts.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {alerts.map((alert) => (
        <div
          key={alert.title}
          className={
            alert.severity === 'critical'
              ? 'rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100'
              : 'rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100'
          }
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className={`font-medium ${compact ? 'text-xs' : ''}`}>{alert.title}</p>
              {!compact ? (
                <p className="mt-0.5 text-xs opacity-90">{alert.description}</p>
              ) : (
                <p className="mt-0.5 text-[11px] opacity-90 line-clamp-2">
                  {alert.description}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
