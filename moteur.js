/**
 * MOTEUR V7.3 - Avec détection des champs non remplis (Gap Analysis)
 */
window.FormulaireTester = {
    abort: false,
    config: { verbose: true, inactivityTimeout: 2000, stepDelay: 50 },

    // --- STRATÉGIES
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
                    // On filtre pour être sûr qu'ils sont affichés
                    const visibleOptions = Array.from(allOptions).filter(opt => opt.offsetParent !== null);

                    if (visibleOptions.length > 0) {
                        const targetOption = visibleOptions[0];
                        const targetText = targetOption.innerText.trim();

                        // Sécurité de correspondance
                        if (targetText.includes(nom) || targetText.includes(cp)) {

                            // On a trouvé l'option, mais on attend un peu pour être sûr 
                            // que l'animation d'ouverture d'Angular est terminée.
                            engine.log(`[Stratégie] Option trouvée. Pause stabilisation...`, '⏳');
                            await engine.sleep(300); // 300ms de pause explicite

                            engine.log(`[Stratégie] Clic natif sur "${targetText}"`, 'point_up');
                            targetOption.click();

                            // Petite pause post-clic pour laisser le champ se mettre à jour
                            await engine.sleep(100);

                            // Vérification finale : si le clic n'a pas marché, on force
                            if (!inputEl.value.includes(nom)) {
                                engine.log(`[Stratégie] Le clic a échoué, forçage valeur.`, '🔧');
                                inputEl.value = targetText;
                                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                                inputEl.blur();
                            }

                            return 'OK';
                        }
                    }

                    // 4. SAISIE (Si nécessaire)
                    if (inputEl.value !== textToType) {
                        engine.log(`[Stratégie] Saisie : "${textToType}"`, '⌨️');
                        engine.fillField(inputEl, textToType);

                        // Focus pour ouvrir la liste
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
    ],


    // --- UTILS ---
    log: function (msg, emoji = 'ℹ️', data = null) { if (this.config.verbose) console.log(`%c[TESTER] ${emoji} ${msg}`, 'color: #cd094f; font-weight: bold;', data || ''); },
    sleep: function (ms) { return new Promise(resolve => setTimeout(resolve, ms)); },

    /**
     * Point d'entrée principal
     */
    runPage: function (scenario) {
        return new Promise((resolve, reject) => {
            this.abort = false;
            this.pendingData = this.prepareData(scenario);
            this.fullScenarioData = scenario.donnees || scenario;

            // Historique
            let report = [];
            // Set des clés traitées pour comparaison finale
            let touchedKeys = new Set();

            let silenceTimer = null;
            let observer = null;

            this.log(`Démarrage V7.3.`, "🚀");

            const finish = (reason) => {
                if (observer) observer.disconnect();
                if (silenceTimer) clearTimeout(silenceTimer);

                // --- ANALYSE DES CHAMPS MANQUANTS (NOUVEAU) ---
                const allDomKeys = new Set();
                document.querySelectorAll('[data-clef]').forEach(el => {
                    // On ne prend que les éléments visibles pour ne pas polluer avec des champs hidden
                    if (el.offsetParent !== null) {
                        allDomKeys.add(el.getAttribute('data-clef'));
                    }
                });

                // Calcul de la différence : (Tout ce qu'il y a sur la page) - (Tout ce qu'on a touché)
                // On filtre aussi les clés qui commencent par une clé déjà touchée (pour les sous-composants)
                const untouched = Array.from(allDomKeys).filter(domKey => {
                    if (touchedKeys.has(domKey)) return false;
                    // Si une stratégie a géré le parent, on ignore les enfants (ex: adresseDeclarant gère adresseDeclarant_voie)
                    for (let touched of touchedKeys) {
                        if (domKey.startsWith(touched + '_')) return false;
                    }
                    return true;
                });

                this.log(`Terminé (${reason}).`, "🏁");

                resolve({
                    totalFilled: report.filter(x => x.status === 'OK').length,
                    reason: reason,
                    details: report,
                    untouched: untouched // On renvoie la liste des orphelins
                });
            };

            const bumpTimer = () => {
                if (silenceTimer) clearTimeout(silenceTimer);
                silenceTimer = setTimeout(() => { finish("Timeout Inactivité"); }, this.config.inactivityTimeout);
            };

            const scanAndFill = async () => {
                if (this.abort) { finish("Arrêt Utilisateur"); return; }

                let activityDetected = false;
                const keysToRemove = [];

                for (const [key, value] of Object.entries(this.pendingData)) {
                    const strategy = this.findStrategy(key, this.fullScenarioData);
                    let status = 'ABSENT';

                    if (strategy && strategy.customFill) {
                        status = await strategy.customFill(key, value, this.fullScenarioData, this);
                    } else {
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

                    if (status === 'OK') {
                        this.log(`Rempli : ${key}`, '✅');
                        report.push({ key: key, status: 'OK', time: new Date().toLocaleTimeString() });
                        touchedKeys.add(key); // Marqué comme traité
                        activityDetected = true;
                        keysToRemove.push(key);
                    } else if (status === 'SKIPPED') {
                        this.log(`Déjà fait : ${key}`, '⏭️');
                        report.push({ key: key, status: 'SKIPPED', time: new Date().toLocaleTimeString() });
                        touchedKeys.add(key); // Marqué comme traité
                        keysToRemove.push(key);
                    } else if (status === 'PENDING') {
                        activityDetected = true;
                    }
                }

                keysToRemove.forEach(k => delete this.pendingData[k]);

                if (Object.keys(this.pendingData).length === 0) {
                    finish("Succès - Plus de données");
                    return;
                }
                if (activityDetected) bumpTimer();
            };

            observer = new MutationObserver((mutations) => {
                const relevant = mutations.some(m => m.type === 'childList' && m.addedNodes.length > 0 || m.type === 'attributes');
                if (relevant) { bumpTimer(); scanAndFill(); }
            });

            observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'disabled', 'hidden'] });
            bumpTimer();
            scanAndFill();
        });
    },

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