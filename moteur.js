/**
 * MOTEUR V7.2 - Retourne un rapport détaillé pour la Toolbar
 */
window.FormulaireTester = {
    abort: false,
    config: { verbose: true, inactivityTimeout: 2000, stepDelay: 50 },

    // ... (Garder les STRATÉGIES inchangées) ...
    strategies: [ /* ... copie tes stratégies ici ... */ ],

    // ... (Garder LOG et SLEEP inchangés) ...
    log: function (msg, emoji = 'ℹ️', data = null) { if (this.config.verbose) console.log(`%c[TESTER] ${emoji} ${msg}`, 'color: #cd094f; font-weight: bold;', data || ''); },
    sleep: function(ms) { return new Promise(resolve => setTimeout(resolve, ms)); },

    /**
     * Point d'entrée principal
     */
    runPage: function (scenario) {
        return new Promise((resolve, reject) => {
            this.abort = false;
            this.pendingData = this.prepareData(scenario);
            this.fullScenarioData = scenario.donnees || scenario; 

            // CHANGEMENT V7.2 : On stocke l'historique des actions
            let report = []; // [{ key: 'nom', status: 'OK', msg: 'Rempli' }, ...]
            let silenceTimer = null;
            let observer = null;

            this.log(`Démarrage V7.2.`, "🚀");

            const finish = (reason) => {
                if (observer) observer.disconnect();
                if (silenceTimer) clearTimeout(silenceTimer);
                this.log(`Terminé (${reason}).`, "🏁");
                // CHANGEMENT V7.2 : On renvoie l'objet rapport complet
                resolve({ 
                    totalFilled: report.filter(x => x.status === 'OK').length,
                    reason: reason,
                    details: report 
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

                    // CHANGEMENT V7.2 : Construction du rapport
                    if (status === 'OK') {
                        this.log(`Rempli : ${key}`, '✅');
                        report.push({ key: key, status: 'OK', time: new Date().toLocaleTimeString() });
                        activityDetected = true;
                        keysToRemove.push(key);
                    } else if (status === 'SKIPPED') {
                        this.log(`Déjà fait : ${key}`, '⏭️');
                        report.push({ key: key, status: 'SKIPPED', time: new Date().toLocaleTimeString() });
                        keysToRemove.push(key); 
                    } else if (status === 'PENDING') {
                        activityDetected = true;
                    }
                    // 'ABSENT' n'est pas logué dans le rapport final pour ne pas polluer (car c'est temporaire)
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