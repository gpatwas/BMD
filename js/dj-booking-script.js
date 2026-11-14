// Location autocomplete: instant matches from a built-in list of Bangalore areas,
// then places from OpenStreetMap via Photon (photon.komoot.io), limited to the Bangalore region.
// Any 6-digit Indian pincode is looked up in India Post's directory (api.postalpincode.in).

// Areas with their own page on the site come first; [name, other spellings]
const BANGALORE_AREAS = [
    ['Koramangala'], ['Indiranagar', 'indira nagar'], ['Whitefield'], ['HSR Layout'], ['Marathahalli'],
    ['Electronic City'], ['JP Nagar', 'jayaprakash nagar'], ['Jayanagar'], ['BTM Layout'], ['Sarjapur Road'],
    ['Bellandur'], ['MG Road', 'mahatma gandhi road'], ['Hebbal'], ['Yelahanka'], ['Banashankari'],
    ['Rajajinagar'], ['Malleshwaram', 'malleswaram'], ['Bannerghatta Road'], ['Ulsoor', 'halasuru'], ['Domlur'],
    ['Adugodi'], ['AECS Layout'], ['Anekal'], ['Arekere'], ['Attibele'], ['Bagalur'], ['Baiyappanahalli'],
    ['Banaswadi'], ['Basavanagudi'], ['Basaveshwaranagar'], ['Begur'], ['Benson Town'], ['Bidadi'],
    ['Bilekahalli'], ['Bommanahalli'], ['Bommasandra'], ['Brigade Road'], ['Brookefield'], ['Carmelaram'],
    ['Chamrajpet'], ['Chandapura'], ['Church Street'], ['Commercial Street'], ['Cooke Town'], ['Cox Town'],
    ['Cunningham Road'], ['CV Raman Nagar'], ['Devanahalli'], ['Dollars Colony'], ['Dommasandra'],
    ['Doddanekundi'], ['Ejipura'], ['Frazer Town', 'fraser town'], ['Gandhi Nagar'], ['Girinagar'],
    ['Gottigere'], ['Haralur'], ['HBR Layout'], ['Hegde Nagar'], ['Hennur'], ['Hennur Road'], ['Hoodi'],
    ['Horamavu'], ['Hosa Road'], ['Hoskote'], ['Hosur Road'], ['Hulimavu'], ['ITPL'], ['Jakkur'], ['Jalahalli'],
    ['Jeevan Bima Nagar'], ['Kadubeesanahalli'], ['Kadugodi'], ['Kaggadasapura'], ['Kalyan Nagar'],
    ['Kammanahalli'], ['Kanakapura Road'], ['Kasavanahalli'], ['Kengeri'], ['Kodigehalli'], ['Kodihalli'],
    ['Kogilu'], ['Konanakunte'], ['Kothanur'], ['KR Puram', 'krishnarajapuram'], ['Kudlu Gate'],
    ['Kumaraswamy Layout'], ['Kundalahalli'], ['Langford Town'], ['Lavelle Road'], ['Lingarajapuram'],
    ['Madiwala'], ['Magadi Road'], ['Mahadevapura'], ['Mahalakshmi Layout'], ['Manyata Tech Park'],
    ['Mathikere'], ['Munnekollal'], ['Murugeshpalya'], ['Mysore Road'], ['Nagarbhavi'], ['Nagawara'],
    ['Nandini Layout'], ['Nelamangala'], ['New Thippasandra'], ['Old Airport Road'], ['Old Madras Road'],
    ['Padmanabhanagar'], ['Panathur'], ['Peenya'], ['Ramamurthy Nagar'], ['Residency Road'],
    ['Richmond Road'], ['Richmond Town'], ['RR Nagar', 'rajarajeshwari nagar'], ['RT Nagar'], ['Sadashivanagar'],
    ['Sahakar Nagar'], ['Sanjaynagar'], ['Sarjapura'], ['Seshadripuram'], ['Shanti Nagar'], ['Shivajinagar'],
    ['Silk Board'], ['Singasandra'], ['Thanisandra'], ['Tumkur Road'], ['Uttarahalli'], ['Varthur'],
    ['Vasanth Nagar'], ['Vidyaranyapura'], ['Vijayanagar'], ['Vimanapura'], ['Viveknagar'], ['Wilson Garden'],
    ['Yelahanka New Town'], ['Yeshwanthpur', 'yeshwantpur']
];

// Bangalore region for online results: west, south, east, north
const BANGALORE_BBOX = [77.30, 12.70, 77.90, 13.30];
const OSM_NOTE = 'Map data © OpenStreetMap contributors';
const PINCODE_NOTE = 'Pincode data: India Post';
const PLACE_TYPES_TO_SKIP = ['railway', 'public_transport', 'power', 'man_made', 'waterway', 'natural'];
const SKIP_VALUES = ['bus_stop', 'platform', 'stop', 'traffic_signals', 'industrial', 'construction'];

function initAutocomplete(input) {
    if (!input) return;
    const suggestionBox = document.createElement('div');
    suggestionBox.className = 'suggestions-box';
    suggestionBox.setAttribute('role', 'listbox');
    suggestionBox.id = input.id + '-suggestions';
    input.setAttribute('aria-controls', suggestionBox.id);
    input.setAttribute('aria-autocomplete', 'list');
    input.parentNode.appendChild(suggestionBox);

    const cache = new Map();
    let debounceTimer;
    let inFlight = null;
    let items = [];
    let active = -1;

    input.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        if (inFlight) inFlight.abort();
        const query = this.value.trim();

        if (query.length < 2) {
            close();
            return;
        }

        const local = localMatches(query);
        render(local, false);

        const digits = query.replace(/\s/g, '');
        if (/^[0-9]+$/.test(digits)) {
            if (/^[1-9][0-9]{5}$/.test(digits)) debounceTimer = setTimeout(() => fetchPincode(digits, local), 150);
            return;
        }
        if (query.length < 3) return;
        debounceTimer = setTimeout(() => fetchOnline(query, local), 300);
    });

    input.addEventListener('keydown', function(e) {
        if (!items.length) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            highlight();
        } else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault();
            choose(items[active]);
        } else if (e.key === 'Escape') {
            close();
        }
    });

    document.addEventListener('click', function(e) {
        if (e.target !== input && !suggestionBox.contains(e.target)) close();
    });

    function localMatches(query) {
        const q = query.toLowerCase();
        const digits = q.replace(/\s/g, '');
        if (/^[0-9]+$/.test(digits)) {
            // Bangalore pincodes start with 560, 561 or 562
            return /^56[0-2][0-9]{3}$/.test(digits) ? [{ label: `Pincode ${digits}, Bangalore`, value: `${digits}, Bangalore` }] : [];
        }
        const scored = [];
        BANGALORE_AREAS.forEach(([name, ...aliases], index) => {
            let best = Infinity;
            [name, ...aliases].forEach((text) => {
                const t = text.toLowerCase();
                const words = t.split(/\s+/);
                if (t.startsWith(q)) best = Math.min(best, 0);
                else if (words.some((w) => w.startsWith(q))) best = Math.min(best, 1);
                else if (t.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''))) best = Math.min(best, 2);
            });
            if (best < Infinity) scored.push({ best, index, name });
        });
        return scored
            .sort((a, b) => a.best - b.best || a.index - b.index)
            .slice(0, 5)
            .map(({ name }) => ({ label: `${name}, Bangalore`, value: `${name}, Bangalore` }));
    }

    function fetchOnline(query, local) {
        if (cache.has(query)) {
            render(merge(local, cache.get(query)), true);
            return;
        }
        inFlight = new AbortController();
        const url = 'https://photon.komoot.io/api/?' + new URLSearchParams({
            q: query,
            lat: '12.9716',
            lon: '77.5946',
            bbox: BANGALORE_BBOX.join(','),
            limit: '10',
            lang: 'en'
        });
        fetch(url, { signal: inFlight.signal })
            .then((response) => response.json())
            .then((data) => {
                const online = (data.features || [])
                    .map((f) => f.properties)
                    .filter((p) => p.countrycode === 'IN' && p.name)
                    .filter((p) => !PLACE_TYPES_TO_SKIP.includes(p.osm_key) && !SKIP_VALUES.includes(p.osm_value))
                    .map(onlineLabel);
                cache.set(query, online);
                if (input.value.trim() === query) render(merge(local, online), true);
            })
            .catch((error) => {
                if (error.name !== 'AbortError') render(local, false);
            });
    }

    // Post offices for a pincode, main office first: "Silchar – 788001, Cachar, Assam"
    function fetchPincode(pin, local) {
        const cacheKey = 'pin:' + pin;
        if (cache.has(cacheKey)) {
            const known = cache.get(cacheKey);
            render(known.length ? known : local, true, PINCODE_NOTE);
            return;
        }
        inFlight = new AbortController();
        fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: inFlight.signal })
            .then((response) => response.json())
            .then((data) => {
                const offices = (data && data[0] && data[0].PostOffice) || [];
                const order = { 'Head Post Office': 0, 'Sub Post Office': 1, 'Branch Post Office': 2 };
                const list = offices
                    .slice()
                    .sort((a, b) => (order[a.BranchType] ?? 3) - (order[b.BranchType] ?? 3))
                    .slice(0, 5)
                    .map((po) => {
                        const place = [po.Name, po.District, po.State].map((x) => (x || '').trim()).filter((x, i, all) => x && x !== 'NA' && all.indexOf(x) === i);
                        return { label: `${place[0]} – ${pin}, ${place.slice(1).join(', ')}`, value: `${place.join(', ')} ${pin}` };
                    });
                cache.set(cacheKey, list);
                if (input.value.replace(/\s/g, '') === pin) render(list.length ? list : local, true, PINCODE_NOTE);
            })
            .catch((error) => {
                if (error.name !== 'AbortError') render(local, true, null);
            });
    }

    function onlineLabel(p) {
        if (p.osm_value === 'postcode') {
            const area = p.district || p.locality;
            const label = `Pincode ${p.name}${area ? ' – ' + area : ''}, Bangalore`;
            return { label, value: label.replace(/^Pincode /, '') };
        }
        // "Name, Area, Bangalore"; Photon's city is often "Bengaluru" or a village name, so it is not shown
        const area = p.district || p.locality || (/^(bengaluru|bangalore)$/i.test(p.city || '') ? '' : p.city);
        const parts = [p.name, area !== p.name ? area : '', 'Bangalore'];
        const label = parts.filter(Boolean).join(', ');
        return { label, value: label };
    }

    // Built-in areas first, then online places, without repeats.
    // An online pincode result replaces the built-in one because it names the area.
    function merge(local, online) {
        const key = (s) => s.label.split(',')[0].toLowerCase();
        const onlinePin = online.find((s) => s.label.startsWith('Pincode '));
        const list = onlinePin ? [onlinePin].concat(local.filter((s) => !s.label.startsWith('Pincode '))) : local.slice();
        const seen = new Set(list.map(key));
        online.forEach((s) => {
            if (s.label.startsWith('Pincode ') || seen.has(key(s))) return;
            seen.add(key(s));
            list.push(s);
        });
        return list.slice(0, 8);
    }

    // Online results carry a one-line credit for their data source
    function render(list, fromOnline, note = OSM_NOTE) {
        suggestionBox.textContent = '';
        items = list;
        active = -1;
        if (!list.length) {
            if (fromOnline) {
                const empty = document.createElement('div');
                empty.className = 'px-4 py-2 text-gray-500';
                empty.textContent = 'No results found.';
                suggestionBox.appendChild(empty);
            }
            return;
        }
        list.forEach((item, i) => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.setAttribute('role', 'option');
            div.textContent = item.label;
            div.addEventListener('mousedown', (e) => e.preventDefault());
            div.addEventListener('click', () => choose(item));
            div.addEventListener('mouseenter', () => { active = i; highlight(); });
            suggestionBox.appendChild(div);
        });
        if (fromOnline && note) {
            const credit = document.createElement('div');
            credit.className = 'suggestion-note';
            credit.textContent = note;
            suggestionBox.appendChild(credit);
        }
    }

    function highlight() {
        suggestionBox.querySelectorAll('.suggestion-item').forEach((el, i) => {
            el.classList.toggle('is-active', i === active);
        });
    }

    function choose(item) {
        input.value = item.value;
        close();
    }

    function close() {
        suggestionBox.textContent = '';
        items = [];
        active = -1;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    initAutocomplete(document.getElementById('location'));
    initAutocomplete(document.getElementById('modalLocationInput'));
});

// Form navigation functions
let currentStep = 1;
const totalSteps = 11;

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
            renderReview();
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
        case 2: // Event type (and the location, when the form was opened from an event page)
            const locationRow = document.getElementById('modalLocationRow');
            if (locationRow && !locationRow.classList.contains('hidden')) {
                const typedLocation = document.getElementById('modalLocationInput').value.trim();
                if (!typedLocation) {
                    showAlert('Please enter where your event is');
                    return false;
                }
                document.getElementById('modalLocation').value = typedLocation;
            }
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

        case 9: // Indoors or outdoors
            if (!document.querySelector('input[name="venue_setting"]:checked')) {
                showAlert('Please select indoors or outdoors');
                return false;
            }
            return true;

        case 10: // Date selection
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

        case 11: // Contact details
            const name = document.getElementById('user_name').value.trim();
            const email = document.getElementById('user_email').value.trim();
            const phoneInput = document.getElementById('user_phone');
            const phone = normalisePhone(phoneInput.value);
            phoneInput.value = phone;

            if (!name) {
                showAlert('Please enter your name');
                return false;
            }
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

// "+91 98765 43210", "098765-43210" -> "9876543210"
function normalisePhone(value) {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return digits;
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
        showAlert('Please select an option to continue');
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
        showAlert('Please select at least one option to continue');
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
        showAlert('Please select whether you have a specific date');
        return false;
    }

    if (dateSet.value === 'yes') {
        if (!document.getElementById('date-picker').value) {
            showAlert('Please select a specific date');
            return false;
        }
    } else {
        if (!document.querySelector('input[name="approximate_date"]:checked')) {
            showAlert('Please select an approximate timeframe');
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

    // Email subject: "New DJ enquiry – Wedding – Asha"
    const pickedEvent = document.querySelector('input[name="event_type"]:checked');
    document.getElementById('formSubject').value = ['New DJ enquiry', pickedEvent ? choiceLabel(pickedEvent) : '',
        document.getElementById('user_name').value.trim()].filter(Boolean).join(' – ');

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
                saveWhatsAppBrief();

                // Count the lead in GA4, then go to the confirmation page
                let redirected = false;
                const goToConfirmation = () => {
                    if (redirected) return;
                    redirected = true;
                    window.location.href = "https://bookmydjs.in/matches/";
                };
                if (typeof gtag === 'function') {
                    gtag('event', 'generate_lead', {
                        send_to: 'G-2MC0448GKR',
                        form_name: 'booking',
                        transport_type: 'beacon',
                        event_callback: goToConfirmation
                    });
                    setTimeout(goToConfirmation, 800);
                } else {
                    goToConfirmation();
                }
            } else {
                throw new Error(responseData.message || 'Form submission failed');
            }
        })
        .catch((error) => {
            console.error("Form submission error:", {
                message: error.message,
                stack: error.stack
            });
            showAlert("Sorry, we couldn't send your request. Please try again, or message us on WhatsApp at +91-94815 43530.");

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
    const totalSteps = 12; // Total steps, including Step 11 and the final review
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

    // "Other" event type: keep its text box usable (the reset above would leave it disabled)
    if (eventType === 'other') {
        const otherEvent = document.getElementById('event_type_other');
        otherEvent.disabled = false;
        otherEvent.focus();
    }

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
    document.getElementById('modalLocationInput').value = '';
    document.getElementById('modalLocationRow').classList.add('hidden');

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

// ---- Review step ----
// Back button on the review step: return to the contact details
function backFromReview() {
    document.getElementById('final-step').style.display = 'none';
    document.getElementById('step' + totalSteps).style.display = 'block';
    updateProgress(totalSteps);
}

const REVIEW_FIELDS = [
    ['event_type', 'Event'],
    ['wedding_events[]', 'Wedding functions'],
    ['guest_ages[]', 'Guest ages'],
    ['guest_count', 'Guests'],
    ['service_types[]', 'DJ service'],
    ['music_types[]', 'Music'],
    ['languages[]', 'Languages'],
    ['venue_type', 'Venue'],
    ['venue_setting', 'Indoors or outdoors'],
    ['approximate_date', 'When']
];

// Visible text of a radio/checkbox choice; for "Other" it is what the customer typed
function choiceLabel(input) {
    const label = input.closest('label');
    const span = label ? label.querySelector('span') : null;
    const other = label ? label.querySelector('input[type="text"]') : null;
    if (other && other.value.trim()) return other.value.trim();
    return (span ? span.textContent : input.value).trim().replace(/:$/, '');
}

function reviewRows() {
    const rows = [['Location', document.getElementById('modalLocation').value]];
    const dateSet = document.querySelector('input[name="date_set"]:checked');
    const hasDate = dateSet && dateSet.value === 'yes';

    REVIEW_FIELDS.forEach(([name, title]) => {
        if (name === 'approximate_date' && hasDate) return;
        const picked = Array.from(document.querySelectorAll(`#modalForm input[name="${name}"]:checked`)).map(choiceLabel);
        if (picked.length) rows.push([title, picked.join(', ')]);
    });

    const date = document.getElementById('date-picker').value;
    if (hasDate && date) {
        rows.push(['Date', new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })]);
    }
    rows.push(['Name', document.getElementById('user_name').value.trim()]);
    rows.push(['Email', document.getElementById('user_email').value.trim()]);
    rows.push(['Phone', document.getElementById('user_phone').value.trim()]);
    return rows.filter(([, value]) => value);
}

function renderReview() {
    const rows = reviewRows();
    const list = document.getElementById('reviewList');
    list.textContent = '';
    rows.forEach(([title, value]) => {
        const row = document.createElement('div');
        row.className = 'review-row';
        const dt = document.createElement('dt');
        dt.textContent = title;
        const dd = document.createElement('dd');
        dd.textContent = value;
        row.append(dt, dd);
        list.appendChild(row);
    });
}

// WhatsApp message with the request details, offered on the confirmation page.
// Kept only in this browser tab (sessionStorage); email and phone are left out.
function saveWhatsAppBrief() {
    const lines = reviewRows()
        .filter(([title]) => title !== 'Email' && title !== 'Phone')
        .map(([title, value]) => `*${title}:* ${value}`);
    const brief = ['Hi DJ Ravz! I just sent a DJ request on BookMyDJs.', ''].concat(lines).join('\n');
    try {
        sessionStorage.setItem('bmdWhatsAppBrief', brief);
    } catch (e) {
        // storage unavailable (private mode): the confirmation page falls back to the plain message
    }
}

// ---- Prefill from event and area pages (/?event=sangeet#book, /?area=Koramangala#book) ----
const EVENT_PREFILL = {
    'wedding': { type: 'wedding' },
    'sangeet': { type: 'wedding', wedding: 'sangeet' },
    'reception': { type: 'wedding', wedding: 'reception' },
    'mehendi': { type: 'wedding', wedding: 'pre_wedding' },
    'corporate': { type: 'office' },
    'birthday': { type: 'birthday_adult' },
    'anniversary': { type: 'other', other: 'Anniversary party' },
    'house-party': { type: 'other', other: 'House party' }
};

function applyPrefill() {
    const params = new URLSearchParams(window.location.search);
    const area = (params.get('area') || '').replace(/[^A-Za-z0-9 .-]/g, '').trim().slice(0, 40);
    const preset = EVENT_PREFILL[params.get('event')];

    if (preset) {
        document.querySelector(`input[name="event_type"][value="${preset.type}"]`).checked = true;
        handleEventTypeChange();
        if (preset.wedding) {
            document.querySelector(`input[name="wedding_events[]"][value="${preset.wedding}"]`).checked = true;
        }
        if (preset.other) {
            document.getElementById('event_type_other').value = preset.other;
        }
    }

    if (area) {
        document.getElementById('location').value = area + ', Bangalore';
        showModal();
    } else if (preset || params.has('book')) {
        openFormAskingLocation();
    }
}

// Event pages: open the form straight away and ask for the location inside it
function openFormAskingLocation() {
    document.getElementById('modalLocationRow').classList.remove('hidden');
    document.getElementById('formModal').style.display = 'block';
    document.querySelectorAll('.form-step').forEach((step) => { step.style.display = 'none'; });
    document.getElementById('step2').style.display = 'block';
    updateProgress(2);
    const input = document.getElementById('modalLocationInput');
    input.focus();
    // Enter must not send the form from this box
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
}

// Homepage buttons: use the location already typed in the hero box, otherwise ask for it inside the form
function openBookingForm() {
    if (document.getElementById('location').value.trim()) {
        showModal();
    } else {
        openFormAskingLocation();
    }
}

document.addEventListener('DOMContentLoaded', applyPrefill);
