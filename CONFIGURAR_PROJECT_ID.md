# 🔧 Configurar Expo Project ID para Notificaciones Push

## ❌ Error que estás viendo:

```
ERROR [PUSH] Error registrando notificaciones: [Error: No "projectId" found.
If "projectId" can't be inferred from the manifest (for instance, in bare workflow),
you have to pass it in yourself.]
```

## ✅ Solución en 3 pasos:

### Paso 1: Crear cuenta en Expo (si no tienes)

1. Ve a: https://expo.dev/signup
2. Regístrate con GitHub, Google o email
3. Verifica tu email

### Paso 2: Crear proyecto en Expo

1. Ve a: https://expo.dev
2. Click en "Create a project" o "New project"
3. Dale un nombre: **NutriU** (o el que prefieras)
4. **¡IMPORTANTE!** Copia el **Project ID** que aparece (se ve algo así: `abc123def-4567-89ab-cdef-0123456789ab`)

### Paso 3: Configurar en app.json

1. Abre el archivo: `NutriU_Movil/app.json`
2. Busca la línea que dice:
   ```json
   "projectId": "CONFIGURA_AQUI_TU_PROJECT_ID"
   ```
3. Reemplaza `CONFIGURA_AQUI_TU_PROJECT_ID` con tu Project ID real
4. Debe quedar así:
   ```json
   "extra": {
     "eas": {
       "projectId": "abc123def-4567-89ab-cdef-0123456789ab"
     }
   }
   ```

### Paso 4: Reiniciar Expo

1. Detén el servidor de Expo (Ctrl+C en la terminal)
2. Ejecuta de nuevo:
   ```bash
   cd NutriU_Movil
   npx expo start --clear
   ```

---

## 🎯 Verificación

El error debe desaparecer y deberías ver:

```
✅ [PUSH] Token registrado exitosamente
```

---

## 💡 ¿No tienes tiempo ahora?

Si quieres probar la app SIN notificaciones push por ahora:

### Opción temporal: Desactivar registro de push

**1. Comenta el código en `AuthContext.tsx`:**

Busca estas líneas (alrededor de la línea 48-52 y 59-63) y agrega `//` al inicio:

```typescript
// useEffect(() => {
//   if (session?.user) {
//     registerPushNotificationsForUser(session.user.id);
//   }
// }, [session]);
```

**2. Reinicia Expo:**

```bash
npx expo start --clear
```

Así la app funcionará normalmente, SOLO sin las notificaciones push.

**IMPORTANTE:** Cuando quieras activar las notificaciones, quita los `//` y configura el Project ID.

---

## 📚 Referencias

- Expo Projects: https://expo.dev/accounts/[tu-usuario]/projects
- Expo Notifications Docs: https://docs.expo.dev/push-notifications/overview/

---

**Fecha:** 9 de marzo de 2026
