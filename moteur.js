/**
 * MOTEUR V6.0 - Architecture Réactive (MutationObserver)
 * Fini les "sleep" arbitraires, place à la détection d'événements DOM.
 */
window.FormulaireTester = {
    
    // --- 1. CONFIGURATION ---
    
    config: {
        verbose: true,
        stepDelay: 100,       // Délai esthétique minimal entre deux actions (pour voir ce qui se passe)
        timeout: 300         // Temps max d'attente pour l'apparition d'un champ (ms)
    },

    // --- 2. STRATÉGIES (Composants Riches) ---
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

            customFill: async function(key, value, fullData, engine) {
                const prefix = key.split('_communeActuelleAdresseManuelle_nomLong')[0];
                const checkboxKey = `${prefix}_utiliserAdresseManuelle`;
                const inputTargetKey = key.replace('_nomLong', ''); 

                engine.log(`[Stratégie Adresse] Activation pour ${prefix}`, '🏠');

                // 1. Gestion Case à cocher
                const checkboxEl = await engine.waitForElement(checkboxKey);
                if (checkboxEl && !checkboxEl.checked) {
                    engine.log(`[Stratégie Adresse] Clic sur 'Adresse Manuelle'`, '☑️');
                    checkboxEl.click();
                    // On ne fait pas de sleep ici ! On attendra simplement que l'input apparaisse via waitForElement
                }

                // 2. Attente intelligente de l'apparition du champ input
                // Le MutationObserver va détecter l'apparition du champ suite au clic précédent
                const inputEl = await engine.waitForElement(inputTargetKey);

                if (!inputEl) {
                    console.warn(`[Stratégie Adresse] Timeout : Champ commune non apparu (${inputTargetKey})`);
                    return 'ABSENT';
                }

                engine.log(`[Stratégie Adresse] Remplissage Commune`, '✍️');
                const success = engine.fillField(inputEl, value);
                return success ? 'OK' : 'KO';
            }
        }
    ],

    // --- 3. NOYAU DU MOTEUR (Réactif) ---

    log: function(msg, emoji = 'ℹ️', data = null) {
        if (this.config.verbose) {
            console.log(`%c[TESTER] ${emoji} ${msg}`, 'color: #cd094f; font-weight: bold;', data || '');
        }
    },

    sleep: function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Cœur de la V6 : Attend l'apparition d'un élément via MutationObserver
     * @param {string} key - La data-clef, l'id ou le name à chercher
     * @returns {Promise<HTMLElement|null>}
     */
    waitForElement: function(key) {
        return new Promise((resolve) => {
            // 1. Vérification immédiate (Fast path)
            const existingEl = this.findElement(key);
            if (existingEl && existingEl.offsetParent !== null) {
                return resolve(existingEl);
            }

            if(this.config.verbose) this.log(`Attente DOM pour '${key}'...`, '👀');

            // 2. Mise en place de l'Observer
            let observer;
            let timer;

            // Fonction de nettoyage
            const cleanup = () => {
                if(observer) observer.disconnect();
                if(timer) clearTimeout(timer);
            };

            // L'observateur qui surveille tout le body
            observer = new MutationObserver((mutations) => {
                // Optimisation : On ne cherche que si on a détecté des ajouts de noeuds
                const hasAddedNodes = mutations.some(m => m.addedNodes.length > 0);
                if (!hasAddedNodes) return;

                const el = this.findElement(key);
                // On vérifie qu'il existe ET qu'il est visible
                if (el && el.offsetParent !== null) {
                    cleanup();
                    resolve(el);
                }
            });

            // Démarrage de l'observation
            observer.observe(document.body, {
                childList: true, // Ajout/Retrait d'enfants directs
                subtree: true    // ... dans toute la descendance
            });

            // 3. Timeout de sécurité (Si le champ n'apparaît jamais)
            timer = setTimeout(() => {
                cleanup();
                // On ne rejette pas la promesse pour ne pas planter le script, on renvoie null
                resolve(null); 
            }, this.config.timeout);
        });
    },

    runPage: async function(scenario) {
        const data = this.prepareData(scenario);
        let actionCount = 0;

        this.log("Démarrage moteur V6 (Réactif)", "🚀");

        for (const [jsonKey, val] of Object.entries(data)) {
            
            const activeStrategy = this.findStrategy(jsonKey, scenario.donnees || scenario);
            let result;

            if (activeStrategy && activeStrategy.customFill) {
                // Délégation stratégie
                result = await activeStrategy.customFill(jsonKey, val, (scenario.donnees || scenario), this);
            } else {
                // Remplissage standard réactif
                // waitForElement remplace la boucle de retry
                const el = await this.waitForElement(jsonKey);
                
                if (el) {
                    if (this.isValueAlreadySet(el, val)) {
                        result = 'SKIPPED';
                    } else {
                        const filled = this.fillField(el, val);
                        result = filled ? 'OK' : 'KO';
                    }
                } else {
                    result = 'ABSENT'; // Timeout atteint
                }
            }
            
            if (result === 'OK') {
                actionCount++;
                if(!activeStrategy) this.log(`Succès '${jsonKey}'`, '✅'); 
                // Petit délai esthétique uniquement (non bloquant pour la logique)
                await this.sleep(this.config.stepDelay);
            } else if (result === 'SKIPPED') {
                this.log(`Ignoré '${jsonKey}'`, '⏭️');
            } else if (result === 'ABSENT') {
                // Optionnel : Loguer les absents pour debug
                // this.log(`Absent '${jsonKey}'`, '❌');
            }
        }
        return actionCount;
    },

    // --- UTILS (Inchangés) ---

    findStrategy: function(key, fullData) {
        const normalizedData = this.normalizeBooleans(fullData);
        return this.strategies.find(s => s.matches(key) && s.isActive(key, normalizedData));
    },

    prepareData: function(input) {
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

    normalizeBooleans: function(data) {
        const out = {};
        for(const [k, v] of Object.entries(data)) {
            out[k] = (v === "true" || v === true) ? true : ((v === "false" || v === false) ? false : v);
        }
        return out;
    },

    findElement: function(key) {
        const container = document.querySelector(`[data-clef="${key}"]`);
        if (container) {
            if (['input','select','textarea'].includes(container.tagName.toLowerCase())) return container;
            return container.querySelector('input, select, textarea');
        }
        return document.querySelector(`#${key}, [name="${key}"]`);
    },

    isValueAlreadySet: function(el, val) {
        if (el.type === 'checkbox' || el.type === 'radio') return el.checked === val;
        return el.value == val; 
    },

    fillField: function(el, val) {
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