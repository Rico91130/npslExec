/**
 * STRATÉGIES MÉTIER & COMPOSANTS NATIFS (V2.0)
 * Architecture : Déductive (Le moteur demande "Qui peut gérer cet élément ?")
 */
(function() {
    
    // --- UTILITAIRES INTERNES ---
    const dispatchEvents = (el) => {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
    };

    const strategies = [
        
        // --- 1. STRATÉGIES MÉTIER (Cas Complexes & Spécifiques) ---
        
        {
            id: 'AdresseBanOuManuelle_SaisieManuelle',
            description: 'Gère la saisie manuelle adresse (Angular Material)',
            
            // On matche sur la clé JSON spécifique
            matches: (key, el, data) => key.endsWith('_communeActuelleAdresseManuelle_nomLong'),
            
            // Condition supplémentaire (Flag)
            isActive: (key, data) => {
                const prefix = key.split('_communeActuelleAdresseManuelle_nomLong')[0];
                return data[`${prefix}_utiliserAdresseManuelle`] === true;
            },

            // Nettoyage des clés associées
            getIgnoredKeys: (key) => {
                const base = key.replace('_nomLong', ''); 
                return ['_nom', '_codeInsee', '_codePostal', '_codeInseeDepartement', '_id', '_nomProtecteur', '_typeProtection'].map(s => base + s);
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
                         await engine.sleep(500); // Stabilisation
                         targetOption.click();
                         await engine.sleep(100);
                         
                         // Vérif
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
                    dispatchEvents(element); // Déclenche l'affichage de la liste
                    element.focus();
                    return 'PENDING'; 
                }

                // Focus maintenance
                if (document.activeElement !== element) {
                    element.focus();
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                }
                return 'PENDING'; 
            }
        },

        // --- 2. STRATÉGIES COMPOSANTS NATIFS (Déduites du DOM) ---

        {
            id: 'Native_Radio',
            description: 'Gère les boutons radio (input[type="radio"])',
            
            matches: (key, el) => el && el.type === 'radio',
            
            execute: async (element, value, data, engine) => {
                // Pour les radios, 'element' est souvent le premier du groupe.
                // Il faut trouver celui qui a la bonne valeur dans le même groupe (même 'name').
                const groupName = element.name;
                if (!groupName) return 'KO'; // Pas de name, impossible de grouper

                // Recherche de tous les radios du groupe
                const radios = document.querySelectorAll(`input[type="radio"][name="${groupName}"]`);
                let targetRadio = null;

                // Recherche de la correspondance (Value ou attribut spécifique 'v' comme vu dans le snapshot)
                for (const radio of radios) {
                    // On check la value standard OU l'attribut 'v' (spécifique DSFR/Angular parfois)
                    const valAttr = radio.getAttribute('v') || radio.value;
                    if (valAttr === value || valAttr === value.toString()) {
                        targetRadio = radio;
                        break;
                    }
                }

                if (targetRadio) {
                    if (targetRadio.checked) return 'SKIPPED';
                    targetRadio.click();
                    return 'OK';
                }
                
                engine.log(`[Radio] Aucune option trouvée pour la valeur "${value}"`, '⚠️');
                return 'KO';
            }
        },

        {
            id: 'Native_Checkbox',
            description: 'Gère les cases à cocher (input[type="checkbox"])',
            
            matches: (key, el) => el && el.type === 'checkbox',
            
            execute: async (element, value, data, engine) => {
                // Convertit la valeur JSON en booléen
                const shouldBeChecked = (value === true || value === 'true');
                
                if (element.checked === shouldBeChecked) return 'SKIPPED';
                
                element.click();
                return 'OK';
            }
        },

        {
            id: 'Native_Select',
            description: 'Gère les listes déroulantes (select)',
            
            matches: (key, el) => el && el.tagName === 'SELECT',
            
            execute: async (element, value, data, engine) => {
                let found = false;
                // Recherche par texte ou valeur
                for (let i = 0; i < element.options.length; i++) {
                    const opt = element.options[i];
                    if (opt.value == value || opt.text.includes(value)) {
                        if (element.selectedIndex === i) return 'SKIPPED';
                        element.selectedIndex = i;
                        found = true;
                        break;
                    }
                }
                
                if (found) {
                    dispatchEvents(element);
                    return 'OK';
                }
                return 'KO';
            }
        },

        {
            id: 'Native_Input_Default',
            description: 'Stratégie par défaut (Text, Email, Number, Textarea...)',
            
            // Matche tout ce qui reste (Input ou Textarea)
            matches: (key, el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'),
            
            execute: async (element, value, data, engine) => {
                if (element.value == value) return 'SKIPPED';
                
                element.focus();
                element.value = value;
                dispatchEvents(element);
                return 'OK';
            }
        }
    ];

    // INJECTION
    if (window.FormulaireTester) {
        // On remplace ou on concatène (ici on remplace pour être propre avec la V8)
        window.FormulaireTester.strategies = strategies;
        console.log(`[Strategies] ${strategies.length} stratégies chargées (Mode V2.0).`);
    } else {
        console.warn("[Strategies] Erreur : Moteur absent.");
    }
})();