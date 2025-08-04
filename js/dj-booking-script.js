// Location autocomplete using OpenStreetMap
function initAutocomplete() {
    const input = document.getElementById('location');
    const suggestionBox = document.createElement('div');
    suggestionBox.className = 'suggestions-box';
    input.parentNode.appendChild(suggestionBox);

    let debounceTimer;

    input.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        suggestionBox.innerHTML = '';

        if (this.value.length < 3) return;

        debounceTimer = setTimeout(() => {
            fetchSuggestions(this.value);
        }, 300);
    });

    document.addEventListener('click', function(e) {
        if (e.target !== input && !suggestionBox.contains(e.target)) {
            suggestionBox.innerHTML = '';
        }
    });

    function fetchSuggestions(query) {
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=5`)
            .then((response) => response.json())
            .then((data) => {
                displaySuggestions(data);
            })
            .catch((error) => console.error('Error fetching locations:', error));
    }

    function displaySuggestions(data) {
        suggestionBox.innerHTML = '';
        if (data.length === 0) {
            suggestionBox.innerHTML = '<div class="px-4 py-2 text-gray-500">No results found.</div>';
            return;
        }
        data.forEach((place) => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = place.display_name;
            div.addEventListener('click', () => {
                input.value = place.display_name;
                suggestionBox.innerHTML = '';
            });
            suggestionBox.appendChild(div);
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    initAutocomplete();
});

// Form navigation functions
let currentStep = 1;
const totalSteps = 10;

function nextStep(step) {
    if (validateStep(step)) {
        const eventType = document.querySelector('input[name="event_type"]:checked').value;

        // Special handling for wedding flow in step 3
        if (step === 3 && eventType === 'wedding') {
            const weddingEvents = document.getElementById('wedding-events');
            const ageContent = document.getElementById('age-content');

            if (weddingEvents.style.display === 'block') {
                // If showing wedding events, switch to age selection
                weddingEvents.style.display = 'none';
                ageContent.style.display = 'block';
                document.getElementById('adult-ages').style.display = 'block';
                return;
            }
        }

        // Normal flow continues here
        document.getElementById('step' + step).style.display = 'none';

        if (step === totalSteps) {
            document.getElementById('final-step').style.display = 'block';
        } else {
            document.getElementById('step' + (step + 1)).style.display = 'block';
        }

        updateProgress(step + 1);
    }
}

function prevStep(step) {
    const eventType = document.querySelector('input[name="event_type"]:checked').value;

    // Special handling for wedding flow in step 3
    if (step === 3 && eventType === 'wedding') {
        const weddingEvents = document.getElementById('wedding-events');
        const ageContent = document.getElementById('age-content');

        if (ageContent.style.display === 'block') {
            // If showing age selection, go back to wedding events
            ageContent.style.display = 'none';
            weddingEvents.style.display = 'block';
            return;
        }
    }

    // Normal flow
    document.getElementById('step' + step).style.display = 'none';
    document.getElementById('step' + (step - 1)).style.display = 'block';
    updateProgress(step - 1);
}

function updateProgress(step) {
    const progress = ((step - 1) / totalSteps) * 100;
    document.querySelector('.progress').style.width = progress + '%';

    // Update step indicator text
    const stepText = step > totalSteps ? totalSteps : step;
    document.querySelector('.step-indicator').textContent =
        `Step ${stepText} of ${totalSteps}`;
}

function validateStep(step) {
    switch (step) {
        case 2: // Event type
            const eventType = document.querySelector('input[name="event_type"]:checked');
            if (!eventType) {
                showAlert('Please select an event type');
                return false;
            }
            if (eventType.value === 'other') {
                const otherValue = document.getElementById('event_type_other').value.trim();
                if (!otherValue) {
                    showAlert('Please specify the other event type');
                    return false;
                }
            }
            return true;

        case 3: // Guest ages or Wedding events
            const selectedEventType = document.querySelector('input[name="event_type"]:checked').value;

            if (selectedEventType === 'wedding') {
                const weddingEvents = document.querySelectorAll('input[name="wedding_events[]"]:checked');
                if (weddingEvents.length === 0) {
                    showAlert('Please select at least one wedding event');
                    return false;
                }
            } else {
                const selectedAges = document.querySelectorAll('input[name="guest_ages[]"]:checked');
                if (selectedAges.length === 0) {
                    showAlert('Please select at least one age range');
                    return false;
                }
            }
            return true;

        case 4: // Guest count
            const guestCount = document.querySelector('input[name="guest_count"]:checked');
            if (!guestCount) {
                showAlert('Please select an estimated guest count');
                return false;
            }
            if (guestCount.value === 'other') {
                const otherGuestValue = document.getElementById('guest_count_other').value.trim();
                if (!otherGuestValue) {
                    showAlert('Please specify the other guest count');
                    return false;
                }
            }
            return true;

        case 5: // DJ Service Types
            const serviceTypes = document.querySelectorAll('input[name="service_types[]"]:checked');
            if (serviceTypes.length === 0) {
                showAlert('Please select at least one service type');
                return false;
            }
            // Check "Other" if selected
            const otherServiceCheckbox = document.querySelector('input[onclick="toggleOther(\'service_other\')"]');
            if (otherServiceCheckbox && otherServiceCheckbox.checked) {
                const otherServiceValue = document.getElementById('service_other').value.trim();
                if (!otherServiceValue) {
                    showAlert('Please specify the other service type');
                    return false;
                }
            }
            return true;

        case 6: // Music Types
            const musicTypes = document.querySelectorAll('input[name="music_types[]"]:checked');
            if (musicTypes.length === 0) {
                showAlert('Please select at least one music type');
                return false;
            }
            // Check "Other" if selected
            const otherMusicCheckbox = document.querySelector('input[onclick="toggleOther(\'music_other\')"]');
            if (otherMusicCheckbox && otherMusicCheckbox.checked) {
                const otherMusicValue = document.getElementById('music_other').value.trim();
                if (!otherMusicValue) {
                    showAlert('Please specify the other music type');
                    return false;
                }
            }
            return true;

        case 7: // Languages
            const languages = document.querySelectorAll('input[name="languages[]"]:checked');
            if (languages.length === 0) {
                showAlert('Please select at least one language');
                return false;
            }
            // Validate "Other" if selected
            const otherLangCheckbox = document.querySelector('input[value="other"][name="languages[]"]');
            if (otherLangCheckbox && otherLangCheckbox.checked) {
                const otherLangValue = document.getElementById('language_other').value.trim();
                if (!otherLangValue) {
                    showAlert('Please specify the other language');
                    return false;
                }
            }
            return true;

        case 8: // Venue type
            const venueType = document.querySelector('input[name="venue_type"]:checked');
            if (!venueType) {
                showAlert('Please select a venue type');
                return false;
            }
            if (venueType.value === 'other') {
                const otherVenueValue = document.getElementById('venue_other').value.trim();
                if (!otherVenueValue) {
                    showAlert('Please specify the other venue type');
                    return false;
                }
            }
            return true;

        case 9: // Date selection
            const dateSet = document.querySelector('input[name="date_set"]:checked');
            if (!dateSet) {
                showAlert('Please indicate if you have set a date');
                return false;
            }
            if (dateSet.value === 'yes') {
                const specificDate = document.getElementById('date-picker').value;
                if (!specificDate) {
                    showAlert('Please select a specific date');
                    return false;
                }
            } else if (dateSet.value === 'no') {
                const approximateDate = document.querySelector('input[name="approximate_date"]:checked');
                if (!approximateDate) {
                    showAlert('Please select an approximate timeframe');
                    return false;
                }
                if (approximateDate.value === 'other') {
                    const otherDateValue = document.getElementById('date_other').value.trim();
                    if (!otherDateValue) {
                        showAlert('Please specify the other timeframe');
                        return false;
                    }
                }
            }
            return true;

        case 10: // Contact details
            const email = document.getElementById('user_email').value.trim();
            const phone = document.getElementById('user_phone').value.trim();

            if (!email) {
                showAlert('Please enter your email address');
                return false;
            }
            if (!isValidEmail(email)) {
                showAlert('Please enter a valid email address');
                return false;
            }
            if (!phone) {
                showAlert('Please enter your phone number');
                return false;
            }
            if (!isValidPhone(phone)) {
                showAlert('Please enter a valid 10-digit phone number');
                return false;
            }
            return true;

        default:
            return true;
    }
}

// Helper functions
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
    return /^\d{10}$/.test(phone);
}

function handleOtherRadio(radioInput, otherId) {
    const otherInput = document.getElementById(otherId);
    if (otherInput) {
        otherInput.disabled = !radioInput.checked;
        if (radioInput.checked) {
            otherInput.focus();
        } else {
            otherInput.value = '';
        }
    }
}

function toggleOther(inputId) {
    const input = document.getElementById(inputId);
    const checkbox = event.target;

    if (input) {
        input.disabled = !checkbox.checked;
        if (checkbox.checked) {
            input.focus();
        } else {
            input.value = '';
            // Reset checkbox value to default 'other'
            if (checkbox.name.endsWith('[]')) {
                checkbox.value = 'other';
            }
        }
    }
}

// Helper function for email validation
function validateEmail(email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
}

// Validation helper functions
function validateRadioGroup(name) {
    const radios = document.getElementsByName(name);
    let isChecked = false;
    radios.forEach(radio => {
        if (radio.checked) isChecked = true;
    });
    if (!isChecked) {
        alert('Please select an option to continue');
        return false;
    }
    return true;
}

function validateCheckboxGroup(name) {
    const checkboxes = document.getElementsByName(name);
    let isChecked = false;
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) isChecked = true;
    });
    if (!isChecked) {
        alert('Please select at least one option to continue');
        return false;
    }
    return true;
}

// Date selection handling
function toggleDateSelection(value) {
    const specificDateSection = document.getElementById('specific-date');
    const approximateDateSection = document.getElementById('approximate-date');

    if (value === 'yes') {
        specificDateSection.style.display = 'block';
        approximateDateSection.style.display = 'none';
        // Clear approximate date selections
        document.getElementsByName('approximate_date').forEach(radio => radio.checked = false);
    } else {
        specificDateSection.style.display = 'none';
        approximateDateSection.style.display = 'block';
        // Clear specific date
        document.getElementById('date-picker').value = '';
    }
}

function validateDateSection() {
    const dateSet = document.querySelector('input[name="date_set"]:checked');
    if (!dateSet) {
        alert('Please select whether you have a specific date');
        return false;
    }

    if (dateSet.value === 'yes') {
        if (!document.getElementById('date-picker').value) {
            alert('Please select a specific date');
            return false;
        }
    } else {
        if (!document.querySelector('input[name="approximate_date"]:checked')) {
            alert('Please select an approximate timeframe');
            return false;
        }
    }
    return true;
}

// Set minimum date for date picker to today
document.addEventListener('DOMContentLoaded', function() {
    const datePicker = document.getElementById('date-picker');
    if (datePicker) {
        const today = new Date().toISOString().split('T')[0];
        datePicker.min = today;
    }

    // Initialize Google Places Autocomplete
    // initAutocomplete();
});

// Form submission handling
document.getElementById('modalForm').addEventListener('submit', function(e) {
    e.preventDefault();

    // Get the submit button
    const submitButton = document.querySelector('button[type="submit"]');

    // Prevent double submission
    if (submitButton.classList.contains('loading')) {
        return;
    }

    // Add loading state
    submitButton.classList.add('loading');
    submitButton.disabled = true;

    const formData = new FormData();

    // Add access key
    formData.append('access_key', '7f153e08-ec11-4652-8f95-1414dc80cbe3');

    // Create an object to store checkbox group values
    let checkboxGroups = {};

    // Handle checkbox groups (like guest_ages[])
    document.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
        if (checkbox.name.includes('[]')) {
            const groupName = checkbox.name.replace('[]', '');
            if (!checkboxGroups[groupName]) {
                checkboxGroups[groupName] = [];
            }
            checkboxGroups[groupName].push(checkbox.value);
        }
    });

    // Add checkbox groups as comma-separated strings
    for (let groupName in checkboxGroups) {
        formData.append(groupName, checkboxGroups[groupName].join(', '));
    }

    // Add all other form fields
    const formElements = this.elements;
    for (let element of formElements) {
        if (element.name && !element.name.includes('[]')) {
            if (element.type === 'radio' && element.checked) {
                formData.append(element.name, element.value);
            } else if (element.type !== 'radio' && element.type !== 'checkbox' && element.value) {
                formData.append(element.name, element.value);
            }
        }
    }

    // Add "Other" values if they're enabled and have values
    document.querySelectorAll('.other-input:not([disabled])').forEach(input => {
        if (input.value.trim()) {
            formData.append(input.id, input.value.trim());
        }
    });

    // Add checked radio "Other" values
    document.querySelectorAll('input[type="radio"]:checked').forEach(radio => {
        if (radio.value === 'other') {
            const otherId = radio.closest('label').querySelector('input[type="text"]').id;
            const otherValue = document.getElementById(otherId).value.trim();
            if (otherValue) {
                formData.append(otherId, otherValue);
            }
        }
    });

    // Log form data before sending
    console.log('Sending form data:');
    for (let pair of formData.entries()) {
        console.log(pair[0] + ': ' + pair[1]);
    }

    fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(Object.fromEntries(formData))
        })
        .then(async (response) => {
            const responseData = await response.json();

            if (response.ok) {
                // Redirect on success
                window.location.href = "https://bookmydjs.in/matches/";
            } else {
                throw new Error(responseData.message || 'Form submission failed');
            }
        })
        .catch((error) => {
            console.error("Form submission error:", {
                message: error.message,
                stack: error.stack
            });
            alert("Error submitting form: " + error.message);

            // Reset button state on error
            submitButton.classList.remove('loading');
            submitButton.disabled = false;
        });
});

// Add these new functions
function showModal() {
    const location = document.getElementById('location').value.trim();

    // Check if location is empty
    if (!location) {
        // Use custom alert modal
        const alertModal = document.getElementById('alertModal');
        const alertMessage = document.getElementById('alertMessage');

        // Set the alert message
        alertMessage.textContent = 'Please enter a location';

        // Show the alert modal
        alertModal.classList.remove('hidden');

        // Add click handler for OK button
        const okButton = document.getElementById('alertOkButton');
        okButton.onclick = function() {
            alertModal.classList.add('hidden');
        }

        return; // Stop execution if location is empty
    }

    const modal = document.getElementById('formModal');
    if (modal) {
        modal.style.display = 'block';
        document.getElementById('modalLocation').value = location;

        // Show step2 and hide others
        document.querySelectorAll('.form-step').forEach(step => step.style.display = 'none');
        document.getElementById('step2').style.display = 'block';

        // Update progress
        updateProgress(2);
    }
}

function showModalStep(step) {
    const steps = document.querySelectorAll('.form-step');
    steps.forEach((s) => {
        s.classList.remove('current-step');
        s.style.display = 'none';
    });

    const currentStep = document.getElementById('step' + step);
    if (currentStep) {
        currentStep.classList.add('current-step');
        currentStep.style.display = 'block';
    }

    // Update progress bar
    updateProgress(step);
}


function updateProgress(step) {
    const totalSteps = 11; // Total steps, including Step 10 and the final review
    const progress = ((step - 1) / (totalSteps - 1)) * 100; // Calculate percentage progress
    const progressElement = document.querySelector('.progress');
    const stepIndicatorElement = document.querySelector('.step-indicator');

    // Update the width of the progress bar
    progressElement.style.width = progress + '%';

    // Update the step indicator text
    stepIndicatorElement.textContent = `Step ${step - 1} of ${totalSteps - 1}`;
}



// Add modal close functionality
document.querySelector('.close').addEventListener('click', function(e) {
    e.preventDefault();
    showConfirmModal();
});

// Close modal if clicking outside
window.addEventListener('click', function(event) {
    const formModal = document.getElementById('formModal');
    const alertModal = document.getElementById('alertModal');
    const confirmModal = document.getElementById('confirmModal');

    // Only close if clicking directly on the modal background, not its children
    if (event.target === formModal) {
        showConfirmModal(); // Show confirmation instead of closing directly
    }

    // Prevent closing alert and confirm modals when clicking outside
    if (event.target === alertModal || event.target === confirmModal) {
        return; // Do nothing when clicking outside these modals
    }
});

// Optional: Add this if you want to prevent closing by pressing the Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        event.preventDefault();
        const formModal = document.getElementById('formModal');
        if (formModal.style.display === 'block') {
            showConfirmModal();
        }
    }
});

function resetForm() {
    // Hide all steps except the first one
    const steps = document.querySelectorAll('.form-step');
    steps.forEach(step => {
        step.style.display = 'none';
    });

    // Show the first step
    document.getElementById('step1').style.display = 'block';

    // Reset the form
    document.getElementById('modalForm').reset();

    // Reset progress
    updateProgress(1);

    // Clear any "Other" input fields
    const otherInputs = document.querySelectorAll('input[type="text"][id$="_other"]');
    otherInputs.forEach(input => {
        input.disabled = true;
        input.value = '';
    });

    // Reset age ranges display
    document.getElementById('adult-ages').style.display = 'block';
    document.getElementById('child-ages').style.display = 'none';
}

// Add this to your existing script.js
function handleEventTypeChange() {
    const eventType = document.querySelector('input[name="event_type"]:checked').value;
    const ageSection = document.getElementById('age-content');
    const adultAges = document.getElementById('adult-ages');
    const childAges = document.getElementById('child-ages');
    const weddingEvents = document.getElementById('wedding-events');

    // Reset checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });

    // Reset other inputs
    document.querySelectorAll('.other-input').forEach(input => {
        input.value = '';
        input.disabled = true;
    });

    // Show/hide appropriate sections
    if (eventType === 'wedding') {
        ageSection.style.display = 'none';
        weddingEvents.style.display = 'block';
    } else {
        ageSection.style.display = 'block';
        weddingEvents.style.display = 'none';

        if (eventType === 'birthday_child') {
            adultAges.style.display = 'none';
            childAges.style.display = 'block';
        } else {
            adultAges.style.display = 'block';
            childAges.style.display = 'none';
        }
    }
}

// Add event listeners to event type radio buttons
document.querySelectorAll('input[name="event_type"]').forEach(radio => {
    radio.addEventListener('change', handleEventTypeChange);
});

// Add this function to handle radio button "Other" options
function handleOtherRadio(radioInput, otherId) {
    const otherInput = document.getElementById(otherId);
    if (otherInput) {
        otherInput.disabled = !radioInput.checked;
        if (radioInput.checked) {
            otherInput.focus();
        } else {
            otherInput.value = '';
        }
    }
}

// Add these functions to your existing script.js

function showAlert(message) {
    document.getElementById('alertMessage').textContent = message;
    document.getElementById('alertModal').classList.remove('hidden');
}

function hideAlert() {
    document.getElementById('alertModal').classList.add('hidden');
}

function showConfirmModal() {
    document.getElementById('confirmModal').classList.remove('hidden');
}

function hideConfirmModal() {
    document.getElementById('confirmModal').classList.add('hidden');
}

// Add event listeners for the confirmation modal
document.getElementById('quitButton').addEventListener('click', function() {
    hideConfirmModal();
    document.getElementById('formModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    resetForm();
});

document.getElementById('continueButton').addEventListener('click', function() {
    hideConfirmModal();
});

document.getElementById('alertOkButton').addEventListener('click', function() {
    hideAlert();
});

function handleQuit() {
    // Hide modal
    const modal = document.getElementById('formModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';

    // Reset form
    const form = document.getElementById('modalForm');
    form.reset();

    // Reset all steps visibility
    document.querySelectorAll('.form-step').forEach(step => {
        step.style.display = 'none';
    });
    document.getElementById('step2').style.display = 'none';

    // Reset all other inputs
    document.querySelectorAll('.other-input').forEach(input => {
        input.value = '';
        input.disabled = true;
    });

    // Reset location input
    document.getElementById('location').value = '';
    document.getElementById('modalLocation').value = '';

    // Reset wedding events and age sections
    document.getElementById('wedding-events').style.display = 'none';
    document.getElementById('age-content').style.display = 'block';
    document.getElementById('adult-ages').style.display = 'block';
    document.getElementById('child-ages').style.display = 'none';

    // Reset progress
    updateProgress(1);
}

function updateOtherValue(input, checkboxName) {
    // Find the corresponding "other" checkbox
    const otherCheckbox = input.parentElement.querySelector(`input[name="${checkboxName}"][value="other"]`);

    if (otherCheckbox && otherCheckbox.checked) {
        // If there's a value in the text input, update the checkbox value
        if (input.value.trim()) {
            otherCheckbox.value = 'other:' + input.value.trim();
        } else {
            otherCheckbox.value = 'other'; // Reset to default if empty
        }
    }
}


function scrollToHero() {
    const heroSection = document.getElementById('hero-section');
    heroSection.scrollIntoView({
        behavior: 'smooth'
    });
}

function handleClose() {
showConfirmModal();   
}

