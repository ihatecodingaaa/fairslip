"use client";

/**
 * Language, text size and contrast - and the sentence that has to sit beside
 * them.
 *
 * Language is offered in ENDONYMS. A worker who cannot read English cannot find
 * their language in a list that says "Bengali", and a list of flags would be
 * worse: Bengali is spoken in two countries and Tamil in four, so a flag states
 * a nationality the reader never gave us.
 *
 * WHY THIS FILE EXPORTS TWO THINGS.
 *
 * The disclosure about who produced these translations is a caveat with exactly
 * one owner - backend/tests/test_inclusion.py's CAVEAT_OWNERS names this file,
 * and requires it to gate on language, because the rule once lived as an inline
 * `&&` at one call site and as nothing at a second. See docs/debt.md,
 * unearned-caveat.
 *
 * The radios now live inside a disclosure in the app shell, which a reader
 * closes after choosing. The caveat must not close with them: a reader who
 * switches to Bengali and taps away has still been handed model-produced
 * translations, and that is true for as long as the interface is in Bengali, not
 * for as long as a popover is open. So the caveat is a SECOND export from THIS
 * file, rendered persistently by the shell. One file, one owner, one language
 * gate - and the sentence outlives the panel that caused it.
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

  return (
    // print-hide: language, text size and contrast are choices about a screen.
    // What they CHANGED is on the paper - the words are in the chosen language
    // and set at the chosen size - so the controls have done their work by the
    // time anything is printed.
    <section aria-label={t("ctl.heading")} className="print-hide">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
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

      {/* The dotted-underline convention, explained beside the control that
          brings it about. It used to sit in the persistent strip at the top of
          every page, where it was a second caveat competing with the first; it
          only means anything once a language has been chosen, and this is where
          that happens. Still gated on language, still in this file - the one the
          caveat registry names. */}
      {lang !== "en" && (
        <p className="max-w-measure mt-4 border-t border-line pt-3 text-meta text-ink-2">
          <T k="ctl.untranslatedLegend" />
        </p>
      )}
    </section>
  );
}

/**
 * The caveat, and the only place it may be written.
 *
 * Returns null in English, where nothing has been translated and there is no
 * boundary to explain - the same rule, for the same reason, as
 * ui/QuotedInEnglish.tsx.
 */
export function TranslationDisclosure() {
  const { lang } = usePrefs();
  const cov = coverage(lang);
  if (lang === "en") return null;
  return (
    // ONE STRIP, NOT FIVE LINES. It carried the disclosure, the dotted-underline
    // legend and the count as three stacked blocks, which came to 370px above
    // the h1 of every page in every language but English - a caveat with more
    // presence than the content it qualified. The sentence that must persist is
    // the one about who wrote the translations; the legend about the dotted
    // underline moved into the Display panel, beside the control that chose the
    // language. Counted, not estimated: the figure is derived from the
    // dictionary rather than rounded up by whoever wrote the copy.
    <div className="print-hide border-b border-attention-line bg-attention-bg">
      <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-2">
        <p className="max-w-measure text-meta text-attention-fg">
          <T k="ctl.disclosure" />
        </p>
        <p className="font-mono text-meta text-attention-fg">
          {cov.done}/{cov.total}
        </p>
      </div>
    </div>
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
