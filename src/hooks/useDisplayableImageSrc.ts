import { useEffect, useState } from 'react';
import { heicUrlToObjectUrl, isHeicLike } from '@/lib/heicImage';

/**
 * Devuelve una URL que el navegador puede pintar en <img>.
 * Convierte HEIC/HEIF a JPEG en cliente (archivos ya subidos).
 */
export function useDisplayableImageSrc(url: string | null | undefined): {
  src: string | null;
  loading: boolean;
  failed: boolean;
} {
  const [src, setSrc] = useState<string | null>(() =>
    url && !isHeicLike(null, null, url) ? url : null,
  );
  const [loading, setLoading] = useState(Boolean(url && isHeicLike(null, null, url)));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url) {
      setSrc(null);
      setLoading(false);
      setFailed(false);
      return;
    }

    if (!isHeicLike(null, null, url)) {
      setSrc(url);
      setLoading(false);
      setFailed(false);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setSrc(null);

    heicUrlToObjectUrl(url)
      .then((converted) => {
        if (cancelled) {
          URL.revokeObjectURL(converted);
          return;
        }
        objectUrl = converted;
        setSrc(converted);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return { src, loading, failed };
}
