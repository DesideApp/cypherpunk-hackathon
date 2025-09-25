# Deside Hackathon Monorepo

Repositorio combinado con el backend Express + Socket.IO y el frontend React (Vite) del messenger. Todo el trabajo para el concurso vive dentro de `deside-hackathon`.

## Estructura

```
backend/   # API REST + WebSocket server
frontend/  # SPA en React (Vite)
```

Cada paquete mantiene su propio `package.json`, scripts y configuración. El backend sigue la arquitectura modular original (`src/apps`, `src/modules`, `src/shared`, etc.) y el frontend conserva las features (auth, wallets, messaging, contacts, layout, shared services…).

## Primeros pasos

1. Duplica `.env.example` a `.env` en la raíz y completa los secretos (JWT, Mongo, Twilio…).  
   - Copia las líneas `VITE_*` a `frontend/.env` (hay plantilla en `frontend/.env.example`).
2. Instala dependencias desde la raíz con workspaces:
   ```bash
   npm install
   ```
3. Para demos sin Mongo externo, deja `DATA_MODE=memory` (por defecto); se usará un Mongo embebido con `mongodb-memory-server` que se resetea en cada reinicio. El backend siembra datos de demo automáticamente (`SEED_DEMO=true`).
4. Arranca backend y frontend desde el root:
   ```bash
   npm run dev:backend      # sólo API/WS (nodemon)
   npm run dev:frontend     # sólo SPA (vite)
   npm run dev:parallel     # ambos procesos en paralelo (usa concurrently)
   ```

## Scripts útiles

- `npm run dev` / `npm run dev:parallel`: levanta backend y frontend desde la raíz.
- `npm run dev:backend` / `npm run dev:frontend`: procesos individuales.
- `npm run lint`: ejecuta ESLint sobre el frontend (React + hooks + TypeScript).
- `npm run test`: corre Vitest (`frontend/src/shared/utils/base64.test.ts`, `tokenService.test.js`).
- `npm run build --workspace frontend`: compila la SPA para producción.
- Scripts históricos siguen disponibles dentro de cada paquete (`backend/npm run start`, `backend/npm run endpoints`, etc.).

## Puertos y procesos

- `npm run dev:backend` → levanta el API/WS en `http://localhost:3001` (Mongo embebido, Socket.IO, health OK).
- `npm run dev:frontend` → levanta Vite en `http://localhost:3000`.

Antes de arrancar, limpia cualquier proceso previo que use esos puertos:

```bash
# lista puertos en escucha (refresca cada segundo, salir con Ctrl+C)
watch -n 1 "lsof -nP -iTCP -sTCP:LISTEN"

# o para centrarse en uno concreto
watch -n 1 "lsof -nP -i :3000"
```

Si `npm run dev:frontend` intenta usar otro puerto (p.ej. 3001), significa que hay un Vite antiguo vivo. Mátalo con:

```bash
lsof -i :3000          # identifica el PID
kill <pid>
```

Para la demo usa `http://localhost:3000` (no 127.0.0.1) y activa `withCredentials:true` en fetch/sockets para que la cookie `accessToken` viaje correctamente. En modo memoria, el backend rellena usuarios/contactos de demo (se puede desactivar con `SEED_DEMO=false`).

### Mongo persistente (opcional)

Si quieres conservar usuarios/contactos entre reinicios:

1. Crea la carpeta de datos y levanta Mongo con Docker Compose:
   ```bash
   mkdir -p docker-data/mongo
   docker compose -f docker/docker-compose.yml up -d mongo
   ```
2. Cambia en `.env`:
   ```
   DATA_MODE=local
   MONGO_URI=mongodb://127.0.0.1:27017/deside
   ```
3. Reinicia `npm run dev:backend`. Los datos se guardarán en `docker-data/mongo/`.

Para resetear la base de demo:

```bash
docker compose -f docker/docker-compose.yml down
rm -rf docker-data/mongo/*
```

Después vuelve a ejecutar el `docker compose up` de arriba.

## Notas

- Las rutas de API y sockets se mantienen idénticas a las del repositorio original, por lo que no hay cambios en los clientes existentes.
- Los directorios `node_modules` y artefactos de build están excluidos vía `.gitignore`.
- Para futuras limpiezas/módulos extra, trabaja siempre dentro de este monorepo para mantener el historial alineado con hackathon.
