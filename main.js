/* ============================================================
   OptiGrid Energies - Shared JavaScript
   Multi-page solar energy website utilities
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ----------------------------------------------------------
     1. DARK MODE TOGGLE
     - Reads saved preference from localStorage on load
     - Applies theme to <html data-theme="...">
     - Toggles sun/moon icon visibility
     ---------------------------------------------------------- */

  const THEME_KEY = 'optigrid-theme';
  const root = document.documentElement;
  const themeToggle = document.querySelector('#themeToggle');
  const sunIcon = themeToggle?.querySelector('.sun-icon');
  const moonIcon = themeToggle?.querySelector('.moon-icon');

  /** Apply the given theme string and update icon visibility. */
  function applyTheme(theme) {
    root.dataset.theme = theme;
    if (sunIcon && moonIcon) {
      // Sun icon shows when theme is dark (click to go light)
      // Moon icon shows when theme is light (click to go dark)
      sunIcon.style.display = theme === 'dark' ? 'inline-block' : 'none';
      moonIcon.style.display = theme === 'light' ? 'inline-block' : 'none';
    }
  }

  // On page load: restore saved preference or default to 'light'
  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(savedTheme);

  // Listen for toggle clicks
  themeToggle?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  });


  /* ----------------------------------------------------------
     2. NAV SCROLL DETECTION
     - Adds .is-scrolled to #nav after 60px of scroll
     - Drives a horizontal progress bar (#scrollProgress)
     ---------------------------------------------------------- */

  const nav = document.querySelector('#nav');
  const scrollProgress = document.querySelector('#scrollProgress');

  function handleNavScroll() {
    // Toggle sticky class
    if (nav) {
      if (window.scrollY > 60) {
        nav.classList.add('is-scrolled');
      } else {
        nav.classList.remove('is-scrolled');
      }
    }

    // Update scroll progress bar width
    if (scrollProgress) {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const percent = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0;
      scrollProgress.style.width = `${percent}%`;
    }
  }

  window.addEventListener('scroll', handleNavScroll, { passive: true });
  // Run once on load in case the page is already scrolled
  handleNavScroll();


  /* ----------------------------------------------------------
     3. SCROLL SPY  (single-page anchor links only)
     - Highlights the nav link whose target section is in view
     - Skips links that do not point to same-page anchors
     ---------------------------------------------------------- */

  const navLinks = document.querySelectorAll('#nav a[href^="#"]');

  // Build a list of sections that correspond to in-page anchor links
  const spySections = [];
  navLinks.forEach((link) => {
    const id = link.getAttribute('href')?.slice(1);
    if (!id) return;
    const section = document.getElementById(id);
    if (section) {
      spySections.push({ link, section });
    }
  });

  function handleScrollSpy() {
    if (spySections.length === 0) return;

    // 80px offset accounts for fixed nav height
    const scrollPos = window.scrollY + 80;

    let current = spySections[0];
    for (const entry of spySections) {
      if (entry.section.offsetTop <= scrollPos) {
        current = entry;
      }
    }

    navLinks.forEach((l) => l.classList.remove('is-active'));
    current.link.classList.add('is-active');
  }

  if (spySections.length > 0) {
    window.addEventListener('scroll', handleScrollSpy, { passive: true });
    handleScrollSpy();
  }


  /* ----------------------------------------------------------
     4. SCROLL REVEAL ANIMATIONS
     - .reveal  : fades in and slides up on intersect
     - .reveal-stagger : each child is revealed with a delay
     - Uses IntersectionObserver (threshold 0.08)
     ---------------------------------------------------------- */

  const revealObserverOptions = {
    threshold: 0.08,
    rootMargin: '0px 0px -40px 0px',
  };

  // --- Standard reveal ---
  const revealElements = document.querySelectorAll('.reveal');

  if (revealElements.length > 0) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, revealObserverOptions);

    revealElements.forEach((el) => {
      // Set initial hidden state via JS so it works even without CSS
      el.style.opacity = '0';
      el.style.transform = 'translateY(40px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      revealObserver.observe(el);
    });
  }

  // --- Staggered reveal (children animate one after another) ---
  const staggerContainers = document.querySelectorAll('.reveal-stagger');

  if (staggerContainers.length > 0) {
    const staggerObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const children = entry.target.children;
          Array.from(children).forEach((child, i) => {
            // Stagger each child by 120ms
            setTimeout(() => {
              child.style.opacity = '1';
              child.style.transform = 'translateY(0)';
            }, i * 120);
          });
          observer.unobserve(entry.target);
        }
      });
    }, revealObserverOptions);

    staggerContainers.forEach((container) => {
      // Prepare each child for animation
      Array.from(container.children).forEach((child) => {
        child.style.opacity = '0';
        child.style.transform = 'translateY(40px)';
        child.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      });
      staggerObserver.observe(container);
    });
  }


  /* ----------------------------------------------------------
     5. COUNTER ANIMATIONS
     - Elements with [data-target] animate from 0 to target
     - Optional data-prefix (e.g. "$") and data-suffix (e.g. "+")
     - Triggers once per element via data-animated flag
     ---------------------------------------------------------- */

  const counterElements = document.querySelectorAll('[data-target]');

  if (counterElements.length > 0) {
    const counterObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;

        // Prevent re-triggering
        if (el.dataset.animated === 'true') return;
        el.dataset.animated = 'true';

        const target = parseFloat(el.dataset.target);
        const prefix = el.dataset.prefix || '';
        const suffix = el.dataset.suffix || '';
        const duration = 2000; // ms
        const startTime = performance.now();

        /** Ease-out cubic for a natural deceleration feel. */
        function easeOutCubic(t) {
          return 1 - Math.pow(1 - t, 3);
        }

        function tick(now) {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easedProgress = easeOutCubic(progress);
          const current = easedProgress * target;

          // Display integers for whole-number targets, else one decimal
          const display = Number.isInteger(target)
            ? Math.floor(current)
            : current.toFixed(1);

          el.textContent = `${prefix}${display}${suffix}`;

          if (progress < 1) {
            requestAnimationFrame(tick);
          } else {
            // Ensure final value is exact
            const finalDisplay = Number.isInteger(target)
              ? target
              : target.toFixed(1);
            el.textContent = `${prefix}${finalDisplay}${suffix}`;
          }
        }

        requestAnimationFrame(tick);
        observer.unobserve(el);
      });
    }, { threshold: 0.3 });

    counterElements.forEach((el) => counterObserver.observe(el));
  }


  /* ----------------------------------------------------------
     6. SMOOTH SCROLL
     - Intercepts all anchor links (a[href^="#"])
     - Scrolls to target with 80px top offset
     - Closes mobile overlay if open
     ---------------------------------------------------------- */

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href')?.slice(1);
      if (!targetId) return;

      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;

      e.preventDefault();

      const top = targetEl.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: 'smooth' });

      // Close mobile overlay if it is open
      const mobileOverlay = document.querySelector('#mobileOverlay');
      mobileOverlay?.classList.remove('is-open');
    });
  });


  /* ----------------------------------------------------------
     7. MOBILE MENU
     - #menuBtn    -> opens  #mobileOverlay (.is-open)
     - #mobileClose -> closes #mobileOverlay
     - .mobile-link  -> closes #mobileOverlay on click
     ---------------------------------------------------------- */

  const menuBtn = document.querySelector('#menuBtn');
  const mobileClose = document.querySelector('#mobileClose');
  const mobileOverlay = document.querySelector('#mobileOverlay');

  menuBtn?.addEventListener('click', () => {
    mobileOverlay?.classList.add('is-open');
  });

  mobileClose?.addEventListener('click', () => {
    mobileOverlay?.classList.remove('is-open');
  });

  document.querySelectorAll('.mobile-link').forEach((link) => {
    link.addEventListener('click', () => {
      mobileOverlay?.classList.remove('is-open');
    });
  });


  /* ----------------------------------------------------------
     8. CONTACT FORM HANDLER
     - Prevents default submit
     - Shows success feedback inside the submit button
     - Resets the form and button text after 3 seconds
     ---------------------------------------------------------- */

  const contactForm = document.querySelector('#contactForm');

  contactForm?.addEventListener('submit', (e) => {
    e.preventDefault();

    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;

    if (submitBtn) {
      submitBtn.textContent = 'Message Sent!';
      submitBtn.disabled = true;
    }

    // Reset form and button after 3 seconds
    setTimeout(() => {
      contactForm.reset();
      if (submitBtn) {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    }, 3000);
  });


  /* ----------------------------------------------------------
     9. FAQ ACCORDION  (services & contact pages)
     - .faq-item click toggles .is-open
     - Smooth expand / collapse of .faq-item__answer
     ---------------------------------------------------------- */

  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach((item) => {
    // Clicking anywhere on the faq-item header area toggles the answer
    item.addEventListener('click', () => {
      const answer = item.querySelector('.faq-item__answer');
      const isOpen = item.classList.contains('is-open');

      if (isOpen) {
        // --- Collapse ---
        // Animate height from current to 0
        if (answer) {
          answer.style.height = `${answer.scrollHeight}px`;
          // Force reflow so the browser registers the starting height
          answer.offsetHeight; // eslint-disable-line no-unused-expressions
          answer.style.transition = 'height 0.35s ease';
          answer.style.height = '0px';
          answer.style.overflow = 'hidden';
        }
        item.classList.remove('is-open');
      } else {
        // --- Expand ---
        item.classList.add('is-open');

        if (answer) {
          // Temporarily set height to auto to measure content
          answer.style.height = '0px';
          answer.style.overflow = 'hidden';
          answer.style.transition = 'height 0.35s ease';

          const targetHeight = answer.scrollHeight;
          // Force reflow
          answer.offsetHeight; // eslint-disable-line no-unused-expressions
          answer.style.height = `${targetHeight}px`;

          // After the transition, remove fixed height so content reflows naturally
          const onEnd = () => {
            answer.style.height = 'auto';
            answer.style.overflow = '';
            answer.removeEventListener('transitionend', onEnd);
          };
          answer.addEventListener('transitionend', onEnd);
        }
      }
    });
  });

});
