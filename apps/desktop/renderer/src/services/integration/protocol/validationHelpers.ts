export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function hasKeys(
  value: Record<string, unknown>, required: string[], optional: string[] = [],
): boolean {
  return required.every((key) => Object.hasOwn(value, key))
    && Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
}

export function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

export function isRequestId(value: unknown): value is string {
  return isText(value) && !value.includes('\0')
    && new TextEncoder().encode(value).length <= 128;
}

export function isOperation(value: unknown): boolean {
  return value === 'analyze' || value === 'execute';
}
