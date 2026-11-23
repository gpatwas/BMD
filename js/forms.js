/* Contact and Join forms: send in the background and show the result on the page.
   Only customer enquiries (the contact form) count as a lead in GA4; DJ sign-ups are not leads.
   Without JavaScript the forms post to Formspree as before. */
document.querySelectorAll('form[action^="https://formspree.io/"]').forEach(function (form) {
  const note = document.createElement('p');
  note.setAttribute('role', 'status');
  note.hidden = true;
  form.after(note);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Sending…';

    fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
      .then(function (response) {
        if (!response.ok) throw new Error('Form submission failed');
        const formName = form.dataset.formName || 'contact';
        if (formName !== 'join_as_dj' && typeof gtag === 'function') {
          gtag('event', 'generate_lead', { send_to: 'G-2MC0448GKR', form_name: formName });
        }
        form.hidden = true;
        note.className = 'form-note form-note--ok';
        note.textContent = form.dataset.thanks || 'Thank you! We have received your message.';
        note.hidden = false;
      })
      .catch(function () {
        note.className = 'form-note form-note--error';
        note.textContent = "Sorry, we couldn't send that. Please try again, or message us on WhatsApp at +91-94815 43530.";
        note.hidden = false;
      })
      .finally(function () {
        button.disabled = false;
        button.textContent = label;
      });
  });
});
