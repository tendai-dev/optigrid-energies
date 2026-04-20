/* ============================================================
   OptiGrid Energies — Motion Layer
   Owns all scroll-driven and load animations.
   Requires: GSAP + ScrollTrigger, Lenis, SplitType (CDN)
   ============================================================ */

/* ----------------------------------------------------------
   CONSTANTS — change durations, easings, and thresholds here
   ---------------------------------------------------------- */

/** Duration for standard reveal animations (seconds). */
const REVEAL_DURATION = 1.0;

/** Duration for hero title word-split animation (seconds). */
const HERO_TITLE_DURATION = 1.1;

/** Duration for page-hero title word-split animation (seconds). */
const PAGE_HERO_DURATION = 0.9;

/** Stagger delay between sibling elements in a reveal group (seconds). */
const STAGGER_DELAY = 0.08;

/** Extra delay for .text-muted spans within headings (seconds). */
const MUTED_SPAN_DELAY = 0.15;

/** Y-translation offset elements start from (pixels). */
const REVEAL_Y = 40;

/** ScrollTrigger start position — element top reaches this % of viewport. */
const REVEAL_START = "top 85%";

/** Easing used for reveals and hero animation. */
const EASE_OUT_EXPO = "expo.out";

/** Easing used for parallax scrubbing. */
const EASE_NONE = "none";

/** Lenis smooth-scroll duration (seconds). */
const LENIS_DURATION = 1.2;

/** Lenis lerp factor — lower = smoother/more floaty. */
const LENIS_LERP = 0.1;

/** Gallery item image hover scale. */
const GALLERY_HOVER_SCALE = 1.05;

/** Gallery item image hover duration (seconds). */
const GALLERY_HOVER_DURATION = 0.6;

/** Hero bg parallax initial scale (zoomed in). */
const HERO_BG_SCALE_FROM = 1.08;

/** Hero bg parallax final scale (zoomed out). */
const HERO_BG_SCALE_TO = 1.0;

/* ----------------------------------------------------------
   REDUCED MOTION — show everything immediately if preferred
   ---------------------------------------------------------- */

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

/* Mark <html> as motion-ready. CSS only hides .reveal / .reveal-stagger
   when this class is present, so if this script fails to execute the
   page renders in full (graceful degradation). */
if (!prefersReducedMotion && typeof gsap !== "undefined") {
  document.documentElement.classList.add("motion-ready");
}

/* Failsafe: if any reveal element is still hidden 3s after load (CDN
   slow, ScrollTrigger glitch, trigger never fires), force everything
   visible so the user is never stuck on a blank page. */
const MOTION_FAILSAFE_MS = 3000;
setTimeout(() => {
  const hidden = document.querySelectorAll(".reveal, .reveal-stagger");
  hidden.forEach((el) => {
    const opacity = parseFloat(getComputedStyle(el).opacity);
    if (opacity < 0.05) {
      el.style.opacity = "1";
      el.style.transform = "none";
    }
  });
}, MOTION_FAILSAFE_MS);

/* ----------------------------------------------------------
   Guard: only run full animation suite when GSAP is available
   ---------------------------------------------------------- */

if (!prefersReducedMotion && typeof gsap !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);

  /* ----------------------------------------------------------
     LENIS SMOOTH SCROLL SETUP
     - Exponential-out easing gives a premium deceleration feel
     - Feeds Lenis RAF into GSAP ticker so ScrollTrigger stays
       in sync with the smooth-scroll position
     ---------------------------------------------------------- */

  const lenis = new Lenis({
    duration: LENIS_DURATION,
    // Exponential-out: fast start, slow finish — premium feel
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    smoothTouch: false,
    lerp: LENIS_LERP,
  });

  // Keep ScrollTrigger in sync with Lenis scroll position
  lenis.on("scroll", ScrollTrigger.update);

  // Drive Lenis from GSAP's ticker for frame-perfect sync
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });

  // Disable GSAP's own lagSmoothing so it doesn't fight Lenis
  gsap.ticker.lagSmoothing(0);

  /* ----------------------------------------------------------
     HERO ANIMATIONS (index.html only)
     - Split .hero__title into words, animate on page load
     - Hero background parallax as user scrolls down
     ---------------------------------------------------------- */

  const heroTitle = document.querySelector(".hero__title");
  const heroBg = document.querySelector(".hero__bg");

  if (heroTitle && typeof SplitType !== "undefined") {
    // SplitType owns the hero title's entrance — remove .reveal so the
    // generic reveal pipeline doesn't double-hide the element.
    heroTitle.classList.remove("reveal");
    heroTitle.style.opacity = "1";
    heroTitle.style.transform = "none";

    const split = new SplitType(heroTitle, { types: "words" });

    gsap.from(split.words, {
      y: 100,
      opacity: 0,
      stagger: 0.05,
      duration: HERO_TITLE_DURATION,
      ease: EASE_OUT_EXPO,
      delay: 0.1,
    });
  }

  if (heroBg) {
    // Ensure parallax target has a compositing hint
    heroBg.style.willChange = "transform";

    gsap.fromTo(
      heroBg,
      { scale: HERO_BG_SCALE_FROM, y: "-5%" },
      {
        scale: HERO_BG_SCALE_TO,
        y: "5%",
        ease: EASE_NONE,
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      },
    );
  }

  /* ----------------------------------------------------------
     PAGE HERO ANIMATIONS (about, services, products, contact)
     - Split .page-hero__title into words, animate on load
     ---------------------------------------------------------- */

  const pageHeroTitle = document.querySelector(".page-hero__title");

  if (pageHeroTitle && typeof SplitType !== "undefined") {
    // Remove .reveal from page hero title since we're overriding it
    pageHeroTitle.classList.remove("reveal");
    pageHeroTitle.style.opacity = "1";
    pageHeroTitle.style.transform = "none";

    const pageSplit = new SplitType(pageHeroTitle, { types: "words" });

    gsap.from(pageSplit.words, {
      y: 60,
      opacity: 0,
      stagger: 0.05,
      duration: PAGE_HERO_DURATION,
      ease: EASE_OUT_EXPO,
      delay: 0.15,
    });
  }

  /* ----------------------------------------------------------
     SCROLL REVEALS
     - .reveal        → fade up from REVEAL_Y, single element
     - .reveal-stagger → same but siblings are staggered 0.08s
     - Section headers: if h2 contains .text-muted, the muted
       span gets a slight extra delay so the main text lands first
     ---------------------------------------------------------- */

  /**
   * Builds the GSAP from-vars for a reveal animation.
   * Keeping these in one place makes tweaking straightforward.
   */
  function buildRevealVars(trigger, staggerDelay, extraDelay) {
    return {
      y: REVEAL_Y,
      opacity: 0,
      duration: REVEAL_DURATION,
      ease: EASE_OUT_EXPO,
      stagger: staggerDelay || 0,
      delay: extraDelay || 0,
      scrollTrigger: {
        trigger,
        start: REVEAL_START,
        once: true,
      },
    };
  }

  // --- Standard reveals ---
  gsap.utils.toArray(".reveal").forEach((el) => {
    // Skip elements already handled by a specific animation above
    if (
      el.classList.contains("hero__title") ||
      el.classList.contains("page-hero__title")
    ) {
      return;
    }

    // Check if this heading contains a .text-muted child span
    const mutedSpan = el.querySelector(".text-muted");
    if (mutedSpan) {
      // Animate the heading itself first, then the muted part slightly later
      const mainTextNodes = Array.from(el.childNodes).filter(
        (n) =>
          n !== mutedSpan &&
          (n.nodeType === Node.TEXT_NODE ? n.textContent.trim() : true),
      );

      gsap.from(el, buildRevealVars(el, 0, 0));

      // Subtle secondary animation on the muted span
      gsap.from(mutedSpan, {
        opacity: 0,
        y: 12,
        duration: REVEAL_DURATION * 0.8,
        ease: EASE_OUT_EXPO,
        delay: MUTED_SPAN_DELAY,
        scrollTrigger: {
          trigger: el,
          start: REVEAL_START,
          once: true,
        },
      });
    } else {
      gsap.from(el, buildRevealVars(el, 0, 0));
    }
  });

  // --- Stagger reveals ---
  // Group children by their direct parent container so that cards
  // in the same row stagger together, not all items on the page at once.
  const staggerContainers = new Set();
  gsap.utils.toArray(".reveal-stagger").forEach((el) => {
    if (el.parentElement) {
      staggerContainers.add(el.parentElement);
    }
  });

  staggerContainers.forEach((container) => {
    const items = gsap.utils.toArray(
      container.querySelectorAll(":scope > .reveal-stagger"),
    );
    if (items.length === 0) return;

    gsap.from(items, {
      y: REVEAL_Y,
      opacity: 0,
      duration: REVEAL_DURATION,
      ease: EASE_OUT_EXPO,
      stagger: STAGGER_DELAY,
      scrollTrigger: {
        trigger: container,
        start: REVEAL_START,
        once: true,
      },
    });
  });

  /* ----------------------------------------------------------
     STATS COUNTER TRIGGER
     - The counting logic stays in main.js (no duplication)
     - We fire a custom event when .stats enters viewport so
       main.js can pick it up, OR we directly handle here if
       main.js counters are still IntersectionObserver-driven.
     - Since main.js counters use [data-target] with their own
       IntersectionObserver at threshold 0.3, we leave them alone
       — they already work well and no duplication is needed.
     ---------------------------------------------------------- */

  /* ----------------------------------------------------------
     FINAL CTA — subtle watermark counter-scroll
     - The watermark text drifts opposite to scroll direction
       for a layered depth effect. Kept intentionally subtle.
     ---------------------------------------------------------- */

  const finalCtaWatermark = document.querySelector(".final-cta__watermark");
  const finalCtaSection = document.querySelector(".final-cta");

  if (finalCtaWatermark && finalCtaSection) {
    finalCtaWatermark.style.willChange = "transform";

    gsap.to(finalCtaWatermark, {
      x: "-8%",
      ease: EASE_NONE,
      scrollTrigger: {
        trigger: finalCtaSection,
        start: "top bottom",
        end: "bottom top",
        scrub: 1.5,
      },
    });
  }

  /* ----------------------------------------------------------
     GALLERY PREVIEW — hover scale via JS (complements CSS)
     - CSS already handles transform on hover via transition
     - We upgrade it to a GSAP tween for precise easing control
     - We listen to mouseenter/mouseleave on each item to give
       the image a smooth power2.out scale
     ---------------------------------------------------------- */

  gsap.utils.toArray(".gallery-preview__item").forEach((item) => {
    const img = item.querySelector("img");
    if (!img) return;

    // Override the CSS hover transition — GSAP takes control
    img.style.transition = "none";

    item.addEventListener("mouseenter", () => {
      gsap.to(img, {
        scale: GALLERY_HOVER_SCALE,
        duration: GALLERY_HOVER_DURATION,
        ease: "power2.out",
        overwrite: true,
      });
    });

    item.addEventListener("mouseleave", () => {
      gsap.to(img, {
        scale: 1,
        duration: GALLERY_HOVER_DURATION,
        ease: "power2.out",
        overwrite: true,
      });
    });
  });

  /* ----------------------------------------------------------
     PARTNERS MARQUEE — hover pause
     - The marquee animates via CSS @keyframes in styles.css
     - On hover of any partner item we pause the track animation
     ---------------------------------------------------------- */

  const partnersTrack = document.querySelector(".partners__track");
  if (partnersTrack) {
    partnersTrack.addEventListener("mouseenter", () => {
      partnersTrack.style.animationPlayState = "paused";
    });
    partnersTrack.addEventListener("mouseleave", () => {
      partnersTrack.style.animationPlayState = "running";
    });
  }

  /* ----------------------------------------------------------
     NAV SCROLL CLASS
     - main.js already handles is-scrolled at 60px threshold
     - No duplication needed; motion.js defers to main.js for nav
     ---------------------------------------------------------- */
}
