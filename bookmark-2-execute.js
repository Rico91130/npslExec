javascript:(function(){
    const clientCode = localStorage.getItem('MON_MOTEUR_CLIENT');
    if(clientCode) {
        window.eval(clientCode);
    } else {
        alert("⚠️ Outils non installés. Lancez 'Update Moteur' depuis la page d'accueil.");
        window.open('https://demarches.service-public.gouv.fr/', '_blank');
    }
})();
