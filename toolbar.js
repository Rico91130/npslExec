/**
 * TOOLBAR D'EXÉCUTION
 */
(function() {
    // 0. Init
    const engineCode = localStorage.getItem('MON_MOTEUR_LIB');
    const scenarioStr = localStorage.getItem('TEST_SCENARIO');
    
    if(!engineCode || !scenarioStr) {
        alert("⚠️ Configuration manquante. Passez par le Dashboard d'abord.");
        return;
    }
    
    if(!window.FormulaireTester) window.eval(engineCode);
    const SCENARIO = JSON.parse(scenarioStr);

    // 1. UI
    if(document.getElementById('test-toolbar')) return;

    const bar = document.createElement('div');
    bar.id = 'test-toolbar';
    bar.style.cssText = `
        position: fixed; bottom: 0; left: 0; width: 100%; height: 60px;
        background: #1e1e1e; color: white; display: flex; align-items: center;
        justify-content: space-between; padding: 0 20px; z-index: 99999;
        box-shadow: 0 -2px 10px rgba(0,0,0,0.3); font-family: sans-serif;
    `;

    bar.innerHTML = `
        <div style="display:flex; align-items:center; gap:15px;">
            <span style="font-weight:bold; color:#4ade80;">🤖 Auto-Test</span>
            <span id="status-text" style="font-size:12px; color:#ccc;">Prêt</span>
        </div>
        
        <div style="display:flex; align-items:center; gap:15px;">
            <label style="display:flex; align-items:center; cursor:pointer; font-size:12px; color:#aaa;">
                <input type="checkbox" id="chkLogs" style="margin-right:5px;">
                Logs
            </label>

            <label style="display:flex; align-items:center; cursor:pointer; font-size:14px;">
                <input type="checkbox" id="chkAutoNext" style="margin-right:5px;">
                Auto-Suivant
            </label>
            
            <div style="width:1px; height:20px; background:#555; margin:0 5px;"></div>
            
            <button id="btnRunPage" style="background:#000091; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer;">
                ▶ Remplir
            </button>
        </div>
    `;
    
    document.body.appendChild(bar);

    // 2. Logique
    const btnRun = document.getElementById('btnRunPage');
    const chkAutoNext = document.getElementById('chkAutoNext');
    const chkLogs = document.getElementById('chkLogs'); // Nouveau
    const status = document.getElementById('status-text');

    let isRunning = false;

    // Listener pour les logs
    chkLogs.onchange = () => {
        if(window.FormulaireTester) {
            window.FormulaireTester.config.verbose = chkLogs.checked;
            console.log("[TOOLBAR] Verbose mode : " + chkLogs.checked);
        }
    };

    const runCycle = async () => {
        if(isRunning) return;
        isRunning = true;
        status.innerText = "⏳ Remplissage...";
        btnRun.disabled = true;
        btnRun.style.opacity = 0.5;

        try {
            // Synchro config avant lancement
            window.FormulaireTester.config.verbose = chkLogs.checked;

            const actions = await window.FormulaireTester.runPage(SCENARIO);
            status.innerText = `✅ ${actions} champs remplis.`;

            if(chkAutoNext.checked) {
                const nextBtn = document.querySelector('#btn-next, button.fr-btn--icon-right');
                if(nextBtn && !nextBtn.disabled) {
                    status.innerText += " ➡ Suivant...";
                    setTimeout(() => nextBtn.click(), 500);
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

    // Boucle de surveillance
    setInterval(() => {
        if(chkAutoNext.checked && !isRunning) {
            // Optionnel : relance auto
        }
    }, 2000);
})();
