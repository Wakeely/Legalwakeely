import { Alert } from "@/components/ui/alert";
import { Quote } from "lucide-react";
import type { Block } from "@/lib/learn-data";

function toneStyles(tone: "info" | "warning" | "tip" | "danger") {
  switch (tone) {
    case "info":
      return { variant: "info" as const };
    case "warning":
      return { variant: "warning" as const };
    case "tip":
      return { variant: "success" as const };
    case "danger":
      return { variant: "danger" as const };
  }
}

export function LearnContent({ blocks }: { blocks: Block[] }) {
  return (
    <div className="prose-rtl max-w-none space-y-5 text-base leading-8 text-ink-800">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h2":
            return (
              <h2
                key={i}
                className="mt-8 border-b border-ink-200 pb-2 text-xl font-extrabold text-ink-900 first:mt-0"
              >
                {b.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="mt-6 text-lg font-bold text-ink-900">
                {b.text}
              </h3>
            );
          case "p":
            return (
              <p key={i} className="text-ink-800">
                {b.text}
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="list-disc space-y-2 ps-6 text-ink-800 marker:text-brand-500">
                {b.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="list-decimal space-y-2 ps-6 text-ink-800 marker:font-bold marker:text-brand-600">
                {b.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ol>
            );
          case "callout": {
            const { variant } = toneStyles(b.tone);
            return (
              <div key={i} className="my-6">
                <Alert variant={variant} title={b.title}>
                  {b.text}
                </Alert>
              </div>
            );
          }
          case "quote":
            return (
              <blockquote
                key={i}
                className="my-6 border-s-4 border-brand-300 bg-brand-50/50 px-4 py-3 italic text-ink-700"
              >
                <Quote className="mb-1 h-4 w-4 text-brand-500" />
                <div>{b.text}</div>
                {b.source && (
                  <div className="mt-1 text-xs not-italic text-ink-500">— {b.source}</div>
                )}
              </blockquote>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
