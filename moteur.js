/**
 * DASHBOARD DE CONFIGURATION
 * S'injecte sur la page d'accueil pour préparer le test.
 */
(function() {
    // 1. Nettoyage violent de la page
    document.body.innerHTML = '';
    document.body.style.backgroundColor = '#f0f0f0';
    document.body.style.fontFamily = 'Marianne, sans-serif';

    // 2. Construction de l'IHM
    const container = document.createElement('div');
    container.style.cssText = 'max-width: 800px; margin: 50px auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);';

    container.innerHTML = `
        <h1 style="color:#000091; margin-bottom: 20px;">⚡ Configuration du Test Automatisé</h1>
        
        <div style="margin-bottom: 20px; padding: 15px; background: #e8edff; border-left: 4px solid #000091;">
            <strong>Étape 1 :</strong> Chargez votre fichier de scénario (JSON ou Brouillon).
        </div>

        <input type="file" id="jsonInput" accept=".json" style="margin-bottom: 10px; padding: 10px; width: 100%;">
        
        <label style="display:block; margin-top:10px; font-weight:bold;">Contenu du scénario (Modifiable) :</label>
        <textarea id="jsonPreview" style="width:100%; height:300px; font-family:monospace; margin-bottom: 20px; border:1px solid #ccc; padding:10px;"></textarea>

        <div id="actions" style="text-align:right; border-top: 1px solid #eee; padding-top: 20px;">
            <button id="btnLaunch" disabled style="background-color: #000091; color: white; padding: 12px 24px; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; opacity: 0.5;">
                Ouvrir la démarche &rarr;
            </button>
        </div>
        <p id="errorMsg" style="color:red; display:none;"></p>
    `;

    document.body.appendChild(container);

    // 3. Logique
    const input = document.getElementById('jsonInput');
    const textarea = document.getElementById('jsonPreview');
    const btn = document.getElementById('btnLaunch');
    const errorMsg = document.getElementById('errorMsg');

    // Chargement fichier
    input.onchange = (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                // Formattage joli du JSON
                const obj = JSON.parse(evt.target.result);
                textarea.value = JSON.stringify(obj, null, 4);
                textarea.dispatchEvent(new Event('input')); // Déclenche la validation
            } catch(err) {
                alert("JSON Invalide");
            }
        };
        reader.readAsText(file);
    };

    // Validation & Extraction Code Démarche
    textarea.oninput = () => {
        try {
            const data = JSON.parse(textarea.value);
            // Sauvegarde dans localStorage pour la suite
            localStorage.setItem('TEST_SCENARIO', JSON.stringify(data));
            
            // Tentative de trouver le code démarche (souvent à la racine ou déduit)
            // Dans votre exemple pvpp.json : "codeDemarche": "PVPP"
            // Dans le brouillon : non présent, il faut le deviner ou le demander.
            let code = data.codeDemarche || data.donnees?.codeDemarche;
            
            if(code) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.onclick = () => {
                    const url = `https://demarches.service-public.gouv.fr/mademarche/demarcheGenerique/?codeDemarche=${code}`;
                    window.location.href = url;
                };
                errorMsg.style.display = 'none';
            } else {
                // Fallback si pas de code démarche dans le JSON
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.innerText = "Lancer (Code démarche inconnu)";
                btn.onclick = () => {
                    const codeManuel = prompt("Code démarche non trouvé dans le JSON. Entrez le code (ex: PVPP) :");
                    if(codeManuel) {
                        window.location.href = `https://demarches.service-public.gouv.fr/mademarche/demarcheGenerique/?codeDemarche=${codeManuel}`;
                    }
                };
            }
        } catch(e) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            errorMsg.innerText = "JSON invalide : " + e.message;
            errorMsg.style.display = 'block';
        }
    };
})();
