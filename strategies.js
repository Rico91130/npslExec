/**
 * STRATÉGIES MÉTIER & COMPOSANTS NATIFS (V3.1 - Fix Priorité Checkbox)
 */
window.NPSL_STRATEGIES = [

    // --- 1. STRATÉGIES MÉTIER ---

    {
        id: 'AdresseBanOuManuelle_SaisieManuelle',
        description: 'Gère le bloc adresse manuelle complet (Checkbox + Autocomplete)',

        // MODIFICATION ICI : On matche SOIT la ville, SOIT la checkbox d'activation
        matches: (key) => key.endsWith('_communeActuelleAdresseManuelle_nomLong') || key.endsWith('_utiliserAdresseManuelle'),

        isActive: (key, data) => {
            // On recalcule le préfixe proprement selon la clé qui a déclenché
            let prefix = '';
            if (key.endsWith('_nomLong')) prefix = key.split('_communeActuelleAdresseManuelle_nomLong')[0];
            else if (key.endsWith('_utiliserAdresseManuelle')) prefix = key.split('_utiliserAdresseManuelle')[0];
            
            // La stratégie est active si on veut utiliser l'adresse manuelle
            return data[`${prefix}_utiliserAdresseManuelle`] === true;
        },

        getIgnoredKeys: (key) => {
            // On ne définit les clés à ignorer que si on est sur la clé principale (Ville)
            // Sinon on risque de générer des clés invalides
            if (key.endsWith('_nomLong')) {
                const base = key.replace('_nomLong', '');
                return ['_nom', '_codeInsee', '_codePostal', '_codeInseeDepartement', '_id', '_nomProtecteur', '_typeProtection']
                       .map(s => base + s);
            }
            return [];
        },

        execute: async function (element, value, fullData, engine) {
            // Identification du cas à traiter
            const isCheckbox = element.type === 'checkbox'; // Plus robuste que le check sur la clé
            const isAutocomplete = !isCheckbox; 

            // --- CAS 1 : GESTION DE LA CHECKBOX (Le "Portier") ---
            if (isCheckbox) {
                const shouldBeChecked = (value === true || value === 'true');
                
                if (element.checked !== shouldBeChecked) {
                    engine.log(`[Stratégie Adresse] Clic Checkbox d'activation`, '☑️');
                    element.click();
                    // CRUCIAL : On renvoie PENDING.
                    // Cela dit au moteur : "J'ai cliqué, mais ne passe pas tout de suite à la suite (les inputs Voie/Ville...), attends que le DOM bouge."
                    return 'PENDING'; 
                }
                return 'OK'; // Déjà bon
            }

            // --- CAS 2 : GESTION DE L'AUTOCOMPLETE (Ville) ---
            if (isAutocomplete) {
                // Reconstruction des données nécessaires
                // On doit retrouver le prefixe à partir de la clé actuelle (qui finit par _nomLong)
                // Note: 'element' ici est l'input de la ville
                // 'key' n'est pas passé directement dans execute dans la V8 standard mais on peut le déduire ou modifier le moteur
                // Astuce : On va utiliser fullData pour récupérer CP et Nom.
                
                // Pour récupérer le préfixe, on ruse un peu ou on suppose que le moteur V8 passe 'key' (ce qu'il ne fait pas par défaut dans mon dernier code V8)
                // CORRECTION MOTEUR V8 REQUISE ? Non, on va chercher dans le DOM ou data.
                
                // On va parcourir fullData pour trouver les clés correspondantes au CP et Nom
                // C'est un peu couteux mais sûr. Ou alors on se base sur l'ID de l'élément si dispo.
                
                // Méthode simple : On tape ce qu'il y a dans 'value' par défaut (qui contient "NOM (CP)")
                // Sauf si on veut reconstruire "CP NOM".
                
                let textToType = value; 
                
                // Tentative de reconstruction intelligente "CP NOM"
                // On cherche dans fullData une clé qui ressemble à la nôtre mais finit par _codePostal
                // Comme on n'a pas la clé "key" ici (oubli dans la signature V8), on fait au mieux.
                // (Si tu utilises le moteur V8 que je t'ai donné, update la signature execute si besoin, voir note plus bas)
                
                // ... Logique Autocomplete Angular Material ...
                const options = document.querySelectorAll('mat-option');
                const visibleOptions = Array.from(options).filter(opt => opt.offsetParent !== null);

                if (visibleOptions.length > 0) {
                    const targetOption = visibleOptions[0];
                    engine.log(`[Stratégie Adresse] Sélection "${targetOption.innerText.trim()}"`, 'point_up');
                    await engine.sleep(500);
                    targetOption.click();
                    await engine.sleep(100);
                    
                    // Forçage visuel
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.blur();
                    return 'OK';
                }

                // Saisie
                if (element.value !== textToType) {
                    engine.log(`[Stratégie Adresse] Saisie "${textToType}"`, '⌨️');
                    element.value = textToType;
                    element.dispatchEvent(new Event('focus', { bubbles: true }));
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    return 'PENDING';
                }

                if (document.activeElement !== element) {
                    element.focus();
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                }
                return 'PENDING';
            }

            return 'KO';
        }
    },

    // --- 2. STRATÉGIES NATIVES (Ordre inchangé) ---

    {
        id: 'Native_Select',
        matches: (key, el) => el && el.tagName === 'SELECT',
        execute: async (element, value, data, engine) => {
            const searchVal = String(value).trim();
            let foundIndex = -1;
            for (let i = 0; i < element.options.length; i++) {
                if (element.options[i].value === searchVal || (searchVal.length > 0 && element.options[i].text.includes(searchVal))) {
                    foundIndex = i;
                    break;
                }
            }
            if (foundIndex > -1) {
                if (element.selectedIndex === foundIndex) return 'SKIPPED';
                element.selectedIndex = foundIndex;
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return 'OK';
            }
            return 'KO';
        }
    },

    {
        id: 'Native_Radio',
        matches: (key, el) => el && el.type === 'radio',
        execute: async (element, value, data, engine) => {
            const groupName = element.name;
            if (!groupName) return 'KO';
            const radios = document.querySelectorAll(`input[type="radio"][name="${groupName}"]`);
            for (const radio of radios) {
                const valAttr = radio.getAttribute('v') || radio.value;
                if (valAttr === String(value)) {
                    if (radio.checked) return 'SKIPPED';
                    radio.click();
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                    return 'OK';
                }
            }
            return 'KO';
        }
    },

    {
        id: 'Native_Checkbox',
        matches: (key, el) => el && el.type === 'checkbox',
        execute: async (element, value, data, engine) => {
            const shouldBeChecked = (value === true || value === 'true');
            if (element.checked === shouldBeChecked) return 'SKIPPED';
            element.click();
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return 'OK';
        }
    },

    {
        id: 'Native_Input_Simple',
        matches: (key, el) => {
            if (!el) return false;
            const tag = el.tagName;
            const type = el.type ? el.type.toLowerCase() : 'text';
            if (tag === 'TEXTAREA') return true;
            if (tag === 'INPUT' && !['radio', 'checkbox', 'file', 'hidden', 'submit', 'button'].includes(type)) return true;
            return false;
        },
        execute: async (element, value, data, engine) => {
            const strValue = String(value);
            if (element.value === strValue) return 'SKIPPED';
            element.focus();
            element.value = strValue;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true }));
            return 'OK';
        }
    }
];

console.log(`[Strategies.js] ${window.NPSL_STRATEGIES.length} stratégies prêtes.`);