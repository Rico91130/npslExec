/**
 * MOTEUR V3.1 - Avec Logs Verbeux
 */
window.FormulaireTester = {
    // Configuration globale
    config: {
        autoNext: false,
        stepDelay: 100,
        verbose: false // Désactivé par défaut
    },

    /**
     * Helper pour logger uniquement si activé
     */
    log: function(msg, emoji = 'ℹ️', data = null) {
        if (this.config.verbose) {
            const prefix = `%c[TESTER] ${emoji}`;
            const style = 'color: #cd094f; font-weight: bold;';
            if (data) console.log(prefix + ' ' + msg, style, data);
            else console.log(prefix + ' ' + msg, style);
        }
    },

    runPage: async function(scenario) {
        const data = this.prepareData(scenario);
        let actionCount = 0;

        // Analyse du DOM
        const visibleInputs = document.querySelectorAll('input, select, textarea');
        const visibleKeys = new Set();
        visibleInputs.forEach(el => {
            const container = el.closest('[data-clef]');
            if(container) visibleKeys.add(container.getAttribute('data-clef'));
            if(el.id) visibleKeys.add(el.id);
            if(el.name) visibleKeys.add(el.name);
        });

        this.log(`Analyse de la page : ${visibleKeys.size} champs interactifs détectés.`, '🔍', [...visibleKeys]);

        for (const [key, val] of Object.entries(data)) {
            // Check visibilité
            if (this.isKeyVisible(key, visibleKeys)) {
                this.log(`Tentative de remplissage pour '${key}'...`, '👉');
                const result = await this.tryFill(key, val);
                
                if (result === 'OK') {
                    actionCount++;
                    this.log(`Succès pour '${key}'`, '✅');
                } else if (result === 'SKIPPED') {
                    this.log(`Ignoré '${key}' (Déjà rempli ou identique)`, '⏭️');
                } else {
                    this.log(`Échec pour '${key}' (Technique)`, '❌');
                }
            } else {
                // Utile pour savoir quels champs du scénario sont "hors scope"
                // this.log(`Champ '${key}' non visible sur cette page.`, '👻'); 
            }
        }
        
        return actionCount;
    },

    isKeyVisible: function(key, set) {
        if (set.has(key)) return true;
        for (let k of set) {
            if (key.startsWith(k)) return true;
        }
        return false;
    },

    prepareData: function(input) {
        let data = input.donnees ? input.donnees : input;
        let clean = {};
        for (const [key, val] of Object.entries(data)) {
            if (val === null || val === "") continue;
            let k = key.endsWith('_libelle') ? key.replace('_libelle', '') : key;
            if (key.endsWith('_valeur') && data[key.replace('_valeur', '_libelle')]) continue;
            let v = val === "true" ? true : (val === "false" ? false : val);
            clean[k] = v;
        }
        return clean;
    },

    tryFill: function(key, val) {
        return new Promise((resolve) => {
            const container = document.querySelector(`[data-clef="${key}"], [data-testid="${key}"]`);
            let field = container ? container.querySelector('input, select, textarea') : null;
            if (!field) field = document.querySelector(`#${key}, [name="${key}"]`);

            if (field && field.offsetParent !== null) {
                if (this.isValueAlreadySet(field, val)) {
                     resolve('SKIPPED');
                     return;
                }
                
                if (this.fillField(field, val)) {
                    setTimeout(() => resolve('OK'), this.config.stepDelay);
                } else {
                    resolve('KO');
                }
            } else {
                this.log(`Champ '${key}' trouvé mais invisible ou inaccessible.`, '⚠️');
                resolve('ABSENT');
            }
        });
    },

    isValueAlreadySet: function(el, val) {
        if (el.type === 'checkbox' || el.type === 'radio') return el.checked === val;
        // Comparaison souple pour gérer les conversions string/number
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
                        // Log précis pour les selects (souvent source d'erreur)
                        this.log(`Option sélectionnée : "${el.options[i].text}" (index ${i})`, '🔽');
                        break;
                    }
                }
                if (found) el.dispatchEvent(new Event('change', { bubbles: true }));
                else this.log(`Aucune option contenant "${val}" trouvée dans le select.`, '⚠️');
            } else {
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
            el.blur();
            return true;
        } catch (e) { 
            this.log(`Exception lors du remplissage : ${e.message}`, '🔥');
            return false; 
        }
    }
};
