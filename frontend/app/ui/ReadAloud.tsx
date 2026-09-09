"use client";

/**
 * Read the result aloud.
 *
 * TWO RULES, AND THEY ARE THE SAME RULE THIS PRODUCT IS BUILT ON.
 *
 * 1. IT READS WHAT IS ON THE SCREEN. The caller passes the sentences it has
 *    just rendered, built from the same `money()` strings and the same
 *    dictionary keys. There is no template here and no second copy of the
 *    figures. A read-aloud that speaks something other than what is displayed
 *    is the same defect as a cache chip wearing a live latency: a second
 *    channel quietly asserting a different fact from the first.
 *
 * 2. NO VOICE, NO BUTTON. If the device has no voice for the language on
 *    screen, the control is not rendered. The tempting fallback - speak it with
 *    whatever voice exists - reads Bengali text through an English synthesiser
 *    and produces confident noise. Many inexpensive Android handsets, which is
 *    exactly the hardware this persona owns, ship no Bengali or Tamil voice at
 *    all, so this path is common rather than theoretical.
 *
 * SERVER-SIDE TTS IS THE PRODUCTION ANSWER and is deliberately not built here.
 * A cloud Indic voice would give every device the same coverage instead of
 * leaving it to whatever the handset shipped with. It costs money per
 * character, adds a network round trip to a screen that currently needs none,
 * and adds a third vendor to a product whose whole architecture is about not
 * depending on one. For a demo on a laptop, the browser's own synthesiser is
 * honest about what it can and cannot do, which is the property that matters.
 */

import { useEffect, useState } from "react";
import { BCP47 } from "@/lib/i18n";
import { T, usePrefs, useT } from "./Prefs";

/** A voice counts for a language when its BCP-47 tag shares a primary subtag:
 * `bn-IN` and `bn-BD` both serve `bn`, and `zh-CN` serves `zh`. Matching the
 * whole tag would reject a perfectly good regional voice. */
function voiceFor(voices: SpeechSynthesisVoice[], tag: string): SpeechSynthesisVoice | null {
  const primary = tag.split("-")[0].toLowerCase();
  return (
    voices.find((v) => v.lang.toLowerCase() === tag.toLowerCase()) ??
    voices.find((v) => v.lang.toLowerCase().split("-")[0] === primary) ??
    null
  );
}

export function ReadAloud({ lines }: { lines: string[] }) {
  const { lang } = usePrefs();
  const t = useT();
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    // Chrome populates the list asynchronously and returns [] on the first
    // call, so a one-shot check would hide the button on every cold load.
    const read = () => setVoice(voiceFor(window.speechSynthesis.getVoices(), BCP47[lang]));
    read();
    window.speechSynthesis.addEventListener("voiceschanged", read);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", read);
      window.speechSynthesis.cancel();
    };
  }, [lang]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Not rendered at all. Not disabled, not greyed out with a tooltip: an
  // affordance that cannot do the thing it names should not be on the screen.
  //
  // One condition, not two: with no SpeechSynthesis the effect returns early
  // and `voice` never leaves null, so "the API is missing" and "the API has no
  // voice for this language" collapse into the same check. A separate
  // `supported` flag was a second piece of state asserting what this one
  // already proves.
  if (!voice) return null;

  const stop = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const start = () => {
    window.speechSynthesis.cancel();
    // One utterance per line, so the synthesiser pauses between a label and its
    // figure instead of running "$62.24Expected gross" together.
    const queue = lines.filter((l) => l.trim().length > 0);
    queue.forEach((line, i) => {
      const u = new SpeechSynthesisUtterance(line);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.95;
      if (i === queue.length - 1) u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    });
    setSpeaking(true);
  };

  // print-hide: a button on paper is a button nobody can press, and this one
  // offers to speak a page that is no longer a page.
  return (
    <button
      type="button"
      onClick={speaking ? stop : start}
      className="tap-sm print-hide inline-flex items-center gap-2 rounded-sm border border-control bg-surface px-4 py-2 text-body font-medium text-ink hover:border-ink"
      aria-label={speaking ? t("ctl.readAloud.stop") : t("ctl.readAloud")}
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {speaking ? (
          <>
            <rect x="4" y="4" width="8" height="8" rx="1" />
          </>
        ) : (
          <>
            <path d="M3 6.2h2.4L8.6 3.4v9.2L5.4 9.8H3z" />
            <path d="M11 6.1a2.7 2.7 0 010 3.8" />
            <path d="M12.9 4.2a5.4 5.4 0 010 7.6" />
          </>
        )}
      </svg>
      <T k={speaking ? "ctl.readAloud.stop" : "ctl.readAloud"} />
    </button>
  );
}
