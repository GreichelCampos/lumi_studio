# Ícono oficial de Estudio Lumi

`lumi-icon-source.png` es el original aprobado y se conserva intacto.
`lumi-taskbar-source.png` es la variante para tamaños pequeños autorizada por
el usuario: silueta más compacta y ancha, fondo transparente y cuerpo completo.
Se generó con el original como referencia; no lo reemplaza ni modifica.
Desde `apps/desktop`, `npm run icons:generate` regenera `lumi-taskbar-adapted.ico` con imágenes
RGBA de 16, 24, 32, 48, 64, 128 y 256 px usando el Electron ya instalado.
Primero genera `lumi-taskbar.png`, ajustando solamente el margen transparente
exterior y conservando un margen pequeño alrededor de la silueta completa.
El nombre `lumi-taskbar-adapted.ico` evita reutilizar la ruta del ícono anterior en caché.
Todas las resoluciones del ICO conservan el mismo encuadre de cuerpo completo
de `lumi-taskbar.png`. No se utilizan primeros planos que corten el cuerpo.

En desarrollo se resuelve `resources/lumi-taskbar-adapted.ico` desde `app.getAppPath()`.
Para el futuro instalador, sin elegir ni instalar todavía un empaquetador:

- Usar `lumi-taskbar-adapted.ico` como ícono del ejecutable, instalador y accesos directos.
- Copiarlo fuera de ASAR a `resources/lumi/lumi-taskbar-adapted.ico` del paquete; el runtime
  lo busca mediante `process.resourcesPath`.
- Usar `Estudio Lumi` como nombre del producto y `org.lumi.estudio` como
  AppUserModelID de aplicación y accesos directos, igual que `electron/appIdentity.ts`.
- Validar esos recursos en el instalador real cuando se implemente el empaquetado.

Para ver cambios, cerrar todas las ventanas y reiniciar con `npm run dev`.
Si Windows muestra un ícono anterior, desanclar el acceso antiguo, abrir Lumi
y volver a anclarlo. Si persiste, cerrar sesión y volver a entrar o reiniciar
Windows. No se modifica el ejecutable genérico de Electron durante desarrollo.
