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
