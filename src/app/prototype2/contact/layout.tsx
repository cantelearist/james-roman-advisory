import type { Metadata } from "next";

// prototype2/contact is a variant — point canonical back to the primary route
export const metadata: Metadata = {
  title: "Book a Private Consultation",
  description:
    "Request a confidential consultation with James Roman Advisory. Private owner-side advisory for coastal estate owners in Los Angeles.",
  robots: { index: false, follow: false },
  alternates: {
    canonical: "https://www.jamesroman.la/prototype/contact",
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
