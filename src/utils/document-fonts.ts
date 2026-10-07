import fontUrl from '../assets/NotoSansArabic.ttf?url';

let css = '';
let loading: Promise<void> | undefined;
export function fonts() { return css; }
export function loadDocumentFonts(): Promise<void> {
  return loading ??= fetch(fontUrl).then(async (response) => {
    if (!response.ok) throw new Error('تعذر تحميل خط المستند.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    css = `@font-face{font-family:Receipt;font-style:normal;font-weight:100 900;font-display:block;src:url(data:font/ttf;base64,${btoa(binary)}) format('truetype');}`;
  }).catch((error) => { loading = undefined; throw error; });
}
