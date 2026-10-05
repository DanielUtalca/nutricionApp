# Guía de Commits y Convenciones Git

Esta guía define las reglas y convenciones para la creación de commits, manejo de ramas, apertura de Pull Requests y versionado en el proyecto. **Todos los commits realizados en este repositorio deben seguir estrictamente este formato.**

---

## 1. Estructura de Commits (Conventional Commits)

Cada mensaje de commit debe seguir la estructura:

```
tipo(alcance): descripción corta en imperativo
```

### 1.1 Las tres partes

1. **`tipo`** (Obligatorio): Indica qué clase de cambio se introduce.
2. **`alcance` / `scope`** (Opcional pero recomendado): Parte del proyecto afectada (ej: `auth`, `meal`, `ui`, `profile`, `config`, `deps`).
3. **`descripción`** (Obligatorio): Resumen breve en imperativo, minúsculas y sin punto final.

### 1.2 Tipos de Commit Permitidos

| Tipo | Cuándo usarlo |
| :--- | :--- |
| `feat` | Agregas una nueva funcionalidad |
| `fix` | Corriges un error |
| `docs` | Cambios únicamente en la documentación |
| `style` | Formato, espacios, comas (sin alterar lógica ni funcionalidad) |
| `refactor` | Reestructuración de código sin alterar su comportamiento externo |
| `test` | Adición o modificación de pruebas unitarias/integración |
| `chore` | Tareas de mantenimiento, actualización de dependencias, configuración de build |

### 1.3 El Modo Imperativo (Regla de Oro)

La descripción del commit debe escribirse como una **orden en presente/imperativo** (en inglés o español según la convención establecida del repositorio, preferiblemente inglés técnico), completando la frase hipotética:
> *"Si se aplica, este commit va a..."*

- **Correcto:**
  - `feat(auth): add password reset endpoint`
  - `fix(todos): prevent duplicate creation on double click`
  - `refactor(login): extract validation to separate function`
  - `docs(readme): add docker setup instructions`
- **Incorrecto (Evitar):**
  - `fix`
  - `cambios varios`
  - `arreglé el login`
  - `WIP`
  - `actualización`

### 1.4 Commits Atómicos (Un commit = Un cambio lógico)

- No mezcles múltiples cambios no relacionados en un solo commit.
- Si corriges un bug y además agregas un componente nuevo, agrégalos en commits separados.

```bash
# Ejemplo correcto:
git add src/components/TodoFilter.tsx
git commit -m "feat(todos): add filter component"

git add src/services/todo.service.ts
git commit -m "feat(todos): add status param to getTodos"
```

---

## 2. Convención de Ramas (Git Flow)

- `main`: Código en producción, siempre estable.
- `develop`: Integración principal de funcionalidades.
- `feature/*`: Nueva funcionalidad (ej. `feature/dark-light-mode`, `feature/user-profile-page`).
- `fix/*`: Corrección de errores (ej. `fix/empty-email-validation`).
- `hotfix/*`: Correcciones urgentes directo para producción (`main` y `develop`).
- `refactor/*`: Reestructuración importante.
- `docs/*`: Documentación.

> **Regla:** Nombres en minúsculas separados por guiones. Evita nombres genéricos como `fix/bug` o `mi-rama`.

---

## 3. Flujo de Trabajo y Pull Requests (PR)

### 3.1 Pasos del Flujo
1. Partir desde `develop` actualizado (`git pull origin develop`).
2. Crear la rama de trabajo (`git checkout -b feature/nombre-descriptivo`).
3. Realizar commits atómicos en modo imperativo.
4. Subir la rama y abrir Pull Request apuntando a `develop`.

### 3.2 Formato de Título de PR
```
tipo(alcance): descripción corta (#número-de-issue-o-pr)
```
*Ejemplo:* `feat(todos): add filter by status (#12)`

### 3.3 Plantilla para Descripción de PR
```markdown
## ¿Qué hace este PR?
[Descripción breve del objetivo]

## Cambios realizados
- [Cambio 1]
- [Cambio 2]

## Archivos modificados
- [Ruta a archivo]

## Cómo probarlo
1. [Paso 1]
2. [Paso 2]
3. [Resultado esperado]
```

### 3.4 Mensaje de Merge
Al realizar el merge en GitHub o localmente, edita el mensaje de merge genérico para mantener la convención del commit en `develop`/`main`:
- **Correcto:** `feat(todos): add filter by status (#12)`
- **Incorrecto:** `Merge pull request #12 from usuario/feature/todo-filters`

---

## 4. Checklist Rápido antes de hacer Commit / PR

- [ ] Partí desde `develop` actualizado.
- [ ] La rama sigue la nomenclatura `tipo/nombre-descriptivo`.
- [ ] Cada commit representa **un solo cambio lógico**.
- [ ] El mensaje sigue `tipo(scope): descripción en imperativo`.
- [ ] La descripción está en minúsculas y **sin punto final**.
- [ ] El PR apunta a la rama base correcta (`develop`).
- [ ] Todo ha sido probado localmente antes de confirmar.
