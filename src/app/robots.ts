import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/prototype/contact"],
        disallow: [
          "/api/",
          "/portal/",
          "/sign-in/",
          "/sign-up/",
          "/mfa-required/",
          "/prototype2/",
        ],
      },
    ],
    sitemap: "https://www.jamesroman.la/sitemap.xml",
  };
}
