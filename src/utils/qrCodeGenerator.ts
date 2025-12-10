import QRCode from 'qrcode';

export const generateQRCodeDataURL = async (url: string): Promise<string> => {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(url, {
      width: 120,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });
    
    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

export const generateQRCodeBase64 = async (url: string): Promise<string> => {
  const dataURL = await generateQRCodeDataURL(url);
  // Remove the data:image/png;base64, prefix
  return dataURL.split(',')[1];
};