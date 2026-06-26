import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Archive,
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Filter,
  Package,
  Barcode,
  AlertTriangle,
  TrendingUp,
  Settings,
  Eye,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { useArticles } from '@/hooks/useArticles';
import { useArticleVariations } from '@/hooks/useArticleVariations';
import { useFamilies } from '@/hooks/useFamilies';
import { supabase } from '@/lib/supabase';
import { chunkArray } from '@/lib/chunkArray';
import { useRoutePanelActive } from '@/contexts/RoutePanelContext';
import { ArticleForm } from './ArticleForm';
import { FamilyManager } from './FamilyManager';
import { BonusDefinitionsManager } from './BonusDefinitionsManager';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRegisterTopBarContent } from '@/components/TopBarContentContext';
export const Articulos: React.FC = () => {
  const panelActive = useRoutePanelActive();
  const { articles, loading, deleteArticle, refetch } = useArticles({ enabled: panelActive });
  const { families } = useFamilies();
  const [searchTerm, setSearchTerm] = useState('');
  const [familyFilter, setFamilyFilter] = useState<string | null>(null);
  const [familyFilterOpen, setFamilyFilterOpen] = useState(false);
  const [activeKind, setActiveKind] = useState<'producto' | 'servicio' | 'bono'>('producto');
  const [showObsolete, setShowObsolete] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showFamilyManager, setShowFamilyManager] = useState(false);
  const [showBonusDefinitionsManager, setShowBonusDefinitionsManager] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [expandedArticles, setExpandedArticles] = useState<{[key: string]: boolean}>({});
  const [articleVariations, setArticleVariations] = useState<{[key: string]: any[]}>({});
  const [loadingVariations, setLoadingVariations] = useState<{[key: string]: boolean}>({});

  const cutoffOneYearAgo = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString();
  }, []);

  const activeArticles = useMemo(
    () => articles.filter((article) => article.estado === 'activo'),
    [articles],
  );

  const inactiveArticleIds = useMemo(
    () => articles.filter((article) => article.estado !== 'activo').map((article) => article.id),
    [articles],
  );

  const { data: recentlyUsedInactiveArticleIds = new Set<string>() } = useQuery({
    queryKey: ['obsolete-article-recent-usage', inactiveArticleIds.length, cutoffOneYearAgo],
    enabled: panelActive && inactiveArticleIds.length > 0,
    queryFn: async () => {
      const used = new Set<string>();
      for (const batch of chunkArray(inactiveArticleIds, 40)) {
        const { data, error } = await supabase
          .from('appointment_items')
          .select('article_id, agenda_appointments!inner(start_time)')
          .in('article_id', batch)
          .gte('agenda_appointments.start_time', cutoffOneYearAgo);
        if (error) throw error;
        for (const row of data ?? []) {
          if (row.article_id) used.add(row.article_id);
        }
      }
      return used;
    },
  });

  const obsoleteArticles = useMemo(
    () =>
      articles.filter(
        (article) =>
          article.estado !== 'activo' && !recentlyUsedInactiveArticleIds.has(article.id),
      ),
    [articles, recentlyUsedInactiveArticleIds],
  );

  const activeFamilyNames = useMemo(
    () => new Set(activeArticles.map((article) => article.familia).filter(Boolean)),
    [activeArticles],
  );

  const obsoleteFamilies = useMemo(
    () => families.filter((family) => !activeFamilyNames.has(family.name)),
    [activeFamilyNames, families],
  );

  const visibleArticles = showObsolete ? obsoleteArticles : activeArticles;

  const articlesForKind = useMemo(
    () => visibleArticles.filter((article) => (article.article_kind || 'producto') === activeKind),
    [visibleArticles, activeKind],
  );

  const familyOptions = useMemo(
    () =>
      [...new Set(articlesForKind.map((art) => art.familia).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'es'),
      ),
    [articlesForKind],
  );

  const filteredArticles = articlesForKind.filter((article) => {
    if (familyFilter && article.familia !== familyFilter) return false;
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    return (
      article.descripcion.toLowerCase().includes(term) ||
      article.codigo.toLowerCase().includes(term) ||
      article.familia.toLowerCase().includes(term) ||
      article.tipo_producto.toLowerCase().includes(term)
    );
  });

  const articulosBajoStock = activeArticles.filter(art => art.stock_actual <= art.stock_minimo);
  const familias = [...new Set(activeArticles.map(art => art.familia))];

  const handleKindChange = (kind: 'producto' | 'servicio' | 'bono') => {
    setActiveKind(kind);
    setFamilyFilter(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Enviar este artículo a Obsoleto? Dejará de aparecer en agenda, TPV y facturación.')) {
      await deleteArticle(id);
    }
  };

  const handleRestore = async (id: string) => {
    const { error } = await supabase.from('articles').update({ estado: 'activo' }).eq('id', id);
    if (error) throw error;
    await refetch();
  };

  const handleEdit = (article: any) => {
    setSelectedArticle(article);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedArticle(null);
  };

  const handleSaveArticle = async () => {
    console.log('Refreshing articles list after save...');
    await refetch();
    console.log('Articles list refreshed');
  };

  const loadVariations = async (articleId: string) => {
    if (articleVariations[articleId]) return;
    
    setLoadingVariations(prev => ({ ...prev, [articleId]: true }));
    
    try {
      const { data, error } = await supabase
        .from('article_variations')
        .select('*')
        .eq('article_id', articleId)
        .order('talla', { ascending: true });

      if (error) throw error;
      
      setArticleVariations(prev => ({ 
        ...prev, 
        [articleId]: data || [] 
      }));
    } catch (error) {
      console.error('Error loading variations:', error);
    } finally {
      setLoadingVariations(prev => ({ ...prev, [articleId]: false }));
    }
  };

  const toggleVariations = async (articleId: string) => {
    const isExpanded = expandedArticles[articleId];
    
    if (!isExpanded) {
      await loadVariations(articleId);
    }
    
    setExpandedArticles(prev => ({
      ...prev,
      [articleId]: !isExpanded
    }));
  };

  const getProductTypeLabel = (tipo: string) => {
    switch (tipo) {
      case 'textil':
        return 'Textil';
      case 'calzado':
        return 'Calzado';
      case 'standard':
        return 'Standard';
      default:
        return tipo;
    }
  };

  const getProductTypeColor = (tipo: string) => {
    switch (tipo) {
      case 'textil':
        return 'bg-purple-100 text-purple-800';
      case 'calzado':
        return 'bg-orange-100 text-orange-800';
      case 'standard':
        return 'bg-muted text-foreground';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const hasVariations = (article: any) => {
    return article.tipo_producto === 'textil' || article.tipo_producto === 'calzado';
  };

  const topBarActions = useMemo(() => (
    <>
      <button
        onClick={() => setShowFamilyManager(true)}
        className="flex h-7 items-center space-x-1.5 rounded-md bg-gradient-to-r from-green-500 to-green-600 px-2 text-xs text-white shadow-sm transition-all hover:from-green-600 hover:to-green-700"
      >
        <Settings className="w-3.5 h-3.5" />
        <span>Familias</span>
      </button>
      {activeKind === 'bono' && (
        <button
          onClick={() => setShowBonusDefinitionsManager(true)}
          className="flex h-7 items-center space-x-1.5 rounded-md bg-gradient-to-r from-violet-500 to-violet-600 px-2 text-xs text-white shadow-sm transition-all hover:from-violet-600 hover:to-violet-700"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Bonos</span>
        </button>
      )}
      <button
        onClick={() => setShowForm(true)}
        className="flex h-7 items-center space-x-1.5 rounded-md bg-gradient-to-r from-blue-500 to-blue-600 px-2 text-xs text-white shadow-sm transition-all hover:from-blue-600 hover:to-blue-700"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Nuevo Artículo</span>
      </button>
    </>
  ), [activeKind]);

  useRegisterTopBarContent(
    {
      title: (
        <span className="inline-flex items-center gap-2">
          <Package className="w-4 h-4 text-purple-500" />
          Artículos
        </span>
      ),
      actions: topBarActions,
    },
    [topBarActions],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Artículos</p>
              <p className="text-2xl font-bold text-foreground">{articles.length}</p>
            </div>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Familias</p>
              <p className="text-2xl font-bold text-foreground">{familias.length}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Stock Total</p>
              <p className="text-2xl font-bold text-foreground">
                {articles.reduce((sum, art) => sum + art.stock_actual, 0)}
              </p>
            </div>
            <Barcode className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Stock Bajo</p>
              <p className="text-2xl font-bold text-red-600">{articulosBajoStock.length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
        <div className="mb-4 inline-flex rounded-lg border border-border p-1 bg-muted">
          {(['producto', 'servicio', 'bono'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => handleKindChange(kind)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                activeKind === kind ? 'bg-background shadow text-blue-700 dark:text-blue-300' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {kind === 'producto' ? 'Productos' : kind === 'servicio' ? 'Servicios' : 'Bonos'}
            </button>
          ))}
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar por descripción, código, familia o tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setShowObsolete((prev) => !prev);
                setFamilyFilter(null);
              }}
              className={`flex items-center space-x-2 px-4 py-2 border rounded-lg transition-colors ${
                showObsolete
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100'
                  : 'border-border hover:bg-accent'
              }`}
              title="Ver familias sin artículos activos y artículos inactivos sin citas durante el último año"
            >
              <Archive className="w-4 h-4 shrink-0" />
              <span>Obsoleto</span>
              {(obsoleteArticles.length + obsoleteFamilies.length) > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                  {obsoleteArticles.length + obsoleteFamilies.length}
                </span>
              )}
            </button>
            <Popover open={familyFilterOpen} onOpenChange={setFamilyFilterOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`flex items-center space-x-2 px-4 py-2 border rounded-lg transition-colors ${
                    familyFilter
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  <Filter className="w-4 h-4 shrink-0" />
                  <span className="max-w-[200px] truncate">
                    {familyFilter ?? 'Filtrar por familia'}
                  </span>
                  <ChevronDown className="w-4 h-4 shrink-0 opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-2">
                <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Familia
                </p>
                <div className="max-h-64 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setFamilyFilter(null);
                      setFamilyFilterOpen(false);
                    }}
                    className={`w-full text-left px-2 py-2 rounded-md text-sm hover:bg-accent ${
                      !familyFilter ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    Todas las familias
                  </button>
                  {familyOptions.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground">No hay familias en esta pestaña</p>
                  ) : (
                    familyOptions.map((familia) => (
                      <button
                        key={familia}
                        type="button"
                        onClick={() => {
                          setFamilyFilter(familia);
                          setFamilyFilterOpen(false);
                        }}
                        className={`w-full text-left px-2 py-2 rounded-md text-sm hover:bg-accent truncate ${
                          familyFilter === familia
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 font-medium'
                            : 'text-muted-foreground'
                        }`}
                        title={familia}
                      >
                        {familia}
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {familyFilter && (
              <button
                type="button"
                onClick={() => setFamilyFilter(null)}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Quitar filtro
              </button>
            )}
          </div>
        </div>
        {showObsolete && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-medium">Vista Obsoleto</p>
            <p>
              Aquí aparecen familias sin artículos activos y artículos inactivos que no figuran en
              ninguna cita desde hace más de 1 año. No se ofrecen en agenda, TPV ni facturación
              mientras sigan inactivos.
            </p>
          </div>
        )}
      </div>

      {showObsolete && obsoleteFamilies.length > 0 && (
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Familias sin artículos activos</h2>
              <p className="text-sm text-muted-foreground">
                Crea o reactiva artículos dentro de estas familias para volver a usarlas.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowFamilyManager(true)}
              className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all shadow"
            >
              <Settings className="w-4 h-4" />
              <span>Gestionar Familias</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {obsoleteFamilies.map((family) => (
              <span
                key={family.id}
                className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                {family.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Artículo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Tipo / Familia
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Precio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Variaciones
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Códigos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {filteredArticles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-muted-foreground">
                    {showObsolete
                      ? 'No hay artículos obsoletos para esta pestaña.'
                      : 'No hay artículos que coincidan con los filtros.'}
                  </td>
                </tr>
              ) : filteredArticles.map((articulo) => [
                  <tr key={articulo.id} className="hover:bg-muted transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {articulo.foto_url ? (
                          <img
                            src={articulo.foto_url}
                            alt={articulo.descripcion}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center text-white font-semibold">
                            {articulo.codigo.charAt(0)}
                          </div>
                        )}
                        <div className="ml-3">
                          <div 
                            className="text-sm font-medium text-foreground hover:text-blue-600 cursor-pointer transition-colors"
                            onClick={() => handleEdit(articulo)}
                            title="Haz clic para editar este artículo"
                          >
                            {articulo.descripcion}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {articulo.codigo}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getProductTypeColor(articulo.tipo_producto)}`}>
                          {articulo.article_kind === 'servicio' ? 'Servicio' : articulo.article_kind === 'bono' ? 'Bono' : getProductTypeLabel(articulo.tipo_producto)}
                        </span>
                        <br />
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {articulo.familia}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground font-medium">
                      €{articulo.precio.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`text-sm font-medium ${
                          articulo.stock_actual <= articulo.stock_minimo ? 'text-red-600' : 'text-foreground'
                        }`}>
                          {articulo.stock_actual}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          (mín: {articulo.stock_minimo})
                        </span>
                        {articulo.stock_actual <= articulo.stock_minimo && (
                          <AlertTriangle className="w-4 h-4 text-red-500 ml-2" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {hasVariations(articulo) ? (
                        <button
                          onClick={() => toggleVariations(articulo.id)}
                          className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="text-sm">
                            {loadingVariations[articulo.id] ? 'Cargando...' : 
                             articleVariations[articulo.id] ? `${articleVariations[articulo.id].length} variaciones` : 'Ver variaciones'}
                          </span>
                          {expandedArticles[articulo.id] ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      ) : (
                        <span className="text-sm text-muted-foreground">Sin variaciones</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <Barcode className="w-4 h-4 mr-1" />
                        {articulo.codigo_barras || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        articulo.estado === 'activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {articulo.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {showObsolete ? (
                          <button
                            onClick={() => void handleRestore(articulo.id)}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 transition-colors"
                            title="Dar de alta el artículo"
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span>Dar de alta</span>
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEdit(articulo)}
                              className="text-green-600 hover:text-green-900 transition-colors"
                              title="Editar artículo"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(articulo.id)}
                              className="text-red-600 hover:text-red-900 transition-colors"
                              title="Enviar a obsoletos"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>,
                  
                  expandedArticles[articulo.id] && hasVariations(articulo) ? (
                    <tr key={`${articulo.id}-variations`}>
                      <td colSpan={8} className="px-6 py-4 bg-muted">
                        {loadingVariations[articulo.id] ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                            <span className="ml-2 text-sm text-muted-foreground">Cargando variaciones...</span>
                          </div>
                        ) : articleVariations[articulo.id] && articleVariations[articulo.id].length > 0 ? (
                          <div className="space-y-3">
                            <h4 className="text-sm font-medium text-foreground mb-3">
                              Variaciones de {articulo.descripcion}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {articleVariations[articulo.id].map((variation) => (
                                <div key={variation.id} className="bg-card rounded-lg border border-border p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex space-x-2">
                                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                        {articulo.tipo_producto === 'calzado' ? `Nº ${variation.talla}` : `Talla: ${variation.talla}`}
                                      </span>
                                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                        {variation.color}
                                      </span>
                                    </div>
                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                      variation.estado === 'activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                      {variation.estado}
                                    </span>
                                  </div>
                                  <div className="space-y-1 text-xs text-muted-foreground">
                                    <div className="flex justify-between">
                                      <span>Precio:</span>
                                      <span className="font-medium text-foreground">€{variation.precio.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Stock:</span>
                                      <span className={`font-medium ${
                                        variation.stock_actual <= variation.stock_minimo ? 'text-red-600' : 'text-foreground'
                                      }`}>
                                        {variation.stock_actual}
                                        {variation.stock_actual <= variation.stock_minimo && (
                                          <AlertTriangle className="w-3 h-3 inline ml-1 text-red-500" />
                                        )}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Mín:</span>
                                      <span className="font-medium text-foreground">{variation.stock_minimo}</span>
                                    </div>
                                    {variation.codigo_barras && (
                                      <div className="flex justify-between">
                                        <span>Código:</span>
                                        <span className="font-mono text-xs">{variation.codigo_barras}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <p className="text-sm text-muted-foreground">No hay variaciones creadas para este artículo</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : null
                ])}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ArticleForm
          article={selectedArticle}
          initialArticleKind={selectedArticle ? undefined : activeKind}
          onClose={handleCloseForm}
          onSave={handleSaveArticle}
        />
      )}

      {showFamilyManager && (
        <FamilyManager onClose={() => setShowFamilyManager(false)} />
      )}

      {showBonusDefinitionsManager && (
        <BonusDefinitionsManager onClose={() => setShowBonusDefinitionsManager(false)} />
      )}
    </div>
  );
};
