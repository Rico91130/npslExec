javascript:(function(){
    const code = localStorage.getItem('TESTER_TOOLBAR');
    if(code) window.eval(code);
    else alert("Toolbar non installée !");
})();
