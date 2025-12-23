/**
 * MOTEUR V7.0 - Architecture Événementielle (Global Observer)
 * Logique inversée : On observe le DOM et on tire dans le tas dès qu'une cible apparaît.
 */
window.FormulaireTester = {

    abort: false, // Flag d'arrêt manuel

    config: {
        verbose: true,
        inactivityTimeout: 2000, // Temps de calme plat avant de considérer le test terminé
        stepDelay: 50    // Délai minime pour laisser le moteur de rendu respirer
    },

    // --- STRATÉGIES (Adaptées pour ne pas bloquer le flux) ---
    strategies: [
        {
            id: 'AdresseBanOuManuelle_SaisieManuelle',
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

            customFill: async function (key, value, fullData, engine) {
                const prefix = key.split('_communeActuelleAdresseManuelle_nomLong')[0];
                const checkboxKey = `${prefix}_utiliserAdresseManuelle`;
                const inputTargetKey = key.replace('_nomLong', '');

                // 1. Checkbox
                const checkboxEl = engine.findElement(checkboxKey);
                if (checkboxEl && !checkboxEl.checked) {
                    engine.log(`[Stratégie] Clic 'Adresse Manuelle'`, '☑️');
                    checkboxEl.click();
                    return 'PENDING';
                }

                // 2. Calcul Valeur
                const cp = fullData[`${prefix}_communeActuelleAdresseManuelle_codePostal`];
                const nom = fullData[`${prefix}_communeActuelleAdresseManuelle_nom`];
                let textToType = value;
                if (cp && nom) textToType = `${cp} ${nom}`;

                const inputEl = engine.findElement(inputTargetKey);

                if (inputEl) {
                    // 3. CHECKPRIORITAIRE : La liste d'options
                    // On ne prend que les options visibles (pour éviter de cliquer sur des vieux overlays cachés)
                    const allOptions = document.querySelectorAll('mat-option');
                    // Filtre simple pour voir si visible (offsetParent n'est pas null)
                    const visibleOptions = Array.from(allOptions).filter(opt => opt.offsetParent !== null);

                    if (visibleOptions.length > 0) {
                        const targetOption = visibleOptions[0];
                        const targetText = targetOption.innerText.trim(); // ex: "AMIENS (80000)"

                        // Petite sécurité pour ne pas cliquer n'importe où
                        if(targetText.includes(nom) || targetText.includes(cp)) {
                             engine.log(`[Stratégie] Sélection de "${targetText}"`, 'point_up');

                             // 1. Simulation d'un clic "Humain" (Mousedown est CRUCIAL pour Angular Material)
                             // Angular Material attend souvent mousedown pour initier la sélection
                             ['mousedown', 'mouseup', 'click'].forEach(evtType => {
                                 const mouseEvent = new MouseEvent(evtType, {
                                     bubbles: true,
                                     cancelable: true,
                                     view: window
                                 });
                                 targetOption.dispatchEvent(mouseEvent);
                             });

                             // 2. Ceinture et Bretelles : Forçage de la valeur
                             // Parfois le clic met à jour le modèle interne mais l'input lag
                             // On force la valeur affichée pour être sûr que la validation passe
                             if (inputEl.value !== targetText) {
                                 engine.log(`[Stratégie] Correction valeur input -> "${targetText}"`, '🔧');
                                 inputEl.value = targetText;
                                 // On redéclenche les events sur l'input pour qu'il sache qu'il a changé
                                 inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                                 inputEl.dispatchEvent(new Event('change', { bubbles: true }));
                                 inputEl.blur(); // On quitte le champ pour fermer la liste proprement
                             }

                             return 'OK'; 
                        }
                    }

                    // 4. Saisie du texte
                    if (inputEl.value !== textToType) {
                        engine.log(`[Stratégie] Saisie : "${textToType}"`, '⌨️');
                        engine.fillField(inputEl, textToType);

                        // Forcer le focus est CRUCIAL pour Angular Material
                        inputEl.focus();
                        inputEl.dispatchEvent(new Event('focus', { bubbles: true }));
                        inputEl.dispatchEvent(new Event('input', { bubbles: true }));

                        return 'PENDING';
                    }

                    // 5. ETAT D'ATTENTE (Le correctif est ici)
                    // Le texte est bon, MAIS on n'a pas encore cliqué (sinon on serait sorti au point 3).
                    // On force le moteur à repasser ici tant que la liste n'est pas apparue.

                    // On remet le focus au cas où l'utilisateur (ou le script) l'ait perdu
                    if (document.activeElement !== inputEl) {
                        inputEl.focus();
                        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                    }

                    return 'PENDING';
                }

                return 'ABSENT';
            }
        }
    ],

    log: function (msg, emoji = 'ℹ️', data = null) {
        if (this.config.verbose) {
            console.log(`%c[TESTER] ${emoji} ${msg}`, 'color: #cd094f; font-weight: bold;', data || '');
        }
    },

    /**
     * Point d'entrée principal
     */
    runPage: function (scenario) {
        return new Promise((resolve, reject) => {
            this.abort = false;

            // 1. Préparation des données "en attente"
            // On fait une copie pour pouvoir supprimer les clés au fur et à mesure
            this.pendingData = this.prepareData(scenario);
            this.fullScenarioData = scenario.donnees || scenario; // Gardé pour référence (stratégies)

            let totalFilled = 0;
            let silenceTimer = null;
            let observer = null;

            this.log(`Démarrage V7. Données à traiter : ${Object.keys(this.pendingData).length}`, "🚀");

            // --- FONCTION DE FIN ---
            const finish = (reason) => {
                if (observer) observer.disconnect();
                if (silenceTimer) clearTimeout(silenceTimer);
                this.log(`Terminé (${reason}). Champs remplis : ${totalFilled}`, "🏁");
                resolve(totalFilled);
            };

            // --- FONCTION DE RESET DU TIMER ---
            const bumpTimer = () => {
                if (silenceTimer) clearTimeout(silenceTimer);
                silenceTimer = setTimeout(() => {
                    finish("Timeout Inactivité");
                }, this.config.inactivityTimeout);
            };

            // --- FONCTION DE SCAN (Le coeur) ---
            const scanAndFill = async () => {
                if (this.abort) { finish("Arrêt Utilisateur"); return; }

                let activityDetected = false;
                const keysToRemove = [];

                // On parcourt tout ce qui reste à remplir
                for (const [key, value] of Object.entries(this.pendingData)) {

                    // 1. Stratégie ou Standard ?
                    const strategy = this.findStrategy(key, this.fullScenarioData);
                    let status = 'ABSENT';

                    if (strategy && strategy.customFill) {
                        // La stratégie gère sa propre logique (clic, check...)
                        status = await strategy.customFill(key, value, this.fullScenarioData, this);
                    } else {
                        // Mode standard : on cherche l'élément
                        const el = this.findElement(key);
                        if (el && el.offsetParent !== null) {
                            if (this.isValueAlreadySet(el, value)) {
                                status = 'SKIPPED';
                            } else {
                                const ok = this.fillField(el, value);
                                status = ok ? 'OK' : 'KO';
                            }
                        }
                    }

                    // 2. Traitement du résultat
                    if (status === 'OK') {
                        this.log(`Rempli : ${key}`, '✅');
                        totalFilled++;
                        activityDetected = true;
                        keysToRemove.push(key);
                    } else if (status === 'SKIPPED') {
                        this.log(`Déjà fait : ${key}`, '⏭️');
                        keysToRemove.push(key); // On l'enlève de la liste car c'est fini
                    } else if (status === 'PENDING') {
                        // La stratégie a fait une action (ex: clic checkbox) mais n'a pas fini (attend l'input)
                        // On considère ça comme une activité pour reset le timer
                        activityDetected = true;
                    }
                    // Si 'ABSENT', on ne fait rien, on garde la clé dans pendingData pour le prochain tour
                }

                // Nettoyage des clés traitées
                keysToRemove.forEach(k => delete this.pendingData[k]);

                // Si on a tout fini
                if (Object.keys(this.pendingData).length === 0) {
                    finish("Succès - Plus de données");
                    return;
                }

                // Si on a bougé quelque chose, on repousse la fin du monde
                if (activityDetected) bumpTimer();
            };

            // --- INITIALISATION OBSERVER ---
            observer = new MutationObserver((mutations) => {
                // On s'intéresse aux ajouts de noeuds ou changements d'attributs (ex: disabled -> enabled)
                const relevantMutation = mutations.some(m =>
                    m.type === 'childList' && m.addedNodes.length > 0 ||
                    m.type === 'attributes' && (m.attributeName === 'disabled' || m.attributeName === 'style' || m.attributeName === 'class')
                );

                if (relevantMutation) {
                    // On relance un scan car le terrain a changé
                    bumpTimer(); // Le DOM bouge, donc on est vivant
                    scanAndFill();
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true, // On surveille aussi les attributs (visibilité/disabled)
                attributeFilter: ['style', 'class', 'disabled', 'hidden']
            });

            // Premier scan au démarrage (pour les champs déjà présents)
            bumpTimer();
            scanAndFill();
        });
    },

    // --- UTILS (Inchangés) ---

    // (Garde ici tes fonctions findStrategy, prepareData, findElement, fillField, normalizeBooleans...)
    // ... Je ne les répète pas pour alléger la lecture, mais il faut les inclure !
    // Copie-colle les fonctions "Utils" de la V6.1 ci-dessous.

    findStrategy: function (key, fullData) {
        const normalizedData = this.normalizeBooleans(fullData);
        return this.strategies.find(s => s.matches(key) && s.isActive(key, normalizedData));
    },

    prepareData: function (input) {
        let rawData = input.donnees ? input.donnees : input;
        let clean = {};
        const fullRawData = this.normalizeBooleans(rawData);

        let keysToIgnore = new Set();
        Object.keys(fullRawData).forEach(key => {
            const strategy = this.findStrategy(key, fullRawData);
            if (strategy && strategy.getIgnoredKeys) {
                strategy.getIgnoredKeys(key).forEach(k => keysToIgnore.add(k));
            }
        });

        for (const [key, val] of Object.entries(fullRawData)) {
            if (val === null || val === "") continue;
            if (keysToIgnore.has(key)) continue;

            let finalKey = key;
            if (key.endsWith('_libelle')) finalKey = key.replace('_libelle', '');
            if (key.endsWith('_valeur') && fullRawData[key.replace('_valeur', '_libelle')]) continue;

            clean[finalKey] = val;
        }
        return clean;
    },

    normalizeBooleans: function (data) {
        const out = {};
        for (const [k, v] of Object.entries(data)) {
            out[k] = (v === "true" || v === true) ? true : ((v === "false" || v === false) ? false : v);
        }
        return out;
    },

    findElement: function (key) {
        const container = document.querySelector(`[data-clef="${key}"]`);
        if (container) {
            if (['input', 'select', 'textarea'].includes(container.tagName.toLowerCase())) return container;
            return container.querySelector('input, select, textarea');
        }
        return document.querySelector(`#${key}, [name="${key}"]`);
    },

    isValueAlreadySet: function (el, val) {
        if (el.type === 'checkbox' || el.type === 'radio') return el.checked === val;
        return el.value == val;
    },

    fillField: function (el, val) {
        try {
            el.focus();
            const tag = el.tagName.toLowerCase();
            const type = el.type ? el.type.toLowerCase() : '';

            if (type === 'checkbox' || type === 'radio') {
                if (el.checked !== val) el.click();
            } else if (tag === 'select') {
                let found = false;
                for (let i = 0; i < el.options.length; i++) {
                    if (el.options[i].text.includes(val)) {
                        el.selectedIndex = i;
                        found = true;
                        break;
                    }
                }
                if (found) el.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
            el.blur();
            return true;
        } catch (e) { return false; }
    }
};