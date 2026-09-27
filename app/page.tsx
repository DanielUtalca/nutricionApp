// app/page.tsx — Página de inicio temporal
// Solo confirma que Next.js + Tailwind + la paleta de colores funcionan.
// En la siguiente tanda esto se reemplazará por la pantalla de Login.

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-10 px-6">
      {/* Logo / nombre */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-md"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          🥗
        </div>
        <h1
          className="text-4xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          NutriTrack
        </h1>
        <p className="text-base" style={{ color: "var(--text-secondary)" }}>
          Tu dieta, sin suscripciones.
        </p>
      </div>

      {/* Swatches de la paleta — confirma que los colores cargan bien */}
      <div className="flex flex-col items-center gap-4 w-full max-w-sm">
        <p
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-disabled)" }}
        >
          Paleta de colores
        </p>
        <div className="flex gap-3">
          {[
            { label: "Primario", var: "--color-primary" },
            { label: "Proteína", var: "--color-protein" },
            { label: "Carbos", var: "--color-carbs" },
            { label: "Grasa", var: "--color-fat" },
            { label: "Peligro", var: "--color-danger" },
          ].map(({ label, var: cssVar }) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <div
                className="w-10 h-10 rounded-xl shadow-sm"
                style={{ backgroundColor: `var(${cssVar})` }}
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Status de setup */}
      <div
        className="w-full max-w-sm rounded-2xl border p-5 space-y-2"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-base)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <p
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          ✅ Setup completado
        </p>
        {[
          "Next.js 15 con App Router",
          "TypeScript",
          "Tailwind CSS v4",
          "Firebase SDK instalado",
          "Estructura de carpetas lista",
          "Tipos base definidos",
        ].map((item) => (
          <p
            key={item}
            className="text-sm pl-2"
            style={{ color: "var(--text-secondary)" }}
          >
            · {item}
          </p>
        ))}
      </div>

      <p
        className="text-xs text-center pb-8"
        style={{ color: "var(--text-disabled)" }}
      >
        Esta página es temporal — próxima tanda: pantalla de Login con Google.
      </p>
    </main>
  );
}
