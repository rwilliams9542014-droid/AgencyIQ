# AgencyIQ Design System

AgencyIQ now has a foundational token layer in `src/index.css` and shared component rules in `src/App.css`.

## Core Tokens

- Colors: `--color-primary`, `--color-secondary`, `--color-success`, `--color-warning`, `--color-danger`, `--color-info`, and neutral steps.
- Typography: `--font-size-xs` through `--font-size-3xl`, `--line-tight`, `--line-body`, and weight tokens.
- Spacing: `--space-1` through `--space-10` using a 4px base scale.
- Radius: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-pill`.
- Shadows: `--shadow-sm`, `--shadow-md`, `--shadow-lg`.
- Controls: `--control-height-sm`, `--control-height-md`, `--control-height-lg`.
- Motion: `--motion-fast`, `--motion-hover`, `--motion-medium`, `--motion-slow`, plus shared easing tokens.

## Component Standards

- Buttons use `.primary-action`, `.secondary-action`, `.utility-action`, `.icon-button`, and `.text-button`.
- Cards and panels use `.panel`, `.metric-card`, `.admin-panel`, `.policy-card`, and `.folder-card-body`.
- Status UI uses `.status-pill`, `.priority`, `.workflow-chip`, `.transaction-status`, and renewal status chips.
- Tables use shared table, `th`, and `td` treatment for typography, row density, and contrast.
- Forms and modals share tokenized radius, focus ring, and control sizing.
- Micro-animations use shared timing and easing tokens for row hover, sticky bars, buttons, dropdowns, and popovers.

## Usage Rules

- Use token values first. Avoid hard-coded colors, spacing, shadows, and radii unless a specific workflow needs a one-off.
- Use the semantic color tokens for business meaning:
  - Success: completed, current, paid, healthy renewal.
  - Warning: approaching renewal, needs review, scheduled/hold.
  - Danger: overdue, past renewal, failed, missing critical data.
  - Info: neutral system messages and informational states.
- Keep cards at `--radius-md` unless the component is a pill or modal.
- Keep spacing on the 4px scale.
- Use existing shared button/card/badge classes before creating new component styles.
- Keep interaction motion subtle: hover fades around 120ms, sticky/header motion around 80ms, dropdown scale/fade around 180ms.
- Respect reduced motion by keeping animations removable through `prefers-reduced-motion`.
