import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book a Private Consultation",
  description:
    "Request a confidential consultation with James Roman Advisory. Private owner-side advisory for coastal estate owners in Los Angeles.",
  alternates: {
    canonical: "https://www.jamesroman.la/prototype/contact",
  },
  openGraph: {
    title: "Request a Private Consultation — James Roman Advisory",
    description:
      "Discreet. Owner-side. No conflicts. Advisory for coastal estate owners in Los Angeles.",
    url: "https://www.jamesroman.la/prototype/contact",
  },
  twitter: {
    title: "Request a Private Consultation — James Roman Advisory",
    description:
      "Discreet. Owner-side. No conflicts. Advisory for coastal estate owners in Los Angeles.",
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
