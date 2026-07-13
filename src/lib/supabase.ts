import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diset — data bersama (Kategori & Produk) tidak akan berfungsi.');
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');

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
