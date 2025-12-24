## 1. Design Principles (Non-negotiable)

These principles override all other decisions.

1. **Utility over decoration**
   Every visual element must serve comprehension, navigation, or interaction.

2. **Low visual noise**
   Prefer whitespace, restrained color, and simple geometry. Avoid flourishes.

3. **Predictability**
   Similar interactions must behave identically across the site.

4. **Developer-first clarity**
   Interfaces should feel inspectable, logical, and intentional.

---

## 2. Visual Identity

### 2.1 Color System (Dark Theme)

**Base Palette**

* Background: near-black blue (`#0b1020`–`#0f172a`)
* Surface (cards, panels): slightly lighter blue (`#111827`)
* Border/divider: muted blue-gray (`#1f2937`)

**Accent Colors**

* Primary accent: desaturated blue (`#3b82f6` or darker)
* Secondary accent (optional): cyan/teal (`#22d3ee` range)

**Rules**

* No red or green hues.
* Accent colors used **only** for:

  * Primary actions
  * Active states
  * Focus indicators
* Never use accent colors for large background fills.

---

### 2.2 Typography

**Font Stack**

* UI / body: system-ui or Inter
* Code / data: JetBrains Mono, Fira Code, or equivalent

**Hierarchy**

* Page title: single dominant heading
* Section headers: visually subtle, not bold-heavy
* Body text: regular weight, high contrast

**Rules**

* No more than two font families total.
* Avoid decorative fonts entirely.
* Use font size, not color, for hierarchy.

---

### 2.3 Layout

**Structure**

* Single-column default
* Max width: 960–1100px
* Centered content

**Spacing**

* Use a fixed spacing scale (e.g., 4 / 8 / 16 / 32)
* No arbitrary spacing values

**Rules**

* No full-bleed sections unless content demands it (e.g. large tables).
* Grids are functional, not decorative.

---

## 3. Components

### 3.1 Cards / Panels

Used to contain tools.

* Flat appearance
* Subtle border, no heavy shadows
* Clear title, optional description, then content

**Rule**

* Cards never nest inside cards.

---

### 3.2 Buttons

**Types**

* Primary: one per screen max
* Secondary: neutral, outline or low-contrast fill
* Tertiary: text-only

**Rules**

* Buttons must look clickable without hover.
* No icon-only buttons unless universally obvious (e.g. close).

---

### 3.3 Forms & Inputs

* Rectangular, sharp or slightly rounded corners
* Clear labels above inputs
* Inline validation preferred over modals

**Rules**

* No placeholder-only labels.
* No animated input effects.

---

### 3.4 Tables / Grids (e.g. ag-grid)

* Dense but readable
* Alternating row backgrounds allowed
* Sorting/filtering controls visible but understated

**Rules**

* Default to showing raw data honestly.
* No visual embellishment beyond clarity.

---

## 4. Interaction Patterns

### 4.1 State Feedback

**Required states**

* Loading
* Success
* Error
* Empty

**Rules**

* Use text + subtle visual cue, not color alone.
* Loading indicators should be minimal (spinner or text).

---

### 4.2 Navigation

* Flat hierarchy
* No hidden navigation
* Breadcrumbs only if depth > 2

**Rules**

* Navigation must always be visible or obvious.
* Avoid animations tied to navigation.

---

### 4.3 Animations

* Optional, never required
* Duration < 200ms
* Ease-in-out only

**Rules**

* No animation for decoration.
* Animations must convey cause → effect.

---

## 5. Tone of Voice

### 5.1 Writing Style

* Neutral
* Direct
* Slightly technical
* No marketing language

**Examples**

* Prefer: “Generates a CSV summary from input data”
* Avoid: “A powerful and elegant tool that supercharges…”

---

### 5.2 Copy Rules

* Short sentences
* No exclamation marks
* No emojis
* Avoid jokes and personality flourishes

**UI Text**

* Verbs over nouns (“Export data”, not “Export”)
* Explicit over clever

---

## 6. Content Structure

Each project page should follow this order:

1. Title
2. One-sentence description
3. Tool interface
4. Optional explanation
5. Optional implementation notes

**Rules**

* Tool always comes before explanation.
* No long introductions.

---

## 7. Accessibility (Minimal Baseline)

Even if not a priority, enforce:

* Sufficient contrast for text
* Keyboard navigation for core actions

No additional compliance requirements unless added later.

---

## 8. Enforceability & Change Strategy

To enable style transitions:

* All colors defined as variables
* All spacing from a single scale
* All components reusable and centralized
* No inline styles
* No one-off UI decisions

**Rule**
If a pattern appears twice, it must become a component.


Specify which you want next.
