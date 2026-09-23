import type { Box, Stroke } from "@/lib/compose/types";

/*
 * ── LA BIBLIOTHÈQUE DE DESSINS ──────────────────────────────────────────
 *
 * ⚠ CE QU'IL Y AVAIT AVANT N'ÉTAIT PAS UNE ILLUSTRATION. Les onze archétypes
 * portaient de l'ÉCHAFAUDAGE : un cercle, deux axes, un trait vertical, une
 * accolade, une épine. Des repères de mise en page, pas des objets. Un cercle
 * vide ne dit rien du contrôle, et un trait horizontal ne dit rien de ce qui
 * se passe sous la surface.
 *
 * Chaque objet ici est dessiné pour PORTER LE SENS du diagramme qu'il
 * accompagne : la forme qui émerge d'une ligne d'eau dit « surface et
 * profondeur » ; le fil noué dit la rumination ; l'ancre dit l'ancrage.
 *
 * ── LES RÈGLES DE TRACÉ, IDENTIQUES POUR TOUS ───────────────────────────
 *
 *   * trait continu, épaisseur 3 à 5px, extrémités arrondies ;
 *   * aucun remplissage, aucun dégradé, aucune ombre ;
 *   * le dessin tient DANS sa boîte, qui est ce que le contrôle de
 *     dégagement mesure — un tracé qui déborde de sa boîte passerait le
 *     contrôle et toucherait quand même un glyphe.
 *
 * ⚠ ET CHAQUE OBJET EST DESSINÉ ICI, jamais importé ni recopié d'ailleurs.
 */

export const STROKE_WIDTH = 4;

/** Une courbe, avec sa boîte donnée plutôt que déduite du chemin. */
function stroke(d: string, box: Box, colour: string, width = STROKE_WIDTH): Stroke {
  return { kind: "path", d, box, stroke: colour, strokeWidth: width, fill: "none" };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** La boîte d'un tracé : la zone demandée, gonflée d'une demi-épaisseur. */
function pad(box: Box, width: number): Box {
  const half = width / 2;
  return { x: r2(box.x - half), y: r2(box.y - half), w: r2(box.w + width), h: r2(box.h + width) };
}

/** Le carré centré le plus grand qui tienne dans `box`, réduit de `scale`. */
export function squareIn(box: Box, scale = 1): Box {
  const size = r2(Math.min(box.w, box.h) * scale);
  return { x: r2(box.x + (box.w - size) / 2), y: r2(box.y + (box.h - size) / 2), w: size, h: size };
}

export type Drawing = (box: Box, colour: string, width?: number) => Stroke[];

/* ── Surface et profondeur ─────────────────────────────────────────────
 *
 * Une ligne d'eau, et une forme arrondie qui la traverse : au-dessus un arc
 * net, au-dessous le même volume en pointillé de trait continu plus léger.
 * C'est l'iceberg sans être un iceberg — la part qu'on voit et la part qui
 * porte.
 */
export const surfacing: Drawing = (box, colour, width = STROKE_WIDTH) => {
  const { x, y, w, h } = box;
  const waterY = r2(y + h * 0.4);
  const cx = r2(x + w / 2);
  /*
   * ── ⚠ TROIS FOIS LA MÊME REMARQUE : « UNE TACHE POSÉE SUR UN TRAIT » ──
   *
   * Deux corrections avaient déjà visé la TAILLE — les rayons se calaient sur
   * `min(w, h)`, puis la masse s'étalait trop. Le contrôle indépendant du mois
   * rendu a nommé ce qui restait, sur trois cartes à la fois : « blob ».
   *
   * Le défaut n'était pas la taille, c'était la JONCTION. Un petit dôme et une
   * grande masse ronde qui se rejoignent tangentiellement font un œuf, et un
   * œuf traversé d'une ligne se lit comme un nuage — pas comme une forme dont
   * l'eau cache les quatre cinquièmes.
   *
   * Ce qui fait lire « émergé / immergé », c'est le CONTRASTE entre les deux
   * moitiés : au-dessus une pointe, en dessous des flancs qui s'évasent d'un
   * coup et un fond plat. La ligne d'eau tombe alors sur une discontinuité au
   * lieu de couper un ovale en deux.
   */
  const deepR = r2(Math.min(h * 0.44, w * 0.3));
  const topR = r2(Math.min(deepR * 0.72, h * 0.36));
  const deepW = r2(deepR * 1.6);
  const floorY = r2(waterY + deepR * 1.3);
  /*
   * ⚠ LA COUPURE SE FAIT OÙ LA FORME TRAVERSE, PAS OÙ ELLE EST LA PLUS LARGE.
   * Interrompue sur la largeur de la masse IMMERGÉE, la ligne d'eau ne gardait
   * que deux moignons contre les bords : plus rien ne se lisait comme une
   * surface. La forme croise l'eau à ±`topR` ; c'est là qu'on l'ouvre.
   */
  const cut = r2(topR + 18);
  return [
    // La ligne d'eau, interrompue là où la forme la traverse.
    stroke(`M ${r2(x)} ${waterY} L ${r2(cx - cut)} ${waterY}`,
      pad({ x, y: waterY, w: r2(cx - cut - x), h: 0 }, width), colour, width),
    stroke(`M ${r2(cx + cut)} ${waterY} L ${r2(x + w)} ${waterY}`,
      pad({ x: r2(cx + cut), y: waterY, w: r2(x + w - cx - cut), h: 0 }, width), colour, width),
    // Ce qui dépasse : une pointe, pas un dôme.
    stroke(
      `M ${r2(cx - topR)} ${waterY} L ${r2(cx - topR * 0.2)} ${r2(waterY - topR)} ` +
        `L ${r2(cx + topR * 0.45)} ${r2(waterY - topR * 0.55)} L ${r2(cx + topR)} ${waterY}`,
      pad({ x: r2(cx - topR), y: r2(waterY - topR), w: r2(topR * 2), h: topR }, width), colour, width
    ),
    // Ce qui porte : des flancs qui s'évasent et un fond plat.
    stroke(
      `M ${r2(cx - topR)} ${waterY} L ${r2(cx - deepW)} ${r2(waterY + deepR * 0.55)} ` +
        `L ${r2(cx - deepW * 0.72)} ${floorY} L ${r2(cx + deepW * 0.72)} ${floorY} ` +
        `L ${r2(cx + deepW)} ${r2(waterY + deepR * 0.55)} L ${r2(cx + topR)} ${waterY}`,
      pad({ x: r2(cx - deepW), y: waterY, w: r2(deepW * 2), h: r2(floorY - waterY) }, width), colour, width
    ),
  ];
};

/* ── L'ancre ───────────────────────────────────────────────────────────
 * Pour ce qui tient quand le reste bouge : une technique, un point d'appui.
 */
export const anchor: Drawing = (box, colour, width = STROKE_WIDTH) => {
  const s = squareIn(box, 0.86);
  const cx = r2(s.x + s.w / 2);
  const ringR = r2(s.h * 0.11);
  const top = r2(s.y + ringR * 2);
  const bottom = r2(s.y + s.h * 0.86);
  const armY = r2(s.y + s.h * 0.34);
  const armHalf = r2(s.w * 0.22);
  const flukeHalf = r2(s.w * 0.34);
  return [
    stroke(`M ${cx} ${r2(s.y + ringR)} m ${-ringR} 0 a ${ringR} ${ringR} 0 1 0 ${r2(ringR * 2)} 0 a ${ringR} ${ringR} 0 1 0 ${r2(-ringR * 2)} 0`,
      pad({ x: r2(cx - ringR), y: s.y, w: r2(ringR * 2), h: r2(ringR * 2) }, width), colour, width),
    stroke(`M ${cx} ${top} L ${cx} ${bottom}`,
      pad({ x: cx, y: top, w: 0, h: r2(bottom - top) }, width), colour, width),
    stroke(`M ${r2(cx - armHalf)} ${armY} L ${r2(cx + armHalf)} ${armY}`,
      pad({ x: r2(cx - armHalf), y: armY, w: r2(armHalf * 2), h: 0 }, width), colour, width),
    stroke(
      `M ${r2(cx - flukeHalf)} ${r2(bottom - s.h * 0.2)} C ${r2(cx - flukeHalf)} ${bottom} ` +
        `${r2(cx - s.w * 0.1)} ${bottom} ${cx} ${bottom} ` +
        `C ${r2(cx + s.w * 0.1)} ${bottom} ${r2(cx + flukeHalf)} ${bottom} ` +
        `${r2(cx + flukeHalf)} ${r2(bottom - s.h * 0.2)}`,
      pad({ x: r2(cx - flukeHalf), y: r2(bottom - s.h * 0.2), w: r2(flukeHalf * 2), h: r2(s.h * 0.2) }, width),
      colour, width
    ),
  ];
};

/* ── La vague et sa crête ──────────────────────────────────────────────
 * Une intensité qui monte, casse, et redescend. Pour les courbes annotées.
 */
export const wave: Drawing = (box, colour, width = STROKE_WIDTH) => {
  const { x, y, w, h } = box;
  const baseY = r2(y + h * 0.78);
  const crestX = r2(x + w * 0.56);
  const crestY = r2(y + h * 0.16);
  return [
    stroke(
      `M ${r2(x)} ${baseY} C ${r2(x + w * 0.22)} ${baseY} ${r2(x + w * 0.3)} ${crestY} ${crestX} ${crestY} ` +
        `C ${r2(x + w * 0.78)} ${crestY} ${r2(x + w * 0.82)} ${r2(baseY - h * 0.22)} ${r2(x + w)} ${r2(baseY - h * 0.3)}`,
      pad({ x, y: crestY, w, h: r2(baseY - crestY) }, width), colour, width
    ),
    // La crête qui casse : un petit retour sur elle-même.
    stroke(
      `M ${crestX} ${crestY} C ${r2(crestX + w * 0.1)} ${r2(crestY - h * 0.08)} ` +
        `${r2(crestX + w * 0.16)} ${r2(crestY + h * 0.06)} ${r2(crestX + w * 0.07)} ${r2(crestY + h * 0.12)}`,
      pad({ x: crestX, y: r2(crestY - h * 0.08), w: r2(w * 0.16), h: r2(h * 0.2) }, width), colour, width
    ),
  ];
};

/* ── Le profil ─────────────────────────────────────────────────────────
 * Une tête de profil, ouverte à l'arrière : ce qui se passe dedans.
 */
export const profile: Drawing = (box, colour, width = STROKE_WIDTH) => {
  const s = squareIn(box, 0.94);
  const { x, y, w, h } = s;
  const X = (u: number) => r2(x + w * u);
  const Y = (v: number) => r2(y + h * v);
  /*
   * ⚠ SANS NEZ NI MENTON, CE N'EST PAS UN PROFIL, C'EST UN POUCE. La première
   * version était une courbe fermée et lisse des deux côtés : elle se lisait
   * comme un galet. Un profil ne tient qu'à trois accidents — l'arcade, le
   * nez, le menton — et ils se tracent explicitement.
   */
  return [
    stroke(
      // Nuque, arrière du crâne, sommet.
      `M ${X(0.2)} ${Y(1)} C ${X(0.1)} ${Y(0.7)} ${X(0.12)} ${Y(0.28)} ${X(0.4)} ${Y(0.14)} ` +
        // Front.
        `C ${X(0.62)} ${Y(0.06)} ${X(0.82)} ${Y(0.2)} ${X(0.79)} ${Y(0.38)} ` +
        // Arcade, nez, base du nez.
        `L ${X(0.72)} ${Y(0.47)} L ${X(0.82)} ${Y(0.61)} L ${X(0.7)} ${Y(0.65)} ` +
        // Lèvres.
        `C ${X(0.75)} ${Y(0.7)} ${X(0.68)} ${Y(0.73)} ${X(0.72)} ${Y(0.77)} ` +
        // Menton, puis mâchoire jusqu'au cou.
        `C ${X(0.76)} ${Y(0.85)} ${X(0.64)} ${Y(0.89)} ${X(0.56)} ${Y(0.89)} ` +
        `C ${X(0.5)} ${Y(0.93)} ${X(0.49)} ${Y(0.96)} ${X(0.49)} ${Y(1)}`,
      pad({ x: X(0.1), y: Y(0.06), w: r2(w * 0.72), h: r2(h * 0.94) }, width), colour, width
    ),
  ];
};

/* ── La plante en pot ──────────────────────────────────────────────────
 * Ce qui pousse parce qu'on s'en occupe. Pour les stratégies, les étapes.
 */
export const plant: Drawing = (box, colour, width = STROKE_WIDTH) => {
  const s = squareIn(box, 0.9);
  const { x, y, w, h } = s;
  const X = (u: number) => r2(x + w * u);
  const Y = (v: number) => r2(y + h * v);
  /*
   * ⚠ LES FEUILLES SORTAIENT DE LEUR BOÎTE, ET UNE BOÎTE FAUSSE EST PIRE
   * QU'UN DESSIN LAID. C'est la boîte — pas le tracé — que le contrôle de
   * dégagement mesure : une feuille qui déborde de la sienne passe le contrôle
   * et touche quand même le glyphe d'à côté. Les deux feuilles sont
   * maintenant des amandes fermées, chacune dans la boîte qu'elle déclare.
   */
  return [
    // Le pot, et la ligne de terre qui le ferme.
    stroke(
      `M ${X(0.24)} ${Y(0.6)} L ${X(0.33)} ${Y(0.98)} L ${X(0.67)} ${Y(0.98)} L ${X(0.76)} ${Y(0.6)} Z`,
      pad({ x: X(0.24), y: Y(0.6), w: r2(w * 0.52), h: r2(h * 0.38) }, width), colour, width
    ),
    // La tige.
    stroke(
      `M ${X(0.5)} ${Y(0.6)} C ${X(0.46)} ${Y(0.44)} ${X(0.53)} ${Y(0.28)} ${X(0.5)} ${Y(0.1)}`,
      pad({ x: X(0.45), y: Y(0.1), w: r2(w * 0.09), h: r2(h * 0.5) }, width), colour, width
    ),
    // Feuille gauche.
    stroke(
      `M ${X(0.5)} ${Y(0.45)} C ${X(0.24)} ${Y(0.44)} ${X(0.13)} ${Y(0.24)} ${X(0.4)} ${Y(0.2)} ` +
        `C ${X(0.48)} ${Y(0.28)} ${X(0.51)} ${Y(0.37)} ${X(0.5)} ${Y(0.45)} Z`,
      pad({ x: X(0.13), y: Y(0.2), w: r2(w * 0.38), h: r2(h * 0.25) }, width), colour, width
    ),
    // Feuille droite, un peu plus haute.
    stroke(
      `M ${X(0.5)} ${Y(0.36)} C ${X(0.76)} ${Y(0.34)} ${X(0.87)} ${Y(0.14)} ${X(0.6)} ${Y(0.1)} ` +
        `C ${X(0.52)} ${Y(0.18)} ${X(0.49)} ${Y(0.28)} ${X(0.5)} ${Y(0.36)} Z`,
      pad({ x: X(0.49), y: Y(0.1), w: r2(w * 0.38), h: r2(h * 0.26) }, width), colour, width
    ),
  ];
};

/* ── Les nuages ────────────────────────────────────────────────────────
 * Des états qui passent. Deux masses, l'une derrière l'autre.
 */
export const clouds: Drawing = (box, colour, width = STROKE_WIDTH) => {
  const { x, y, w, h } = box;
  const cloud = (ox: number, oy: number, scale: number): Stroke => {
    const cw = r2(w * 0.52 * scale);
    const ch = r2(h * 0.34 * scale);
    const bx = r2(x + ox);
    const by = r2(y + oy);
    return stroke(
      `M ${bx} ${r2(by + ch)} C ${r2(bx - cw * 0.12)} ${r2(by + ch * 0.55)} ${r2(bx + cw * 0.06)} ${r2(by + ch * 0.2)} ` +
        `${r2(bx + cw * 0.28)} ${r2(by + ch * 0.3)} C ${r2(bx + cw * 0.34)} ${by} ${r2(bx + cw * 0.72)} ${by} ` +
        `${r2(bx + cw * 0.78)} ${r2(by + ch * 0.34)} C ${r2(bx + cw)} ${r2(by + ch * 0.3)} ${r2(bx + cw * 1.08)} ${r2(by + ch)} ` +
        `${r2(bx + cw * 0.86)} ${r2(by + ch)} Z`,
      pad({ x: r2(bx - cw * 0.14), y: by, w: r2(cw * 1.24), h: r2(ch * 1.02) }, width), colour, width
    );
  };
  return [cloud(w * 0.04, h * 0.14, 1), cloud(w * 0.3, h * 0.5, 0.78)];
};

/* ── La fenêtre et son rebord ──────────────────────────────────────────
 * La fenêtre de tolérance : un cadre, une croisée, un rebord qui dépasse.
 */
export const window_: Drawing = (box, colour, width = STROKE_WIDTH) => {
  const s = squareIn(box, 0.82);
  const { x, y, w, h } = s;
  const frameH = r2(h * 0.82);
  return [
    stroke(`M ${r2(x)} ${r2(y)} L ${r2(x + w)} ${r2(y)} L ${r2(x + w)} ${r2(y + frameH)} L ${r2(x)} ${r2(y + frameH)} Z`,
      pad({ x, y, w, h: frameH }, width), colour, width),
    stroke(`M ${r2(x + w / 2)} ${r2(y)} L ${r2(x + w / 2)} ${r2(y + frameH)}`,
      pad({ x: r2(x + w / 2), y, w: 0, h: frameH }, width), colour, width),
    stroke(`M ${r2(x)} ${r2(y + frameH / 2)} L ${r2(x + w)} ${r2(y + frameH / 2)}`,
      pad({ x, y: r2(y + frameH / 2), w, h: 0 }, width), colour, width),
    stroke(`M ${r2(x - w * 0.08)} ${r2(y + frameH + h * 0.06)} L ${r2(x + w * 1.08)} ${r2(y + frameH + h * 0.06)}`,
      pad({ x: r2(x - w * 0.08), y: r2(y + frameH + h * 0.06), w: r2(w * 1.16), h: 0 }, width), colour, width),
  ];
};

/* ── Le fil noué ───────────────────────────────────────────────────────
 * La rumination : une ligne qui revient sur elle-même et se serre.
 */
export const knot: Drawing = (box, colour, width = STROKE_WIDTH) => {
  /*
   * ⚠ PAS DE `squareIn` ICI, ET PAS D'ORIENTATION FIXE. Le fil est une ligne
   * qui TRAVERSE la carte et se noue au milieu ; l'enfermer dans le carré
   * centré le réduisait à la plus petite dimension de sa boîte — un
   * gribouillis de 150px au centre d'une bande de 900 de large.
   *
   * Il court donc sur le grand côté de sa boîte, horizontalement dans une
   * bande, verticalement dans une gouttière. Le nœud lui-même reste carré :
   * c'est `rr`. Les deux brins vont jusqu'aux bords.
   */
  const vertical = box.h > box.w;
  // Sur l'axe du parcours (`run`) et sur l'axe de l'amplitude (`across`).
  const runLen = vertical ? box.h : box.w;
  const acrossLen = vertical ? box.w : box.h;
  const runO = vertical ? box.y : box.x;
  const acrossO = vertical ? box.x : box.y;
  const midAcross = r2(acrossO + acrossLen / 2);
  const midRun = r2(runO + runLen / 2);
  /*
   * ⚠ 0.26 ET PAS 0.34, PARCE QUE LES POINTS DE CONTRÔLE VONT JUSQU'À
   * `rr * 1.8`. À 0.34 le nœud demandait 61 % de la demi-amplitude là où il
   * n'en a que 50 : deux points de contrôle tombaient hors de la boîte, quelle
   * que soit sa taille. Le plafond est donc 0.48 / 1.8.
   */
  const rr = r2(Math.min(runLen * 0.16, acrossLen * 0.26));

  // `at` projette un point (le long du parcours, en travers) vers la page.
  const at = (run: number, across: number): string =>
    vertical ? `${r2(across)} ${r2(run)}` : `${r2(run)} ${r2(across)}`;

  const d =
    `M ${at(runO, midAcross + acrossLen * 0.28)} ` +
    `C ${at(runO + runLen * 0.1, midAcross + acrossLen * 0.1)} ` +
    `${at(midRun - rr * 1.6, midAcross + rr)} ${at(midRun - rr, midAcross)} ` +
    `C ${at(midRun - rr * 0.4, midAcross - rr * 1.5)} ` +
    `${at(midRun + rr * 1.2, midAcross - rr * 1.2)} ${at(midRun + rr * 0.6, midAcross + rr * 0.3)} ` +
    `C ${at(midRun + rr * 0.1, midAcross + rr * 1.3)} ` +
    `${at(midRun - rr * 1.1, midAcross + rr * 0.9)} ${at(midRun - rr * 0.2, midAcross - rr * 0.5)} ` +
    `C ${at(midRun + rr * 0.8, midAcross - rr * 1.8)} ` +
    `${at(runO + runLen * 0.9, midAcross - acrossLen * 0.2)} ${at(runO + runLen, midAcross - acrossLen * 0.3)}`;

  const runBox = { from: runO, size: runLen };
  /*
   * ⚠ TOUTE L'AMPLITUDE, PAS 66 %. Les points de contrôle des béziers du nœud
   * sortent largement de la courbe qu'ils dessinent ; une boîte serrée sur le
   * tracé visible en laissait cinq dehors, et une boîte trop petite est un
   * dégagement qu'on annonce sans l'avoir.
   */
  const acrossBox = { from: acrossO, size: acrossLen };
  const drawn = vertical
    ? { x: acrossBox.from, y: runBox.from, w: acrossBox.size, h: runBox.size }
    : { x: runBox.from, y: acrossBox.from, w: runBox.size, h: acrossBox.size };

  return [stroke(d, pad(drawn, width), colour, width)];
};

/* ── La silhouette assise ──────────────────────────────────────────────
 * Quelqu'un qui reste. Au centre des anneaux de contrôle.
 */
export const seated: Drawing = (box, colour, width = STROKE_WIDTH) => {
  const s = squareIn(box, 0.88);
  const { x, y, w, h } = s;
  const X = (u: number) => r2(x + w * u);
  const Y = (v: number) => r2(y + h * v);
  const headR = r2(h * 0.12);
  const headCx = X(0.34);
  const headCy = r2(Y(0.14));
  /*
   * ⚠ UNE TÊTE QUI FLOTTE ET UN « J » NE FONT PAS QUELQU'UN D'ASSIS. La
   * première version laissait un vide entre le cercle et le tronc, et la
   * jambe s'arrêtait sans pied : au centre des anneaux, ça se lisait comme
   * deux traits sans rapport. Le tronc part maintenant du bas de la tête, la
   * cuisse est horizontale, la jambe descend jusqu'au sol.
   */
  return [
    stroke(
      `M ${headCx} ${r2(headCy - headR)} ` +
        `a ${headR} ${headR} 0 1 0 0 ${r2(headR * 2)} a ${headR} ${headR} 0 1 0 0 ${r2(-headR * 2)}`,
      pad({ x: r2(headCx - headR), y: r2(headCy - headR), w: r2(headR * 2), h: r2(headR * 2) }, width),
      colour, width
    ),
    // Dos, cuisse, jambe : un seul trait continu.
    stroke(
      `M ${headCx} ${r2(headCy + headR)} C ${X(0.25)} ${Y(0.4)} ${X(0.27)} ${Y(0.56)} ${X(0.38)} ${Y(0.63)} ` +
        `L ${X(0.78)} ${Y(0.63)} L ${X(0.8)} ${Y(0.87)}`,
      pad({ x: X(0.25), y: r2(headCy + headR), w: r2(w * 0.55), h: r2(Y(0.87) - headCy - headR) }, width),
      colour, width
    ),
    // Le sol.
    stroke(`M ${X(0.12)} ${Y(0.93)} L ${X(0.9)} ${Y(0.93)}`,
      pad({ x: X(0.12), y: Y(0.93), w: r2(w * 0.78), h: 0 }, width), colour, width),
  ];
};

/* ── La porte entrouverte ──────────────────────────────────────────────
 * Ce qui s'ouvre : un premier rendez-vous, une carte praticienne.
 */
export const door: Drawing = (box, colour, width = STROKE_WIDTH) => {
  const s = squareIn(box, 0.8);
  const { x, y, w, h } = s;
  return [
    stroke(`M ${r2(x + w * 0.1)} ${r2(y)} L ${r2(x + w * 0.1)} ${r2(y + h)} L ${r2(x + w * 0.62)} ${r2(y + h)} L ${r2(x + w * 0.62)} ${r2(y)} Z`,
      pad({ x: r2(x + w * 0.1), y, w: r2(w * 0.52), h }, width), colour, width),
    stroke(`M ${r2(x + w * 0.62)} ${r2(y + h * 0.06)} L ${r2(x + w * 0.94)} ${r2(y + h * 0.16)} L ${r2(x + w * 0.94)} ${r2(y + h * 0.9)} L ${r2(x + w * 0.62)} ${r2(y + h)}`,
      pad({ x: r2(x + w * 0.62), y: r2(y + h * 0.06), w: r2(w * 0.32), h: r2(h * 0.94) }, width), colour, width),
    // ⚠ EN ABSOLU. `l 0 24` ne dit son extension qu'à qui sait où commence le
    // trait ; la suite qui vérifie les boîtes lisait « 0 » comme une abscisse.
    stroke(`M ${r2(x + w * 0.7)} ${r2(y + h * 0.56)} L ${r2(x + w * 0.7)} ${r2(y + h * 0.62)}`,
      pad({ x: r2(x + w * 0.7), y: r2(y + h * 0.56), w: 0, h: r2(h * 0.06) }, width), colour, width),
  ];
};

/* ── La marque ─────────────────────────────────────────────────────────
 * Un petit trait dessiné sous une phrase seule. Pas un ornement : la
 * respiration qui dit que la phrase s'arrête là.
 */
export const mark: Drawing = (box, colour, width = STROKE_WIDTH) => {
  const { x, y, w } = box;
  const len = r2(Math.min(w, 220));
  return [
    stroke(
      `M ${r2(x)} ${r2(y)} C ${r2(x + len * 0.3)} ${r2(y - 9)} ${r2(x + len * 0.7)} ${r2(y + 9)} ${r2(x + len)} ${r2(y)}`,
      pad({ x, y: r2(y - 9), w: len, h: 18 }, width), colour, width
    ),
  ];
};

/* ── La bulle ──────────────────────────────────────────────────────────
 * Pour les paires de comparaison : deux façons de dire la même situation.
 */
export function bubble(box: Box, colour: string, pointLeft: boolean, width = STROKE_WIDTH): Stroke[] {
  const { x, y, w, h } = box;
  const r = r2(Math.min(w, h) * 0.22);
  const tailX = pointLeft ? r2(x + w * 0.18) : r2(x + w * 0.82);
  const dir = pointLeft ? -1 : 1;
  return [
    stroke(
      `M ${r2(x + r)} ${r2(y)} L ${r2(x + w - r)} ${r2(y)} A ${r} ${r} 0 0 1 ${r2(x + w)} ${r2(y + r)} ` +
        `L ${r2(x + w)} ${r2(y + h - r)} A ${r} ${r} 0 0 1 ${r2(x + w - r)} ${r2(y + h)} ` +
        `L ${r2(x + r)} ${r2(y + h)} A ${r} ${r} 0 0 1 ${r2(x)} ${r2(y + h - r)} ` +
        `L ${r2(x)} ${r2(y + r)} A ${r} ${r} 0 0 1 ${r2(x + r)} ${r2(y)} Z`,
      pad(box, width), colour, width
    ),
    stroke(
      `M ${tailX} ${r2(y + h)} L ${r2(tailX + dir * w * 0.07)} ${r2(y + h + h * 0.16)} L ${r2(tailX + dir * w * 0.16)} ${r2(y + h)}`,
      /*
       * ⚠ LA BOÎTE ÉTAIT DU MAUVAIS CÔTÉ QUAND LA QUEUE POINTE À GAUCHE. Elle
       * partait de `tailX - 0.07w` et s'étendait vers la DROITE sur 0.16w,
       * alors que la queue descend vers `tailX - 0.16w` : la pointe tombait
       * hors de sa propre boîte, et donc hors de tout contrôle de dégagement.
       */
      pad({ x: pointLeft ? r2(tailX - w * 0.16) : tailX, y: r2(y + h), w: r2(w * 0.16), h: r2(h * 0.16) }, width),
      colour, width
    ),
  ];
}

/*
 * ── DEUX ORIENTATIONS PAR OBJET ─────────────────────────────────────────
 *
 * ⚠ UNE NOTATION INDÉPENDANTE A COMPTÉ LES RÉUTILISATIONS AU PIXEL : « porte
 * (encre 3811, 193×228 en 448,818) sur 09/18/24/36 ; anneaux (3310, 290×289)
 * sur 19/31 ; fil (4404, 229×634) sur 06/16 ». Onze archétypes, six dessins,
 * identiques à l'octet près — « l'ensemble se lit uniforme même là où chaque
 * carte est correcte ».
 *
 * La spécification veut UN objet par archétype, et elle a raison : c'est ce
 * qui fait qu'un mois se lit comme un système. Mais un objet n'est pas une
 * image. Retourner l'ancre, orienter la porte de l'autre côté, faire regarder
 * le profil à gauche — c'est le même objet, et deux cartes voisines cessent
 * d'être la même carte.
 *
 * ⚠ LE MIROIR RETOURNE AUSSI LES BOÎTES. C'est la boîte, jamais le chemin,
 * que le contrôle de dégagement lit : un `transform` SVG seul déplacerait
 * l'encre en laissant les boîtes derrière, et on mesurerait la distance à un
 * dessin qui n'est plus là.
 */
export function mirrored(strokes: Stroke[], box: Box): { strokes: Stroke[]; transform: string } {
  const axis = box.x + box.w / 2;
  return {
    transform: `translate(${r2(axis * 2)}, 0) scale(-1, 1)`,
    strokes: strokes.map((s) => ({
      ...s,
      box: { ...s.box, x: r2(axis * 2 - (s.box.x + s.box.w)) },
    })),
  };
}

/**
 * L'orientation à donner à cette carte-ci : 0 tel quel, 1 retourné.
 *
 * ⚠ DÉTERMINISTE, PARCE QUE LE CACHE DE RENDU L'EXIGE. `rendered_assets` est
 * indexé sur un hachage de (archétype + payload + palette + typographie) : si
 * l'orientation était tirée au hasard, deux rendus du même post différeraient
 * et le cache servirait le premier pour toujours. Elle se déduit donc de la
 * clef de palette, qui est déjà propre à la carte.
 */
export function variantOf(paletteKey: string): number {
  let h = 0;
  for (let i = 0; i < paletteKey.length; i += 1) h = (h * 31 + paletteKey.charCodeAt(i)) | 0;
  return Math.abs(h) % 2;
}

/** Ce que chaque archétype dessine, nommé une fois. */
export const DRAWING_FOR: Record<string, Drawing> = {
  surface_and_beneath: surfacing,
  lettered_technique: anchor,
  annotated_curve: wave,
  quadrant_model: profile,
  numbered_strategies: plant,
  cycle: knot,
  concentric_control: seated,
  practitioner_card: door,
  single_statement: mark,
};
