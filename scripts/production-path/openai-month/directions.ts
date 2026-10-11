/*
 * ── TROIS DIRECTIONS POUR LE KIT LOCAL — HARNAIS ────────────────────────
 *
 * ⚠ ÉTIQUETTE : en production, les directions sortent de
 * `/api/briefs/[id]/generate`. Le kit local de `setup.ts` n'en a pas, et la porte
 * produit (`month/run-for-kit.ts`) lit la palette de la direction RETENUE, comme
 * la page de lecture. Ce script en pose trois, validées par `directionsSchema`,
 * sur trois familles du catalogue, et retient celle qu'on lui nomme.
 *
 *   bun scripts/production-path/openai-month/directions.ts --kit <id> --family slate_bone
 */
import { localDb } from "../local-db";
import { arg } from "./session";
import { directionsSchema } from "@/lib/brand/shapes";

const KIT = arg("--kit");
const RETAINED = arg("--family") ?? "slate_bone";
if (!KIT) throw new Error("--kit <brand_kit_id> manquant");

const db = localDb();
const families = (await db.read<Record<string, string>>(
  "select id, primary_hex, secondary_hex, light_hex, dark_hex, paper_hex from public.palette_families where active order by sort_order"
)) as Array<Record<string, string>>;
const pick = [RETAINED, ...families.map((f) => f.id).filter((id) => id !== RETAINED)].slice(0, 3);
const FONTS = ["Fraunces", "Lora", "Source Serif 4"];
const directions = pick.map((id, i) => {
  const f = families.find((x) => x.id === id)!;
  return {
    id: `d-${id}`,
    name: ["Steady", "Quiet Room", "Plain Light"][i],
    rationale: "A calm, plain direction built on this palette and a readable serif for long text.",
    about_excerpt: "Therapy for adults carrying something they never named.",
    palette: { primary: f.primary_hex, secondary: f.secondary_hex, light: f.light_hex, dark: f.dark_hex, paper: f.paper_hex },
    hero: {
      overline: "LMFT · OAKLAND, CA",
      headline: "You don't need it figured out to start.",
      subhead: "Therapy for adults carrying something they never named.",
      cta_label: "Book a consult",
    },
    typography: { heading_font: FONTS[i], body_font: "Nunito Sans", google_fonts_url: `https://fonts.googleapis.com/css2?family=${FONTS[i].replace(/ /g, "+")}&display=swap` },
    tone_keywords: ["steady", "plain", "warm"],
    rendering: { cta_shape: "pill", cta_style: "solid", nav_surface: "light" },
  };
});
const parsed = directionsSchema.safeParse(directions);
if (!parsed.success) throw new Error(`directions refusées par le schéma : ${parsed.error.issues[0]?.message}`);
const { error } = await db.from("brand_kits").update({ directions, selected_direction_id: `d-${RETAINED}` }).eq("id", KIT);
if (error) throw new Error(`brand_kits: ${error.message}`);
console.log(JSON.stringify({ kit: KIT, retained: `d-${RETAINED}`, palettes: pick }));
await db.close();
