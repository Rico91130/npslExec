/**
 * MOTEUR DE TEST - VERSION 2.0 (Compatible JSON Brouillon)
 */
console.log("🔧 Initialisation du Moteur de Test v2...");

window.FormulaireTester = {
    
    /**
     * Point d'entrée principal
     * Accepte soit un scénario simple, soit un JSON complet de brouillon
     */
    run: async function(rawData) {
        console.log("🚀 Préparation des données...");
        const scenario = this.prepareData(rawData);
        
        console.log(`▶️ Démarrage de l'exécution (${Object.keys(scenario).length} champs identifiés)...`);
        
        let successCount = 0;
        let ignoredCount = 0;
        
        for (const [key, val] of Object.entries(scenario)) {
            // On ignore les valeurs vides ou nulles du brouillon
            if (val === null || val === "") {
                ignoredCount++;
                continue;
            }

            // Exécution
            const result = await this.tryFill(key, val);
            if (result === 'OK') successCount++;
            else if (result === 'IGNORED') ignoredCount++;
        }
        
        alert(`Terminé !\n✅ Succès : ${successCount}\nignorer/Invisibles : ${ignoredCount}`);
    },

    /**
     * Transforme le JSON brut (Brouillon) en format plat pour le test
     */
    prepareData: function(input) {
        // 1. Si c'est un brouillon complet, on prend la partie "donnees"
        let data = input.donnees ? input.donnees : input;
        let cleanScenario = {};

        for (const [key, val] of Object.entries(data)) {
            let cleanKey = key;
            let cleanVal = val;

            // RÈGLE 1 : Gestion des listes (Priorité au Libellé)
            // Si on trouve "monChamp_libelle", on l'utilise pour remplir "monChamp"
            if (key.endsWith('_libelle')) {
                cleanKey = key.replace('_libelle', '');
            } 
            // Si c'est une valeur technique associée à un libellé existant, on l'ignore
            // (car on préfère remplir via le libellé pour les selects Angular)
            else if (key.endsWith('_valeur') && data[key.replace('_valeur', '_libelle')]) {
                continue; 
            }

            // RÈGLE 2 : Conversion "true"/"false" string en booléen
            if (cleanVal === "true") cleanVal = true;
            if (cleanVal === "false") cleanVal = false;

            cleanScenario[cleanKey] = cleanVal;
        }
        return cleanScenario;
    },

    tryFill: function(key, val, attempt = 1) {
        return new Promise((resolve) => {
            // Sélecteurs
            const container = document.querySelector(`[data-clef="${key}"], [data-testid="${key}"]`);
            let field = container ? container.querySelector('input, select, textarea') : null;
            if (!field) field = document.querySelector(`#${key}, [name="${key}"]`);

            if (field) {
                // Si le champ est visible, on le remplit
                if (field.offsetParent === null) {
                   // Champ présent mais caché (ex: condition non remplie) -> On skip rapidement
                   // console.log(`Existing but hidden: ${key}`);
                   resolve('IGNORED'); 
                   return;
                }

                if (this.fillField(field, val)) {
                    console.log(`✅ [OK] ${key} = ${val}`);
                    setTimeout(() => resolve('OK'), 200); // Pause Angular
                } else {
                    resolve('KO');
                }
            } else {
                // Champ introuvable (peut-être une métadonnée ou une page suivante)
                // On insiste moins que la v1 (3 essais max) pour ne pas bloquer sur les métadonnées du brouillon
                if (attempt < 3) { 
                    setTimeout(() => this.tryFill(key, val, attempt + 1).then(resolve), 300);
                } else {
                    // C'est probablement une donnée technique (ex: codeInsee) sans champ associé
                    // console.log(`ℹ️ [SKIP] ${key} (non visuel)`);
                    resolve('IGNORED');
                }
            }
        });
    },

    fillField: function(el, val) {
        try {
            el.focus();
            const tag = el.tagName.toLowerCase();
            const type = el.type ? el.type.toLowerCase() : '';

            // CASE A COCHER / RADIO
            if (type === 'checkbox' || type === 'radio') {
                if (el.checked !== val) el.click();
                return true;
            } 
            // LISTE DEROULANTE
            else if (tag === 'select') {
                let found = false;
                for (let i = 0; i < el.options.length; i++) {
                    // Match large (includes) pour gérer les libellés approximatifs
                    if (el.options[i].text.includes(val)) {
                        el.selectedIndex = i;
                        found = true;
                        break;
                    }
                }
                if (found) el.dispatchEvent(new Event('change', { bubbles: true }));
                return found;
            } 
            // CHAMP TEXTE
            else {
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.blur();
                return true;
            }
        } catch (e) { return false; }
    }
};
console.log("✅ Moteur v2 (Support Brouillon) chargé !");
