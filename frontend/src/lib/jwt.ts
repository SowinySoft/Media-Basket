export function decodeJwtPayload(token: string): any {
  const part = token.split(".")[1];
  if (!part) return {};
  let b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  const json = atob(b64);
  return JSON.parse(json);
}
