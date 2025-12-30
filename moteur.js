/**
 * MOTEUR V8.2 - Thread Safe (Verrouillage Mutex)
 * Empêche l'exécution multiple lors des mutations DOM rapides.
 */
window.FormulaireTester = {
    abort: false,
    config: { verbose: true, inactivityTimeout: 2000, stepDelay: 200 },
    strategies: [], 

    // --- UTILS ---
    log: function (msg, emoji = 'ℹ️', data = null) { 
        if (this.config.verbose) console.log(`%c[TESTER] ${emoji} ${msg}`, 'color: #cd094f; font-weight: bold;', data || ''); 
    },
    sleep: function(ms) { return new Promise(resolve => setTimeout(resolve, ms)); },

    findElement: function (key) {
        const container = document.querySelector(`[data-clef="${key}"]`);
        if (container) {
            if (['input', 'select', 'textarea'].includes(container.tagName.toLowerCase())) return container;
            return container.querySelector('input, select, textarea');
        }
        return document.querySelector(`#${key}, [name="${key}"]`);
    },

    resolveStrategy: function(key, element, fullData) {
        if (!this.strategies || this.strategies.length === 0) return null;
        for (const strategy of this.strategies) {
            const isActive = strategy.isActive ? strategy.isActive(key, fullData) : true;
            if (isActive && strategy.matches(key, element, fullData)) {
                return strategy;
            }
        }
        return null;
    },

    normalizeData: function(data) {
        const out = {};
        for(const [k, v] of Object.entries(data)) {
            if (v === "true" || v === true) out[k] = true;
            else if (v === "false" || v === false) out[k] = false;
            else out[k] = v;
        }
        return out;
    },

    prepareData: function (input) {
        let fullData = input; 
        let clean = {};
        
        let keysToIgnore = new Set();
        if (this.strategies) {
            Object.keys(fullData).forEach(key => {
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
     * BOUCLE PRINCIPALE
     */
    runPage: function (scenario) {
        return new Promise((resolve, reject) => {
            this.abort = false;
            
            const raw = scenario.donnees || scenario;
            this.fullScenarioData = this.normalizeData(raw);
            this.pendingData = this.prepareData(this.fullScenarioData);

            let report = []; 
            let touchedKeys = new Set();
            let silenceTimer = null;
            let observer = null;

            // --- VARIABLES DE VERROUILLAGE (NOUVEAU) ---
            let isScanning = false;      // "La porte est fermée ?"
            let restartRequested = false; // "Quelqu'un a sonné pendant que j'étais occupé ?"

            this.log(`Démarrage V8.2 (Thread Safe).`, "🚀");

            const finish = (reason) => {
                if (observer) observer.disconnect();
                if (silenceTimer) clearTimeout(silenceTimer);
                
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

            // --- FONCTION PRINCIPALE SÉCURISÉE ---
            const scanAndFill = async () => {
                // 1. LE PORTIER : Si on bosse déjà, on note juste qu'il faudra repasser
                if (isScanning) {
                    restartRequested = true;
                    return;
                }
                
                // On verrouille
                isScanning = true;
                restartRequested = false;

                if (this.abort) { finish("Arrêt Utilisateur"); return; }

                let activityDetected = false;
                
                // On copie les clés car on va modifier l'objet pendant la boucle
                const currentKeys = Object.keys(this.pendingData);

                for (const key of currentKeys) {
                    // Vérif de sécurité : la clé est-elle toujours là ?
                    if (!this.pendingData[key]) continue; 

                    const value = this.pendingData[key];
                    const element = this.findElement(key);
                    
                    if (!element || element.offsetParent === null) continue; 

                    const strategy = this.resolveStrategy(key, element, this.fullScenarioData);
                    let status = 'ABSENT';
                    
                    if (strategy) {
                        try {
                            status = await strategy.execute(element, value, key, this.fullScenarioData, this);
                        } catch (e) {
                            console.error(`Erreur stratégie ${strategy.id} sur ${key}:`, e);
                            status = 'KO';
                        }
                    } else {
                        // Pas de stratégie trouvée (bizarre avec les defaults, mais possible)
                        // On laisse couler pour l'instant
                    }

                    if (status === 'OK') {
                        this.log(`Rempli [${strategy.id}] : ${key}`, '✅');
                        report.push({ key: key, status: 'OK', time: new Date().toLocaleTimeString() });
                        touchedKeys.add(key); 
                        activityDetected = true;
                        
                        // NETTOYAGE IMMÉDIAT (Pour éviter les doublons de logs)
                        delete this.pendingData[key];

                        // Pause respiration
                        await this.sleep(this.config.stepDelay); 

                    } else if (status === 'SKIPPED') {
                        this.log(`Déjà fait : ${key}`, '⏭️');
                        report.push({ key: key, status: 'SKIPPED', time: new Date().toLocaleTimeString() });
                        touchedKeys.add(key); 
                        
                        // NETTOYAGE IMMÉDIAT
                        delete this.pendingData[key];

                    } else if (status === 'PENDING') {
                        // On ne supprime pas la clé, on attend
                        activityDetected = true;
                    }
                }

                // Fin du tour
                isScanning = false;

                if (Object.keys(this.pendingData).length === 0) {
                    finish("Succès - Plus de données");
                    return;
                }

                // Si activité détectée, on repousse le timeout global
                if (activityDetected) bumpTimer();

                // Si le DOM a bougé PENDANT notre travail, on relance un tour immédiatement
                if (restartRequested) {
                    // Petit délai pour ne pas saturer le CPU si ça bouge non-stop
                    setTimeout(scanAndFill, 50);
                }
            };

            // L'Observer appelle bumpTimer (pour ne pas mourir) et tente de lancer scanAndFill
            observer = new MutationObserver((mutations) => {
                const relevant = mutations.some(m => m.type === 'childList' && m.addedNodes.length > 0 || m.type === 'attributes');
                if (relevant) { 
                    bumpTimer(); 
                    scanAndFill(); // Sera bloqué par le verrou si déjà en cours
                }
            });

            observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'disabled', 'hidden'] });
            
            bumpTimer();
            scanAndFill();
        });
    }
};