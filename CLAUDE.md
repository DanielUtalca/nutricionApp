# App de Nutrición Personal (tipo Fitia simplificada)

> Documento de referencia del proyecto. Este archivo debe mantenerse actualizado
> a medida que evolucione el diseño y la arquitectura, para que cualquier sesión
> de trabajo (humana o de Claude Code) parta con el mismo contexto.

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
- Sincronización con Google Fit / Apple Health (fase posterior)

## 3. Funcionalidades explícitamente descartadas

- Feed social, grupos, comparación entre usuarios
- Widgets de pantalla de bloqueo
- Ayuno intermitente
- Cualquier sistema de suscripción/pago

## 4. Módulos detallados

### 4.1 Onboarding y perfil
- Login con Google
- Datos básicos: edad, sexo, altura, peso, objetivo
- **Actividad física detallada** (diferencial clave vs. Fitia genérico):
  - ¿Haces ejercicio? (Sí/No)
  - Tipo (selección múltiple): 🏋️ Fuerza/Gym, ⚽ Deporte (4 principales),
    🏃 Trote/cardio, 🧘 Otro
  - Veces por semana (por cada tipo elegido)
  - Esto pondera un multiplicador de actividad más preciso que el genérico
    "sedentario/activo/muy activo" para calcular el TDEE
- Cálculo automático de calorías diarias (BMR vía Mifflin-St Jeor + ajuste
  por actividad) y distribución de macros — editable manualmente después

### 4.2 Registro de comida
- Foto → IA estima alimentos, calorías y macros (proteína, carbos, grasa)
- Ajuste manual de porciones si la IA se equivoca
- Búsqueda de alimentos por texto (base de datos nutricional)
- Comidas organizadas por Desayuno/Almuerzo/Cena/Snacks
- Totales del día vs. la meta, en tiempo real

### 4.3 Plan y recetas
- Recetas simples guardadas, con info nutricional
- Plan de comidas del día/semana (opcional, no obligatorio)

### 4.4 Lista de compras
- Generada automáticamente a partir de lo planificado esa semana

### 4.5 Seguimiento corporal
- Registro de peso (gráfico de evolución)
- Medidas opcionales (cintura, etc.)

### 4.6 Hidratación
- Botón rápido para sumar vasos/litros de agua, con meta diaria

### 4.7 Integraciones (fase posterior)
- Google Fit / Apple Health (pasos, ejercicio, peso)

## 5. Flujo típico de uso

1. Abrir la app → ver totales del día vs. la meta
2. Tocar "+" en la comida correspondiente → tomar foto → IA estima → ajustar
   si hace falta → guardar
3. Repetir en cada comida del día
4. Revisar peso semanal y agua del día

## 6. Arquitectura técnica

**Stack:** Next.js 15 (App Router) + TypeScript + Tailwind CSS + Firebase
(Auth, Firestore, Storage). PWA instalable desde el navegador — evita pasar
por App Store/Play Store, más rápido de lanzar y compartir con amigos vía link.

**Estructura de carpetas:**
```
/app
  /(auth)/login
  /(app)/home
  /(app)/plan
  /(app)/recipes
  /(app)/profile
  /api/analyze-meal        → route handler: recibe foto, llama IA, retorna macros
  /api/recalculate-goals   → recalcula calorías/macros si cambia perfil/actividad
/components
  /ui                      → componentes base (botones, cards, barras)
  /meal                    → MealCard, MacroBar, CalorieRing
/lib
  firebase.ts              → init de Firebase (client)
  firebase-admin.ts        → init de Firebase Admin (server, para route handlers)
  nutrition.ts             → cálculo BMR/TDEE (Mifflin-St Jeor + actividad)
/types
  index.ts                 → tipos: User, Meal, FoodEntry, WeightLog, etc.
```

**Modelo de datos en Firestore:**
- `users/{uid}` → perfil, objetivo, actividad física, calorías/macros meta
- `users/{uid}/meals/{mealId}` → comidas registradas (fecha, tipo, alimentos,
  calorías, macros, foto URL temporal)
- `users/{uid}/weightLogs/{logId}` → historial de peso
- `users/{uid}/recipes/{recipeId}` → recetas guardadas
- `users/{uid}/water/{date}` → registro diario de hidratación

**Flujo de registro por foto:**
1. Usuario toma foto en el cliente → se sube a Firebase Storage
2. El cliente llama a `/api/analyze-meal` con la URL de la imagen
3. El route handler llama al modelo con visión, recibe JSON estructurado
   (alimento, calorías, macros)
4. Se guarda como nuevo documento en `users/{uid}/meals`
5. La foto se borra de Storage (ver política de borrado abajo)
6. El cliente refleja el cambio en tiempo real (listener de Firestore)

**Seguridad:** Firestore Security Rules restringiendo lectura/escritura solo
al `uid` dueño del documento — así, aunque se use la misma base de datos para
todo el grupo, nadie puede ver datos de otro.

**Modelo de IA para análisis de fotos:**
- `gemini-3.5-flash-lite` (o el Flash-Lite vigente al momento de implementar,
  ya que Google renombra versiones seguido) vía Gemini API
- Motivo: los modelos Flash normales tienen un free tier muy bajo (~20
  peticiones/día por proyecto), insuficiente para varios usuarios. Flash-Lite
  da ~15 RPM y ~500 RPD por proyecto, es multimodal (acepta imágenes), y esa
  cuota se comparte entre todos los usuarios de la app (no es por usuario) —
  alcanza cómodo para el grupo (ej. 5 personas x 4 fotos/día = 20
  peticiones/día, muy por debajo del límite)
- Antes de implementar, verificar el límite vigente en Google AI Studio, ya
  que estos valores no están garantizados y pueden cambiar

**Política de borrado de fotos (ahorro de espacio en Storage):**
1. Foto se sube a Firebase Storage
2. Se analiza con la IA → resultado (alimento, calorías, macros) se guarda
   como texto en Firestore
3. La foto se borra automáticamente de Storage tras un análisis exitoso — ya
   no se necesita, los datos relevantes quedaron en Firestore
4. Mejora futura (no MVP): guardar un thumbnail comprimido (~200x200px) en
   vez de la foto completa, solo si se quiere un registro visual del
   historial

## 7. Fases de desarrollo

1. **MVP**: login Google + perfil/objetivo/actividad + registro de comida
   por foto + totales del día
2. **Fase 2**: peso, agua, recetas guardadas
3. **Fase 3**: lista de compras, sync con Health apps

## 8. Diseño

**Estilo general:** limpio, minimalista, foco en que los números
(calorías/macros) se lean rápido de un vistazo — nada de saturación visual.
Referencia: Notion / Cal.com — mucho espacio en blanco, tipografía fuerte,
color usado solo para dar significado, no decoración.

**Paleta de colores:**
- Fondo: `#FAFAF9` (modo claro) / `#18181B` (modo oscuro)
- Primario/acento: verde sobrio (ej. `#2F9E44`), no verde neón genérico de fitness
- Macros (colores fijos y consistentes en toda la app):
  - Proteína → azul
  - Carbohidratos → naranja/ámbar
  - Grasa → morado/rosado
- Estados: rojo suave solo para "te pasaste de la meta", nunca alarmante

**Tipografía:** sans-serif geométrica (Inter o similar). Números grandes y en
negrita para calorías/macros (dato protagonista); texto secundario más liviano.

**Componentes clave reutilizables:**
- Card de comida (foto pequeña + nombre + calorías + 3 barras de macros)
- Anillo/barra de progreso circular para el total diario de calorías
- Barras horizontales para cada macro individual
- Bottom nav simple: Hoy / Plan / Recetas / Perfil (4 secciones máximo)

**Pantallas iniciales a diseñar (orden de prioridad):**
1. Login
2. Onboarding (perfil + actividad física)
3. Home (totales del día)
4. Registro de comida por foto
5. Perfil

> Mockups: se están construyendo de forma iterativa como páginas HTML
> publicadas (revisar historial de la conversación de diseño o los archivos
> del proyecto para las versiones más recientes de cada pantalla).
