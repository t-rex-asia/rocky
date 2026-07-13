import { db } from './db';
import { syncStoreData, SyncPayload, hasCloudToken } from './cloud-api';

var syncDebounceTimer: any = null;
var isSyncing = false;

/**
 * Pemicu sinkronisasi otomatis ke cloud dengan mekanisme debounce dan locking.
 */
export function triggerBackgroundSync() {
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }

  syncDebounceTimer = setTimeout(async () => {
    if (isSyncing) return;

    try {
      const storeSettings = await db.storeSettings.toCollection().first();
      if (storeSettings && storeSettings.cloudStoreId && hasCloudToken()) {
        isSyncing = true;
        console.log('[Sync] Memulai background sync untuk toko:', storeSettings.cloudStoreId);
        const result = await pushSyncData(storeSettings.cloudStoreId);
        console.log('[Sync] Background sync selesai:', result.message);
      }
    } catch (err) {
      console.warn('[Sync] Background sync gagal:', err);
    } finally {
      isSyncing = false;
    }
  }, 2000); // debounce 2 detik
}

/**
 * Fungsi inti untuk melakukan PUSH data lokal yang kotor (dirty) ke cloud.
 */
export async function pushSyncData(storeId: string): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Ambil data lokal yang berubah (updatedAt > syncedAt atau syncedAt === null)
    const getDirtyRecords = async (tableName: string) => {
      const table = db.table(tableName);
      return table.filter(item => {
        if (!item.syncedAt) return true;
        if (!item.updatedAt) return false;
        return new Date(item.updatedAt).getTime() > new Date(item.syncedAt).getTime();
      }).toArray();
    };

    const categories = await getDirtyRecords('categories');
    const products = await getDirtyRecords('products');
    const customers = await getDirtyRecords('customers');
    const users = await getDirtyRecords('users');
    const transactions = await getDirtyRecords('transactions');
    const expenseCategories = await getDirtyRecords('expenseCategories');
    const expenses = await getDirtyRecords('expenses');
    const debts = await getDirtyRecords('debts');
    const debtPayments = await getDirtyRecords('debtPayments');
    const stockOpnames = await getDirtyRecords('stockOpnames');

    // 2. Ambil detail records yang berelasi dengan data induk yang kotor
    const dirtyTxIds = transactions.map(t => t.id).filter(id => id !== undefined) as number[];
    const transactionItems = dirtyTxIds.length > 0
      ? await db.transactionItems.where('transactionId').anyOf(dirtyTxIds).toArray()
      : [];

    const dirtyOpnameIds = stockOpnames.map(o => o.id).filter(id => id !== undefined) as number[];
    const stockOpnameItems = dirtyOpnameIds.length > 0
      ? await db.stockOpnameItems.where('opnameId').anyOf(dirtyOpnameIds).toArray()
      : [];

    const totalDirtyCount =
      categories.length + products.length + customers.length + users.length +
      transactions.length + transactionItems.length + expenseCategories.length +
      expenses.length + debts.length + debtPayments.length + stockOpnames.length + stockOpnameItems.length;

    if (totalDirtyCount === 0) {
      return { success: true, message: 'Semua data lokal sudah sinkron.' };
    }

    console.log(`[Sync] Mengirimkan ${totalDirtyCount} data kotor ke server...`);

    // 3. Bangun payload push
    const payload: SyncPayload = {
      categories,
      products,
      customers,
      users,
      transactions,
      transactionItems,
      expenseCategories,
      expenses,
      debts,
      debtPayments,
      stockOpnames,
      stockOpnameItems
    };

    // 4. Kirim ke API cloud sync
    const response = await syncStoreData(storeId, payload);

    // 5. Perbarui status syncedAt di lokal ke waktu sekarang
    const syncTime = new Date();
    await db.transaction('rw', [
      'categories', 'products', 'customers', 'users', 'transactions',
      'expenseCategories', 'expenses', 'debts', 'debtPayments', 'stockOpnames'
    ], async () => {
      const updateSyncTime = async (tableName: string, records: any[]) => {
        const table = db.table(tableName);
        for (const record of records) {
          if (record.id !== undefined) {
            await table.update(record.id, { syncedAt: syncTime });
          }
        }
      };

      await updateSyncTime('categories', categories);
      await updateSyncTime('products', products);
      await updateSyncTime('customers', customers);
      await updateSyncTime('users', users);
      await updateSyncTime('transactions', transactions);
      await updateSyncTime('expenseCategories', expenseCategories);
      await updateSyncTime('expenses', expenses);
      await updateSyncTime('debts', debts);
      await updateSyncTime('debtPayments', debtPayments);
      await updateSyncTime('stockOpnames', stockOpnames);
    });

    return { success: true, message: response.message || 'Sinkronisasi berhasil.' };
  } catch (err) {
    console.error('[Sync] Gagal push data:', err);
    throw err;
  }
}
