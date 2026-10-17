export function omitUndefinedWarehousePmsFields(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}
