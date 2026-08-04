import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageCircle, PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useMarketingCtwaCampaigns,
  type MarketingCtwaCampaign,
} from '@/hooks/useMarketingCtwaCampaigns';
import { useMetaConfig } from '@/hooks/useMetaConfig';
import { WHATSAPP_MESSAGE_TEMPLATE_VARS } from '@/lib/whatsappMessageTemplates';

const NONE_FORM = '__none__';

function CampaignEditor({
  campaign,
  forms,
  onSave,
  onDelete,
  saving,
  deleting,
}: {
  campaign: MarketingCtwaCampaign;
  forms: Array<{ id: string; form_name: string | null; form_id: string }>;
  onSave: (values: {
    name: string;
    match_keywords: string;
    intro_message: string | null;
    intro_enabled: boolean;
    meta_form_id: string | null;
    is_default: boolean;
    enabled: boolean;
  }) => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
}) {
  const [name, setName] = useState(campaign.name);
  const [keywords, setKeywords] = useState(campaign.match_keywords ?? '');
  const [intro, setIntro] = useState(campaign.intro_message ?? '');
  const [introEnabled, setIntroEnabled] = useState(campaign.intro_enabled);
  const [metaFormId, setMetaFormId] = useState(campaign.meta_form_id ?? NONE_FORM);
  const [isDefault, setIsDefault] = useState(campaign.is_default);
  const [enabled, setEnabled] = useState(campaign.enabled);

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{campaign.name}</p>
          {campaign.is_default ? (
            <Badge variant="secondary" className="text-[10px]">
              Por defecto
            </Badge>
          ) : null}
          {!campaign.enabled ? (
            <Badge variant="outline" className="text-[10px]">
              Pausada
            </Badge>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-destructive hover:bg-destructive/10"
          disabled={deleting}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1 md:col-span-2">
          <Label className="text-[11px]">Nombre en Marketing</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Glow Pepitas Oro – WhatsApp"
            className="text-sm"
          />
          <p className="text-[10px] text-muted-foreground">
            Así se verá la campaña en el embudo y en el filtro de Marketing.
          </p>
        </div>

        <div className="space-y-1 md:col-span-2">
          <Label className="text-[11px]">Keywords de detección (una por línea)</Label>
          <Textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            rows={3}
            className="text-xs font-mono"
            placeholder={'Glow Pepitas\nPepitas Oro\ntexto del mensaje prefijado del anuncio'}
          />
          <p className="text-[10px] text-muted-foreground">
            Se buscan en el texto del anuncio o en el primer mensaje del contacto (mensaje
            prefijado de Meta).
          </p>
        </div>

        <div className="space-y-1 md:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[11px]">Mensaje introductorio automático</Label>
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Switch checked={introEnabled} onCheckedChange={setIntroEnabled} />
              Enviar al crear el lead
            </label>
          </div>
          <Textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            rows={5}
            className="text-xs"
            placeholder="Hola {nombre}, gracias por contactarnos por la campaña {campana}…"
            disabled={!introEnabled}
          />
          <div className="mt-1 flex flex-wrap gap-1.5">
            {WHATSAPP_MESSAGE_TEMPLATE_VARS.slice(0, 8).map((v) => (
              <span
                key={v.key}
                title={v.description}
                className="cursor-help rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {`{${v.key}}`}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px]">Formulario Meta vinculado (opcional)</Label>
          <Select value={metaFormId} onValueChange={setMetaFormId}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Ninguno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_FORM}>Ninguno</SelectItem>
              {forms.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.form_name?.trim() || f.form_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">
            Sirve para audio de campaña / señal Stripe del formulario.
          </p>
        </div>

        <div className="flex flex-col gap-2 justify-end">
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
            Campaña por defecto
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </label>
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
            Activa
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={saving || !name.trim()}
          onClick={() =>
            onSave({
              name: name.trim(),
              match_keywords: keywords,
              intro_message: intro.trim() || null,
              intro_enabled: introEnabled,
              meta_form_id: metaFormId === NONE_FORM ? null : metaFormId,
              is_default: isDefault,
              enabled,
            })
          }
        >
          Guardar campaña
        </Button>
      </div>
    </div>
  );
}

export const MarketingCtwaCampaignsConfig: React.FC = () => {
  const { toast } = useToast();
  const { campaigns, isLoading, createCampaign, updateCampaign, deleteCampaign } =
    useMarketingCtwaCampaigns();
  const { forms } = useMetaConfig();
  const [newName, setNewName] = useState('');

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createCampaign.mutateAsync({
        name,
        match_keywords: name,
        intro_enabled: true,
        intro_message:
          'Hola {nombre}, gracias por escribirnos por la campaña {campana}. ¿En qué podemos ayudarte?',
        is_default: campaigns.length === 0,
        enabled: true,
      });
      setNewName('');
      toast({ title: 'Campaña CTWA creada' });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudo crear',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-500/10 p-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <CardTitle>Interacciones directas (Click to WhatsApp)</CardTitle>
            <CardDescription>
              Define cada campaña de WhatsApp de Meta: un nombre para distinguirla en el
              embudo y un mensaje introductorio automático al recibir el primer contacto.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre de la campaña (ej. Glow Pepitas Oro – WhatsApp)"
            className="max-w-md text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleCreate();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={createCampaign.isPending || !newName.trim()}
            onClick={() => void handleCreate()}
          >
            <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
            Añadir campaña
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando campañas…</p>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay campañas de interacción directa. Crea una por cada anuncio Click to
            WhatsApp de Meta.
          </p>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => (
              <CampaignEditor
                key={c.id}
                campaign={c}
                forms={forms}
                saving={updateCampaign.isPending}
                deleting={deleteCampaign.isPending}
                onSave={(values) => {
                  updateCampaign.mutate(
                    { id: c.id, values },
                    {
                      onSuccess: () => toast({ title: 'Campaña actualizada' }),
                      onError: (e) =>
                        toast({
                          title: 'Error',
                          description: e instanceof Error ? e.message : 'No se pudo guardar',
                          variant: 'destructive',
                        }),
                    },
                  );
                }}
                onDelete={() => {
                  deleteCampaign.mutate(c.id, {
                    onSuccess: () => toast({ title: 'Campaña eliminada' }),
                    onError: (e) =>
                      toast({
                        title: 'Error',
                        description: e instanceof Error ? e.message : 'No se pudo eliminar',
                        variant: 'destructive',
                      }),
                  });
                }}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
