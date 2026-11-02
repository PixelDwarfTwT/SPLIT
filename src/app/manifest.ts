import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Patungan",
    short_name: "Patungan",
    description: "Lebih jelas. Lebih adil.",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F7F3",
    theme_color: "#52745B",
    icons: [
      { src: "/icons/patungan-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/patungan-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/patungan-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
