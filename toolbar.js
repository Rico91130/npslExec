/**
 * TOOLBAR V4 - Avec Tiroir de Détails + Champs Non Remplis
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

    // --- LE TIROIR ---
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
            <button id="btnSnapshot" style="background:#333; color:#eee; border:1px solid #555; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px;">📸 HTML</button>
            <div style="width:1px; height:20px; background:#555; margin:0 5px;"></div>
            <button id="btnStopPage" style="display:none; background:#e1000f; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer; font-weight:bold;">⏹ Stop</button>
            <button id="btnRunPage" style="background:#000091; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer;">▶ Remplir</button>
        </div>
    `;
    
    document.body.appendChild(bar);

    const btnRun = document.getElementById('btnRunPage');
    const btnStop = document.getElementById('btnStopPage');
    const btnSnapshot = document.getElementById('btnSnapshot');
    const statusBtn = document.getElementById('status-btn');
    const chkLogs = document.getElementById('chkLogs');

    let isRunning = false;
    let isDrawerOpen = false;

    const toggleDrawer = () => {
        isDrawerOpen = !isDrawerOpen;
        drawer.style.maxHeight = isDrawerOpen ? '50vh' : '0'; 
        statusBtn.style.background = isDrawerOpen ? '#333' : 'none';
    };

    const renderReport = (result) => {
        const details = result.details || [];
        const untouched = result.untouched || [];
        
        if (details.length === 0 && untouched.length === 0) {
            drawer.innerHTML = '<div style="padding:15px; color:#666;">Aucune action enregistrée.</div>';
            return;
        }
        
        let html = '';

        // 1. Les actions effectuées
        html += details.map(item => {
            let icon = '⚪'; let color = '#ccc';
            if (item.status === 'OK') { icon = '✅'; color = '#4ade80'; }
            else if (item.status === 'SKIPPED') { icon = '⏭️'; color = '#888'; }
            return `
                <div style="padding: 4px 15px; border-bottom: 1px solid #333; display:flex; gap:10px; align-items:center;">
                    <span style="color:#555; font-size:10px; width:50px;">${item.time.split(' ')[0]}</span>
                    <span>${icon}</span>
                    <span style="color:${color}; font-weight:bold;">${item.key}</span>
                </div>
            `;
        }).join('');

        // 2. Les champs oubliés (Nouvelle section)
        if (untouched.length > 0) {
            html += `
                <div style="background:#3e2a00; color:#ffcc00; padding:8px 15px; font-weight:bold; border-bottom:1px solid #554400; margin-top:10px;">
                    ⚠️ Champs détectés mais non remplis (${untouched.length})
                </div>
            `;
            html += untouched.map(key => `
                <div style="padding: 4px 15px; border-bottom: 1px solid #333; display:flex; gap:10px; align-items:center; background:#2d2d2d;">
                    <span style="width:50px;"></span>
                    <span>⭕</span>
                    <span style="color:#eebb00;">${key}</span>
                </div>
            `).join('');
        }
        
        drawer.innerHTML = html;
        drawer.scrollTop = drawer.scrollHeight;
    };

    statusBtn.onclick = toggleDrawer;

    const runCycle = async () => {
        if(isRunning) return;
        isRunning = true;
        window.FormulaireTester.abort = false; 
        btnRun.style.display = 'none';
        btnStop.style.display = 'block';
        
        statusBtn.innerText = "⏳ Remplissage en cours... (Voir détails)";
        drawer.innerHTML = '<div style="padding:15px;">Analyse en cours...</div>';
        if(!isDrawerOpen) toggleDrawer(); // Ouverture auto au lancement
        
        try {
            window.FormulaireTester.config.verbose = chkLogs.checked;
            const result = await window.FormulaireTester.runPage(SCENARIO);
            
            const total = result.totalFilled;
            const untouchedCount = result.untouched ? result.untouched.length : 0;
            
            let statusHTML = `✅ Terminé : <b>${total}</b> remplis`;
            if (untouchedCount > 0) statusHTML += ` | <b style="color:#ffcc00">${untouchedCount}</b> vides`;
            
            if (window.FormulaireTester.abort) statusHTML = `🛑 Stoppé (${total} remplis)`;
            
            statusBtn.innerHTML = statusHTML + " <span style='font-size:10px'>▼</span>";
            renderReport(result);

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

    const downloadSnapshot = () => {
        const fullHTML = document.documentElement.outerHTML;
        const blob = new Blob([fullHTML], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `snapshot_dom_${Date.now()}.html`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    btnSnapshot.onclick = downloadSnapshot;
    btnRun.onclick = runCycle;
    btnStop.onclick = () => { window.FormulaireTester.abort = true; };
    chkLogs.onchange = () => { if(window.FormulaireTester) window.FormulaireTester.config.verbose = chkLogs.checked; };
})();