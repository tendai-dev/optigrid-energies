# OptiGrid Energies — Motion Direction

Premium, confident, calm. The site should feel engineered, not animated. Every motion earns its place by clarifying hierarchy or revealing craft.

---

## 1. Reference Sites

| Site                                                   | What to steal (pattern only)                                                                                                                                                                                                             |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [toptier.relats.com](https://toptier.relats.com)       | Long Lenis-smoothed scroll, oversized serif/sans headlines that "split-mask" up from a clipping line, image blocks that scale from `1.08 -> 1.0` as they enter, restrained marquee at low speed. Steal the _pacing_, not the typography. |
| [zolargy.com](https://zolargy.com) (solar, industrial) | Section-pinned scroll where a hero image stays fixed while text blocks advance over it. Use this for the About or PAYG section — anchors the brand in "grounded / physical" instead of "digital agency".                                 |
| [bjarkeingels.com](https://big.dk) (architecture)      | Calm, almost static entrances — only opacity + 24-40px translate, no bounce, no scale gimmicks. Demonstrates that restraint reads as premium. Steal the _discipline_.                                                                    |

---

## 2. Motion Principles

### Global scroll (Lenis)

```js
new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothTouch: false,
  touchMultiplier: 1.5,
});
```

`smoothTouch: false` — mobile keeps native scroll (smoother on low-end Android, important for ZW market).

### Hero entrance choreography

Total runtime ~1.4s. Nav fades in last so it doesn't compete.

| Order | Element               | Motion                            | Delay | Duration            |
| ----- | --------------------- | --------------------------------- | ----- | ------------------- |
| 1     | `.hero__bg`           | scale 1.08 -> 1.0, opacity 0 -> 1 | 0.0s  | 1.4s                |
| 2     | `.hero__label`        | mask-reveal up (y 100% -> 0)      | 0.35s | 0.7s                |
| 3     | `.hero__title`        | split lines, stagger up           | 0.45s | 0.9s                |
| 4     | `.hero__subtitle`     | opacity + y 16px                  | 0.85s | 0.7s                |
| 5     | `.hero__cta`          | opacity + y 12px                  | 1.0s  | 0.6s                |
| 6     | `.hero__feature-card` | stagger opacity + y 24px          | 1.1s  | 0.7s, 0.08s stagger |
| 7     | `.nav`                | opacity fade                      | 1.2s  | 0.5s                |

### Section reveal pattern

- Trigger: ScrollTrigger `start: "top 85%"`, `once: true`
- Headlines: split by line (GSAP SplitText or manual), mask-reveal from below, 0.08s stagger per line
- Body copy: single opacity + 20px translate
- Images: scale from 1.06 -> 1.0 with opacity, clipped by parent overflow
- Card grids (`reveal-stagger`): opacity + 24px translate, 0.08s stagger

### Scroll-tied behaviors

| Element             | Treatment                                                                          |
| ------------------- | ---------------------------------------------------------------------------------- |
| Hero bg image       | `y: -8%` parallax on scroll out (slow)                                             |
| About image         | `scale 1.0 -> 1.08` across viewport traversal                                      |
| Gallery images      | subtle `y: -6%` parallax, each tile offset                                         |
| Partners marquee    | 40s linear infinite; pauses on hover (opacity 0.6 -> 1 on hovered item)            |
| Stats               | CountUp tied to ScrollTrigger `start: "top 75%"`, 2.0s duration, ease `power2.out` |
| Final CTA watermark | horizontal drift `x: -15%` scroll-linked                                           |

**Pin candidates:** the PAYG 3-step section. Pin for ~150% viewport, reveal each step as scroll progresses. Turns a static row into a story.

### Hover micro-interactions

| Element               | Motion                                                                      |
| --------------------- | --------------------------------------------------------------------------- |
| Nav links             | underline wipe left->right, 0.3s `power2.out`                               |
| Primary CTA           | bg-fill wipe from left, icon translates `x: 4px`                            |
| Service/gallery cards | image `scale 1.0 -> 1.04` (0.6s `expo.out`), card `y: -4px`, border softens |
| Link-arrow            | arrow slides `x: 6px`, text color shifts to accent                          |
| Testimonial card      | very light `y: -3px`, shadow softens. Nothing more.                         |

### Cursor treatment

**No custom cursor.** A solar contractor is a trust business — custom cursors read as "agency showreel" and distance you from municipal/commercial buyers. Keep the native cursor. Optionally add a subtle circular cursor-follower _only_ on the gallery grid for the image-hover state.

---

## 3. GSAP Timings

### Easings

| Use                         | Easing                                     | Why                                            |
| --------------------------- | ------------------------------------------ | ---------------------------------------------- |
| Text reveals, headlines     | `expo.out` (cubic-bezier(0.16, 1, 0.3, 1)) | Fast takeoff, long settle — reads as confident |
| Images scale-in             | `power3.out`                               | Slightly firmer landing for physical objects   |
| Hover state changes         | `power2.out` @ 0.3-0.4s                    | Quick, predictable                             |
| Parallax & scroll-tied      | `none` (linear)                            | Scroll IS the timing; easing adds lag          |
| Page transitions / overlays | custom `cubic-bezier(0.76, 0, 0.24, 1)`    | Symmetric in/out                               |

**Never:** `back.out`, `elastic`, `bounce`. They signal playful/B2C.

### Staggers

| Context                         | Value                                          |
| ------------------------------- | ---------------------------------------------- |
| Headline split lines            | **0.08s**                                      |
| Small card grids (3-4 items)    | **0.08s**                                      |
| Large grids (5+ items, gallery) | **0.06s** (keep total under ~0.5s)             |
| Nav links on menu open          | **0.05s**                                      |
| Stats counters                  | **0.1s** (each number feels like its own beat) |

### Durations

| Type                      | Duration                               |
| ------------------------- | -------------------------------------- |
| Entrance (text)           | 0.7-0.9s                               |
| Entrance (image/hero bg)  | 1.2-1.4s                               |
| Exit / fade-out           | 0.4-0.5s (always faster than entrance) |
| Hover state               | 0.3-0.4s                               |
| Micro (icon nudge, caret) | 0.2s                                   |

---

## 4. What to Avoid (Solar/Energy Brand)

| Avoid                                      | Because                                                                     |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| Bouncy / elastic eases                     | Reads as consumer-app playful; undermines engineering credibility           |
| Purple / violet gradients, neon            | AI-template cliché; also clashes with teal `#0F232A`                        |
| Glowing, pulsing "sun" elements            | Too literal, childlike                                                      |
| 3D model spinning on scroll                | Heavy on mobile, irrelevant for a contractor pitch                          |
| Full-screen horizontal sections            | Works for fashion/portfolio, not for municipal buyers skimming proof points |
| Marquees faster than ~35-45s per loop      | Reads as urgency / discount-retail                                          |
| Text that shuffles/scrambles               | Distracts from numbers, which are the real proof                            |
| Cursor trails, magnetic cursors everywhere | Gimmicky. Save magnetism for the single primary CTA if anywhere             |
| Dark-mode-first with neon accents          | Clashes with cream palette and commercial trust signals                     |

**Overall tone:** _calm water, not fireworks._ Every second of motion should make the next section more legible.

---

## 5. Copy Polish Suggestions

| #   | Current                                                                                                                                               | Suggested                                                                                                         | Why                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | Hero H1: "Zimbabwe's Trusted Solar Panel Contractor"                                                                                                  | **"Zimbabwe runs on sunlight. We make it useful."**                                                               | Category-defining. Current headline is descriptive; the replacement is a position.                     |
| 2   | Hero sub: "Powering homes and businesses across Zimbabwe with clean, reliable, and affordable solar energy — from design to installation and beyond." | **"Designed, installed, and maintained in-country — from a single rooftop in Harare to warehouses in Bulawayo."** | Replaces three generic adjectives with concrete geography. Proof, not adjectives.                      |
| 3   | About H2: "Leading Zimbabwe Into a Sustainable Energy Future"                                                                                         | **"Built in Zimbabwe, for Zimbabwe's grid."**                                                                     | "Leading...future" is every solar site. The new line claims local engineering — a real differentiator. |
| 4   | PAYG H2: "Pay-As-You-Go Solar — Own Your Power, One Payment At A Time"                                                                                | **"Own your power. Pay for it like you pay ZESA."**                                                               | Localised, concrete, instantly understood. Mentioning ZESA makes the mental model click.               |
| 5   | Final CTA: "Experience the future of Solar power?"                                                                                                    | **"Stop paying for blackouts."**                                                                                  | Question headlines are weak. Loss-framed imperative converts harder; also names the real pain.         |

---

## Implementation order

1. Install Lenis + GSAP + ScrollTrigger + SplitText, wire to existing `.reveal` / `.reveal-stagger` selectors
2. Ship hero choreography and section reveal pattern (covers 80% of perceived quality)
3. Add stats count-up + partners marquee tuning
4. Layer parallax and the PAYG pin last — they're the risk
5. QA on a mid-tier Android over 3G before sign-off
