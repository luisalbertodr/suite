import React from 'react';
import { BarChart3, ExternalLink, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getMetabaseSiteUrl, isMetabaseConfigured } from '@/lib/metabaseBi';

interface Props {
  /** Altura del iframe dentro del Dashboard. */
  className?: string;
}

export const MetabaseBiPanel: React.FC<Props> = ({ className }) => {
  const url = getMetabaseSiteUrl();
  const configured = isMetabaseConfigured();

  if (!configured) {
    return (
      <div
        className={`rounded-xl border bg-card p-8 flex flex-col items-center justify-center gap-3 text-center ${className ?? ''}`}
      >
        <Server className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-1 max-w-md">
          <p className="text-sm font-medium text-foreground">Metabase no configurado</p>
          <p className="text-xs text-muted-foreground">
            Define <code className="text-[11px]">VITE_METABASE_SITE_URL</code> (p. ej.{' '}
            <code className="text-[11px]">https://metabase.lipoout.com</code>) y vuelve a desplegar el
            frontend. El stack Portainer se crea con{' '}
            <code className="text-[11px]">scripts/setup-metabase-portainer-stack.py</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BarChart3 className="h-4 w-4" />
          <span>Business Intelligence (Metabase)</span>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            Abrir en pestaña
            <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </a>
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Si el iframe queda en blanco (certificado o cookies), usa «Abrir en pestaña». En el setup de
        Metabase conecta Postgres como usuario <code className="text-[10px]">metabase_ro</code> (host
        Docker <code className="text-[10px]">172.17.0.1</code>, DB <code className="text-[10px]">postgres</code>).
      </p>
      <div className="rounded-xl border bg-card overflow-hidden min-h-[70vh]">
        <iframe
          title="Metabase BI"
          src={url}
          className="w-full h-[70vh] border-0 bg-background"
          allow="fullscreen"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
};
