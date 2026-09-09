/*
 * Exécuté une fois au démarrage du serveur Next (voir la convention
 * instrumentation.ts). On force la résolution DNS à privilégier l'IPv4 :
 * certains environnements de dev (GitHub Codespaces notamment) n'ont pas
 * d'IPv6 fonctionnelle, et fetch() de Node tente l'adresse IPv6 en premier —
 * tous les appels vers Supabase échouent alors en « fetch failed ».
 * Sans incidence en production : l'ordre ipv4first reste valide partout.
 *
 * On en profite pour REFUSER DE DÉMARRER si une variable dont l'absence est
 * silencieuse manque en production (cf. `lib/env/required.ts`). C'est le seul
 * moment où une erreur de configuration peut encore être vue par la personne
 * qui vient de déployer, plutôt que trente jours plus tard par une cliente qui
 * se fait prélever sans avoir été prévenue.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const dns = await import("node:dns");
    dns.setDefaultResultOrder("ipv4first");

    /*
     * Importé PARESSEUSEMENT et après le DNS : ce module lève, et on veut que
     * le réglage réseau ci-dessus soit posé même sur un boot qui va échouer —
     * sinon l'erreur qui remonte peut être un « fetch failed » sans rapport
     * plutôt que le vrai motif.
     */
    const { assertRequiredEnv } = await import("@/lib/env/required");
    assertRequiredEnv();
  }
}
