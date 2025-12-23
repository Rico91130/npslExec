/**
 * MOTEUR V6.1 - Réactif (MutationObserver) + Gestion Arrêt (Stop)
 */
window.FormulaireTester = {
    
    // Flag de contrôle (piloté par la Toolbar)
    abort: false,

    // --- 1. CONFIGURATION ---
    
    config: {
        verbose: true,
        stepDelay: 100,       // Délai esthétique
        timeout: 3000         // Temps max d'attente (300ms était un peu court, je remets 3s par sécurité, ou tu peux mettre 300)
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
                // Check STOP avant de commencer une stratégie longue
                if(engine.abort) return 'SKIPPED';

                const prefix = key.split('_communeActuelleAdresseManuelle_nomLong')[0];
                const checkboxKey = `${prefix}_utiliserAdresseManuelle`;
                const inputTargetKey = key.replace('_nomLong', ''); 

                engine.log(`[Stratégie Adresse] Activation pour ${prefix}`, '🏠');

                // 1. Gestion Case à cocher
                const checkboxEl = await engine.waitForElement(checkboxKey);
                if (checkboxEl && !checkboxEl.checked) {
                    engine.log(`[Stratégie Adresse] Clic sur 'Adresse Manuelle'`, '☑️');
                    checkboxEl.click();
                }

                // Check STOP pendant l'exécution
                if(engine.abort) return 'SKIPPED';

                // 2. Attente intelligente
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

    waitForElement: function(key) {
        return new Promise((resolve) => {
            // Check immédiat
            const existingEl = this.findElement(key);
            if (existingEl && existingEl.offsetParent !== null) {
                return resolve(existingEl);
            }

            // Si on a demandé l'arrêt, inutile d'attendre
            if (this.abort) return resolve(null);

            if(this.config.verbose) this.log(`Attente DOM pour '${key}'...`, '👀');

            let observer;
            let timer;

            const cleanup = () => {
                if(observer) observer.disconnect();
                if(timer) clearTimeout(timer);
            };

            observer = new MutationObserver((mutations) => {
                // Check Stop constant
                if (this.abort) { cleanup(); return resolve(null); }

                const hasAddedNodes = mutations.some(m => m.addedNodes.length > 0);
                if (!hasAddedNodes) return;

                const el = this.findElement(key);
                if (el && el.offsetParent !== null) {
                    cleanup();
                    resolve(el);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            timer = setTimeout(() => {
                cleanup();
                resolve(null); 
            }, this.config.timeout);
        });
    },

    /**
     * Point d'entrée principal
     */
    runPage: async function(scenario) {
        const data = this.prepareData(scenario);
        let actionCount = 0;

        this.log("Démarrage moteur V6.1 (Réactif + Stop)", "🚀");

        for (const [jsonKey, val] of Object.entries(data)) {
            
            // --- C'EST ICI QUE LA MAGIE OPÈRE ---
            if (this.abort) {
                this.log("🛑 Exécution interrompue par l'utilisateur.");
                break; // On sort de la boucle immédiatement
            }
            // ------------------------------------

            const activeStrategy = this.findStrategy(jsonKey, scenario.donnees || scenario);
            let result;

            if (activeStrategy && activeStrategy.customFill) {
                result = await activeStrategy.customFill(jsonKey, val, (scenario.donnees || scenario), this);
            } else {
                const el = await this.waitForElement(jsonKey);
                
                // Double check après l'attente (au cas où on a cliqué stop pendant l'attente)
                if (this.abort) break;

                if (el) {
                    if (this.isValueAlreadySet(el, val)) {
                        result = 'SKIPPED';
                    } else {
                        const filled = this.fillField(el, val);
                        result = filled ? 'OK' : 'KO';
                    }
                } else {
                    result = 'ABSENT'; 
                }
            }
            
            if (result === 'OK') {
                actionCount++;
                if(!activeStrategy) this.log(`Succès '${jsonKey}'`, '✅'); 
                await this.sleep(this.config.stepDelay);
            } else if (result === 'SKIPPED') {
                this.log(`Ignoré '${jsonKey}'`, '⏭️');
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