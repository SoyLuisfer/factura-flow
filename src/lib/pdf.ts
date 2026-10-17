// Lectura de PDF en el navegador con pdfjs-dist.
// Si el PDF trae texto, se extrae como texto; si no, se renderiza la primera
// página a imagen (PNG en data URL) para mandarla como imagen a la IA.

export type LecturaPdf =
  | { tipo: "texto"; texto: string }
  | { tipo: "imagen"; dataUrl: string };

export async function leerPdf(archivo: File): Promise<LecturaPdf> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

  const bytes = await archivo.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: bytes }).promise;

  let texto = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const pagina = await doc.getPage(i);
    const contenido = await pagina.getTextContent();
    texto += contenido.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  if (texto.trim().length >= 20) return { tipo: "texto", texto: texto.trim() };

  // Sin texto: renderizar la primera página a imagen
  const pagina = await doc.getPage(1);
  const vista = pagina.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = vista.width;
  canvas.height = vista.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el lienzo para leer el PDF");
  await pagina.render({ canvasContext: ctx, viewport: vista, canvas }).promise;
  return { tipo: "imagen", dataUrl: canvas.toDataURL("image/png") };
}

export function archivoADataUrl(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(new Error("No se pudo leer el archivo"));
    lector.readAsDataURL(archivo);
  });
}
