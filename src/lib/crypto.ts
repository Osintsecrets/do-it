/** Client-side AES-GCM helpers (Web Crypto) for optional encryption */
export async function deriveKey(pass:string, salt:Uint8Array){
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2", salt, iterations:150000, hash:"SHA-256"},
    keyMaterial, {name:"AES-GCM", length:256}, false, ["encrypt","decrypt"]);
}
export async function encryptJSON(pass:string, data:any){
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt);
  const pt = new TextEncoder().encode(JSON.stringify(data));
  const ct = new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM", iv}, key, pt));
  return { salt: Array.from(salt), iv: Array.from(iv), ct: Array.from(ct) };
}
export async function decryptJSON(pass:string, payload:any){
  const {salt, iv, ct} = payload;
  const key = await deriveKey(pass, new Uint8Array(salt));
  const pt = await crypto.subtle.decrypt({name:"AES-GCM", iv:new Uint8Array(iv)}, key, new Uint8Array(ct));
  return JSON.parse(new TextDecoder().decode(new Uint8Array(pt)));
}
