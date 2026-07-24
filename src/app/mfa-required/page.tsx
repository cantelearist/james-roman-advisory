"use client";

import Link from "next/link";
import { ShieldAlert, ShieldCheck } from "lucide-react";

const GOLD = "#c9b58a";
const BG = "#0a0b0e";
const CARD = "#0d0f14";
const TITAN = "#b2a898";

export default function MFARequiredPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          background: CARD,
          border: `1px solid rgba(201,181,138,0.15)`,
          padding: "3rem 2.5rem",
          textAlign: "center",
        }}
      >
        {/* Icon */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(201,181,138,0.08)",
              border: `1px solid rgba(201,181,138,0.2)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShieldAlert size={28} color={GOLD} />
          </div>
        </div>

        {/* Heading */}
        <p
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: TITAN,
            marginBottom: "1rem",
          }}
        >
          Security requirement
        </p>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2rem",
            fontWeight: 600,
            color: "#ece6d6",
            lineHeight: 1.2,
            marginBottom: "1.5rem",
          }}
        >
          Two-factor authentication required
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            color: TITAN,
            lineHeight: 1.7,
            marginBottom: "2.5rem",
          }}
        >
          Staff access to James Roman Advisory requires a verified second factor.
          This protects client records and sensitive engagement data. Please
          enable an authenticator app or SMS verification before continuing.
        </p>

        {/* Steps */}
        <div
          style={{
            borderTop: "1px solid rgba(201,181,138,0.12)",
            borderBottom: "1px solid rgba(201,181,138,0.12)",
            padding: "1.5rem 0",
            marginBottom: "2rem",
            textAlign: "left",
            display: "grid",
            gap: "1rem",
          }}
        >
          {[
            "Open your account settings at account.jamesroman.la",
            "Navigate to Security → Two-factor authentication",
            "Add an authenticator app (Google Authenticator, 1Password, Authy)",
            "Return here — access is restored immediately after verification",
          ].map((step, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}
            >
              <span
                style={{
                  minWidth: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "rgba(201,181,138,0.1)",
                  border: "1px solid rgba(201,181,138,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.65rem",
                  color: GOLD,
                  fontWeight: 600,
                  marginTop: 2,
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: "0.8rem", color: TITAN, lineHeight: 1.6 }}>
                {step}
              </span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <a
          href="https://accounts.clerk.dev/user"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            background: GOLD,
            color: "#070809",
            fontSize: "0.75rem",
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            padding: "0.875rem 2rem",
            textDecoration: "none",
            transition: "opacity 0.2s",
            marginBottom: "1rem",
          }}
          onMouseOver={(e) =>
            (e.currentTarget.style.opacity = "0.85")
          }
          onMouseOut={(e) =>
            (e.currentTarget.style.opacity = "1")
          }
        >
          <ShieldCheck size={14} />
          Set up two-factor authentication
        </a>

        <Link
          href="/portal"
          style={{
            display: "block",
            fontSize: "0.7rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "rgba(178,168,152,0.5)",
            textDecoration: "none",
            transition: "color 0.2s",
          }}
          onMouseOver={(e) =>
            (e.currentTarget.style.color = TITAN)
          }
          onMouseOut={(e) =>
            (e.currentTarget.style.color = "rgba(178,168,152,0.5)")
          }
        >
          Return to portal
        </Link>
      </div>
    </main>
  );
}
