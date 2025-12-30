/**
 * STRATÉGIES MÉTIER & COMPOSANTS NATIFS (V3.1 - Fix Priorité Checkbox)
 */
window.NPSL_STRATEGIES = [

    // --- 1. STRATÉGIES MÉTIER ---

    {
        id: 'AdresseBanOuManuelle_SaisieManuelle',
        description: 'Gère le bloc adresse manuelle complet (Checkbox + Autocomplete)',

        matches: (key) => key.endsWith('_communeActuelleAdresseManuelle_nomLong') || key.endsWith('_utiliserAdresseManuelle'),

        isActive: (key, data) => {
            let prefix = '';
            if (key.endsWith('_nomLong')) prefix = key.split('_communeActuelleAdresseManuelle_nomLong')[0];
            else if (key.endsWith('_utiliserAdresseManuelle')) prefix = key.split('_utiliserAdresseManuelle')[0];

            const val = data[`${prefix}_utiliserAdresseManuelle`];
            return val === true || val === 'true';
        },

        getIgnoredKeys: (key) => {
            if (key.endsWith('_nomLong')) {
                const base = key.replace('_nomLong', '');
                return ['_nom', '_codeInsee', '_codePostal', '_codeInseeDepartement', '_id', '_nomProtecteur', '_typeProtection']
                    .map(s => base + s);
            }
            return [];
        },

        execute: async function (element, value, key, fullData, engine) {
            const isCheckbox = element.type === 'checkbox';
            const isAutocomplete = !isCheckbox;

            // --- CAS 1 : CHECKBOX ---
            if (isCheckbox) {
                const shouldBeChecked = (value === true || value === 'true');
                if (element.checked !== shouldBeChecked) {
                    engine.log(`[Stratégie Adresse] Clic Checkbox`, '☑️');
                    element.click();
                    return 'PENDING';
                }
                return 'OK';
            }

            // --- CAS 2 : AUTOCOMPLETE ---
            if (isAutocomplete) {
                let textToType = String(value).trim();
                const options = document.querySelectorAll('mat-option');
                const visibleOptions = Array.from(options).filter(opt => opt.offsetParent !== null);

                // A. UNE OPTION EST LÀ -> ON CLIQUE
                if (visibleOptions.length > 0) {
                    const bestOption = visibleOptions.find(opt => {
                        const txt = opt.innerText.trim();
                        return txt.includes("AMIENS") || txt.includes("80000"); // Simplifié
                    }) || visibleOptions[0];

                    engine.log(`[Stratégie Adresse] Clic option "${bestOption.innerText.trim()}"`, 'point_up');
                    bestOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    bestOption.click();
                    await engine.sleep(100);
                    return 'OK';
                }

                // B. TEXTE DÉJÀ LÀ MAIS PAS DE LISTE
                if (element.value === textToType) {
                    if (document.activeElement !== element) {
                        engine.log(`[Stratégie Adresse] Focus (Réveil)...`, '👀');
                        element.focus();
                    } else {
                        engine.log(`[Stratégie Adresse] En attente liste...`, '⏳');
                        element.dispatchEvent(new Event('input', { bubbles: true }));
                        element.dispatchEvent(new Event('keyup', { bubbles: true }));
                    }
                    return 'PENDING';
                }

                // C. SAISIE INITIALE
                if (element.value !== textToType) {
                    engine.log(`[Stratégie Adresse] Saisie "${textToType}"`, '⌨️');
                    element.focus();
                    element.value = textToType;
                    element.dispatchEvent(new Event('keydown', { bubbles: true }));
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('keyup', { bubbles: true }));
                    return 'PENDING';
                }
                return 'PENDING';
            }
            return 'KO';
        }

    },

    // --- 2. STRATÉGIES NATIVES (Ordre inchangé) ---

    {
        id: 'Native_Select',
        matches: (key, el) => el && el.tagName === 'SELECT',
        execute: async (element, value, key, data, engine) => { // Ajout key
            const searchVal = String(value).trim();
            let foundIndex = -1;
            for (let i = 0; i < element.options.length; i++) {
                if (element.options[i].value === searchVal || (searchVal.length > 0 && element.options[i].text.includes(searchVal))) {
                    foundIndex = i; break;
                }
            }
            if (foundIndex > -1) {
                if (element.selectedIndex === foundIndex) return 'SKIPPED';
                element.selectedIndex = foundIndex;
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return 'OK';
            }
            return 'KO';
        }
    },

    {
        id: 'Native_Radio',
        matches: (key, el) => el && el.type === 'radio',
        execute: async (element, value, key, data, engine) => { // Ajout key
            const groupName = element.name;
            if (!groupName) return 'KO';
            const radios = document.querySelectorAll(`input[type="radio"][name="${groupName}"]`);
            for (const radio of radios) {
                const valAttr = radio.getAttribute('v') || radio.value;
                if (valAttr === String(value)) {
                    if (radio.checked) return 'SKIPPED';
                    radio.click();
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                    return 'OK';
                }
            }
            return 'KO';
        }
    },

    {
        id: 'Native_Checkbox',
        matches: (key, el) => el && el.type === 'checkbox',
        execute: async (element, value, key, data, engine) => { // Ajout key
            const shouldBeChecked = (value === true || value === 'true');
            if (element.checked === shouldBeChecked) return 'SKIPPED';
            element.click();
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return 'OK';
        }
    },

    {
        id: 'Native_Input_Simple',
        matches: (key, el) => {
            if (!el) return false;
            const tag = el.tagName;
            const type = el.type ? el.type.toLowerCase() : 'text';
            if (tag === 'TEXTAREA') return true;
            if (tag === 'INPUT' && !['radio', 'checkbox', 'file', 'hidden', 'submit', 'button'].includes(type)) return true;
            return false;
        },
        execute: async (element, value, key, data, engine) => { // Ajout key
            const strValue = String(value);
            if (element.value === strValue) return 'SKIPPED';
            element.focus();
            element.value = strValue;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true }));
            return 'OK';
        }
    }
];

console.log(`[Strategies.js] ${window.NPSL_STRATEGIES.length} stratégies prêtes.`);