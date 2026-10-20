import assert from 'node:assert/strict';

export const RUNTIME_SCENE_SOURCE = [
  'funcion decimal destino(decimal valor) { retornar valor + 1>> }',
  'principal {',
  'habitacion sala(6, 5, 3) {',
  '  piso suelo { material "madera">> color "beige">> }',
  '  mesa mesa1 { color "rojo">> }',
  '  colocar mesa1 [0, 0, 0]>>',
  '  si verdadero { mover mesa1 [destino(2), 0, -1]>> }',
  '  entero angulo = 0>>',
  '  mientras angulo < 90 { angulo = angulo + 30>> rotar mesa1 [0, angulo, 0]>> }',
  '}',
  '}',
].join('\n');

export function assertRuntimeRoom(room) {
  assert.equal(room.name, 'sala');
  assert.deepEqual(room.dimensions, [6, 5, 3]);
  assert.deepEqual(room.floor, { material: 'madera', color: 'beige' });
  assert.equal(room.objects.length, 1);
  const item = room.objects[0];
  assert.equal(item.name, 'mesa1');
  assert.equal(item.type, 'mesa');
  assert.deepEqual(item.position, [3, 0, -1]);
  assert.deepEqual(item.rotation, [0, 90, 0]);
  assert.deepEqual(item.dimensions, [1.2, 0.5, 0.8]);
  assert.equal(item.color, 'rojo');
  assert.ok(room.id && item.id);
  assert.equal(item.roomId, room.id);
  assert.equal(item.sourceRef.file, 'principal.lumi');
}
