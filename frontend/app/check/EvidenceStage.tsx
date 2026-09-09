"use client";

/**
 * Stage 1: the documents, as objects rather than as a file input.
 *
 * A file picker asks a worker to think about files. What they have is a
 * photograph of a payslip, and the screen should say so and then show it back to
 * them, because the first question anyone has after choosing an image is whether
 * the right one went in.
 *
 * THREE CARDS, ONE SET, IDENTICAL BOXES.
 *
 * The payslip used to take a double-height cell because it is the only required
 * document. That was true and it was drawn wrong: it made a PORTRAIT photograph
 * produce a card twice the height of a landscape one, pushed the third document
 * under the second, and put the button that starts the whole product below the
 * fold. The three are one set of evidence and now read as one - equal columns,
 * one fixed 2:1 thumbnail well each, `object-contain` so the aspect ratio of the
 * photograph changes nothing about the box around it.
 *
 * What is NOT lost is which one is required. "Required" and "Optional" are words
 * on the cards now, where a red asterisk used to be the only signal - and a word
 * survives greyscale, a photocopy and a colour-blind reader, which an asterisk in
 * `text-danger-fg` does not.
 *
 * SHOW FIRST, EXPLAIN ON REQUEST. Each card carried a sentence describing what
 * the document is ("The itemised pay record from your employer..."), and three of
 * those above a button is a paragraph a worker reads before they can act. They
 * are all still here, in one disclosure under the cards, together with the
 * sentence about what happens to the images - which is also the reason the CTA
 * carries "Read once · not stored" beside it rather than a paragraph above it.
 *
 * THE PREVIEW IS LOCAL AND NOTHING ELSE. `URL.createObjectURL` on the File the
 * picker already handed us: no upload, no copy, no persistence. The object URL is
 * revoked when the choice changes or the component unmounts, so the blob does not
 * outlive the screen. Nothing about the preview reaches the network, which is
 * what lets the panel say "nothing is stored" and mean it.
 */

import { useEffect, useRef } from "react";
import type { DocumentRole } from "@/lib/api";
import { T, useT } from "../ui/Prefs";
import type { Key } from "@/lib/i18n";

/** The documents a reader may be given, and what each is for. Dictionary keys,
 * not literals: these are the first words a worker reads on this screen. */
export const DOCUMENTS: {
  role: DocumentRole;
  label: Key;
  hint: Key;
  required: boolean;
}[] = [
  { role: "payslip", label: "doc.payslip", hint: "doc.payslip.hint", required: true },
  { role: "roster", label: "doc.roster", hint: "doc.roster.hint", required: false },
  { role: "ket", label: "doc.ket", hint: "doc.ket.hint", required: false },
];

export function EvidenceStage({
  files,
  onPick,
  onRead,
  reading,
  canRead,
}: {
  files: Partial<Record<DocumentRole, File>>;
  onPick: (role: DocumentRole, file: File) => void;
  onRead: () => void;
  reading: boolean;
  canRead: boolean;
}) {
  const t = useT();
  return (
    <section aria-labelledby="evidence-heading">
      <h2 id="evidence-heading" className="text-title font-semibold">
        <T k="evidence.heading" />
      </h2>
      <p className="max-w-measure mt-2 text-body text-ink-2">
        <T k="evidence.sub" />
      </p>

      {/* THREE EQUAL COLUMNS. `items-stretch` is the default on a grid and is
          the whole trick: every card is `h-full`, so the tallest content sets
          one height and no photograph can set its own. `auto-rows-fr` extends
          that ACROSS rows, which is what keeps the three identical at 768 and
          390 where the third card wraps onto a row of its own. */}
      <ul className="mt-6 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DOCUMENTS.map((d) => (
          <li key={d.role}>
            <DocumentSlot doc={d} file={files[d.role]} onPick={(f) => onPick(d.role, f)} />
          </li>
        ))}
      </ul>

      {/* The three descriptions and the storage sentence, together, one tap
          away. Nothing here is new copy and nothing was dropped: these are the
          same four dictionary keys the screen used to print by default. */}
      <details className="mt-4">
        <summary className="tap-sm cursor-pointer text-meta font-semibold text-ink-2">
          <T k="evidence.whatEach" />
        </summary>
        <dl className="mt-2 grid gap-3 sm:grid-cols-3">
          {DOCUMENTS.map((d) => (
            <div key={d.role}>
              <dt className="text-meta font-semibold text-ink">
                <T k={d.label} />
              </dt>
              <dd className="max-w-measure mt-1 text-meta text-ink-2">
                <T k={d.hint} />
              </dd>
            </div>
          ))}
        </dl>
        <p className="max-w-measure mt-3 border-t border-line pt-3 text-meta text-ink-2">
          <T k="evidence.blurb" />
        </p>
      </details>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={onRead}
          disabled={!canRead || reading}
          className="tap rounded-sm bg-brand px-5 py-3 text-lead font-semibold text-on-solid disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3"
        >
          {reading ? t("check.reading") : t("check.read")}
        </button>
        {/* The storage claim in four words, beside the control it is about. The
            sentence it summarises is in the disclosure above, unchanged. */}
        <p className="text-meta text-ink-2">
          <T k="evidence.privacy" />
        </p>
        {!canRead && (
          <p className="text-meta text-attention-fg">
            <T k="check.needPayslip" />
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * One evidence object.
 *
 * The whole card is the label for its file input, so the tap target is the card
 * and not a 90px button inside it. The input itself is visually hidden and still
 * focusable, which is what keeps it keyboard-reachable and lets the focus ring
 * land on the card.
 *
 * ONE RING, NOT TWO BOXES. The card used to rest on a 2px dark border and take a
 * 3px focus outline 2px outside it: two heavy dark rectangles a couple of pixels
 * apart, which reads as a rendering fault rather than as focus. The resting
 * border is a hairline and the ring sits further out, so what a keyboard user
 * sees is one unmistakable ring around one card.
 */
function DocumentSlot({
  doc,
  file,
  onPick,
}: {
  doc: (typeof DOCUMENTS)[number];
  file: File | undefined;
  onPick: (f: File) => void;
}) {
  const t = useT();

  return (
    <label
      className={`flex h-full cursor-pointer flex-col rounded-lg bg-surface p-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-[4px] has-[:focus-visible]:outline-focus ${
        file ? "border border-line-strong" : "border border-dashed border-control hover:border-ink"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-body font-semibold text-ink">
          <T k={doc.label} />
        </span>
        <span
          className={`text-meta font-semibold ${
            doc.required ? "text-attention-fg" : "text-ink-3"
          }`}
        >
          <T k={doc.required ? "evidence.required" : "evidence.optional"} />
        </span>
      </div>

      {/* A FIXED WELL. 2:1, the same on all three cards, so a portrait payslip
          and a landscape roster produce identical boxes and `object-contain`
          fits each photograph inside its own. The empty-state word breaks: the
          Tamil for "no photo chosen yet" ends in a 24-character word, and a word
          is a grid track's minimum whether or not the box around it is
          `overflow-hidden` - clipping hides the paint, not the min-content. */}
      <div className="mt-3 flex aspect-[2/1] items-center justify-center overflow-hidden rounded-sm border border-line bg-muted">
        {file ? (
          <FilePreview file={file} alt={`${t(doc.label)} — ${t("evidence.preview")}`} />
        ) : (
          <span className="px-3 text-center text-meta text-ink-3 [overflow-wrap:anywhere]">
            <T k="evidence.noneYet" />
          </span>
        )}
      </div>

      {/* STATUS FIRST, FILENAME UNDER IT. Which of these is answered is the
          thing being scanned; which file produced it is the thing checked once. */}
      <span className="mt-auto block pt-3">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          {file ? (
            <span className="flex items-center gap-1 text-body font-semibold text-agreed-fg">
              <CheckMark />
              <T k="evidence.chosen" />
            </span>
          ) : (
            <span className="flex items-center gap-1 text-body font-semibold text-ink">
              <span aria-hidden>+</span>
              <T k="evidence.choose" />
            </span>
          )}
          {file && (
            <span className="text-meta font-medium text-ink-2 underline underline-offset-2">
              <T k="evidence.replace" />
            </span>
          )}
        </span>
        {file && (
          <span className="mt-1 block break-all font-mono text-meta text-ink-3">{file.name}</span>
        )}
      </span>

      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
        }}
      />
    </label>
  );
}

/** The tick, as a shape. Same silhouette as the AGREED chip's, for the same
 * reason: the state has to survive a photocopy and a colour-blind reader. */
function CheckMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.2 8.4l3.2 3.2 6.4-7.2" />
    </svg>
  );
}

/**
 * The chosen file, shown back.
 *
 * THE OBJECT URL IS NEVER REACT STATE. `URL.createObjectURL` is a side effect and
 * its result has to be handed back with `revokeObjectURL` - the browser holds the
 * blob until the document unloads otherwise, so a worker trying four photographs
 * of the same payslip would leave four in memory. Putting it in state meant
 * setting state inside the effect that created it, which the React compiler's
 * lint rejects and is right to: it is a cascading render for a value React never
 * needed to know.
 *
 * So the effect does the one thing an effect is for - it updates an external
 * system, the <img> element, with the latest value from React - and the cleanup
 * revokes the URL it made. Nothing impure happens during render, and there is no
 * state to get out of step with the prop.
 */
function FilePreview({ file, alt }: { file: File; alt: string }) {
  const img = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const el = img.current;
    if (!el || typeof URL.createObjectURL !== "function") return;
    const url = URL.createObjectURL(file);
    el.src = url;
    return () => {
      // Order matters: drop the reference before revoking, or the element is
      // briefly pointing at a URL that no longer resolves.
      el.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
  }, [file]);
  /* A plain <img>, deliberately. next/image exists to optimise and cache remote
     assets; it can do neither for a blob: URL that lives in this tab and is
     revoked when the choice changes - and routing a worker's payslip through an
     image proxy is the opposite of what this screen promises. */
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={img} alt={alt} className="h-full w-full object-contain" />;
}

/**
 * The documents, after the reading - a strip rather than a stage.
 *
 * print-hide, and the omission needs no standing note: a file picker is a
 * control, not a figure, and what it produced - which documents were read and
 * what each reader made of them - is on the sheet below it.
 */
export function EvidenceStrip({
  files,
  onReopen,
}: {
  files: Partial<Record<DocumentRole, File>>;
  onReopen: () => void;
}) {
  const chosen = DOCUMENTS.filter((d) => files[d.role]);
  if (chosen.length === 0) return null;
  return (
    <div className="print-hide flex flex-wrap items-center gap-x-6 gap-y-2">
      <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {chosen.map((d) => (
          <li key={d.role} className="flex items-baseline gap-2">
            <span className="text-meta font-semibold text-ink">
              <T k={d.label} />
            </span>
            <span className="break-all font-mono text-meta text-ink-3">
              {files[d.role]!.name}
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onReopen}
        className="tap-sm rounded-sm border border-control bg-surface px-3 py-2 text-meta font-semibold text-ink hover:border-ink"
      >
        <T k="evidence.replace" />
      </button>
    </div>
  );
}
