import html2pdf from 'html2pdf.js';

async function waitForNextFrames(count = 2): Promise<void> {
  for (let i = 0; i < count; i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }),
    ),
  );
}

export type HtmlToPdfOptions = {
  filename?: string;
  margin?: number;
  widthPx?: number;
};

/** Genera un PDF desde HTML. El nodo se monta en viewport (invisible) para que html2canvas lo capture. */
export async function generatePdfBlobFromHtml(
  html: string,
  options: HtmlToPdfOptions = {},
): Promise<Blob> {
  const { filename = 'documento.pdf', margin = 0.4, widthPx = 720 } = options;

  const container = document.createElement('div');
  container.setAttribute('data-pdf-export', 'true');
  Object.assign(container.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: `${widthPx}px`,
    zIndex: '-9999',
    opacity: '0',
    pointerEvents: 'none',
    background: '#ffffff',
    overflow: 'visible',
  });
  container.innerHTML = html.trim();
  document.body.appendChild(container);

  const target =
    container.firstElementChild instanceof HTMLElement ? container.firstElementChild : container;

  try {
    await waitForNextFrames();
    await waitForImages(target);

    const blob = (await html2pdf()
      .set({
        margin,
        filename,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: widthPx,
          windowWidth: widthPx,
          scrollX: 0,
          scrollY: 0,
        },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(target)
      .outputPdf('blob')) as Blob;

    if (!(blob instanceof Blob) || blob.size < 800) {
      throw new Error('No se pudo generar el PDF (contenido vacío). Inténtelo de nuevo.');
    }
    return blob;
  } finally {
    document.body.removeChild(container);
  }
}
