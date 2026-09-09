"use client";

/**
 * The three things a reader may change about this interface: its language, its
 * text size, and its contrast.
 *
 * All three are ONE MECHANISM EACH, not a second layout:
 *   language -> <html lang> plus a dictionary lookup
 *   size     -> --ui-scale, which every rem in the app already multiplies by
 *   contrast -> [data-contrast="high"], which redefines the design tokens
 *
 * Nothing here branches on a preference to render a different component, so a
 * reader at 150% with high contrast in Bengali is looking at the same tree as a
 * reader at 100%. That is what makes the accessibility work and the projector
 * mode the same feature rather than two.
 *
 * THE STORE IS EXTERNAL, AND READ THROUGH useSyncExternalStore. localStorage is
 * not React state: the server has none, another tab can change it, and a
 * browser with site data blocked THROWS on access rather than returning null.
 * Restoring it with a setState inside an effect would work and is what this
 * file did first; the external-store API is the one React provides for exactly
 * this, and it gives cross-tab sync for free.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { BCP47, isLang, lookup, type Key, type Lang } from "@/lib/i18n";

export type Scale = 1 | 2 | 3;
const SCALE_VALUE: Record<Scale, number> = { 1: 1, 2: 1.25, 3: 1.5 };

type Stored = { lang: Lang; scale: Scale; hc: boolean };
const DEFAULTS: Stored = { lang: "en", scale: 1, hc: false };
const STORE = "fairslip.prefs";

/**
 * THE RESET IS ONE ACTION, BECAUSE IT WILL BE PERFORMED BY A TIRED PERSON AT
 * 09:55 IN A ROOM FULL OF PEOPLE.
 *
 * These preferences persist per browser profile, which bit this build during
 * verification: a screenshot pass left the interface in Tamil and the next run
 * of the scripted path failed on its first beat, looking for English that was
 * no longer on the screen. On stage that is the whole demo in a language the
 * presenter cannot read.
 *
 * The old remedy was a procedure - look at three controls, click the ones that
 * are wrong, or open DevTools and remove a storage key. A procedure with more
 * than one step is a procedure that gets skipped, so the whole of it is now a
 * URL: /check?reset=1 clears the stored preferences and comes up in English.
 * docs/demo-script.md's setup step is "open this URL", and a test asserts the
 * URL in that file is the one this code implements.
 *
 * It clears the KEY rather than writing English into it: a reset that named the
 * fields it knew about would silently stop resetting a preference added later.
 */
const RESET_PARAM = "reset";
const RESET_VALUE = "1";

function resetRequested(): boolean {
  try {
    return new URLSearchParams(window.location.search).get(RESET_PARAM) === RESET_VALUE;
  } catch {
    return false;
  }
}

function clearStorage() {
  try {
    // Removing the key also wakes every OTHER tab on this profile: `storage`
    // fires there with newValue === null, and readStorage() then returns the
    // defaults. A rehearsal tab left open in Tamil resets with this one.
    localStorage.removeItem(STORE);
  } catch {
    // Storage blocked. Nothing was stored, so nothing needs clearing, and the
    // defaults below are already what this page will use.
  }
}

/** Take the parameter back out of the address bar once it has been applied, so
 * that a later reload keeps whatever the reader has since chosen rather than
 * silently reverting them mid-Q&A. */
function stripResetParam() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete(RESET_PARAM);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // A URL we cannot rewrite is not a reason to fail the reset that just ran.
  }
}

/* The snapshot getSnapshot returns. Held at module scope and replaced only when
 * the value actually changes, because useSyncExternalStore compares by identity
 * and a fresh object every call is an infinite render. */
let snapshot: Stored = DEFAULTS;
let hydrated = false;
const listeners = new Set<() => void>();

function readStorage(): Stored {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return DEFAULTS;
    const v = JSON.parse(raw) as Partial<{ lang: string; scale: number; hc: boolean }>;
    return {
      lang: isLang(v.lang) ? v.lang : DEFAULTS.lang,
      scale: v.scale === 1 || v.scale === 2 || v.scale === 3 ? v.scale : DEFAULTS.scale,
      hc: typeof v.hc === "boolean" ? v.hc : DEFAULTS.hc,
    };
  } catch {
    // A private window, cleared site data, or a browser set to block storage.
    // The defaults are correct, and a preference is not worth a blank page.
    return DEFAULTS;
  }
}

function same(a: Stored, b: Stored) {
  return a.lang === b.lang && a.scale === b.scale && a.hc === b.hc;
}

function emit() {
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void) {
  // First subscription happens after mount, which is where the stored value is
  // allowed to arrive: reading it during render would produce markup the server
  // never sent.
  if (!hydrated) {
    hydrated = true;
    if (resetRequested()) {
      // snapshot is already DEFAULTS, which is why this needs no reload: the
      // first render a reader sees is the English one.
      clearStorage();
      stripResetParam();
    } else {
      const stored = readStorage();
      if (!same(stored, snapshot)) snapshot = stored;
    }
  }
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORE) return;
    const next = readStorage();
    if (!same(next, snapshot)) {
      snapshot = next;
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

function write(patch: Partial<Stored>) {
  const next = { ...snapshot, ...patch };
  if (same(next, snapshot)) return;
  snapshot = next;
  try {
    localStorage.setItem(STORE, JSON.stringify(next));
  } catch {
    // The preference still applies to this page; it just will not persist.
  }
  emit();
}

type Prefs = Stored & {
  setLang: (l: Lang) => void;
  setScale: (s: Scale) => void;
  setHighContrast: (v: boolean) => void;
};

const Ctx = createContext<Prefs | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => DEFAULTS);

  // Apply to the document. `lang` drives :lang() leading, the font fallback
  // chain, and which voice a screen reader or SpeechSynthesis picks - a
  // switcher that changed the words and left lang="en" would hand a Bengali
  // sentence to an English synthesiser.
  useEffect(() => {
    const root = document.documentElement;
    root.lang = BCP47[state.lang];
    root.style.setProperty("--ui-scale", String(SCALE_VALUE[state.scale]));
    if (state.hc) root.setAttribute("data-contrast", "high");
    else root.removeAttribute("data-contrast");
  }, [state.lang, state.scale, state.hc]);

  const value = useMemo<Prefs>(
    () => ({
      ...state,
      setLang: (lang) => write({ lang }),
      setScale: (scale) => write({ scale }),
      setHighContrast: (hc) => write({ hc }),
    }),
    [state],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePrefs outside PrefsProvider");
  return v;
}

/**
 * Translate. Returns a STRING, for the places that need one - an aria-label, a
 * placeholder, a title. Anything rendered as visible text should use <T>
 * instead, which can mark an untranslated string; a bare string cannot.
 */
export function useT(): (key: Key, vars?: Record<string, string | number>) => string {
  const { lang } = usePrefs();
  return useCallback((key, vars) => lookup(lang, key, vars).text, [lang]);
}

/**
 * A translated string, rendered.
 *
 * When the active language has no entry for the key, this renders the ENGLISH -
 * marked with a dotted underline and carrying lang="en", so a screen reader
 * switches voice rather than reading English through a Bengali synthesiser.
 * Never a key, never an empty string, never a machine translation nobody asked
 * for. An untranslated string is an unestablished fact about what this
 * interface says, and it is labelled like every other one.
 */
export function T({
  k,
  vars,
  className,
}: {
  k: Key;
  vars?: Record<string, string | number>;
  className?: string;
}) {
  const { lang } = usePrefs();
  const { text, translated } = lookup(lang, k, vars);
  if (translated) return <span className={className}>{text}</span>;
  return (
    <span className={`untranslated ${className ?? ""}`} lang="en">
      {text}
    </span>
  );
}
