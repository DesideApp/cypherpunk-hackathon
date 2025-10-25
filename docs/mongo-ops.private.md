MongoDB – Operativa y Mantenimiento (Privado)
===========================================

Contexto
--------
Este backend (Deside) gestiona las colecciones: users, contacts, notifications, stats, activityevents, agreements, relaymessages. Cualquier otra colección en la misma DB proviene de sistemas previos y se puede purgar si no se usa.

Variables relevantes
--------------------
- `MONGO_URI` y `MONGO_DB_NAME`: definen la conexión y DB objetivo.
- `MONGO_AUTO_INDEX`: `true|false` para forzar autoIndex en runtime (por defecto dev=on, prod=off).
- `RELAY_MESSAGE_TTL` o `RELAY_TTL_SECONDS`: segundos de TTL para `relaymessages.createdAt`.

Purgar colecciones no gestionadas
---------------------------------
1) Dry‑run (no borra):
   ```
   cd backend
   npm run db:purge:dryrun
   ```
   Muestra allowlist desde los modelos y qué colecciones sobran.

2) Backup opcional de colecciones a eliminar (ejemplos):
   ```
   mongodump --uri "$MONGO_URI" --db "$MONGO_DB_NAME" --collection backups --out ./backups/mongodump_$(date +%F_%H%M)
   mongodump --uri "$MONGO_URI" --db "$MONGO_DB_NAME" --collection bios --out ./backups/mongodump_$(date +%F_%H%M)
   ```

3) Aplicar purga (destructivo):
   ```
   cd backend
   PURGE_CONFIRM=I_UNDERSTAND npm run db:purge:apply
   ```

Índices y TTL
-------------
- Sincronizar índices (crear/ajustar):
  ```
  cd backend
  npm run indexes:sync
  npm run indexes:verify
  ```

- TTL de relay:
  - Ajustar TTL actual con collMod o crear si falta:
    ```
    cd backend
    RELAY_TTL_SECONDS=7776000 npm run ttl:update   # 90 días
    # o
    RELAY_TTL_SECONDS=2592000 npm run ttl:update   # 30 días
    ```

Notas sobre conflictos de índices
---------------------------------
- Duplicados por nombre: pueden ocurrir si existe un índice previo con opciones distintas (unique/partial/TTL distinto).
- Estrategia:
  1) Ejecutar `indexes:verify` y localizar el índice conflictivo.
  2) Si procede, `db.<coleccion>.dropIndex("<nombre>")` y re‑crear con `indexes:sync`.
  3) Para TTL, `ttl:update` usa `collMod` y cae en drop+recreate si hace falta.

AutoIndex
---------
- Para entornos grandes, mantener `MONGO_AUTO_INDEX=false` y usar `indexes:sync` en despliegues.
- Temporalmente, puedes arrancar el servidor con `MONGO_AUTO_INDEX=true` para que Mongoose intente crear índices al startup. No recomendado como estrategia permanente.

Sanity checks de datos
----------------------
- Conteos básicos (mongosh):
  ```
  db.users.countDocuments()
  db.contacts.countDocuments()
  db.agreements.countDocuments()
  db.relaymessages.estimatedDocumentCount()
  ```

Migración de modelos del backend anterior
----------------------------------------
1) Añade el modelo en `src/modules/.../models/*`.
2) Ejecuta `npm run indexes:sync` para crear índices.
3) Verifica con `indexes:verify`.
4) Inserta datos (la colección se crea en primer write).

Apéndice: Allowlist de colecciones (Deside)
-------------------------------------------
- users, contacts, notifications, stats, activityevents, agreements, relaymessages

