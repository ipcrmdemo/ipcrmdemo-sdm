// TODO: Needs testing
export async function redactObjectProperty(o: any, property: string): Promise<any> {
  for (const v of Object.keys(o)) {
    if (o[v] && typeof o[v] === "object") {
      await redactObjectProperty(o[v], property);
    } else if (o[v] && v.toLowerCase() === property.toLowerCase() && typeof o[v] === "string") {
      o[v] = "Redacted";
    } else if ((o[v] === null || o[v] === undefined) && v.toLowerCase() === property.toLowerCase()) {
      o[v] = "Redacted";
    }
  }
  return o;
}
