"use client";

// Global error boundary — replaces the entire root layout when an unhandled
// error reaches the top of the React tree. Must be a Client Component and
// must NOT depend on any context providers (ClerkProvider, etc.) because
// those are not available at this boundary.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0b0e",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#ece6d6",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 480, padding: "2rem" }}>
          <p
            style={{
              fontSize: "0.75rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#b2a898",
              marginBottom: "1.5rem",
            }}
          >
            James Roman Advisory
          </p>
          <h1
            style={{
              fontSize: "1.25rem",
              fontWeight: 500,
              marginBottom: "0.75rem",
              color: "#ece6d6",
            }}
          >
            Something went wrong.
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#b2a898",
              marginBottom: "2rem",
              lineHeight: 1.6,
            }}
          >
            An unexpected error occurred. Please try again or contact us
            directly if the problem persists.
          </p>
          <button
            onClick={reset}
            style={{
              background: "transparent",
              border: "1px solid #b2a898",
              color: "#ece6d6",
              padding: "0.625rem 1.5rem",
              fontSize: "0.8125rem",
              letterSpacing: "0.08em",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {process.env.NODE_ENV === "development" && error?.digest && (
            <p
              style={{
                marginTop: "1.5rem",
                fontSize: "0.75rem",
                color: "#b2a898",
                fontFamily: "monospace",
              }}
            >
              {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
