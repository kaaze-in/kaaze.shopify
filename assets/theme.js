/**
 * KAAZE EDTN — Shopify Liquid Theme Client JavaScript
 * Handles cart drawer, predictive search, product variants, gallery, and interactive UI.
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initSearchModal();
  initCartDrawer();
  initProductStage();
  initAccordions();
  initSizeGuide();
});

/* -------------------------------------------------------------------------
 * 1. Mobile Menu Toggle
 * ------------------------------------------------------------------------- */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobileMenuToggle');
  const drawer = document.getElementById('mobileMenuDrawer');
  const icon = document.getElementById('mobileMenuIcon');

  if (!toggleBtn || !drawer) return;

  toggleBtn.addEventListener('click', () => {
    const isExpanded = drawer.classList.contains('hidden');
    drawer.classList.toggle('hidden');
    drawer.classList.toggle('flex');
    toggleBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    if (icon) {
      icon.textContent = isExpanded ? 'close' : 'menu';
    }
  });
}

/* -------------------------------------------------------------------------
 * 2. Predictive Search Modal
 * ------------------------------------------------------------------------- */
function initSearchModal() {
  const modal = document.getElementById('searchModal');
  const openBtn = document.getElementById('openSearchModal');
  const closeBtn = document.getElementById('closeSearchModal');
  const backdrop = document.getElementById('searchBackdrop');
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClearBtn');
  const defaultSuggestions = document.getElementById('searchDefaultSuggestions');
  const liveResults = document.getElementById('searchLiveResults');
  const emptyState = document.getElementById('searchEmptyState');

  if (!modal || !openBtn) return;

  const openModal = () => {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => input && input.focus(), 50);
  };

  const closeModal = () => {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  };

  openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });

  if (clearBtn && input) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      input.dispatchEvent(new Event('input'));
      input.focus();
    });
  }

  let debounceTimer;
  if (input) {
    input.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value.trim();

      if (clearBtn) {
        clearBtn.classList.toggle('hidden', query.length === 0);
      }

      if (query.length === 0) {
        if (defaultSuggestions) defaultSuggestions.classList.remove('hidden');
        if (liveResults) {
          liveResults.classList.add('hidden');
          liveResults.innerHTML = '';
        }
        if (emptyState) emptyState.classList.add('hidden');
        return;
      }

      debounceTimer = setTimeout(() => {
        fetch(`${window.KAAZE.routes.predictive_search_url}?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=8&section_id=predictive-search`)
          .then((res) => res.json())
          .catch(() => {
            // Fallback to json suggest
            return fetch(`/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product`).then((r) => r.json());
          })
          .then((data) => {
            const products = data?.resources?.results?.products || [];
            if (defaultSuggestions) defaultSuggestions.classList.add('hidden');

            if (products.length === 0) {
              if (liveResults) {
                liveResults.classList.add('hidden');
                liveResults.innerHTML = '';
              }
              if (emptyState) emptyState.classList.remove('hidden');
            } else {
              if (emptyState) emptyState.classList.add('hidden');
              if (liveResults) {
                liveResults.classList.remove('hidden');
                liveResults.innerHTML = `
                  <span class="font-label-sm text-label-sm uppercase tracking-widest text-outline pb-space-xs font-mono">
                    [ LOCATED (${products.length}) MATCHING PIECES ]
                  </span>
                  ${products
                    .map(
                      (p) => `
                    <a href="${p.url}" class="flex items-center gap-space-md py-space-sm group hover:bg-surface-container-low transition-colors px-space-xs">
                      <div class="w-12 h-16 bg-surface-container flex-shrink-0 overflow-hidden">
                        <img src="${p.image || p.featured_image}" alt="${p.title}" class="w-full h-full object-cover grayscale contrast-125 group-hover:scale-105 transition-transform">
                      </div>
                      <div class="flex flex-col flex-1 min-w-0">
                        <span class="font-label-md text-label-md uppercase text-on-surface font-medium truncate group-hover:text-primary transition-colors">
                          ${p.title}
                        </span>
                        <span class="font-label-sm text-label-sm text-outline font-mono">
                          REF: ${p.sku || 'KZ-SPEC'} // ${p.type || 'GARMENT'}
                        </span>
                      </div>
                      <span class="font-label-md text-label-md text-primary font-mono font-bold flex-shrink-0">
                        ${p.price ? (typeof p.price === 'number' ? '₹' + (p.price / 100).toLocaleString() : p.price) : ''}
                      </span>
                    </a>
                  `
                    )
                    .join('')}
                `;
              }
            }
          })
          .catch(() => {
            if (emptyState) emptyState.classList.remove('hidden');
          });
      }, 250);
    });
  }
}

/* -------------------------------------------------------------------------
 * 3. Cart Drawer & AJAX Add to Cart
 * ------------------------------------------------------------------------- */
function initCartDrawer() {
  const drawer = document.getElementById('cartDrawer');
  const trigger = document.getElementById('cartDrawerTrigger');
  const closeBtn = document.getElementById('closeCartDrawerBtn');
  const backdrop = document.getElementById('cartDrawerBackdrop');

  const openDrawer = (e) => {
    if (e && window.innerWidth >= 768) {
      e.preventDefault();
      drawer.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      fetchCartData();
    }
  };

  const closeDrawer = () => {
    drawer.classList.add('hidden');
    document.body.style.overflow = '';
  };

  if (trigger && drawer) trigger.addEventListener('click', openDrawer);
  if (closeBtn && drawer) closeBtn.addEventListener('click', closeDrawer);
  if (backdrop && drawer) backdrop.addEventListener('click', closeDrawer);

  // Quick Add Event Delegation
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.quick-add-btn');
    if (!btn) return;

    e.preventDefault();
    const variantId = btn.getAttribute('data-variant-id');
    if (!variantId) return;

    btn.disabled = true;
    const origText = btn.textContent;
    btn.textContent = 'ALLOCATING...';

    fetch(window.KAAZE.routes.cart_add_url + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: 1 }),
    })
      .then((res) => res.json())
      .then(() => {
        btn.textContent = '✓ ALLOCATED';
        setTimeout(() => {
          btn.textContent = origText;
          btn.disabled = false;
        }, 1800);

        // Update badge and open drawer
        updateCartBadge();
        if (drawer && window.innerWidth >= 768) {
          drawer.classList.remove('hidden');
          fetchCartData();
        }
      })
      .catch(() => {
        btn.textContent = 'ERROR';
        setTimeout(() => {
          btn.textContent = origText;
          btn.disabled = false;
        }, 1500);
      });
  });
}

function updateCartBadge() {
  fetch('/cart.js')
    .then((r) => r.json())
    .then((cart) => {
      const badge = document.getElementById('cartCountBadge');
      const drawerCount = document.getElementById('cartDrawerCount');
      if (badge) badge.textContent = `[${cart.item_count}]`;
      if (drawerCount) drawerCount.textContent = `(${cart.item_count})`;
    });
}

function fetchCartData() {
  fetch('/cart.js')
    .then((r) => r.json())
    .then((cart) => {
      const subtotalEl = document.getElementById('cartDrawerSubtotal');
      const itemsContainer = document.getElementById('cartDrawerItems');
      const countEl = document.getElementById('cartDrawerCount');

      if (countEl) countEl.textContent = `(${cart.item_count})`;
      if (subtotalEl) {
        subtotalEl.textContent = '₹' + (cart.total_price / 100).toLocaleString();
      }

      if (itemsContainer && cart.items.length > 0) {
        itemsContainer.innerHTML = cart.items
          .map(
            (item) => `
          <div class="py-space-sm flex gap-space-sm">
            <div class="w-16 h-20 bg-surface-container flex-shrink-0 overflow-hidden">
              <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover grayscale contrast-125">
            </div>
            <div class="flex flex-col justify-between flex-1 min-w-0">
              <div>
                <h4 class="font-title-lg text-xs font-bold text-primary uppercase font-sans line-clamp-1">
                  ${item.product_title}
                </h4>
                ${item.variant_title ? `<span class="text-[10px] text-outline uppercase block mt-0.5">${item.variant_title}</span>` : ''}
                <span class="text-xs text-primary font-bold block mt-1">₹${(item.final_line_price / 100).toLocaleString()}</span>
              </div>
              <div class="flex items-center justify-between text-xs pt-1">
                <span class="text-outline">QTY: ${item.quantity}</span>
                <a href="/cart/change?id=${item.key}&quantity=0" class="text-outline hover:text-red-500 text-[10px] uppercase">[REMOVE]</a>
              </div>
            </div>
          </div>
        `
          )
          .join('');
      } else if (itemsContainer) {
        itemsContainer.innerHTML = `<div class="py-space-xl text-center text-outline text-xs uppercase">BAG IS CURRENTLY EMPTY</div>`;
      }
    });
}

/* -------------------------------------------------------------------------
 * 4. Product Details Stage (Gallery & Variant Swatches)
 * ------------------------------------------------------------------------- */
function initProductStage() {
  const mainImage = document.getElementById('mainProductImage');
  const viewLabel = document.getElementById('activeViewLabel');
  const thumbs = document.querySelectorAll('.gallery-thumb');

  thumbs.forEach((thumb) => {
    thumb.addEventListener('click', () => {
      thumbs.forEach((t) => {
        t.classList.remove('border-2', 'border-primary');
        t.classList.add('border', 'border-surface-container');
      });
      thumb.classList.remove('border', 'border-surface-container');
      thumb.classList.add('border-2', 'border-primary');

      const newSrc = thumb.getAttribute('data-image-src');
      const label = thumb.getAttribute('data-view-label');
      if (mainImage && newSrc) mainImage.src = newSrc;
      if (viewLabel && label) viewLabel.textContent = label;
    });
  });

  // Variant Option Selection
  const variantJsonScript = document.querySelector('script[id^="ProductJson-"]');
  if (!variantJsonScript) return;

  let variants = [];
  try {
    variants = JSON.parse(variantJsonScript.textContent);
  } catch (err) {
    variants = [];
  }

  const selectedOptions = {};
  const optionButtons = document.querySelectorAll('.variant-option-btn');
  const hiddenVariantInput = document.getElementById('selectedVariantId');
  const priceDisplay = document.getElementById('productPriceDisplay');
  const colorNameLabel = document.getElementById('activeColorName');
  const addToCartBtn = document.getElementById('addToCartBtn');
  const addToCartText = document.getElementById('addToCartText');

  optionButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const optionIndex = btn.getAttribute('data-option-index');
      const optionValue = btn.getAttribute('data-option-value');
      selectedOptions[optionIndex] = optionValue;

      // Update active state among siblings
      btn.parentElement.querySelectorAll('.variant-option-btn').forEach((sibling) => {
        if (sibling.classList.contains('color-option-swatch')) {
          sibling.classList.remove('border-2', 'border-primary', 'bg-[#0d0d0e]');
          sibling.classList.add('border', 'border-surface-container', 'bg-[#131313]');
        } else {
          sibling.classList.remove('border-primary', 'bg-primary', 'text-on-primary', 'font-bold');
          sibling.classList.add('border-surface-container', 'bg-surface', 'text-on-surface');
        }
      });

      if (btn.classList.contains('color-option-swatch')) {
        btn.classList.add('border-2', 'border-primary', 'bg-[#0d0d0e]');
        btn.classList.remove('border-surface-container', 'bg-[#131313]');
        if (colorNameLabel) colorNameLabel.textContent = optionValue;
      } else {
        btn.classList.add('border-primary', 'bg-primary', 'text-on-primary', 'font-bold');
        btn.classList.remove('border-surface-container', 'bg-surface', 'text-on-surface');
      }

      // Match Variant
      const matchingVariant = variants.find((v) => {
        return v.options.every((optVal, idx) => {
          return selectedOptions[idx] ? selectedOptions[idx] === optVal : true;
        });
      });

      if (matchingVariant) {
        if (hiddenVariantInput) hiddenVariantInput.value = matchingVariant.id;
        if (priceDisplay) priceDisplay.textContent = '₹' + (matchingVariant.price / 100).toLocaleString();

        if (matchingVariant.available) {
          if (addToCartBtn) {
            addToCartBtn.disabled = false;
            addToCartBtn.classList.remove('cursor-not-allowed', 'opacity-60', 'bg-surface-container', 'text-outline');
            addToCartBtn.classList.add('bg-primary', 'text-on-primary', 'border-primary', 'cursor-pointer');
          }
          if (addToCartText) addToCartText.textContent = 'ADD TO CART';
        } else {
          if (addToCartBtn) {
            addToCartBtn.disabled = true;
            addToCartBtn.classList.add('cursor-not-allowed', 'opacity-60', 'bg-surface-container', 'text-outline');
            addToCartBtn.classList.remove('bg-primary', 'text-on-primary', 'border-primary', 'cursor-pointer');
          }
          if (addToCartText) addToCartText.textContent = 'SOLD OUT';
        }
      }
    });
  });

  // Quantity Stepper
  const minusBtn = document.getElementById('quantityMinusBtn');
  const plusBtn = document.getElementById('quantityPlusBtn');
  const qtyInput = document.getElementById('productQuantityInput');

  if (minusBtn && qtyInput) {
    minusBtn.addEventListener('click', () => {
      const cur = parseInt(qtyInput.value) || 1;
      qtyInput.value = Math.max(1, cur - 1);
    });
  }
  if (plusBtn && qtyInput) {
    plusBtn.addEventListener('click', () => {
      const cur = parseInt(qtyInput.value) || 1;
      qtyInput.value = cur + 1;
    });
  }

  // Direct Checkout Button
  const directBtn = document.getElementById('directCheckoutBtn');
  const form = document.getElementById('productForm');
  if (directBtn && form) {
    directBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'return_to';
      input.value = '/checkout';
      form.appendChild(input);
      form.submit();
    });
  }
}

/* -------------------------------------------------------------------------
 * 5. Accordions
 * ------------------------------------------------------------------------- */
function initAccordions() {
  document.querySelectorAll('.accordion-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const content = document.getElementById(targetId);
      const icon = btn.querySelector('.material-symbols-outlined');

      if (content) {
        const isHidden = content.classList.contains('hidden');
        content.classList.toggle('hidden');
        if (icon) {
          icon.classList.toggle('rotate-180', isHidden);
        }
      }
    });
  });
}

/* -------------------------------------------------------------------------
 * 6. Size Guide Modal
 * ------------------------------------------------------------------------- */
function initSizeGuide() {
  const modal = document.getElementById('sizeGuideModal');
  const openBtn = document.getElementById('openSizeGuideTrigger');
  const closeBtn = document.getElementById('closeSizeGuideBtn');
  const confirmBtn = document.getElementById('confirmSizeGuideBtn');

  if (!modal || !openBtn) return;

  const openModal = () => modal.classList.remove('hidden');
  const closeModal = () => modal.classList.add('hidden');

  openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (confirmBtn) confirmBtn.addEventListener('click', closeModal);
}
