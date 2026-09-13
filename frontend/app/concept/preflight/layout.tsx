import type { Metadata } from "next";

/**
 * The concept route's own metadata.
 *
 * NOINDEX, DELIBERATELY. This page is a drawing of a product that does not
 * exist, for an audience of a handful of people who were sent the link. A
 * search engine's summary of it would carry the headline and not the badge
 * under it, which is exactly the misreading the badge exists to prevent.
 */
export const metadata: Metadata = {
  title: "FairSlip Preflight, a product concept",
  description:
    "A future product concept: checking that recorded workforce changes became the right "
    + "payroll outcome. Fictional data, not a deployed integration.",
  robots: { index: false, follow: false },
};

export default function ConceptPreflightLayout({ children }: LayoutProps<"/concept/preflight">) {
  return children;
}
