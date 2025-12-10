import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://deno.land/x/supabase@1.0.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ocrApiKey = Deno.env.get('OCR_SPACE_API_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface OCRResult {
  ParsedText: string;
  ErrorMessage?: string;
  ErrorDetails?: string;
}

interface ExtractedData {
  supplierInfo: {
    name: string;
    taxId?: string;
    address?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  totals: {
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
  };
  invoiceInfo: {
    number?: string;
    date?: string;
  };
}

function extractInvoiceData(text: string): ExtractedData {
  console.log('Processing OCR text:', text);
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // EXTRAER PROVEEDOR - VERSIÓN SIMPLE
  let supplierName = '';
  let supplierTaxId = '';
  
  // Buscar las primeras líneas que contengan información de empresa
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i];
    
    // Buscar NIF/CIF
    if (line.match(/n\.?i\.?f\.?[:\s]*([A-Z]-?\d{8}|\d{8}-?[A-Z]|[A-Z]\d{7}[A-Z0-9])/i)) {
      const match = line.match(/([A-Z]-?\d{8}|\d{8}-?[A-Z]|[A-Z]\d{7}[A-Z0-9])/i);
      if (match) {
        supplierTaxId = match[1];
      }
    }
    
    // Buscar nombre de empresa - líneas que contengan S.L., S.A., o palabras comerciales
    if (!supplierName && line.length > 10 && line.length < 80) {
      if (line.match(/(s\.?l\.?|s\.?a\.?|componentes|informática|tecnología|sistemas)/i) ||
          (i < 3 && !line.match(/factura|fecha|página|n\.?i\.?f/i))) {
        supplierName = line;
      }
    }
  }
  
  console.log('Found supplier:', supplierName, 'Tax ID:', supplierTaxId);

  // EXTRAER ARTÍCULOS - VERSIÓN SIMPLE
  const items: ExtractedData['items'] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Buscar líneas que contengan números que parezcan precios (con decimales)
    const priceMatches = line.match(/\d+[.,]\d{2}/g);
    if (!priceMatches || priceMatches.length < 1) continue;
    
    // Buscar cantidades (números enteros pequeños al inicio o en medio)
    const quantityMatch = line.match(/\b([1-9]\d{0,2})[.,]?00\b|\b([1-9]\d{0,1})\b/);
    
    // Extraer descripción (parte de texto sin números)
    let description = line.replace(/\d+[.,]\d{2}/g, '').replace(/\b\d+\b/g, '').trim();
    description = description.replace(/\s+/g, ' ').trim();
    
    if (description.length > 5 && description.length < 150 && priceMatches.length >= 1) {
      const quantity = quantityMatch ? parseInt(quantityMatch[1] || quantityMatch[2]) : 1;
      const totalPrice = parseFloat(priceMatches[priceMatches.length - 1].replace(',', '.'));
      const unitPrice = priceMatches.length > 1 ? 
        parseFloat(priceMatches[priceMatches.length - 2].replace(',', '.')) : 
        totalPrice / quantity;
      
      if (totalPrice > 0 && totalPrice < 10000 && unitPrice > 0) {
        items.push({
          description: description,
          quantity: Math.max(1, quantity),
          unitPrice: unitPrice,
          totalPrice: totalPrice
        });
        console.log('Added item:', description, quantity, unitPrice, totalPrice);
      }
    }
  }

  // EXTRAER TOTALES - VERSIÓN SIMPLE
  let subtotal = 0;
  let taxAmount = 0;
  let totalAmount = 0;
  
  // Buscar el total más grande (probablemente el total final)
  const allNumbers = text.match(/\d{1,4}[.,]\d{2}/g) || [];
  const numbers = allNumbers.map(n => parseFloat(n.replace(',', '.'))).sort((a, b) => b - a);
  
  if (numbers.length > 0) {
    totalAmount = numbers[0]; // El número más grande
    
    // Buscar subtotal e IVA específicamente
    for (const line of lines) {
      if (line.match(/base\s+imponible|suma\s+netos/i)) {
        const match = line.match(/(\d{1,4}[.,]\d{2})/);
        if (match) {
          subtotal = parseFloat(match[1].replace(',', '.'));
        }
      }
      if (line.match(/i\.?v\.?a\.?|21%/i)) {
        const match = line.match(/(\d{1,4}[.,]\d{2})/);
        if (match) {
          taxAmount = parseFloat(match[1].replace(',', '.'));
        }
      }
    }
    
    // Si no encontramos subtotal, calcularlo
    if (subtotal === 0 && totalAmount > 0) {
      subtotal = totalAmount / 1.21; // Asumiendo 21% IVA
      taxAmount = totalAmount - subtotal;
    }
  }

  // EXTRAER FECHA Y NÚMERO
  let invoiceDate = '';
  let invoiceNumber = '';
  
  for (const line of lines) {
    // Buscar fecha
    const dateMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (dateMatch && !invoiceDate) {
      invoiceDate = dateMatch[1];
    }
    
    // Buscar número de factura
    const numberMatch = line.match(/factura\s+([A-Z]?\d{2,4}-\d{3,6})/i) || 
                       line.match(/([A-Z]\d{2,4}-\d{3,6})/);
    if (numberMatch && !invoiceNumber) {
      invoiceNumber = numberMatch[1];
    }
  }
  
  console.log('=== RESULTS ===');
  console.log('Supplier:', supplierName);
  console.log('Items:', items.length);
  console.log('Total:', totalAmount);
  
  return {
    supplierInfo: {
      name: supplierName,
      taxId: supplierTaxId,
      address: ''
    },
    items,
    totals: {
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100
    },
    invoiceInfo: {
      number: invoiceNumber,
      date: invoiceDate
    }
  };
}

async function findOrCreateSupplier(supplierInfo: ExtractedData['supplierInfo']) {
  console.log('Finding or creating supplier:', supplierInfo);
  
  if (!supplierInfo.name) {
    throw new Error('Supplier name is required');
  }
  
  // Try to find existing supplier by name or tax ID
  let { data: existingSupplier } = await supabase
    .from('suppliers')
    .select('id, name')
    .or(`name.ilike.%${supplierInfo.name}%,tax_id.eq.${supplierInfo.taxId}`)
    .limit(1)
    .single();
  
  if (existingSupplier) {
    console.log('Found existing supplier:', existingSupplier);
    return existingSupplier.id;
  }
  
  // Create new supplier
  const { data: newSupplier, error } = await supabase
    .from('suppliers')
    .insert({
      name: supplierInfo.name,
      tax_id: supplierInfo.taxId || null,
      address_street: supplierInfo.address || null
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Error creating supplier:', error);
    throw error;
  }
  
  console.log('Created new supplier:', newSupplier);
  return newSupplier.id;
}

async function processOCR(fileBase64: string): Promise<OCRResult> {
  console.log('Processing PDF with OCR.space API');
  
  const formData = new FormData();
  formData.append('base64Image', `data:application/pdf;base64,${fileBase64}`);
  formData.append('apikey', ocrApiKey!);
  formData.append('language', 'spa');
  formData.append('isOverlayRequired', 'false');
  formData.append('detectOrientation', 'true');
  formData.append('scale', 'true');
  formData.append('OCREngine', '2');
  
  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  console.log('OCR result:', result);
  
  if (result.ErrorMessage) {
    throw new Error(`OCR Error: ${result.ErrorMessage}`);
  }
  
  return {
    ParsedText: result.ParsedResults?.[0]?.ParsedText || '',
    ErrorMessage: result.ErrorMessage,
    ErrorDetails: result.ErrorDetails
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    console.log('Processing PDF invoice request');
    
    if (!ocrApiKey) {
      throw new Error('OCR.space API key not configured');
    }
    
    const { fileBase64, fileName } = await req.json();
    
    if (!fileBase64) {
      throw new Error('No file data provided');
    }
    
    // Process PDF with OCR
    const ocrResult = await processOCR(fileBase64);
    
    if (!ocrResult.ParsedText) {
      throw new Error('No text could be extracted from the PDF');
    }
    
    // Extract structured data
    const extractedData = extractInvoiceData(ocrResult.ParsedText);
    console.log('Extracted data:', extractedData);
    
    // Find or create supplier
    let supplierId = null;
    if (extractedData.supplierInfo.name) {
      try {
        supplierId = await findOrCreateSupplier(extractedData.supplierInfo);
      } catch (error) {
        console.error('Error handling supplier:', error);
        // Continue without supplier ID if creation fails
      }
    }
    
    // Generate delivery note number
    const currentYear = new Date().getFullYear();
    const yearPrefix = `AE-${currentYear}`;
    
    const { data: lastNote } = await supabase
      .from('delivery_notes')
      .select('number')
      .like('number', `${yearPrefix}%`)
      .order('number', { ascending: false })
      .limit(1)
      .single();
    
    let nextNumber = 1;
    if (lastNote) {
      const numberPart = parseInt(lastNote.number.substring(yearPrefix.length + 1));
      if (!isNaN(numberPart)) {
        nextNumber = numberPart + 1;
      }
    }
    
    const deliveryNoteNumber = `${yearPrefix}-${nextNumber.toString().padStart(6, '0')}`;
    
    const response = {
      success: true,
      ocrText: ocrResult.ParsedText,
      extractedData,
      supplierId,
      suggestedDeliveryNote: {
        number: deliveryNoteNumber,
        supplier_id: supplierId,
        issue_date: new Date().toISOString().split('T')[0],
        delivery_date: null,
        status: 'pending',
        notes: `Procesado automáticamente desde ${fileName}`,
        subtotal: extractedData.totals.subtotal,
        tax_amount: extractedData.totals.taxAmount,
        total_amount: extractedData.totals.totalAmount,
        items: extractedData.items
      }
    };
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error in process-pdf-invoice function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
