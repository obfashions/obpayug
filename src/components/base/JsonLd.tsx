import { createPortal } from "react-dom";

interface JsonLdProps {
  data: Record<string, unknown>;
}

export function JsonLd({ data }: JsonLdProps) {
  const json = JSON.stringify(data);
  const id = `jsonld-${data["@type"]?.toString().toLowerCase() || "schema"}`;

  // During SSR there is no `document` — emit the script inline, which is still
  // valid JSON-LD for crawlers.
  if (typeof document === "undefined") {
    return (
      <script
        id={id}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: json }}
      />
    );
  }

  const existing = document.getElementById(id);
  if (existing) {
    existing.textContent = json;
    return null;
  }

  return createPortal(
    <script id={id} type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />,
    document.head
  );
}
