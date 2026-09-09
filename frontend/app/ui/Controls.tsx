"use client";

/**
 * Language, text size and contrast - one row, above everything.
 *
 * Language is offered in ENDONYMS. A worker who cannot read English cannot find
 * their language in a list that says "Bengali", and a list of flags would be
 * worse: Bengali is spoken in two countries and Tamil in four, so a flag states
 * a nationality the reader never gave us.
 *
 * The disclosure about who produced these translations appears HERE, attached
 * to the control that caused it, in the language just chosen - not in a footer.
 * It is only shown once a non-English language is selected, because in English
 * nothing has been translated and there is nothing to disclose.
 */

import { LANGS, coverage } from "@/lib/i18n";
import { T, usePrefs, useT, type Scale } from "./Prefs";

const SIZES: { value: Scale; key: "ctl.textSize.1" | "ctl.textSize.2" | "ctl.textSize.3" }[] = [
  { value: 1, key: "ctl.textSize.1" },
  { value: 2, key: "ctl.textSize.2" },
  { value: 3, key: "ctl.textSize.3" },
];

export function Controls() {
  const { lang, setLang, scale, setScale, hc, setHighContrast } = usePrefs();
  const t = useT();
  const cov = coverage(lang);

  return (
    // print-hide, on every page that mounts it: language, text size and
    // contrast are choices about a screen. What they CHANGED is on the paper -
    // the words are in the chosen language and set at the chosen size - so the
    // controls have done their work by the time anything is printed.
    <section aria-label={t("ctl.heading")} className="print-hide mb-6">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4 rounded-lg border border-line-strong bg-surface p-4 shadow-card">
        <Group label={<T k="ctl.language" />}>
          {LANGS.map((l) => (
            <Choice
              key={l.code}
              name="fairslip-lang"
              checked={lang === l.code}
              onPick={() => setLang(l.code)}
              // The endonym is in its own script, so it carries its own lang -
              // otherwise a screen reader in English mode says "baa-ngg-la".
              label={<span lang={l.code}>{l.endonym}</span>}
            />
          ))}
        </Group>

        <Group label={<T k="ctl.textSize" />}>
          {SIZES.map((s) => (
            <Choice
              key={s.value}
              name="fairslip-scale"
              checked={scale === s.value}
              onPick={() => setScale(s.value)}
              label={<T k={s.key} />}
            />
          ))}
        </Group>

        <Group label={<T k="ctl.contrast" />}>
          <Choice
            name="fairslip-contrast"
            checked={!hc}
            onPick={() => setHighContrast(false)}
            label={<T k="ctl.contrast.normal" />}
          />
          <Choice
            name="fairslip-contrast"
            checked={hc}
            onPick={() => setHighContrast(true)}
            label={<T k="ctl.contrast.high" />}
          />
        </Group>
      </div>

      {lang !== "en" && (
        <div className="mt-2 rounded-lg border border-attention-line bg-attention-bg px-4 py-3">
          <p className="max-w-measure text-meta text-attention-fg">
            <T k="ctl.disclosure" />
          </p>
          <p className="mt-2 max-w-measure text-meta text-attention-fg">
            <T k="ctl.untranslatedLegend" />
          </p>
          {/* Counted, not estimated. A progress claim about a translation is a
              claim like any other, and this one is derived from the dictionary
              rather than rounded up by whoever wrote the copy. */}
          <p className="mt-2 font-mono text-meta text-attention-fg">
            {cov.done}/{cov.total}
          </p>
        </div>
      )}
    </section>
  );
}

function Group({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <fieldset className="border-0 p-0">
      <legend className="mb-1 p-0 text-meta font-semibold text-ink-2">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

/**
 * A radio that looks like a button.
 *
 * The input is the real control - visually hidden but focusable and reachable
 * by arrow key inside its fieldset - and the styling hangs off :checked on the
 * label. Hand-rolling this out of <button aria-pressed> would lose the arrow
 * keys and tell a screen reader there are N independent toggles where there is
 * one choice of N.
 */
function Choice({
  name,
  checked,
  onPick,
  label,
}: {
  name: string;
  checked: boolean;
  onPick: () => void;
  label: React.ReactNode;
}) {
  return (
    <label
      className={`tap-sm inline-flex cursor-pointer items-center rounded-sm border px-4 py-2 text-body has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
        checked
          ? "border-brand bg-brand font-semibold text-on-solid"
          : "border-control bg-surface text-ink hover:border-ink"
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onPick}
        className="sr-only"
      />
      {label}
    </label>
  );
}
