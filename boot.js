(function(){
    const REPO = "https://raw.githubusercontent.com/Rico91130/npslExec/main/";
    const TS = Date.now(); 
    
    const FILES = [
        { name: 'moteur.js', key: 'TESTER_MOTEUR' },
        { name: 'strategies.js', key: 'TESTER_STRATEGIES' },
        { name: 'dashboard.js', key: 'TESTER_DASHBOARD' },
        { name: 'toolbar.js', key: 'TESTER_TOOLBAR' }
    ];

    console.log(`[Boot] Chargement des outils (TS: ${TS})...`);

    Promise.all(FILES.map(f => 
        fetch(REPO + f.name + '?t=' + TS)
        .then(r => {
            if (!r.ok) throw new Error("HTTP " + r.status + " sur " + f.name);
            return r.text();
        })
        .then(c => localStorage.setItem(f.key, c))
    ))
    .then(() => {
        console.log("[Boot] Outils chargés avec succès.");
        if (window.location.href.includes('/demarche') && localStorage.getItem('TESTER_SCENARIO')) {
             const toolbarCode = localStorage.getItem('TESTER_TOOLBAR');
             if(toolbarCode) window.eval(toolbarCode);
        } else {
             const dashCode = localStorage.getItem('TESTER_DASHBOARD');
             if(dashCode) window.eval(dashCode);
        }
    })
    .catch(e => alert("Erreur Bootloader : " + e));
})();