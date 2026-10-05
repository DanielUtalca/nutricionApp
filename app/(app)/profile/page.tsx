"use client";

// ============================================================
// Perfil — /profile: datos, metas (auto o manuales) y sesión
// ============================================================

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/profile-context";
import { ACTIVITY_LABELS, GOAL_LABELS, goalsToProfileFields } from "@/lib/profile";
import { caloriesFromMacros } from "@/lib/nutrition";
import { formatInt } from "@/lib/macros";
import { Page, PageHeader, ErrorNote } from "@/components/ui/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, parseNumberInput } from "@/components/ui/field";
import { CartIcon, ChevronRightIcon, EditIcon, ScaleIcon } from "@/components/ui/icons";
import { GoalsSummary } from "@/components/profile/goals-summary";

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { profile, updateProfile } = useProfile();
  const router = useRouter();
  const [editingGoals, setEditingGoals] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  if (!profile || !user) return null;

  const activities = profile.isActive && profile.activities.length
    ? profile.activities.map((a) => `${ACTIVITY_LABELS[a.type].title} ${a.timesPerWeek}×/sem`).join(" · ")
    : "Sin ejercicio planificado";

  const recalc = async () => {
    setMessage(null);
    try {
      await updateProfile(
        goalsToProfileFields({
          sex: profile.sex,
          age: profile.age,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
          goal: profile.goal,
          isActive: profile.isActive,
          activities: profile.activities,
        }),
      );
      setMessage({ type: "ok", text: "Metas recalculadas con tus datos actuales." });
    } catch {
      setMessage({ type: "error", text: "No se pudieron recalcular las metas." });
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.replace("/login");
  };

  return (
    <Page>
      <PageHeader title="Perfil" />

      <Card className="p-4 flex items-center gap-4">
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar externo de Google
          <img src={user.photoURL} alt="" className="w-14 h-14 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="w-14 h-14 rounded-full bg-primary-muted text-primary text-xl font-bold flex items-center justify-center">
            {(profile.displayName || user.email || "?").charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="font-semibold truncate">{profile.displayName || user.displayName}</p>
          <p className="text-sm text-text-secondary truncate">{profile.email || user.email}</p>
        </div>
      </Card>

      {/* Metas */}
      <Card className="p-5 flex flex-col gap-4">
        <SectionTitle
          action={
            !editingGoals && (
              <button
                type="button"
                onClick={() => setEditingGoals(true)}
                className="text-xs font-medium text-primary cursor-pointer flex items-center gap-1"
              >
                <EditIcon size={14} /> Editar a mano
              </button>
            )
          }
        >
          Metas diarias {profile.goalsCustomized ? "· personalizadas" : "· automáticas"}
        </SectionTitle>
        {editingGoals ? (
          <GoalsForm
            initial={{
              calories: profile.dailyCaloriesTarget,
              proteinG: profile.dailyProteinGTarget,
              carbsG: profile.dailyCarbsGTarget,
              fatG: profile.dailyFatGTarget,
              waterL: profile.dailyWaterLTarget,
            }}
            onCancel={() => setEditingGoals(false)}
            onSave={async (g) => {
              await updateProfile({
                dailyCaloriesTarget: g.calories,
                dailyProteinGTarget: g.proteinG,
                dailyCarbsGTarget: g.carbsG,
                dailyFatGTarget: g.fatG,
                dailyWaterLTarget: g.waterL,
                goalsCustomized: true,
              });
              setEditingGoals(false);
              setMessage({ type: "ok", text: "Metas guardadas." });
            }}
          />
        ) : (
          <>
            <GoalsSummary
              goals={{
                calories: profile.dailyCaloriesTarget,
                proteinG: profile.dailyProteinGTarget,
                carbsG: profile.dailyCarbsGTarget,
                fatG: profile.dailyFatGTarget,
                bmr: profile.bmr,
                tdee: profile.tdee,
                activityMultiplier: profile.activityMultiplier,
                waterL: profile.dailyWaterLTarget,
              }}
            />
            {profile.goalsCustomized && (
              <Button variant="secondary" onClick={recalc}>
                Volver a metas automáticas
              </Button>
            )}
          </>
        )}
        {message &&
          (message.type === "error" ? (
            <ErrorNote>{message.text}</ErrorNote>
          ) : (
            <p role="status" className="text-sm rounded-xl px-3.5 py-2.5 bg-primary-muted">
              {message.text}
            </p>
          ))}
      </Card>

      {/* Datos personales */}
      <Card className="p-4 flex flex-col gap-3">
        <SectionTitle
          action={
            <Link href="/profile/edit" className="text-xs font-medium text-primary flex items-center gap-1">
              <EditIcon size={14} /> Editar
            </Link>
          }
        >
          Mis datos
        </SectionTitle>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-text-secondary">Objetivo</dt>
            <dd className="font-medium">
              {GOAL_LABELS[profile.goal].emoji} {GOAL_LABELS[profile.goal].title}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Sexo · edad</dt>
            <dd className="font-medium">
              {profile.sex === "male" ? "Hombre" : "Mujer"} · {profile.age} años
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Altura</dt>
            <dd className="font-medium">{profile.heightCm} cm</dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Peso</dt>
            <dd className="font-medium">{profile.weightKg.toLocaleString("es-CL")} kg</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-text-secondary">Actividad</dt>
            <dd className="font-medium">{activities}</dd>
          </div>
        </dl>
      </Card>

      <Card className="divide-y divide-border-subtle">
        {[
          { href: "/progress", label: "Peso y medidas", Icon: ScaleIcon },
          { href: "/shopping", label: "Lista de compras", Icon: CartIcon },
        ].map(({ href, label, Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-bg-subtle first:rounded-t-2xl last:rounded-b-2xl">
            <Icon size={20} className="text-text-secondary" />
            <span className="flex-1 text-sm font-medium">{label}</span>
            <ChevronRightIcon size={18} className="text-text-disabled" />
          </Link>
        ))}
      </Card>

      <Button variant="secondary" size="lg" onClick={handleSignOut} loading={signingOut} id="sign-out-button">
        Cerrar sesión
      </Button>

      <p className="text-xs text-text-disabled text-center">
        🔒 Tus datos solo los ves tú · NutriTrack, sin suscripciones
      </p>
    </Page>
  );
}

function GoalsForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: { calories: number; proteinG: number; carbsG: number; fatG: number; waterL: number };
  onSave: (g: typeof initial) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    calories: String(initial.calories),
    proteinG: String(initial.proteinG),
    carbsG: String(initial.carbsG),
    fatG: String(initial.fatG),
    waterL: String(initial.waterL),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const values = {
    calories: parseNumberInput(form.calories) ?? 0,
    proteinG: parseNumberInput(form.proteinG) ?? 0,
    carbsG: parseNumberInput(form.carbsG) ?? 0,
    fatG: parseNumberInput(form.fatG) ?? 0,
    waterL: parseNumberInput(form.waterL) ?? 0,
  };
  const macroKcal = caloriesFromMacros(values.proteinG, values.carbsG, values.fatG);
  const diff = macroKcal - values.calories;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (values.calories < 800 || values.calories > 6000) return setError("Las calorías deben estar entre 800 y 6.000.");
    if ([values.proteinG, values.carbsG, values.fatG].some((n) => n < 0 || n > 800)) return setError("Revisa los gramos de macros.");
    if (values.waterL < 0.5 || values.waterL > 8) return setError("La meta de agua debe estar entre 0,5 y 8 L.");
    setSaving(true);
    setError(null);
    try {
      await onSave({
        calories: Math.round(values.calories),
        proteinG: Math.round(values.proteinG),
        carbsG: Math.round(values.carbsG),
        fatG: Math.round(values.fatG),
        waterL: Math.round(values.waterL * 100) / 100,
      });
    } catch {
      setError("No se pudieron guardar las metas.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="Calorías" type="number" inputMode="numeric" suffix="kcal" value={form.calories} onChange={set("calories")} />
      <div className="grid grid-cols-3 gap-3">
        <Field label="Proteína" type="number" inputMode="numeric" suffix="g" value={form.proteinG} onChange={set("proteinG")} />
        <Field label="Carbos" type="number" inputMode="numeric" suffix="g" value={form.carbsG} onChange={set("carbsG")} />
        <Field label="Grasa" type="number" inputMode="numeric" suffix="g" value={form.fatG} onChange={set("fatG")} />
      </div>
      <p className="text-xs text-text-secondary">
        Los macros suman {formatInt(macroKcal)} kcal
        {Math.abs(diff) > 50 && ` (${diff > 0 ? "+" : "−"}${formatInt(Math.abs(diff))} respecto a tu meta)`}.
      </p>
      <Field label="Agua" type="number" inputMode="decimal" step="0.25" suffix="L" value={form.waterL} onChange={set("waterL")} />
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" loading={saving}>
          Guardar metas
        </Button>
      </div>
    </form>
  );
}
