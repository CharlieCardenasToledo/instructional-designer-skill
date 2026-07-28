---
name: Instructional Designer Skill
description: Glassmorphic UI with liquid control elements
colors:
  brand: "#0f766e"
  brand-hover: "#115e59"
  app-bg: "#eef2f4"
  app-text: "#111827"
  app-muted: "#6b7280"
  surface: "#f8fafc"
  surface-raised: "#ffffff"
  green: "#4ade80"
  red: "#f87171"
  yellow: "#fbbf24"
typography:
  body:
    fontFamily: "Inter, 'Segoe UI', system-ui, sans-serif"
    fontSize: "13px"
    lineHeight: "1.5"
rounded:
  app: "10px"
  app-lg: "14px"
  capsule: "999px"
spacing:
  sm: "8px"
  md: "16px"
components:
  liquid-control:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.app-text}"
    rounded: "{rounded.app}"
---

# Design System: Instructional Designer Skill

## Overview

**Creative North Star: "Glassmorphic"**

The aesthetic philosophy centers around a clean, glassmorphic environment. It balances a refined, minimalist foreground with ambient, softly blurred backgrounds. The design language focuses on reducing cognitive load by keeping the interface mostly flat and unobtrusive, allowing the content and subtle interactive states to guide the user. Organic animated blobs (like `.onboarding-blob`) live in the background, adding a touch of life without distracting from the task at hand.

**Key Characteristics:**
- Glassmorphic panels and controls with translucent borders.
- Subdued ambient depth, prioritizing a flat overall composition.
- Refined and minimalist containers that frame content quietly.
- Crisp, legible typography with a compact baseline size (13px).

## Colors

The palette is anchored by a deep, modern oceanic teal that invites action without being aggressive, contrasted against clean neutral surfaces.

### Primary
- **Brand Teal** (#0f766e): A deep, modern oceanic tone that invites action without being aggressive. Used for primary actions and accents.
- **Brand Hover** (#115e59): Deeper teal for active/hover states.

### Secondary
- **Success Green** (#4ade80): For positive confirmations and step indicators.
- **Error Red** (#f87171): For destructive actions and errors.
- **Warning Yellow** (#fbbf24): For warnings and loading states.

### Neutral
- **App Background** (#eef2f4): The canvas baseline color.
- **App Text** (#111827): High-contrast dark gray for primary reading.
- **Muted Text** (#6b7280): Secondary labels and helper text.
- **Surface** (#f8fafc): Elevated neutral backgrounds.

### Named Rules
**The Translucent Restraint Rule.** Solid opaque colors are reserved for text and crucial indicators. Containers and controls rely heavily on `rgba()` transparency and backdrop-filters to harmonize with the environment.

## Typography

**Body Font:** Inter, "Segoe UI", system-ui, sans-serif

**Character:** Clean, highly legible, and native-feeling. It prioritizes information density and clarity for productivity and tooling.

### Hierarchy
- **Body** (400, 13px, 1.5): The default application text size. Dense but highly readable.
- **Label** (600, 12px): Section headers and form labels. Uses `--text-2` color.
- **Code** (11px): Monospaced elements using Cascadia Code or Consolas.

## Layout

The layout uses a flexible, container-based approach that adapts to the viewport. It employs CSS Container Queries (`@container`) for complex data grids, ensuring columns collapse gracefully on smaller widths.

## Elevation & Depth

Subtle and ambient: Depth is only used to slightly detach interactive controls from the background, keeping the system as flat as possible.

### Shadow Vocabulary
- **Surface Drop** (`0 8px 24px rgba(15, 23, 42, 0.08)`): Very diffuse, low-opacity shadow for primary containers.
- **Control Shadow** (`0 10px 24px rgba(15, 23, 42, 0.10)`): Used in conjunction with inset highlights to pop glassmorphic controls.

### Named Rules
**The Ambient Depth Rule.** Shadows never act as heavy structural borders. They are ethereal and wide, meant only to separate translucent layers from the blurred background elements.

## Shapes

Corners are soft but structural. Forms avoid sharp edges to maintain the liquid glass aesthetic.
- Default radius: `10px`
- Large elements: `14px`
- Pills/Badges: `999px` (Capsule)

## Components

Refined and minimalist: They are subtle containers that frame the content without stealing the spotlight from the background.

### Liquid Control (Glassmorphism)
- **Shape:** `10px` radius.
- **Style:** Semi-transparent white fill (`rgba(255, 255, 255, .38)`) with a backdrop-blur of `18px`.
- **Border:** Features an inset shadow that acts as a top-edge highlight (`inset 0 1px 0 rgba(255, 255, 255, .54)`) to simulate glass thickness.
- **Hover:** Increases fill opacity to `.56` to feel tactile.

### Liquid Control Brand (Primary Action)
- **Style:** Teal-tinted glass (`rgba(15, 118, 110, .78)`) with cyan inner borders (`rgba(153, 246, 228, .62)`).
- **Hover:** Deepens to `rgba(17, 94, 89, .86)`.

### Form Inputs
- **Shape:** `10px` radius, solid white background for high contrast.
- **Focus:** Replaces standard outlines with a dual-ring glow: a `3px` teal-dim spread and a `12px` teal-glow shadow.

## Do's and Don'ts

### Do:
- **Do** use `backdrop-filter: blur(18px) saturate(180%) contrast(104%)` on standard liquid controls to maintain the glassmorphic consistency.
- **Do** rely on inset shadows (`inset 0 1px 0...`) to define the top edges of glass elements instead of solid borders.
- **Do** respect the `13px` base font size for standard density.

### Don't:
- **Don't** use opaque, heavy shadows. All drop shadows should be highly transparent (`≤ 10%` opacity).
- **Don't** apply strong solid borders to interactive elements; use subtle translucency.
