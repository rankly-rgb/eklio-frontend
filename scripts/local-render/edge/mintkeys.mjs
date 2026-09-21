import crypto from "node:crypto";
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const secret = process.argv[2];
function sign(payload) {
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64(payload);
  const s = crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${s}`;
}
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 60 * 60 * 24 * 365;
console.log("ANON=" + sign({ role: "anon", iss: "supabase-local", iat, exp }));
console.log("SERVICE=" + sign({ role: "service_role", iss: "supabase-local", iat, exp }));
