import React from 'react';
import { AlertTriangle, Building2, CheckCircle2, Info, RefreshCw, Users, Package } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkCenterAudit } from '@/hooks/useWorkCenterAudit';
import type { AuditIssue, AuditSeverity } from '@/lib/workCenterAudit';

const severityStyles: Record<
  AuditSeverity,
  { badge: string; icon: React.ReactNode; label: string }
> = {
  error: {
    badge: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
    icon: <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />,
    label: 'Error',
  },
  warning: {
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    icon: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
    label: 'Aviso',
  },
  info: {
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
    icon: <Info className="w-4 h-4 text-sky-500 shrink-0" />,
    label: 'Info',
  },
};

function IssueRow({ issue }: { issue: AuditIssue }) {
  const style = severityStyles[issue.severity];
  return (
    <div className="flex gap-3 rounded-lg border border-border/60 p-3 text-sm">
      {style.icon}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{issue.title}</span>
          <Badge variant="outline" className={`text-[10px] ${style.badge}`}>
            {style.label}
          </Badge>
        </div>
        {issue.detail && <p className="text-muted-foreground text-xs">{issue.detail}</p>}
        {issue.fixHint && (
          <p className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80">Cómo corregir:</span> {issue.fixHint}
          </p>
        )}
      </div>
    </div>
  );
}

export const WorkCenterAuditPanel: React.FC = () => {
  const { audit, isLoading, isFetching, refetch, isMultiEntity, billingCompanies } =
    useWorkCenterAudit();

  if (!isMultiEntity) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Centro laboral
          </CardTitle>
          <CardDescription>
            Esta empresa no forma parte de un centro laboral multi-entidad. No hay auditoría de split
            billing.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!audit) return null;

  const allClear = audit.errorCount === 0 && audit.warningCount === 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Auditoría del centro laboral
              </CardTitle>
              <CardDescription className="mt-1">
                Comprueba emisores de facturación, empleados y catálogo entre{' '}
                {billingCompanies.map((c) => c.short_name || c.name).join(' · ')}.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {allClear ? (
              <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Sin errores ni avisos críticos
              </div>
            ) : (
              <>
                {audit.errorCount > 0 && (
                  <Badge className="bg-red-600 hover:bg-red-600">{audit.errorCount} errores</Badge>
                )}
                {audit.warningCount > 0 && (
                  <Badge className="bg-amber-500 hover:bg-amber-500">
                    {audit.warningCount} avisos
                  </Badge>
                )}
              </>
            )}
            {audit.infoCount > 0 && (
              <Badge variant="secondary">{audit.infoCount} informativos</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Empleados por empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {audit.employeesByBilling.map((row) => (
              <div key={row.companyId} className="flex justify-between">
                <span>{row.label}</span>
                <span className="font-medium tabular-nums">{row.count}</span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 text-muted-foreground">
              <span>Compartidos (recepción)</span>
              <span className="font-medium tabular-nums">{audit.sharedEmployees}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" />
              Artículos activos por emisor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {audit.articlesByBilling.map((row) => (
              <div key={row.companyId} className="flex justify-between">
                <span>{row.label}</span>
                <span className="font-medium tabular-nums">{row.count}</span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 text-muted-foreground text-xs">
              <span>Familias con emisor explícito</span>
              <span>{audit.explicitFamilies}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Hallazgos</CardTitle>
          <CardDescription>
            Ordenados por gravedad. Los informativos indican herencia al tenant operativo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[28rem] overflow-y-auto">
          {audit.issues.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Todo correcto. No hay hallazgos.
            </p>
          ) : (
            audit.issues.map((issue) => <IssueRow key={issue.id} issue={issue} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
};
