"use client";

// ============================================================
// Layout protegido para las rutas de la app autenticada
// ============================================================
// 1. Si no hay sesión, redirige a /login.
// 2. Carga el perfil en tiempo real (ProfileProvider).
// 3. Si el perfil no está completo, manda al onboarding.

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ProfileProvider, useProfile } from "@/lib/profile-context";
import { isProfileComplete } from "@/lib/profile";
import { FullScreenSpinner } from "@/components/ui/spinner";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) return <FullScreenSpinner />;

  return (
    <ProfileProvider>
      <OnboardingGate>{children}</OnboardingGate>
    </ProfileProvider>
  );
}

function OnboardingGate({ children }: { children: ReactNode }) {
  const { profile, loading } = useProfile();
  const pathname = usePathname();
  const router = useRouter();
  const onOnboarding = pathname === "/onboarding";
  const complete = isProfileComplete(profile);

  useEffect(() => {
    if (!loading && !complete && !onOnboarding) {
      router.replace("/onboarding");
    }
  }, [loading, complete, onOnboarding, router]);

  if (loading || (!complete && !onOnboarding)) return <FullScreenSpinner />;

  return <>{children}</>;
}
