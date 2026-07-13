import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

if (!isSupabaseConfigured) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diset — data bersama (Kategori & Produk) tidak akan berfungsi.');
}

// createClient() melempar error kalau URL-nya bukan URL valid (termasuk string
// kosong) — pakai placeholder URL yang sah supaya modul ini tetap bisa dimuat
// (dan tidak merusak seluruh app) walau env var belum diset; panggilan API-nya
// sendiri nanti gagal secara normal (network error), bukan crash saat load.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
);

// --- Row <-> app-model mapping helpers -------------------------------------
// Tabel Postgres pakai snake_case (konvensi Supabase); tipe TS di app pakai
// camelCase (mengikuti interface Category/Product di src/lib/db.ts). Mapper
// kecil ini menjaga kode halaman tetap memakai bentuk camelCase yang sama.

export interface SupabaseCategory {
  id: number;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
  isDeleted: number;
  deletedAt: string | null;
  updatedAt: string;
}

export function mapCategoryRow(row: Record<string, unknown>): SupabaseCategory {
  return {
    id: row.id as number,
    name: row.name as string,
    color: row.color as string,
    icon: row.icon as string,
    createdAt: row.created_at as string,
    isDeleted: row.is_deleted as number,
    deletedAt: row.deleted_at as string | null,
    updatedAt: row.updated_at as string,
  };
}

export interface SupabaseProduct {
  id: number;
  name: string;
  sku: string;
  categoryId: number;
  price: number;
  hpp: number;
  stock: number;
  trackStock: boolean;
  isCustomPrice: boolean;
  unit: string;
  description?: string;
  photo?: string;
  barcode?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: number;
  deletedAt: string | null;
}

export function mapProductRow(row: Record<string, unknown>): SupabaseProduct {
  return {
    id: row.id as number,
    name: row.name as string,
    sku: row.sku as string,
    categoryId: row.category_id as number,
    price: Number(row.price),
    hpp: Number(row.hpp),
    stock: Number(row.stock),
    trackStock: row.track_stock as boolean,
    isCustomPrice: row.is_custom_price as boolean,
    unit: row.unit as string,
    description: (row.description as string | null) ?? undefined,
    photo: (row.photo as string | null) ?? undefined,
    barcode: (row.barcode as string | null) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    isDeleted: row.is_deleted as number,
    deletedAt: row.deleted_at as string | null,
  };
}

/** camelCase app fields -> snake_case DB columns, for insert/update payloads. */
export function categoryToRow(data: Partial<Omit<SupabaseCategory, 'id'>>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.color !== undefined) row.color = data.color;
  if (data.icon !== undefined) row.icon = data.icon;
  if (data.isDeleted !== undefined) row.is_deleted = data.isDeleted;
  if (data.deletedAt !== undefined) row.deleted_at = data.deletedAt;
  row.updated_at = new Date().toISOString();
  return row;
}

export function productToRow(data: Partial<Omit<SupabaseProduct, 'id'>>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.sku !== undefined) row.sku = data.sku;
  if (data.categoryId !== undefined) row.category_id = data.categoryId;
  if (data.price !== undefined) row.price = data.price;
  if (data.hpp !== undefined) row.hpp = data.hpp;
  if (data.stock !== undefined) row.stock = data.stock;
  if (data.trackStock !== undefined) row.track_stock = data.trackStock;
  if (data.isCustomPrice !== undefined) row.is_custom_price = data.isCustomPrice;
  if (data.unit !== undefined) row.unit = data.unit;
  if (data.description !== undefined) row.description = data.description ?? null;
  if (data.photo !== undefined) row.photo = data.photo ?? null;
  if (data.barcode !== undefined) row.barcode = data.barcode ?? null;
  if (data.isDeleted !== undefined) row.is_deleted = data.isDeleted;
  if (data.deletedAt !== undefined) row.deleted_at = data.deletedAt;
  row.updated_at = new Date().toISOString();
  return row;
}

// --- store_settings (baris tunggal, id selalu 1) -----------------------------
// Hanya field "profil toko" yang dibagi semua device. Field lain (deviceId,
// lastBackupAt, cloudStoreId, dst.) tetap lokal per-device di Dexie.

export interface SupabaseStoreSettings {
  id: number;
  storeName: string;
  address: string;
  phone: string;
  receiptFooter: string;
  onboardingDone: boolean;
  themeColor: string | null;
  logo: string | null;
  multiUserEnabled: boolean;
  allowDebt: boolean;
  printLogo: boolean;
  hideWatermark: boolean;
  updatedAt: string;
}

export function mapStoreSettingsRow(row: Record<string, unknown>): SupabaseStoreSettings {
  return {
    id: row.id as number,
    storeName: row.store_name as string,
    address: row.address as string,
    phone: row.phone as string,
    receiptFooter: row.receipt_footer as string,
    onboardingDone: row.onboarding_done as boolean,
    themeColor: (row.theme_color as string | null) ?? null,
    logo: (row.logo as string | null) ?? null,
    multiUserEnabled: row.multi_user_enabled as boolean,
    allowDebt: row.allow_debt as boolean,
    printLogo: row.print_logo as boolean,
    hideWatermark: row.hide_watermark as boolean,
    updatedAt: row.updated_at as string,
  };
}

export function storeSettingsToRow(data: Partial<Omit<SupabaseStoreSettings, 'id'>>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.storeName !== undefined) row.store_name = data.storeName;
  if (data.address !== undefined) row.address = data.address;
  if (data.phone !== undefined) row.phone = data.phone;
  if (data.receiptFooter !== undefined) row.receipt_footer = data.receiptFooter;
  if (data.onboardingDone !== undefined) row.onboarding_done = data.onboardingDone;
  if (data.themeColor !== undefined) row.theme_color = data.themeColor;
  if (data.logo !== undefined) row.logo = data.logo;
  if (data.multiUserEnabled !== undefined) row.multi_user_enabled = data.multiUserEnabled;
  if (data.allowDebt !== undefined) row.allow_debt = data.allowDebt;
  if (data.printLogo !== undefined) row.print_logo = data.printLogo;
  if (data.hideWatermark !== undefined) row.hide_watermark = data.hideWatermark;
  row.updated_at = new Date().toISOString();
  return row;
}

// --- suppliers ---------------------------------------------------------------

export interface SupabaseSupplier {
  id: number;
  name: string;
  phone: string;
  address: string;
  notes: string;
  createdAt: string;
  isDeleted: number;
  deletedAt: string | null;
  updatedAt: string;
}

export function mapSupplierRow(row: Record<string, unknown>): SupabaseSupplier {
  return {
    id: row.id as number,
    name: row.name as string,
    phone: row.phone as string,
    address: row.address as string,
    notes: row.notes as string,
    createdAt: row.created_at as string,
    isDeleted: row.is_deleted as number,
    deletedAt: row.deleted_at as string | null,
    updatedAt: row.updated_at as string,
  };
}

export function supplierToRow(data: Partial<Omit<SupabaseSupplier, 'id'>>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.phone !== undefined) row.phone = data.phone;
  if (data.address !== undefined) row.address = data.address;
  if (data.notes !== undefined) row.notes = data.notes;
  if (data.isDeleted !== undefined) row.is_deleted = data.isDeleted;
  if (data.deletedAt !== undefined) row.deleted_at = data.deletedAt;
  row.updated_at = new Date().toISOString();
  return row;
}

// --- customers -----------------------------------------------------------------

export interface SupabaseCustomer {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt: string;
  isDeleted: number;
  deletedAt: string | null;
  updatedAt: string;
}

export function mapCustomerRow(row: Record<string, unknown>): SupabaseCustomer {
  return {
    id: row.id as number,
    name: row.name as string,
    phone: row.phone as string,
    email: row.email as string,
    address: row.address as string,
    notes: row.notes as string,
    createdAt: row.created_at as string,
    isDeleted: row.is_deleted as number,
    deletedAt: row.deleted_at as string | null,
    updatedAt: row.updated_at as string,
  };
}

export function customerToRow(data: Partial<Omit<SupabaseCustomer, 'id'>>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.phone !== undefined) row.phone = data.phone;
  if (data.email !== undefined) row.email = data.email;
  if (data.address !== undefined) row.address = data.address;
  if (data.notes !== undefined) row.notes = data.notes;
  if (data.isDeleted !== undefined) row.is_deleted = data.isDeleted;
  if (data.deletedAt !== undefined) row.deleted_at = data.deletedAt;
  row.updated_at = new Date().toISOString();
  return row;
}

// --- units ---------------------------------------------------------------------

export interface SupabaseUnit {
  id: number;
  name: string;
  isDefault: number;
  createdAt: string;
  isDeleted: number;
  deletedAt: string | null;
  updatedAt: string;
}

export function mapUnitRow(row: Record<string, unknown>): SupabaseUnit {
  return {
    id: row.id as number,
    name: row.name as string,
    isDefault: row.is_default as number,
    createdAt: row.created_at as string,
    isDeleted: row.is_deleted as number,
    deletedAt: row.deleted_at as string | null,
    updatedAt: row.updated_at as string,
  };
}

export function unitToRow(data: Partial<Omit<SupabaseUnit, 'id'>>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.isDefault !== undefined) row.is_default = data.isDefault;
  if (data.isDeleted !== undefined) row.is_deleted = data.isDeleted;
  if (data.deletedAt !== undefined) row.deleted_at = data.deletedAt;
  row.updated_at = new Date().toISOString();
  return row;
}

// --- payment_methods (hard-delete, tanpa soft-delete) ---------------------------

export interface SupabasePaymentMethod {
  id: number;
  name: string;
  category: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export function mapPaymentMethodRow(row: Record<string, unknown>): SupabasePaymentMethod {
  return {
    id: row.id as number,
    name: row.name as string,
    category: row.category as string,
    isDefault: row.is_default as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function paymentMethodToRow(data: Partial<Omit<SupabasePaymentMethod, 'id'>>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.category !== undefined) row.category = data.category;
  if (data.isDefault !== undefined) row.is_default = data.isDefault;
  row.updated_at = new Date().toISOString();
  return row;
}

// --- expense_categories ----------------------------------------------------------

export interface SupabaseExpenseCategory {
  id: number;
  name: string;
  color: string;
  icon: string;
  isDefault: number;
  createdAt: string;
  isDeleted: number;
  deletedAt: string | null;
  updatedAt: string;
}

export function mapExpenseCategoryRow(row: Record<string, unknown>): SupabaseExpenseCategory {
  return {
    id: row.id as number,
    name: row.name as string,
    color: row.color as string,
    icon: row.icon as string,
    isDefault: row.is_default as number,
    createdAt: row.created_at as string,
    isDeleted: row.is_deleted as number,
    deletedAt: row.deleted_at as string | null,
    updatedAt: row.updated_at as string,
  };
}

export function expenseCategoryToRow(data: Partial<Omit<SupabaseExpenseCategory, 'id'>>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.color !== undefined) row.color = data.color;
  if (data.icon !== undefined) row.icon = data.icon;
  if (data.isDefault !== undefined) row.is_default = data.isDefault;
  if (data.isDeleted !== undefined) row.is_deleted = data.isDeleted;
  if (data.deletedAt !== undefined) row.deleted_at = data.deletedAt;
  row.updated_at = new Date().toISOString();
  return row;
}
