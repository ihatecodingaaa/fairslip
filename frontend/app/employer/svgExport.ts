/**
 * A chart, serialised as the file it already is.
 *
 * THIS EXPORTS THE RENDERED ELEMENT, NOT A REBUILD OF IT. The alternative -
 * generating a second SVG from the same data at download time - is a second
 * drawing of the same payroll, and the two would agree until the day one of them
 * was changed. What leaves here is the DOM node the reader was looking at.
 *
 * WHY THE STYLES ARE COPIED IN. The charts are styled by Tailwind classes
 * resolving CSS custom properties, and a stylesheet does not travel inside an
 * .svg file. So every element's computed fill, stroke, width and font is written
 * onto the element as a presentation attribute before it leaves - which is what
 * makes the downloaded file open correctly in Illustrator, Keynote, a browser
 * and a slide deck rather than as black-on-black.
 *
 * THE STATUS SHAPES SURVIVE GREYSCALE, and that is not this file's doing: the
 * charts encode outcome as position and silhouette, so an exported file printed
 * in black and white loses nothing that carried meaning.
 */

/** The properties that must survive the loss of the stylesheet. */
const CARRIED = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-linecap",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
] as const;

function inlineStyles(source: Element, clone: Element) {
  const computed = window.getComputedStyle(source);
  const style = CARRIED.map((prop) => `${prop}:${computed.getPropertyValue(prop)}`).join(";");
  clone.setAttribute("style", style);
  clone.removeAttribute("class");

  const from = Array.from(source.children);
  const to = Array.from(clone.children);
  for (let i = 0; i < from.length && i < to.length; i += 1) inlineStyles(from[i], to[i]);
}

/**
 * Serialise a live <svg> to a standalone document.
 *
 * Returns null when there is nothing on screen to serialise, rather than an
 * empty file that looks like a successful export.
 */
export function svgToText(svg: SVGSVGElement | null): string | null {
  if (!svg) return null;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineStyles(svg, clone);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  // A white ground. The page's canvas is warm grey and the marks are dark; a
  // transparent export dropped onto a dark slide would render as nothing.
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", String(svg.clientWidth || svg.getAttribute("width") || 0));
  bg.setAttribute("height", String(svg.clientHeight || svg.getAttribute("height") || 0));
  bg.setAttribute("fill", "#ffffff");
  clone.insertBefore(bg, clone.firstChild);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
}

// The two download helpers used to live here. They moved to app/ui/download.ts
// when the worker's evidence pack needed them: a JSON of a worker's own facts
// has nothing to do with serialising a chart, and importing this module to get
// them said that it did. No re-export is left behind - a pass-through would
// keep the misleading dependency alive while looking like tidiness.
