# Visual Constitution — James Roman Advisory

Source: `visual-constitution.md`, `production-readiness.md`

## The Rule (Production Constraint — Not a Style Preference)

No future CRM, Office Portal, or Admin feature may reduce:

- **visual calmness**
- **perceived discretion**
- **perceived competence**
- **speed**

This applies to every authenticated surface: `/office`, `/admin`, `office.jamesroman.la`, `admin.jamesroman.la`

## Enforcement Gate

Before a feature moves from prototype to staging, verify:

- The screen feels quieter, clearer, or more useful than the prior version
- No visual noise, unnecessary cards, generic dashboard clutter, or fake luxury styling
- The workflow does not expose more information than the user needs at that moment
- The interaction path is at least as fast as the prior version
- The page remains fast under expected data volume
- Copy is restrained, precise, and confidence-building

**If a feature improves functionality but reduces calmness, discretion, competence, or speed → it is not ready.**

## Public Site (Prototype2) — Additional Rules
- Prototype2 public experience is sacred and frozen
- No visual changes without explicit approval
- Every media, animation, layout, or typography change requires browser QA before deploy
- Visual/animation QA test: `npm run prototype:test:visual`
- Screenshot artifacts saved to `/tmp/jra-visual-qa`
- Test covers: `/`, `/prototype`, `/prototype2`, `/prototype2/contact`
- Test verifies: no console errors, no horizontal overflow, hero H1 visible, founder image visible and stable, reduced-motion mode renders core content

## Design Reference
Quiet luxury. Timeless. Minimal. Masculine. Authoritative. Meticulously executed.
References: Porsche, Tom Ford, Apple, Aman-style hospitality, private banking, high-end editorial design.
