import type { MetadataRoute } from "next";

/**
 * PWA Manifest
 * Defines app metadata for Progressive Web App features
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Credit Card Dashboard",
    short_name: "CC Dashboard",
    description: "Personal credit card management and analytics dashboard",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0a0e1a",
    theme_color: "#10b981",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    categories: ["finance", "productivity"],
  };
}
