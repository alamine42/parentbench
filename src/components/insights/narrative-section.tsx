/**
 * Long-form narrative renderer (parentbench-ov1.6).
 *
 * Minimal markdown — the writer prompt asks for plain paragraphs.
 * Splits on blank lines into paragraphs and treats `**bold**` and
 * `*italic*` as inline emphasis. Renders as React text nodes (no
 * dangerouslySetInnerHTML) so escaping is automatic.
 *
 * Inline chartSlot keys (e.g. `provider-rollup`) are matched against a
 * caller-supplied chart map and rendered in place after the paragraph.
 */

import type { ReactNode } from "react";

type ChartSlot = "provider-rollup" | "category-leaders" | "biggest-movers" | "spread";

export type NarrativeSection = {
  heading: string;
  body: string;
  chartSlot?: ChartSlot;
};

export function NarrativeSections({
  sections,
  charts,
}: {
  sections: NarrativeSection[];
  charts: Partial<Record<ChartSlot, ReactNode>>;
}) {
  return (
    <div className="prose-narrative max-w-3xl space-y-10">
      {sections.map((s, i) => (
        <section key={i}>
          <h2 className="mb-3 text-2xl font-bold">{s.heading}</h2>
          <Paragraphs body={s.body} />
          {s.chartSlot && charts[s.chartSlot] ? (
            <div className="mt-6">{charts[s.chartSlot]}</div>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function Paragraphs({ body }: { body: string }) {
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="space-y-4 text-base leading-relaxed">
      {paragraphs.map((p, i) => (
        <p key={i}>{renderInline(p)}</p>
      ))}
    </div>
  );
}

function renderInline(text: string): ReactNode {
  // Cheap inline parser: **bold**, *italic*. Anything else passes through
  // as plain text — React escapes it automatically.
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
