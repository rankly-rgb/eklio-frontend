"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/*
 * Rafraîchit la page de succès tant que le webhook n'a pas confirmé.
 *
 * Le décalage est structurel, pas accidentel : Stripe renvoie le navigateur
 * dès que le paiement est accepté, et notifie le serveur par un webhook qui
 * arrive quelques instants plus tard. Le front NE PEUT PAS accorder l'accès sur
 * la redirection — un `success_url` se forge à la main dans la barre d'adresse.
 * Il ne reste donc qu'à attendre, et à le dire.
 *
 * L'attente est BORNÉE. Une roue qui tourne indéfiniment ne dit rien de plus
 * qu'un écran figé : passé le délai, la page bascule sur un message qui nomme
 * la situation et donne une sortie.
 */

const INTERVAL_MS = 2500;
const TIMEOUT_MS = 45000;

export function ConfirmationPoll({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    const startedAt = Date.now();

    const timer = setInterval(() => {
      if (Date.now() - startedAt > TIMEOUT_MS) {
        setGaveUp(true);
        clearInterval(timer);
        return;
      }
      // Re-rend le composant serveur parent : c'est lui qui relit `purchases`.
      router.refresh();
    }, INTERVAL_MS);

    return () => clearInterval(timer);
  }, [router]);

  if (gaveUp) {
    return (
      <p className="text-body leading-prose text-ink-2">
        Your payment went through, but the confirmation is taking longer than
        usual to reach us. Nothing is lost — reload this page in a minute, or
        write to us and we&rsquo;ll sort it out. You will not be charged twice.
      </p>
    );
  }

  return <>{children}</>;
}
