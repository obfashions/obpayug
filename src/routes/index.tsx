import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "White Page" },
      { name: "description", content: "A clean white page." },
      { property: "og:title", content: "White Page" },
      { property: "og:description", content: "A clean white page." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Index() {
  return (
    <div className="min-h-screen bg-background" />
  );
}

