/**
 * MOTEUR V5.0 - Stratégies Avancées avec "Custom Fill" (Gestion des Composants Riches)
 */
window.FormulaireTester = {
    
    // --- 1. CONFIGURATION & STRATÉGIES ---
    
    config: {
        verbose: true,       // Utile pour debugger les composants riches
        stepDelay: 300,      // Pause après action
        retryAttempts: 10,
        retryInterval: 200
    },

    /**
     * REGISTRE DES STRATÉGIES (C'est ici qu'on externalise la logique métier)
     */
    strategies: [
        {
            id: 'AdresseBanOuManuelle_SaisieManuelle',
            description: 'Gère le composant Adresse en mode manuel (Check + Remplissage Commune)',
            
            // 1. DÉTECTION : On s'active si la clé est le "Nom Long" d'une commune manuelle
            matches: (key) => key.endsWith('_communeActuelleAdresseManuelle_nomLong'),
            
            // 2. ACTIVATION : On vérifie si le flag "utiliserAdresseManuelle" est à TRUE dans les données
            isActive: (key, fullData) => {
                const prefix = key.split('_communeActuelleAdresseManuelle_nomLong')[0];
                return fullData[`${prefix}_utiliserAdresseManuelle`] === true;
            },

            // 3. NETTOYAGE : On supprime les clés techniques parasites du JSON
            getIgnoredKeys: (key) => {
                const base = key.replace('_nomLong', ''); 
                // On garde la main sur le remplissage, on ignore les sous-clés techniques
                return ['_nom', '_codeInsee', '_codePostal', '_codeInseeDepartement', '_id', '_nomProtecteur', '_typeProtection']
                       .map(suffix => base + suffix);
            },

            // 4. ACTION PERSONNALISÉE (Le coeur de ta demande)
            // Au lieu de laisser le moteur faire un simple fillField, on prend le contrôle.
            customFill: async function(key, value, fullData, engine) {
                // A. Reconstitution des clés
                const prefix = key.split('_communeActuelleAdresseManuelle_nomLong')[0];
                const checkboxKey = `${prefix}_utiliserAdresseManuelle`;
                const inputTargetKey = key.replace('_nomLong', ''); // La clé du champ input (data-clef)

                engine.log(`[Stratégie Adresse] Activation pour ${prefix}`, '🏠');

                // B. Gestion de la Case à cocher (Pré-requis)
                // On cherche la case à cocher via sa clé
                const checkboxEl = engine.findElement(checkboxKey);
                if (checkboxEl && !checkboxEl.checked) {
                    engine.log(`[Stratégie Adresse] Clic forcé sur la case 'Adresse Manuelle'`, '☑️');
                    checkboxEl.click();
                    // Petit délai pour laisser le temps au DOM d'afficher les champs manuels (Angular/React)
                    await engine.sleep(500); 
                }

                // C. Recherche du champ Input Commune
                // On utilise la méthode standard du moteur pour bénéficier du Retry
                let inputEl = null;
                for(let i=0; i<5; i++) { // Mini boucle de retry interne
                    inputEl = engine.findElement(inputTargetKey);
                    if(inputEl && inputEl.offsetParent !== null) break;
                    await engine.sleep(200);
                }

                if (!inputEl) {
                    console.warn(`[Stratégie Adresse] Champ commune introuvable : ${inputTargetKey}`);
                    return 'ABSENT';
                }

                // D. Remplissage avec la valeur du _nomLong
                engine.log(`[Stratégie Adresse] Remplissage Commune avec "${value}"`, '✍️');
                const success = engine.fillField(inputEl, value);
                return success ? 'OK' : 'KO';
            }
        }
    ],


    // --- 2. NOYAU DU MOTEUR ---

    log: function(msg, emoji = 'ℹ️', data = null) {
        if (this.config.verbose) {
            const prefix = `%c[TESTER] ${emoji}`;
            const style = 'color: #cd094f; font-weight: bold;';
            console.log(`${prefix} ${msg}`, style, data || '');
        }
    },

    sleep: function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Point d'entrée principal
     */
    runPage: async function(scenario) {
        const data = this.prepareData(scenario);
        let actionCount = 0;

        // On garde le log pour info, mais on ne l'utilise plus pour filtrer
        let visibleSnapshot = this.scanVisibleKeys();
        this.log(`Démarrage : ${visibleSnapshot.size} champs détectés.`, '🔍');

        for (const [jsonKey, val] of Object.entries(data)) {
            
            // 1. Résolution de la Stratégie
            const activeStrategy = this.findStrategy(jsonKey, scenario.donnees || scenario);
                       
            let result;

            if (activeStrategy && activeStrategy.customFill) {
                // -> DÉLÉGATION À LA STRATÉGIE
                result = await activeStrategy.customFill(jsonKey, val, (scenario.donnees || scenario), this);
            } else {
                // -> REMPLISSAGE STANDARD
                // C'est "tryFill" qui s'occupera d'attendre (retry) si le champ n'est pas encore là.
                console.log(jsonKey);
                result = await this.tryFill(jsonKey, val);
            }
            
            if (result === 'OK') {
                actionCount++;
                if(!activeStrategy) this.log(`Succès pour '${jsonKey}'`, '✅'); 
                
                // On met à jour le snapshot juste pour le debug ou les futurs besoins
                visibleSnapshot = this.scanVisibleKeys(); 
                
                // La temporisation est bien conservée ici
                await this.sleep(this.config.stepDelay);
            } else if (result === 'SKIPPED') {
                this.log(`Ignoré '${jsonKey}' (Déjà fait)`, '⏭️');
            }
            // Si result === 'ABSENT' ou 'KO', on continue simplement vers le champ suivant
            // après avoir attendu le temps du retry (par défaut 2 secondes).
        }
        return actionCount;
    },

    /**
     * Trouve la stratégie applicable pour une clé donnée
     */
    findStrategy: function(key, fullData) {
        // Normalisation rapide pour les checks booléens
        const normalizedData = this.normalizeBooleans(fullData);
        return this.strategies.find(s => s.matches(key) && s.isActive(key, normalizedData));
    },

    /**
     * Prépare les données et nettoie via les stratégies
     */
    prepareData: function(input) {
        let rawData = input.donnees ? input.donnees : input;
        let clean = {};
        const fullRawData = this.normalizeBooleans(rawData);

        // Identification des clés à ignorer
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

    // --- 3. DOM & INTERACTION (Standard) ---

    scanVisibleKeys: function() {
        const set = new Set();
        document.querySelectorAll('input, select, textarea').forEach(el => {
            const container = el.closest('[data-clef]');
            if(container) set.add(container.getAttribute('data-clef'));
            if(el.id) set.add(el.id);
            if(el.name) set.add(el.name);
        });
        return set;
    },

    isKeyLikelyVisible: function(key, set) {
        if (set.has(key)) return true;
        for (let visibleKey of set) {
            if (key.startsWith(visibleKey)) return true;
        }
        if (set.size === 0) return true; // Page vierge au chargement
        return false;
    },

    findElement: function(key) {
        // Priorité 1 : data-clef exact (Le plus robuste pour ton app)
        const container = document.querySelector(`[data-clef="${key}"]`);
        if (container) {
            if (['input','select','textarea'].includes(container.tagName.toLowerCase())) return container;
            return container.querySelector('input, select, textarea');
        }
        // Priorité 2 : Attributs standards
        return document.querySelector(`#${key}, [name="${key}"]`);
    },

    tryFill: async function(key, val) {
        let field = null;
        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            field = this.findElement(key);
            if (field && field.offsetParent !== null) break;
            if (attempt < this.config.retryAttempts) await this.sleep(this.config.retryInterval);
        }

        if (field && field.offsetParent !== null) {
            if (this.isValueAlreadySet(field, val)) return 'SKIPPED';
            if (this.fillField(field, val)) return 'OK';
            return 'KO';
        }
        return 'ABSENT';
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