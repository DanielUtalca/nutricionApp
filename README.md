# NutriTrack

App de nutrición personal, sin suscripciones, para un grupo pequeño de amigos. Cada persona inicia sesión con Google y solo ve sus propios datos.

- Registra comidas por **foto (IA)**, describiéndolas con texto (IA), buscándolas en una base de alimentos o a mano.
- Calcula tus **calorías y macros diarios** (Mifflin-St Jeor + tu actividad física real) y los muestra en tiempo real.
- Seguimiento de **peso, medidas e hidratación**.
- **Recetas** con información nutricional, **plan semanal** y **lista de compras** generada desde el plan.
- PWA instalable desde el navegador (sin App Store / Play Store), con modo oscuro y funcionamiento sin conexión para los datos ya cargados.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Firebase (Auth + Firestore) · Gemini API (`gemini-3.5-flash-lite`) · Vitest · Playwright.

**Producción:** https://nutricion-app-theta.vercel.app (Vercel; un push a `main` despliega). Ver [§6](#6-desplegar).

---

## 1. Requisitos

| Herramienta | Versión | Para qué |
| --- | --- | --- |
| Node.js | 22 o superior | App, tests |
| npm | 10 o superior | Dependencias |
| Java (JDK) | 21 o superior | Emuladores de Firebase (solo para tests de reglas y E2E) |
| Firebase CLI | 15 o superior (`npm i -g firebase-tools`) | Emuladores y publicar reglas |

Además necesitas un proyecto de Firebase (plan gratuito Spark sirve) y una clave de la Gemini API (Google AI Studio).

## 2. Instalación

```bash
git clone <url-del-repo>
cd nutricionApp
npm install
cp .env.example .env.local   # y completa los valores (ver sección 3)
```

## 3. Variables de entorno

Todas están documentadas en [`.env.example`](.env.example). **Nunca subas `.env.local`** (ya está en `.gitignore`).

| Variable | Obligatoria | Dónde se usa | Cómo obtenerla |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` y demás `NEXT_PUBLIC_FIREBASE_*` | Sí | Navegador | Consola de Firebase → Configuración del proyecto → Tus apps → app web |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Sí | Navegador | En local y Preview: `<proyecto>.firebaseapp.com`. **En producción: el dominio de la app** (`nutricion-app-theta.vercel.app`), ver [§9](#9-problemas-comunes) |
| `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` **o** `FIREBASE_ADMIN_PROJECT_ID` + `FIREBASE_ADMIN_CLIENT_EMAIL` + `FIREBASE_ADMIN_PRIVATE_KEY` | Sí | Servidor (`/api/analyze-meal`) | Consola de Firebase → Cuentas de servicio → Generar nueva clave privada. El JSON va **en una sola línea**; si defines ambas opciones, gana el JSON |
| `GEMINI_API_KEY` | Sí (para la IA) | Servidor | [Google AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | No | Servidor | Por defecto `gemini-3.5-flash-lite`. Cámbialo si Google renombra el modelo |
| `GEMINI_FALLBACK_MODELS` | No | Servidor | Modelos de respaldo si el principal está saturado (503), sin cuota (429), lento o retirado. Por defecto `gemma-4-26b-a4b-it,gemini-3.1-flash-lite,gemini-flash-lite-latest`; `none` los desactiva |
| `AI_DAILY_LIMIT_PER_USER` | No | Servidor | Máximo de análisis con IA por persona y día (por defecto 40) |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | No | Solo pruebas | `true` conecta la app a los emuladores. **No usar en producción** |

> Las variables `NEXT_PUBLIC_FIREBASE_*` son públicas por diseño (identifican el proyecto); la seguridad la dan las reglas de Firestore. La clave de Gemini y las credenciales de Admin solo se leen en el servidor.

### Variables por entorno (Vercel)

| Variable | Production | Preview / Development |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_*` (las 6) | ✅ con `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = `nutricion-app-theta.vercel.app` | ✅ con `AUTH_DOMAIN` = `<proyecto>.firebaseapp.com` |
| `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` (o las 3 `FIREBASE_ADMIN_*`) | ✅ | ✅ |
| `GEMINI_API_KEY` | ✅ | ✅ |
| `GEMINI_MODEL` (`gemini-3.5-flash-lite`) | ✅ | opcional |
| `AI_DAILY_LIMIT_PER_USER` | opcional (40) | opcional |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | ❌ **no debe existir** | ❌ no debe existir |
| `FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST` | ❌ **no deben existir** (activan el modo de pruebas del Admin SDK, sin credenciales) | ❌ no deben existir |

Los `NEXT_PUBLIC_*` se incrustan al compilar: **cambiarlos exige un redeploy** para que apliquen. Revisa los nombres cargados con `vercel env ls` (o en *Settings → Environment Variables*).

## 4. Ejecutar en local

```bash
npm run dev          # http://localhost:3000
```

Inicia sesión con Google, completa el onboarding (datos, objetivo, actividad) y llegarás a la pantalla **Hoy**.

Para probar en el celular dentro de tu red: `npm run dev -- -H 0.0.0.0` y abre `http://<ip-de-tu-pc>:3000`. (El login con Google requiere que ese dominio esté autorizado en Firebase Auth; `localhost` ya lo está.)

## 5. Pruebas

| Comando | Qué prueba | Requiere |
| --- | --- | --- |
| `npm test` | 174 tests unitarios: cálculo de BMR/TDEE/metas, parseo y validación de la respuesta de la IA, route handler `/api/analyze-meal` (auth, validación, cuota, errores, límites de tamaño y tiempo), estrategia de login móvil, errores de la API, compresión de imágenes, credenciales Admin, carga de `firebase-admin` sin `require(esm)`, base de alimentos, recetas, lista de compras, fechas, progreso | Nada |
| `npm run test:rules` | 15 tests de `firestore.rules` contra el emulador (aislamiento entre usuarios, validación de datos) | Java + Firebase CLI |
| `npm run test:e2e` | 28 pruebas end-to-end con Playwright (14 flujos × modo claro y oscuro, viewport móvil 390×844) contra los emuladores | Java + Firebase CLI + `npx playwright install chromium` |
| `PROD_URL=https://nutricion-app-theta.vercel.app npm run test:prod` | Humo contra la app **desplegada**, sin sesión y sin gastar cuota de IA: login en claro/oscuro, ruta protegida, manifest e instalabilidad, `/__/auth/*`, 401 de la API | `npx playwright install chromium` |
| `npm run lint` | ESLint (config de Next) | — |
| `npm run typecheck` | TypeScript estricto | — |
| `npm run build` | Build de producción | `.env.local` |

Las pruebas E2E levantan solas los emuladores (`demo-nutritrack`, no toca tu base real) y `next dev` en el puerto 3100, inician sesión con un usuario falso del emulador e interceptan `/api/analyze-meal` para **no gastar cuota de Gemini**. Si ya tienes esos servidores corriendo, los reutilizan.

Si al correr un único test E2E ves `auth/network-request-failed` al iniciar sesión, es una carrera de arranque (Playwright espera el puerto 8080 de Firestore y el emulador de Auth, 9099, puede tardar un poco más): levanta antes `firebase emulators:start --only auth,firestore --project demo-nutritrack` y vuelve a correrlo.

El login real de Google no se puede automatizar, por eso las pruebas contra producción (`test:prod`) solo cubren lo público. Con `EXPECT_REDIRECT_LOGIN=1` además comprueban que, en móvil, el botón de Google redirige por el dominio propio y que Google acepta la URI de redirección (no aparece `redirect_uri_mismatch`).

## 6. Desplegar

### 6.1 Reglas de Firebase

`.firebaserc` ya deja el proyecto por defecto (`nutritrack-app-c1740`); si usas otro proyecto, cámbialo con `firebase use --add`.

```bash
firebase login
firebase deploy --only firestore:rules,firestore:indexes   # reglas + índices (idempotente)
# Solo si tu proyecto tiene Storage activado (la app no lo usa):
firebase deploy --only storage                             # storage.rules deniega todo
```

### 6.2 App en Vercel (recomendado, plan gratuito)

**Cómo se despliega:** Vercel está conectado al repo. Un push a `main` despliega a **producción**; las demás ramas generan *previews*. Flujo de ramas (ver `GIT_GUIDE.md`): `feature/*` → `develop` → `main`. Tras el push, el deploy aparece en *Vercel → Deployments* (o `vercel ls`).

Primera vez:

1. Importa el repo en [vercel.com/new](https://vercel.com/new) (framework: Next.js, sin cambios de build).
2. En *Settings → Environment Variables* agrega las variables de la sección 3 según la tabla "Variables por entorno" (Production **sin** `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` ni los `*_EMULATOR_HOST`). El JSON de la service account va en **una sola línea**; si prefieres los campos sueltos, `FIREBASE_ADMIN_PRIVATE_KEY` va con los `\n` tal cual.
3. Despliega y copia el dominio de producción.
4. En Firebase → Authentication → Settings → **Dominios autorizados**, agrega ese dominio (si no, el login con Google falla con `auth/unauthorized-domain`).
5. **Login en el móvil** (una vez, en este orden — ver [§9](#9-problemas-comunes)):
   1. Con el código ya desplegado, comprueba que `https://<tu-dominio>/__/auth/handler` responde 200.
   2. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → proyecto de Firebase → *Credenciales* → cliente OAuth **"Web client (auto created by Google Service)"** → *URIs de redirección autorizados* → agrega `https://<tu-dominio>/__/auth/handler`.
   3. En Vercel (solo **Production**) pon `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = `<tu-dominio>` (sin `https://`).
   4. **Redeploy** (*Deployments → ⋯ → Redeploy*): los `NEXT_PUBLIC_*` se incrustan al compilar.
6. Verifica: `PROD_URL=https://<tu-dominio> EXPECT_REDIRECT_LOGIN=1 npm run test:prod`.
7. Abre la URL en el celular → menú del navegador → **Agregar a pantalla de inicio**, y vuelve a iniciar sesión dentro de la app instalada.

Límites a tener en cuenta: Vercel rechaza cuerpos de más de ~4,5 MB, por eso el servidor acepta imágenes de hasta **3 MB** (las fotos se comprimen en el navegador a ~150-400 KB, muy por debajo). `/api/analyze-meal` tiene `maxDuration` de 60 s: Gemini tiene 22 s por intento y hasta un reintento.

## 7. Estructura

```
app/
  (auth)/login/            Login con Google
  (app)/                   Rutas privadas (guard de sesión + onboarding)
    onboarding/            Datos, objetivo, actividad → metas
    home/                  Hoy: anillo de calorías, macros, agua, comidas por tipo
    log/                   Registrar comida (foto / buscar / describir / manual)
    meals/[id]/            Editar o borrar una comida
    progress/              Peso (gráfico), medidas, historial
    plan/                  Plan semanal con recetas
    shopping/              Lista de compras de la semana
    recipes/               Mis recetas + sugeridas, crear/editar/detalle
    profile/ (+ edit/)     Datos, metas, cerrar sesión
  api/analyze-meal/        POST: verifica token → valida imagen (≤ 3 MB) → Gemini → JSON validado
  manifest.ts              Manifest de la PWA
components/                UI (ui/), comidas (meal/), registro (log/), recetas, progreso, perfil, nav
lib/
  nutrition.ts             BMR / TDEE / metas / macros (puro, testeado)
  ai/                      Prompt + llamada a Gemini (server), parseo Zod, validación de imágenes
  server/                  Auth con Admin SDK, cuota diaria, rate limit, errores HTTP, credenciales Admin del entorno
  auth-strategy.ts         Login con Google: popup o redirect según el dispositivo (puro, testeado)
  api-client.ts, api-errors.ts   Cliente de la API de IA y traducción de sus errores a mensajes claros
  db.ts, hooks.ts          Acceso a Firestore y suscripciones en tiempo real
  food-db.ts               Base local de 112 alimentos (valores por 100 g)
  …                        meals, recipes, shopping, progress, dates, offline, image-compress
types/index.ts             Modelo de datos
firestore.rules            Reglas: solo el dueño, validación por subcolección
storage.rules              Deniega todo (la app no usa Storage)
tests/unit · tests/rules · tests/e2e · tests/prod (humo contra producción)
```

## 8. Privacidad y seguridad

- Las fotos **no se guardan**: se comprimen en el navegador, se envían a `/api/analyze-meal`, se analizan en memoria y se descartan. Solo los valores nutricionales quedan en Firestore.
- `/api/analyze-meal` exige un ID token de Firebase válido (y no revocado); detecta el tipo real de imagen por sus bytes y limita el tamaño (3 MB).
- Las reglas de Firestore permiten a cada usuario leer y escribir **solo** dentro de `users/{su uid}` y validan la forma de cada documento; todo lo demás está denegado.
- La cuota gratuita de Gemini es compartida por todo el grupo: hay un tope por usuario por día (`AI_DAILY_LIMIT_PER_USER`) y por minuto.

## 9. Problemas comunes

| Síntoma | Solución |
| --- | --- |
| "Se alcanzó el límite gratuito de la IA" | Cuota de Gemini agotada por ahora. Espera o usa Buscar/Manual. Revisa límites en [AI Studio → Rate limits](https://aistudio.google.com/rate-limit) |
| "El modelo … no está disponible. Actualiza GEMINI_MODEL" | Google renombró/retiró el modelo. Consulta [la lista de modelos](https://ai.google.dev/gemini-api/docs/models) y define `GEMINI_MODEL` |
| "La IA está saturada en este momento" (503) | Todos los modelos de la cadena (`GEMINI_MODEL` + `GEMINI_FALLBACK_MODELS`) respondieron 503/500 en el plan gratuito. Suele pasar en minutos; los logs de Vercel muestran qué respondió cada modelo (`Gemini (<modelo>) respondió …`) |
| "No se pudo verificar tu sesión" (503) | Faltan o están mal las credenciales de Firebase Admin en el servidor |
| El login con Google se cierra con error en producción | Agrega el dominio a *Dominios autorizados* en Firebase Auth |
| `permission-denied` en consola | Publica `firestore.rules` (sección 6.1) |
| "Esa foto no se pudo leer" / "no puede leer fotos HEIC" | Elige una foto JPG/PNG, o en el iPhone: *Ajustes → Cámara → Formatos → Más compatible* |
| `/api/analyze-meal` responde 500 en Vercel con `ERR_REQUIRE_ESM` en los logs (`vercel logs --environment production --status-code 500`) | Una dependencia del servidor exige `require()` de un módulo ESM, que el runtime de Vercel no permite. Hoy `package.json` fija `jwks-rsa` 3 bajo `firebase-admin` con `overrides`; `npm test` lo vigila (`firebase-admin-load.test.ts`). Tras actualizar `firebase-admin`, revisa ese test |
| "El análisis tardó demasiado" / "El servicio no está disponible" | La IA o la red tardaron más de lo esperado; reintenta, o registra con *Buscar*/*Manual* |

### Si falla el login en el móvil

La app usa **popup** en escritorio y **redirect** en móvil/PWA, pero el redirect solo se activa cuando `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` es el mismo dominio que sirve la app (el handler de Firebase se sirve en `/__/auth/*` desde ahí; así Safari/Chrome no bloquean el almacenamiento de terceros). Revisa en este orden:

| Síntoma | Causa y solución |
| --- | --- |
| Vuelves a la pantalla de login sin sesión después de elegir tu cuenta | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` sigue siendo `*.firebaseapp.com` o no hubo redeploy tras cambiarlo. Ponlo en el dominio de Vercel (solo Production) y **redeploya** |
| Google muestra `Error 400: redirect_uri_mismatch` | Falta `https://<tu-dominio>/__/auth/handler` en *Google Cloud Console → Credenciales → cliente OAuth "Web client (auto created by Google Service)" → URIs de redirección autorizados* |
| "Este dominio no está autorizado" (`auth/unauthorized-domain`) | Agrega el dominio en *Firebase → Authentication → Settings → Dominios autorizados* |
| La pantalla de login queda en "Redirigiendo a Google…" o en blanco | Comprueba que `https://<tu-dominio>/__/auth/handler` y `/__/auth/iframe` responden 200 (si dan 404, falta el rewrite de `next.config.ts` o `NEXT_PUBLIC_FIREBASE_PROJECT_ID`) |
| "Estás en el navegador de otra app" | Instagram/Facebook/WhatsApp y los WebViews no permiten login con Google: abre el enlace en Safari o Chrome |
| En el iPhone, la app instalada pide iniciar sesión otra vez | Es normal: la PWA instalada tiene almacenamiento separado de Safari. Inicia sesión dentro de la app instalada |
| "Tu navegador bloqueó la ventana de Google" | Permite las ventanas emergentes (escritorio) o prueba en móvil, donde se usa redirect |
| "Tu navegador bloquea el almacenamiento necesario" | Sal del modo privado y activa las cookies del sitio |

Diagnóstico rápido sin iniciar sesión: `PROD_URL=https://<tu-dominio> EXPECT_REDIRECT_LOGIN=1 npm run test:prod`.

## 10. Prueba manual en el teléfono

1. **Login:** abre la URL en Safari (iPhone) o Chrome (Android) → *Continuar con Google* → elige tu cuenta → llegas a Onboarding/Hoy.
2. **Foto:** *Foto* → *Tomar foto* de un plato real (y otra vez con *Elegir de la galería*, incluida una foto tomada con el iPhone) → *Analizar con IA* → aparecen los alimentos con calorías y macros.
3. **Editar porciones:** cambia los gramos de un alimento y usa un multiplicador (×0,5, ×2); los totales se recalculan.
4. **Guardar** y comprobar en **Hoy** que el anillo de calorías, las barras de macros y la comida del tipo elegido se actualizan.
5. **Errores:** con el modo avión activado, *Analizar con IA* debe mostrar "Sin conexión…" y ofrecer *Buscar alimento*/*Ingresar a mano* sin quedarse colgado.
6. **Instalar:** menú del navegador → *Agregar a pantalla de inicio* (iPhone: Compartir → *Agregar a inicio*); abre el ícono, inicia sesión dentro de la app instalada y repite una foto.
