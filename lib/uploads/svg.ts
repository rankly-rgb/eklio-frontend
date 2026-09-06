/*
 * ── SANITISING AN SVG ───────────────────────────────────────────────────
 *
 * An SVG is a document, not a picture. It can carry script, fetch a remote
 * resource, embed an HTML subtree, or ask the XML parser to expand an entity
 * into a gigabyte. A practice arrives with its old logo in one, so we accept
 * them — which means we have to strip them.
 *
 * ── WHAT IS STRIPPED, AND WHY EACH ONE ──────────────────────────────────
 *
 *   <script>            executes under our origin the moment the file is
 *                       opened directly, which a signed URL invites.
 *   on… attributes      the same thing without a tag.
 *   <foreignObject>     an HTML subtree inside the image, script included.
 *   <iframe/embed/object> the same, by another name.
 *   <animate…> with     SMIL can set an attribute AFTER load, which is how a
 *   attributeName=href  sanitiser that only looks at initial values is beaten.
 *   external href/src   pings a third party with her IP every time the image
 *                       renders, and can pull in a document we never saw.
 *   javascript: / data: URLs in any attribute, for the same reason.
 *   <style> @import     a remote stylesheet is a remote resource.
 *
 * ── WHAT IS REFUSED RATHER THAN STRIPPED ────────────────────────────────
 *
 * A DOCTYPE carrying an ENTITY declaration. That is an attack on the PARSER,
 * not on the rendered document — billion laughs and XXE both live there — and
 * removing the declaration while keeping references to it produces a file that
 * is broken in a way we would then be responsible for. Refuse it, and say why.
 *
 * ── WHY REGULAR EXPRESSIONS, HONESTLY ───────────────────────────────────
 *
 * This is a scrubber, not a parser, and a scrubber over markup is a weaker
 * guarantee than a real parse-and-serialize. What makes it acceptable here is
 * that it is not the only control: the file is served from a private bucket
 * through a short-lived signed URL, never inlined into a page of ours, and
 * never rendered as HTML. If any of those three change, this file is not
 * enough and the honest fix is a parser.
 */

export type SvgSanitizeResult =
  | { ok: true; svg: string; /** What was found and removed, for telling her. */ removed: string[] }
  | { ok: false; reason: "entities" | "not_svg" };

const SCRIPT_BLOCK = /<script[\s\S]*?<\/script\s*>/gi;
const SCRIPT_OPEN = /<script\b[^>]*\/?>/gi;
const FOREIGN_OBJECT = /<foreignObject[\s\S]*?<\/foreignObject\s*>/gi;
const HTML_EMBEDS = /<(iframe|embed|object|link|meta|base)\b[^>]*>[\s\S]*?<\/\1\s*>|<(iframe|embed|object|link|meta|base)\b[^>]*\/?>/gi;
const EVENT_ATTRIBUTE = /\son[a-z-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const SMIL_SETTERS = /<(animate|animateTransform|animateMotion|set)\b[^>]*>[\s\S]*?<\/\1\s*>|<(animate|animateTransform|animateMotion|set)\b[^>]*\/?>/gi;
const AT_IMPORT = /@import\s+[^;]+;/gi;

/** Any href/src whose value is not a same-document fragment or an inline image. */
const EXTERNAL_REFERENCE =
  /\s(?:xlink:href|href|src)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;

function isSafeReference(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.startsWith("#")) return true;
  // An inline raster is fine; an inline document is not.
  return /^data:image\/(png|jpe?g|gif|webp);base64,/.test(trimmed);
}

/**
 * Sanitise an SVG, or refuse it.
 *
 * Returns the cleaned markup and the list of what was taken out, so the screen
 * can tell her what happened to her file rather than silently changing it.
 */
export function sanitizeSvg(source: string): SvgSanitizeResult {
  // An entity declaration is an attack on the parser. Refuse the file.
  if (/<!DOCTYPE[^>]*\[[\s\S]*?<!ENTITY/i.test(source) || /<!ENTITY\b/i.test(source)) {
    return { ok: false, reason: "entities" };
  }

  if (!/<svg[\s>]/i.test(source)) return { ok: false, reason: "not_svg" };

  const removed: string[] = [];
  let svg = source;

  const strip = (pattern: RegExp, label: string) => {
    if (pattern.test(svg)) {
      removed.push(label);
      svg = svg.replace(pattern, "");
    }
    // `test` with a /g pattern advances lastIndex; reset so the next call is
    // stateless. This is exactly the bug that makes a scrubber miss the second
    // occurrence of something.
    pattern.lastIndex = 0;
  };

  strip(SCRIPT_BLOCK, "scripts");
  strip(SCRIPT_OPEN, "scripts");
  strip(FOREIGN_OBJECT, "embedded HTML");
  strip(HTML_EMBEDS, "embedded documents");
  strip(EVENT_ATTRIBUTE, "event handlers");
  strip(SMIL_SETTERS, "animations that can rewrite attributes");
  strip(AT_IMPORT, "remote stylesheets");

  // References last: the passes above may have removed the elements carrying
  // them, and what is left has to be checked one value at a time.
  let removedReference = false;
  svg = svg.replace(EXTERNAL_REFERENCE, (match, _raw, doubleQuoted, singleQuoted, bare) => {
    const value = doubleQuoted ?? singleQuoted ?? bare ?? "";
    if (isSafeReference(value)) return match;
    removedReference = true;
    return "";
  });
  if (removedReference) removed.push("links to other files");

  return { ok: true, svg, removed: [...new Set(removed)] };
}
