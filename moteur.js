/**
 * MOTEUR V8.0 - Architecture "Resolver" (Délégation Totale)
 * Le moteur ne sait plus remplir un champ, il ne sait que déléguer.
 */
window.FormulaireTester = {
    abort: false,
    config: { verbose: true, inactivityTimeout: 2000, stepDelay: 50 },
    strategies: [], // Peuplé par strategies.js

    // --- UTILS ---
    log: function (msg, emoji = 'ℹ️', data = null) { 
        if (this.config.verbose) console.log(`%c[TESTER] ${emoji} ${msg}`, 'color: #cd094f; font-weight: bold;', data || ''); 
    },
    sleep: function(ms) { return new Promise(resolve => setTimeout(resolve, ms)); },

    // Fonction de recherche améliorée pour gérer les groupes
    findElement: function (key) {
        // 1. Recherche par data-clef (Standard App)
        const container = document.querySelector(`[data-clef="${key}"]`);
        if (container) {
            // Si le container est lui-même un champ
            if (['input', 'select', 'textarea'].includes(container.tagName.toLowerCase())) return container;
            // Sinon on cherche dedans
            return container.querySelector('input, select, textarea');
        }
        // 2. Fallback classique (Name / ID)
        return document.querySelector(`#${key}, [name="${key}"]`);
    },

    /**
     * COEUR DU SYSTÈME V8 : LE RESOLVER
     * Trouve la stratégie adaptée pour un élément donné
     */
    resolveStrategy: function(key, element, fullData) {
        if (!this.strategies || this.strategies.length === 0) return null;
        
        // On parcourt les stratégies dans l'ordre (Métier -> Spécifique -> Générique)
        for (const strategy of this.strategies) {
            // Une stratégie peut avoir une condition 'isActive' optionnelle (pour le métier)
            const isActive = strategy.isActive ? strategy.isActive(key, fullData) : true;
            
            if (isActive && strategy.matches(key, element, fullData)) {
                return strategy;
            }
        }
        return null;
    },

    prepareData: function (input) {
        let rawData = input.donnees ? input.donnees : input;
        let clean = {};
        
        // Normalisation Booléens
        const fullData = {};
        for(const [k,v] of Object.entries(rawData)) {
            fullData[k] = (v === "true" || v === true) ? true : ((v === "false" || v === false) ? false : v);
        }

        // Nettoyage via les stratégies (si elles définissent getIgnoredKeys)
        let keysToIgnore = new Set();
        if (this.strategies) {
            Object.keys(fullData).forEach(key => {
                // Pour trouver la stratégie ici, on a besoin de l'élément ? 
                // Pas forcément, les stratégies métier matchent souvent sur la clé seule.
                // On tente une résolution sans élément pour le nettoyage statique
                const strategy = this.resolveStrategy(key, null, fullData);
                if (strategy && strategy.getIgnoredKeys) {
                    strategy.getIgnoredKeys(key).forEach(k => keysToIgnore.add(k));
                }
            });
        }

        for (const [key, val] of Object.entries(fullData)) {
            if (val === null || val === "") continue;
            if (keysToIgnore.has(key)) continue;
            
            let finalKey = key;
            if (key.endsWith('_libelle')) finalKey = key.replace('_libelle', '');
            if (key.endsWith('_valeur') && fullData[key.replace('_valeur', '_libelle')]) continue;
            
            clean[finalKey] = val;
        }
        return clean;
    },

    /**
     * BOUCLE PRINCIPALE (RUNNER)
     */
    runPage: function (scenario) {
        return new Promise((resolve, reject) => {
            this.abort = false;
            this.pendingData = this.prepareData(scenario);
            this.fullScenarioData = scenario.donnees || scenario; // Raw data pour context

            let report = []; 
            let touchedKeys = new Set();
            let silenceTimer = null;
            let observer = null;

            this.log(`Démarrage V8.0 (Architecture Resolver).`, "🚀");

            const finish = (reason) => {
                if (observer) observer.disconnect();
                if (silenceTimer) clearTimeout(silenceTimer);
                
                // Analyse Gap (Untouched)
                const allDomKeys = new Set();
                document.querySelectorAll('[data-clef]').forEach(el => {
                    if(el.offsetParent !== null) allDomKeys.add(el.getAttribute('data-clef'));
                });
                const untouched = Array.from(allDomKeys).filter(domKey => {
                    if (touchedKeys.has(domKey)) return false;
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
                    untouched: untouched 
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
                    
                    // 1. Recherche de l'élément DOM
                    const element = this.findElement(key);
                    
                    // Si pas d'élément, on ne peut rien faire (sauf si une stratégie métier pure existe, mais rare)
                    if (!element || element.offsetParent === null) {
                        // Element absent ou invisible
                        continue; 
                    }

                    // 2. Résolution de la Stratégie
                    const strategy = this.resolveStrategy(key, element, this.fullScenarioData);

                    let status = 'ABSENT';
                    
                    if (strategy) {
                        // 3. Exécution de la stratégie
                        // Note: C'est ici que toute la magie opère
                        try {
                            status = await strategy.execute(element, value, this.fullScenarioData, this);
                        } catch (e) {
                            console.error(`Erreur stratégie ${strategy.id} sur ${key}:`, e);
                            status = 'KO';
                        }
                    } else {
                        // Aucune stratégie trouvée (même pas Default Input ?)
                        // Cela ne devrait pas arriver si Native_Input_Default est bien chargé.
                        this.log(`Aucune stratégie pour ${key} (${element.tagName})`, '❓');
                        status = 'KO';
                    }

                    // 4. Traitement du résultat
                    if (status === 'OK') {
                        this.log(`Rempli [${strategy.id}] : ${key}`, '✅');
                        report.push({ key: key, status: 'OK', time: new Date().toLocaleTimeString() });
                        touchedKeys.add(key); 
                        activityDetected = true;
                        keysToRemove.push(key);
                    } else if (status === 'SKIPPED') {
                        this.log(`Déjà fait : ${key}`, '⏭️');
                        report.push({ key: key, status: 'SKIPPED', time: new Date().toLocaleTimeString() });
                        touchedKeys.add(key); 
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
    }
};