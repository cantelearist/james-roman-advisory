export const clerkAppearance = {
  variables: {
    colorBackground:        "#101218",
    colorText:              "#ece6d6",
    colorTextSecondary:     "rgba(236,230,214,0.65)",
    colorPrimary:           "#c9b58a",
    colorNeutral:           "#ece6d6",
    colorInputBackground:   "#161922",
    colorInputText:         "#ece6d6",
    colorDanger:            "#b85c4d",
    fontFamily:             "var(--font-geist-sans), system-ui, sans-serif",
    fontFamilyButtons:      "var(--font-geist-sans), system-ui, sans-serif",
    borderRadius:           "0.5rem",
    spacingUnit:            "1rem",
  },
  elements: {
    card:                   "shadow-none border border-primary/20 bg-card",
    headerTitle:            "font-heading text-foreground text-2xl",
    headerSubtitle:         "text-muted-foreground text-sm",
    socialButtonsBlockButton:
      "border border-primary/20 bg-secondary text-foreground hover:bg-secondary/80",
    socialButtonsBlockButtonText: "text-foreground text-sm",
    dividerLine:            "bg-primary/15",
    dividerText:            "text-muted-foreground text-xs",
    formFieldLabel:         "text-foreground/80 text-sm",
    formFieldInput:
      "bg-secondary border-primary/25 text-foreground placeholder:text-muted-foreground focus:border-primary/60",
    formButtonPrimary:
      "bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium",
    footerActionLink:       "text-primary hover:text-primary/80",
    footerActionText:       "text-muted-foreground text-sm",
    identityPreviewText:    "text-foreground",
    identityPreviewEditButton: "text-primary",
    otpCodeFieldInput:
      "bg-secondary border-primary/25 text-foreground",
    alertText:              "text-sm",
    formResendCodeLink:     "text-primary hover:text-primary/80 text-sm",
    badge:                  "hidden",
  },
};
