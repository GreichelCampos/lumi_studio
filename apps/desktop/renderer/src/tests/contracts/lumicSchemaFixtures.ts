import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

export interface SchemaNode {
  $ref?: string;
  type?: string;
  const?: unknown;
  enum?: unknown[];
  pattern?: string;
  minimum?: number;
  exclusiveMinimum?: number;
  items?: SchemaNode;
  minItems?: number;
  maxItems?: number;
  required?: string[];
  properties?: Record<string, SchemaNode>;
  definitions?: Record<string, SchemaNode>;
  additionalProperties?: boolean;
}

const contractRoot = resolvePath(process.cwd(), '../../../docs/contracts/lumic/v1.0.0');
export const schema: SchemaNode = JSON.parse(readFileSync(resolvePath(contractRoot, 'lumic.schema.json'), 'utf8'));

export function readExample(name: string): unknown {
  return JSON.parse(readFileSync(resolvePath(contractRoot, `examples/${name}.lumic`), 'utf8'));
}

export function resolve(node: SchemaNode): SchemaNode {
  if (!node.$ref) return node;
  const name = node.$ref.replace('#/definitions/', '');
  const target = schema.definitions?.[name];
  if (!target || node.$ref !== `#/definitions/${name}`) throw new Error(`Invalid local reference: ${node.$ref}`);
  return target;
}

export function completeFixture(input: SchemaNode = schema): unknown {
  const node = resolve(input);
  if (Object.hasOwn(node, 'const')) return node.const;
  if (node.enum) return node.enum[0];
  switch (node.type) {
    case 'object': return Object.fromEntries(Object.entries(node.properties ?? {}).map(([key, value]) => [key, completeFixture(value)]));
    case 'array': return Array.from({ length: node.minItems ?? 1 }, () => completeFixture(node.items!));
    case 'string': return node.pattern?.includes('0*1') ? '1.0.0' : 'value';
    case 'number':
    case 'integer': return Math.max(node.minimum ?? 1, (node.exclusiveMinimum ?? 0) + 1);
    case 'boolean': return false;
    default: throw new Error(`Unsupported fixture type: ${node.type}`);
  }
}

export type FieldPath = (string | number)[];

export function declaredFields(input: SchemaNode = schema, path: FieldPath = []): { path: FieldPath; required: boolean }[] {
  const node = resolve(input);
  if (node.type === 'array') return declaredFields(node.items!, [...path, 0]);
  return Object.entries(node.properties ?? {}).flatMap(([key, child]) => [
    { path: [...path, key], required: node.required?.includes(key) ?? false },
    ...declaredFields(child, [...path, key]),
  ]);
}

export function changeField(input: unknown, path: FieldPath, remove = false): unknown {
  const copy = structuredClone(input);
  let parent = copy as Record<string | number, unknown>;
  for (const key of path.slice(0, -1)) parent = parent[key] as Record<string | number, unknown>;
  const key = path.at(-1)!;
  if (remove) delete parent[key];
  else parent[key] = null;
  return copy;
}
