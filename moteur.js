/**
 * MOTEUR V3 - Pilotable par Toolbar
 */
window.FormulaireTester = {
    // Configuration globale
    config: {
        autoNext: false,
        stepDelay: 100
    },

    /**
     * Exécute le remplissage pour la PAGE COURANTE seulement
     * Retourne true si des champs ont été modifiés
     */
    runPage: async function(scenario) {
        // Préparation des données (nettoyage brouillon)
        const data = this.prepareData(scenario);
        let actionCount = 0;

        // On ne boucle que sur les champs VISIBLES dans le DOM actuel
        // Cela évite d'attendre des champs qui sont sur d'autres pages
        const visibleInputs = document.querySelectorAll('input, select, textarea');
        
        // On crée un map des champs visibles pour aller vite
        const visibleKeys = new Set();
        visibleInputs.forEach(el => {
            // On remonte au conteneur data-clef si possible
            const container = el.closest('[data-clef]');
            if(container) visibleKeys.add(container.getAttribute('data-clef'));
            if(el.id) visibleKeys.add(el.id);
            if(el.name) visibleKeys.add(el.name);
        });

        console.log(`🔎 Analyse page : ${visibleKeys.size} champs détectés.`);

        for (const [key, val] of Object.entries(data)) {
            // Optimisation : on ne tente de remplir que si la clé semble présente visuellement
            if (this.isKeyVisible(key, visibleKeys)) {
                const result = await this.tryFill(key, val);
                if (result === 'OK') actionCount++;
            }
        }
        
        return actionCount;
    },

    isKeyVisible: function(key, set) {
        // Recherche exacte ou partielle simple
        if (set.has(key)) return true;
        // Pour les adresses complexes (ex: adresseDeclarant_voie...), on vérifie le préfixe
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

            if (field && field.offsetParent !== null) { // Visible uniquement
                // Vérification si déjà rempli pour ne pas spammer
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
                resolve('ABSENT');
            }
        });
    },

    isValueAlreadySet: function(el, val) {
        if (el.type === 'checkbox' || el.type === 'radio') return el.checked === val;
        return el.value == val; // Loose equality pour "12" vs 12
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
