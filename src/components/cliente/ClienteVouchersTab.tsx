import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, Gift, CheckCircle2 } from 'lucide-react';

interface Props {
  vouchers: any[];
  isLoading: boolean;
  onRegisterSession: (voucherId: string) => void;
  isRegistering: boolean;
}

export const ClienteVouchersTab: React.FC<Props> = ({
  vouchers, isLoading, onRegisterSession, isRegistering
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-5 space-y-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-20 w-20 rounded-full mx-auto" />
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!vouchers?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center mb-4">
          <Gift className="w-7 h-7 text-amber-400" />
        </div>
        <h3 className="text-lg font-medium text-foreground">Sin bonos activos</h3>
        <p className="text-sm text-muted-foreground mt-1">Los bonos del cliente aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {vouchers.map((voucher) => {
        const remaining = voucher.total_sessions - voucher.used_sessions;
        const progress = (voucher.used_sessions / voucher.total_sessions) * 100;
        const isComplete = remaining <= 0;
        const articleName = (voucher as any).articles?.descripcion || 'Tratamiento';
        
        // Circular progress
        const size = 88;
        const strokeWidth = 6;
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (progress / 100) * circumference;

        return (
          <Card
            key={voucher.id}
            className={`overflow-hidden transition-all hover:shadow-md ${
              isComplete ? 'opacity-60' : 'border-sky-100 dark:border-sky-900/30'
            }`}
          >
            <CardContent className="p-5">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-sm text-foreground truncate">{articleName}</h4>
                  {voucher.voucher_code && (
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{voucher.voucher_code}</p>
                  )}
                </div>
                {isComplete ? (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <CheckCircle2 className="w-3 h-3" /> Completado
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                    Activo
                  </span>
                )}
              </div>

              {/* Circular progress */}
              <div className="flex justify-center my-4">
                <div className="relative">
                  <svg width={size} height={size} className="transform -rotate-90">
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={strokeWidth}
                      className="text-gray-100 dark:text-gray-800"
                    />
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={strokeWidth}
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className={isComplete ? 'text-emerald-400' : 'text-sky-400'}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-foreground">{voucher.used_sessions}</span>
                    <span className="text-[10px] text-muted-foreground">de {voucher.total_sessions}</span>
                  </div>
                </div>
              </div>

              {/* Remaining info */}
              <p className="text-center text-xs text-muted-foreground mb-4">
                {isComplete
                  ? 'Todas las sesiones completadas'
                  : `${remaining} sesión${remaining !== 1 ? 'es' : ''} restante${remaining !== 1 ? 's' : ''}`
                }
              </p>

              {/* Action */}
              {!isComplete && (
                <Button
                  className="w-full gap-2 bg-sky-500 hover:bg-sky-600 text-white"
                  onClick={() => onRegisterSession(voucher.id)}
                  disabled={isRegistering}
                >
                  <Play className="w-3.5 h-3.5" />
                  Registrar Sesión
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
