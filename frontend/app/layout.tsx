import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans, Noto_Sans_Bengali, Noto_Sans_SC, Noto_Sans_Tamil } from "next/font/google";
import "./globals.css";
import { PrefsProvider } from "./ui/Prefs";

/*
 * The four scripts FairSlip's interface is offered in.
 *
 * ONE STACK, NOT FOUR. globals.css lists all four families in a single
 * font-family, and the browser picks per GLYPH: Noto Sans covers Latin and has
 * no Bengali, so a Bengali character falls through to Noto Sans Bengali on the
 * same line. That is what makes a mixed line - "Rahim / রহিম" - render with one
 * consistent Latin face instead of two, which is the actual x-height failure
 * mode. What :lang() varies is LEADING, not family: Bengali and Tamil stack
 * conjuncts and matras above and below the baseline and need more room than
 * Latin, or the diacritics clip.
 *
 * THE "UI"-SUFFIXED VARIANTS DO NOT EXIST HERE. Noto Sans Bengali UI and Noto
 * Sans Tamil UI are published in the Noto GitHub releases but not on Google
 * Fonts - zero of the 1,942 families next/font can load match `Noto ... UI`.
 * They exist to survive vertically CONSTRAINED layouts by compressing their
 * metrics; this interface is not vertically constrained, and the correct fix
 * for clipping in a layout with room is to give the line room. See the
 * per-script line-height in globals.css.
 *
 * SC IS LOADED LAST AND LAZILY. Noto Sans SC is multi-megabyte, and the
 * scripted demo never selects Mandarin for the interface. `preload: false`
 * emits the @font-face rules without a <link rel=preload>, so the browser
 * fetches a CJK range only when a Chinese glyph is actually rendered - which is
 * when the reader picks 中文 and not before.
 */
const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  display: "swap",
});

const notoBengali = Noto_Sans_Bengali({
  variable: "--font-noto-bengali",
  subsets: ["bengali", "latin"],
  display: "swap",
});

const notoTamil = Noto_Sans_Tamil({
  variable: "--font-noto-tamil",
  subsets: ["tamil", "latin"],
  display: "swap",
});

const notoSC = Noto_Sans_SC({
  variable: "--font-noto-sc",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

/* Kept for the formulas, the reader transcripts and the provenance lines. Those
 * are Latin and ASCII by construction - an engine formula and a cache key are
 * not translated - so they do not need a Noto face. */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FairSlip",
  description:
    "Reconstructs what MOM's and CPF Board's published rules say a month should have paid.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `lang` is set here and updated on the element by the language switcher,
    // because :lang() drives the leading and a screen reader picks its voice
    // from this attribute. A switcher that changed the words and left lang="en"
    // would hand a Bengali sentence to an English synthesiser.
    <html
      lang="en"
      className={`${notoSans.variable} ${notoBengali.variable} ${notoTamil.variable} ${notoSC.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PrefsProvider>{children}</PrefsProvider>
      </body>
    </html>
  );
}
