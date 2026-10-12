import { CitationSource } from '../types';

let activeHighlightTimeout: any = null;
let activeHighlightElements: HTMLElement[] = [];
let activeBadgeElements: HTMLElement[] = [];

/**
 * Removes active evidence highlight classes, pulse styling, and floating badges from the DOM.
 */
export function cleanupActiveHighlights(): void {
  if (activeHighlightTimeout) {
    clearTimeout(activeHighlightTimeout);
    activeHighlightTimeout = null;
  }

  // Remove highlight class and reset inline styles if any
  activeHighlightElements.forEach((el) => {
    if (el && el.classList) {
      el.classList.remove('evidence-highlight-active');
    }
  });
  activeHighlightElements = [];

  // Also query document for any orphaned highlight elements
  const existingHighlighted = document.querySelectorAll('.evidence-highlight-active');
  existingHighlighted.forEach((el) => {
    el.classList.remove('evidence-highlight-active');
  });

  // Remove any injected badge elements
  activeBadgeElements.forEach((b) => {
    if (b && b.parentElement) {
      b.parentElement.removeChild(b);
    }
  });
  activeBadgeElements = [];

  const existingBadges = document.querySelectorAll('.evidence-source-badge');
  existingBadges.forEach((b) => {
    if (b.parentElement) {
      b.parentElement.removeChild(b);
    }
  });
}

/**
 * Robust asynchronous element waiter that uses MutationObserver combined with polling
 * to wait for dynamically rendered table rows or charts after route transitions.
 */
export async function waitForElement(
  selectors: string[],
  timeoutMs = 4500
): Promise<HTMLElement | null> {
  const startTime = Date.now();

  const findMatch = (): HTMLElement | null => {
    for (const sel of selectors) {
      if (!sel) continue;
      try {
        const el = document.querySelector<HTMLElement>(sel);
        if (el && el.offsetParent !== null) {
          return el;
        }
      } catch {
        // Ignore invalid selector syntax safely
      }
    }
    return null;
  };

  const immediate = findMatch();
  if (immediate) return immediate;

  return new Promise((resolve) => {
    let resolved = false;

    const observer = new MutationObserver(() => {
      const match = findMatch();
      if (match && !resolved) {
        resolved = true;
        observer.disconnect();
        clearInterval(interval);
        clearTimeout(timer);
        resolve(match);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['id', 'data-source-id', 'data-record-id'],
    });

    const interval = setInterval(() => {
      const match = findMatch();
      if (match && !resolved) {
        resolved = true;
        observer.disconnect();
        clearInterval(interval);
        clearTimeout(timer);
        resolve(match);
      }
    }, 75);

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        observer.disconnect();
        clearInterval(interval);
        resolve(findMatch());
      }
    }, timeoutMs);
  });
}

/**
 * Smoothly scrolls to an element, accounting for persistent sticky headers (~85px offset).
 */
export function scrollToElementWithOffset(el: HTMLElement, offsetPx = 85): void {
  const rect = el.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const targetY = Math.max(0, scrollTop + rect.top - offsetPx);

  window.scrollTo({
    top: targetY,
    behavior: 'smooth',
  });

  // If the element is inside an overflow container (e.g. scrollable table body), ensure it scrolls within it
  let parent = el.parentElement;
  while (parent && parent !== document.body) {
    const overflowY = window.getComputedStyle(parent).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') {
      const parentRect = parent.getBoundingClientRect();
      const relativeTop = el.offsetTop - parent.offsetTop;
      parent.scrollTo({
        top: Math.max(0, relativeTop - 40),
        behavior: 'smooth',
      });
      break;
    }
    parent = parent.parentElement;
  }
}

/**
 * Highlights a target DOM element with an emerald pulse animation and a temporary evidence badge.
 */
export function highlightElement(
  el: HTMLElement,
  citation: CitationSource,
  durationMs = 3800
): void {
  cleanupActiveHighlights();

  el.classList.add('evidence-highlight-active');
  activeHighlightElements.push(el);

  // Create temporary evidence badge
  try {
    const badge = document.createElement('div');
    badge.className = 'evidence-source-badge';
    badge.innerHTML = `
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-700 text-white shadow-lg border border-emerald-500 animate-bounce">
        <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
        </svg>
        Evidence Source [${citation.index || 1}]
      </span>
    `;

    // Position badge relative to the element
    const rect = el.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    badge.style.position = 'absolute';
    badge.style.left = `${Math.max(16, rect.left + window.pageXOffset + 12)}px`;
    badge.style.top = `${Math.max(80, scrollTop + rect.top - 28)}px`;
    badge.style.zIndex = '9999';
    badge.style.pointerEvents = 'none';

    document.body.appendChild(badge);
    activeBadgeElements.push(badge);
  } catch (err) {
    console.warn('Failed to inject evidence badge:', err);
  }

  activeHighlightTimeout = setTimeout(() => {
    cleanupActiveHighlights();
  }, durationMs);
}

export interface NavigationResult {
  success: boolean;
  message: string;
  isExternal?: boolean;
}

/**
 * Primary navigation coordinator:
 * 1. Resolves internal route vs external URL.
 * 2. Navigates smoothly without disturbing AI Assistant drawer or conversation state.
 * 3. Waits for element to mount via MutationObserver.
 * 4. Scrolls with 85px sticky header offset and applies temporary evidence highlight.
 * 5. Provides honest fallback message if element cannot be located in the DOM.
 */
export async function navigateToSourceAndHighlight(
  citation: CitationSource,
  navigate: (to: string) => void
): Promise<NavigationResult> {
  // 1. External URL handling (Case B: External Website)
  if (citation.source_type === 'external_web' || citation.url || citation.source_url) {
    const baseTargetUrl = citation.source_url || citation.url;
    if (baseTargetUrl) {
      let finalUrl = baseTargetUrl;
      let textFragmentApplied = false;

      // When an excerpt is available and the URL has no existing fragment, construct a
      // W3C Scroll-to-Text-Fragment (#:~:text=...) deep link. Chromium/W3C browsers natively
      // scroll to and highlight this target text on third-party pages without requiring DOM injection.
      if (citation.excerpt && !baseTargetUrl.includes('#')) {
        const cleanWords = citation.excerpt
          .replace(/[^\w\s-]/g, ' ')
          .trim()
          .split(/\s+/)
          .filter(Boolean);

        if (cleanWords.length >= 3) {
          const phrase = cleanWords.slice(0, 6).join(' ');
          finalUrl = `${baseTargetUrl}#:~:text=${encodeURIComponent(phrase)}`;
          textFragmentApplied = true;
        }
      }

      window.open(finalUrl, '_blank', 'noopener,noreferrer');

      const message = textFragmentApplied
        ? `External source opened in a new tab with native browser text-fragment highlighting: "${citation.title}". Browser Same-Origin Policy strictly prohibits cross-origin JavaScript DOM injection, so standard W3C Scroll-to-Text-Fragment was applied.`
        : `External source opened in new tab: "${citation.title}". Supporting excerpt is displayed in the source card below.`;

      return {
        success: true,
        isExternal: true,
        message,
      };
    }
  }

  // 2. Resolve internal route
  const targetRoute = citation.internal_route || citation.route || '/dashboard';
  const targetPath = targetRoute.split('?')[0];
  const currentPath = window.location.pathname;

  cleanupActiveHighlights();

  // If we need to change routes, navigate via React Router
  if (currentPath !== targetPath) {
    navigate(targetRoute);
  }

  // 3. Prepare candidate DOM selectors in priority order
  const selectors: string[] = [];

  if (citation.element_id) {
    selectors.push(`#${citation.element_id}`);
  }

  if (citation.record_id) {
    selectors.push(`[data-source-id="${citation.record_id}"]`);
    selectors.push(`[data-record-id="${citation.record_id}"]`);
    selectors.push(`#product-row-${citation.record_id}`);
    selectors.push(`#inventory-row-${citation.record_id}`);
    selectors.push(`#order-row-${citation.record_id}`);
    selectors.push(`#customer-row-${citation.record_id}`);
  }

  if (citation.source_id) {
    selectors.push(`#${citation.source_id}`);
    selectors.push(`[data-source-id="${citation.source_id}"]`);
  }

  if (citation.section_id) {
    selectors.push(`#${citation.section_id}`);
  }

  // General fallback table/view selectors based on entity_type
  if (citation.entity_type === 'inventory') {
    selectors.push('#inventory-table');
  } else if (citation.entity_type === 'order') {
    selectors.push('#sales-orders-table');
  } else if (citation.entity_type === 'product') {
    selectors.push('#products-table');
  } else if (citation.entity_type === 'customer') {
    selectors.push('#customers-table');
  } else if (targetPath === '/dashboard') {
    selectors.push('#kpi-total-sales', '#chart-revenue-trend');
  }

  // 4. Asynchronously wait for element to mount in target view
  const targetElement = await waitForElement(selectors, 4500);

  if (targetElement) {
    scrollToElementWithOffset(targetElement, 85);
    highlightElement(targetElement, citation, 3800);
    return {
      success: true,
      message: `Navigated to ${citation.subpage || targetPath} and highlighted evidence [${citation.index || 1}].`,
    };
  }

  // 5. Honest fallback when element not found in DOM
  return {
    success: false,
    message: `Navigated to ${citation.subpage || targetPath}. Specific table row could not be located in DOM, but verified record data is provided in the source excerpt.`,
  };
}
