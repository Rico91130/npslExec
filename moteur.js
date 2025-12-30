/**
 * MOTEUR V8.1 - Temporisation & Normalisation des Données
 */
window.FormulaireTester = {
    abort: false,
    // J'ai passé le stepDelay à 200ms par défaut pour plus de sécurité
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

    // Fonction utilitaire pour tout nettoyer d'un coup
    normalizeData: function(data) {
        const out = {};
        for(const [k, v] of Object.entries(data)) {
            // Conversion "true"/"false" -> true/false
            if (v === "true" || v === true) out[k] = true;
            else if (v === "false" || v === false) out[k] = false;
            else out[k] = v;
        }
        return out;
    },

    prepareData: function (input) {
        // On travaille déjà sur des données normalisées par runPage
        let fullData = input; 
        let clean = {};
        
        // Nettoyage via les stratégies
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
            
            // 1. CORRECTION IMPORTANTE : On normalise TOUT le jeu de données dès l'entrée
            const raw = scenario.donnees || scenario;
            this.fullScenarioData = this.normalizeData(raw);
            this.pendingData = this.prepareData(this.fullScenarioData);

            let report = []; 
            let touchedKeys = new Set();
            let silenceTimer = null;
            let observer = null;

            this.log(`Démarrage V8.1 (Delay: ${this.config.stepDelay}ms).`, "🚀");

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

            const scanAndFill = async () => {
                if (this.abort) { finish("Arrêt Utilisateur"); return; }

                let activityDetected = false;
                const keysToRemove = [];

                for (const [key, value] of Object.entries(this.pendingData)) {
                    
                    const element = this.findElement(key);
                    
                    if (!element || element.offsetParent === null) continue; 

                    const strategy = this.resolveStrategy(key, element, this.fullScenarioData);
                    let status = 'ABSENT';
                    
                    if (strategy) {
                        try {
                            status = await strategy.execute(element, value, this.fullScenarioData, this);
                        } catch (e) {
                            console.error(`Erreur stratégie ${strategy.id} sur ${key}:`, e);
                            status = 'KO';
                        }
                    } else {
                        status = 'KO';
                    }

                    if (status === 'OK') {
                        this.log(`Rempli [${strategy.id}] : ${key}`, '✅');
                        report.push({ key: key, status: 'OK', time: new Date().toLocaleTimeString() });
                        touchedKeys.add(key); 
                        activityDetected = true;
                        keysToRemove.push(key);

                        // --- 2. AJOUT DE LA TEMPORISATION DEMANDÉE ---
                        // On attend un peu après chaque succès pour laisser la page respirer
                        await this.sleep(this.config.stepDelay); 

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