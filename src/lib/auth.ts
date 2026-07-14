import { type PermissionKey, ALL_PERMISSIONS } from './db';
import { supabase, mapUserRow, type SupabaseUser } from './supabase';

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

export function isValidUsername(username: string): boolean {
  // 3-20 chars, alphanumeric + underscore + dot, no spaces
  return /^[a-zA-Z0-9_.]{3,20}$/.test(username);
}

// === Permissions ===
export { ALL_PERMISSIONS };
export type { PermissionKey };

export const PERMISSION_LABELS: Record<PermissionKey, { title: string; desc: string }> = {
  create_transaction: {
    title: 'Buat Transaksi',
    desc: 'Akses Kasir, simpan open bill, dan checkout pembayaran',
  },
  delete_transaction: {
    title: 'Hapus / Batalkan Transaksi',
    desc: 'Hapus transaksi di Riwayat dan batalkan open bill',
  },
  manage_products: {
    title: 'Kelola Produk',
    desc: 'Tambah, edit, dan hapus produk',
  },
  manage_categories_payments: {
    title: 'Kelola Kategori & Metode Bayar',
    desc: 'CRUD kategori produk dan metode pembayaran',
  },
  manage_stock_inout: {
    title: 'Stock In / Stock Out',
    desc: 'Catat barang masuk dari supplier dan barang keluar non-penjualan',
  },
  manage_supplier: {
    title: 'Kelola Supplier',
    desc: 'Tambah, edit, dan hapus data supplier',
  },
  manage_customers: {
    title: 'Kelola Pelanggan',
    desc: 'Tambah, edit, dan hapus data pelanggan',
  },
  view_reports: {
    title: 'Lihat Laporan & Profit',
    desc: 'Akses laporan penjualan, profit, HPP, dan laporan stok',
  },
  manage_backup: {
    title: 'Backup & Restore',
    desc: 'Export dan import data toko (restore dapat menimpa semua data)',
  },
  manage_store_settings: {
    title: 'Edit Info Toko & Tema',
    desc: 'Ubah nama toko, alamat, telepon, logo, warna tema',
  },
  manage_expenses: {
    title: 'Catat Pengeluaran',
    desc: 'Tambah, edit, dan hapus pengeluaran (listrik, gaji, sewa, dll)',
  },
  view_expenses: {
    title: 'Lihat Pengeluaran',
    desc: 'Lihat daftar dan total pengeluaran toko',
  },
};

// Default permission set for new staff: create transaction only.
export const DEFAULT_STAFF_PERMISSIONS: PermissionKey[] = ['create_transaction'];

// Owner implicitly has every permission. This helper centralizes the check.
export function hasPermission(user: SupabaseUser | null, key: PermissionKey): boolean {
  if (!user) return false;
  if (user.role === 'owner') return true;
  return user.permissions.includes(key);
}

// Owner-only: managing other users.
export function canManageUsers(user: SupabaseUser | null): boolean {
  return user?.role === 'owner';
}

// === Login ===
// Verifikasi PIN dilakukan server-side lewat RPC `verify_staff_pin` — pin_hash
// tidak pernah dikirim ke client, dan hashing (bcrypt/pgcrypto) juga terjadi
// di server. Lihat SQL Batch B untuk definisi fungsinya.

export interface LoginResult {
  ok: boolean;
  user?: SupabaseUser;
  error?: string;
}

export async function login(username: string, pin: string): Promise<LoginResult> {
  const trimmed = username.trim().toLowerCase();
  if (!trimmed || !pin) return { ok: false, error: 'Username dan PIN wajib diisi' };

  const { data, error } = await supabase.rpc('verify_staff_pin', { p_username: trimmed, p_pin: pin });
  if (error) return { ok: false, error: 'Gagal menghubungi server, coba lagi' };
  if (!data) return { ok: false, error: 'Username atau PIN salah' };

  return { ok: true, user: mapUserRow(data as Record<string, unknown>) };
}

// === Session persistence (localStorage) ===
// Disederhanakan jadi userId saja — gerbang device-level sekarang login
// Supabase (SupabaseLoginGate), jadi binding ke deviceId lokal sudah tidak
// relevan untuk sesi PIN staff.

const SESSION_KEY = 'kasirgratisan_session_v2';

interface StoredSession {
  userId: number;
}

export function saveSession(userId: number): void {
  const data: StoredSession = { userId };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be full or disabled — silent failure, user re-logs next time
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export async function restoreSession(): Promise<SupabaseUser | null> {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredSession;
    if (!data?.userId) return null;

    const { data: row, error } = await supabase.from('users_public').select('*').eq('id', data.userId).maybeSingle();
    if (error || !row) {
      clearSession();
      return null;
    }
    const user = mapUserRow(row);
    if (!user.isActive) {
      clearSession();
      return null;
    }
    return user;
  } catch {
    clearSession();
    return null;
  }
}

// === User CRUD helpers ===

export async function createUser(input: {
  username: string;
  pin: string;
  name: string;
  role: 'owner' | 'staff';
  permissions: PermissionKey[];
}): Promise<{ ok: boolean; userId?: number; error?: string }> {
  const username = input.username.trim().toLowerCase();
  if (!isValidUsername(username)) {
    return { ok: false, error: 'Username 3-20 karakter, hanya huruf/angka/underscore' };
  }
  if (!isValidPin(input.pin)) {
    return { ok: false, error: 'PIN harus 4-6 digit angka' };
  }
  if (!input.name.trim()) {
    return { ok: false, error: 'Nama tidak boleh kosong' };
  }

  const { data, error } = await supabase.rpc('create_staff_user', {
    p_username: username,
    p_pin: input.pin,
    p_name: input.name.trim(),
    p_role: input.role,
    p_permissions: input.role === 'owner' ? [] : input.permissions,
  });

  if (error) {
    if (error.message?.includes('username_taken')) {
      return { ok: false, error: `Username "${username}" sudah dipakai` };
    }
    return { ok: false, error: 'Gagal membuat akun, coba lagi' };
  }

  return { ok: true, userId: (data as { id: number }).id };
}

export async function updateUserPin(userId: number, newPin: string): Promise<{ ok: boolean; error?: string }> {
  if (!isValidPin(newPin)) return { ok: false, error: 'PIN harus 4-6 digit angka' };
  const { error } = await supabase.rpc('update_staff_pin', { p_user_id: userId, p_new_pin: newPin });
  if (error) return { ok: false, error: 'Gagal mengubah PIN, coba lagi' };
  return { ok: true };
}
