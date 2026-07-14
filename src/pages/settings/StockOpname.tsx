import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  supabase,
  mapProductRow, type SupabaseProduct,
  mapStockOpnameRow, type SupabaseStockOpname,
  mapStockOpnameItemRow, type SupabaseStockOpnameItem,
} from '@/lib/supabase';
import { ClipboardCheck, ChevronLeft, Plus, Download, Upload, Search, Trash2, ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { id as localeId, enUS, ms as localeMs } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { downloadOrShareFile } from '@/lib/file-utils';

const DATE_LOCALES: Record<string, Locale> = { id: localeId, en: enUS, ms: localeMs };

interface DraftItem {
  productId: number;
  productName: string;
  sku: string;
  barcode: string;
  systemStock: number;
  realStock: number;
  unit: string;
}

export default function StockOpnamePage() {
  const { t, i18n } = useTranslation('settings');
  const { can, currentUser } = useAuth();
  const navigate = useNavigate();
  const dateLocale = DATE_LOCALES[i18n.language] ?? localeId;

  // Active Draft state
  const [activeOpname, setActiveOpname] = useState<SupabaseStockOpname | null>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [historyDetailOpen, setHistoryDetailOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<SupabaseStockOpname | null>(null);
  const [selectedHistoryItems, setSelectedHistoryItems] = useState<(SupabaseStockOpnameItem & { productName: string; sku: string; unit: string })[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data from Supabase
  const [products, setProducts] = useState<SupabaseProduct[] | undefined>(undefined);
  const [opnameHistory, setOpnameHistory] = useState<SupabaseStockOpname[] | undefined>(undefined);

  const loadProducts = useCallback(async () => {
    const { data, error } = await supabase.from('products').select('*').eq('is_deleted', 0).order('name');
    if (!error && data) setProducts(data.map(mapProductRow));
    if (error) console.error('Gagal memuat produk:', error);
  }, []);

  const loadOpnameHistory = useCallback(async () => {
    const { data, error } = await supabase.from('stock_opnames').select('*').order('date', { ascending: false });
    if (!error && data) setOpnameHistory(data.map(mapStockOpnameRow));
    if (error) console.error('Gagal memuat riwayat stock opname:', error);
  }, []);

  useEffect(() => {
    loadProducts();
    loadOpnameHistory();

    const channel = supabase
      .channel('stock-opname-page-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, loadProducts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_opnames' }, loadOpnameHistory)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadProducts, loadOpnameHistory]);

  // Fetch active draft opname on mount / when products load
  useEffect(() => {
    const loadActiveDraft = async () => {
      const { data: draftRow } = await supabase.from('stock_opnames').select('*').eq('status', 'draft').maybeSingle();
      if (draftRow) {
        const draft = mapStockOpnameRow(draftRow);
        setActiveOpname(draft);
        setNotes(draft.notes ?? '');
        const { data: itemRows } = await supabase.from('stock_opname_items').select('*').eq('opname_id', draft.id);
        const items = (itemRows ?? []).map(mapStockOpnameItemRow);
        const prodMap = new Map((products ?? []).map(p => [p.id, p]));

        const loadedDraftItems = items.map(item => {
          const p = prodMap.get(item.productId);
          return {
            productId: item.productId,
            productName: p?.name ?? 'Produk Terhapus',
            sku: p?.sku ?? '',
            barcode: p?.barcode ?? '',
            systemStock: item.systemStock,
            realStock: item.realStock,
            unit: p?.unit ?? 'pcs'
          };
        });
        setDraftItems(loadedDraftItems);
      } else {
        setActiveOpname(null);
        setDraftItems([]);
      }
    };
    if (products) loadActiveDraft();
  }, [products]);

  if (!can('manage_stock_inout')) {
    return <LockedPage title={t('stockOpname.title')} permissionLabel={t('masterData.theme.permissionLabel')} />;
  }

  // Filtered draft items for display
  const filteredDraft = draftItems.filter(item =>
    item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.barcode.includes(searchQuery)
  );

  // Start new opname session
  const handleStartOpname = async () => {
    if (!products) return;

    try {
      const activeProducts = products.filter(p => p.trackStock !== false);
      if (activeProducts.length === 0) {
        toast.error(t('stockOpname.emptyDraft'));
        return;
      }

      // Create main draft record
      const { data: opnameRow, error: opnameError } = await supabase
        .from('stock_opnames')
        .insert({ date: new Date().toISOString(), status: 'draft', notes: '', created_by: currentUser?.id ?? null })
        .select()
        .single();
      if (opnameError || !opnameRow) throw opnameError;
      const opname = mapStockOpnameRow(opnameRow);

      // Map products to opname items
      const itemsToAdd = activeProducts.map(p => ({
        opname_id: opname.id,
        product_id: p.id,
        system_stock: p.stock,
        real_stock: p.stock, // initialize physical stock to system stock
        difference: 0
      }));

      const { error: itemsError } = await supabase.from('stock_opname_items').insert(itemsToAdd);
      if (itemsError) throw itemsError;

      setActiveOpname(opname);
      setNotes('');
      setDraftItems(activeProducts.map(p => ({
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        barcode: p.barcode ?? '',
        systemStock: p.stock,
        realStock: p.stock,
        unit: p.unit
      })));

      toast.success(t('stockOpname.toast.draftStarted'));
    } catch (err) {
      console.error(err);
      toast.error('Gagal memulai sesi stock opname');
    }
  };

  // Handle manual input of real stock
  const handleRealStockChange = async (productId: number, value: string) => {
    const numericVal = value === '' ? 0 : Number(value);
    if (isNaN(numericVal) || numericVal < 0) return;

    // Update state
    setDraftItems(prev => prev.map(item => {
      if (item.productId === productId) {
        return { ...item, realStock: numericVal };
      }
      return item;
    }));

    // Persist to Supabase
    if (activeOpname?.id) {
      const item = draftItems.find(i => i.productId === productId);
      if (item) {
        await supabase
          .from('stock_opname_items')
          .update({ real_stock: numericVal, difference: numericVal - item.systemStock })
          .eq('opname_id', activeOpname.id)
          .eq('product_id', productId);
      }
    }
  };

  // Export Excel Template
  const handleExportTemplate = async () => {
    if (draftItems.length === 0) return;

    try {
      const ExcelJSModule = await import('exceljs');
      const ExcelJS = (ExcelJSModule as unknown as { default?: typeof ExcelJSModule }).default ?? ExcelJSModule;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Stock Opname');

      // Title & Instructions
      ws.mergeCells('A1:F1');
      const titleCell = ws.getCell('A1');
      titleCell.value = 'TEMPLAT STOCK OPNAME';
      titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '3B82F6' } };
      titleCell.alignment = { horizontal: 'center' };

      ws.mergeCells('A2:F2');
      const instructionCell = ws.getCell('A2');
      instructionCell.value = 'Petunjuk: HANYA ISI kolom "Stok Fisik". Jangan mengubah kolom lainnya.';
      instructionCell.font = { name: 'Arial', size: 10, italic: true };
      instructionCell.alignment = { horizontal: 'center' };

      // Headers
      const headers = ['ID Produk', 'Nama Produk', 'SKU', 'Barcode', 'Stok Sistem', 'Stok Fisik (ISI DI SINI)'];
      ws.getRow(4).values = headers;
      ws.getRow(4).font = { bold: true };
      ws.getRow(4).eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
        c.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'medium' },
          right: { style: 'thin' }
        };
      });

      // Populate data
      draftItems.forEach((item, index) => {
        const rowNum = 5 + index;
        const row = ws.getRow(rowNum);
        row.getCell(1).value = item.productId;
        row.getCell(2).value = item.productName;
        row.getCell(3).value = item.sku;
        row.getCell(4).value = item.barcode;
        row.getCell(5).value = item.systemStock;
        row.getCell(6).value = item.realStock;

        // format columns
        row.getCell(1).numFmt = '@';
        row.getCell(5).numFmt = '#,##0';
        row.getCell(6).numFmt = '#,##0';

        row.eachCell(c => {
          c.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });

      // Set column widths
      ws.getColumn(1).width = 12;
      ws.getColumn(2).width = 30;
      ws.getColumn(3).width = 15;
      ws.getColumn(4).width = 15;
      ws.getColumn(5).width = 15;
      ws.getColumn(6).width = 25;

      const buffer = await wb.xlsx.writeBuffer();
      const fileName = `Templat_Stock_Opname_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
      await downloadOrShareFile(buffer as ArrayBuffer, {
        fileName,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Simpan / Bagikan Templat',
        shareTitle: 'Templat Stock Opname',
      });
      toast.success('Templat Excel berhasil diunduh');
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengunduh templat');
    }
  };

  // Import Excel Worksheet
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const ExcelJSModule = await import('exceljs');
      const ExcelJS = (ExcelJSModule as unknown as { default?: typeof ExcelJSModule }).default ?? ExcelJSModule;
      const arrayBuffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(arrayBuffer);
      const ws = wb.worksheets[0];

      let updatedCount = 0;
      const updatedDraftItems = [...draftItems];

      // Read rows starting from row 5
      ws.eachRow((row, rowNum) => {
        if (rowNum >= 5) {
          const productId = Number(row.getCell(1).value);
          const realStockVal = row.getCell(6).value;
          const realStock = realStockVal !== null && realStockVal !== undefined ? Number(realStockVal) : null;

          if (!isNaN(productId) && realStock !== null && !isNaN(realStock) && realStock >= 0) {
            const index = updatedDraftItems.findIndex(item => item.productId === productId);
            if (index !== -1) {
              updatedDraftItems[index].realStock = realStock;
              updatedCount++;
            }
          }
        }
      });

      if (updatedCount > 0) {
        setDraftItems(updatedDraftItems);
        // Persist all imported values back to Supabase
        if (activeOpname?.id) {
          for (const item of updatedDraftItems) {
            await supabase
              .from('stock_opname_items')
              .update({ real_stock: item.realStock, difference: item.realStock - item.systemStock })
              .eq('opname_id', activeOpname.id)
              .eq('product_id', item.productId);
          }
        }
        toast.success(t('stockOpname.excel.uploadSuccess', { count: updatedCount }));
      } else {
        toast.error(t('stockOpname.excel.uploadError'));
      }
    } catch (err) {
      console.error(err);
      toast.error(t('stockOpname.excel.uploadError'));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Cancel Opname draft
  const handleCancelOpname = async () => {
    if (!activeOpname?.id) return;
    if (confirm('Batalkan sesi stock opname aktif? Semua perubahan draf akan dihapus.')) {
      try {
        await supabase.from('stock_opname_items').delete().eq('opname_id', activeOpname.id);
        await supabase.from('stock_opnames').delete().eq('id', activeOpname.id);
        setActiveOpname(null);
        setDraftItems([]);
        toast.info('Sesi stock opname dibatalkan');
      } catch (err) {
        console.error(err);
        toast.error('Gagal membatalkan sesi');
      }
    }
  };

  // Complete/Submit Opname — atomic lewat RPC finalize_stock_opname (products,
  // stock_opnames, stock_ins/stock_outs disesuaikan server-side dalam 1 transaksi).
  const handleSubmitOpname = async () => {
    if (!activeOpname?.id || draftItems.length === 0) return;
    setSubmitting(true);

    try {
      const { error } = await supabase.rpc('finalize_stock_opname', {
        p_opname_id: activeOpname.id,
        p_notes: notes.trim(),
        p_created_by: currentUser?.id ?? null,
      });
      if (error) throw error;

      toast.success(t('stockOpname.toast.saved'));
      setActiveOpname(null);
      setDraftItems([]);
      setConfirmOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(t('stockOpname.toast.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  // Open history detail
  const handleOpenHistoryDetail = async (opname: SupabaseStockOpname) => {
    try {
      setSelectedHistory(opname);
      const { data: itemRows } = await supabase.from('stock_opname_items').select('*').eq('opname_id', opname.id);
      const items = (itemRows ?? []).map(mapStockOpnameItemRow);
      const prodMap = new Map((products ?? []).map(p => [p.id, p]));

      const mapped = items.map(item => {
        const p = prodMap.get(item.productId);
        return {
          ...item,
          productName: p?.name ?? 'Produk Terhapus',
          sku: p?.sku ?? '',
          unit: p?.unit ?? 'pcs'
        };
      });

      setSelectedHistoryItems(mapped);
      setHistoryDetailOpen(true);
    } catch (err) {
      console.error(err);
      toast.error('Gagal membaca detail riwayat');
    }
  };

  return (
    <div className="px-4 pt-6 pb-20 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link to="/settings">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          {t('stockOpname.title')}
        </h1>
      </div>

      {activeOpname ? (
        // DRAFT SESSION PANEL
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm font-bold">
                  Sesi Aktif ({format(new Date(activeOpname.date), 'dd MMMM yyyy HH:mm', { locale: dateLocale })})
                </CardTitle>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Lakukan pencocokan stok fisik produk di bawah ini.
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleCancelOpname}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Import / Export actions */}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={handleExportTemplate}>
                  <Download className="w-4 h-4" />
                  Templat Excel
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4" />
                  Unggah Excel
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={handleImportExcel}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="opname-notes" className="text-xs">Catatan Sesi</Label>
                <Input
                  id="opname-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('stockOpname.toast.notesPlaceholder')}
                  className="h-9 text-xs"
                />
              </div>
            </CardContent>
          </Card>

          {/* Search bar & Draft List */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau SKU produk..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10"
              />
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {filteredDraft.map(item => {
                const diff = item.realStock - item.systemStock;
                return (
                  <Card key={item.productId} className="border border-border/70 shadow-none">
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">{item.productName}</p>
                        <p className="text-[10px] text-muted-foreground">SKU: {item.sku || '-'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            {t('stockOpname.systemStockText')}: {item.systemStock} {item.unit}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            diff > 0 ? 'bg-success/10 text-success' :
                            diff < 0 ? 'bg-destructive/10 text-destructive' : 'bg-zinc-100 text-zinc-500'
                          }`}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        </div>
                      </div>

                      <div className="w-24 shrink-0 flex flex-col gap-1 items-end">
                        <Label className="text-[9px] text-muted-foreground">{t('stockOpname.realStockText')}</Label>
                        <Input
                          type="number"
                          value={item.realStock}
                          onChange={(e) => handleRealStockChange(item.productId, e.target.value)}
                          className="h-8 text-center text-xs px-1 font-bold"
                          min={0}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {filteredDraft.length === 0 && (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  {t('stockOpname.emptyDraft')}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <Button className="w-full h-11 font-bold mt-2" onClick={() => setConfirmOpen(true)}>
            <Check className="w-5 h-5 mr-1.5" />
            Selesaikan Stock Opname
          </Button>
        </div>
      ) : (
        // HISTORY & START SCREEN
        <div className="space-y-4">
          <Button className="w-full h-12 gap-2 text-sm font-bold" onClick={handleStartOpname}>
            <Plus className="w-5 h-5" />
            {t('stockOpname.initButton')}
          </Button>

          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block px-1">
              {t('stockOpname.historyTitle')}
            </h2>

            <div className="space-y-2">
              {opnameHistory?.map(opname => (
                <Card
                  key={opname.id}
                  className="border border-border/70 hover:border-primary/30 shadow-none cursor-pointer transition-colors"
                  onClick={() => handleOpenHistoryDetail(opname)}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold">
                        {format(new Date(opname.date), 'dd MMMM yyyy HH:mm', { locale: dateLocale })}
                      </p>
                      {opname.notes && <p className="text-[10px] text-muted-foreground italic truncate max-w-[280px]">{opname.notes}</p>}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      opname.status === 'completed' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
                    }`}>
                      {t(`stockOpname.status.${opname.status}`)}
                    </span>
                  </CardContent>
                </Card>
              ))}

              {opnameHistory?.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-border/60 rounded-xl text-xs text-muted-foreground">
                  <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  {t('stockOpname.noHistory')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="w-5 h-5 text-warning" />
              {t('stockOpname.dialog.submitTitle')}
            </DialogTitle>
            <DialogDescription className="text-xs pt-1.5">
              {t('stockOpname.dialog.submitDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row gap-2 justify-end mt-4">
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              {t('stockOpname.dialog.submitCancel')}
            </Button>
            <Button size="sm" onClick={handleSubmitOpname} disabled={submitting}>
              {submitting ? 'Memproses...' : t('stockOpname.dialog.submitConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* HISTORY DETAIL SHEET/DIALOG */}
      <Dialog open={historyDetailOpen} onOpenChange={setHistoryDetailOpen}>
        <DialogContent className="max-w-[95vw] rounded-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              Detail Stock Opname #{selectedHistory?.id}
            </DialogTitle>
            <DialogDescription className="text-[10px] pt-1">
              Tanggal: {selectedHistory && format(new Date(selectedHistory.date), 'dd MMMM yyyy HH:mm', { locale: dateLocale })}
              {selectedHistory?.notes && <span className="block mt-1 italic">Catatan: {selectedHistory.notes}</span>}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 mt-4">
            {selectedHistoryItems.map(item => {
              const diff = item.realStock - item.systemStock;
              return (
                <div key={item.id} className="p-2 border border-border/60 rounded-lg flex items-center justify-between text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{item.productName}</p>
                    <p className="text-[9px] text-muted-foreground">SKU: {item.sku || '-'}</p>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5 ml-2">
                    <p className="font-bold">Fisik: {item.realStock} {item.unit}</p>
                    <p className="text-[9px] text-muted-foreground">Sistem: {item.systemStock}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded inline-block ${
                      diff > 0 ? 'bg-success/10 text-success' :
                      diff < 0 ? 'bg-destructive/10 text-destructive' : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {diff > 0 ? `+${diff}` : diff}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="mt-4">
            <Button className="w-full" onClick={() => setHistoryDetailOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
