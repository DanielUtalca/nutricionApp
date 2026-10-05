# NutriTrack

App de nutrición personal, sin suscripciones, para un grupo pequeño de amigos. Cada persona inicia sesión con Google y solo ve sus propios datos.

- Registra comidas por **foto (IA)**, describiéndolas con texto (IA), buscándolas en una base de alimentos o a mano.
- Calcula tus **calorías y macros diarios** (Mifflin-St Jeor + tu actividad física real) y los muestra en tiempo real.
- Seguimiento de **peso, medidas e hidratación**.
- **Recetas** con información nutricional, **plan semanal** y **lista de compras** generada desde el plan.
- PWA instalable desde el navegador (sin App Store / Play Store), con modo oscuro y funcionamiento sin conexión para los datos ya cargados.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Firebase (Auth + Firestore) · Gemini API (`gemini-3.5-flash-lite`) · Vitest · Playwright.

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
| `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` **o** `FIREBASE_ADMIN_PROJECT_ID` + `FIREBASE_ADMIN_CLIENT_EMAIL` + `FIREBASE_ADMIN_PRIVATE_KEY` | Sí | Servidor (`/api/analyze-meal`) | Consola de Firebase → Cuentas de servicio → Generar nueva clave privada |
| `GEMINI_API_KEY` | Sí (para la IA) | Servidor | [Google AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | No | Servidor | Por defecto `gemini-3.5-flash-lite`. Cámbialo si Google renombra el modelo |
| `AI_DAILY_LIMIT_PER_USER` | No | Servidor | Máximo de análisis con IA por persona y día (por defecto 40) |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | No | Solo pruebas | `true` conecta la app a los emuladores. **No usar en producción** |

> Las variables `NEXT_PUBLIC_FIREBASE_*` son públicas por diseño (identifican el proyecto); la seguridad la dan las reglas de Firestore. La clave de Gemini y las credenciales de Admin solo se leen en el servidor.

## 4. Ejecutar en local

```bash
npm run dev          # http://localhost:3000
```

Inicia sesión con Google, completa el onboarding (datos, objetivo, actividad) y llegarás a la pantalla **Hoy**.

Para probar en el celular dentro de tu red: `npm run dev -- -H 0.0.0.0` y abre `http://<ip-de-tu-pc>:3000`. (El login con Google requiere que ese dominio esté autorizado en Firebase Auth; `localhost` ya lo está.)

## 5. Pruebas

| Comando | Qué prueba | Requiere |
| --- | --- | --- |
| `npm test` | 123 tests unitarios: cálculo de BMR/TDEE/metas, parseo y validación de la respuesta de la IA, route handler `/api/analyze-meal` (auth, validación, cuota, errores), base de alimentos, recetas, lista de compras, fechas, progreso | Nada |
| `npm run test:rules` | 15 tests de `firestore.rules` contra el emulador (aislamiento entre usuarios, validación de datos) | Java + Firebase CLI |
| `npm run test:e2e` | 26 pruebas end-to-end con Playwright (13 flujos × modo claro y oscuro, viewport móvil 390×844) contra los emuladores | Java + Firebase CLI + `npx playwright install chromium` |
| `npm run lint` | ESLint (config de Next) | — |
| `npm run typecheck` | TypeScript estricto | — |
| `npm run build` | Build de producción | `.env.local` |

Las pruebas E2E levantan solas los emuladores (`demo-nutritrack`, no toca tu base real) y `next dev` en el puerto 3100, inician sesión con un usuario falso del emulador e interceptan `/api/analyze-meal` para **no gastar cuota de Gemini**. Si ya tienes esos servidores corriendo, los reutilizan.

## 6. Desplegar

### 6.1 Reglas de Firebase

```bash
firebase login
firebase use --add                       # elige tu proyecto (crea .firebaserc)
firebase deploy --only firestore:rules   # publica firestore.rules
# Solo si tu proyecto tiene Storage activado:
firebase deploy --only storage           # publica storage.rules (deniega todo)
```

### 6.2 App en Vercel (recomendado, plan gratuito)

1. Importa el repo en [vercel.com/new](https://vercel.com/new) (framework: Next.js, sin cambios de build).
2. En *Settings → Environment Variables* agrega todas las variables de la sección 3 **excepto** `NEXT_PUBLIC_USE_FIREBASE_EMULATORS`. Para `FIREBASE_ADMIN_PRIVATE_KEY` pega la clave con los `\n` tal cual.
3. Despliega y copia el dominio (`tu-app.vercel.app`).
4. En Firebase → Authentication → Settings → **Dominios autorizados**, agrega ese dominio (si no, el login con Google falla).
5. Abre la URL en el celular → menú del navegador → **Agregar a pantalla de inicio**.

Límite a tener en cuenta: Vercel acepta cuerpos de hasta ~4,5 MB; las fotos se comprimen en el navegador a ~150-400 KB, muy por debajo.

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
  api/analyze-meal/        POST: verifica token → valida imagen → Gemini → JSON validado
  manifest.ts              Manifest de la PWA
components/                UI (ui/), comidas (meal/), registro (log/), recetas, progreso, perfil, nav
lib/
  nutrition.ts             BMR / TDEE / metas / macros (puro, testeado)
  ai/                      Prompt + llamada a Gemini (server), parseo Zod, validación de imágenes
  server/                  Auth con Admin SDK, cuota diaria, rate limit, errores HTTP
  db.ts, hooks.ts          Acceso a Firestore y suscripciones en tiempo real
  food-db.ts               Base local de 112 alimentos (valores por 100 g)
  …                        meals, recipes, shopping, progress, dates, offline, image-compress
types/index.ts             Modelo de datos
firestore.rules            Reglas: solo el dueño, validación por subcolección
storage.rules              Deniega todo (la app no usa Storage)
tests/unit · tests/rules · tests/e2e
```

## 8. Privacidad y seguridad

- Las fotos **no se guardan**: se comprimen en el navegador, se envían a `/api/analyze-meal`, se analizan en memoria y se descartan. Solo los valores nutricionales quedan en Firestore.
- `/api/analyze-meal` exige un ID token de Firebase válido (y no revocado); detecta el tipo real de imagen por sus bytes y limita el tamaño (4 MB).
- Las reglas de Firestore permiten a cada usuario leer y escribir **solo** dentro de `users/{su uid}` y validan la forma de cada documento; todo lo demás está denegado.
- La cuota gratuita de Gemini es compartida por todo el grupo: hay un tope por usuario por día (`AI_DAILY_LIMIT_PER_USER`) y por minuto.

## 9. Problemas comunes

| Síntoma | Solución |
| --- | --- |
| "Se alcanzó el límite gratuito de la IA" | Cuota de Gemini agotada por ahora. Espera o usa Buscar/Manual. Revisa límites en [AI Studio → Rate limits](https://aistudio.google.com/rate-limit) |
| "El modelo … no está disponible. Actualiza GEMINI_MODEL" | Google renombró/retiró el modelo. Consulta [la lista de modelos](https://ai.google.dev/gemini-api/docs/models) y define `GEMINI_MODEL` |
| "No se pudo verificar tu sesión" (503) | Faltan o están mal las credenciales de Firebase Admin en el servidor |
| El login con Google se cierra con error en producción | Agrega el dominio a *Dominios autorizados* en Firebase Auth |
| `permission-denied` en consola | Publica `firestore.rules` (sección 6.1) |
