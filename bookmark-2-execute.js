javascript:(function(){
    const code = localStorage.getItem('MON_TOOLBAR');
    if(code) window.eval(code);
    else alert("Toolbar non installée !");
})();
