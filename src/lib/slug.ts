import { randomInt } from "node:crypto";

// Sin caracteres ambiguos (0/O, 1/l/I) para que se pueda dictar o tipear.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";

export function newSlug(length = 7) {
  let s = "";
  for (let i = 0; i < length; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}
