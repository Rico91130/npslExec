/**
 * DASHBOARD V5 - Full Screen & Import Fichier
 * Interface immersive qui recouvre la page + Réintégration de l'upload JSON.
 */
(function() {
    // --- STYLE CSS (Mode Full Screen) ---
    const STYLE = `
        #mon-dashboard-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: #121212; color: #e0e0e0; font-family: 'Segoe UI', sans-serif;
            z-index: 2147483647; /* Z-index maximum */
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            padding: 20px; box-sizing: border-box;
        }
        .dash-container {
            width: 100%; max-width: 800px; background: #1e1e1e; 
            padding: 30px; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            display: flex; flex-direction: column; gap: 20px;
            border: 1px solid #333;
        }
        h1 { margin: 0; font-size: 24px; color: #fff; text-align: center; margin-bottom: 10px; }
        .dash-info { 
            text-align: center; color: #aaa; font-size: 14px; 
            background: #252526; padding: 10px; border-radius: 6px; border: 1px solid #333;
        }
        .dash-section { display: flex; flex-direction: column; gap: 8px; }
        label { font-weight: bold; color: #4ade80; font-size: 13px; text-transform: uppercase; }
        
        /* Zone de Drop / Import */
        .file-drop-zone {
            border: 2px dashed #444; border-radius: 8px; padding: 20px;
            text-align: center; cursor: pointer; transition: 0.2s; background: #252526;
            color: #888;
        }
        .file-drop-zone:hover { border-color: #4ade80; color: #fff; background: #2d2d2d; }
        input[type="file"] { display: none; }

        textarea {
            width: 100%; height: 300px; background: #111; color: #bbb;
            border: 1px solid #333; border-radius: 6px; padding: 15px;
            font-family: 'Consolas', monospace; font-size: 12px; resize: vertical;
        }
        
        .actions { display: flex; gap: 15px; margin-top: 10px; }
        button {
            flex: 1; padding: 15px; border: none; border-radius: 6px;
            font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.2s;
        }
        #btn-run { background: #000091; color: white; }
        #btn-run:hover { background: #0000bd; }
        #btn-close { background: #333; color: #ccc; max-width: 150px; }
        #btn-close:hover { background: #444; color: white; }
    `;

    // 1. Nettoyage
    const existing = document.getElementById('mon-dashboard-overlay');
    if (existing) existing.remove();

    if (!document.getElementById('dash-style-v5')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'dash-style-v5';
        styleEl.textContent = STYLE;
        document.head.appendChild(styleEl);
    }

    // 2. Récupération Données
    const savedJson = localStorage.getItem('TEST_SCENARIO') || '';
    const currentOrigin = window.location.origin;

    // 3. Construction du DOM
    const overlay = document.createElement('div');
    overlay.id = 'mon-dashboard-overlay';
    
    overlay.innerHTML = `
        <div class="dash-container">
            <h1>🎛️ NPSL Auto-Tester</h1>
            
            <div class="dash-info">
                Environnement détecté : <strong style="color:#fff">${currentOrigin}</strong>
            </div>

            <div class="dash-section">
                <label>1. Charger un scénario (JSON)</label>
                <label class="file-drop-zone" for="json-upload">
                    📂 Cliquez ici pour sélectionner un fichier JSON...
                    <input type="file" id="json-upload" accept=".json">
                </label>
            </div>

            <div class="dash-section">
                <label>2. Vérifier / Modifier les données</label>
                <textarea id="dash-json" spellcheck="false" placeholder="Le contenu du JSON apparaîtra ici...">${savedJson}</textarea>
            </div>

            <div class="actions">
                <button id="btn-close">Fermer</button>
                <button id="btn-run">▶ Lancer le Test</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // --- LOGIQUE JS ---

    const btnRun = document.getElementById('btn-run');
    const btnClose = document.getElementById('btn-close');
    const txtJson = document.getElementById('dash-json');
    const fileInput = document.getElementById('json-upload');
    const dropZone = document.querySelector('.file-drop-zone');

    // Gestion Fermeture
    btnClose.onclick = () => overlay.remove();

    // Gestion Import Fichier JSON
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                // Vérification basique que c'est du JSON
                const content = event.target.result;
                JSON.parse(content); 
                
                // Injection dans la textarea
                txtJson.value = content;
                dropZone.innerText = `✅ Fichier chargé : ${file.name}`;
                dropZone.style.borderColor = "#4ade80";
                dropZone.style.color = "#4ade80";
            } catch (err) {
                alert("❌ Fichier invalide : Ce n'est pas un JSON correct.");
            }
        };
        reader.readAsText(file);
    };

    // Gestion Lancement
    btnRun.onclick = () => {
        try {
            const jsonStr = txtJson.value.trim();
            if(!jsonStr) { alert("Merci de coller ou charger un JSON."); return; }

            const jsonObj = JSON.parse(jsonStr); // Validation
            
            if (!jsonObj.codeDemarche) {
                alert("⚠️ Erreur : La propriété 'codeDemarche' est manquante dans le JSON.");
                return;
            }

            // 1. Sauvegarde Locale
            localStorage.setItem('TEST_SCENARIO', jsonStr);

            // 2. Construction URL (Même domaine)
            const targetPath = `/mademarche/${jsonObj.codeDemarche}/demarche`;
            
            // 3. Navigation
            // On vérifie si on est déjà sur la bonne URL pour éviter un reload inutile
            if (window.location.pathname.includes(targetPath)) {
                // Si on est déjà sur la page, on recharge juste pour reset le formulaire
                window.location.reload();
            } else {
                window.location.assign(targetPath);
            }
            
        } catch (e) {
            alert("❌ JSON Invalide : " + e.message);
        }
    };
})();