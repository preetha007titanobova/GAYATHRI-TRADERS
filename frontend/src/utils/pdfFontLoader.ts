import jsPDF from 'jspdf';
import Api from '../Api';

let cachedFontBase64: string | null = null;

export async function getRupeeFontBase64(): Promise<string | null> {
  if (cachedFontBase64) return cachedFontBase64;
  try {
    const res = await fetch(`${Api}/rupee-font`);
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const len = bytes.byteLength;
      const CHUNK_SIZE = 8192;
      for (let i = 0; i < len; i += CHUNK_SIZE) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK_SIZE)));
      }
      cachedFontBase64 = window.btoa(binary);
      return cachedFontBase64;
    }
  } catch (err) {
    console.warn('Could not load Rupee font from server:', err);
  }
  return null;
}

export async function applyRupeeFont(doc: jsPDF): Promise<string> {
  const fontBase64 = await getRupeeFontBase64();
  if (fontBase64) {
    try {
      doc.addFileToVFS('arial.ttf', fontBase64);
      doc.addFont('arial.ttf', 'arial', 'normal');
      doc.addFont('arial.ttf', 'arial', 'bold');
      doc.setFont('arial');
      return 'arial';
    } catch (e) {
      console.warn('Failed to register font with jsPDF:', e);
    }
  }
  return 'helvetica';
}
