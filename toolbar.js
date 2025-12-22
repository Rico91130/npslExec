/**
 * TOOLBAR D'EXÉCUTION
 * S'injecte sur le formulaire SPA
 */
(function() {
    // 0. Vérif sécurité & Chargement Moteur
    const engineCode = localStorage.getItem('MON_MOTEUR_LIB');
    const scenarioStr = localStorage.getItem('TEST_SCENARIO');
    
    if(!engineCode || !scenarioStr) {
        alert("⚠️ Configuration manquante. Passez par le Dashboard d'abord.");
        return;
    }
    
    // Chargement librairie moteur
    if(!window.FormulaireTester) window.eval(engineCode);
    
    // Parsage Scénario
    const SCENARIO = JSON.parse(scenarioStr);

    // 1. Création de l'UI (Si pas déjà présente)
    if(document.getElementById('test-toolbar')) return;

    const bar = document.createElement('div');
    bar.id = 'test-toolbar';
    bar.style.cssText = `
        position: fixed; bottom: 0; left: 0; width: 100%; height: 60px;
        background: #1e1e1e; color: white; display: flex; align-items: center;
        justify-content: space-between; padding: 0 20px; z-index: 99999;
        box-shadow: 0 -2px 10px rgba(0,0,0,0.3); font-family: sans-serif;
    `;

    // Contenu HTML de la barre
    bar.innerHTML = `
        <div style="display:flex; align-items:center; gap:15px;">
            <span style="font-weight:bold; color:#4ade80;">🤖 Auto-Test</span>
            <span id="status-text" style="font-size:12px; color:#ccc;">Prêt</span>
        </div>
        
        <div style="display:flex; align-items:center; gap:10px;">
            <label style="display:flex; align-items:center; cursor:pointer; font-size:14px;">
                <input type="checkbox" id="chkAutoNext" style="margin-right:5px;">
                Auto-Suivant
            </label>
            <div style="width:1px; height:20px; background:#555; margin:0 10px;"></div>
            <button id="btnRunPage" style="background:#000091; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer;">
                ▶ Remplir la page
            </button>
        </div>
    `;
    
    document.body.appendChild(bar);

    // 2. Logique de contrôle
    const btnRun = document.getElementById('btnRunPage');
    const chkAutoNext = document.getElementById('chkAutoNext');
    const status = document.getElementById('status-text');

    let isRunning = false;

    // Fonction principale déclenchée par le bouton ou l'intervalle
    const runCycle = async () => {
        if(isRunning) return;
        isRunning = true;
        status.innerText = "⏳ Remplissage...";
        btnRun.disabled = true;
        btnRun.style.opacity = 0.5;

        try {
            // Appel au moteur pour la vue courante
            const actions = await window.FormulaireTester.runPage(SCENARIO);
            status.innerText = `✅ ${actions} champs remplis.`;

            // Gestion Auto-Next
            if(chkAutoNext.checked) {
                // On cherche le bouton suivant (ID standard souvent utilisé)
                // Note : Adaptez le sélecteur si l'ID change (ex: .btn-next, button[type=submit])
                const nextBtn = document.querySelector('#btn-next, button.fr-btn--icon-right');
                
                if(nextBtn && !nextBtn.disabled) {
                    status.innerText += " ➡ Suivant...";
                    setTimeout(() => {
                        nextBtn.click();
                        // Après clic, on attend que la vue change pour relancer ? 
                        // Pas besoin, le bouton "Remplir" sera réactivé, ou on peut mettre un intervalle
                    }, 500);
                } else {
                    status.innerText += " (Attente validation)";
                }
            }
        } catch(e) {
            status.innerText = "❌ Erreur: " + e.message;
            console.error(e);
        } finally {
            isRunning = false;
            btnRun.disabled = false;
            btnRun.style.opacity = 1;
        }
    };

    btnRun.onclick = runCycle;

    // 3. Mode "Surveillance Active" (Optionnel mais puissant)
    // Si Auto-Next est coché, on peut vouloir scanner régulièrement si de nouveaux champs sont apparus
    setInterval(() => {
        if(chkAutoNext.checked && !isRunning) {
            // On lance un cycle si on détecte qu'on est sur une nouvelle page vierge 
            // ou s'il reste des choses à faire ? 
            // Pour l'instant, restons simple : l'utilisateur clique ou on boucle doucement
            // runCycle(); // Décommenter pour un mode "Full Auto" agressif
        }
    }, 2000);

})();
