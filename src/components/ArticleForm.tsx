
import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import { useArticles, ArticleFormData, Article } from '@/hooks/useArticles';
import { useFamilies } from '@/hooks/useFamilies';
import { ArticleVariations } from './ArticleVariations';
import { useArticleVariations, ArticleVariation } from '@/hooks/useArticleVariations';
import { ArticleFormHeader } from './ArticleFormHeader';
import { ArticleFormFields } from './ArticleFormFields';
import { ArticleImageUpload } from './ArticleImageUpload';
import { ArticleFormButtons } from './ArticleFormButtons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface ArticleFormProps {
  article?: Article | null;
  onClose: () => void;
  onSave: () => void;
}

export const ArticleForm: React.FC<ArticleFormProps> = ({ article, onClose, onSave }) => {
  const { createArticle, updateArticle, generateCode } = useArticles();
  const { families, ensureVariosFamilyExists, loading: familiesLoading, error: familiesError } = useFamilies();
  const { createVariations } = useArticleVariations();
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [variations, setVariations] = useState<ArticleVariation[]>([]);
  const [createdArticle, setCreatedArticle] = useState<Article | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [isFormInitialized, setIsFormInitialized] = useState(false);
  
  const [formData, setFormData] = useState<ArticleFormData>({
    codigo: '',
    descripcion: '',
    descripcion_larga: '',
    familia: '',
    precio: 0,
    stock_actual: 0,
    stock_minimo: 0,
    codigo_barras: '',
    codigo_serie: '',
    talla: '',
    color: '',
    tipo_producto: 'standard',
    estado: 'activo',
    iva_percentage: 21
  });

  // Initialize form - only run once
  useEffect(() => {
    console.log('ArticleForm useEffect: initializing form', { 
      article: !!article, 
      isFormInitialized, 
      familiesLoading, 
      familiesError 
    });

    if (article) {
      // Editing existing article - set immediately
      console.log('Setting form data for existing article:', article.id);
      setFormData({
        codigo: article.codigo,
        descripcion: article.descripcion,
        descripcion_larga: article.descripcion_larga || '',
        familia: article.familia,
        precio: article.precio,
        stock_actual: article.stock_actual,
        stock_minimo: article.stock_minimo,
        codigo_barras: article.codigo_barras || '',
        codigo_serie: article.codigo_serie || '',
        talla: '',
        color: '',
        tipo_producto: article.tipo_producto || 'standard',
        estado: article.estado,
        iva_percentage: article.iva_percentage || 21
      });
      setImagePreview(article.foto_url);
      setImageFile(null);
      // Don't set createdArticle for existing articles - this is what was causing the issue
      setInitError(null);
      setIsFormInitialized(true);
      return;
    }

    // Creating new article - only initialize once when families are ready
    if (!isFormInitialized && !familiesLoading && !familiesError && !article) {
      const initializeNewForm = async () => {
        console.log('Initializing new article form - ONE TIME ONLY');
        setIsInitializing(true);
        setInitError(null);
        
        try {
          await ensureVariosFamilyExists();
          
          // Generate code ONLY ONCE
          const defaultCode = generateCode('Varios');
          console.log('Generated code for new article (ONCE):', defaultCode);
          
          setFormData({
            codigo: defaultCode,
            descripcion: '',
            descripcion_larga: '',
            familia: 'Varios',
            precio: 0,
            stock_actual: 0,
            stock_minimo: 0,
            codigo_barras: '',
            codigo_serie: '',
            talla: '',
            color: '',
            tipo_producto: 'standard',
            estado: 'activo',
            iva_percentage: 21
          });
          
          setIsFormInitialized(true);
          console.log('New article form initialized successfully');
        } catch (error) {
          console.error('Error initializing new article form:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          setInitError('Error initializing form: ' + errorMessage);
          
          // Fallback to empty form
          setFormData({
            codigo: '',
            descripcion: '',
            descripcion_larga: '',
            familia: '',
            precio: 0,
            stock_actual: 0,
            stock_minimo: 0,
            codigo_barras: '',
            codigo_serie: '',
            talla: '',
            color: '',
            tipo_producto: 'standard',
            estado: 'activo',
            iva_percentage: 21
          });
        } finally {
          setIsInitializing(false);
        }
      };

      initializeNewForm();
    }
    
    // Reset other states for new article
    if (!article) {
      setImagePreview(null);
      setImageFile(null);
      setVariations([]);
      setCreatedArticle(null);
      setShowSuccessMessage(false);
    }
  }, [article]); // Only depend on article prop

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'precio' || name === 'stock_actual' || name === 'stock_minimo' || name === 'iva_percentage'
        ? parseFloat(value) || 0 
        : value
    }));
  };

  const handleProductTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as 'textil' | 'calzado' | 'standard';
    setFormData(prev => ({
      ...prev,
      tipo_producto: newType
    }));
    
    // Auto-switch to variations tab for textil/calzado products
    if (newType === 'textil' || newType === 'calzado') {
      setActiveTab('variations');
    }
  };

  const handleFamiliaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const familia = e.target.value;
    // Only generate new code if we're not editing an existing article AND the code is empty or default
    const shouldGenerateNewCode = !article && familia && (!formData.codigo || formData.codigo.startsWith('VA'));
    const newCode = shouldGenerateNewCode ? generateCode(familia) : formData.codigo;
    
    console.log('Familia change:', { familia, shouldGenerateNewCode, newCode, currentCode: formData.codigo });
    
    setFormData(prev => ({
      ...prev,
      familia,
      codigo: newCode
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('Image file selected:', file.name, file.size);
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        console.log('Image preview set');
        setImagePreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    console.log('Image removed');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.codigo || !formData.descripcion || !formData.familia) {
      alert('Por favor, complete los campos obligatorios');
      return;
    }

    setLoading(true);
    try {
      console.log('Submitting form with image file:', imageFile ? imageFile.name : 'none');
      
      if (article) {
        console.log('Updating article with ID:', article.id);
        await updateArticle(article.id, formData, imageFile || undefined);
        onSave();
        onClose();
      } else {
        console.log('Creating new article');
        const newArticle = await createArticle(formData, imageFile || undefined);
        
        if (newArticle) {
          setCreatedArticle(newArticle);
          setShowSuccessMessage(true);
          
          // Create variations if they exist
          if (variations.length > 0) {
            const variationsToCreate = variations.map(v => ({
              talla: v.talla,
              color: v.color,
              stock_actual: v.stock_actual,
              stock_minimo: v.stock_minimo,
              precio: v.precio,
              precio_compra: v.precio_compra || 0,
              codigo_barras: v.codigo_barras || '',
              estado: v.estado,
              iva_percentage: v.iva_percentage || 21
            }));
            await createVariations(newArticle.id, variationsToCreate);
          }
          
          // Auto-switch to variations tab for textil/calzado products
          if (formData.tipo_producto === 'textil' || formData.tipo_producto === 'calzado') {
            setActiveTab('variations');
          }
          
          // Hide success message after 3 seconds
          setTimeout(() => setShowSuccessMessage(false), 3000);
          
          // Only close for standard products, keep open for textil/calzado to manage variations
          if (formData.tipo_producto === 'standard') {
            // Call onSave to refresh the list, then close
            onSave();
            setTimeout(() => onClose(), 100); // Small delay to ensure refresh happens
          }
        }
      }
    } catch (error) {
      console.error('Error saving article:', error);
      alert('Error al guardar el artículo: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleVariationsChange = (newVariations: ArticleVariation[]) => {
    setVariations(newVariations);
  };

  const handleFinishAndClose = () => {
    onSave();
    onClose();
  };

  // Show loading if initializing
  if (isInitializing) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Inicializando formulario...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show error if initialization failed
  if (initError) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-red-600">Error de Inicialización</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-700">
                <p className="font-medium mb-2">No se pudo inicializar el formulario</p>
                <p className="text-gray-600">{initError}</p>
                <p className="text-gray-600 mt-2">
                  Esto puede suceder si no tienes una empresa asignada o si hay problemas de conexión. 
                  Por favor, contacta con el administrador del sistema.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Simplified logic for variations visibility
  const showVariationsSection = formData.tipo_producto === 'textil' || formData.tipo_producto === 'calzado';
  const isEditMode = !!article;
  const hasNewlyCreatedArticle = !!createdArticle && !article; // Only true for newly created articles, not edited ones
  const canManageVariations = isEditMode || hasNewlyCreatedArticle;
  
  // The article ID to use for variations - either from existing article or newly created one
  const variationsArticleId = article?.id || createdArticle?.id;

  console.log('ArticleForm render:', {
    showVariationsSection,
    isEditMode,
    hasNewlyCreatedArticle,
    canManageVariations,
    variationsArticleId,
    formDataTipoProducto: formData.tipo_producto,
    articleId: article?.id,
    isFormInitialized
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-7xl h-[90vh] flex flex-col">
        <ArticleFormHeader
          isEditMode={isEditMode}
          showSuccessMessage={showSuccessMessage}
          onClose={onClose}
        />
        
        <div className="flex-1 overflow-hidden">
          {showVariationsSection && canManageVariations ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="px-6 pt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="general">Información General</TabsTrigger>
                  <TabsTrigger value="variations">
                    Variaciones
                    {variations.length > 0 && (
                      <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        {variations.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                <TabsContent value="general" className="p-6 space-y-6 m-0">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <ArticleFormFields
                      formData={formData}
                      families={families}
                      onInputChange={handleInputChange}
                      onProductTypeChange={handleProductTypeChange}
                      onFamiliaChange={handleFamiliaChange}
                      isEditMode={isEditMode}
                      hasCreatedArticle={hasNewlyCreatedArticle}
                    />
                    
                    <ArticleImageUpload
                      imagePreview={imagePreview}
                      onImageChange={handleImageChange}
                      onRemoveImage={handleRemoveImage}
                    />
                  </form>
                </TabsContent>
                
                <TabsContent value="variations" className="p-6 m-0">
                  {isEditMode && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-5 h-5 text-green-600" />
                        <p className="text-green-800 font-medium">
                          Editando artículo existente. Puedes gestionar sus variaciones aquí.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {hasNewlyCreatedArticle && !isEditMode && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-5 h-5 text-blue-600" />
                        <p className="text-blue-800 font-medium">
                          Artículo creado exitosamente. Ahora puedes gestionar sus variaciones.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {variationsArticleId && (
                    <ArticleVariations
                      articleId={variationsArticleId}
                      tipoProducto={formData.tipo_producto as 'textil' | 'calzado' | 'standard'}
                      onVariationsChange={handleVariationsChange}
                    />
                  )}
                </TabsContent>
              </div>
            </Tabs>
          ) : (
            <div className="h-full overflow-y-auto">
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <ArticleFormFields
                  formData={formData}
                  families={families}
                  onInputChange={handleInputChange}
                  onProductTypeChange={handleProductTypeChange}
                  onFamiliaChange={handleFamiliaChange}
                  isEditMode={isEditMode}
                  hasCreatedArticle={hasNewlyCreatedArticle}
                />

                {!canManageVariations && (
                  <ArticleImageUpload
                    imagePreview={imagePreview}
                    onImageChange={handleImageChange}
                    onRemoveImage={handleRemoveImage}
                  />
                )}
              </form>
              
              {showVariationsSection && !canManageVariations && (
                <div className="p-6 border-t border-gray-200">
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium mb-2">
                      Primero guarda el artículo
                    </p>
                    <p className="text-gray-500 text-sm">
                      Una vez creado el artículo, podrás gestionar sus variaciones de talla y color.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3 bg-gray-50">
          <ArticleFormButtons
            hasCreatedArticle={hasNewlyCreatedArticle}
            showVariationsSection={showVariationsSection}
            loading={loading}
            isEditMode={isEditMode}
            onClose={onClose}
            onSubmit={handleSubmit}
            onFinishAndClose={handleFinishAndClose}
          />
        </div>
      </div>
    </div>
  );
};
