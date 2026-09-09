/**
 * Handing a file to the browser. Nothing is uploaded anywhere.
 *
 * IT LIVES HERE BECAUSE BOTH SIDES OF THE PRODUCT USE IT. The employer's review
 * pack writes a workbook, a CSV and a JSON; the worker's evidence pack writes
 * the facts behind their own figures. Both were reaching into
 * `app/employer/svgExport.ts`, a module whose entire docstring is about
 * serialising a chart - so the worker's flow imported a chart serialiser to save
 * a JSON file, which is the kind of dependency that makes a later reader think
 * the two things are related.
 */

/** Hand a string to the browser as a file. */
export function downloadText(text: string, filename: string, mime: string) {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on the next tick: revoking synchronously races the click in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
