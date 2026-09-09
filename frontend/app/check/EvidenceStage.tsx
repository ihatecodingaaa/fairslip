"use client";

/**
 * Stage 1: the documents, as objects rather than as a file input.
 *
 * A file picker asks a worker to think about files. What they have is a
 * photograph of a payslip, and the screen should say so and then show it back to
 * them, because the first question anyone has after choosing an image is whether
 * the right one went in.
 *
 * THE PREVIEW IS LOCAL AND NOTHING ELSE. `URL.createObjectURL` on the File the
 * picker already handed us: no upload, no copy, no persistence. The object URL is
 * revoked when the choice changes or the component unmounts, so the blob does not
 * outlive the screen. Nothing about the preview reaches the network, which is
 * what lets the panel say "nothing is stored" and mean it.
 *
 * WHAT THE READING STATE DOES NOT SAY. It does not name the two models, because
 * their identities arrive with the RESPONSE - `ExtractOut.readers` - and naming
 * them a second earlier would be printing two vendors nothing had yet
 * established were the ones called. It does not show steps, or a thought, or a
 * progress bar for work whose duration is unknown. It says what is happening and
 * that neither reader can see the other's answer, both of which are true.
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
        <T k="evidence.blurb" />
      </p>

      {/* THE PAYSLIP IS NOT ONE OF THREE. It is the only required document -
          without it there is nothing to read - and the other two are optional
          evidence that makes the reconstruction better. Three identical cards
          said they were peers, and a small red asterisk was the only thing
          saying otherwise. The payslip now takes half the row on a laptop and
          the other two share the rest. */}
      <ul className="mt-6 grid gap-4 lg:grid-cols-2">
        <li className="lg:row-span-2">
          <DocumentSlot
            doc={DOCUMENTS[0]}
            file={files[DOCUMENTS[0].role]}
            onPick={(f) => onPick(DOCUMENTS[0].role, f)}
          />
        </li>
        {DOCUMENTS.slice(1).map((d) => (
          <li key={d.role}>
            <DocumentSlot doc={d} file={files[d.role]} onPick={(f) => onPick(d.role, f)} />
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onRead}
          disabled={!canRead || reading}
          className="tap rounded-sm bg-brand px-5 py-3 text-lead font-semibold text-on-solid disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3"
        >
          {reading ? t("check.reading") : t("check.read")}
        </button>
        {!canRead && (
          <p className="text-meta text-ink-2">
            <T k="check.needPayslip" />
          </p>
        )}
      </div>

      {reading && (
        <div className="mt-6 rounded-lg border border-brand-line bg-brand-bg p-4">
          <p className="text-lead font-semibold text-brand-fg">
            <T k="evidence.readingNow" />
          </p>
          <p className="max-w-measure mt-1 text-body text-brand-fg">
            <T k="check.readersNote" />
          </p>
        </div>
      )}
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
      className={`flex h-full cursor-pointer flex-col rounded-lg border-2 bg-surface p-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
        file ? "border-line-strong" : "border-dashed border-control hover:border-ink"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body font-semibold text-ink">
          <T k={doc.label} />
          {doc.required && <span className="ml-1 text-danger-fg">*</span>}
        </span>
        {file && (
          <span className="text-meta font-semibold text-agreed-fg">
            <T k="evidence.chosen" />
          </span>
        )}
      </div>
      <p className="mt-1 text-meta text-ink-2">
        <T k={doc.hint} />
      </p>

      {/* The empty-state word breaks. The Tamil for "no photo chosen yet" ends
          in a 24-character word, and a word is a grid track's minimum whether or
          not the box around it is `overflow-hidden` - clipping hides the paint,
          not the min-content. It sized this card's column to 385px inside a
          335px phone, and the whole page scrolled sideways with it. Breaking
          inside the word is the only thing that makes the column narrower than
          the word. */}
      <div className="mt-3 flex flex-1 items-center justify-center overflow-hidden rounded-sm border border-line bg-muted">
        {file ? (
          <FilePreview file={file} alt={`${t(doc.label)} — ${t("evidence.preview")}`} />
        ) : (
          <span className="px-3 py-8 text-center text-meta text-ink-3 [overflow-wrap:anywhere]">
            <T k="evidence.noneYet" />
          </span>
        )}
      </div>

      {/* WRAPS, because "choose a photo" is three words in English and one
          287px Tamil phrase at 125% text. Held on one line beside a filename it
          made the card 25px wider than a 390px phone, which scrolls the whole
          PAGE sideways - a filename column cannot shrink a `shrink-0` pill. The
          pill drops to its own line instead, and breaks inside itself if even a
          full-width line is not enough. */}
      <span className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <span className="min-w-0 break-all font-mono text-meta text-ink-3">
          {file ? file.name : t("check.noFile")}
        </span>
        <span className="max-w-full shrink-0 rounded-sm border border-control px-3 py-1 text-meta font-semibold text-ink [overflow-wrap:anywhere]">
          {file ? <T k="evidence.replace" /> : <T k="evidence.choose" />}
        </span>
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
  return <img ref={img} alt={alt} className="max-h-40 w-full object-contain" />;
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
