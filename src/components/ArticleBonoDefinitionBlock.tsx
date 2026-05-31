import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { BonusDefinitionItemsEditor, type BonoCoverageItem } from '@/components/bonus/BonusDefinitionItemsEditor';
import type { ArticleFormData } from '@/hooks/useArticles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type ArticleBonoDefinitionBlockRef = {
  /** Guarda composición y vincula el artículo a `bonus_definitions`. */
  persist: (articleId: string) => Promise<void>;
};

function parseBonoCode(legacyCodart: string | null | undefined, codigo: string): string {
  const lc = (legacyCodart || '').trim();
  if (lc.toUpperCase().startsWith('BONO:')) {
    return lc.slice(5).trim();
  }
  return (codigo || '').trim();
}

function mapRowsToItems(rows: any[]): BonoCoverageItem[] {
  return (rows || []).map((it: any) => {
    const a = it.articles;
    const lblFromArt =
      a && typeof a === 'object'
        ? `${(a as any).codigo ? `${(a as any).codigo} - ` : ''}${(a as any).descripcion || 'Artículo'}`.trim()
        : it.family_code
          ? `Familia ${it.family_code}`
          : 'Cobertura';
    return {
      id: it.id,
      coverage_type: (it.coverage_type ?? 'service') as BonoCoverageItem['coverage_type'],
      article_id: it.article_id ?? null,
      family_code: it.family_code ?? null,
      covered_quantity: Number(it.covered_quantity ?? 1),
      label: (it.notes as string) || lblFromArt,
    };
  });
}

function totalSessionsFromItems(items: BonoCoverageItem[]): number {
  const n = items
    .filter((i) => i.coverage_type === 'service')
    .reduce((s, i) => s + Number(i.covered_quantity || 0), 0);
  return Math.max(1, Math.round(n) || 1);
}

interface Props {
  companyId: string | null;
  articleKind: ArticleFormData['article_kind'];
  formData: Pick<ArticleFormData, 'codigo' | 'descripcion' | 'precio'>;
  bonusDefinitionId: string | null | undefined;
  legacyCodart: string | null | undefined;
  parentLoading?: boolean;
}

export const ArticleBonoDefinitionBlock = forwardRef<ArticleBonoDefinitionBlockRef, Props>(
  ({ companyId, articleKind, formData, bonusDefinitionId, legacyCodart, parentLoading }, ref) => {
    const queryClient = useQueryClient();
    const [items, setItems] = useState<BonoCoverageItem[]>([]);
    const [resolvedDefId, setResolvedDefId] = useState<string | null>(null);

    const bonoCode = useMemo(
      () => parseBonoCode(legacyCodart, formData.codigo),
      [legacyCodart, formData.codigo]
    );

    const enabled = Boolean(companyId) && articleKind === 'bono';

    const { data: catalogArticles = [], isLoading: articlesLoading } = useQuery({
      queryKey: ['article-bono-catalog-articles', companyId],
      enabled: enabled && Boolean(companyId),
      queryFn: async () => {
        const { data, error } = await supabase
          .from('articles')
          .select('id,codigo,descripcion,article_kind,familia,estado')
          .eq('company_id', companyId!)
          .order('descripcion');
        if (error) throw error;
        return data ?? [];
      },
    });

    const { isLoading: defLoading, data: loadedDef } = useQuery({
      queryKey: [
        'article-bono-definition',
        companyId,
        bonusDefinitionId,
        legacyCodart,
        formData.codigo,
        enabled,
      ],
      enabled: enabled && Boolean(companyId) && Boolean(bonusDefinitionId || bonoCode),
      queryFn: async () => {
        if (bonusDefinitionId) {
          const { data, error } = await supabase
            .from('bonus_definitions')
            .select(
              `
              id, code, name, default_price, default_total_sessions,
              bonus_definition_items(
                id, coverage_type, article_id, family_code, covered_quantity, notes,
                articles:article_id(codigo, descripcion)
              )
            `
            )
            .eq('id', bonusDefinitionId)
            .maybeSingle();
          if (error) throw error;
          return data;
        }
        if (!bonoCode) return null;
        const { data, error } = await supabase
          .from('bonus_definitions')
          .select(
            `
            id, code, name, default_price, default_total_sessions,
            bonus_definition_items(
              id, coverage_type, article_id, family_code, covered_quantity, notes,
              articles:article_id(codigo, descripcion)
            )
          `
          )
          .eq('company_id', companyId!)
          .eq('code', bonoCode)
          .maybeSingle();
        if (error) throw error;
        return data;
      },
    });

    useEffect(() => {
      if (!enabled) {
        setItems([]);
        setResolvedDefId(null);
        return;
      }
      if (!loadedDef) {
        if (!defLoading) {
          setItems([]);
          setResolvedDefId(null);
        }
        return;
      }
      setResolvedDefId(String(loadedDef.id));
      const raw = (loadedDef as any).bonus_definition_items ?? [];
      setItems(mapRowsToItems(raw));
    }, [enabled, loadedDef, defLoading]);

    useImperativeHandle(
      ref,
      () => ({
        persist: async (articleId: string) => {
          if (!companyId || articleKind !== 'bono') return;
          const code = parseBonoCode(legacyCodart, formData.codigo);
          if (!code) {
            throw new Error('El artículo bono necesita un código (o importe legacy BONO:...) para guardar la composición.');
          }
          const totalSessions = totalSessionsFromItems(items);
          const name = (formData.descripcion || '').trim() || `Bono ${code}`;
          const price = Number(formData.precio ?? 0);

          const source =
            legacyCodart && legacyCodart.toUpperCase().startsWith('BONO:') ? 'legacy' : 'manual';

          const { data: existing, error: exErr } = await supabase
            .from('bonus_definitions')
            .select('id, source')
            .eq('company_id', companyId)
            .eq('code', code)
            .maybeSingle();

          if (exErr) throw exErr;

          let definitionId: string;
          if (existing?.id) {
            const keepSource = (existing as { source?: string }).source === 'legacy' ? 'legacy' : source;
            const { data: upd, error: uErr } = await supabase
              .from('bonus_definitions')
              .update({
                name: name.slice(0, 255),
                default_price: price,
                default_total_sessions: totalSessions,
                source: keepSource,
              })
              .eq('id', (existing as { id: string }).id)
              .select('id')
              .single();
            if (uErr) throw uErr;
            definitionId = (upd as { id: string })?.id;
          } else {
            const { data: ins, error: iErr } = await supabase
              .from('bonus_definitions')
              .insert({
                company_id: companyId,
                code,
                name: name.slice(0, 255),
                description: null,
                default_price: price,
                default_total_sessions: totalSessions,
                source,
              })
              .select('id')
              .single();
            if (iErr) throw iErr;
            definitionId = (ins as { id: string })?.id;
          }

          if (!definitionId) throw new Error('No se pudo guardar la definición del bono');

          const { error: delErr } = await supabase
            .from('bonus_definition_items')
            .delete()
            .eq('definition_id', definitionId);
          if (delErr) throw delErr;

          if (items.length > 0) {
            const payload = items.map((it) => ({
              definition_id: definitionId,
              coverage_type: it.coverage_type,
              article_id: it.coverage_type === 'family' ? null : (it.article_id ?? null),
              family_code: it.coverage_type === 'family' ? (it.family_code ?? null) : null,
              covered_quantity: Number(it.covered_quantity || 0),
              notes: it.label || null,
            }));
            const { error: insErr } = await supabase.from('bonus_definition_items').insert(payload);
            if (insErr) throw insErr;
          }

          const { error: artErr } = await supabase
            .from('articles')
            .update({ bonus_definition_id: definitionId })
            .eq('id', articleId)
            .eq('company_id', companyId);

          if (artErr) throw artErr;

          setResolvedDefId(definitionId);
          await queryClient.invalidateQueries({ queryKey: ['article-bono-definition'] });
          await queryClient.invalidateQueries({ queryKey: ['bonus-definitions'] });
          await queryClient.invalidateQueries({ queryKey: ['bonus-definitions-manager'] });
        },
      }),
      [companyId, articleKind, items, formData, legacyCodart, queryClient]
    );

    if (!enabled) return null;

    const busy = parentLoading || articlesLoading || defLoading;

    return (
      <Card className="border-blue-100 bg-blue-50/40">
        <CardHeader className="py-3">
          <CardTitle className="text-base">Definir tipo de bono (composición)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Define aquí el tipo de bono: servicios incluidos, productos o familias cubiertas. Este tipo podrá asignarse a clientes desde su ficha (Bonos activos).
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {busy && <p className="text-sm text-muted-foreground">Cargando composición…</p>}
          {resolvedDefId && (
            <p className="text-xs text-muted-foreground">Plantilla vinculada: {bonoCode || '—'}</p>
          )}
          <BonusDefinitionItemsEditor
            items={items}
            onChange={setItems}
            articles={catalogArticles as any[]}
            disabled={!!parentLoading}
          />
        </CardContent>
      </Card>
    );
  }
);

ArticleBonoDefinitionBlock.displayName = 'ArticleBonoDefinitionBlock';
