# App de Nutrición Personal (tipo Fitia simplificada) — NutriTrack

> Documento de referencia del proyecto. Este archivo debe mantenerse actualizado
> a medida que evolucione el diseño y la arquitectura, para que cualquier sesión
> de trabajo (humana o de Claude Code) parta con el mismo contexto.
>
> Última actualización: 2026-10-06 (rama `feature/app-completa`). Producción: https://nutricion-app-theta.vercel.app (Vercel, despliegue por push a `main`; ver §6.1).

## 1. Concepto

App de nutrición completa para uso personal y de un grupo cercano (el dueño del
proyecto y sus amigos). Cada usuario tiene su propia cuenta y solo ve sus
propios datos — no hay componente social ni datos compartidos entre usuarios.
Sin costos de suscripción (a diferencia de Fitia, donde varias funciones clave
son de pago).

## 2. Funcionalidades incluidas

- Login con Google (rápido, sin gestión de contraseñas)
- Perfil + objetivo (bajar grasa / mantener / ganar músculo)
- Cálculo automático de calorías y macronutrientes diarios
- Registro de comida por foto (IA), texto y manual
- Plan de comidas diario con desglose calorías/macros vs. meta
- Recetas guardadas/sugeridas
- Lista de compras automática
- Seguimiento de peso y medidas corporales
- Control de hidratación
- Sincronización con Google Fit / Apple Health (fase posterior — ver §10, no viable como PWA)

## 3. Funcionalidades explícitamente descartadas

- Feed social, grupos, comparación entre usuarios
- Widgets de pantalla de bloqueo
- Ayuno intermitente
- Cualquier sistema de suscripción/pago

## 4. Módulos y estado

| Módulo | Estado | Dónde |
| --- | --- | --- |
| Login con Google + guard de rutas | ✅ | `app/(auth)/login`, `app/(app)/layout.tsx`, `lib/auth-context.tsx` |
| Onboarding (datos, objetivo, actividad detallada) | ✅ | `app/(app)/onboarding` |
| Cálculo BMR/TDEE/metas/macros | ✅ con tests | `lib/nutrition.ts` |
| Home: anillo de calorías, barras de macros, comidas por tipo en tiempo real, navegación por días | ✅ | `app/(app)/home` |
| Registro por foto (IA) con ajuste de porciones | ✅ | `app/(app)/log`, `app/api/analyze-meal` |
| Registro por texto con IA ("Describir") | ✅ | mismo endpoint (JSON) |
| Búsqueda en base de alimentos + registro manual | ✅ | `lib/food-db.ts`, `components/log/*` |
| Editar / borrar comidas | ✅ | `app/(app)/meals/[id]` |
| Peso con gráfico, medidas opcionales, historial | ✅ | `app/(app)/progress` |
| Hidratación (botón rápido, deshacer, meta) | ✅ | `components/progress/water-card.tsx` (en Home) |
| Recetas (crear/editar/borrar, sugeridas, registrar como comida) | ✅ | `app/(app)/recipes` |
| Plan semanal con recetas | ✅ | `app/(app)/plan` |
| Lista de compras desde el plan | ✅ | `app/(app)/shopping`, `lib/shopping.ts` |
| Perfil: editar datos/actividad, metas auto o manuales, cerrar sesión | ✅ | `app/(app)/profile` |
| PWA instalable (manifest + íconos) | ✅ | `app/manifest.ts`, `public/icons` |
| Modo oscuro | ✅ | tokens en `app/globals.css` |
| Google Fit / Apple Health | ❌ no viable en PWA | ver §10 |

### 4.1 Onboarding y perfil
- Datos básicos: sexo, edad, altura, peso, objetivo.
- **Actividad física detallada**: ¿haces ejercicio?, tipos (🏋️ Fuerza/Gym, ⚽ Deporte, 🏃 Trote/cardio, 🧘 Otro) y veces por semana de cada uno.
- Al terminar se guarda el perfil + metas calculadas + el primer registro de peso. `onboardingCompleted: true` marca el perfil como completo; si falta, el layout redirige a `/onboarding`.
- Metas editables a mano desde Perfil (`goalsCustomized: true`); se puede volver a las automáticas.

### 4.2 Fórmulas (`lib/nutrition.ts`)
- **BMR** Mifflin-St Jeor: hombre `10·kg + 6,25·cm − 5·edad + 5`; mujer `… − 161`.
- **Multiplicador de actividad**: `1,2 + Σ (incremento por sesión × sesiones/semana)`, tope 1,9.
  Incrementos: fuerza 0,055 · deporte 0,065 · cardio 0,065 · otro 0,045. Sesiones por tipo acotadas a 0–14.
  (3 sesiones de fuerza ≈ 1,365 ≈ "ligeramente activo".)
- **Calorías meta**: TDEE × 0,8 (bajar grasa) / × 1 (mantener) / × 1,1 (ganar músculo). **Piso = BMR**.
- **Macros**: proteína 2,0 / 1,6 / 1,8 g/kg según objetivo; grasa 25 % de las kcal (mínimo 0,6 g/kg); carbohidratos = resto (nunca negativo).
- **Agua**: 35 ml/kg redondeado a 0,25 L, entre 1,5 y 4 L.
- Caso de referencia testeado: hombre 25 años, 75 kg, 175 cm, fuerza 3×/sem → BMR 1.724, TDEE 2.353, P 120 / C 322 / G 65.

### 4.3 Registro de comida
- **Foto**: el navegador comprime a máx. 1024 px JPEG 0,8 (~150-400 KB), la envía como `multipart/form-data` a `/api/analyze-meal` con el ID token. **No pasa por Storage** y no se guarda.
- **Describir**: texto libre → mismo endpoint (JSON).
- **Buscar**: base local de 112 alimentos comunes en Chile (`lib/food-db.ts`, valores por 100 g; las preparaciones son aproximadas).
- **Manual**: nombre, porción, macros; las kcal se calculan de los macros si se dejan vacías.
- Pantalla de revisión: cambiar gramos (escala todos los macros desde la estimación original), multiplicadores rápidos, editar valores, quitar alimentos.

## 5. Flujo típico de uso

1. Abrir la app → ver totales del día vs. la meta
2. Tocar "+" en la comida correspondiente (o el botón flotante "Foto") → tomar foto → IA estima → ajustar si hace falta → guardar
3. Repetir en cada comida del día
4. Sumar vasos de agua desde Home; revisar peso semanal en "Peso y medidas"

## 6. Arquitectura técnica

**Stack real:** Next.js **16.3.6** (App Router, Turbopack) + React 19 + TypeScript + Tailwind CSS 4 + Firebase (Auth, Firestore; **sin Storage**) + Zod. Tests: Vitest, `@firebase/rules-unit-testing`, Playwright.

> ⚠️ Next 16 tiene cambios respecto de versiones anteriores: antes de escribir código de Next, revisar `node_modules/next/dist/docs/` (ver `AGENTS.md`).

**Estructura de carpetas:**
```
app/
  layout.tsx, globals.css, manifest.ts, icon.svg, apple-icon.png
  (auth)/login/
  (app)/layout.tsx           → guard de sesión + ProfileProvider + redirección a onboarding + bottom nav
  (app)/onboarding/
  (app)/home/                → Hoy
  (app)/log/                 → registrar comida (?type=&date=&mode=photo|search|text|manual)
  (app)/meals/[id]/          → editar/borrar comida
  (app)/progress/            → peso, medidas
  (app)/plan/                → plan semanal (?day=)
  (app)/shopping/            → lista de compras (?week=lunes)
  (app)/recipes/             → lista, new/, [id]/, [id]/edit/, suggested/[id]/
  (app)/profile/ (+ edit/)
  api/analyze-meal/route.ts  → POST, Node runtime, maxDuration 60 s
components/
  ui/        → Button, Card, Field, ChoiceCard/Segmented/Stepper, Sheet (<dialog>), Page, icons
  meal/      → CalorieRing, MacroBar/MacroInline, MealSection/MacroSplitBar, FoodEditorList
  log/       → PhotoPanel, SearchPanel, DescribePanel, ManualPanel, MealTypePicker
  progress/  → WaterCard, WeightChart (SVG)
  recipes/   → RecipeEditor, RecipeView, RecipeCard, LogRecipeSheet/AddToPlanSheet
  profile/   → piezas de formulario de perfil, GoalsSummary
  nav/       → BottomNav (Hoy / Plan / Recetas / Perfil)
lib/
  firebase.ts          → client SDK; caché persistente (IndexedDB); emuladores si NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
  firebase-admin.ts    → Admin SDK perezoso (server-only); modo emulador sin credenciales
  auth-context.tsx     → useAuth; login con Google (popup o redirect según auth-strategy); crea users/{uid} en el primer login; hook __testSignIn solo con emuladores
  auth-strategy.ts     → puro: elige popup/redirect, detecta navegadores integrados, mensajes de error de login
  profile-context.tsx  → useProfile (listener único de users/{uid})
  nutrition.ts, profile.ts, meals.ts, recipes.ts, shopping.ts, progress.ts, dates.ts, macros.ts
  db.ts, hooks.ts      → escrituras y suscripciones Firestore
  offline.ts           → settleWrite: no colgarse esperando confirmación sin conexión
  food-db.ts           → base local de alimentos
  image-compress.ts    → reduce a 1024 px / JPEG 0,8 (reintenta más fuerte si pesa > 1,5 MB)
  api-client.ts        → fetch a /api/analyze-meal con token, timeout 55 s y chequeo offline
  api-errors.ts        → puro: traduce errores HTTP (incluidos 413/504 de Vercel sin JSON) a mensajes claros
  ai/gemini.ts         → llamada REST a Gemini con JSON schema (server-only)
  ai/parse.ts          → validación Zod + normalización (puro)
  ai/image.ts          → magic bytes y límites (3 MB)
  server/              → auth (verifyIdToken), ai-quota, rate-limit, http, service-account (normaliza las credenciales Admin del entorno)
types/index.ts
firestore.rules, storage.rules, firebase.json, firestore.indexes.json, .firebaserc
tests/unit, tests/rules, tests/e2e (+ fixtures), tests/prod (humo contra la URL desplegada)
playwright.config.ts (E2E con emuladores), playwright.prod.config.ts (humo contra PROD_URL)
scripts/generate-icons.mjs
```

**Modelo de datos en Firestore** (todo bajo `users/{uid}`):

| Ruta | Contenido |
| --- | --- |
| `users/{uid}` | perfil, objetivo, actividad, metas (`daily*Target`), `bmr`, `tdee`, `activityMultiplier`, `goalsCustomized`, `onboardingCompleted` |
| `meals/{autoId}` | `date` (YYYY-MM-DD local), `type`, `source` (`ai_photo`/`ai_text`/`text_search`/`manual`/`recipe`), `title?`, `aiConfidence?`, `foods[]`, totales |
| `weightLogs/{YYYY-MM-DD}` | un registro por día: `weightKg`, `waistCm?`, `hipCm?`, `chestCm?`, `armCm?` |
| `water/{YYYY-MM-DD}` | `totalMl` (entero), `entries[{ml, at}]` |
| `recipes/{autoId}` | `name`, `servings`, `ingredients[]` (FoodEntry), totales y por porción, `tags`, `suggestedId?` |
| `mealPlans/{YYYY-MM-DD}` | `items[]` con receta, tipo de comida, porciones y macros por porción copiados; `logged?` |
| `shoppingLists/{lunes}` | `checked[]` (claves de ítems generados), `extras[]` |
| `aiUsage/{YYYY-MM-DD}` | `count` de análisis IA del día (hora de Chile). **Solo lo escribe el servidor** |

No se necesitan índices compuestos (las consultas usan un solo campo; el orden se hace en el cliente).

**Flujo de registro por foto:**
1. El cliente comprime la foto (canvas) y la envía directo a `/api/analyze-meal` con `Authorization: Bearer <ID token>`.
2. El handler: verifica el token (con chequeo de revocación) → límite 6/min por usuario (memoria) → valida tamaño (≤ 3 MB; Vercel corta en ~4,5 MB) y tipo real por magic bytes (JPEG/PNG/WebP) → suma 1 al contador diario (`aiUsage`, tope `AI_DAILY_LIMIT_PER_USER`, 40 por defecto) → llama a Gemini con JSON schema (**cadena de modelos de respaldo**, ver "Modelo de IA") → valida con Zod, acota valores y **recalcula totales**.
3. Errores mapeados con mensajes claros: 401 sin sesión, 413/415 imagen, 422 sin comida, 429 cuota (con `Retry-After`), 503 IA caída (tras probar todos los modelos) o mal configurada, 504 timeout. Si el fallo no es culpa del usuario se devuelve el intento del contador. Tiempos: 15 s por intento y 48 s en total para toda la cadena < `maxDuration` 60 s; el cliente espera como máximo 55 s. Si la plataforma responde sin JSON (413/502/503/504 de Vercel), `lib/api-errors.ts` deduce el mensaje por código HTTP.
4. El cliente muestra la revisión; al guardar escribe en `users/{uid}/meals`. La foto nunca se persiste.
5. Home se actualiza en tiempo real (listener de Firestore).

**Seguridad:** `firestore.rules` con reglas explícitas por subcolección: solo el dueño (`request.auth.uid == userId` y `data.uid == userId`), `hasOnly` de campos, tipos/rangos/tamaños; cualquier otra ruta denegada. `aiUsage` solo lectura para el cliente. `storage.rules` deniega todo. Cabeceras de seguridad en `next.config.ts` (`X-Frame-Options: DENY` salvo `SAMEORIGIN` en `/__/auth/*`, para que el iframe de Firebase Auth pueda incrustarse).

### 6.1 Producción (Vercel) y login con Google en móvil

- **Despliegue:** Vercel está conectado al repo; un push a `main` despliega a producción (`https://nutricion-app-theta.vercel.app`) y el resto de ramas generan previews. Flujo de ramas: `feature/*` → `develop` → `main` (`GIT_GUIDE.md`).
- **Variables por entorno** (Vercel → Settings → Environment Variables; los `NEXT_PUBLIC_*` se incrustan en el build, así que cambiarlos exige un redeploy):
  - *Production*: las 6 `NEXT_PUBLIC_FIREBASE_*` (con `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = `nutricion-app-theta.vercel.app`), credenciales Admin (`FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` en una sola línea **o** las 3 `FIREBASE_ADMIN_*` sueltas; si están ambas gana el JSON), `GEMINI_API_KEY`, `GEMINI_MODEL`, opcional `AI_DAILY_LIMIT_PER_USER`.
  - *Preview/Development*: igual pero con `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = `<proyecto>.firebaseapp.com` (login por popup).
  - **Nunca** en Vercel: `NEXT_PUBLIC_USE_FIREBASE_EMULATORS`, `FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST` (activarían el modo de pruebas / Admin sin credenciales).
- **Por qué `authDomain` = dominio de la app:** Safari, Chrome móvil y las PWA bloquean el almacenamiento de terceros; con `authDomain` = `*.firebaseapp.com`, `signInWithRedirect` vuelve sin sesión. `next.config.ts` sirve `/__/auth/*` desde nuestro propio dominio (rewrite a `https://<proyecto>.firebaseapp.com/__/auth/*`) y con `authDomain` = ese dominio todo queda en el mismo origen ([Firebase: redirect best practices](https://firebase.google.com/docs/auth/web/redirect-best-practices)).
- **Estrategia de login** (`lib/auth-strategy.ts`): en móvil o PWA instalada se usa **redirect**, pero **solo si** `authDomain` coincide con el host de la app; si no, popup (así un authDomain mal configurado no rompe el móvil). En escritorio, popup, con fallback a redirect si el popup se bloquea. Con emuladores siempre popup/`__testSignIn`.
- **Orden al cambiar el authDomain** (si se hace al revés, el login se rompe): (1) código con el rewrite desplegado; (2) agregar `https://nutricion-app-theta.vercel.app/__/auth/handler` en Google Cloud Console → APIs y servicios → Credenciales → cliente OAuth "Web client (auto created by Google Service)" → *URIs de redirección autorizados*; (3) cambiar `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` en Production; (4) redeploy.
- **iOS:** la PWA instalada tiene almacenamiento separado de Safari: hay que iniciar sesión dentro de la app instalada. Los navegadores integrados (Instagram, Facebook, WebViews) no pueden usar Google OAuth; el login muestra un aviso para abrir la página en Safari/Chrome.
- **Verificación:** `PROD_URL=https://nutricion-app-theta.vercel.app npm run test:prod` (sin sesión, sin gastar cuota de IA). Con `EXPECT_REDIRECT_LOGIN=1` también comprueba que el botón de Google redirige por el dominio propio y que Google acepta la URI de redirección.

**Modelo de IA:** `gemini-3.5-flash-lite` (Flash-Lite estable vigente en oct-2026 según https://ai.google.dev/gemini-api/docs/models), vía REST `v1beta/models/{model}:generateContent`, clave en header `x-goog-api-key`. Configurable con `GEMINI_MODEL`. **Respaldo automático** (`GEMINI_FALLBACK_MODELS`, por defecto `gemma-4-26b-a4b-it` → `gemini-3.1-flash-lite` → `gemini-flash-lite-latest`; `none` lo desactiva): ante 503/500, 429, 404, timeout o respuesta vacía/incompleta se prueba el siguiente modelo, porque cada uno tiene su propia capacidad y cuota. Los errores de clave/permisos (400 api key, 401, 403), el contenido bloqueado y "no es comida" no pasan a otro modelo. Con un solo modelo se mantiene 1 reintento tras 1,5 s. Los modelos 2.5 ya no están disponibles para claves nuevas (404). La cuota gratuita es por proyecto y compartida por todo el grupo; verificar límites vigentes en https://aistudio.google.com/rate-limit (Google no los publica en la documentación).

**Política de fotos:** no se usa Firebase Storage. La imagen solo existe en memoria del navegador y del servidor durante el análisis. Mejora futura: miniatura ~200 px (requeriría Storage y abrir `storage.rules` para `users/{uid}/…`).

## 7. Fases de desarrollo

1. **MVP**: login Google + perfil/objetivo/actividad + registro de comida por foto + totales del día — ✅
2. **Fase 2**: peso, agua, recetas guardadas — ✅
3. **Fase 3**: lista de compras ✅ · sync con Health apps ❌ (ver §10)

## 8. Diseño

**Estilo general:** limpio, minimalista, foco en que los números
(calorías/macros) se lean rápido de un vistazo — nada de saturación visual.
Referencia: Notion / Cal.com — mucho espacio en blanco, tipografía fuerte,
color usado solo para dar significado, no decoración.

**Paleta de colores** (tokens CSS en `app/globals.css`, clases Tailwind `bg-primary`, `text-text-secondary`, etc.):
- Fondo: `#FAFAF9` (claro) / `#18181B` (oscuro); superficies `#FFFFFF` / `#232326`
- Primario: `#2F9E44` (claro) / `#40C057` (oscuro), texto sobre primario `--color-on-primary`
- Macros (fijos en toda la app, validados para daltonismo con la skill `dataviz`):
  - Proteína → azul `#3B82F6` / `#4F8FF7`
  - Carbohidratos → ámbar `#F59E0B` / `#D97706`
  - Grasa → morado `#A855F7` / `#B06CF8`
- Agua → celeste `#0EA5E9` / `#38BDF8`
- Estados: rojo suave (`--color-danger`) solo para "te pasaste de la meta"
- Regla: el texto nunca va en el color del dato; el color va en un punto/barra al lado.

**Tipografía:** Inter (`next/font`), números grandes en negrita; `tabular-nums` solo en columnas/ejes.

**Componentes clave:** anillo de calorías (restantes como número protagonista), barras de macro con pista del mismo tono, barra apilada de reparto calórico por comida/receta, bottom nav de 4 pestañas, hojas inferiores con `<dialog>` nativo.

**Responsive/a11y:** diseñado para 390 px de ancho (máx. `max-w-md` centrado en escritorio), sin scroll horizontal (verificado en E2E), zona segura de iOS, `prefers-reduced-motion`, roles ARIA en controles personalizados, gráfico de peso navegable con teclado y con vista de tabla.

## 9. Decisiones tomadas (y desviaciones del plan original)

1. **Next.js 16** en vez de 15 (fue lo que se instaló en la tanda 1).
2. **Sin Firebase Storage**: la foto va directo a la API (pedido explícito, y el plan gratuito puede no incluir Storage). `photoURL` se eliminó del modelo `Meal`.
3. **Gemini por REST** en vez del SDK, para no depender de cambios del SDK; salida con JSON schema + validación Zod igual.
4. **No existe `/api/recalculate-goals`**: el cálculo es una función pura (`lib/nutrition.ts`) que corre en el cliente al guardar onboarding/perfil/peso; las reglas validan rangos. Un endpoint solo duplicaría lógica.
5. **Firebase Admin** se usa además para el contador diario de IA por usuario (`aiUsage`), para repartir la cuota gratuita compartida.
6. **Búsqueda por texto** con una base local de alimentos (sin APIs externas ni claves extra) + opción "Describir con IA".
7. **Modelo de datos ajustado**: peso con id = fecha (1 por día), agua en ml enteros, ingredientes de receta = `FoodEntry`, nuevas colecciones `mealPlans`, `shoppingLists`, `aiUsage`.
8. **Rutas extra** no listadas originalmente: `/onboarding`, `/log`, `/meals/[id]`, `/progress`, `/shopping`, `/profile/edit`, `/recipes/*`. El bottom nav se mantiene en 4 pestañas; Progreso se abre desde Home y Perfil.
9. **Al registrar un peso más reciente** se actualiza el peso del perfil y se recalculan las metas, salvo que estén personalizadas.
10. **Caché persistente de Firestore** (funciona sin conexión para datos ya cargados); las escrituras usan `settleWrite` para no colgarse offline. No hay service worker, así que abrir la app sin conexión y sin caché del navegador no funciona.
11. **Colores de macros en modo oscuro** ajustados respecto a los claros para pasar la validación de contraste/daltonismo.
12. **Login móvil por redirect con dominio propio** (oct-2026): `signInWithPopup` falla o queda bloqueado en teléfonos y PWA; se agregó `signInWithRedirect` con el handler de Firebase servido desde nuestro dominio (rewrite `/__/auth/*` + `authDomain` = dominio de Vercel). Se activa solo si `authDomain` coincide con el host (ver §6.1).
13. **Límites ajustados a Vercel**: imagen ≤ 3 MB (Vercel rechaza cuerpos > ~4,5 MB), Gemini 22 s por intento, `maxDuration` 60 s y timeout de cliente 55 s, para que el reintento a Gemini no se corte con un 504 que no devuelve el intento de cuota.
14. **Galería con `accept="image/*"`** (sin listar HEIC/HEIF): así iOS entrega JPEG convertido; si se listara `image/heic`, entregaría el HEIC original y Chrome/Android no sabe decodificarlo.
15. **Credenciales Admin normalizadas** (`lib/server/service-account.ts`): el JSON de la service account pegado en Vercel suele venir con comillas, saltos de línea reales o `\n` doblemente escapado; se normaliza y los errores no incluyen secretos.
16. **`jwks-rsa` 3 bajo `firebase-admin`** (`overrides` en `package.json`): `firebase-admin` 14 trae `jwks-rsa` ^4 → `jose` 6 (solo ESM) y `firebase-admin/auth` hace `require()` de él al cargar. Vercel (AWS Lambda) ejecuta Node sin `require()` de ESM, así que en producción `/api/analyze-meal` respondía 500 (`ERR_REQUIRE_ESM`) aunque en local funcionaba. `firebase-admin` solo usa `jwks-rsa` para URLs JWKS (no para verificar ID tokens de Firebase, que usan certificados X.509), así que la versión 3 (CJS, `jose` 4) es suficiente. `tests/unit/firebase-admin-load.test.ts` carga los puntos de entrada con `--no-experimental-require-module` para detectar regresiones al actualizar dependencias. Si se quita el override, revisar que `firebase-admin` ya no necesite `require(esm)`.
17. **Humo contra producción sin sesión** (`tests/prod`): el login real de Google no se puede automatizar y `__testSignIn` no existe fuera de los emuladores; solo se prueba lo público (login, manifest/instalabilidad, `/__/auth/*`, 401 de la API). El flujo con sesión se prueba a mano en el teléfono.
18. **Cadena de modelos de respaldo** (oct-2026): en producción las fotos fallaban con "La IA está saturada": el plan gratuito devolvía 503 "high demand" de forma intermitente en casi todos los modelos Gemini, y `gemini-3.5-flash-lite` a veces tardaba 30-60 s. Reintentar el mismo modelo no servía; pasar a otro sí (en las pruebas Gemma 4 26B respondió siempre, en ~3-10 s, con calidad aceptable). Ver `DEFAULT_GEMINI_FALLBACK_MODELS` en `lib/ai/gemini.ts`.

## 10. Pendientes / ideas futuras

- **Google Fit / Apple Health**: no implementado. La API de Google Fit no acepta registros nuevos desde mayo 2024 y se retira a fines de 2026; su reemplazo (Health Connect) y Apple HealthKit solo están disponibles para apps nativas Android/iOS, no para una PWA. Opciones: envolver la app con Capacitor, o permitir importar un CSV exportado.
- Service worker para abrir la app sin conexión.
- Al cerrar sesión, limpiar la caché local de Firestore (relevante solo en dispositivos compartidos).
- Miniaturas de fotos (requiere Storage).
- Ampliar la base de alimentos (o integrar Open Food Facts para códigos de barra).
- Gráfico de medidas en el tiempo (hoy se muestra último valor y variación).
- Unidades en lista de compras (hoy suma gramos; "huevo · 38 g" en vez de "1 unidad").

## 11. Pasos manuales pendientes (los hace el dueño del proyecto)

1. **Reglas de Firestore**: `.firebaserc` ya apunta al proyecto; `firebase deploy --only firestore:rules,firestore:indexes` (es idempotente: si ya están publicadas, lo indica).
2. **Storage**: la app no lo usa. Si el proyecto lo tiene activado, `firebase deploy --only storage` publica `storage.rules` (deniega todo); si no, no hacer nada.
3. **Gemini**: en Google AI Studio, confirmar que `gemini-3.5-flash-lite` está disponible para la clave y revisar los límites del plan gratuito (RPM/RPD). Recomendado: restringir la API key a "Generative Language API".
4. **Firebase Auth**: confirmar que el proveedor Google está habilitado y que el dominio de producción está en *Dominios autorizados*.
5. **Google Cloud Console → Credenciales → cliente OAuth "Web client (auto created by Google Service)" → URIs de redirección autorizados**: agregar `https://nutricion-app-theta.vercel.app/__/auth/handler` (necesario para el login por redirect en móvil).
6. **Vercel → Environment Variables (Production)**: completar las variables de §6.1 (incluida `GEMINI_MODEL`), poner `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = `nutricion-app-theta.vercel.app` **después** de los pasos 5 y del deploy del código nuevo, y hacer un redeploy.
7. **Usuarios existentes** de la tanda 2: al entrar verán el onboarding una vez (su perfil no tenía `onboardingCompleted`). Es lo esperado.
8. **Opcional**: restringir la API key web de Firebase por referer HTTP en Google Cloud Console.
9. **Prueba en el teléfono** (lista en el README, §10): login, foto real, editar porciones, guardar, totales del día e instalación de la PWA.

## 12. Cómo trabajar en el proyecto

- `npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` (unitarios) · `npm run test:rules` (reglas, emulador) · `npm run test:e2e` (Playwright + emuladores) · `npm run test:prod` (humo contra `PROD_URL`, sin sesión) · `npm run build`.
- Si un test E2E suelto falla con `auth/network-request-failed` al iniciar sesión, es una carrera de arranque: Playwright solo espera el puerto 8080 (Firestore) y el emulador de Auth (9099) puede tardar un poco más. Levantar los emuladores aparte (`firebase emulators:start --only auth,firestore --project demo-nutritrack`) y reutilizarlos.
- E2E: `playwright.config.ts` levanta emuladores (`demo-nutritrack`) y `next dev -p 3100` con `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`; el login usa `window.__testSignIn` (solo existe en ese modo) y `/api/analyze-meal` se intercepta para no gastar cuota.
- Íconos PWA: editar `public/icons/icon.svg` y correr `node scripts/generate-icons.mjs`.
- Commits: seguir `GIT_GUIDE.md` (Conventional Commits en inglés, imperativo, minúsculas).
- Nunca imprimir ni commitear `.env.local`.
