/**
 * MOTEUR DE TEST POUR FORMULAIRES ANGULAR
 * Compatible avec la stratégie de contournement CSP "Cheval de Troie"
 */
console.log("🔧 Initialisation du Moteur de Test...");

window.FormulaireTester = {
    /**
     * Lance l'exécution d'un scénario complet
     * @param {Object} scenario - Objet clé-valeur (ex: { "nom": "Dupont" })
     */
    run: async function(scenario) {
        console.log("🚀 Démarrage du scénario...");
        let count = 0;
        const total = Object.keys(scenario).length;

        for (const [key, val] of Object.entries(scenario)) {
            // On attend que chaque champ soit rempli avant de passer au suivant
            // C'est crucial pour les formulaires réactifs où un champ en débloque un autre
            if (await this.tryFill(key, val)) {
                count++;
            }
        }
        
        console.log(`🏁 SCÉNARIO TERMINÉ : ${count}/${total} étapes réussies.`);
        alert(`Terminé ! ${count}/${total} champs remplis.`);
    },

    /**
     * Tente de remplir un champ spécifique avec des retries (pour l'asynchrone)
     */
    tryFill: function(key, val, attempt = 1) {
        return new Promise((resolve) => {
            // 1. Recherche prioritaire par conteneur sémantique (data-clef)
            // C'est la méthode la plus robuste pour votre structure HTML
            const container = document.querySelector(`[data-clef="${key}"], [data-testid="${key}"]`);
            
            // Si conteneur trouvé, on cherche l'input DEDANS, sinon on cherche globalement
            let field = container ? container.querySelector('input, select, textarea') : null;
            
            // Fallback : Recherche directe par ID ou Name
            if (!field) {
                field = document.querySelector(`#${key}, [name="${key}"]`);
            }

            if (field) {
                // Le champ existe, on essaie de le remplir
                if (this.fillField(field, val)) {
                    console.log(`✅ [OK] ${key}`);
                    // Petite pause pour laisser Angular digérer l'événement (ex: faire apparaître le champ suivant)
                    setTimeout(() => resolve(true), 200);
                } else {
                    console.warn(`⚠️ [SKIP] ${key} trouvé mais valeur non applicable.`);
                    resolve(false);
                }
            } else {
                // Le champ n'est pas (encore) là. Est-ce un champ qui va apparaître ?
                if (attempt < 10) { // On insiste un peu (10 x 500ms = 5 secondes max)
                    // console.log(`⏳ En attente de '${key}'... (essai ${attempt})`);
                    setTimeout(() => this.tryFill(key, val, attempt + 1).then(resolve), 500);
                } else {
                    console.error(`❌ [KO] Champ '${key}' introuvable après attente.`);
                    resolve(false);
                }
            }
        });
    },

    /**
     * Logique de remplissage bas niveau selon le type de champ
     */
    fillField: function(el, val) {
        try {
            el.focus(); // Simule l'interaction utilisateur (important pour certains frameworks)
            
            const tag = el.tagName.toLowerCase();
            const type = el.type ? el.type.toLowerCase() : '';

            // CAS 1 : Checkbox / Radio
            if (type === 'checkbox' || type === 'radio') {
                if (el.checked !== val) {
                    el.click(); // Le click déclenche nativement le change
                }
                return true;
            } 
            
            // CAS 2 : Select (Menu déroulant)
            else if (tag === 'select') {
                // Recherche intelligente par TEXTE (car les values sont souvent techniques/obfusquées)
                let found = false;
                for (let i = 0; i < el.options.length; i++) {
                    // On compare le texte visible (ex: "75001 PARIS") avec la valeur demandée
                    if (el.options[i].text.includes(val)) {
                        el.selectedIndex = i;
                        found = true;
                        break;
                    }
                }
                
                if (found) {
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                } else {
                    console.warn(`Option contenant "${val}" introuvable dans le menu.`);
                    return false;
                }
            } 
            
            // CAS 3 : Champs Texte standards (Input, Textarea)
            else {
                el.value = val;
                // Séquence d'événements pour réveiller Angular/React
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.blur(); // Valide le champ (touched)
                return true;
            }
        } catch (e) {
            console.error("Erreur technique lors du remplissage", e);
            return false;
        }
    }
};

console.log("✅ Moteur chargé en mémoire avec succès !");
console.log("👉 Utilisez window.FormulaireTester.run({ ... }) pour lancer un test.");
