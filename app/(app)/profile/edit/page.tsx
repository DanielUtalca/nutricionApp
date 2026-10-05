"use client";

// ============================================================
// Editar perfil — /profile/edit: datos, objetivo y actividad
// ============================================================
// Muestra en vivo cómo cambian las metas y al guardar las recalcula
// (si estaban personalizadas, se pregunta antes de pisarlas).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/profile-context";
import { calculateGoals, type ProfileErrors } from "@/lib/nutrition";
import { goalsToProfileFields } from "@/lib/profile";
import { formatInt } from "@/lib/macros";
import { Page, PageHeader, ErrorNote } from "@/components/ui/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ActivityPicker,
  BodyFields,
  GoalPicker,
  draftFromProfile,
  parseDraft,
  type ProfileDraft,
} from "@/components/profile/profile-form-parts";

export default function EditProfilePage() {
  const { profile, updateProfile } = useProfile();
  const router = useRouter();
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(profile));
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [recalc, setRecalc] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseDraft(draft), [draft]);
  const preview = parsed.ok ? calculateGoals(parsed.input) : null;
  const patch = (p: Partial<ProfileDraft>) => setDraft((d) => ({ ...d, ...p }));

  if (!profile) return null;
  const customized = Boolean(profile.goalsCustomized);
  const willRecalc = !customized || recalc;

  const save = async () => {
    if (!parsed.ok) {
      setErrors(parsed.errors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErrors({});
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ ...parsed.input, ...(willRecalc ? goalsToProfileFields(parsed.input) : {}) });
      router.replace("/profile");
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar tu perfil.");
      setSaving(false);
    }
  };

  return (
    <Page>
      <PageHeader title="Editar perfil" back="/profile" />

      <Card className="p-4 flex flex-col gap-4">
        <SectionTitle>Datos corporales</SectionTitle>
        <BodyFields draft={draft} onChange={patch} errors={errors} />
      </Card>

      <Card className="p-4 flex flex-col gap-4">
        <SectionTitle>Objetivo</SectionTitle>
        <GoalPicker value={draft.goal} onChange={(goal) => patch({ goal })} />
      </Card>

      <Card className="p-4 flex flex-col gap-4">
        <SectionTitle>Actividad física</SectionTitle>
        <ActivityPicker isActive={draft.isActive} activities={draft.activities} onChange={patch} />
      </Card>

      {preview && (
        <Card className="p-4 flex flex-col gap-3">
          <SectionTitle>Metas con estos datos</SectionTitle>
          <p className="text-sm">
            <span className="text-2xl font-bold">{formatInt(preview.calories)}</span>{" "}
            <span className="text-text-secondary">kcal · P {preview.proteinG} g · C {preview.carbsG} g · G {preview.fatG} g</span>
          </p>
          {preview.calories !== profile.dailyCaloriesTarget && (
            <p className="text-xs text-text-secondary">
              Actual: {formatInt(profile.dailyCaloriesTarget)} kcal
            </p>
          )}
          {customized && (
            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 w-5 h-5 accent-[var(--color-primary)]"
                checked={recalc}
                onChange={(e) => setRecalc(e.target.checked)}
              />
              <span>
                Reemplazar mis metas personalizadas por estas
                <span className="block text-xs text-text-secondary">
                  Si lo desmarcas, se guardan tus datos pero se mantienen tus metas manuales.
                </span>
              </span>
            </label>
          )}
        </Card>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}
      <Button size="lg" fullWidth onClick={save} loading={saving}>
        Guardar {willRecalc ? "y recalcular metas" : "datos"}
      </Button>
    </Page>
  );
}
