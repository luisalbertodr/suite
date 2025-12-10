import React, { useState } from 'react';
import { 
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
  ChevronUp
} from 'lucide-react';
import { useArticles } from '@/hooks/useArticles';
import { useArticleVariations } from '@/hooks/useArticleVariations';
import { supabase } from '@/integrations/supabase/client';
import { ArticleForm } from './ArticleForm';
import { FamilyManager } from './FamilyManager';

export const Articulos: React.FC = () => {
  const { articles, loading, deleteArticle, refetch } = useArticles();
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showFamilyManager, setShowFamilyManager] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [expandedArticles, setExpandedArticles] = useState<{[key: string]: boolean}>({});
  const [articleVariations, setArticleVariations] = useState<{[key: string]: any[]}>({});
  const [loadingVariations, setLoadingVariations] = useState<{[key: string]: boolean}>({});

  const filteredArticles = articles.filter(article =>
    article.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.familia.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.tipo_producto.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const articulosBajoStock = articles.filter(art => art.stock_actual <= art.stock_minimo);
  const familias = [...new Set(articles.map(art => art.familia))];

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este artículo?')) {
      await deleteArticle(id);
    }
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
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const hasVariations = (article: any) => {
    return article.tipo_producto === 'textil' || article.tipo_producto === 'calzado';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Artículos</h1>
          <p className="text-gray-600">Gestión de inventario y productos</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowFamilyManager(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all shadow-lg"
          >
            <Settings className="w-4 h-4" />
            <span>Gestionar Familias</span>
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Artículo</span>
          </button>
        </div>
      </div>

      {articulosBajoStock.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
            <span className="text-yellow-800 font-medium">
              {articulosBajoStock.length} artículo(s) con stock bajo
            </span>
          </div>
          <div className="mt-2 text-sm text-yellow-700">
            {articulosBajoStock.map(art => art.descripcion).join(', ')}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Artículos</p>
              <p className="text-2xl font-bold text-gray-900">{articles.length}</p>
            </div>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Familias</p>
              <p className="text-2xl font-bold text-gray-900">{familias.length}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Stock Total</p>
              <p className="text-2xl font-bold text-gray-900">
                {articles.reduce((sum, art) => sum + art.stock_actual, 0)}
              </p>
            </div>
            <Barcode className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Stock Bajo</p>
              <p className="text-2xl font-bold text-red-600">{articulosBajoStock.length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar por descripción, código, familia o tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex space-x-2">
            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Filter className="w-4 h-4" />
              <span>Filtrar por familia</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Artículo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo / Familia
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Precio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Variaciones
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Códigos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredArticles.map((articulo) => (
                <React.Fragment key={articulo.id}>
                  <tr className="hover:bg-gray-50 transition-colors">
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
                            className="text-sm font-medium text-gray-900 hover:text-blue-600 cursor-pointer transition-colors"
                            onClick={() => handleEdit(articulo)}
                            title="Haz clic para editar este artículo"
                          >
                            {articulo.descripcion}
                          </div>
                          <div className="text-sm text-gray-500">
                            {articulo.codigo}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getProductTypeColor(articulo.tipo_producto)}`}>
                          {getProductTypeLabel(articulo.tipo_producto)}
                        </span>
                        <br />
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {articulo.familia}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      €{articulo.precio.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`text-sm font-medium ${
                          articulo.stock_actual <= articulo.stock_minimo ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {articulo.stock_actual}
                        </span>
                        <span className="text-xs text-gray-500 ml-1">
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
                        <span className="text-sm text-gray-400">Sin variaciones</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
                          title="Eliminar artículo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {expandedArticles[articulo.id] && hasVariations(articulo) && (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 bg-gray-50">
                        {loadingVariations[articulo.id] ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                            <span className="ml-2 text-sm text-gray-600">Cargando variaciones...</span>
                          </div>
                        ) : articleVariations[articulo.id] && articleVariations[articulo.id].length > 0 ? (
                          <div className="space-y-3">
                            <h4 className="text-sm font-medium text-gray-900 mb-3">
                              Variaciones de {articulo.descripcion}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {articleVariations[articulo.id].map((variation) => (
                                <div key={variation.id} className="bg-white rounded-lg border border-gray-200 p-3">
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
                                  <div className="space-y-1 text-xs text-gray-600">
                                    <div className="flex justify-between">
                                      <span>Precio:</span>
                                      <span className="font-medium text-gray-900">€{variation.precio.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Stock:</span>
                                      <span className={`font-medium ${
                                        variation.stock_actual <= variation.stock_minimo ? 'text-red-600' : 'text-gray-900'
                                      }`}>
                                        {variation.stock_actual}
                                        {variation.stock_actual <= variation.stock_minimo && (
                                          <AlertTriangle className="w-3 h-3 inline ml-1 text-red-500" />
                                        )}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Mín:</span>
                                      <span className="font-medium text-gray-900">{variation.stock_minimo}</span>
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
                            <p className="text-sm text-gray-500">No hay variaciones creadas para este artículo</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ArticleForm
          article={selectedArticle}
          onClose={handleCloseForm}
          onSave={handleSaveArticle}
        />
      )}

      {showFamilyManager && (
        <FamilyManager onClose={() => setShowFamilyManager(false)} />
      )}
    </div>
  );
};
