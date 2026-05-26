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
  getLeadSubtitle,
  readLeadField,
} from './marketingFormatters';
import { resolveLeadAppointmentParts } from '@/lib/marketingLeadAppointment';

interface MarketingLeadCardProps {
  lead: MarketingLead;
  visibleFields: MarketingFieldConfig[];
  stageColor: string;
  /** Etapa "Formulario+Agenda ficticia": avisar si no hay fecha detectada */
  expectAgendaContext?: boolean;
  matchedCustomer: CustomerLookupRow | null;
  noteCount: number;
  notePreviews: MarketingLeadNotePreview[];
  isDragging: boolean;
  onClick: () => void;
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

const NOTE_KIND_LABELS: Record<string, string> = {
  note: 'Nota',
  call: 'Llamada',
  whatsapp: 'WhatsApp',
  email: 'Email',
  rejection: 'Rechazo',
  reschedule: 'Reagendar',
};

const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

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
  matchedCustomer,
  noteCount,
  notePreviews,
  isDragging,
  onClick,
  onOpenNotes,
  onPromote,
  onDragStart,
  onDragEnd,
}: MarketingLeadCardProps) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canUseWhatsapp = hasPermission('whatsapp', 'read');

  const fullName = getLeadFullName(lead);
  const subtitle = getLeadSubtitle(lead);
  const isLinked = !!matchedCustomer;
  const isWon = (lead.win_status ?? '').toUpperCase() === 'GANADO';
  const isLost = (lead.win_status ?? '').toUpperCase() === 'PERDIDO';
  const tags = Array.isArray(lead.tags) ? lead.tags.filter(Boolean) : [];

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

  const { atIso: resolvedApptIso, label: resolvedApptLabel } =
    resolveLeadAppointmentParts(lead);
  const appointmentText = resolvedApptIso
    ? dateFormatter.format(new Date(resolvedApptIso))
    : resolvedApptLabel;

  const showAgendaMissingHint =
    expectAgendaContext && !appointmentText && ['meta', 'facebook', 'instagram'].includes(
      String(lead.source ?? '').toLowerCase(),
    );
  return (
    <TooltipProvider delayDuration={250}>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, lead)}
        onDragEnd={onDragEnd}
        onClick={onClick}
        className={[
          'group relative cursor-pointer rounded-xl border shadow-sm transition-all',
          'hover:shadow-md hover:-translate-y-0.5',
          isWon
            ? 'border-amber-300/70 bg-amber-50/70 dark:border-amber-700/50 dark:bg-amber-950/30'
            : isLinked
              ? 'border-emerald-300/70 bg-emerald-50/60 dark:border-emerald-700/40 dark:bg-emerald-950/30'
              : 'border-border bg-card',
          isDragging ? 'opacity-50 ring-2 ring-primary/60' : 'opacity-100',
        ].join(' ')}
      >
        <div
          className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
          style={{ backgroundColor: stageColor }}
        />
        <div className="p-3 pl-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-sm font-semibold text-foreground">
                {fullName}
                {subtitle ? <span className="text-muted-foreground"> · {subtitle}</span> : null}
              </h4>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {isLinked ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                        <UserCheck className="h-3 w-3" />
                        Cliente: {truncate(matchedCustomer!.name, 18)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Coincide con un cliente existente: {matchedCustomer!.name}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
                {isWon ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        <Trophy className="h-3 w-3" />
                        Ganado
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Cliente convertido (estado: GANADO)</TooltipContent>
                  </Tooltip>
                ) : null}
                {isLost ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                    <XCircle className="h-3 w-3" />
                    Perdido
                  </span>
                ) : null}
                {lead.assigned_to ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sky-500/15 px-1 text-[9px] font-bold uppercase text-sky-700 dark:text-sky-300">
                        {lead.assigned_to}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Asignado a: {lead.assigned_to}</TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            </div>
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-opacity opacity-0 group-hover:opacity-100" />
          </div>

          <dl className="mt-2 space-y-1 text-[11px]">
            {visibleFields.map((field) => {
              const raw = readLeadField(lead, field.field_key);
              const formatted = formatLeadFieldValue(raw, field.field_type);
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

          {appointmentText ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                  <Calendar className="h-3 w-3" />
                  {truncate(appointmentText, 36)}
                </div>
              </TooltipTrigger>
              <TooltipContent>Cita: {appointmentText}</TooltipContent>
            </Tooltip>
          ) : showAgendaMissingHint ? (
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
            className="mt-3 flex flex-wrap items-center justify-end gap-1"
            onClick={stopPropagation}
          >
            {phoneHref ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                    <a href={phoneHref} aria-label="Llamar">
                      <Phone className="h-3.5 w-3.5" />
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
                    className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950"
                    aria-label="WhatsApp"
                    onClick={handleWhatsappClick}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
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
                  <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                    <a href={emailHref} aria-label="Email">
                      <Mail className="h-3.5 w-3.5" />
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
                  className="relative h-7 w-7"
                  aria-label="Notas"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenNotes();
                  }}
                >
                  <StickyNote className="h-3.5 w-3.5" />
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
                        <p className="font-medium">
                          {NOTE_KIND_LABELS[n.kind] ?? n.kind}{' '}
                          <span className="text-muted-foreground">· {formatNoteDate(n.created_at)}</span>
                        </p>
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
                    className="relative h-7 w-7 text-sky-600"
                    aria-label="Etiquetas"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClick();
                    }}
                  >
                    <Tag className="h-3.5 w-3.5" />
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
                    className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950"
                    aria-label="Crear cliente"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPromote();
                    }}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
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
                  className="h-7 w-7"
                  aria-label="Cita"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/agenda?fromLead=${encodeURIComponent(lead.id)}`);
                  }}
                >
                  <Calendar className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cita (abrir agenda)</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
});
