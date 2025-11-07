# 🔧 MongoDB Operations - Scripts de Mantenimiento

Scripts de mantenimiento operativo para gestionar **índices**, **TTL** y **operaciones** de MongoDB en la aplicación Deside.

## 📋 Scripts disponibles

| Script | Propósito | Uso |
|--------|-----------|-----|
| `ensure-indexes.js` | Sincronizar todos los índices de modelos | Post-deploy, cambios de esquema |
| `update-ttl.js` | Actualizar TTL del relay | Cambiar retención de mensajes |
| `verify-indexes.js` | Verificar índices del relay | Debug, validación |
| `backfill-history.mjs` | Normalizar historial (source/messageId) | Migraciones del módulo History |
| `backup-mongo.mjs` | Generar dump gzip y subirlo a R2 | Backups diarios |

## 🛠️ Requisitos generales

- **Variables:** `MONGO_URI`, `MONGO_DB_NAME` (opcional, default: `test`)
- **Node:** ≥18 con ESM
- **Permisos:** Según operación (ver sección *Permisos*)

---

## 🔄 `ensure-indexes.js` - Sincronizar todos los modelos

**Propósito:** Ejecuta `syncIndexes()` en todos los modelos para reconciliar índices definidos en código con la base de datos.

**Cuándo usar:**
- ✅ Después de cada deploy en producción (con `autoIndex: false`)
- ✅ Tras modificar índices en modelos
- ✅ Para aplicar nuevos índices añadidos

**Modelos incluidos:**
- `User`, `Contact`, `Stats`
- `Notification`, `RelayMessage`
- `EventLog`, `SecurityLog`, `Payment`
- `Bio`, `Backup`

### Ejecución
```bash
# Desarrollo (local)
node scripts/ops/ensure-indexes.js

# Producción (con variables específicas)
MONGO_DB_NAME=deside node scripts/ops/ensure-indexes.js
```

**Salida esperada:**
```
✅ Índices reconciliados para todos los modelos.
```

---

## ⏰ `update-ttl.js` - Gestión TTL del Relay

**Propósito:** Actualizar el TTL (Time To Live) de la colección `relaymessages` para controlar cuánto tiempo se mantienen los mensajes efímeros.

**Configuración actual:**
- Colección: `relaymessages` (modelo `RelayMessage`)
- Campo TTL: `createdAt` 
- Índice: `createdAt_1` con `expireAfterSeconds`
- Default: 172800 segundos (48h)

> ⚠️ **Importante:** Cambiar `RELAY_TTL_SECONDS` en `.env` no actualiza el TTL automáticamente.

### Ejecución
```bash
# Cambiar a 24 horas (86400 segundos)
RELAY_TTL_SECONDS=86400 node scripts/ops/update-ttl.js

# Cambiar a 1 semana (604800 segundos)
RELAY_TTL_SECONDS=604800 node scripts/ops/update-ttl.js
```

**Funcionamiento:**
1. Intenta `collMod` (rápido, requiere `dbAdmin`)
2. Si falla, hace `drop + create` (menos permisos)
3. Muestra índices resultantes

**Salida esperada:**
```
✅ TTL actualizado con collMod a 86400
📑 Índices ahora: [...]
```

### Valores TTL comunes
| Duración | Segundos | Uso |
|----------|----------|-----|
| 1 hora | 3600 | Testing rápido |
| 24 horas | 86400 | Mensajería activa |
| 48 horas | 172800 | Default actual |
| 1 semana | 604800 | Retención extendida |

---

## 🔍 `verify-indexes.js` - Verificación del Relay

**Propósito:** Verificar el estado actual de los índices en la colección `relaymessages`, especialmente útil para debug.

### Ejecución
```bash
node scripts/ops/verify-indexes.js
```

**Salida esperada:**
```
📑 Índices relay: [
  { v: 2, key: { _id: 1 }, name: '_id_' },
  { v: 2, key: { to: 1 }, name: 'to_1' },
  { 
    v: 2, 
    key: { createdAt: 1 }, 
    name: 'createdAt_1',
    expireAfterSeconds: 172800 
  }
]
```

---

## 🗂️ `backfill-history.mjs` - Normalizar historial existente

**Propósito:** Completar los campos introducidos en el módulo History (`source`, `messageId`) para mensajes creados antes de habilitar el contrato unificado de sincronización.

**Qué hace:**
- Recorre `conversationmessages` y, cuando faltan datos:
  - `source` → `'relay'`.
  - `messageId` → `relayMessageId`.
- Actualiza `conversations.lastMessage` con los mismos valores.

**Cuándo usar:**
- ✅ Después de desplegar los cambios del historial que soportan `source/messageId`.
- ✅ Antes de habilitar ingestión RTC u otras fuentes distintas a relay.

**Ejecutar:**
```bash
# Local / staging
MONGO_URI="mongodb://..." node scripts/ops/backfill-history.mjs

# Con base específica
MONGO_URI="mongodb://..." MONGO_DB_NAME=deside node scripts/ops/backfill-history.mjs
```

**Parámetros opcionales:**
- `HISTORY_BACKFILL_BATCH` → limita la cantidad de documentos procesados por ejecución (default `1000`).

**Salida esperada:**
```
{"level":"info","module":"ops.backfillHistory","message":"Connected to MongoDB"}
{"level":"info","module":"ops.backfillHistory","message":"Backfill messages completed","metadata":{"processed":1200,"updated":1180}}
{"level":"info","module":"ops.backfillHistory","message":"Backfill lastMessage completed","metadata":{"processed":450,"updated":420}}
{"level":"info","module":"ops.backfillHistory","message":"History backfill finished"}
```

**Post-proceso obligatorio:**
```bash
# Sincronizar índices tras la migración
node scripts/ops/ensure-indexes.js
```

> ⚠️ **Importante:** Respalda la base antes de ejecutar en producción. Si hay muchos registros, puedes dividir en varias corridas usando `HISTORY_BACKFILL_BATCH`.

---

## 💾 `backup-mongo.mjs` - Dump gzip a Cloudflare R2

**Propósito:** Generar un `mongodump --archive --gzip` y subirlo directamente al bucket R2 (`deside-data`). Útil para cron jobs diarios o workflows en CI.

**Requisitos:**
- `MONGO_URI` (obligatorio), opcional `MONGO_DB_NAME` y `MONGODUMP_ARGS`.
- Credenciales R2: `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.

**Ejecutar:**
```bash
MONGO_URI="mongodb+srv://..." \
R2_BUCKET=deside-data \
R2_ENDPOINT="https://<account>.r2.cloudflarestorage.com" \
R2_ACCESS_KEY_ID=xxx \
R2_SECRET_ACCESS_KEY=yyy \
node scripts/ops/backup-mongo.mjs
```

**Variables opcionales:**
- `BACKUP_ENV`: prefijo (prod/staging/dev). Default `NODE_ENV` o `dev`.
- `BACKUP_RETENTION_DAYS`: borra dumps más antiguos que N días.
- `MONGODUMP_ARGS`: flags extra (`"--oplog"`, `"--collection=foo"`, etc.).

**Salida esperada:**
```
{"level":"info","module":"ops.backupMongo","message":"mongodump_start", ...}
{"level":"info","module":"ops.backupMongo","message":"backup_uploaded","metadata":{"key":"backups/prod/mongo/..."}}
```

> Consejo: usa `npm run backup:mongo` y agenda este comando en Render cron o GitHub Actions.

---

## 🔐 Permisos MongoDB Atlas

### Para `ensure-indexes.js`
- **Mínimo:** `readWrite` sobre la DB objetivo
- **Recomendado:** `dbAdmin` para operaciones de índices

### Para `update-ttl.js`
- **Opción A (`collMod`):** `dbAdmin` o `dbAdminAnyDatabase`
- **Opción B (`drop+create`):** `readWrite` + permisos de índices

### Para `verify-indexes.js`
- **Mínimo:** `read` sobre la DB objetivo

### 🔧 Configurar permisos en Atlas
1. **Database Access → Database Users → Edit** tu usuario
2. **Add Built-in Role:**
   - Desarrollo: `dbAdminAnyDatabase` (amplio)
   - Producción: `dbAdmin` sobre DB específica
3. Guarda cambios

---

## 📊 Índices por modelo

### Críticos para rendimiento
```javascript
// RelayMessage
{ to: 1 }                    // Buscar mensajes por destinatario
{ createdAt: 1 }             // TTL automático

// Notification  
{ pubkey: 1, read: 1, createdAt: -1 }  // No leídas por usuario

// Payment
{ solanaTx: 1 } (unique)     // Prevenir duplicados
{ user: 1, date: -1 }        // Pagos por usuario/fecha

// EventLog & SecurityLog
{ timestamp: -1 }            // Ordenar por reciente
```

## ✅ Flujo de trabajo recomendado

### 🚀 Deploy en producción
```bash
# 1. Deploy código
git push origin main

# 2. Sincronizar índices (OBLIGATORIO con autoIndex: false)
MONGO_DB_NAME=deside node scripts/ops/ensure-indexes.js

# 3. Verificar estado (opcional)
node scripts/ops/verify-indexes.js
```

### 🔧 Cambio de TTL
```bash
# 1. Cambiar TTL
RELAY_TTL_SECONDS=86400 node scripts/ops/update-ttl.js

# 2. Verificar cambio
node scripts/ops/verify-indexes.js

# 3. Monitoring: confirmar que mensajes expiren correctamente
```

### 🐛 Debug de índices
```bash
# Verificar estado actual
node scripts/ops/verify-indexes.js

# Forzar recreación de todos los índices
node scripts/ops/ensure-indexes.js

# Verificar específicamente relay
node scripts/ops/verify-indexes.js
```

---

## ❓ FAQ

**¿Puedo cambiar TTL solo editando .env?**  
❌ No. El TTL es una propiedad del índice en MongoDB, debes usar `update-ttl.js`.

**¿El TTL borra inmediatamente?**  
❌ No. MongoDB ejecuta el monitor TTL cada ~60 segundos. El borrado es eventual.

**¿Qué pasa si no ejecuto ensure-indexes tras deploy?**  
⚠️ En producción (con `autoIndex: false`), los nuevos índices no se crearán automáticamente.

**¿Puedo ejecutar estos scripts en producción?**  
✅ Sí, están diseñados para ser seguros. `ensure-indexes.js` es no-destructivo.

**¿Cómo verifico si necesito más permisos?**  
🔍 Los errores típicos son `user is not allowed to do action [collMod]` o similares.

---

## 🚀 Scripts futuros recomendados

### `check-duplicates.js` (si es necesario)
Verificar duplicados en `Payment.solanaTx` antes de aplicar índice único.

### `cleanup-stale-data.js`
Limpiar datos antiguos o inconsistentes en desarrollo.

### `migration-helper.js`
Asistir en migraciones de esquema complejas.

### `health-check.js`
Verificar salud general de índices y rendimiento de queries.

## 🏗️ Arquitectura recomendada (futuro)

**Separar por funcionalidad:**
- `deside_core` → usuarios, contactos, pagos (persistente)
- `deside_relay` → mensajes efímeros (TTL corto)
- `deside_logs` → logs, analytics (retención larga)

**Beneficios:**
- Permisos granulares
- Backup/restore selectivo
- Escalado independiente
- Políticas de retención diferentes

### 2️⃣ Actualizar TTL - Opción A: `collMod` (rápida, requiere rol `dbAdmin`)
```bash
RELAY_TTL_SECONDS=86400 \   # <-- nuevo TTL (ej. 24h)
node --input-type=module <<'NODE'
import mongoose from 'mongoose';
import RelayMessage from '../../src/models/RelayMessage.js';
const uri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME;
const NEW_TTL = parseInt(process.env.RELAY_TTL_SECONDS ?? '172800', 10);
await mongoose.connect(uri, dbName ? { dbName } : {});
await mongoose.connection.db.command({
  collMod: RelayMessage.collection.collectionName,
  index: { name: 'createdAt_1', expireAfterSeconds: NEW_TTL }
});
console.log('✅ TTL actualizado con collMod a', NEW_TTL, 'seg');
await mongoose.disconnect();
NODE
```

### 3️⃣ Actualizar TTL - Opción B: `drop + create` (menos permisos)
```bash
RELAY_TTL_SECONDS=86400 \   # <-- nuevo TTL
node --input-type=module <<'NODE'
import mongoose from 'mongoose';
import RelayMessage from '../../src/models/RelayMessage.js';
const uri = process.env.MONGO_URI;
const opts = process.env.MONGO_DB_NAME ? { dbName: process.env.MONGO_DB_NAME } : {};
const NEW_TTL = parseInt(process.env.RELAY_TTL_SECONDS ?? '172800', 10);
await mongoose.connect(uri, opts);
try { await RelayMessage.collection.dropIndex('createdAt_1'); }
catch (e) { console.log('ℹ️ dropIndex omitido:', e.message); }
await mongoose.connection.db
  .collection(RelayMessage.collection.collectionName)
  .createIndex({ createdAt: 1 }, { expireAfterSeconds: NEW_TTL, name: 'createdAt_1' });
console.log('✅ TTL recreado a', NEW_TTL, 'seg');
await mongoose.disconnect();
NODE
```
## 🔐 Permisos MongoDB Atlas

### Para `collMod` (Opción A)
El database user necesita rol `dbAdmin` en la DB objetivo o `dbAdminAnyDatabase`.

### Para `drop/create` (Opción B)  
Bastan privilegios de índices (ej. `readWrite` + `dbAdmin`).

### ⚠️ Importante sobre nombres de DB
- Sin `MONGO_DB_NAME` → Mongoose usa `test` por defecto
- En logs viste operaciones en `[test.relaymessages]`
- Para usar DB explícita: define `MONGO_DB_NAME=deside` y redeploya

### 🔧 Configurar permisos en Atlas
1. **Database Access → Database Users → Edit** tu usuario
2. **Add Built-in Role:**
   - Mínimo: `dbAdmin` sobre tu DB (ej. `test`)
   - Amplio: `dbAdminAnyDatabase` (temporal)
3. Guarda y reintenta

## ✅ Verificación & Rollback

**Verificar:**
```bash
# Ejecuta script de índices y comprueba expireAfterSeconds
# Inserta documento de prueba y confirma que expire tras TTL + ~60s
```

**Rollback:**
```bash
# Ejecuta Opción A u Opción B con TTL anterior (ej. 172800)
```

## ❓ FAQ

**¿Puedo cambiar TTL solo editando .env?**  
❌ No. Debes modificar el índice existente.

**¿El TTL borra inmediatamente?**  
❌ No. El monitor TTL corre cada ~60s. Borrado eventual.

**¿Puedo tener otra colección TTL?**  
✅ Sí. Repite el patrón (campo Date + índice TTL).

## 🚀 Scripts adicionales recomendados

### `ensure-indexes.js` - Sincronizar todos los modelos
```js
import mongoose from 'mongoose';
import User from '../../src/models/User.js';
import Contact from '../../src/models/Contact.js';
// ... otros modelos

const uri = process.env.MONGO_URI;
const opts = process.env.MONGO_DB_NAME ? { dbName: process.env.MONGO_DB_NAME } : {};

await mongoose.connect(uri, opts);
await Promise.all([
  User.syncIndexes(),
  Contact.syncIndexes(),
  // ...
]);
console.log('✅ Índices reconciliados');
await mongoose.disconnect();
```

### Arquitectura recomendada (medio plazo)
**Separar efímero de persistente:**
- `deside_core` → usuarios, contactos
- `deside_relay` → solo datos efímeros
- Conexiones Mongoose separadas por DB

markdown
Copiar

---

## 👣 Pasos en Atlas para habilitar `collMod` (si quieres usar Opción A)

1) **Identifica la DB** real donde trabaja tu app: si no usas `MONGO_DB_NAME`, es **`test`**.  
   (Lo viste en el error: `test.relaymessages`.)

2) En **MongoDB Atlas**:
   - **Database Access → Database Users → Edit** tu usuario (el del `MONGO_URI`).
   - **Add Built-in Role**:  
     - Opción mínima: `dbAdmin` sobre la base de datos **(p. ej. `test` o `deside`)**.  
     - Opción amplia: `dbAdminAnyDatabase` (más permisos; úsalo temporalmente).
   - Guarda.

3) Vuelve a ejecutar el script `collMod` (Opción A).  
   Si ya no da error → perfecto.  
   Si prefieres no tocar roles → usa Opción B o la **UI de Atlas**:
   - Collections → (DB) → **relaymessages** → **Indexes** → `Drop` `createdAt_1` → `Create Index` en `createdAt` con TTL deseado.

---

## 🧭 Cómo “separar esto del resto” (y qué más scripts tener)

Tienes varias opciones, según cuánto quieras aislar:

### A) ✅ MVP (lo que tienes ahora)
- **Una sola DB** (p. ej. `test`), varias colecciones (`users`, `contacts`, `relaymessages`, …).
- Relay efímera controlada por TTL.
- **Scripts de ops** solo para relay:
  - `update-ttl.js`
  - `verify-indexes.js` (el snippet de “ver índices”)

👉 Sencillo, suficiente para MVP.

### B) Separar “efímero” de “persistente” (recomendado a medio plazo)
- **Dos DBs**: `deside_core` (usuarios/contactos), `deside_relay` (solo efímero).
- Opcional: **segunda conexión** de Mongoose solo para relay:
  ```js
  // src/db/relayConnection.js
  import mongoose from 'mongoose';
  export const relayConn = mongoose.createConnection(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB_RELAY || 'deside_relay'
  });
  // y en el modelo:
  export default relayConn.model('RelayMessage', relaySchema);
Beneficio: puedes aplicar permisos/retenciones distintos y “limpiar” sin tocar el core.

C) Scripts útiles para “el resto”
Crea estos en /scripts/ops (igual que el de TTL):

ensure-indexes.js
Ejecuta syncIndexes() para todos tus modelos persistentes (users, contacts, notifications…).
Útil tras cambios de índices en código.

js
Copiar
// scripts/ops/ensure-indexes.js
import mongoose from 'mongoose';
import User from '../../src/models/User.js';
import Contact from '../../src/models/Contact.js';
// importa aquí otros modelos “core”
const uri = process.env.MONGO_URI;
const opts = process.env.MONGO_DB_NAME ? { dbName: process.env.MONGO_DB_NAME } : {};
(async () => {
  await mongoose.connect(uri, opts);
  await Promise.all([
    User.syncIndexes(),
    Contact.syncIndexes(),
    // ...
  ]);
  console.log('✅ Índices reconciliados');
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
drop-stale-indexes.js (opcional)
Si cambiaste muchos índices, puedes dropear manualmente los que ya no quieres (cuidado).

seed-dev.js / purge-dev.js (solo para entornos de desarrollo)
Sembrar/limpiar datos de prueba.

perm-check.js (opcional)
Comprueba si el database user tiene permiso para collMod, createIndex, dropIndex e informa.
