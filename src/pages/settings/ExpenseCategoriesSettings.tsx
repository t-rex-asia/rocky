import { db } from '@/lib/db';
import { supabase, mapExpenseCategoryRow, expenseCategoryToRow, type SupabaseExpenseCategory } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Wallet, Plus, Trash2, Edit2, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';
import { useTranslation } from 'react-i18next';

const expenseEmojiOptions = ['💡', '🏠', '👤', '🚚', '🧰', '📦', '💧', '📞', '🌐', '☕', '🧾', '💼'];

export default function ExpenseCategoriesSettings() {
  const { t } = useTranslation('settings');
  const { can } = useAuth();
  const [expenseCategories, setExpenseCategories] = useState<SupabaseExpenseCategory[] | undefined>(undefined);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('is_deleted', 0)
        .order('name');
      if (active && !error && data) setExpenseCategories(data.map(mapExpenseCategoryRow));
      if (error) console.error('Gagal memuat kategori pengeluaran:', error);
    };
    load();

    const channel = supabase
      .channel('expense-categories-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_categories' }, load)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const [expCatDialog, setExpCatDialog] = useState(false);
  const [expCatName, setExpCatName] = useState('');
  const [expCatIcon, setExpCatIcon] = useState('📦');
  const [expCatColor, setExpCatColor] = useState('#FBBF24');
  const [expCatEditId, setExpCatEditId] = useState<number | null>(null);

  if (!can('manage_categories_payments')) {
    return (
      <LockedPage
        title={t('expenseCategory.locked.title')}
        permissionLabel={t('expenseCategory.locked.permissionLabel')}
      />
    );
  }

  const openExpCatAdd = () => { setExpCatEditId(null); setExpCatName(''); setExpCatIcon('📦'); setExpCatColor('#FBBF24'); setExpCatDialog(true); };
  const openExpCatEdit = (c: SupabaseExpenseCategory) => { setExpCatEditId(c.id); setExpCatName(c.name); setExpCatIcon(c.icon); setExpCatColor(c.color); setExpCatDialog(true); };
  const saveExpCat = async () => {
    const name = expCatName.trim();
    if (!name) return;
    const { error } = expCatEditId
      ? await supabase.from('expense_categories').update(expenseCategoryToRow({ name, icon: expCatIcon, color: expCatColor })).eq('id', expCatEditId)
      : await supabase.from('expense_categories').insert(expenseCategoryToRow({ name, icon: expCatIcon, color: expCatColor, isDefault: 0, isDeleted: 0, deletedAt: null }));
    if (error) {
      toast.error(t('expenseCategory.toast.saveFailed', { defaultValue: 'Gagal menyimpan kategori pengeluaran' }));
      return;
    }
    setExpCatDialog(false);
    toast.success(t('expenseCategory.toast.saved'));
  };
  const deleteExpCat = async (cat: SupabaseExpenseCategory) => {
    if (!cat.id) return;
    // expenses masih di Dexie lokal (belum dimigrasikan) — cek pemakaian lokal saja.
    const usage = await db.expenses.where('categoryId').equals(cat.id).filter(e => e.isDeleted === 0).count();
    if (usage > 0) {
      toast.error(t('expenseCategory.toast.inUse', { count: usage }));
      return;
    }
    const { error } = await supabase
      .from('expense_categories')
      .update(expenseCategoryToRow({ isDeleted: 1, deletedAt: new Date().toISOString() }))
      .eq('id', cat.id);
    if (error) {
      toast.error(t('expenseCategory.toast.deleteFailed', { defaultValue: 'Gagal menghapus kategori pengeluaran' }));
      return;
    }
    toast.success(t('expenseCategory.toast.deleted'));
  };

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/settings">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronLeft className="w-4 h-4" /></Button>
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-warning" />
            {t('expenseCategory.title')}
          </h1>
        </div>
        <Button size="sm" onClick={openExpCatAdd} className="h-9 gap-1.5"><Plus className="w-4 h-4" /> {t('expenseCategory.addButton')}</Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-3 space-y-1">
          {expenseCategories && expenseCategories.length === 0 && (
            <p className="text-xs text-muted-foreground py-1.5">{t('expenseCategory.empty')}</p>
          )}
          {expenseCategories?.map(c => (
            <div key={c.id} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded flex items-center justify-center text-sm" style={{ backgroundColor: c.color + '20' }}>{c.icon}</span>
                <span className="text-sm font-medium">{c.name}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openExpCatEdit(c)}><Edit2 className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteExpCat(c)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={expCatDialog} onOpenChange={setExpCatDialog}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>{expCatEditId ? t('expenseCategory.dialog.editTitle') : t('expenseCategory.dialog.addTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>{t('expenseCategory.dialog.nameLabel')}</Label>
              <Input
                value={expCatName}
                onChange={e => setExpCatName(e.target.value)}
                placeholder={t('expenseCategory.dialog.namePlaceholder')}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('expenseCategory.dialog.iconLabel')}</Label>
              <div className="flex flex-wrap gap-2">
                {expenseEmojiOptions.map(e => (
                  <button
                    key={e}
                    onClick={() => setExpCatIcon(e)}
                    className={`w-10 h-10 rounded-lg text-lg flex items-center justify-center border-2 transition-colors ${expCatIcon === e ? 'border-primary bg-primary/5' : 'border-muted'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('expenseCategory.dialog.colorLabel')}</Label>
              <Input type="color" value={expCatColor} onChange={e => setExpCatColor(e.target.value)} className="h-11 w-20" />
            </div>
            <Button className="w-full h-11" onClick={saveExpCat} disabled={!expCatName.trim()}>{t('expenseCategory.dialog.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
