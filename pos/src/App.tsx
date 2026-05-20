import { useState, useEffect, useCallback } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import './index.css';
import KDS from './KDS';
import InventoryDashboard from './components/InventoryDashboard';
import { submitKOTForOrder } from './utils/kot';

function App() {
  const [categories, setCategories] = useState<string[]>(['All Items']);
  const [products, setProducts] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState('All Items');
  const [priceProfile, setpriceProfile] = useState('Ala Carte');
  const [cart, setCart] = useState<{ product: any, qty: number, instructions?: string }[]>([]);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [cashReceived, setCashReceived] = useState('');
  const [orderRemarks, setOrderRemarks] = useState('');
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('walk-in');
  const [selectedWaiter, setSelectedWaiter] = useState('Ahmed Ali');
  const [selectedTable, setSelectedTable] = useState('T-01');
  const [selectedOrderType, setSelectedOrderType] = useState('Dine-In');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('Cash');
  const [selectedSaleCounterId, setSelectedSaleCounterId] = useState<string>('');

  // Favorites & Instructions State
  const [favorites, setFavorites] = useState<string[]>([]);
  const [instructionTarget, setInstructionTarget] = useState<string | null>(null);
  const [instructionText, setInstructionText] = useState('');

  // Resizable Cart Features
  const [cartWidth, setCartWidth] = useState(400);
  const [isCartLocked, setIsCartLocked] = useState(false);

  // Item Card Display Styles
  const [cardStyle, setCardStyle] = useState<'small' | 'medium' | 'large' | 'list'>('medium');
  const [showPictures, setShowPictures] = useState(true);

  const [modalTitle, setModalTitle] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'POS' | 'KDS' | 'Inventory'>('POS');
  const [kitchenOrders, setKitchenOrders] = useState<any[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [runtimeContext, setRuntimeContext] = useState<any>(null);
  const [currentBusinessDay, setCurrentBusinessDay] = useState<any | null>(null);
  const [currentCounterSession, setCurrentCounterSession] = useState<any | null>(null);
  const [currentShift, setCurrentShift] = useState<any | null>(null);
  const [syncSummary, setSyncSummary] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [orderStats, setOrderStats] = useState({
    today: 0,
    open: 0,
    paid: 0,
    cancelled: 0,
    returned: 0,
    occupiedTables: 0,
  });

  // Session Info
  const [counterName, setCounterName] = useState('Main Counter - 01');
  const [sessionStartTime] = useState(new Date());
  const [sessionDuration, setSessionDuration] = useState('00:00:00');
  const saleCounters = runtimeContext?.sale_counters || [];
  const customers = runtimeContext?.customers || [];
  const paymentMethods = runtimeContext?.payment_methods || [];
  const selectedCustomer = selectedCustomerId === 'walk-in'
    ? null
    : customers.find((customer: any) => String(customer.id) === String(selectedCustomerId)) || null;
  const selectedCustomerName = selectedCustomer?.name || 'Walk-in Customer';

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
      const diff = new Date().getTime() - sessionStartTime.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
      const secs = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');
      setSessionDuration(`${hours}:${mins}:${secs}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionStartTime]);

  useEffect(() => {
    if (!selectedPaymentMode && paymentMethods.length > 0) {
      setSelectedPaymentMode(paymentMethods[0].method_name);
    }
  }, [paymentMethods, selectedPaymentMode]);

  const refreshKOTs = async () => {
    if ((window as any).api && (window as any).api.getKOTs) {
      try {
        const rows = await (window as any).api.getKOTs();
        const formatted = rows.map((r: any) => ({
          ...r,
          items: JSON.parse(r.items_json),
          timestamp: r.created_at
        }));
        setKitchenOrders(formatted);
      } catch (err) {
        console.error("Failed to load KOTs:", err);
      }
    }
  };

  const refreshMenu = async () => {
    if ((window as any).api && (window as any).api.getMenu) {
      try {
        const { categories: cats, products: prods } = await (window as any).api.getMenu();
        if (cats.length > 0) setCategories(['All Items', ...cats.map((c: any) => c.name)]);
        if (prods.length > 0) setProducts(prods.map((p: any) => ({ ...p, desc: p.description, img: p.image_url })));
      } catch (err) {
        console.error("Failed to load menu from DB:", err);
      }
    }
  };

  const pullMenuFromCloud = async () => {
    console.log("Pulling menu from cloud...");
    try {
      if ((window as any).api?.pullMenuFromCloud) {
        const result = await (window as any).api.pullMenuFromCloud();
        if (!result?.ok) {
          throw new Error(result?.reason || 'Offline POS runtime context is not configured.');
        }
        refreshMenu();
        alert("Menu updated from cloud successfully!");
      }
    } catch (err) {
      console.error("Failed to pull menu from cloud:", err);
      alert("Recalibration failed. Checking cloud connection...");
    }
  };

  const checkSyncStatus = async () => {
    if ((window as any).api && (window as any).api.getPendingSyncs) {
      try {
        const rows = await (window as any).api.getPendingSyncs();
        setPendingSyncCount(rows.length);
      } catch (err) {
        console.error("Failed to check sync status:", err);
      }
    }
  };

  const refreshOfflineContext = async () => {
    try {
      if ((window as any).api?.bootstrapOfflineContext) {
        const context = await (window as any).api.bootstrapOfflineContext();
        setRuntimeContext(context);
        setCurrentBusinessDay(context?.current_business_day || null);
        setCurrentCounterSession(context?.current_counter_session || null);
        setCurrentShift(context?.current_shift || null);
        setSyncSummary(context?.sync_reconciliation || null);
        if (context?.current_counter_session?.sale_counter_name) {
          setCounterName(context.current_counter_session.sale_counter_name);
          setSelectedSaleCounterId(String(context.current_counter_session.sale_counter_id || ''));
        } else if (context?.device?.device_name || context?.device?.device_code) {
          setCounterName(context?.device?.device_name || context?.device?.device_code);
        }
        if (!context?.current_counter_session?.sale_counter_id && context?.sale_counters?.length === 1) {
          setSelectedSaleCounterId(String(context.sale_counters[0].id));
        }
      }
    } catch (error) {
      console.error('Failed to refresh offline context:', error);
    }
  };

  const refreshOrderStats = async () => {
    if ((window as any).api?.getOrders) {
      try {
        const rows = await (window as any).api.getOrders();
        const todayKey = new Date().toLocaleDateString('en-CA');
        const openOrders = rows.filter((row: any) => ['open', 'pending', 'held', 'in progress'].includes(String(row.status || '').toLowerCase()));
        const paidOrders = rows.filter((row: any) => ['paid', 'completed'].includes(String(row.status || '').toLowerCase()));
        const cancelledOrders = rows.filter((row: any) => String(row.status || '').toLowerCase() === 'cancelled');
        const returnedOrders = rows.filter((row: any) => String(row.status || '').toLowerCase() === 'returned');
        const todayOrders = rows.filter((row: any) => {
          if (!row.created_at) return false;
          return new Date(row.created_at).toLocaleDateString('en-CA') === todayKey;
        });
        const occupiedTables = new Set(
          openOrders
            .map((row: any) => row.table_name)
            .filter(Boolean),
        ).size;

        setOrderStats({
          today: todayOrders.length,
          open: openOrders.length,
          paid: paidOrders.length,
          cancelled: cancelledOrders.length,
          returned: returnedOrders.length,
          occupiedTables,
        });
      } catch (error) {
        console.error('Failed to load offline order stats:', error);
      }
    }
  };

  const runSyncNow = async () => {
    if (!(window as any).api?.syncNow) {
      return;
    }
    try {
      setIsSyncing(true);
      const result = await (window as any).api.syncNow();
      await checkSyncStatus();
      await refreshOrderStats();
      await refreshOfflineContext();
      if (result?.ok) {
        alert(`Sync completed. ${Number(result?.synced || 0)} event(s) processed.`);
      }
    } catch (error: any) {
      console.error('Manual sync failed:', error);
      alert(error?.message || 'Offline sync failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  const ensureOfflineBusinessDay = async () => {
    if (currentBusinessDay?.id) {
      return currentBusinessDay;
    }

    if (!(window as any).api?.openBusinessDay) {
      throw new Error('Offline business day bridge is unavailable.');
    }

    const businessDate = window.prompt('Enter business date for the offline day', new Date().toLocaleDateString('en-CA'));
    if (businessDate === null) {
      return null;
    }

    const opened = await (window as any).api.openBusinessDay({
      business_date: businessDate,
      title: `Business Day ${businessDate}`,
    });
    await refreshOfflineContext();
    await checkSyncStatus();
    return opened;
  };

  const handleOpenCounterSession = async () => {
    if (!selectedSaleCounterId) {
      alert('Select a sale counter first.');
      return;
    }

    const businessDay = await ensureOfflineBusinessDay();
    if (!businessDay) {
      return;
    }

    const openingFloat = window.prompt('Enter opening float for this sales counter', '0');
    if (openingFloat === null) {
      return;
    }

    try {
      if (!(window as any).api?.openCounterSession) {
        throw new Error('Offline counter session bridge is unavailable.');
      }
      await (window as any).api.openCounterSession({
        business_day_reference: businessDay.id,
        sale_counter_id: Number(selectedSaleCounterId),
        opening_float: Number(openingFloat || 0),
        assigned_float: Number(openingFloat || 0),
        cashier_name: runtimeContext?.user_context?.full_name || 'Offline Cashier',
        cashier_user_id: runtimeContext?.user_context?.id || null,
        shift_reference: currentShift?.id || null,
      });
      await refreshOfflineContext();
      await checkSyncStatus();
      alert('Offline sales counter opened and queued for sync.');
    } catch (error: any) {
      console.error('Failed to open counter session:', error);
      alert(error?.message || 'Could not open offline sales counter.');
    }
  };

  const handleCloseCounterSession = async () => {
    const actualCash = window.prompt('Enter blind cash count for this sales counter', '0');
    if (actualCash === null) {
      return;
    }

    try {
      if (!(window as any).api?.closeCounterSession) {
        throw new Error('Offline counter session bridge is unavailable.');
      }
      const closed = await (window as any).api.closeCounterSession({
        blind_count: Number(actualCash || 0),
      });
      await refreshOfflineContext();
      await checkSyncStatus();
      alert(`Offline counter closed locally. X Report Net Sales: ${Number(closed?.x_report?.net_sales || 0).toLocaleString()}`);
    } catch (error: any) {
      console.error('Failed to close counter session:', error);
      alert(error?.message || 'Could not close offline sales counter.');
    }
  };

  const handleCloseBusinessDay = async () => {
    if (currentCounterSession?.id) {
      alert('Close the active sales counter before closing the business day.');
      return;
    }
    if (!(window as any).api?.closeBusinessDay || !currentBusinessDay?.id) {
      return;
    }

    try {
      await (window as any).api.closeBusinessDay({
        notes: 'Closed from offline POS terminal',
      });
      await refreshOfflineContext();
      await checkSyncStatus();
      alert('Business day closed locally and queued for sync.');
    } catch (error: any) {
      console.error('Failed to close business day:', error);
      alert(error?.message || 'Could not close business day.');
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await refreshOfflineContext();
        if ((window as any).api?.loadDraftCart) {
          const draft = await (window as any).api.loadDraftCart();
          setCart(draft?.cart || []);
          setOrderRemarks(draft?.remarks || '');
          setOrderNumber(draft?.order_number || null);
        }
      } catch (error) {
        console.error('Failed to bootstrap offline POS context:', error);
      } finally {
        refreshKOTs();
        checkSyncStatus();
        refreshMenu();
        refreshOrderStats();
      }
    };

    bootstrap();

    const interval = setInterval(async () => {
      await checkSyncStatus();
      if ((window as any).api?.syncNow && navigator.onLine) {
        try {
          setIsSyncing(true);
          await (window as any).api.syncNow();
          await checkSyncStatus();
          await refreshOrderStats();
          await refreshOfflineContext();
        } catch (error) {
          console.error('Background sync failed:', error);
        } finally {
          setIsSyncing(false);
        }
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const startResizing = useCallback((mouseDownEvent: ReactMouseEvent) => {
    if (isCartLocked) return;
    const startWidth = cartWidth;
    const startPosition = mouseDownEvent.clientX;

    const onMouseMove = (mouseMoveEvent: MouseEvent) => {
      const delta = startPosition - mouseMoveEvent.clientX;
      const newWidth = Math.min(Math.max(startWidth + delta, 300), 800);
      setCartWidth(newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [cartWidth, isCartLocked]);

  useEffect(() => {
    if ((window as any).api?.saveDraftCart) {
      void (window as any).api.saveDraftCart({
        cart,
        remarks: orderRemarks,
        order_number: orderNumber,
      });
    }
  }, [cart, orderRemarks, orderNumber]);

  const toggleFavorite = (id: string, e: ReactMouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const saveInstruction = () => {
    if (instructionTarget) {
      setCart(prev => prev.map(item => item.product.id === instructionTarget ? { ...item, instructions: instructionText } : item));
    }
    setInstructionTarget(null);
    setInstructionText('');
  };

  const filteredProducts = (activeCategory === 'All Items'
    ? products
    : products.filter(p => p.category === activeCategory))
    .filter(p => !showOnlyFavorites || favorites.includes(p.id))
    .sort((a, b) => {
      const aFav = favorites.includes(a.id) ? 1 : 0;
      const bFav = favorites.includes(b.id) ? 1 : 0;
      return bFav - aFav;
    });

  const addToCart = (product: any, qtyAdd: number = 1, e?: ReactMouseEvent) => {
    if (e) e.stopPropagation();
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.qty + qtyAdd <= 0) {
          return prev.filter(item => item.product.id !== product.id);
        }
        return prev.map(item => item.product.id === product.id ? { ...item, qty: item.qty + qtyAdd } : item);
      }
      if (qtyAdd > 0) return [...prev, { product, qty: qtyAdd }];
      return prev;
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.product.id !== id));
  };

  const updatePrice = (id: string, newPrice: number) => {
    // Basic rights check placeholder
    setCart(prev => prev.map(item => item.product.id === id ? { ...item, product: { ...item.product, price: newPrice } } : item));
  };
  const totalAmount = cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0);
  const serviceCharge = totalAmount * 0.10;
  const discount = (totalAmount + serviceCharge) * 0.05;
  const taxableAmount = (totalAmount + serviceCharge - discount);
  const taxAmount = taxableAmount * 0.10;
  const netPayable = Math.round(taxableAmount + taxAmount);

  const formatNum = (num: number) => Math.round(num).toLocaleString();

  const cashNum = parseFloat(cashReceived) || 0;
  const changeReturn = cashNum > netPayable ? (cashNum - netPayable) : 0;

  const toBackendOrderType = (value: string) => {
    const normalized = value.toLowerCase();
    if (normalized.includes('take')) return 'takeout';
    if (normalized.includes('deliver')) return 'delivery';
    return 'dine_in';
  };

  const toBackendPaymentMode = (value: string) => {
    const normalized = value.toLowerCase();
    if (normalized.includes('card')) return 'card';
    if (normalized.includes('wallet')) return 'digital_wallet';
    if (normalized.includes('bank')) return 'bank';
    if (normalized.includes('credit')) return 'other';
    return 'cash';
  };

  const buildOfflineItems = () =>
    cart.map((item) => ({
      product_id: Number(item.product.id),
      product_name: item.product.name,
      quantity: item.qty,
      qty: item.qty,
      price: Number(item.product.price || 0),
      notes: item.instructions || '',
      instructions: item.instructions || '',
      name: item.product.name,
    }));

  const buildOfflineOrderSnapshot = (currentOrderNo: string, status: 'held' | 'pending' | 'completed') => ({
    id: currentOrderNo,
    order_number: currentOrderNo,
    branch_id: runtimeContext?.branch_id || null,
    device_uid: runtimeContext?.device?.device_uid || runtimeContext?.device?.device_code || null,
    shift_reference: currentCounterSession?.shift_reference || currentShift?.id || null,
    business_day_reference: currentBusinessDay?.id || null,
    counter_session_reference: currentCounterSession?.id || null,
    sale_counter_id: currentCounterSession?.sale_counter_id || Number(selectedSaleCounterId || 0) || null,
    customer: selectedCustomerName,
    waiter: selectedWaiter,
    table_name: selectedTable,
    order_type: selectedOrderType,
    payment_method: selectedPaymentMode,
    order_note: orderRemarks || null,
    sub_total: totalAmount,
    tax_amount: taxAmount,
    discount_amount: discount,
    total_amount: netPayable,
    items_json: JSON.stringify(buildOfflineItems()),
    payments_json: JSON.stringify(status === 'completed' && !selectedPaymentMode.toLowerCase().includes('credit')
      ? [{
        payment_mode: toBackendPaymentMode(selectedPaymentMode),
        amount: netPayable,
      }]
      : []),
    status: status === 'completed' ? 'Paid' : status === 'held' ? 'Held' : 'Open',
    sync_status: 'pending',
    created_at: new Date().toISOString(),
  });

  const buildOrderSyncPayload = (currentOrderNo: string, status: 'held' | 'pending' | 'completed') => ({
    order_number: currentOrderNo,
    order_type: toBackendOrderType(selectedOrderType),
    order_status: status,
    shift_reference: currentCounterSession?.shift_reference || currentShift?.id || undefined,
    business_day_reference: currentBusinessDay?.id || undefined,
    counter_session_reference: currentCounterSession?.id || undefined,
    sale_counter_id: currentCounterSession?.sale_counter_id || Number(selectedSaleCounterId || 0) || undefined,
    table_number: selectedTable,
    order_remarks: orderRemarks || undefined,
    created_at: new Date().toISOString(),
    sub_total: totalAmount,
    tax_amount: taxAmount,
    discount_amount: discount,
    total_amount: netPayable,
    payment_mode: toBackendPaymentMode(selectedPaymentMode),
    customer_id: selectedCustomer?.id ? Number(selectedCustomer.id) : undefined,
    is_credit_sale: selectedPaymentMode.toLowerCase().includes('credit'),
    payments: status === 'completed' && !selectedPaymentMode.toLowerCase().includes('credit')
      ? [{
        payment_mode: toBackendPaymentMode(selectedPaymentMode),
        amount: netPayable,
      }]
      : undefined,
    close_on_sync: status === 'completed',
    items: buildOfflineItems().map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      price: item.price,
      notes: item.notes || undefined,
    })),
  });

  const buildPrintPayload = (currentOrderNo: string) => ({
    branch_name: runtimeContext?.branch_name || 'KitchenOS POS',
    counter_name: counterName,
    printed_at: new Date().toLocaleString(),
    order_number: currentOrderNo,
    customer: selectedCustomerName,
    waiter: selectedWaiter,
    table_name: selectedTable,
    order_type: selectedOrderType,
    payment_mode: selectedPaymentMode,
    remarks: orderRemarks || '',
    items: buildOfflineItems().map((item) => ({
      name: item.product_name,
      qty: item.quantity,
      instructions: item.notes,
      total: formatNum(item.price * item.quantity),
    })),
    totals: {
      sub_total: formatNum(totalAmount),
      tax_amount: formatNum(taxAmount),
      discount_amount: formatNum(discount),
      net_payable: formatNum(netPayable),
      cash_received: formatNum(cashNum),
      change_return: formatNum(changeReturn),
    },
  });

  const ensureOrderNumber = async () => {
    if (orderNumber) {
      return orderNumber;
    }

    if ((window as any).api?.reserveOrderNumber) {
      const reserved = await (window as any).api.reserveOrderNumber();
      setOrderNumber(reserved);
      return reserved;
    }

    const fallback = `POS-${Date.now()}`;
    setOrderNumber(fallback);
    return fallback;
  };

  const resetActiveOrder = async () => {
    setCart([]);
    setCashReceived('');
    setOrderRemarks('');
    setOrderNumber(null);
    if ((window as any).api?.clearDraftCart) {
      await (window as any).api.clearDraftCart();
    }
  };

  const handleAction = async (actionType: 'Print Bill' | 'Send to Kitchen' | 'Pay') => {
    if (cart.length === 0) return;
    if (!currentBusinessDay?.id) {
      alert('Open the business day before capturing offline POS transactions.');
      return;
    }
    if (!currentCounterSession?.id) {
      alert('Open the sales counter before capturing offline POS transactions.');
      return;
    }
    if (selectedPaymentMode.toLowerCase().includes('credit') && !selectedCustomer?.allow_credit) {
      alert('Credit sale requires a customer approved for credit in the offline cache.');
      return;
    }

    const currentOrderNo = await ensureOrderNumber();
    console.log(`Action: ${actionType}, Order: ${currentOrderNo}`);

    try {
      const orderStatus = actionType === 'Pay' ? 'completed' : actionType === 'Send to Kitchen' ? 'pending' : 'held';
      const offlineOrder = buildOfflineOrderSnapshot(currentOrderNo, orderStatus);
      const orderSyncPayload = buildOrderSyncPayload(currentOrderNo, orderStatus);

      if ((window as any).api?.saveOfflineOrder) {
        await (window as any).api.saveOfflineOrder(offlineOrder);
      }

      if ((window as any).api?.addToSyncQueue) {
        await (window as any).api.addToSyncQueue('ORDER', orderSyncPayload, {
          event_id: `ORDER-${currentOrderNo}`,
          entity_id: currentOrderNo,
        });
      }

      const kotItems = buildOfflineItems().map((item) => ({
        product_id: item.product_id,
        name: item.product_name,
        qty: item.quantity,
        instructions: item.notes,
      }));

      if (actionType === 'Send to Kitchen' || actionType === 'Pay') {
        const kotSubmission = submitKOTForOrder(currentOrderNo, kotItems);

        if (kotSubmission.createdNewVersion) {
          const newKOT = {
            id: crypto.randomUUID(),
            branch_id: runtimeContext?.branch_id || null,
            device_uid: runtimeContext?.device?.device_uid || runtimeContext?.device?.device_code || null,
            kot_number: kotSubmission.kotNumber,
            order_id: currentOrderNo,
            order_number: currentOrderNo,
            items_json: JSON.stringify(kotItems),
            status: 'Pending',
            sync_status: 'pending',
            type: selectedOrderType,
          };

          if ((window as any).api?.saveKOT) {
            await (window as any).api.saveKOT(newKOT);
          }
          if ((window as any).api?.addToSyncQueue) {
            await (window as any).api.addToSyncQueue('KOT', {
              order_number: currentOrderNo,
              kot_number: kotSubmission.kotNumber,
              status: 'Pending',
            }, {
              event_id: `KOT-${kotSubmission.kotNumber}`,
              entity_id: kotSubmission.kotNumber,
            });
          }
          await refreshKOTs();
        }

        if (actionType === 'Send to Kitchen') {
          await checkSyncStatus();
          await refreshOrderStats();
          await refreshOfflineContext();
          alert(
            kotSubmission.createdNewVersion
              ? `Sent to Kitchen! KOT #${kotSubmission.kotNumber} generated and saved.`
              : `Sent to Kitchen! No new KOT version was created. Latest KOT is #${kotSubmission.kotNumber}.`,
          );
        }
      }

      if (actionType === 'Pay') {
        if ((window as any).api?.processOrderDepletion) {
          await (window as any).api.processOrderDepletion(currentOrderNo, offlineOrder.items_json);
        }
        await checkSyncStatus();
        await refreshOrderStats();
        await refreshOfflineContext();
        await resetActiveOrder();
      }

      if (actionType === 'Print Bill') {
        if (!(window as any).api?.printBill) {
          throw new Error('Local print bridge is unavailable.');
        }
        await (window as any).api.printBill(buildPrintPayload(currentOrderNo));
        await checkSyncStatus();
        await refreshOrderStats();
        await refreshOfflineContext();
        alert(`Bill sent to printer for order ${currentOrderNo}.`);
      }
    } catch (err) {
      console.error(`${actionType} action failed`, err);
      if (actionType === 'Print Bill') {
        alert(`Print failed for order ${currentOrderNo}. The order is still saved locally and any queued sync state remains preserved.`);
      } else {
        alert(`${actionType} failed. The local offline queue was not fully updated.`);
      }
    }
  };

  const clearCart = () => {
    if (orderNumber) return; // Cannot clear if an order is placed
    setCart([]);
    setOrderRemarks('');
    if ((window as any).api?.clearDraftCart) {
      void (window as any).api.clearDraftCart();
    }
    void refreshOrderStats();
  };

  const [modalOrders, setModalOrders] = useState<any[]>([]);

  const openModal = async (status: string) => {
    let title = `${status} Orders`;
    if (status === 'Open') title = 'In Progress Orders';
    setModalTitle(title);
    if ((window as any).api && (window as any).api.getOrders) {
      try {
        const rows = await (window as any).api.getOrders(status === 'Open' ? 'Open' : status);
        const ordersWithKots = await Promise.all(rows.map(async (o: any) => {
          let kotNumbers = '';
          if ((window as any).api.getKOTs) {
            const kots = await (window as any).api.getKOTs();
            kotNumbers = kots
              .filter((k: any) => k.order_number === o.order_number || k.order_id === o.id || k.order_id === o.order_number)
              .map((k: any) => k.kot_number)
              .join(', ');
          }
          const itemsArr = JSON.parse(o.items_json || '[]');
          return {
            id: o.id,
            order_number: o.order_number,
            date: new Date(o.created_at).toLocaleDateString(),
            time: new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            customer: o.customer,
            waiter: o.waiter,
            table_name: o.table_name,
            items: itemsArr,
            kot_numbers: kotNumbers,
            amt: o.total_amount,
            status: o.status === 'Open' ? 'In Progress' : o.status
          };
        }));
        setModalOrders(ordersWithKots);
      } catch (err) {
        console.error("Failed to fetch orders for modal:", err);
      }
    }
  };

  const closeModal = () => setModalTitle(null);

  const syncHealthLabel =
    syncSummary?.sync_health === 'healthy'
      ? 'Healthy'
      : syncSummary?.sync_health === 'syncing'
        ? 'Syncing'
        : 'Attention';
  const syncHealthColor =
    syncSummary?.sync_health === 'healthy'
      ? '#15803d'
      : syncSummary?.sync_health === 'syncing'
        ? '#c2410c'
        : '#b91c1c';

  return (
    <div className="layout">
      {/* 1. Navbar */}
      <nav className="navbar">
        <div className="nav-left">
          <div className="brand" onClick={() => setCurrentView('POS')} style={{ cursor: 'pointer' }}><span>🍳</span> KitchenOS</div>
          <div className="nav-breadcrumb">{runtimeContext?.branch_name || `Branch ${runtimeContext?.branch_id || ''}`.trim()} / POS</div>
          <div style={{ marginLeft: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              padding: '4px 8px',
              borderRadius: '6px',
              background: Number(syncSummary?.summary?.conflict || 0) > 0
                ? '#fef2f2'
                : Number(syncSummary?.summary?.failed || 0) > 0 || pendingSyncCount > 0
                  ? '#fff7ed'
                  : '#f0fdf4',
              color: Number(syncSummary?.summary?.conflict || 0) > 0
                ? '#b91c1c'
                : Number(syncSummary?.summary?.failed || 0) > 0 || pendingSyncCount > 0
                  ? '#c2410c'
                  : '#15803d',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              border: Number(syncSummary?.summary?.conflict || 0) > 0
                ? '1px solid #fecaca'
                : Number(syncSummary?.summary?.failed || 0) > 0 || pendingSyncCount > 0
                  ? '1px solid #fed7aa'
                  : '1px solid #bbf7d0'
            }}>
              {Number(syncSummary?.summary?.conflict || 0) > 0
                ? `${Number(syncSummary?.summary?.conflict || 0)} conflict`
                : Number(syncSummary?.summary?.failed || 0) > 0
                  ? `${Number(syncSummary?.summary?.failed || 0)} failed`
                  : pendingSyncCount > 0
                    ? `${pendingSyncCount} syncing`
                    : 'Cloud Synced'}
            </span>
          </div>
          <button
            onClick={() => void runSyncNow()}
            disabled={isSyncing}
            style={{
              marginLeft: '12px',
              padding: '6px 10px',
              borderRadius: '6px',
              background: isSyncing ? 'rgba(255,255,255,0.05)' : 'rgba(16,185,129,0.18)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              fontSize: '11px',
              fontWeight: '600',
              cursor: isSyncing ? 'wait' : 'pointer',
            }}
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
          <button
            onClick={() => void ensureOfflineBusinessDay()}
            style={{
              marginLeft: '8px',
              padding: '6px 10px',
              borderRadius: '6px',
              background: currentBusinessDay ? 'rgba(16,185,129,0.18)' : 'rgba(59,130,246,0.18)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            {currentBusinessDay ? `Day ${currentBusinessDay.business_date}` : 'Open Day'}
          </button>
          {currentBusinessDay && !currentCounterSession && (
            <button
              onClick={() => void handleCloseBusinessDay()}
              style={{
                marginLeft: '8px',
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'rgba(239,68,68,0.18)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'white',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Close Day
            </button>
          )}
          <button
            onClick={() => void (currentCounterSession ? handleCloseCounterSession() : handleOpenCounterSession())}
            style={{
              marginLeft: '8px',
              padding: '6px 10px',
              borderRadius: '6px',
              background: currentCounterSession ? 'rgba(239,68,68,0.18)' : 'rgba(59,130,246,0.18)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            {currentCounterSession ? 'Close Counter' : 'Open Counter'}
          </button>
          <button
            onClick={pullMenuFromCloud}
            style={{
              marginLeft: '12px',
              padding: '6px 10px',
              borderRadius: '6px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🔄 Recalibrate Menu
          </button>
          <button
            className="btn-pill btn-purple"
            style={{ marginLeft: '20px', padding: '8px 16px', fontSize: '13px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.3)', color: 'white', cursor: 'pointer' }}
            onClick={() => setCurrentView('KDS')}
          >
            🍳 KITCHEN DISPLAY
          </button>
          <button
            className="btn-pill"
            style={{ marginLeft: '10px', padding: '8px 16px', fontSize: '13px', borderRadius: '20px', background: 'white', color: 'var(--nav-bg)', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
            onClick={() => setCurrentView('Inventory')}
          >
            📦 INVENTORY
          </button>
        </div>
        <div className="nav-right">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: '15px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{counterName}</div>
            <div style={{ fontSize: '10px', opacity: 0.8 }}>Session: {sessionDuration}</div>
          </div>
          <div className="nav-time">
            <div>{currentDateTime.toLocaleDateString()}</div>
            <div style={{ fontWeight: 600 }}>{currentDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <button style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '18px', cursor: 'pointer' }}>🔔</button>
          <button style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '18px', cursor: 'pointer' }}>⚙</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#eee', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
              <img src="https://ui-avatars.com/api/?name=Admin&background=4f46e5&color=fff" style={{ width: '100%', height: '100%' }} />
            </div>
            <div>Admin 👤 <span>▼</span></div>
          </div>
        </div>
      </nav>

      {currentView === 'POS' && (
        <>

          {/* 2. Sub-Nav (Order Types) */}
          <div className="sub-nav">
            <div className="order-types">
              <button className="btn-pill btn-blue" onClick={() => openModal('Open')}>📡 In Progress</button>
              <button className="btn-pill btn-purple" onClick={() => openModal('Take-away')}>🛍️ Take-away <span className="badge">6</span></button>
              <button className="btn-pill btn-blue" onClick={() => openModal('Delivery')}>🛵 Delivery <span className="badge">6</span></button>
              <button className="btn-pill btn-purple" onClick={() => openModal('Today')}>📅 Today Order</button>
            </div>
            <div className="order-types">
              <button className="btn-pill btn-grey" onClick={() => openModal('Recent Orders')}>🕒 Recent Orders</button>
              <button className="btn-pill btn-green" onClick={() => openModal('New Orders')}>⊕ New Order</button>
              <button className="btn-pill btn-red" onClick={() => openModal('Sales Returns')}>⟲ Sales Return</button>
              <button className="btn-pill btn-outline" onClick={() => openModal('Expenses')}>+ Add Expense</button>
              <input type="text" placeholder="🔍 Search Order No." style={{ padding: '4px 10px', borderRadius: '16px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '11px', width: '130px' }} />
              <select
                className="card-style-select"
                value={cardStyle + (showPictures ? '' : '_nopix')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.includes('_nopix')) {
                    setCardStyle(val.replace('_nopix', '') as any);
                    setShowPictures(false);
                  } else {
                    setCardStyle(val as any);
                    setShowPictures(true);
                  }
                }}
              >
                <option value="list">☰ List Style</option>
                <option value="small">▣ Small Card</option>
                <option value="medium">▣ Medium Card</option>
                <option value="large">▣ Large Card</option>
                <option value="small_nopix">S (No Picture)</option>
                <option value="medium_nopix">M (No Picture)</option>
                <option value="large_nopix">L (No Picture)</option>
              </select>
            </div>
          </div>

          {/* 3. Stats Bar (Today | Open | Closed | Pending | Cancelled) */}
          <div className="stats-bar">
            <div className="stat-card" style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: '#f5f3ff' }} onClick={() => openModal("Today's Orders")}>
              <div className="stat-label">Today&apos;s Orders</div><div className="stat-value">{orderStats.today}</div>
            </div>
            <div className="stat-card status-progress" onClick={() => openModal('Open')}>
              <div className="stat-label">In Progress</div><div className="stat-value">{orderStats.open}</div>
            </div>
            <div className="stat-card status-closed" onClick={() => openModal('Paid')}>
              <div className="stat-label">Closed</div><div className="stat-value">{orderStats.paid}</div>
            </div>
            <div className="stat-card status-cancelled" onClick={() => openModal('Cancelled')}>
              <div className="stat-label">Cancelled</div><div className="stat-value">{orderStats.cancelled}</div>
            </div>
            <div className="stat-card status-returned" onClick={() => openModal('Returned')}>
              <div className="stat-label">Returned</div><div className="stat-value">{orderStats.returned}</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div
                className={`stat-item ${showOnlyFavorites ? 'active-red' : ''}`}
                onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                style={{ cursor: 'pointer', border: '1px solid #fed7aa' }}
              >
                {showOnlyFavorites ? 'Favorites Only' : 'Show Favorites'}
              </div>
              <div className="stat-item">
                Occupied Tables <span className="stat-val">{orderStats.occupiedTables}</span>
              </div>
            </div>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '12px',
            margin: '12px 16px 0',
          }}>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 16px', textAlign: 'left' }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sync Health</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: syncHealthColor, marginTop: '6px' }}>{syncHealthLabel}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                {syncSummary?.latest_synced_at
                  ? `Last sync ${new Date(syncSummary.latest_synced_at).toLocaleString()}`
                  : 'No successful sync yet'}
              </div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 16px', textAlign: 'left' }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pending Queue</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>{Number(syncSummary?.summary?.pending || 0)}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                {syncSummary?.oldest_pending_at ? `Oldest queued ${new Date(syncSummary.oldest_pending_at).toLocaleString()}` : 'No pending backlog'}
              </div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 16px', textAlign: 'left' }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Failed Retries</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: Number(syncSummary?.summary?.failed || 0) > 0 ? '#b45309' : '#0f172a', marginTop: '6px' }}>
                {Number(syncSummary?.summary?.failed || 0)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                {Number(syncSummary?.summary?.failed || 0) > 0 ? 'Automatic retry backoff is active.' : 'No retry backlog'}
              </div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 16px', textAlign: 'left' }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Conflicts</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: Number(syncSummary?.summary?.conflict || 0) > 0 ? '#b91c1c' : '#0f172a', marginTop: '6px' }}>
                {Number(syncSummary?.summary?.conflict || 0)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                {Number(syncSummary?.summary?.conflict || 0) > 0 ? 'Manager review is required before those rows clear.' : 'No active conflicts'}
              </div>
            </div>
          </div>
          {(syncSummary?.attention_items || []).length > 0 && (
            <div style={{ margin: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(syncSummary?.attention_items || []).slice(0, 3).map((item: any) => (
                <div
                  key={item.code}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                    alignItems: 'center',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    background: item.level === 'critical' ? '#fef2f2' : item.level === 'warning' ? '#fffbeb' : '#eff6ff',
                    border: item.level === 'critical' ? '1px solid #fecaca' : item.level === 'warning' ? '1px solid #fde68a' : '1px solid #bfdbfe',
                  }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{item.title}</div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>{item.detail}</div>
                  </div>
                  <div style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: item.level === 'critical' ? '#b91c1c' : item.level === 'warning' ? '#b45309' : '#1d4ed8',
                    background: '#ffffff',
                    textTransform: 'uppercase',
                  }}>
                    {item.level}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{
            margin: '12px 16px 0',
            padding: '14px 16px',
            borderRadius: '14px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '14px',
            alignItems: 'end',
          }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Business Day</div>
              <div style={{ marginTop: '6px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                {currentBusinessDay?.business_date || 'Not Opened'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sale Counter</div>
              <select
                className="form-select"
                value={selectedSaleCounterId}
                onChange={(e) => setSelectedSaleCounterId(e.target.value)}
                disabled={Boolean(currentCounterSession?.id)}
                style={{ marginTop: '6px' }}
              >
                <option value="">Select Counter</option>
                {saleCounters.map((counter: any) => (
                  <option key={counter.id} value={String(counter.id)}>{counter.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Counter Status</div>
              <div style={{ marginTop: '6px', fontSize: '14px', fontWeight: 700, color: currentCounterSession ? '#15803d' : '#b45309' }}>
                {currentCounterSession ? 'Open' : 'Closed'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Reference Data</div>
              <div style={{ marginTop: '6px', fontSize: '12px', color: '#475569' }}>
                {runtimeContext?.last_menu_sync_at ? `Last refresh ${new Date(runtimeContext.last_menu_sync_at).toLocaleString()}` : 'No local refresh yet'}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 4. Main Workspace */}
      <div className="workspace">
        {currentView === 'KDS' ? (
          <KDS
            orders={kitchenOrders}
            onUpdateStatus={async (id, status) => {
              if ((window as any).api && (window as any).api.updateKOTStatus) {
                await (window as any).api.updateKOTStatus(id, status);
                refreshKOTs();
              } else {
                setKitchenOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
              }
            }}
            onBack={() => setCurrentView('POS')}
          />
        ) : currentView === 'Inventory' ? (
          <InventoryDashboard />
        ) : (
          <>
            {/* Col 1: Sidebar */}
            <aside className="sidebar">
              <div className="search-box">
                <input type="text" className="search-input" placeholder="🔍 Search items..." />
              </div>

              <div className="cat-header" style={{ borderTop: 'none' }}>
                <span>☰</span> Price Profile
              </div>
              <div className="categories-list" style={{ flex: 'none' }}>
                {['Ala Carte', 'Weekly Menu', 'Buffet'].map(mType => (
                  <div
                    key={mType}
                    className={`cat-item ${priceProfile === mType ? 'active' : ''}`}
                    onClick={() => setpriceProfile(mType)}
                    style={{ marginBottom: '2px' }}
                  >
                    {priceProfile === mType ? '✓ ' : ''}{mType}
                  </div>
                ))}
              </div>

              <div style={{ height: '1px', background: 'var(--border-color)', margin: '8px 16px' }}></div>

              <div className="cat-header">
                <span>☷</span> Food Category
              </div>
              <div className="categories-list">
                {categories.map(cat => (
                  <div
                    key={cat}
                    className={`cat-item ${activeCategory === cat ? 'active' : ''}`}
                    onClick={() => setActiveCategory(cat)}
                  >
                    {activeCategory === cat ? '🍴 ' : ''}{cat}
                  </div>
                ))}
              </div>
            </aside>

            {/* Col 2: Product Grid */}
            <main className="product-area">
              <div className={`grid grid-${cardStyle}`}>
                {filteredProducts.map(product => {
                  const cartItem = cart.find(i => i.product.id === product.id);
                  const qty = cartItem ? cartItem.qty : 0;
                  const isFav = favorites.includes(product.id);
                  return (
                    <div
                      key={product.id}
                      className={`prod-card card-${cardStyle} ${!showPictures ? 'no-pic' : ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => addToCart(product, 1)}
                    >
                      {showPictures && (
                        <div className="prod-img-box">
                          <img
                            src={product.img}
                            className="prod-img"
                            alt={product.name}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://ui-avatars.com/api/?name=K+OS&background=2d2358&color=fff&size=128"; // Fallback to Logo Placeholder
                            }}
                          />
                          <button onClick={(e) => toggleFavorite(product.id, e)} className="fav-btn-clean">
                            {isFav ? '❤️' : '🤍'}
                          </button>
                        </div>
                      )}
                      <div className="prod-info">
                        {!showPictures && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <button onClick={(e) => toggleFavorite(product.id, e)} className="fav-btn-clean" style={{ position: 'static' }}>{isFav ? '❤️' : '🤍'}</button>
                          </div>
                        )}
                        <div className="prod-title" style={{ fontSize: !showPictures ? '14px' : 'inherit' }}>{product.name}</div>
                        <div className="prod-desc" style={{ display: cardStyle === 'small' ? 'none' : 'block' }}>{product.desc}</div>
                        <div className="prod-footer">
                          <div className="prod-price">{formatNum(product.price)}<span className="pc-label">/pc</span></div>
                          <div className="qty-controls" onClick={(e) => e.stopPropagation()}>
                            <button className="qty-btn" style={{ color: 'var(--danger)' }} onClick={(e) => addToCart(product, -1, e)}>-</button>
                            <div className="qty-val">{qty}</div>
                            <button className="qty-btn" style={{ color: 'var(--success)' }} onClick={(e) => addToCart(product, 1, e)}>+</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </main>

            <div
              className="resizer"
              onMouseDown={startResizing}
              title={isCartLocked ? "Cart size is locked" : "Drag to resize cart"}
              style={{
                cursor: isCartLocked ? 'default' : 'col-resize',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              <div
                onClick={() => setIsCartLocked(!isCartLocked)}
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '-12px',
                  background: 'white',
                  border: '1px solid var(--border-color)',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '10px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  zIndex: 30
                }}
                title={isCartLocked ? "Unlock cart width" : "Lock cart width"}
              >
                {isCartLocked ? '🔒' : '🔓'}
              </div>
            </div>

            <aside className="cart-panel" style={{ width: `${cartWidth}px` }}>
              <div className="cart-top-forms">
                <div className="input-group">
                  <label>Customer</label>
                  <select
                    className="form-select"
                    title="Select Customer"
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                  >
                    <option value="walk-in">Walk-in Customer</option>
                    {customers.map((customer: any) => (
                      <option key={customer.id} value={String(customer.id)}>
                        {customer.name}{customer.allow_credit ? ' (Credit)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label>Waiter</label>
                  <select className="form-select" title="Select Waiter" value={selectedWaiter} onChange={(e) => setSelectedWaiter(e.target.value)}>
                    <option>Ahmed Ali</option>
                    <option>Sarfraz Khan</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Table</label>
                  <select className="form-select" title="Select Table" value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)}>
                    <option>T-01</option>
                    <option>T-02</option>
                    <option>T-03</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Order Type</label>
                  <select className="form-select" title="Select Order Type" value={selectedOrderType} onChange={(e) => setSelectedOrderType(e.target.value)}>
                    <option>Dine-In</option>
                    <option>Takeaway</option>
                    <option>Delivery</option>
                  </select>
                </div>
              </div>

              <div className="cart-table-wrapper" style={{ flex: 1, minHeight: '220px' }}>
                <div className="cart-scroll">
                  <table className="cart-table">
                    <thead>
                      <tr>
                        <th style={{ fontSize: '14px', width: '45%' }}>Item</th>
                        <th className="text-right" style={{ fontSize: '14px', width: '20%' }}>Price</th>
                        <th className="text-center" style={{ fontSize: '14px', width: '15%' }}>Qty</th>
                        <th className="text-right" style={{ fontSize: '14px', width: '20%' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.length > 0 ? cart.map(item => (
                        <tr className="cart-row" key={item.product.id}>
                          <td style={{ fontWeight: 500 }}>
                            {item.product.name}
                            {item.instructions && <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>{item.instructions}</div>}
                          </td>
                          <td className="text-right">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              <button title="Add Instructions" className="cart-edit-btn" style={{ marginRight: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: item.instructions ? 'var(--primary)' : 'var(--text-muted)' }} onClick={(e) => { e.stopPropagation(); setInstructionTarget(item.product.id); setInstructionText(item.instructions || ''); }}>✎</button>
                              <input type="number"
                                style={{ width: '60px', textAlign: 'right', padding: '2px', border: '1px solid var(--border-color)', borderRadius: '2px' }}
                                value={item.product.price}
                                onChange={(e) => updatePrice(item.product.id, parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          </td>
                          <td className="text-center">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <button className="cart-qty-btn" style={{ background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 'bold', color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); addToCart(item.product, -1, e); }}>-</button>
                              <span style={{ fontWeight: 600 }}>{item.qty}</span>
                              <button className="cart-qty-btn" style={{ background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 'bold', color: 'var(--success)' }} onClick={(e) => { e.stopPropagation(); addToCart(item.product, 1, e); }}>+</button>
                            </div>
                          </td>
                          <td className="text-right" style={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                            {formatNum(item.product.price * item.qty)}
                            <button className="cart-del-btn" title="Remove Item" style={{ marginLeft: '8px' }} onClick={(e) => { e.stopPropagation(); removeFromCart(item.product.id); }}>🗑️</button>
                          </td>
                        </tr>
                      )) : (
                        [1, 2, 3, 4, 5].map(i => (
                          <tr key={i} className="cart-row placeholder-row">
                            <td colSpan={4} style={{ height: '42px', borderBottom: '1px solid #f1f5f9' }}></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="order-summary" style={{ flexShrink: 0, paddingBottom: '16px' }}>
                  <textarea className="remarks-input" placeholder="Add special instructions / Order Remarks..." rows={4} value={orderRemarks} onChange={(e) => setOrderRemarks(e.target.value)} style={{ marginTop: '16px', marginBottom: '12px' }}></textarea>

                  <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600 }}>Total Amount:</span>
                    <span style={{ fontWeight: 600 }}>{formatNum(totalAmount)}</span>
                  </div>
                  <div className="summary-row">
                    <span style={{ flex: 1, whiteSpace: 'nowrap' }}>Service Charges</span>
                    <div style={{ flex: '0 0 60px', textAlign: 'center' }}><input type="text" className="small-input" defaultValue="10" />%</div>
                    <span style={{ flex: '0 0 60px', textAlign: 'right' }}>{formatNum(serviceCharge)}</span>
                  </div>
                  <div className="summary-row">
                    <span style={{ flex: 1, whiteSpace: 'nowrap' }}>Discount</span>
                    <div style={{ flex: '0 0 60px', textAlign: 'center' }}><input type="text" className="small-input" defaultValue="5" />%</div>
                    <span style={{ flex: '0 0 60px', textAlign: 'right', color: 'var(--danger)' }}>-{formatNum(discount)}</span>
                  </div>

                  <div className="summary-row" style={{ marginTop: '4px' }}>
                    <span>Payment Mode:</span>
                    <select
                      className="form-select"
                      style={{ width: '140px', padding: '2px', fontSize: '11px', textAlign: 'right' }}
                      value={selectedPaymentMode}
                      onChange={(e) => setSelectedPaymentMode(e.target.value)}
                    >
                      {paymentMethods.length > 0 ? paymentMethods.map((method: any) => (
                        <option key={method.id} value={method.method_name}>{method.method_name}</option>
                      )) : (
                        <>
                          <option>Cash</option>
                          <option>Card</option>
                          <option>Credit Sale</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="summary-row">
                    <span style={{ flex: 1, whiteSpace: 'nowrap' }}>Tax/VAT</span>
                    <div style={{ flex: '0 0 60px', textAlign: 'center' }}><input type="text" className="small-input" defaultValue="10" />%</div>
                    <span style={{ flex: '0 0 60px', textAlign: 'right' }}>{formatNum(taxAmount)}</span>
                  </div>

                  <div className="summary-row net-payable" style={{ marginTop: '8px', padding: '10px 0', borderTop: '2px solid var(--nav-bg)' }}>
                    <span style={{ fontSize: '18px', color: 'var(--nav-bg)', fontWeight: '800' }}>NET PAYABLE</span>
                    <span style={{ fontSize: '20px', color: 'var(--primary)', fontWeight: '900' }}>{formatNum(netPayable)}</span>
                  </div>

                  <div className="summary-row" style={{ marginTop: '4px' }}>
                    <span style={{ fontWeight: 600 }}>Cash Received:</span>
                    <input type="text" className="cash-input" style={{ width: '120px', fontSize: '15px', fontWeight: 'bold' }} value={cashReceived} onChange={e => setCashReceived(e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="summary-row" style={{ marginTop: '4px' }}>
                    <span style={{ fontWeight: 600 }}>Change Return:</span>
                    <span style={{ fontWeight: 800, fontSize: '16px', color: changeReturn > 0 ? 'var(--success)' : 'inherit' }}>{formatNum(changeReturn)}</span>
                  </div>
                </div>
                <div className="action-buttons">
                  <button className="action-btn btn-kitchen" onClick={() => handleAction('Send to Kitchen')}>🍴 SENT TO KITCHEN</button>
                  <button className="action-btn btn-pay" onClick={() => handleAction('Pay')} disabled={cart.length === 0}>💳 PAY NOW</button>
                  <button className="action-btn btn-clear" style={{ opacity: orderNumber ? 0.3 : 1, cursor: orderNumber ? 'not-allowed' : 'pointer' }} onClick={clearCart}>🗑 CLEAR CART</button>
                  <button className="action-btn btn-print" onClick={() => handleAction('Print Bill')}>🖨 PRINT BILL</button>
                </div>
              </div>
            </aside>
          </>
        )}
      </div>

      {/* Instructions Modal */}
      {
        instructionTarget && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{
              background: 'white', padding: '16px', borderRadius: '8px',
              width: '300px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Item Instructions</h3>
              <textarea
                value={instructionText}
                onChange={e => setInstructionText(e.target.value)}
                placeholder="e.g. Less spicy, extra cheese..."
                style={{ width: '100%', height: '80px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', resize: 'none', outline: 'none', fontSize: '12px' }}
              />
              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button onClick={() => setInstructionTarget(null)} style={{ padding: '6px 12px', background: '#f1f5f9', borderRadius: '4px', color: '#333' }}>Cancel</button>
                <button onClick={saveInstruction} style={{ padding: '6px 12px', background: 'var(--primary)', color: 'white', borderRadius: '4px' }}>Save</button>
              </div>
            </div>
          </div>
        )
      }

      {/* Global CSS Modal Overlay for Order Lists */}
      {
        modalTitle && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{
              background: 'white', padding: '24px', borderRadius: '12px',
              width: '850px', maxWidth: '95vw', maxHeight: '85vh',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              display: 'flex', flexDirection: 'column'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '16px', marginBottom: '16px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: 'var(--nav-bg)' }}>{modalTitle}</h2>
                <button onClick={closeModal} style={{ background: '#fef2f2', border: 'none', fontSize: '24px', color: 'var(--danger)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>

              <div style={{ overflowX: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '10px', textTransform: 'uppercase', color: '#64748b' }}>Order Info</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '10px', textTransform: 'uppercase', color: '#64748b' }}>Cust. / Waiter</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '10px', textTransform: 'uppercase', color: '#64748b' }}>Table / Type</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '10px', textTransform: 'uppercase', color: '#64748b' }}>Items Details</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right', borderBottom: '2px solid #e2e8f0', fontSize: '10px', textTransform: 'uppercase', color: '#64748b' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalOrders.map(o => (
                      <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 'bold' }}>#{o.order_number || o.id}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{o.date}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{o.time}</div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: '600' }}>{o.customer}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>🤵 {o.waiter}</div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: '600' }}>🔲 {o.table_name || o.table}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Dine-In</div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontSize: '12px', color: '#334155' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ fontSize: '10px', color: '#64748b', textAlign: 'left' }}>
                                  <th>Item</th>
                                  <th>Qty</th>
                                  <th>Price</th>
                                  <th style={{ textAlign: 'right' }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Array.isArray(o.items) && o.items.map((i: any, idx: number) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                                    <td style={{ padding: '2px 0' }}>{i.name}</td>
                                    <td style={{ padding: '2px 0' }}>{i.qty}</td>
                                    <td style={{ padding: '2px 0' }}>{formatNum(i.price)}</td>
                                    <td style={{ padding: '2px 0', textAlign: 'right' }}>{formatNum(i.price * i.qty)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {o.kot_numbers && (
                            <div style={{ marginTop: '8px', fontSize: '10px', fontWeight: 'bold', color: '#0f172a', background: '#fef3c7', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                              KOT(s): {o.kot_numbers}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: '800', color: 'var(--primary)', fontSize: '15px' }}>
                          PKR {formatNum(o.amt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '20px', textAlign: 'right', borderTop: '1px solid #eee', paddingTop: '16px' }}>
                <button onClick={closeModal} style={{ padding: '10px 24px', background: 'var(--nav-bg)', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Close Modal</button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

export default App;
