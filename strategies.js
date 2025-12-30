/**
 * STRATÉGIES MÉTIER & COMPOSANTS NATIFS (V2.1 - Complet)
 * Regroupe les règles spécifiques (Adresses) et génériques (Inputs, Selects).
 */
(function() {
    
    // --- UTILITAIRES INTERNES ---
    // Simule une interaction utilisateur complète pour réveiller les frameworks (Angular/React/Vue)
    const dispatchEvents = (el) => {
        el.dispatchEvent(new Event('focus', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
    };

    const strategies = [
        
        // =========================================================================
        // 1. STRATÉGIES MÉTIER (Les plus spécifiques en premier)
        // =========================================================================
        
        {
            id: 'AdresseBanOuManuelle_SaisieManuelle',
            description: 'Gère la saisie manuelle adresse (Angular Material)',
            
            // S'applique uniquement aux champs d'adresse manuelle
            matches: (key, el, data) => key.endsWith('_communeActuelleAdresseManuelle_nomLong'),
            
            // Condition : le flag "utiliserAdresseManuelle" doit être vrai
            isActive: (key, data) => {
                const prefix = key.split('_communeActuelleAdresseManuelle_nomLong')[0];
                return data[`${prefix}_utiliserAdresseManuelle`] === true;
            },

            getIgnoredKeys: (key) => {
                const base = key.replace('_nomLong', ''); 
                return ['_nom', '_codeInsee', '_codePostal', '_codeInseeDepartement', '_id', '_nomProtecteur', '_typeProtection']
                       .map(s => base + s);
            },

            execute: async function(element, value, fullData, engine) {
                const prefix = key.split('_communeActuelleAdresseManuelle_nomLong')[0];
                const checkboxKey = `${prefix}_utiliserAdresseManuelle`;
                
                // 1. Checkbox "Saisie Manuelle"
                const checkboxEl = engine.findElement(checkboxKey);
                if (checkboxEl && !checkboxEl.checked) {
                    engine.log(`[Stratégie] Clic 'Adresse Manuelle'`, '☑️');
                    checkboxEl.click();
                    return 'PENDING';
                }

                // 2. Formatage Valeur (CP + Ville)
                const cp = fullData[`${prefix}_communeActuelleAdresseManuelle_codePostal`];
                const nom = fullData[`${prefix}_communeActuelleAdresseManuelle_nom`];
                let textToType = (cp && nom) ? `${cp} ${nom}` : value;

                // 3. Gestion Autocomplete (Angular Material)
                const options = document.querySelectorAll('mat-option');
                const visibleOptions = Array.from(options).filter(opt => opt.offsetParent !== null);
                
                if (visibleOptions.length > 0) {
                    const targetOption = visibleOptions[0];
                    const targetText = targetOption.innerText.trim();
                    
                    if(targetText.includes(nom) || targetText.includes(cp)) {
                         engine.log(`[Stratégie] Clic option "${targetText}"`, 'point_up');
                         await engine.sleep(500); 
                         targetOption.click();
                         await engine.sleep(100);
                         
                         if (!element.value.includes(nom)) {
                             element.value = targetText;
                             dispatchEvents(element);
                         }
                         return 'OK'; 
                    }
                }

                // 4. Saisie
                if (element.value !== textToType) {
                    engine.log(`[Stratégie] Saisie : "${textToType}"`, '⌨️');
                    element.value = textToType;
                    dispatchEvents(element); 
                    element.focus();
                    return 'PENDING'; 
                }

                if (document.activeElement !== element) {
                    element.focus();
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                }
                return 'PENDING'; 
            }
        },

        // =========================================================================
        // 2. STRATÉGIES COMPOSANTS NATIFS (Déduites du DOM)
        // =========================================================================

        // --- SELECT (Listes déroulantes) ---
        {
            id: 'Native_Select',
            description: 'Gère les balises <select> standards',
            
            matches: (key, el) => el && el.tagName === 'SELECT',
            
            execute: async (element, value, data, engine) => {
                const searchVal = String(value).trim();
                let foundIndex = -1;

                for (let i = 0; i < element.options.length; i++) {
                    const opt = element.options[i];
                    // Match par valeur (prioritaire) ou par texte
                    if (opt.value === searchVal) {
                        foundIndex = i;
                        break;
                    }
                    if (searchVal.length > 0 && opt.text.includes(searchVal)) {
                        foundIndex = i;
                        break; 
                    }
                }
                
                if (foundIndex > -1) {
                    if (element.selectedIndex === foundIndex) return 'SKIPPED';
                    
                    engine.log(`[Select] Sélection : "${element.options[foundIndex].text}"`, '🔽');
                    element.selectedIndex = foundIndex;
                    dispatchEvents(element);
                    return 'OK';
                }
                
                engine.log(`[Select] Option introuvable pour "${value}"`, '⚠️');
                return 'KO';
            }
        },

        // --- RADIO ---
        {
            id: 'Native_Radio',
            description: 'Gère les boutons radio (input[type="radio"])',
            
            matches: (key, el) => el && el.type === 'radio',
            
            execute: async (element, value, data, engine) => {
                const groupName = element.name;
                if (!groupName) return 'KO'; 

                const radios = document.querySelectorAll(`input[type="radio"][name="${groupName}"]`);
                let targetRadio = null;

                for (const radio of radios) {
                    // Vérifie la value ou un attribut custom 'v' (si utilisé par le framework)
                    const valAttr = radio.getAttribute('v') || radio.value;
                    if (valAttr === String(value)) {
                        targetRadio = radio;
                        break;
                    }
                }

                if (targetRadio) {
                    if (targetRadio.checked) return 'SKIPPED';
                    engine.log(`[Radio] Clic sur "${value}"`, '🔘');
                    targetRadio.click();
                    dispatchEvents(targetRadio);
                    return 'OK';
                }
                
                engine.log(`[Radio] Valeur introuvable "${value}"`, '⚠️');
                return 'KO';
            }
        },

        // --- CHECKBOX ---
        {
            id: 'Native_Checkbox',
            description: 'Gère les cases à cocher (input[type="checkbox"])',
            
            matches: (key, el) => el && el.type === 'checkbox',
            
            execute: async (element, value, data, engine) => {
                const shouldBeChecked = (value === true || value === 'true');
                if (element.checked === shouldBeChecked) return 'SKIPPED';
                
                engine.log(`[Checkbox] ${shouldBeChecked ? 'Cocher' : 'Décocher'}`, '☑️');
                element.click();
                dispatchEvents(element);
                return 'OK';
            }
        },

        // --- INPUT SIMPLE (Fallback générique) ---
        {
            id: 'Native_Input_Simple',
            description: 'Gère les inputs textes standards et textareas',
            
            // Matche tout INPUT (sauf radio/checkbox/file/submit) et TEXTAREA
            matches: (key, el) => {
                if (!el) return false;
                const tag = el.tagName;
                const type = el.type ? el.type.toLowerCase() : 'text';
                
                if (tag === 'TEXTAREA') return true;
                if (tag === 'INPUT' && !['radio', 'checkbox', 'file', 'hidden', 'submit', 'button'].includes(type)) {
                    return true;
                }
                return false;
            },
            
            execute: async (element, value, data, engine) => {
                const strValue = String(value);
                if (element.value === strValue) return 'SKIPPED';
                
                engine.log(`[Input] Saisie de "${value}"`, '✍️');
                element.focus();
                element.value = strValue;
                dispatchEvents(element);
                return 'OK';
            }
        }
    ];

    // INJECTION DANS LE MOTEUR
    if (window.FormulaireTester) {
        // On écrase la liste pour être sûr d'avoir la version propre
        window.FormulaireTester.strategies = strategies;
        console.log(`[Strategies] ${strategies.length} stratégies chargées (V2.1 Complet).`);
    } else {
        console.warn("[Strategies] Erreur : Moteur absent au moment du chargement.");
    }
})();