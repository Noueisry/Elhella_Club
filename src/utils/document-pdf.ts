// Render locally: club data and receipts never leave the browser for PDF conversion.
export async function documentPdf(html: string, landscape = false): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
  const frame = document.createElement('iframe');
  const width = landscape ? 1120 : 794;
  frame.setAttribute('sandbox', 'allow-same-origin');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = `position:fixed;left:-20000px;top:0;width:${width}px;height:1123px;border:0;pointer-events:none;`;
  try {
    const loaded = new Promise<void>((resolve, reject) => {
      frame.onload = () => resolve();
      frame.onerror = () => reject(new Error('تعذر تجهيز المستند.'));
    });
    frame.srcdoc = html;
    document.body.append(frame);
    await loaded;
    const doc = frame.contentDocument;
    const main = doc?.querySelector('main');
    if (!doc || !main) throw new Error('تعذر تجهيز المستند.');
    await doc.fonts.ready;
    const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth() - 20;
    const pageHeight = pdf.internal.pageSize.getHeight() - 20;
    const pixelHeight = Math.floor(pageHeight / pageWidth * width);
    const top = main.getBoundingClientRect().top;
    const height = Math.ceil(main.getBoundingClientRect().height);
    const rowBounds = [...main.querySelectorAll('tr,.totals,.metric')].map((row) => {
      const rect = row.getBoundingClientRect(); return { top: rect.top - top, bottom: rect.bottom - top };
    });
    let offset = 0;
    while (offset < height) {
      let end = Math.min(offset + pixelHeight, height);
      const split = rowBounds.find((row) => row.top < end && row.bottom > end && row.top > offset);
      if (split) end = Math.floor(split.top);
      if (end <= offset) end = Math.min(offset + pixelHeight, height);
      const canvas = await html2canvas(main, { backgroundColor: '#ffffff', scale: 1.5, width, height: end - offset, y: offset,
        windowWidth: width, windowHeight: pixelHeight, logging: false });
      if (offset > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 10, 10, pageWidth, (end - offset) / width * pageWidth);
      canvas.width = 0; canvas.height = 0;
      offset = end;
    }
    return pdf.output('blob');
  } finally { frame.remove(); }
}
