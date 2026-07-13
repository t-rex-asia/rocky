import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { supabase, mapStoreSettingsRow, storeSettingsToRow, type SupabaseStoreSettings } from '@/lib/supabase';
import { db, type StoreSettings } from '@/lib/db';

interface StoreSettingsContextValue {
  settings: SupabaseStoreSettings | undefined;
  loading: boolean;
  updateSettings: (patch: Partial<Omit<SupabaseStoreSettings, 'id'>>) => Promise<void>;
}

const StoreSettingsContext = createContext<StoreSettingsContextValue | undefined>(undefined);

export function StoreSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SupabaseStoreSettings | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await supabase.from('store_settings').select('*').eq('id', 1).maybeSingle();
      if (active && !error && data) setSettings(mapStoreSettingsRow(data));
      if (error) console.error('Gagal memuat pengaturan toko:', error);
      if (active) setLoading(false);
    };
    load();

    const channel = supabase
      .channel('store-settings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, load)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const updateSettings = async (patch: Partial<Omit<SupabaseStoreSettings, 'id'>>) => {
    const { error } = await supabase.from('store_settings').update(storeSettingsToRow(patch)).eq('id', 1);
    if (error) throw error;
  };

  return (
    <StoreSettingsContext.Provider value={{ settings, loading, updateSettings }}>
      {children}
    </StoreSettingsContext.Provider>
  );
}

export function useStoreSettings() {
  const ctx = useContext(StoreSettingsContext);
  if (!ctx) throw new Error('useStoreSettings must be used within StoreSettingsProvider');
  return ctx;
}

/**
 * Menggabungkan field toko yang dibagi semua device (Supabase) dengan field
 * yang tetap lokal per-device (Dexie: deviceId, cloudStoreId, lastBackupAt,
 * dst.) jadi satu objek berbentuk `StoreSettings` — supaya komponen lama
 * (Receipt, KitchenTicket, printer.ts, dll.) yang mengharapkan bentuk itu
 * tidak perlu diubah tipenya.
 */
export function useMergedStoreSettings(): StoreSettings | undefined {
  const { settings } = useStoreSettings();
  const local = useLiveQuery(() => db.storeSettings.toCollection().first());

  if (!settings || !local) return undefined;

  return {
    ...local,
    storeName: settings.storeName,
    address: settings.address,
    phone: settings.phone,
    receiptFooter: settings.receiptFooter,
    onboardingDone: settings.onboardingDone,
    themeColor: settings.themeColor ?? undefined,
    logo: settings.logo ?? undefined,
    multiUserEnabled: settings.multiUserEnabled,
    allowDebt: settings.allowDebt,
    printLogo: settings.printLogo,
    hideWatermark: settings.hideWatermark,
  };
}
