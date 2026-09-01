/*
 * Exécuté une fois au démarrage du serveur Next (voir la convention
 * instrumentation.ts). On force la résolution DNS à privilégier l'IPv4 :
 * certains environnements de dev (GitHub Codespaces notamment) n'ont pas
 * d'IPv6 fonctionnelle, et fetch() de Node tente l'adresse IPv6 en premier —
 * tous les appels vers Supabase échouent alors en « fetch failed ».
 * Sans incidence en production : l'ordre ipv4first reste valide partout.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const dns = await import("node:dns");
    dns.setDefaultResultOrder("ipv4first");
  }
}
