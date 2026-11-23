/* Floating WhatsApp button: slides in after 1 second, and hides while the booking form (#formModal) is open. */
(function () {
  const whatsappCTA = document.getElementById("whatsappCTA");
  if (!whatsappCTA) return;
  const formModal = document.getElementById("formModal");

  const updateWhatsAppVisibility = () => {
    const formOpen = !!formModal &&
      (!formModal.classList.contains("hidden") || getComputedStyle(formModal).display !== "none");

    if (formOpen) {
      /* Inline display:none guarantees the CTA cannot overlap the form. */
      whatsappCTA.classList.remove("show");
      whatsappCTA.classList.add("form-modal-open");
      whatsappCTA.style.setProperty("display", "none", "important");
    } else {
      whatsappCTA.classList.remove("form-modal-open");
      whatsappCTA.style.removeProperty("display");
      whatsappCTA.classList.add("show");
    }
  };

  if (formModal) {
    new MutationObserver(updateWhatsAppVisibility).observe(formModal, {
      attributes: true,
      attributeFilter: ["class", "style", "aria-hidden"]
    });
  }

  setTimeout(updateWhatsAppVisibility, 1000);
})();

/* Phone taps: count clicks on any tel: link as a GA4 "phone_click" event (no phone number is sent). */
(function () {
  const pathSlug = location.pathname.split('/').filter(Boolean).pop();
  const page = pathSlug ? pathSlug.toLowerCase() : 'home';
  document.addEventListener('click', function (e) {
    const link = e.target.closest ? e.target.closest('a[href^="tel:"]') : null;
    if (!link || typeof gtag !== 'function') return;
    gtag('event', 'phone_click', {
      send_to: 'G-2MC0448GKR',
      event_category: 'engagement',
      event_label: page,
      link_location: link.closest('footer') ? 'footer' : 'page',
      phone_line: link.getAttribute('href').indexOf('9481543530') > -1 ? 'bookmydjs' : 'dj_ravz',
      transport_type: 'beacon'
    });
  });
})();
