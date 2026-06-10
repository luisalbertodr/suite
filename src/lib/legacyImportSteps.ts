export type LegacyImportStepKind = 'manual' | 'semi' | 'automatic';

export type LegacyImportMode = 'staging' | 'refresh' | 'full' | 'promote-only';

export type LegacyImportStep = {
  id: string;
  title: string;
  description: string;
  kind: LegacyImportStepKind;
  command?: string;
  actionId?: 'reset-sales' | 'reset-appointments' | 'create-run';
};

export const LEGACY_IMPORT_STEPS: LegacyImportStep[] = [
  {
    id: 'export-dbf',
    title: '1. Exportar DBF desde Dunasoft / Style',
    description:
      'En el equipo con Dunasoft, exporte o copie todos los archivos .dbf del directorio de datos (clientes, planinc, faccab, albcab, articulos, etc.) a una carpeta accesible desde el servidor Suite.',
    kind: 'manual',
  },
  {
    id: 'copy-dbf',
    title: '2. Copiar DBF al servidor de importación',
    description:
      'Coloque los archivos en LEGACY_DBF_DIR (por defecto E:\\dbf o la ruta configurada en .env del servidor). Compruebe que incluye albcab.dbf si hay tickets TPV.',
    kind: 'manual',
  },
  {
    id: 'env-check',
    title: '3. Verificar entorno del servidor',
    description:
      'En el servidor donde ejecutará el worker: Python 3, pip install dbfread psycopg2-binary, archivo .env con SUPABASE_DB_URL, LEGACY_DBF_DIR y LEGACY_IMPORT_SCOPE=all.',
    kind: 'manual',
    command: 'pip install dbfread psycopg2-binary',
  },
  {
    id: 'reset-legacy',
    title: '4. Borrar ventas/citas legacy en Suite (opcional)',
    description:
      'Elimina tickets LEG-*, facturas automáticas y citas importadas antes de regenerar. Puede hacerlo desde aquí o dejar que el pipeline lo haga al ejecutar el worker.',
    kind: 'automatic',
    actionId: 'reset-appointments',
  },
  {
    id: 'queue-run',
    title: '5. Encolar importación y ejecutar worker',
    description:
      'Cree una ejecución desde la UI y ejecute el worker en el servidor. Si una ejecución falla, puede reanudarla con el mismo run-id: el worker omitirá los pasos ya completados.',
    kind: 'semi',
    actionId: 'create-run',
    command: 'python scripts/legacy_import_worker.py --run-id <UUID>',
  },
  {
    id: 'validate',
    title: '6. Validar facturación vs Dunasoft',
    description:
      'Compare totales con Dunasoft (faccab serie A, totfac). El dashboard suma facturas emitidas (issue_date) más TPV sin facturar; las importaciones legacy usan rebuild faccab 1:1.',
    kind: 'manual',
    command: 'python scripts/audit_dunasoft_monthly_medicina_estetica.py',
  },
];

export const LEGACY_IMPORT_MODE_LABELS: Record<LegacyImportMode, string> = {
  staging: 'Solo staging (DBF → legacy.*)',
  refresh: 'Actualizar (DBF + citas/ventas/facturas)',
  full: 'Completo (+ catálogo, clientes, bonos)',
  'promote-only': 'Solo promover (legacy.* ya importado)',
};

export type LegacyImportStatus = {
  legacy_staging: {
    planinc_rows: number;
    faccab_rows: number;
    albcab_rows: number;
    last_imported_at: string | null;
    last_import_batch: string | null;
    row_counts_approximate?: boolean;
  };
  public_promoted: {
    legacy_appointments: number | null;
    legacy_sales: number | null;
    legacy_invoices: number | null;
    counts_deferred?: boolean;
  };
  degraded?: boolean;
  last_run: {
    id: string;
    mode: string;
    status: string;
    current_step: string | null;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
    error_message: string | null;
  } | null;
};

export type LegacyImportRun = {
  id: string;
  mode: LegacyImportMode;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  current_step: string | null;
  steps_log: Array<{ step: string; at: string; detail?: string; status?: string }>;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
};

export function legacyImportWorkerCommand(runId: string): string {
  return `python scripts/legacy_import_worker.py --run-id ${runId}`;
}
