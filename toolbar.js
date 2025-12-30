/**
 * TOOLBAR V3 - Avec Tiroir de Détails (Logs)
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
    window.FormulaireTester.abort = false;
    const SCENARIO = JSON.parse(scenarioStr);

    // 1. UI
    if(document.getElementById('test-toolbar')) return;

    // --- LE TIROIR DE DÉTAILS (Caché par défaut) ---
    const drawer = document.createElement('div');
    drawer.id = 'test-drawer';
    drawer.style.cssText = `
        position: fixed; bottom: 60px; left: 0; width: 100%; max-height: 0;
        background: #252526; color: #ccc; overflow-y: auto; transition: max-height 0.3s ease-out;
        z-index: 99998; font-family: monospace; font-size: 12px; border-top: 1px solid #444;
        box-shadow: 0 -5px 15px rgba(0,0,0,0.5);
    `;
    document.body.appendChild(drawer);

    // --- LA BARRE ---
    const bar = document.createElement('div');
    bar.id = 'test-toolbar';
    bar.style.cssText = `
        position: fixed; bottom: 0; left: 0; width: 100%; height: 60px;
        background: #1e1e1e; color: white; display: flex; align-items: center;
        justify-content: space-between; padding: 0 20px; z-index: 99999;
        box-shadow: 0 -2px 10px rgba(0,0,0,0.3); font-family: sans-serif;
        border-top: 1px solid #333;
    `;

    bar.innerHTML = `
        <div style="display:flex; align-items:center; gap:15px;">
            <span style="font-weight:bold; color:#4ade80;">🤖 NPSL Test</span>
            <button id="status-btn" style="background:none; border:none; color:#ccc; font-size:12px; cursor:pointer; padding:5px; border-radius:4px; text-align:left;">
                Prêt (Cliquer pour détails)
            </button>
        </div>
        
        <div style="display:flex; align-items:center; gap:15px;">
            <label style="display:flex; align-items:center; cursor:pointer; font-size:12px; color:#aaa;">
                <input type="checkbox" id="chkLogs" style="margin-right:5px;" checked> Logs
            </label>

            <button id="btnSnapshot" style="background:#333; color:#eee; border:1px solid #555; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px;">
                📸 HTML
            </button>
            
            <div style="width:1px; height:20px; background:#555; margin:0 5px;"></div>
            
            <button id="btnStopPage" style="display:none; background:#e1000f; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer; font-weight:bold;">
                ⏹ Stop
            </button>

            <button id="btnRunPage" style="background:#000091; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer;">
                ▶ Remplir
            </button>
        </div>
    `;
    
    document.body.appendChild(bar);

    // 2. Logique
    const btnRun = document.getElementById('btnRunPage');
    const btnStop = document.getElementById('btnStopPage');
    const btnSnapshot = document.getElementById('btnSnapshot');
    const statusBtn = document.getElementById('status-btn');
    const chkLogs = document.getElementById('chkLogs');

    let isRunning = false;
    let isDrawerOpen = false;

    // --- Fonction Toggle Drawer ---
    const toggleDrawer = () => {
        isDrawerOpen = !isDrawerOpen;
        drawer.style.maxHeight = isDrawerOpen ? '40vh' : '0'; // 40% de la hauteur écran
        statusBtn.style.background = isDrawerOpen ? '#333' : 'none';
    };

    // --- Fonction de rendu des logs dans le tiroir ---
    const renderReport = (details) => {
        if (!details || details.length === 0) {
            drawer.innerHTML = '<div style="padding:15px; color:#666;">Aucune action enregistrée.</div>';
            return;
        }
        
        const html = details.map(item => {
            let icon = '⚪';
            let color = '#ccc';
            
            if (item.status === 'OK') { icon = '✅'; color = '#4ade80'; }
            else if (item.status === 'SKIPPED') { icon = '⏭️'; color = '#aaa'; }
            
            return `
                <div style="padding: 6px 15px; border-bottom: 1px solid #333; display:flex; gap:10px;">
                    <span style="color:#666; width:60px;">${item.time}</span>
                    <span>${icon}</span>
                    <span style="color:${color}; font-weight:bold;">${item.key}</span>
                </div>
            `;
        }).join('');
        
        drawer.innerHTML = html;
        // Scroll en bas auto
        drawer.scrollTop = drawer.scrollHeight;
    };

    statusBtn.onclick = toggleDrawer;

    // --- Run ---
    const runCycle = async () => {
        if(isRunning) return;
        isRunning = true;
        window.FormulaireTester.abort = false; 
        btnRun.style.display = 'none';
        btnStop.style.display = 'block';
        
        statusBtn.innerText = "⏳ Remplissage en cours... (Voir détails)";
        drawer.innerHTML = '<div style="padding:15px;">Démarrage...</div>';
        
        try {
            window.FormulaireTester.config.verbose = chkLogs.checked;

            // Le moteur V7.2 renvoie maintenant un objet { totalFilled, details }
            const result = await window.FormulaireTester.runPage(SCENARIO);
            
            const total = result.totalFilled;
            const details = result.details;

            if (window.FormulaireTester.abort) {
                statusBtn.innerHTML = `🛑 Stoppé (${total} remplis) <span style='font-size:10px'>▼</span>`;
            } else {
                statusBtn.innerHTML = `✅ Terminé (${total} remplis) <span style='font-size:10px'>▼</span>`;
            }
            
            // Affichage du rapport final dans le tiroir
            renderReport(details);

        } catch(e) {
            statusBtn.innerText = "❌ Erreur critique";
            drawer.innerHTML += `<div style="padding:15px; color:red;">${e.message}</div>`;
            console.error(e);
        } finally {
            isRunning = false;
            btnStop.style.display = 'none';
            btnRun.style.display = 'block';
        }
    };

    // --- Snapshot ---
    const downloadSnapshot = () => {
        const fullHTML = document.documentElement.outerHTML;
        const blob = new Blob([fullHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `snapshot_dom_${Date.now()}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    btnSnapshot.onclick = downloadSnapshot;
    btnRun.onclick = runCycle;
    btnStop.onclick = () => { window.FormulaireTester.abort = true; };

    chkLogs.onchange = () => {
        if(window.FormulaireTester) window.FormulaireTester.config.verbose = chkLogs.checked;
    };
})();