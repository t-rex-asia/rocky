import { supabase, mapUnitRow, unitToRow, type SupabaseUnit } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Ruler, Plus, Trash2, Edit2, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function UnitsSettings() {
  const { t } = useTranslation('settings');
  const [units, setUnits] = useState<SupabaseUnit[] | undefined>(undefined);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('is_deleted', 0)
        .order('name');
      if (active && !error && data) setUnits(data.map(mapUnitRow));
      if (error) console.error('Gagal memuat satuan:', error);
    };
    load();

    const channel = supabase
      .channel('units-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, load)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const [unitDialog, setUnitDialog] = useState(false);
  const [unitName, setUnitName] = useState('');
  const [unitEditId, setUnitEditId] = useState<number | null>(null);
  const [unitOriginalName, setUnitOriginalName] = useState('');
  const [unitDeleteTarget, setUnitDeleteTarget] = useState<SupabaseUnit | null>(null);
  const [unitDeleteUsage, setUnitDeleteUsage] = useState(0);

  const openUnitAdd = () => {
    setUnitEditId(null);
    setUnitName('');
    setUnitOriginalName('');
    setUnitDialog(true);
  };
  const openUnitEdit = (u: SupabaseUnit) => {
    setUnitEditId(u.id);
    setUnitName(u.name);
    setUnitOriginalName(u.name);
    setUnitDialog(true);
  };
  const saveUnit = async () => {
    const name = unitName.trim();
    if (!name) return;

    // Uniqueness check (active units only — soft-deleted records still occupy the
    // unique index, but we want to surface a clearer message on conflict)
    const { data: existing } = await supabase.from('units').select('*').eq('name', name).maybeSingle();
    if (existing && existing.id !== unitEditId) {
      const existingUnit = mapUnitRow(existing);
      if (existingUnit.isDeleted === 1) {
        toast.error(t('units.toast.wasDeleted', { name }));
      } else {
        toast.error(t('units.toast.duplicate', { name }));
      }
      return;
    }

    try {
      if (unitEditId) {
        const { error } = await supabase.from('units').update(unitToRow({ name })).eq('id', unitEditId);
        if (error) throw error;
        // Cascade rename to all products using the old name so the dropdown stays consistent
        if (unitOriginalName && unitOriginalName !== name) {
          await supabase.from('products').update({ unit: name, updated_at: new Date().toISOString() }).eq('unit', unitOriginalName);
        }
      } else {
        const { error } = await supabase.from('units').insert(unitToRow({ name, isDefault: 0, isDeleted: 0, deletedAt: null }));
        if (error) throw error;
      }
      setUnitDialog(false);
      toast.success(t('units.toast.saved'));
    } catch {
      toast.error(t('units.toast.saveFailed'));
    }
  };
  const requestDeleteUnit = async (u: SupabaseUnit) => {
    const { count } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('unit', u.name)
      .eq('is_deleted', 0);
    setUnitDeleteUsage(count ?? 0);
    setUnitDeleteTarget(u);
  };
  const confirmDeleteUnit = async () => {
    if (!unitDeleteTarget?.id) return;
    await supabase.from('units').update(unitToRow({ isDeleted: 1, deletedAt: new Date().toISOString() })).eq('id', unitDeleteTarget.id);
    setUnitDeleteTarget(null);
    toast.success(t('units.toast.deleted'));
  };

  const trimmedUnitName = unitName.trim();

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/settings">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronLeft className="w-4 h-4" /></Button>
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Ruler className="w-5 h-5 text-primary" />
            {t('units.title')}
          </h1>
        </div>
        <Button size="sm" onClick={openUnitAdd} className="h-9 gap-1.5"><Plus className="w-4 h-4" /> {t('units.addButton')}</Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-3 space-y-1">
          {units && units.length === 0 && (
            <p className="text-xs text-muted-foreground py-1.5">{t('units.empty')}</p>
          )}
          {units?.map(u => (
            <div key={u.id} className="flex items-center justify-between py-1.5">
              <span className="text-sm font-medium">{u.name}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openUnitEdit(u)}><Edit2 className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => requestDeleteUnit(u)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={unitDialog} onOpenChange={setUnitDialog}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>{unitEditId ? t('units.dialog.editTitle') : t('units.dialog.addTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>{t('units.dialog.nameLabel')}</Label>
              <Input
                value={unitName}
                onChange={e => setUnitName(e.target.value)}
                placeholder={t('units.dialog.namePlaceholder')}
                className="h-11"
              />
              {unitEditId && unitOriginalName && trimmedUnitName && trimmedUnitName !== unitOriginalName && (
                <p className="text-[11px] text-muted-foreground">
                  {t('units.dialog.renameHint', { old: unitOriginalName, new: trimmedUnitName })}
                </p>
              )}
            </div>
            <Button className="w-full h-11" onClick={saveUnit} disabled={!unitName.trim()}>{t('units.dialog.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!unitDeleteTarget} onOpenChange={(o) => { if (!o) setUnitDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-[90vw] rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('units.deleteDialog.title', { name: unitDeleteTarget?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {unitDeleteUsage > 0
                ? t('units.deleteDialog.inUse', { count: unitDeleteUsage, name: unitDeleteTarget?.name ?? '' })
                : t('units.deleteDialog.safe')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('units.deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteUnit} className="bg-destructive text-destructive-foreground">{t('units.deleteDialog.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
