import { Outlet } from 'react-router-dom';
import { seedDefaultData } from '@/lib/db';
import { useEffect } from 'react';
import BottomNav from './BottomNav';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useCloudAutoBackup } from '@/hooks/use-cloud-auto-backup';
import { useStoreSettings } from '@/hooks/use-store-settings';
import Onboarding from '@/components/Onboarding';
import LoginScreen from '@/components/LoginScreen';
import PushPermissionModal from '@/components/PushPermissionModal';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from 'react-i18next';

export default function AppLayout() {
  const {} = useTranslation();
  useThemeColor(); // Apply saved theme color on mount
  useCloudAutoBackup(); // Auto cloud backup on app open (if enabled & subscribed)
  const { multiUserEnabled, currentUser, loading } = useAuth();
  const { settings, loading: settingsLoading } = useStoreSettings();

  useEffect(() => {
    seedDefaultData();
  }, []);

  // Loading state
  if (settingsLoading || loading) return null;

  // Show onboarding if not done yet — storeSettings dibagi semua device lewat
  // Supabase, jadi begitu 1 device selesai onboarding, device lain otomatis lewat.
  if (!settings || !settings.onboardingDone) {
    return <Onboarding onComplete={() => { /* useStoreSettings realtime akan auto-refresh */ }} />;
  }

  // Multi-user mode is on but no one is logged in → show login
  if (multiUserEnabled && !currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-background max-w-lg md:max-w-6xl mx-auto relative">
      <main className="pb-20">
        <Outlet />
      </main>
      <BottomNav />
      <PushPermissionModal />
    </div>
  );
}
