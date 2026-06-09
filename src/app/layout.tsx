import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.jamesroman.la"),

  title: {
    default: "James Roman Advisory | Private Remediation & Inspection Oversight",
    template: "%s | James Roman Advisory",
  },
  description:
    "Private owner-side advisory for hazardous materials remediation and structural inspection oversight. Coastal estate specialists. Los Angeles.",

  keywords: [
    "hazardous materials remediation advisory",
    "mold remediation oversight Los Angeles",
    "coastal estate inspection Malibu",
    "owner-side property advisory",
    "structural inspection oversight Beverly Hills",
    "private construction advisory Los Angeles",
    "James Roman Advisory",
  ],

  authors: [{ name: "James Roman Advisory" }],
  creator: "James Roman Advisory",

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },

  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.jamesroman.la",
    siteName: "James Roman Advisory",
    title: "James Roman Advisory | Private Remediation & Inspection Oversight",
    description:
      "Owner-side advisory for hazardous materials remediation and structural inspection oversight. Coastal estate specialists. Los Angeles.",
    images: [
      {
        url: "/images/jra-hero.jpg",
        width: 1200,
        height: 630,
        alt: "James Roman Advisory — Malibu coastal estate",
        type: "image/jpeg",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "James Roman Advisory | Private Remediation & Inspection Oversight",
    description:
      "Owner-side advisory for hazardous materials remediation and structural inspection oversight. Los Angeles.",
    images: ["/images/jra-hero.jpg"],
  },

  verification: {
    google: "gX9mKpLqR2vWnYzAbCdEfHjMtSuV3kow",
  },

  alternates: {
    canonical: "https://www.jamesroman.la",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} h-full scroll-smooth antialiased`}
      >
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
