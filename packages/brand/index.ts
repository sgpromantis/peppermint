// ─────────────────────────────────────────────────────────
// Brand Identity & Color Tokens
// Central source of truth — import everywhere, edit once.
// ─────────────────────────────────────────────────────────

// ── Colors (hex) ─────────────────────────────────────────

export const colors = {
  /** Dunkelgrün — primary brand color */
  primary: "#006e00",
  /** Hover state for primary */
  primaryHover: "#005a00",
  /** Hellgrün — accent / secondary brand color */
  accent: "#6bdf57",
  /** Blau — highlight / info */
  info: "#98f1f7",
  /** Schwarzgrau — foreground / text base */
  foreground: "#454743",
} as const;

// ── HSL values (for CSS custom-properties in globals.css) ─

export const hsl = {
  /** #006e00 */
  primary: "120 100% 22%",
  /** #6bdf57 */
  accent: "111 68% 61%",
  /** #98f1f7 */
  info: "184 86% 78%",
  /** #454743 */
  foreground: "90 3% 27%",
} as const;

// ── Identity ─────────────────────────────────────────────

export const identity = {
  name: "promantis",
  tagline: "professionell. progressiv. proaktiv.",
  fullName: "promantis Helpdesk",
  contactEmail: "info@promantis.de",
  copyright: `© ${new Date().getFullYear()} promantis. Alle Rechte vorbehalten.`,
} as const;

// ── Logo assets ──────────────────────────────────────────
// The official logo is a PNG — used as-is, not recreated.

export const logo = {
  /** Full logo with claim text (200×150) — for sidebars, headers */
  src: "/logo.png",
  /** Square icon (256×256, white bg) — for favicons, small usage */
  iconSrc: "/logo-icon.png",
  alt: `${identity.name} Logo`,
  width: 200,
  height: 150,
  iconSize: 256,
} as const;

// ── Re-export Logo component path ────────────────────────
// Usage:  import { BrandLogo } from "@peppermint/brand/logo";
