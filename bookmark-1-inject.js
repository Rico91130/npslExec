javascript:(function(){
    const bootUrl = "https://raw.githubusercontent.com/Rico91130/npslExec/main/boot.js";
    fetch(bootUrl + '?t=' + Date.now())
        .then(r => r.text())
        .then(code => window.eval(code))
        .catch(e => alert("Impossible de charger le bootloader : " + e));
})();