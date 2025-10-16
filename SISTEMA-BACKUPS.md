# 💾 SISTEMA DE BACKUPS Y VERSIONES

## ✅ **¿Qué hace automáticamente?**

Cuando ejecutas `npm run style:apply`, **ANTES** de aplicar cambios:

1. ✅ Crea un backup automático de **TODOS** tus archivos CSS
2. ✅ Los guarda en `ai-style-agent/backups/backup-[fecha]/`
3. ✅ Guarda metadata (fecha, descripción, archivos)
4. ✅ **SOLO ENTONCES** aplica los cambios

**Tu código NUNCA se modifica sin backup previo** 🛡️

---

## 📋 **Comandos disponibles:**

### **1. Listar todos los backups:**
```bash
npm run style:backups
```

Muestra:
- Nombre del backup
- Fecha y hora
- Descripción
- Número de archivos

**Salida de ejemplo:**
```
📋 BACKUPS GUARDADOS

Encontrados 3 backup(s):

1. backup-2025-01-13T10-30-45
   📅 Fecha: 13/1/2025, 10:30:45
   📝 Antes de aplicar cambios desde preview
   📦 Archivos: 25

2. backup-2025-01-13T09-15-20
   📅 Fecha: 13/1/2025, 9:15:20
   📝 Antes de aplicar cambios desde preview
   📦 Archivos: 25
```

---

### **2. Restaurar un backup específico:**
```bash
npm run style:restore backup-2025-01-13T10-30-45
```

Esto:
- ✅ Restaura **TODOS** los archivos CSS de ese backup
- ✅ Sobrescribe los archivos actuales
- ✅ Tu app vuelve al estado de ese momento

**Puedes saltar entre versiones cuando quieras** 🔄

---

### **3. Eliminar un backup:**
```bash
npm run style:delete-backup backup-2025-01-13T09-15-20
```

Para limpiar backups que ya no necesitas.

---

## 🎯 **WORKFLOW COMPLETO:**

```bash
# 1. Genera propuestas
npm run style:design

# 2. Ver propuesta en preview
npm run style:preview -- --color 2

# 3. Aplicar (crea backup automático)
npm run style:apply
   ✅ Backup creado automáticamente: backup-2025-01-13T10-30-45
   ✅ Cambios aplicados

# 4. Inicia tu app y verifica
cd frontend && npm run dev

# 5a. Si te gusta: ¡perfecto! Ya está
# 5b. Si NO te gusta: restaura el backup anterior
npm run style:restore backup-2025-01-13T10-15-10
```

---

## 🔄 **Saltar entre versiones:**

```bash
# Ver tus backups
npm run style:backups

# Probar una versión
npm run style:restore backup-2025-01-13T10-30-45
# Inicia app, verifica

# Si no te convence, prueba otra
npm run style:restore backup-2025-01-13T09-15-20
# Inicia app, verifica

# Y así hasta encontrar la que más te guste
```

---

## 🛡️ **Seguridad garantizada:**

- ✅ **NUNCA** se aplican cambios sin backup
- ✅ **TODOS** los backups persisten (no se borran automáticamente)
- ✅ Puedes restaurar cualquier versión anterior
- ✅ Los backups están en `.gitignore` (no suben a Git)

---

## 📂 **Dónde se guardan:**

```
ai-style-agent/
  backups/
    backup-2025-01-13T10-30-45/
      frontend/
        src/
          Layout.css
          shared/
            styles/
              global.css
          features/
            ...
      metadata.json
    backup-2025-01-13T09-15-20/
      ...
```

Cada backup es una **copia completa** de tus CSS en ese momento.

---

## 💡 **Recomendaciones:**

1. **No borres backups** hasta que estés 100% seguro del cambio final
2. **Prueba varias propuestas** sin miedo (siempre puedes volver)
3. **Lista los backups** de vez en cuando para ver tu historial
4. **Limpia backups antiguos** cuando ya no los necesites para ahorrar espacio

---

## ✨ **Ejemplo práctico:**

```bash
# Lunes: Pruebo "Morado Profesional"
npm run style:preview -- --color 2
npm run style:apply
# → Crea: backup-2025-01-13T10-00-00

# Martes: No me convence, pruebo "Azul Marino"
npm run style:preview -- --color 3
npm run style:apply
# → Crea: backup-2025-01-14T11-00-00

# Miércoles: Prefiero el Morado del lunes
npm run style:backups
npm run style:restore backup-2025-01-13T10-00-00
# ✅ Vuelta al Morado del lunes
```

---

## 🎉 **RESUMEN:**

**Ya NO tienes que preocuparte por "romper" tu código.**

Cada vez que aplicas cambios, se guarda una versión completa.

Puedes experimentar libremente y saltar entre versiones. 🚀
