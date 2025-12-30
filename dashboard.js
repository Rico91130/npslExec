/**
 * DASHBOARD V4 - Mode "Same Origin" (Pas de limite de taille)
 * Fonctionne uniquement sur le domaine courant.
 */
(function() {
    // --- STYLE CSS (Inchangé) ---
    const STYLE = `
        #mon-dashboard {
            position: fixed; top: 50px; right: 20px; width: 400px;
            background: #1e1e1e; color: #eee; font-family: sans-serif;
            border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            z-index: 10000; display: flex; flex-direction: column;
            border: 1px solid #333;
        }
        #mon-dashboard-header {
            padding: 10px 15px; background: #252526; border-bottom: 1px solid #333;
            display: flex; justify-content: space-between; align-items: center;
            border-radius: 8px 8px 0 0; font-weight: bold; cursor: move;
        }
        #mon-dashboard-body { padding: 15px; display: flex; flex-direction: column; gap: 10px; }
        .dash-row { display: flex; flex-direction: column; gap: 5px; }
        .dash-label { font-size: 12px; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }
        .dash-info { font-size: 11px; color: #4ade80; background: #333; padding: 5px; border-radius: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        textarea {
            width: 100%; height: 250px; background: #111; color: #4ade80;
            border: 1px solid #333; border-radius: 4px; padding: 10px;
            font-family: monospace; font-size: 11px; resize: vertical;
        }
        button {
            background: #000091; color: white; border: none; padding: 10px;
            border-radius: 4px; cursor: pointer; font-weight: bold;
            transition: background 0.2s;
        }
        button:hover { background: #0000bd; }
        .close-btn { background: none; border: none; color: #aaa; cursor: pointer; font-size: 16px; }
        .close-btn:hover { color: white; }
    `;

    // Nettoyage précédent
    const existing = document.getElementById('mon-dashboard');
    if (existing) existing.remove();

    if (!document.getElementById('dash-style')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'dash-style';
        styleEl.textContent = STYLE;
        document.head.appendChild(styleEl);
    }

    const dash = document.createElement('div');
    dash.id = 'mon-dashboard';
    
    // Récupération du JSON sauvegardé (Local Storage est spécifique au domaine, donc pas de conflit Prod/Qualif)
    const savedJson = localStorage.getItem('TEST_SCENARIO') || '{\n  "codeDemarche": "PVPP",\n  "donnees": {\n    \n  }\n}';
    
    // Détection de l'origine actuelle
    const currentOrigin = window.location.origin;

    dash.innerHTML = `
        <div id="mon-dashboard-header">
            <span>🎛️ NPSL Tester (Mode Local)</span>
            <button class="close-btn" onclick="document.getElementById('mon-dashboard').remove()">✕</button>
        </div>
        <div id="mon-dashboard-body">
            
            <div class="dash-row">
                <label class="dash-label">Origine détectée</label>
                <div class="dash-info" title="${currentOrigin}">${currentOrigin}</div>
            </div>

            <div class="dash-row">
                <label class="dash-label">Données de test (JSON)</label>
                <textarea id="dash-json" spellcheck="false" placeholder="Collez votre JSON ici...">${savedJson}</textarea>
            </div>

            <button id="btn-run-local">▶ Sauvegarder et Lancer ici</button>
        </div>
    `;

    document.body.appendChild(dash);

    // --- LOGIQUE ---
    const btnRun = document.getElementById('btn-run-local');
    const txtJson = document.getElementById('dash-json');

    btnRun.onclick = () => {
        try {
            const jsonStr = txtJson.value;
            const jsonObj = JSON.parse(jsonStr); // Validation JSON
            
            if (!jsonObj.codeDemarche) {
                alert("⚠️ Erreur : La propriété 'codeDemarche' est manquante dans le JSON.");
                return;
            }

            // 1. Sauvegarde dans le localStorage DU DOMAINE COURANT
            // Comme on est sur la même origine, pas de limite de taille URL.
            localStorage.setItem('TEST_SCENARIO', jsonStr);
            console.log("[Dashboard] Scénario sauvegardé en local.");

            // 2. Construction de l'URL cible (Relative ou Absolue sur même domaine)
            // On reste sur la même origine, on change juste le path.
            const targetPath = `/mademarche/${jsonObj.codeDemarche}/demarche`;
            
            // 3. Navigation
            // On vérifie si on est déjà sur la bonne page pour éviter un rechargement inutile ?
            // Non, pour un test, il vaut mieux recharger proprement la page.
            console.log(`[Dashboard] Redirection vers ${targetPath}`);
            window.location.assign(targetPath);
            
        } catch (e) {
            alert("❌ JSON Invalide : " + e.message);
        }
    };

    // Drag & Drop
    const header = document.getElementById('mon-dashboard-header');
    let isDown = false, offset = [0,0];
    
    header.onmousedown = (e) => {
        isDown = true;
        offset = [dash.offsetLeft - e.clientX, dash.offsetTop - e.clientY];
    };
    
    document.onmouseup = () => isDown = false;
    
    document.onmousemove = (e) => {
        if (isDown) {
            dash.style.left = (e.clientX + offset[0]) + 'px';
            dash.style.top  = (e.clientY + offset[1]) + 'px';
            dash.style.right = 'auto'; 
        }
    };

})();