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

// --- expenses ------------------------------------------------------------------

export interface SupabaseExpense {
  id: number;
  title: string;
  categoryId: number;
  amount: number;
  paymentMethodId: number;
  date: string;
  notes?: string;
  createdAt: string;
  createdBy?: number;
  isDeleted: number;
  deletedAt: string | null;
  updatedAt: string;
}

export function mapExpenseRow(row: Record<string, unknown>): SupabaseExpense {
  return {
    id: row.id as number,
    title: row.title as string,
    categoryId: row.category_id as number,
    amount: Number(row.amount),
    paymentMethodId: row.payment_method_id as number,
    date: row.date as string,
    notes: (row.notes as string | null) ?? undefined,
    createdAt: row.created_at as string,
    createdBy: (row.created_by as number | null) ?? undefined,
    isDeleted: row.is_deleted as number,
    deletedAt: row.deleted_at as string | null,
    updatedAt: row.updated_at as string,
  };
}

export function expenseToRow(data: Partial<Omit<SupabaseExpense, 'id'>>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.title !== undefined) row.title = data.title;
  if (data.categoryId !== undefined) row.category_id = data.categoryId;
  if (data.amount !== undefined) row.amount = data.amount;
  if (data.paymentMethodId !== undefined) row.payment_method_id = data.paymentMethodId;
  if (data.date !== undefined) row.date = data.date;
  if (data.notes !== undefined) row.notes = data.notes ?? null;
  if (data.createdBy !== undefined) row.created_by = data.createdBy;
  if (data.isDeleted !== undefined) row.is_deleted = data.isDeleted;
  if (data.deletedAt !== undefined) row.deleted_at = data.deletedAt;
  row.updated_at = new Date().toISOString();
  return row;
}

// --- stock_ins / stock_outs / hpp_history (read-only lists; tulis lewat RPC) ---

export interface SupabaseStockIn {
  id: number;
  productId: number;
  supplierId: number;
  quantity: number;
  buyPrice: number;
  totalPrice: number;
  date: string;
  notes?: string;
  createdBy?: number;
  updatedAt: string;
}

export function mapStockInRow(row: Record<string, unknown>): SupabaseStockIn {
  return {
    id: row.id as number,
    productId: row.product_id as number,
    supplierId: row.supplier_id as number,
    quantity: Number(row.quantity),
    buyPrice: Number(row.buy_price),
    totalPrice: Number(row.total_price),
    date: row.date as string,
    notes: (row.notes as string | null) ?? undefined,
    createdBy: (row.created_by as number | null) ?? undefined,
    updatedAt: row.updated_at as string,
  };
}

export interface SupabaseStockOut {
  id: number;
  productId: number;
  quantity: number;
  reason: string;
  date: string;
  notes?: string;
  createdBy?: number;
  updatedAt: string;
}

export function mapStockOutRow(row: Record<string, unknown>): SupabaseStockOut {
  return {
    id: row.id as number,
    productId: row.product_id as number,
    quantity: Number(row.quantity),
    reason: row.reason as string,
    date: row.date as string,
    notes: (row.notes as string | null) ?? undefined,
    createdBy: (row.created_by as number | null) ?? undefined,
    updatedAt: row.updated_at as string,
  };
}

export interface SupabaseHppHistory {
  id: number;
  productId: number;
  oldHpp: number;
  newHpp: number;
  source: 'stock_in' | 'manual';
  date: string;
  updatedAt: string;
}

export function mapHppHistoryRow(row: Record<string, unknown>): SupabaseHppHistory {
  return {
    id: row.id as number,
    productId: row.product_id as number,
    oldHpp: Number(row.old_hpp),
    newHpp: Number(row.new_hpp),
    source: row.source as 'stock_in' | 'manual',
    date: row.date as string,
    updatedAt: row.updated_at as string,
  };
}

// --- stock_opnames / stock_opname_items -----------------------------------------

export interface SupabaseStockOpname {
  id: number;
  date: string;
  status: 'draft' | 'completed';
  notes?: string;
  createdBy?: number;
  updatedAt: string;
}

export function mapStockOpnameRow(row: Record<string, unknown>): SupabaseStockOpname {
  return {
    id: row.id as number,
    date: row.date as string,
    status: row.status as 'draft' | 'completed',
    notes: (row.notes as string | null) ?? undefined,
    createdBy: (row.created_by as number | null) ?? undefined,
    updatedAt: row.updated_at as string,
  };
}

export interface SupabaseStockOpnameItem {
  id: number;
  opnameId: number;
  productId: number;
  systemStock: number;
  realStock: number;
  difference: number;
}

export function mapStockOpnameItemRow(row: Record<string, unknown>): SupabaseStockOpnameItem {
  return {
    id: row.id as number,
    opnameId: row.opname_id as number,
    productId: row.product_id as number,
    systemStock: Number(row.system_stock),
    realStock: Number(row.real_stock),
    difference: Number(row.difference),
  };
}

// --- transactions / transaction_items -------------------------------------------

export interface SupabaseTransaction {
  id: number;
  subtotal: number;
  discountType: 'percentage' | 'nominal' | null;
  discountValue: number;
  discountAmount: number;
  total: number;
  paymentMethodId: number;
  paymentAmount: number;
  change: number;
  profit: number;
  date: string;
  receiptNumber: string;
  status: 'open' | 'completed';
  customerId?: number;
  customerName?: string;
  tableNumber?: string; // field lama, tidak lagi dipakai di UI — selalu undefined
  remarks?: string;
  openedAt?: string;
  closedAt?: string;
  createdBy?: number;
  debtAmount?: number;
  updatedAt: string;
}

export function mapTransactionRow(row: Record<string, unknown>): SupabaseTransaction {
  return {
    id: row.id as number,
    subtotal: Number(row.subtotal),
    discountType: (row.discount_type as 'percentage' | 'nominal' | null) ?? null,
    discountValue: Number(row.discount_value),
    discountAmount: Number(row.discount_amount),
    total: Number(row.total),
    paymentMethodId: row.payment_method_id as number,
    paymentAmount: Number(row.payment_amount),
    change: Number(row.change),
    profit: Number(row.profit),
    date: row.date as string,
    receiptNumber: row.receipt_number as string,
    status: row.status as 'open' | 'completed',
    customerId: (row.customer_id as number | null) ?? undefined,
    customerName: (row.customer_name as string | null) ?? undefined,
    remarks: (row.remarks as string | null) ?? undefined,
    openedAt: (row.opened_at as string | null) ?? undefined,
    closedAt: (row.closed_at as string | null) ?? undefined,
    createdBy: (row.created_by as number | null) ?? undefined,
    debtAmount: (row.debt_amount as number | null) ?? undefined,
    updatedAt: row.updated_at as string,
  };
}

export interface SupabaseTransactionItem {
  id: number;
  transactionId: number;
  productId: number;
  productName: string;
  quantity: number;
  price: number;
  hpp: number;
  discountType: 'percentage' | 'nominal' | null;
  discountValue: number;
  discountAmount: number;
  subtotal: number;
  notes?: string;
}

export function mapTransactionItemRow(row: Record<string, unknown>): SupabaseTransactionItem {
  return {
    id: row.id as number,
    transactionId: row.transaction_id as number,
    productId: row.product_id as number,
    productName: row.product_name as string,
    quantity: Number(row.quantity),
    price: Number(row.price),
    hpp: Number(row.hpp),
    discountType: (row.discount_type as 'percentage' | 'nominal' | null) ?? null,
    discountValue: Number(row.discount_value),
    discountAmount: Number(row.discount_amount),
    subtotal: Number(row.subtotal),
    notes: (row.notes as string | null) ?? undefined,
  };
}

// --- debts / debt_payments -------------------------------------------------------

export interface SupabaseDebt {
  id: number;
  transactionId: number;
  customerId: number;
  customerName: string;
  originalAmount: number;
  remainingAmount: number;
  status: 'unpaid' | 'partial' | 'paid';
  createdAt: string;
  settledAt: string | null;
  dueDate?: string;
  updatedAt: string;
}

export function mapDebtRow(row: Record<string, unknown>): SupabaseDebt {
  return {
    id: row.id as number,
    transactionId: row.transaction_id as number,
    customerId: row.customer_id as number,
    customerName: row.customer_name as string,
    originalAmount: Number(row.original_amount),
    remainingAmount: Number(row.remaining_amount),
    status: row.status as 'unpaid' | 'partial' | 'paid',
    createdAt: row.created_at as string,
    settledAt: (row.settled_at as string | null) ?? null,
    dueDate: (row.due_date as string | null) ?? undefined,
    updatedAt: row.updated_at as string,
  };
}

export interface SupabaseDebtPayment {
  id: number;
  debtId: number;
  amount: number;
  paymentMethodId: number;
  date: string;
  notes?: string;
  createdBy?: number;
  updatedAt: string;
}

export function mapDebtPaymentRow(row: Record<string, unknown>): SupabaseDebtPayment {
  return {
    id: row.id as number,
    debtId: row.debt_id as number,
    amount: Number(row.amount),
    paymentMethodId: row.payment_method_id as number,
    date: row.date as string,
    notes: (row.notes as string | null) ?? undefined,
    createdBy: (row.created_by as number | null) ?? undefined,
    updatedAt: row.updated_at as string,
  };
}

// --- users (staff PIN login) -------------------------------------------------
// Tabel `users` di Postgres tidak boleh dibaca langsung (RLS tanpa policy,
// menyimpan pin_hash) — hanya lewat view `users_public` (kolom aman) dan
// fungsi RPC security-definer (verify_staff_pin, create_staff_user, dst).
// pin_hash TIDAK PERNAH ada di tipe/mapper ini, sesuai desain.

export interface SupabaseUser {
  id: number;
  username: string;
  name: string;
  role: 'owner' | 'staff';
  permissions: string[];
  isActive: number;
  createdAt: string;
  lastLoginAt: string | null;
  updatedAt: string;
}

export function mapUserRow(row: Record<string, unknown>): SupabaseUser {
  return {
    id: row.id as number,
    username: row.username as string,
    name: row.name as string,
    role: row.role as 'owner' | 'staff',
    permissions: (row.permissions as string[] | null) ?? [],
    isActive: row.is_active as number,
    createdAt: row.created_at as string,
    lastLoginAt: (row.last_login_at as string | null) ?? null,
    updatedAt: row.updated_at as string,
  };
}
