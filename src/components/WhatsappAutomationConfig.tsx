import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell,
  CalendarClock,
  Clock,
  FlaskConical,
  Phone,
  Send,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_DAY_BEFORE,
  DEFAULT_HOUR_BEFORE,
  useWhatsappAutomationLog,
  useWhatsappAutomationSettings,
} from '@/hooks/useWhatsappAutomationSettings';

const APPOINTMENT_VARS = [
  { key: 'nombre', description: 'Nombre del cliente' },
  { key: 'fecha_cita', description: 'Fecha completa de la cita' },
  { key: 'hora_cita', description: 'Hora de la cita' },
  { key: 'titulo', description: 'Título de la cita' },
  { key: 'profesional', description: 'Profesional asignado' },
];

const HOUR_START_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_END_OPTIONS = Array.from({ length: 24 }, (_, i) => i + 1);

export const WhatsappAutomationConfig: React.FC = () => {
  const { toast } = useToast();
  const { data: settings, isLoading, save, sendTest } = useWhatsappAutomationSettings();
  const { data: log } = useWhatsappAutomationLog(15);

  const [testMode, setTestMode] = useState(true);
  const [testPhone, setTestPhone] = useState('667435503');
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [dayBeforeEnabled, setDayBeforeEnabled] = useState(true);
  const [hourBeforeEnabled, setHourBeforeEnabled] = useState(true);
  const [dayBeforeMsg, setDayBeforeMsg] = useState(DEFAULT_DAY_BEFORE);
  const [hourBeforeMsg, setHourBeforeMsg] = useState(DEFAULT_HOUR_BEFORE);
  const [automationHourStart, setAutomationHourStart] = useState(10);
  const [automationHourEnd, setAutomationHourEnd] = useState(20);
  const [phoneAlertsEnabled, setPhoneAlertsEnabled] = useState(true);
  const [phoneAlertsPhone, setPhoneAlertsPhone] = useState('881242909');

  useEffect(() => {
    if (!settings) return;
    setTestMode(settings.test_mode_enabled);
    setTestPhone(settings.test_phone ?? '667435503');
    setRemindersEnabled(settings.appointment_reminders_enabled);
    setDayBeforeEnabled(settings.appointment_reminder_day_before_enabled);
    setHourBeforeEnabled(settings.appointment_reminder_hour_before_enabled);
    setDayBeforeMsg(settings.appointment_reminder_day_before_message ?? DEFAULT_DAY_BEFORE);
    setHourBeforeMsg(settings.appointment_reminder_hour_before_message ?? DEFAULT_HOUR_BEFORE);
    setAutomationHourStart(settings.marketing_queue_hour_start ?? 10);
    setAutomationHourEnd(settings.marketing_queue_hour_end ?? 20);
    setPhoneAlertsEnabled(settings.phone_missed_whatsapp_enabled ?? true);
    setPhoneAlertsPhone(settings.phone_missed_whatsapp_phone ?? '881242909');
  }, [settings]);

  const persist = async (patch: Record<string, unknown>) => {
    try {
      await save.mutateAsync(patch);
      toast({ title: 'Guardado', description: 'Configuración actualizada.' });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudo guardar',
        variant: 'destructive',
      });
    }
  };

  const handleSaveGeneral = () =>
    persist({
      test_mode_enabled: testMode,
      test_phone: testPhone.replace(/\D/g, '') || '667435503',
      appointment_reminders_enabled: remindersEnabled,
      appointment_reminder_day_before_enabled: dayBeforeEnabled,
      appointment_reminder_hour_before_enabled: hourBeforeEnabled,
      appointment_reminder_day_before_message: dayBeforeMsg,
      appointment_reminder_hour_before_message: hourBeforeMsg,
      marketing_queue_hour_start: automationHourStart,
      marketing_queue_hour_end: Math.max(automationHourStart + 1, automationHourEnd),
      phone_missed_whatsapp_enabled: phoneAlertsEnabled,
      phone_missed_whatsapp_phone: phoneAlertsPhone.replace(/\D/g, '') || '881242909',
    });

  const handleTestSend = async (type: 'day_before' | 'hour_before') => {
    try {
      await handleSaveGeneral();
      const res = await sendTest.mutateAsync(type);
      toast({
        title: 'Mensaje de prueba enviado',
        description: res?.test_mode
          ? `Enviado a ${res.sent_to ?? testPhone} (modo prueba activo).`
          : `Enviado a ${res?.sent_to ?? testPhone}.`,
      });
    } catch (e) {
      toast({
        title: 'Error al enviar prueba',
        description: e instanceof Error ? e.message : 'Fallo desconocido',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground p-4">Cargando automatización…</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground rounded-lg border bg-muted/30 px-3 py-2">
        Los textos de <strong>leads Meta</strong> (bienvenida, recordatorio 3 h, señal Stripe) están
        en <strong>Meta / Leads</strong>. Aquí defines el <strong>horario de envío</strong> común,
        recordatorios de agenda, alertas de centralita e historial.
      </p>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Horario de envíos automáticos
          </CardTitle>
          <CardDescription>
            Todos los WhatsApp automáticos (bienvenida a leads, cola, recordatorios Meta, citas,
            alertas de teléfono y post-pago Stripe) solo salen entre estas horas (hora de Madrid).
            Los leads nuevos dentro del horario reciben la bienvenida al instante; fuera del horario
            se encolan y salen al abrir la ventana.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Select
              value={String(automationHourStart)}
              onValueChange={(v) => setAutomationHourStart(Number(v))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOUR_START_OPTIONS.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {String(h).padStart(2, '0')}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta (no inclusive)</Label>
            <Select
              value={String(automationHourEnd)}
              onValueChange={(v) => setAutomationHourEnd(Number(v))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOUR_END_OPTIONS.filter((h) => h > automationHourStart).map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {String(h).padStart(2, '0')}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] text-muted-foreground max-w-md">
            Ejemplo: 10:00–20:00 envía de 10:00 a 19:59. La cola gradual (máx. 100/día) sigue activa
            dentro de este horario.
          </p>
        </CardContent>
      </Card>

      <Card className="border-amber-200/80 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4" />
            Modo prueba
          </CardTitle>
          <CardDescription>
            Mientras esté activo, todos los envíos automáticos van a tu WhatsApp ({testPhone}) con
            prefijo <code className="text-xs">[PRUEBA — mensaje para …]</code>. Desactívalo cuando
            quieras que cada cliente reciba su notificación.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-3">
            <Switch checked={testMode} onCheckedChange={setTestMode} id="wa-test-mode" />
            <Label htmlFor="wa-test-mode">Modo prueba activo</Label>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">WhatsApp de prueba</Label>
            <Input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="w-40"
              placeholder="667435503"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="citas" className="w-full">
        <TabsList>
          <TabsTrigger value="citas" className="gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            Citas
          </TabsTrigger>
          <TabsTrigger value="telefono" className="gap-1.5">
            <Phone className="h-3.5 w-3.5" />
            Teléfono
          </TabsTrigger>
          <TabsTrigger value="log" className="gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="citas" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recordatorios de cita</CardTitle>
              <CardDescription>
                Aviso al cliente el día anterior y 1 hora antes de la cita, solo dentro del horario
                de envíos automáticos ({String(automationHourStart).padStart(2, '0')}:00–
                {String(automationHourEnd).padStart(2, '0')}:00 Madrid). Requiere teléfono en la
                ficha del cliente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <Label>Recordatorios activos</Label>
                <Switch checked={remindersEnabled} onCheckedChange={setRemindersEnabled} />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {APPOINTMENT_VARS.map((v) => (
                  <Badge key={v.key} variant="secondary" className="font-mono text-[10px]">
                    {`{${v.key}}`}
                  </Badge>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Día anterior</Label>
                    <Switch checked={dayBeforeEnabled} onCheckedChange={setDayBeforeEnabled} />
                  </div>
                  <Textarea
                    value={dayBeforeMsg}
                    onChange={(e) => setDayBeforeMsg(e.target.value)}
                    rows={4}
                    className="text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={sendTest.isPending}
                    onClick={() => handleTestSend('day_before')}
                  >
                    <Send className="h-3 w-3" />
                    Probar envío
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">1 hora antes</Label>
                    <Switch checked={hourBeforeEnabled} onCheckedChange={setHourBeforeEnabled} />
                  </div>
                  <Textarea
                    value={hourBeforeMsg}
                    onChange={(e) => setHourBeforeMsg(e.target.value)}
                    rows={4}
                    className="text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={sendTest.isPending}
                    onClick={() => handleTestSend('hour_before')}
                  >
                    <Send className="h-3 w-3" />
                    Probar envío
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="telefono" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alertas de centralita</CardTitle>
              <CardDescription>
                Aviso por WhatsApp de llamadas perdidas y mensajes en el buzón de voz de Issabel,
                solo dentro del horario de envíos automáticos. Incluye transcripción del audio cuando
                está disponible. Estos avisos van siempre al número indicado (no usan el modo prueba).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <Label>Alertas de teléfono activas</Label>
                <Switch checked={phoneAlertsEnabled} onCheckedChange={setPhoneAlertsEnabled} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">WhatsApp destino (avisos internos)</Label>
                <Input
                  value={phoneAlertsPhone}
                  onChange={(e) => setPhoneAlertsPhone(e.target.value)}
                  className="w-48"
                  placeholder="881242909"
                />
                <p className="text-[11px] text-muted-foreground">
                  Por defecto el teléfono de la clínica. Requiere sesión WAHA activa y cron en el
                  servidor (cada 2 min).
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Últimos envíos automáticos</CardTitle>
            </CardHeader>
            <CardContent>
              {(log ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin envíos registrados aún.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {(log ?? []).map((row) => (
                    <li key={row.id} className="rounded border px-3 py-2">
                      <div className="flex flex-wrap gap-2 items-center">
                        <Badge variant={row.success ? 'default' : 'destructive'}>
                          {row.automation_type}
                        </Badge>
                        <span className="text-muted-foreground">
                          {new Date(row.created_at).toLocaleString('es-ES')}
                        </span>
                        {row.intended_phone ? (
                          <span>→ previsto: {row.intended_phone}</span>
                        ) : null}
                        {row.sent_to_phone ? <span>enviado a: {row.sent_to_phone}</span> : null}
                      </div>
                      {row.message_preview ? (
                        <p className="mt-1 text-muted-foreground line-clamp-2">{row.message_preview}</p>
                      ) : null}
                      {row.error ? <p className="text-destructive mt-1">{row.error}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSaveGeneral} disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : 'Guardar configuración'}
        </Button>
      </div>
    </div>
  );
};
