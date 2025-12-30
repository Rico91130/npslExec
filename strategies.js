/**
 * STRATÉGIES MÉTIER
 * Ce fichier contient les règles spécifiques aux composants complexes.
 * Il s'injecte dans window.FormulaireTester.strategies
 */
(function() {
    // Définition de tes stratégies
    const CUSTOM_STRATEGIES = [
        {
            id: 'AdresseBanOuManuelle_SaisieManuelle',
            description: 'Gère la saisie manuelle adresse avec autocomplétion Angular Material',
            
            matches: (key) => key.endsWith('_communeActuelleAdresseManuelle_nomLong'),
            
            isActive: (key, fullData) => {
                const prefix = key.split('_communeActuelleAdresseManuelle_nomLong')[0];
                return fullData[`${prefix}_utiliserAdresseManuelle`] === true;
            },

            getIgnoredKeys: (key) => {
                const base = key.replace('_nomLong', ''); 
                return ['_nom', '_codeInsee', '_codePostal', '_codeInseeDepartement', '_id', '_nomProtecteur', '_typeProtection']
                       .map(suffix => base + suffix);
            },

            customFill: async function(key, value, fullData, engine) {
                const prefix = key.split('_communeActuelleAdresseManuelle_nomLong')[0];
                const checkboxKey = `${prefix}_utiliserAdresseManuelle`;
                const inputTargetKey = key.replace('_nomLong', ''); 

                // 1. CHECKBOX
                const checkboxEl = engine.findElement(checkboxKey);
                if (checkboxEl && !checkboxEl.checked) {
                    engine.log(`[Stratégie] Clic 'Adresse Manuelle'`, '☑️');
                    checkboxEl.click();
                    return 'PENDING';
                }

                // 2. VALEUR CIBLE
                const cp = fullData[`${prefix}_communeActuelleAdresseManuelle_codePostal`];
                const nom = fullData[`${prefix}_communeActuelleAdresseManuelle_nom`];
                let textToType = value; 
                if (cp && nom) textToType = `${cp} ${nom}`;

                const inputEl = engine.findElement(inputTargetKey);
                
                if (inputEl) {
                    // 3. GESTION LISTE (Avec Temporisation)
                    const allOptions = document.querySelectorAll('mat-option');
                    const visibleOptions = Array.from(allOptions).filter(opt => opt.offsetParent !== null);
                    
                    if (visibleOptions.length > 0) {
                        const targetOption = visibleOptions[0];
                        const targetText = targetOption.innerText.trim();

                        if(targetText.includes(nom) || targetText.includes(cp)) {
                             engine.log(`[Stratégie] Option trouvée. Pause stabilisation...`, '⏳');
                             await engine.sleep(1000); 

                             engine.log(`[Stratégie] Clic natif sur "${targetText}"`, 'point_up');
                             targetOption.click();

                             await engine.sleep(100);

                             if (!inputEl.value.includes(nom)) {
                                 engine.log(`[Stratégie] Le clic a échoué, forçage valeur.`, '🔧');
                                 inputEl.value = targetText;
                                 inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                                 inputEl.blur();
                             }
                             return 'OK'; 
                        }
                    }

                    // 4. SAISIE
                    if (inputEl.value !== textToType) {
                        engine.log(`[Stratégie] Saisie : "${textToType}"`, '⌨️');
                        engine.fillField(inputEl, textToType);
                        
                        inputEl.focus(); 
                        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                        return 'PENDING'; 
                    }

                    // 5. ATTENTE LISTE
                    if (document.activeElement !== inputEl) {
                        inputEl.focus();
                        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                    }

                    return 'PENDING'; 
                }
                return 'ABSENT'; 
            }
        }
    ];

    // INJECTION DANS LE MOTEUR
    if (window.FormulaireTester) {
        // On fusionne avec les stratégies existantes s'il y en a, ou on initialise
        window.FormulaireTester.strategies = (window.FormulaireTester.strategies || []).concat(CUSTOM_STRATEGIES);
        console.log(`[Strategies] ${CUSTOM_STRATEGIES.length} stratégies métier chargées.`);
    } else {
        console.warn("[Strategies] Erreur : Le Moteur n'est pas encore chargé.");
    }
})();