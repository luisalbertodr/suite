import React, { memo } from 'react';
import {
  Phone,
  Mail,
  MessageCircle,
  Calendar,
  GripVertical,
  StickyNote,
  UserPlus,
  UserCheck,
  CalendarClock,
  Tag,
  Trophy,
  XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { MarketingLead } from '@/hooks/useMarketingLeads';
import type { MarketingFieldConfig } from '@/hooks/useMarketingFieldConfig';
import type { CustomerLookupRow } from '@/hooks/useCustomerLookup';
import type { MarketingLeadNotePreview } from '@/hooks/useMarketingLeadNotes';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePermissions } from '@/hooks/usePermissions';
import {
  formatLeadFieldValue,
  getLeadFullName,
  getLeadCreatedAtLabel,
  isMarketingNoiseText,
  readLeadField,
  shouldShowLeadCardField,
} from './marketingFormatters';
import { resolveLeadAppointmentParts, valueLooksLikeScheduleDateTime } from '@/lib/marketingLeadAppointment';

interface MarketingLeadCardProps {
  lead: MarketingLead;
  visibleFields: MarketingFieldConfig[];
  stageColor: string;
  /** Etapa "Formulario+Agenda ficticia": avisar si no hay fecha detectada */
  expectAgendaContext?: boolean;
  /** Menos DOM y sin tooltips: kanban más ágil */
  compact?: boolean;
  matchedCustomer: CustomerLookupRow | null;
  noteCount: number;
  notePreviews: MarketingLeadNotePreview[];
  isDragging: boolean;
  isUnread?: boolean;
  onClick: () => void;
  onOpenCustomer: (customerId: string) => void;
  onOpenNotes: () => void;
  onPromote: () => void;
  onDragStart: (event: React.DragEvent<HTMLDivElement>, lead: MarketingLead) => void;
  onDragEnd: (event: React.DragEvent<HTMLDivElement>) => void;
}

const dateTimeFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  year: 'numeric',
});

const formatNoteDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dateTimeFormatter.format(d);
};

const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const formatLeadValue = (value: number | null | undefined): string | null => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return null;
  return currencyFormatter.format(n);
};

function waAutomationBadge(
  status: string | null | undefined,
  error: string | null | undefined,
): { label: string; title: string; className: string } | null {
  switch (status) {
    case 'awaiting_reply':
      return {
        label: 'WA · esperando 1/2',
        title: 'Mensaje inicial enviado; pendiente de respuesta 1 o 2',
        className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
      };
    case 'completed':
      return {
        label: 'WA · respondido',
        title: 'Flujo automático completado',
        className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
      };
    case 'failed':
      return {
        label: 'WA · error',
        title: error?.trim() || 'Falló el envío automático de WhatsApp',
        className: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
      };
    case 'skipped':
      return {
        label: 'WA · omitido',
        title: error?.trim() || 'Sin teléfono o mensajes no configurados',
        className: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300',
      };
    default:
      return null;
  }
}

const CounterBadge: React.FC<{ count: number; className?: string }> = ({ count, className }) => (
  <span
    className={[
      'absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] font-semibold leading-none text-white',
      className ?? 'bg-amber-500',
    ].join(' ')}
  >
    {count > 99 ? '99+' : count}
  </span>
);

export const MarketingLeadCard = memo(function MarketingLeadCard({
  lead,
  visibleFields,
  stageColor,
  expectAgendaContext = false,
  compact = false,
  matchedCustomer,
  noteCount,
  notePreviews,
  isDragging,
  isUnread = false,
  onClick,
  onOpenCustomer,
  onOpenNotes,
  onPromote,
  onDragStart,
  onDragEnd,
}: MarketingLeadCardProps) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canUseWhatsapp = hasPermission('whatsapp', 'read');

  const fullName = getLeadFullName(lead);
  const createdAtLabel = getLeadCreatedAtLabel(lead);
  const isLinked = !!matchedCustomer;
  const isWon = (lead.win_status ?? '').toUpperCase() === 'GANADO';
  const isLost = (lead.win_status ?? '').toUpperCase() === 'PERDIDO';
  const tags = Array.isArray(lead.tags)
    ? lead.tags.filter(Boolean).filter((t) => !isMarketingNoiseText(t, lead))
    : [];
  const waBadge = waAutomationBadge(lead.wa_automation_status, lead.wa_automation_error);

  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

  const phoneHref = lead.phone ? `tel:${lead.phone.replace(/\s+/g, '')}` : undefined;
  const emailHref = lead.email ? `mailto:${lead.email}` : undefined;
  const waExternalHref = lead.phone
    ? `https://wa.me/${lead.phone.replace(/\D/g, '')}`
    : undefined;
  const handleWhatsappClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!lead.phone) return;
    if (canUseWhatsapp) {
      const params = new URLSearchParams();
      params.set('phone', lead.phone);
      if (fullName) params.set('name', fullName);
      navigate(`/whatsapp?${params.toString()}`);
    } else if (waExternalHref) {
      window.open(waExternalHref, '_blank', 'noreferrer');
    }
  };
  const handleMatchedCustomerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (matchedCustomer?.id) onOpenCustomer(matchedCustomer.id);
  };

  const { atIso: resolvedApptIso, label: resolvedApptLabel } =
    resolveLeadAppointmentParts(lead);
  const hasValidAppointmentDate =
    !!resolvedApptIso && !Number.isNaN(new Date(resolvedApptIso).getTime());
  const appointmentText = hasValidAppointmentDate
    ? dateFormatter.format(new Date(resolvedApptIso!))
    : null;
  // En tarjeta sólo mostramos citas con fecha real; nunca el nombre del formulario como “cita”.
  const showAppointment =
    hasValidAppointmentDate &&
    !!appointmentText &&
    !isMarketingNoiseText(appointmentText, lead);
  const showAppointmentSlotLabel =
    !hasValidAppointmentDate &&
    !!resolvedApptLabel &&
    valueLooksLikeScheduleDateTime(resolvedApptLabel) &&
    !isMarketingNoiseText(resolvedApptLabel, lead);
  const appointmentDisplayText = appointmentText ?? (showAppointmentSlotLabel ? resolvedApptLabel : null);
  const showAppointmentBadge = !!appointmentDisplayText;

  const showAgendaMissingHint =
    expectAgendaContext && !showAppointmentBadge && ['meta', 'facebook', 'instagram'].includes(
      String(lead.source ?? '').toLowerCase(),
    );

  const valueLabel = formatLeadValue(lead.value);
  const iconBtnClass = compact ? 'h-6 w-6' : 'h-7 w-7';
  const iconClass = compact ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5';
  const cardFields = compact
    ? visibleFields.filter((f) => f.field_key !== 'email' && f.field_key !== 'value')
    : visibleFields;

  const cardShell = (
      <div
        draggable
        onDragStart={(e) => onDragStart(e, lead)}
        onDragEnd={onDragEnd}
        onClick={onClick}
        style={{ contentVisibility: 'auto', containIntrinsicSize: compact ? '0 88px' : '0 160px' }}
        className={[
          'group relative cursor-pointer rounded-lg border shadow-sm',
          compact ? '' : 'rounded-xl transition-all hover:shadow-md hover:-translate-y-0.5',
          isWon
            ? 'border-amber-300/70 bg-amber-50/70 dark:border-amber-700/50 dark:bg-amber-950/30'
            : isLinked
              ? 'border-emerald-300/70 bg-emerald-50/60 dark:border-emerald-700/40 dark:bg-emerald-950/30'
              : 'border-border bg-card',
          isDragging ? 'opacity-50 ring-2 ring-primary/60' : 'opacity-100',
          isUnread && !isDragging ? 'ring-2 ring-rose-400/70 dark:ring-rose-500/50' : '',
        ].join(' ')}
      >
        {isUnread ? (
          <span className="absolute right-2 top-2 z-10 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
            Nuevo
          </span>
        ) : null}
        <div
          className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
          style={{ backgroundColor: stageColor }}
        />
        <div className={compact ? 'p-1.5 pl-2.5' : 'p-3 pl-4'}>
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0 flex-1">
              <h4
                className={[
                  'truncate font-semibold text-foreground',
                  compact ? 'text-[15px] leading-snug' : 'text-[15px]',
                ].join(' ')}
              >
                {fullName}
                {!compact && createdAtLabel ? (
                  <span className="text-muted-foreground font-normal"> · {createdAtLabel}</span>
                ) : null}
              </h4>
              {compact && createdAtLabel ? (
                <p className="truncate text-xs text-muted-foreground">{createdAtLabel}</p>
              ) : null}
              {compact ? (
                <p className="truncate text-xs text-muted-foreground leading-snug">
                  {lead.phone || '—'}
                </p>
              ) : null}
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {isLinked ? (
                  compact ? (
                    <button
                      type="button"
                      onClick={handleMatchedCustomerClick}
                      className="inline-flex max-w-full items-center gap-1 text-left text-xs font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
                      title={`Cliente: ${matchedCustomer!.name}`}
                    >
                      <UserCheck className="h-3 w-3 shrink-0" />
                      <span className="min-w-0 truncate">{matchedCustomer!.name}</span>
                    </button>
                  ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={handleMatchedCustomerClick}
                        className="inline-flex max-w-full items-center gap-1 text-left text-xs font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
                      >
                        <UserCheck className="h-3 w-3 shrink-0" />
                        <span className="min-w-0 truncate">Cliente: {matchedCustomer!.name}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Coincide con un cliente existente: {matchedCustomer!.name}
                    </TooltipContent>
                  </Tooltip>
                  )
                ) : null}
                {isWon ? (
                  compact ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
                      title="Ganado"
                    >
                      <Trophy className="h-3 w-3" />
                    </span>
                  ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        <Trophy className="h-3 w-3" />
                        Ganado
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Cliente convertido (estado: GANADO)</TooltipContent>
                  </Tooltip>
                  )
                ) : null}
                {isLost ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300"
                    title="Perdido"
                  >
                    <XCircle className="h-3 w-3" />
                    {!compact ? 'Perdido' : null}
                  </span>
                ) : null}
                {waBadge ? (
                  compact ? (
                    <span
                      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${waBadge.className}`}
                      title={waBadge.title}
                    >
                      WA
                    </span>
                  ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${waBadge.className}`}
                      >
                        {waBadge.label}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{waBadge.title}</TooltipContent>
                  </Tooltip>
                  )
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {compact && valueLabel ? (
                <span
                  className="max-w-[72px] truncate text-[11px] font-semibold tabular-nums text-foreground"
                  title={valueLabel}
                >
                  {valueLabel}
                </span>
              ) : null}
              <GripVertical
                className={[
                  'h-4 w-4 shrink-0 text-muted-foreground/50',
                  compact ? 'opacity-50' : 'opacity-0 transition-opacity group-hover:opacity-100',
                ].join(' ')}
              />
            </div>
          </div>

          {cardFields.length > 0 ? (
            compact ? (
              <div className="mt-0.5 space-y-0 text-xs leading-snug">
                {cardFields.map((field) => {
                  const raw = readLeadField(lead, field.field_key);
                  if (!shouldShowLeadCardField(lead, field, raw)) return null;
                  const formatted = formatLeadFieldValue(raw, field.field_type);
                  if (isMarketingNoiseText(formatted, lead)) return null;
                  return (
                    <p
                      key={field.id}
                      className="truncate font-medium text-foreground"
                      title={formatted}
                    >
                      {formatted}
                    </p>
                  );
                })}
              </div>
            ) : (
              <dl className="mt-2 space-y-1 text-xs">
                {cardFields.map((field) => {
                  const raw = readLeadField(lead, field.field_key);
                  if (!shouldShowLeadCardField(lead, field, raw)) return null;
                  const formatted = formatLeadFieldValue(raw, field.field_type);
                  if (isMarketingNoiseText(formatted, lead)) return null;
                  return (
                    <div key={field.id} className="flex items-baseline justify-between gap-2">
                      <dt className="shrink-0 text-muted-foreground">{field.display_label}:</dt>
                      <dd className="min-w-0 truncate font-medium text-foreground" title={formatted}>
                        {formatted}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )
          ) : null}

          {!compact && showAppointmentBadge ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                  <Calendar className="h-3 w-3" />
                  {truncate(appointmentDisplayText!, 36)}
                </div>
              </TooltipTrigger>
              <TooltipContent>Cita: {appointmentDisplayText}</TooltipContent>
            </Tooltip>
          ) : !compact && showAgendaMissingHint ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mt-2 inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <CalendarClock className="h-3 w-3 shrink-0 opacity-70" />
                  <span className="truncate">Sin fecha de cita en el formulario</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-[260px]">
                Este lead está en la columna de agenda ficticia pero no se encontró fecha/slot en los datos de Meta.
                Puedes moverlo de etapa o revisar el detalle del lead.
              </TooltipContent>
            </Tooltip>
          ) : null}

          <div
            className={`flex flex-wrap items-center justify-end gap-0.5 ${compact ? 'mt-1' : 'mt-3'}`}
            onClick={stopPropagation}
          >
            {phoneHref ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild variant="ghost" size="icon" className={iconBtnClass}>
                    <a href={phoneHref} aria-label="Llamar">
                      <Phone className={iconClass} />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Llamar</TooltipContent>
              </Tooltip>
            ) : null}
            {lead.phone ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${iconBtnClass} text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950`}
                    aria-label="WhatsApp"
                    onClick={handleWhatsappClick}
                  >
                    <MessageCircle className={iconClass} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {canUseWhatsapp ? 'Abrir conversación de WhatsApp' : 'WhatsApp'}
                </TooltipContent>
              </Tooltip>
            ) : null}
            {emailHref ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild variant="ghost" size="icon" className={iconBtnClass}>
                    <a href={emailHref} aria-label="Email">
                      <Mail className={iconClass} />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Email</TooltipContent>
              </Tooltip>
            ) : null}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`relative ${iconBtnClass}`}
                  aria-label="Notas"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenNotes();
                  }}
                >
                  <StickyNote className={iconClass} />
                  {noteCount > 0 ? <CounterBadge count={noteCount} /> : null}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px]">
                {noteCount === 0 ? (
                  <p className="text-[11px]">Sin notas. Click para añadir.</p>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold">
                      {noteCount} {noteCount === 1 ? 'nota' : 'notas'} · últimas:
                    </p>
                    {notePreviews.slice(0, 3).map((n) => (
                      <div key={n.id} className="border-l-2 border-amber-400 pl-2 text-[10px]">
                        <p className="text-muted-foreground tabular-nums">{formatNoteDate(n.created_at)}</p>
                        <p className="whitespace-pre-wrap break-words text-foreground/80">
                          {truncate(n.body, 140)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </TooltipContent>
            </Tooltip>

            {tags.length > 0 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`relative ${iconBtnClass} text-sky-600`}
                    aria-label="Etiquetas"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClick();
                    }}
                  >
                    <Tag className={iconClass} />
                    <CounterBadge count={tags.length} className="bg-sky-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[260px]">
                  <p className="text-[11px] font-semibold">Etiquetas</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-800 dark:bg-sky-950 dark:text-sky-200"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : null}

            {!isLinked ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${iconBtnClass} text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950`}
                    aria-label="Crear cliente"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPromote();
                    }}
                  >
                    <UserPlus className={iconClass} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Crear cliente desde lead</TooltipContent>
              </Tooltip>
            ) : null}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={iconBtnClass}
                  aria-label="Cita"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/agenda?fromLead=${encodeURIComponent(lead.id)}`);
                  }}
                >
                  <Calendar className={iconClass} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cita (abrir agenda)</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
  );

  return (
    <TooltipProvider delayDuration={compact ? 400 : 250}>
      {cardShell}
    </TooltipProvider>
  );
});
