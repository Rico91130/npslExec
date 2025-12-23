/**
 * MOTEUR V3.3 - Gestion Temporisation + Apparitions dynamiques + Composants Riches (Inférence)
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
        // C'est ici que le nettoyage des données se fait
        const data = this.prepareData(scenario);
        let actionCount = 0;

        // 1. Première analyse de la page
        let visibleSnapshot = this.scanVisibleKeys();
        this.log(`Analyse initiale : ${visibleSnapshot.size} champs visibles.`, '🔍');

        for (const [key, val] of Object.entries(data)) {
            // 2. Vérification de visibilité (basée sur le snapshot courant)
            // Note: On vérifie toujours la visibilité, même pour les champs filtrés
            const isVisible = this.isKeyLikelyVisible(key, visibleSnapshot);
            
            if (isVisible) {
                const result = await this.tryFill(key, val);
                
                if (result === 'OK') {
                    actionCount++;
                    this.log(`Succès pour '${key}'`, '✅');

                    // Mise à jour du snapshot après une action réussie (apparition potentielle de nouveaux champs)
                    visibleSnapshot = this.scanVisibleKeys(); 
                    
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

        // BOUCLE DE RETRY
        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            field = this.findElement(key);

            // Condition de sortie : Champ trouvé ET visible
            if (field && field.offsetParent !== null) {
                break;
            }

            // Si pas trouvé, on attend un peu (sauf au dernier essai)
            if (attempt < this.config.retryAttempts) {
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
        
        // 2. Dépendance probable
        for (let visibleKey of set) {
            if (key.startsWith(visibleKey)) return true;
        }
        
        // 3. Si le set est vide (page vierge chargée), on tente tout
        if (set.size === 0) return true;

        return false;
    },

    /**
     * Prépare et nettoie les données (Inclus la gestion des Composants Riches)
     */
    prepareData: function(input) {
        let rawData = input.donnees ? input.donnees : input;
        let clean = {};

        // ÉTAPE 1 : Nettoyage standard (Libellés, Valeurs, Booléens)
        for (const [key, val] of Object.entries(rawData)) {
            if (val === null || val === "") continue;
            
            // Gestion suffixe _libelle / _valeur
            let k = key.endsWith('_libelle') ? key.replace('_libelle', '') : key;
            if (key.endsWith('_valeur') && rawData[key.replace('_valeur', '_libelle')]) continue;
            
            // Conversion booléens string -> boolean réel
            let v = val === "true" ? true : (val === "false" ? false : val);
            
            clean[k] = v;
        }

        // ÉTAPE 2 : Gestion des Composants Riches (Inférence)
        // On repasse sur les données propres pour supprimer les champs techniques parasites
        const keysToDelete = [];
        
        Object.keys(clean).forEach(key => {
            // Si on détecte un champ "Maître" (ex: _nomLong pour une commune)
            if (key.endsWith('_nomLong')) {
                const prefix = key.replace('_nomLong', '');
                
                // Liste des suffixes techniques à supprimer si le maître est présent
                const technicalSuffixes = [
                    '_nom', 
                    '_codePostal', 
                    '_codeInsee', 
                    '_codeInseeDepartement', 
                    '_typeProtection', 
                    '_nomProtecteur', 
                    '_idProtecteur', 
                    '_id'
                ];

                technicalSuffixes.forEach(suffix => {
                    const techKey = prefix + suffix;
                    // Si la clé technique existe, on la marque pour suppression
                    if (clean[techKey] !== undefined) {
                        keysToDelete.push(techKey);
                    }
                });
            }
        });

        // Suppression effective
        keysToDelete.forEach(k => {
            if(this.config.verbose) console.log(`[RichComponent] Suppression automatique de la clé technique : ${k}`);
            delete clean[k];
        });

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
                // Dispatch events essentiels pour les frameworks JS
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
            el.blur();
            return true;
        } catch (e) { return false; }
    }
};