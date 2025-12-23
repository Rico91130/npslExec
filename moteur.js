/**
 * MOTEUR V3.2 - Gestion de la Temporisation et des Apparitions dynamiques
 */
window.FormulaireTester = {
    // Configuration globale
    config: {
        verbose: false,      // Logs détaillés
        stepDelay: 300,      // Pause SYSTÉMATIQUE après chaque remplissage (ms)
        retryAttempts: 10,   // Combien de fois on cherche un champ manquant
        retryInterval: 200   // Temps entre deux recherches (ms) -> Total max = 2 sec
    },

    log: function(msg, emoji = 'ℹ️', data = null) {
        if (this.config.verbose) {
            const prefix = `%c[TESTER] ${emoji}`;
            const style = 'color: #cd094f; font-weight: bold;';
            if (data) console.log(prefix + ' ' + msg, style, data);
            else console.log(prefix + ' ' + msg, style);
        }
    },

    /**
     * Utilitaire de pause (Promise)
     */
    sleep: function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    runPage: async function(scenario) {
        const data = this.prepareData(scenario);
        let actionCount = 0;

        // 1. Première analyse de la page
        let visibleSnapshot = this.scanVisibleKeys();
        this.log(`Analyse initiale : ${visibleSnapshot.size} champs visibles.`, '🔍');

        for (const [key, val] of Object.entries(data)) {
            // 2. Vérification de visibilité (basée sur le snapshot courant)
            const isVisible = this.isKeyLikelyVisible(key, visibleSnapshot);
            
            if (isVisible) {
                const result = await this.tryFill(key, val);
                
                if (result === 'OK') {
                    actionCount++;
                    this.log(`Succès pour '${key}'`, '✅');

                    // --- CORRECTION MAJEURE ICI ---
                    // Une action a eu lieu, le DOM a pu changer (nouveaux champs apparus).
                    // On met à jour la photo des champs visibles pour la suite de la boucle.
                    visibleSnapshot = this.scanVisibleKeys(); 
                    // ------------------------------
                    
                } else if (result === 'SKIPPED') {
                    this.log(`Ignoré '${key}' (Déjà rempli)`, '⏭️');
                }
            }
        }
        
        return actionCount;
    },
    
    /**
     * Recherche un élément dans le DOM
     */
    findElement: function(key) {
        const container = document.querySelector(`[data-clef="${key}"], [data-testid="${key}"]`);
        let field = container ? container.querySelector('input, select, textarea') : null;
        if (!field) field = document.querySelector(`#${key}, [name="${key}"]`);
        return field;
    },

    /**
     * Tente de remplir un champ avec mécanisme de RÉESSAI (Retry)
     */
    tryFill: async function(key, val) {
        let field = null;

        // BOUCLE DE RETRY (C'est ici qu'on gère l'apparition retardée)
        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            field = this.findElement(key);

            // Condition de sortie : Champ trouvé ET visible
            if (field && field.offsetParent !== null) {
                break;
            }

            // Si pas trouvé, on attend un peu (sauf au dernier essai)
            if (attempt < this.config.retryAttempts) {
                // On ne loggue l'attente que si on est en mode verbeux pour ne pas polluer
                if(attempt === 1 && this.config.verbose) this.log(`Attente apparition '${key}'...`, '⏳');
                await this.sleep(this.config.retryInterval);
            }
        }

        if (field && field.offsetParent !== null) {
            // Vérification si déjà rempli
            if (this.isValueAlreadySet(field, val)) {
                 return 'SKIPPED';
            }
            
            // Remplissage effectif
            if (this.fillField(field, val)) {
                // PAUSE DE SÉCURITÉ APRÈS ÉCRITURE (Important pour Angular)
                await this.sleep(this.config.stepDelay);
                return 'OK';
            } else {
                return 'KO';
            }
        } else {
            return 'ABSENT';
        }
    },

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
        // 1. Exact match
        if (set.has(key)) return true;
        
        // 2. Dépendance probable (ex: 'adresse' est visible, donc 'adresse_rue' peut l'être bientôt)
        // On vérifie si un préfixe de la clé existe déjà dans les éléments visibles
        for (let visibleKey of set) {
            if (key.startsWith(visibleKey)) return true; // ex: visibleKey='adresse', key='adresse_numero'
        }
        
        // 3. Si le set est vide (page vierge chargée), on tente tout
        if (set.size === 0) return true;

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
                        this.log(`Select '${el.name||el.id}' -> "${el.options[i].text}"`, '🔽');
                        break;
                    }
                }
                if (found) el.dispatchEvent(new Event('change', { bubbles: true }));
                else this.log(`Option "${val}" introuvable`, '⚠️');
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