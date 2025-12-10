import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useVerifactu } from '@/hooks/useVerifactu';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FileText, CheckCircle, XCircle, Plus, AlertCircle, Shield, Clock, Trash2, Upload, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const VerifactuCertificates: React.FC = () => {
  const { getCertificates } = useVerifactu();
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    certificate: '',
    password: '',
    validFrom: '',
    validUntil: ''
  });
  const [verifyingCerts, setVerifyingCerts] = useState<Set<string>>(new Set());
  const [verificationResults, setVerificationResults] = useState<Map<string, any>>(new Map());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [certificateToDelete, setCertificateToDelete] = useState<string | null>(null);
  const [diagnosticRunning, setDiagnosticRunning] = useState<Set<string>>(new Set());
  const [diagnosticResults, setDiagnosticResults] = useState<Map<string, any>>(new Map());

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.toLowerCase().endsWith('.p12') && !file.name.toLowerCase().endsWith('.pfx')) {
        toast({
          title: 'Tipo de archivo no válido',
          description: 'Por favor, selecciona un archivo .p12 o .pfx',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'Archivo demasiado grande',
          description: 'El archivo no puede superar los 5MB',
          variant: 'destructive',
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setFormData(prev => ({
          ...prev,
          certificate: base64.split(',')[1] // Remove data:application/x-pkcs12;base64, prefix
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Secure encryption function
  const encryptData = async (data: string, type: 'certificate' | 'password'): Promise<string> => {
    try {
      const { data: result, error } = await supabase.functions.invoke('encrypt-certificate', {
        body: {
          action: 'encrypt',
          data,
          type
        }
      });

      if (error) throw error;
      return result.result;
    } catch (error: any) {
      console.error('❌ Encryption error:', error);
      throw new Error('Failed to encrypt data securely');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!companyId) {
      toast({
        title: 'Error de empresa',
        description: 'No se pudo identificar la empresa. Por favor, recarga la página.',
        variant: 'destructive',
      });
      return;
    }

    // Validate required fields
    if (!formData.name.trim()) {
      toast({
        title: 'Campo requerido',
        description: 'El nombre del certificado es obligatorio.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.certificate) {
      toast({
        title: 'Certificado requerido',
        description: 'Por favor, selecciona un archivo de certificado.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.password.trim()) {
      toast({
        title: 'Contraseña requerida',
        description: 'La contraseña del certificado es obligatoria.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // 🔐 Encrypt certificate and password before storing
      console.log('🔐 Encrypting certificate data securely...');
      const encryptedCertificate = await encryptData(formData.certificate, 'certificate');
      const encryptedPassword = await encryptData(formData.password, 'password');

      const { error } = await supabase
        .from('verifactu_certificates')
        .insert({
          company_id: companyId,
          certificate_name: formData.name.trim(),
          certificate_data: encryptedCertificate,
          certificate_password: encryptedPassword,
          valid_from: formData.validFrom ? new Date(formData.validFrom).toISOString() : null,
          valid_until: formData.validUntil ? new Date(formData.validUntil).toISOString() : null,
        });

      if (error) throw error;

      toast({
        title: 'Certificado guardado de forma segura',
        description: 'El certificado ha sido encriptado con AES-256 y guardado correctamente.',
      });

      setIsDialogOpen(false);
      setFormData({
        name: '',
        certificate: '',
        password: '',
        validFrom: '',
        validUntil: ''
      });
      getCertificates.refetch();
    } catch (error: any) {
      console.error('❌ Error saving certificate:', error);
      toast({
        title: 'Error al guardar certificado',
        description: error.message || 'Ha ocurrido un error al guardar el certificado de forma segura.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCertificateStatus = async (certificateId: string, isActive: boolean) => {
    if (!companyId) {
      toast({
        title: 'Error de empresa',
        description: 'No se pudo identificar la empresa.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('verifactu_certificates')
        .update({ is_active: !isActive })
        .eq('id', certificateId)
        .eq('company_id', companyId); // Extra security check

      if (error) throw error;

      toast({
        title: isActive ? 'Certificado desactivado' : 'Certificado activado',
        description: `El certificado ha sido ${isActive ? 'desactivado' : 'activado'} correctamente.`,
      });

      getCertificates.refetch();
    } catch (error: any) {
      toast({
        title: 'Error al cambiar estado',
        description: error.message || 'Ha ocurrido un error al cambiar el estado del certificado.',
        variant: 'destructive',
      });
    }
  };

  const handleVerifyCertificate = async (certificateId: string) => {
    try {
      setVerifyingCerts(prev => new Set(prev).add(certificateId));
      
      const { data, error } = await supabase.functions.invoke('verify-certificate', {
        body: { certificateId },
      });

      if (error) throw error;

      if (data.success) {
        setVerificationResults(prev => new Map(prev).set(certificateId, data));
        toast({
          title: 'Verificación completada',
          description: data.message,
        });
      } else {
        throw new Error(data.error || 'Error al verificar el certificado');
      }
    } catch (error: any) {
      console.error('Error verifying certificate:', error);
      toast({
        title: 'Error al verificar certificado',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setVerifyingCerts(prev => {
        const newSet = new Set(prev);
        newSet.delete(certificateId);
        return newSet;
      });
    }
  };

  const handleDeleteCertificate = async () => {
    if (!certificateToDelete || !companyId) return;

    try {
      const { error } = await supabase
        .from('verifactu_certificates')
        .delete()
        .eq('id', certificateToDelete)
        .eq('company_id', companyId);

      if (error) throw error;

      toast({
        title: 'Certificado eliminado',
        description: 'El certificado ha sido eliminado correctamente.',
      });

      getCertificates.refetch();
    } catch (error: any) {
      toast({
        title: 'Error al eliminar certificado',
        description: error.message || 'Ha ocurrido un error al eliminar el certificado.',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setCertificateToDelete(null);
    }
  };

  const openDeleteDialog = (certificateId: string) => {
    setCertificateToDelete(certificateId);
    setDeleteDialogOpen(true);
  };

  const handleDiagnostic = async (certificateId: string) => {
    if (!companyId) return;

    setDiagnosticRunning(prev => {
      const newSet = new Set(prev);
      newSet.add(certificateId);
      return newSet;
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const { data, error } = await supabase.functions.invoke('verifactu-diagnostic', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Diagnostic failed');
      }

      setDiagnosticResults(prev => {
        const newMap = new Map(prev);
        newMap.set(certificateId, data.diagnostic);
        return newMap;
      });

      const status = data.diagnostic.certificate_status;
      let variant: 'default' | 'destructive' = 'default';
      let title = 'Diagnóstico completado';
      
      if (status === 'revoked' || status === 'unauthorized') {
        variant = 'destructive';
        title = 'Problema con el certificado';
      }

      toast({
        title,
        description: data.diagnostic.error_details,
        variant,
      });
    } catch (error: any) {
      toast({
        title: 'Error en diagnóstico',
        description: error.message || 'Ha ocurrido un error al ejecutar el diagnóstico.',
        variant: 'destructive',
      });
    } finally {
      setDiagnosticRunning(prev => {
        const newSet = new Set(prev);
        newSet.delete(certificateId);
        return newSet;
      });
    }
  };

  const getVerificationStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" />Válido</Badge>;
      case 'expired':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Expirado</Badge>;
      case 'expiring_soon':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Próximo a expirar</Badge>;
      case 'not_yet_valid':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />No válido aún</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  if (companyLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-8">
          <p>Cargando configuración de empresa...</p>
        </CardContent>
      </Card>
    );
  }

  if (!companyId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
          <AlertCircle className="w-12 h-12 text-yellow-500" />
          <div className="text-center">
            <h3 className="text-lg font-medium">No se pudo cargar la empresa</h3>
            <p className="text-gray-600">
              Por favor, recarga la página o contacta con el administrador.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-green-500" />
            Certificados Verifactu Seguros
          </h2>
          <p className="text-gray-600">Gestión segura de certificados digitales con encriptación AES-256</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Certificado
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-500" />
                Agregar Certificado Verifactu Seguro
              </DialogTitle>
              <DialogDescription>
                Tu certificado será encriptado con AES-256 antes de ser almacenado de forma segura.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre del certificado *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Certificado AEAT 2024"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="certificate">Archivo de certificado (.p12/.pfx) *</Label>
                <Input
                  id="certificate"
                  type="file"
                  accept=".p12,.pfx"
                  onChange={handleFileUpload}
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  <Shield className="w-3 h-3 inline mr-1" />
                  Certificado será encriptado con AES-256 (máximo 5MB)
                </p>
              </div>

              <div>
                <Label htmlFor="password">Contraseña del certificado *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Contraseña del certificado"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  <Shield className="w-3 h-3 inline mr-1" />
                  Contraseña será encriptada de forma segura
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="validFrom">Válido desde</Label>
                  <Input
                    id="validFrom"
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) => setFormData(prev => ({ ...prev, validFrom: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="validUntil">Válido hasta</Label>
                  <Input
                    id="validUntil"
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  <Shield className="w-4 h-4 mr-2" />
                  {isLoading ? 'Encriptando y Guardando...' : 'Guardar de Forma Segura'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {getCertificates.data?.map((certificate) => (
          <Card key={certificate.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="w-5 h-5 text-green-500" />
                    <FileText className="w-5 h-5" />
                    <span>{certificate.certificate_name}</span>
                  </CardTitle>
                  <CardDescription>
                    Encriptado AES-256 • Creado el {format(new Date(certificate.created_at), 'dd/MM/yyyy')}
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={certificate.is_active ? 'default' : 'secondary'}>
                    {certificate.is_active ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Activo
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        Inactivo
                      </>
                    )}
                  </Badge>
                  {verificationResults.has(certificate.id) && getVerificationStatusBadge(verificationResults.get(certificate.id).status)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {certificate.valid_from && (
                  <div>
                    <span className="font-medium">Válido desde:</span>
                    <p className="text-gray-600">
                      {format(new Date(certificate.valid_from), 'dd/MM/yyyy')}
                    </p>
                  </div>
                )}
                {certificate.valid_until && (
                  <div>
                    <span className="font-medium">Válido hasta:</span>
                    <p className="text-gray-600">
                      {format(new Date(certificate.valid_until), 'dd/MM/yyyy')}
                    </p>
                  </div>
                )}
              </div>
              {verificationResults.has(certificate.id) && (
                <Alert className="mt-4">
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium">{verificationResults.get(certificate.id).message}</p>
                      {verificationResults.get(certificate.id).certificateInfo && (
                        <div className="text-xs text-muted-foreground mt-2 space-y-1">
                          <p><strong>Sujeto:</strong> {verificationResults.get(certificate.id).certificateInfo.subject}</p>
                          <p><strong>Emisor:</strong> {verificationResults.get(certificate.id).certificateInfo.issuer}</p>
                          <p><strong>Nº Serie:</strong> {verificationResults.get(certificate.id).certificateInfo.serialNumber}</p>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              <div className="mt-4 flex gap-2 flex-wrap">
                <Button
                  variant={certificate.is_active ? 'secondary' : 'default'}
                  size="sm"
                  onClick={() => toggleCertificateStatus(certificate.id, certificate.is_active)}
                >
                  {certificate.is_active ? 'Desactivar' : 'Marcar como activo'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleVerifyCertificate(certificate.id)}
                  disabled={verifyingCerts.has(certificate.id)}
                >
                  <Shield className="h-4 w-4 mr-1" />
                  {verifyingCerts.has(certificate.id) ? 'Verificando...' : 'Verificar certificado'}
                </Button>
                {certificate.is_active && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDiagnostic(certificate.id)}
                    disabled={diagnosticRunning.has(certificate.id)}
                  >
                    <Activity className="h-4 w-4 mr-1" />
                    {diagnosticRunning.has(certificate.id) ? 'Diagnosticando...' : 'Diagnóstico AEAT'}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => openDeleteDialog(certificate.id)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Eliminar
                </Button>
              </div>
              
              {diagnosticResults.has(certificate.id) && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Resultado del Diagnóstico AEAT
                  </h4>
                  {(() => {
                    const diag = diagnosticResults.get(certificate.id);
                    const statusColors: Record<string, string> = {
                      'accepted': 'text-green-600',
                      'revoked': 'text-red-600',
                      'unauthorized': 'text-orange-600',
                      'connection_error': 'text-yellow-600',
                    };
                    return (
                      <>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium">Estado: </span>
                            <span className={statusColors[diag.certificate_status] || 'text-gray-600'}>
                              {diag.certificate_status}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Endpoint: </span>
                            <span className="text-muted-foreground">{diag.endpoint_final}</span>
                          </div>
                          <div>
                            <span className="font-medium">HTTP Status: </span>
                            <span>{diag.http_status || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="font-medium">Detalles: </span>
                            <span className="text-muted-foreground">{diag.error_details}</span>
                          </div>
                          {diag.certificate_info && (
                            <div className="mt-2 p-2 bg-background rounded border">
                              <div className="font-medium mb-1">Certificado:</div>
                              <div className="text-xs space-y-1">
                                <div><span className="font-medium">Serial:</span> {diag.certificate_info.serial}</div>
                                <div><span className="font-medium">Subject:</span> {diag.certificate_info.subject}</div>
                                <div><span className="font-medium">Válido desde:</span> {diag.certificate_info.valid_from && new Date(diag.certificate_info.valid_from).toLocaleDateString('es-ES')}</div>
                                <div><span className="font-medium">Válido hasta:</span> {diag.certificate_info.valid_to && new Date(diag.certificate_info.valid_to).toLocaleDateString('es-ES')}</div>
                              </div>
                            </div>
                          )}
                          {diag.recommendations && diag.recommendations.length > 0 && (
                            <div className="mt-2">
                              <div className="font-medium mb-1">Recomendaciones:</div>
                              <ul className="list-disc list-inside text-xs space-y-1">
                                {diag.recommendations.map((rec: string, idx: number) => (
                                  <li key={idx}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 text-green-700">
                  <Shield className="w-4 h-4" />
                  <span className="font-medium text-sm">Certificado Protegido</span>
                </div>
                <p className="text-xs text-green-600 mt-1">
                  Datos encriptados con AES-256-GCM • Acceso restringido por empresa
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {getCertificates.data?.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <Upload className="w-12 h-12 text-gray-400" />
                <Shield className="w-6 h-6 text-green-500 absolute -top-1 -right-1" />
              </div>
            </div>
            <h3 className="text-lg font-medium mb-2">No hay certificados seguros</h3>
            <p className="text-gray-600 mb-4">
              Agrega tu primer certificado digital. Será protegido con encriptación AES-256.
            </p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar certificado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El certificado será eliminado permanentemente de forma segura.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCertificateToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCertificate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};