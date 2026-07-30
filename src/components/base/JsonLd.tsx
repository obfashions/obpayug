interface JsonLdProps {
  data: Record<string, unknown>;
}

/**
 * Renders JSON-LD structured data inline. Rendering the same markup on the
 * server and the client keeps hydration stable, and crawlers read JSON-LD
 * anywhere in the document.
 */
export function JsonLd({ data }: JsonLdProps) {
  const json = JSON.stringify(data);
  const id = `jsonld-${data["@type"]?.toString().toLowerCase() || "schema"}`;

  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
