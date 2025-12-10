
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVerifactuXML } from '@/hooks/useVerifactuXML';
import { FileText, Download, Eye, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export const VerifactuXMLDocuments: React.FC = () => {
  const { getXMLDocuments, downloadXML } = useVerifactuXML();

  const handleDownloadXML = (xmlContent: string, invoiceNumber: string, xmlType: string) => {
    const filename = `${invoiceNumber}_${xmlType}_${new Date().getTime()}.xml`;
    downloadXML(xmlContent, filename);
  };

  if (getXMLDocuments.isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-8">
          <p>Cargando documentos XML...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="w-5 h-5" />
          <span>Documentos XML Verifactu</span>
        </CardTitle>
        <CardDescription>
          Documentos XML generados y recibidos en las comunicaciones con Verifactu
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {getXMLDocuments.data?.map((doc) => (
            <Card key={doc.id} className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-medium">Factura {doc.invoices?.number}</span>
                      <Badge variant={doc.xml_type === 'request' ? 'default' : 'secondary'}>
                        {doc.xml_type === 'request' ? 'Petición' : 'Respuesta'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-1" />
                          Ver
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh]">
                        <DialogHeader>
                          <DialogTitle>
                            XML {doc.xml_type === 'request' ? 'Petición' : 'Respuesta'} - 
                            Factura {doc.invoices?.number}
                          </DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
                          <pre className="text-xs">
                            <code>{doc.xml_content}</code>
                          </pre>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDownloadXML(
                        doc.xml_content, 
                        doc.invoices?.number || 'unknown', 
                        doc.xml_type
                      )}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Descargar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {getXMLDocuments.data?.length === 0 && (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">No hay documentos XML</h3>
              <p className="text-gray-600">
                Los documentos XML se generarán automáticamente al enviar facturas a Verifactu.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
