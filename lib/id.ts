/** Id corto y único en el cliente para ítems dentro de arrays (plan, lista extra) */
export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
