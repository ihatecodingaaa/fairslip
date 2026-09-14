"use client";

/**
 * What was loaded, and the word this panel exists to not say.
 *
 * IT DOES NOT SAY "CONNECTED". Every row is an export somebody produced and
 * dropped in, and the chip on each one says so. A prototype that drew a green
 * dot beside a vendor's name would be claiming an integration that does not
 * exist, in the one part of the screen a technical reviewer looks at first.
 *
 * NO VENDOR IS NAMED EITHER. "Attendance system" rather than a product, because
 * the concept has no relationship with any of them and a logo would imply one.
 * It is also the more honest shape of the idea: what FairSlip would need is an
 * export of attendance, not an export from one particular vendor.
 *
 * EXPORT-FIRST IS THE PILOT, NOT A LIMITATION. A payroll team can produce these
 * six files on the first call. An API is a thing to earn later, if the workflow
 * turns out to be worth anything to them.
 */

import { SOURCE_LABEL } from "@/lib/concept-preflight/selectors";
import type { InputFile } from "@/lib/concept-preflight/types";

export function InputSources({ inputs }: { inputs: InputFile[] }) {
  return (
    <section aria-label="What was loaded">
      <p className="max-w-measure text-meta text-ink-3">
        Files somebody exported and dropped in. Nothing here is connected to a live system.
      </p>

      <ul className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {inputs.map((file) => (
          <li key={file.file} className="border-t border-line pt-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-body font-semibold text-ink">{file.label}</p>
              <p className="rounded-sm border border-line-strong bg-sunken px-2 py-1 text-meta font-medium text-ink-2">
                Demo export
              </p>
            </div>
            <p className="text-meta text-ink-3">{SOURCE_LABEL[file.system]}</p>
            <p className="max-w-measure mt-2 text-meta text-ink-2">{file.provides}</p>
            <p className="mt-2 break-all font-mono text-meta text-ink-3">
              {file.file} <span className="tabular-nums">{file.rows.toLocaleString("en-SG")}</span>{" "}
              rows
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
