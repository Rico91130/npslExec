/**
 * DASHBOARD V6 - Style "Service Public" & Correction URL
 */
(function() {
    // --- STYLE CSS (Thème Clair / Officiel) ---
    const STYLE = `
        #mon-dashboard-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5); /* Fond semi-transparent standard */
            font-family: 'Marianne', 'Segoe UI', sans-serif;
            z-index: 2147483647;
            display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(2px);
        }
        .dash-container {
            width: 100%; max-width: 800px; 
            background: #ffffff; color: #161616;
            padding: 40px; border-radius: 0; /* Pas d'arrondi ou très peu */
            box-shadow: 0 8px 16px rgba(0,0,0,0.1);
            display: flex; flex-direction: column; gap: 24px;
            border-top: 4px solid #000091; /* La barre bleue officielle */
        }
        h1 { 
            margin: 0; font-size: 28px; font-weight: 700; color: #161616; 
            margin-bottom: 5px; 
        }
        .dash-subtitle {
            font-size: 14px; color: #666; margin-bottom: 20px;
        }
        .dash-info { 
            background: #f0f0f0; color: #333; padding: 12px; 
            font-size: 14px; border-left: 4px solid #666;
        }
        .dash-section { display: flex; flex-direction: column; gap: 10px; }
        
        label { 
            font-weight: 700; color: #161616; font-size: 16px; 
        }
        
        /* Zone de Drop / Import */
        .file-drop-zone {
            border: 2px dashed #ccc; background: #f9f9f9;
            padding: 30px; text-align: center; cursor: pointer; 
            color: #000091; font-weight: 500; transition: 0.2s;
        }
        .file-drop-zone:hover { 
            border-color: #000091; background: #ececff; 
        }
        input[type="file"] { display: none; }

        textarea {
            width: 100%; height: 300px; 
            background: #fff; color: #161616;
            border: 1px solid #ccc; padding: 15px;
            font-family: 'Consolas', monospace; font-size: 13px; 
            resize: vertical; outline: none;
        }
        textarea:focus { border-color: #000091; box-shadow: 0 0 0 1px #000091; }
        
        .actions { display: flex; gap: 20px; margin-top: 10px; justify-content: flex-end; }
        
        button {
            padding: 12px 24px; border: none; font-size: 16px; 
            font-weight: 500; cursor: pointer; transition: 0.2s;
        }
        #btn-run { 
            background: #000091; color: white; 
        }
        #btn-run:hover { background: #1212ff; }
        
        #btn-close { 
            background: white; color: #000091; border: 1px solid #000091; 
        }
        #btn-close:hover { background: #f5f5fe; }
    `;

    // 1. Nettoyage
    const existing = document.getElementById('mon-dashboard-overlay');
    if (existing) existing.remove();

    if (!document.getElementById('dash-style-v6')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'dash-style-v6';
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
            <div>
                <h1>Outil de Test Automatisé</h1>
                <div class="dash-subtitle">NPSL Executeur de Scénario</div>
            </div>
            
            <div class="dash-info">
                Environnement cible : <strong>${currentOrigin}</strong>
            </div>

            <div class="dash-section">
                <label>1. Charger un fichier de configuration</label>
                <label class="file-drop-zone" for="json-upload">
                    📂 Sélectionner un fichier JSON (ou glisser-déposer)
                    <input type="file" id="json-upload" accept=".json">
                </label>
            </div>

            <div class="dash-section">
                <label>2. Vérifier les données</label>
                <textarea id="dash-json" spellcheck="false" placeholder='{ "codeDemarche": "...", "donnees": { ... } }'>${savedJson}</textarea>
            </div>

            <div class="actions">
                <button id="btn-close">Fermer</button>
                <button id="btn-run">Lancer le Test</button>
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

    btnClose.onclick = () => overlay.remove();

    // Import Fichier
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target.result;
                JSON.parse(content); // Vérif JSON
                txtJson.value = content;
                dropZone.innerText = `✅ Fichier chargé : ${file.name}`;
                dropZone.style.borderColor = "#000091";
                dropZone.style.background = "#f0f0ff";
            } catch (err) {
                alert("❌ Erreur : Le fichier sélectionné n'est pas un JSON valide.");
            }
        };
        reader.readAsText(file);
    };

    // Lancement
    btnRun.onclick = () => {
        try {
            const jsonStr = txtJson.value.trim();
            if(!jsonStr) { alert("Veuillez fournir un JSON de configuration."); return; }

            const jsonObj = JSON.parse(jsonStr);
            
            if (!jsonObj.codeDemarche) {
                alert("⚠️ Propriété 'codeDemarche' manquante dans le JSON.");
                return;
            }

            // Sauvegarde
            localStorage.setItem('TEST_SCENARIO', jsonStr);

            // Construction URL (CORRIGÉE)
            // Ancien : /mademarche/${code}/demarche
            // Nouveau : /mademarche/demarcheGenerique/?codeDemarche=${code}
            const targetPath = `/mademarche/demarcheGenerique/?codeDemarche=${jsonObj.codeDemarche}`;
            
            // Navigation
            if (window.location.pathname + window.location.search === targetPath) {
                window.location.reload();
            } else {
                window.location.assign(targetPath);
            }
            
        } catch (e) {
            alert("❌ JSON Invalide : " + e.message);
        }
    };
})();