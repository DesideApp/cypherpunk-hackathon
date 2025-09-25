# Config Sync Notes

- `.env`: contiene todas las variables necesarias para backend y frontend. Rellena los valores sensibles antes de levantar los servicios.
- `.env.example`: copia sanitizada para compartir con el equipo.
- `.gitignore`: ignora `.env` y artefactos comunes del monorepo.
- `package.json` (raíz): workspaces (`backend`, `frontend`) y scripts unificados.
  - `npm run dev` (Unix) / `npm run dev:parallel` (portable) → levanta backend y frontend.
  - `npm run dev:backend`, `npm run dev:frontend` para tareas individuales.
  - `npm run lint` / `npm run test` sólo ejecutan los scripts del frontend.

## Dependencias con versiones compartidas
| Paquete          | Backend  | Frontend | Root      | Estado |
|------------------|----------|----------|-----------|--------|
| dotenv           | ^16.6.1  | ^16.6.1  | ^16.6.1   | OK |
| jsonwebtoken     | ^9.0.2   | ^9.0.2   | ^9.0.2    | OK |
| socket.io-client | ^4.8.1   | ^4.8.1   | ^4.8.1    | OK |
| tweetnacl        | ^1.0.3   | ^1.0.3   | ^1.0.3    | OK |
| typescript       | ^5.9.2   | ^5.9.2   | ^5.9.2    | OK |

## Auditoría de seguridad (npm audit)
- Dependencias no utilizadas (`@bonfida/spl-name-service`, `@solana/spl-token`, `csurf`, etc.) eliminadas de los `package.json`.
- `npm install` + `npm audit` → **0 vulnerabilidades** restantes.

## Próximos pasos
1. Resolver los avisos de ESLint pendientes (principalmente dependencias de hooks y variables sin uso).
2. Mantener los tests unitarios (Vitest) — actualmente cubren `base64` y `tokenService`; añade más casos si extiendes funcionalidades.
3. Documentar en README el flujo de arranque (`npm run dev`, `.env`, etc.) cuando cierres la configuración.
