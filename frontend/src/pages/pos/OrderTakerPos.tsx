import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, LayoutDashboard, Minus, Plus, Receipt, RefreshCw, Search, ShoppingCart, Soup, SquarePen, X } from 'lucide-react';
import { toast } from '../../components/ui/KitchenToast/toast';
import { branchApi, catalogApi, customerApi, posApi } from '../../api/api';
import { readStoredUserContext } from '../../auth/access';
import { playPosCartAddSound, playPosCartReduceSound } from '../../utils/kdsAlertSounds';
import { formatConfiguredKotNumber, formatConfiguredOrderNumber, resolveKotDisplayNumber } from './printTemplates/printHelpers';
import styles from './OrderTakerPos.module.css';

type TabKey = 'dashboard' | 'take_order' | 'my_orders' | 'kitchen' | 'search';
type UiOrderType = 'takeaway' | 'dine_in';
type BackendOrderType = 'takeout' | 'dine_in';
type ViewMode = 'grid' | 'list';
type LiveProduct = { id: number; name: string; price: number; category: string };
type CartLine = { key: string; productId: number; name: string; price: number; qty: number; comment: string; orderItemId?: number; createdAt?: string | null; itemStatus?: string | null };
type OrderFilters = { status: string; type: string; dateScope: 'today' | 'history' | 'all'; query: string };
type KitchenFilters = { scope: 'mine' | 'all' | 'taker'; status: string; table: string; takerId: string; query: string };

const ACTIVE_ORDER_STATUSES = ['held', 'pending', 'preparing', 'ready', 'served'];
const TODAY = new Date();
const TODAY_KEY = TODAY.toISOString().slice(0, 10);
const normalizeText = (value: unknown) => String(value || '').trim().toLowerCase();
const formatMoney = (value: number) => `Rs ${Number(value || 0).toLocaleString()}`;
const formatTime = (value: unknown) => {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
const formatDate = (value: unknown) => {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
};
const getOrderDayKey = (value: unknown) => {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};
const toBackendOrderType = (value: UiOrderType): BackendOrderType => value === 'dine_in' ? 'dine_in' : 'takeout';
const toUiOrderType = (value: unknown): UiOrderType => {
  const normalized = normalizeText(value);
  if (normalized === 'dine_in') return 'dine_in';
  return 'takeaway';
};
  const formatOrderType = (value: unknown) => {
  const normalized = toUiOrderType(value);
  if (normalized === 'dine_in') return 'Dine-in';
  return 'Takeaway';
  };
  const canEditOrderStatus = (status: unknown) => ACTIVE_ORDER_STATUSES.includes(normalizeText(status));
  const isOrderPaid = (order: any) => normalizeText(order?.payment_status) === 'paid';
  const isOrderCredited = (order: any) => normalizeText(order?.payment_status) === 'credited';
  const getDashboardAmountClass = (order: any) => {
    if (isOrderPaid(order)) return styles.dashboardOrderAmountPaid;
    if (isOrderCredited(order)) return styles.dashboardOrderAmountCredited;
    return styles.dashboardOrderAmountUnpaid;
  };
  const getDashboardKitchenStatusClass = (status: unknown) => {
    const normalized = normalizeText(status);
    if (normalized === 'ready') return styles.dashboardKitchenReady;
    if (normalized === 'preparing') return styles.dashboardKitchenPreparing;
    if (normalized === 'pending') return styles.dashboardKitchenPending;
    if (normalized === 'served' || normalized === 'completed') return styles.dashboardKitchenDone;
    return styles.dashboardKitchenNeutral;
  };
const getEditLimitMinutes = (branchDetail: any) => {
  const settings = branchDetail?.operational_settings || {};
  return Number(settings.line_item_cancel_reduce_limit_minutes ?? settings.item_cancellation_window_minutes ?? settings.item_edit_lock_minutes ?? 0);
};
const isPastReduceWindow = (createdAt: unknown, branchDetail: any) => {
  const limitMinutes = getEditLimitMinutes(branchDetail);
  if (limitMinutes <= 0) return true;
  const date = new Date(String(createdAt || ''));
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() > limitMinutes * 60 * 1000;
};

export function OrderTakerPos() {
  const userContext = useMemo(() => readStoredUserContext(), []);
  const currentUserId = Number(userContext?.sub || 0);
  const currentUserName = String(userContext?.user_name || userContext?.username || 'Current User');
  const [activeTab, setActiveTab] = useState<TabKey>('take_order');
  const [branchId, setBranchId] = useState<number | null>(null);
  const [branchDetail, setBranchDetail] = useState<any>(null);
  const [menu, setMenu] = useState<LiveProduct[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [kitchenOrders, setKitchenOrders] = useState<any[]>([]);
  const [orderTakers, setOrderTakers] = useState<any[]>([]);
  const [counterSession, setCounterSession] = useState<any | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [menuSearch, setMenuSearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [selectedOrderType, setSelectedOrderType] = useState<UiOrderType>('takeaway');
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [generalNote, setGeneralNote] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(true);
  const [productView, setProductView] = useState<ViewMode>('grid');
  const [myOrdersView, setMyOrdersView] = useState<ViewMode>('list');
  const [kitchenView, setKitchenView] = useState<ViewMode>('list');
  const [searchView, setSearchView] = useState<ViewMode>('list');
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [editingSnapshot, setEditingSnapshot] = useState<any | null>(null);
  const [expandedDashboardOrderId, setExpandedDashboardOrderId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [orderFilters, setOrderFilters] = useState<OrderFilters>({ status: 'active', type: 'all', dateScope: 'today', query: '' });
  const [kitchenFilters, setKitchenFilters] = useState<KitchenFilters>({ scope: 'mine', status: 'all', table: '', takerId: '', query: '' });
  const formatVisibleOrderNumber = useCallback((order: any) => (
    formatConfiguredOrderNumber(order?.order_number || order?.id || '-', branchDetail || order, { preserveTypePrefix: true }) || `Order #${order?.id || '-'}`
  ), [branchDetail]);
  const formatVisibleKotNumber = useCallback((source: any, fallback = '-') => (
    formatConfiguredKotNumber(resolveKotDisplayNumber(source, fallback), branchDetail || source, { preserveTypePrefix: true })
    || resolveKotDisplayNumber(source, fallback)
  ), [branchDetail]);

  useEffect(() => {
    const stored = Number(localStorage.getItem('activeBranchId') || userContext?.active_branch_id || userContext?.branch_id || 0);
    if (stored > 0) {
      setBranchId(stored);
      localStorage.setItem('activeBranchId', String(stored));
    }
  }, [userContext]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) setCartOpen(false);
  }, []);

  const refreshLiveState = async (targetBranchId: number, uiOrderType: UiOrderType, options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    const menuChannel = uiOrderType === 'dine_in' ? 'dine_in' : 'takeout';
    if (!silent) setIsRefreshing(true);
    try {
      const results = await Promise.allSettled([
        catalogApi.getBranchMenuByChannel(targetBranchId, { channel: menuChannel }),
        posApi.getTables(targetBranchId),
        posApi.getOrders(targetBranchId),
        posApi.getBranchDashboard(targetBranchId),
        posApi.getKots(targetBranchId),
        customerApi.getCustomers(),
        posApi.getOrderTakers(targetBranchId),
        branchApi.getBranch(String(targetBranchId)),
        posApi.getMyCounterSession(targetBranchId),
      ]);
      const [menuResult, tablesResult, ordersResult, , kotsResult, customersResult, takersResult, branchResult, counterSessionResult] = results;
      setMenu(menuResult.status === 'fulfilled'
        ? (menuResult.value?.products || []).map((item: any) => ({ id: item.id, name: item.product_name || item.name, price: Number(item.price || 0), category: item.category || item.category_name || 'Uncategorized' })).filter((item: LiveProduct) => item.price > 0)
        : []);
      setTables(tablesResult.status === 'fulfilled' ? (tablesResult.value || []).filter((table: any) => table.status !== 'cleaning') : []);
      setOrders(ordersResult.status === 'fulfilled' ? (ordersResult.value || []) : []);
      setKitchenOrders(kotsResult.status === 'fulfilled' ? (kotsResult.value || []) : []);
      setCustomers(customersResult.status === 'fulfilled' ? (customersResult.value || []) : []);
      setOrderTakers(takersResult.status === 'fulfilled' ? (takersResult.value || []) : []);
      setBranchDetail(branchResult.status === 'fulfilled' ? branchResult.value : null);
      setCounterSession(counterSessionResult.status === 'fulfilled' ? counterSessionResult.value || null : null);
    } catch (error) {
      console.error('Failed to refresh Order Taker POS:', error);
      if (!silent) toast.error('Order Taker Load Failed', 'Could not load branch orders and kitchen state.');
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (branchId) void refreshLiveState(branchId, selectedOrderType);
  }, [branchId, selectedOrderType]);

  useEffect(() => {
    if (!branchId) return;
    const intervalId = window.setInterval(() => {
      void refreshLiveState(branchId, selectedOrderType, { silent: true });
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [branchId, selectedOrderType]);

  useEffect(() => {
    if (selectedOrderType !== 'dine_in' && selectedTableId !== null) setSelectedTableId(null);
  }, [selectedOrderType, selectedTableId]);

  const kitchenStatusByOrderId = useMemo(() => {
    const map = new Map<number, { status: string; kotNumber: string }>();
    kitchenOrders.forEach((kot: any) => {
      const orderId = Number(kot?.order_id || 0);
      if (!orderId) return;
      map.set(orderId, { status: String(kot?.status || 'pending'), kotNumber: formatVisibleKotNumber(kot, '-') });
    });
    return map;
  }, [kitchenOrders]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(menu.map((item) => item.category).filter(Boolean)))], [menu]);
  const filteredMenu = useMemo(() => {
    const token = normalizeText(menuSearch);
    return menu.filter((item) => (activeCategory === 'All' || item.category === activeCategory) && (!token || `${item.name} ${item.category}`.toLowerCase().includes(token)) && item.price > 0);
  }, [menu, activeCategory, menuSearch]);
  const currentOrderTotal = useMemo(() => cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0), [cart]);
  const myOrders = useMemo(() => orders.filter((order: any) => Number(order.order_taker_id || 0) === currentUserId), [orders, currentUserId]);
  const todayMyOrders = useMemo(() => myOrders.filter((order: any) => getOrderDayKey(order.created_at) === TODAY_KEY), [myOrders]);
  const todayPaidAmount = useMemo(() => todayMyOrders.reduce((sum, order: any) => isOrderPaid(order) ? sum + Number(order.total_amount || 0) : sum, 0), [todayMyOrders]);
  const todayUnpaidAmount = useMemo(() => todayMyOrders.reduce((sum, order: any) => isOrderPaid(order) ? sum : sum + Number(order.total_amount || 0), 0), [todayMyOrders]);
  const todayReadyCount = useMemo(() => todayMyOrders.filter((order: any) => normalizeText(kitchenStatusByOrderId.get(Number(order.id))?.status || order.order_status) === 'ready').length, [todayMyOrders, kitchenStatusByOrderId]);
  const todayPreparingCount = useMemo(() => todayMyOrders.filter((order: any) => normalizeText(kitchenStatusByOrderId.get(Number(order.id))?.status || order.order_status) === 'preparing').length, [todayMyOrders, kitchenStatusByOrderId]);
  const todayPendingCount = useMemo(() => todayMyOrders.filter((order: any) => normalizeText(kitchenStatusByOrderId.get(Number(order.id))?.status || order.order_status) === 'pending').length, [todayMyOrders, kitchenStatusByOrderId]);
  const filteredMyOrders = useMemo(() => {
    const token = normalizeText(orderFilters.query);
    return myOrders.filter((order: any) => {
      const orderStatus = normalizeText(order.order_status);
      const orderType = normalizeText(order.order_type);
      const orderDayKey = getOrderDayKey(order.created_at);
      if (orderFilters.status === 'active' && !ACTIVE_ORDER_STATUSES.includes(orderStatus)) return false;
      if (orderFilters.status !== 'all' && orderFilters.status !== 'active' && orderStatus !== normalizeText(orderFilters.status)) return false;
      if (orderFilters.type !== 'all' && orderType !== normalizeText(orderFilters.type)) return false;
      if (orderFilters.dateScope === 'today' && orderDayKey !== TODAY_KEY) return false;
      if (orderFilters.dateScope === 'history' && orderDayKey === TODAY_KEY) return false;
      if (!token) return true;
      const haystack = [order.order_number, order.id, order.customer_name, order.customer_phone, order.table_number, order.order_status, order.order_note].join(' ').toLowerCase();
      return haystack.includes(token);
    });
  }, [myOrders, orderFilters]);

  const filteredKitchenOrders = useMemo(() => {
    const token = normalizeText(kitchenFilters.query);
    return kitchenOrders.filter((kot: any) => {
      const relatedOrder = orders.find((order: any) => Number(order.id) === Number(kot.order_id));
      const takerId = Number(relatedOrder?.order_taker_id || 0);
      const tableLabel = String(kot.table_number || relatedOrder?.table_number || '');
      const status = normalizeText(kot.status);
      if (kitchenFilters.scope === 'mine' && takerId !== currentUserId) return false;
      if (kitchenFilters.scope === 'taker' && kitchenFilters.takerId && takerId !== Number(kitchenFilters.takerId)) return false;
      if (kitchenFilters.status !== 'all' && status !== normalizeText(kitchenFilters.status)) return false;
      if (kitchenFilters.table && !tableLabel.toLowerCase().includes(kitchenFilters.table.toLowerCase())) return false;
      if (!token) return true;
      const haystack = [kot.order_number, kot.kot_number, tableLabel, relatedOrder?.customer_name, relatedOrder?.order_taker_name, relatedOrder?.order_taker_username, status].join(' ').toLowerCase();
      return haystack.includes(token);
    });
  }, [currentUserId, kitchenFilters, kitchenOrders, orders]);

  const searchedOrders = useMemo(() => {
    const token = normalizeText(globalSearch);
    if (token.length < 2) return [];
    return orders.filter((order: any) => [order.order_number, order.id, order.customer_name, order.customer_phone, order.table_number, order.order_status, order.order_taker_name, order.order_taker_username, order.order_note].join(' ').toLowerCase().includes(token));
  }, [orders, globalSearch]);

  const addMenuItem = (item: LiveProduct) => {
    setCart((current) => {
      const existingIndex = current.findIndex((line) => line.productId === item.id && line.price === item.price);
      if (existingIndex >= 0) return current.map((line, index) => index === existingIndex ? { ...line, qty: line.qty + 1 } : line);
      return [...current, { key: `${item.id}-${Date.now()}-${current.length}`, productId: item.id, name: item.name, price: item.price, qty: 1, comment: '' }];
    });
    void playPosCartAddSound();
  };

  const increaseQty = (key: string) => {
    setCart((current) => current.map((line) => line.key === key ? { ...line, qty: line.qty + 1 } : line));
    void playPosCartAddSound();
  };
  const decreaseQty = (key: string) => {
    setCart((current) => current.flatMap((line) => line.key !== key ? [line] : line.qty <= 1 ? [] : [{ ...line, qty: line.qty - 1 }]));
    void playPosCartReduceSound();
  };
  const removeLine = (key: string) => {
    setCart((current) => current.filter((line) => line.key !== key));
    void playPosCartReduceSound();
  };
  const updateLineComment = (key: string, comment: string) => setCart((current) => current.map((line) => line.key === key ? { ...line, comment } : line));

  const resetComposer = () => {
    setEditingOrderId(null);
    setEditingSnapshot(null);
    setSelectedOrderType('takeaway');
    setSelectedTableId(null);
    setSelectedCustomerId(null);
    setCustomerSearch('');
    setGeneralNote('');
    setCart([]);
  };

  const startEditOrder = (order: any) => {
    const activeItems = (order.items || []).filter((item: any) => normalizeText(item.item_status) !== 'voided');
    setEditingOrderId(Number(order.id));
    setEditingSnapshot(order);
    setSelectedOrderType(toUiOrderType(order.order_type));
    setSelectedTableId(order.table_id ? Number(order.table_id) : null);
    setSelectedCustomerId(order.customer_id ? Number(order.customer_id) : null);
    setCustomerSearch('');
    setGeneralNote(String(order.order_note || ''));
    setCart(activeItems.map((item: any, index: number) => ({ key: `order-item-${item.id}-${index}`, productId: Number(item.product_id), orderItemId: Number(item.id), name: item.product_name || `Product #${item.product_id}`, price: Number(item.item_price || 0), qty: Number(item.quantity || 0), comment: String(item.item_notes || ''), createdAt: item.created_at || null, itemStatus: item.item_status || 'pending' })));
    setActiveTab('take_order');
    setCartOpen(true);
  };

  const saveOrder = async () => {
    if (!branchId) return;
    if (cart.length === 0) return toast.error('Cart Empty', 'Add at least one item before sending the order.');
    if (selectedOrderType === 'dine_in' && !selectedTableId) return toast.error('Table Required', 'Dine-in orders require a table.');
    setIsSubmitting(true);
    try {
      const createPayload = {
        order_type: toBackendOrderType(selectedOrderType),
        order_status: 'pending',
        table_id: selectedOrderType === 'dine_in' ? selectedTableId || undefined : undefined,
        customer_id: selectedCustomerId || undefined,
        order_taker_user_id: currentUserId || undefined,
        sale_counter_id: Number(counterSession?.sale_counter_id || counterSession?.sale_counter?.id || 0) || undefined,
        order_note: generalNote.trim() || undefined,
      };
      const updateHeaderPayload = {
        order_type: toBackendOrderType(selectedOrderType),
        table_id: selectedOrderType === 'dine_in' ? selectedTableId || null : null,
        customer_id: selectedCustomerId || null,
        order_taker_user_id: currentUserId || undefined,
        order_note: generalNote.trim() || null,
      };
      if (editingOrderId && editingSnapshot) {
        await posApi.updateOrderHeader(editingOrderId, updateHeaderPayload);
        const originalItems = (editingSnapshot.items || []).filter((item: any) => normalizeText(item.item_status) !== 'voided');
        const originalById = new Map(originalItems.map((item: any) => [Number(item.id), item]));
        const currentExistingLines = cart.filter((line) => line.orderItemId);
        const currentExistingIds = new Set(currentExistingLines.map((line) => Number(line.orderItemId)));
        const removedItems = originalItems.filter((item: any) => !currentExistingIds.has(Number(item.id)));
        const changedLines = currentExistingLines.filter((line) => {
          const original = originalById.get(Number(line.orderItemId)) as any;
          return original && (Number(original.quantity || 0) !== Number(line.qty || 0) || String(original.item_notes || '') !== String(line.comment || ''));
        });
        const newLines = cart.filter((line) => !line.orderItemId);
        for (const line of changedLines) await posApi.updateItem(editingOrderId, Number(line.orderItemId), { quantity: line.qty, notes: line.comment || undefined });
        for (const item of removedItems) await posApi.removeItem(editingOrderId, Number(item.id), {});
        if (newLines.length > 0) await posApi.addItems(editingOrderId, newLines.map((line) => ({ product_id: line.productId, quantity: line.qty, notes: line.comment || undefined })));
        toast.success('Order Updated', `Order #${editingSnapshot.order_number || editingSnapshot.id} has been updated.`);
      } else {
        const createdOrder = await posApi.createOrder(branchId, { ...createPayload, items: cart.map((line) => ({ product_id: line.productId, quantity: line.qty, notes: line.comment || undefined })) }) as any;
        toast.success('Sent to Kitchen', `Order #${createdOrder.order_number || createdOrder.id} is live. KOT #${resolveKotDisplayNumber(createdOrder, '-')}.`);
      }
      await refreshLiveState(branchId, selectedOrderType);
      resetComposer();
      setActiveTab('my_orders');
    } catch (error: any) {
      console.error('Failed to persist order taker changes:', error);
      toast.error('Order Save Failed', error?.message || 'Could not save the order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCustomer = customers.find((customer: any) => Number(customer.id) === Number(selectedCustomerId));
  const filteredCustomers = useMemo(() => {
    const token = normalizeText(customerSearch);
    if (!token) return customers;
    return customers.filter((customer: any) =>
      [customer.name, customer.phone_number, customer.customer_code, customer.email, customer.id].join(' ').toLowerCase().includes(token),
    );
  }, [customerSearch, customers]);

  return (
    <div className={styles.container}>
      <header className={styles.topNav}>
        <div className={styles.navSections}>
          <button className={`${styles.navBtn} ${activeTab === 'dashboard' ? styles.active : ''}`} onClick={() => setActiveTab('dashboard')}><LayoutDashboard size={18} /><span className={styles.navLabel}>Dashboard</span></button>
          <button className={`${styles.navBtn} ${activeTab === 'take_order' ? styles.active : ''}`} onClick={() => setActiveTab('take_order')}><ShoppingCart size={18} /><span className={styles.navLabel}>Take Order</span></button>
          <button className={`${styles.navBtn} ${activeTab === 'my_orders' ? styles.active : ''}`} onClick={() => setActiveTab('my_orders')}><Receipt size={18} /><span className={styles.navLabel}>My Orders</span></button>
          <button className={`${styles.navBtn} ${activeTab === 'kitchen' ? styles.active : ''}`} onClick={() => setActiveTab('kitchen')}><Soup size={18} /><span className={styles.navLabel}>Orders in Kitchen</span></button>
          <button className={`${styles.navBtn} ${activeTab === 'search' ? styles.active : ''}`} onClick={() => setActiveTab('search')}><Search size={18} /><span className={styles.navLabel}>Search</span></button>
        </div>
        <div className={styles.navTopActions}>
          <button
            className={`${styles.iconBtn} ${styles.topRefreshBtn} ${isRefreshing ? styles.spinning : ''}`}
            type="button"
            aria-label="Refresh order taker data"
            title="Refresh"
            onClick={() => branchId && void refreshLiveState(branchId, selectedOrderType)}
            disabled={isRefreshing || !branchId}
          >
            <RefreshCw size={16} />
          </button>
        </div>
        <div className={styles.navRight}>
          <div className={styles.searchBar}>
            <Search size={16} />
            <input type="text" placeholder="Search order, customer, table..." className={styles.searchInput} value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} onFocus={() => setActiveTab('search')} />
          </div>
        </div>
      </header>

      <main className={styles.mainContent}>
        {activeTab === 'dashboard' && (
          <div className={styles.dashboardGrid}>
            <section className={`${styles.dashboardCard} ${styles.heroCard}`}>
              <div className={styles.heroHeader}>
                <span className={styles.eyebrow}>Logged In As</span>
                <h2>{currentUserName}</h2>
                <p>Order Taker workspace for active branch operations.</p>
              </div>
              <div className={styles.heroStats}>
                <div className={styles.heroStat}>
                  <span>Mode</span>
                  <strong>Order Taker</strong>
                </div>
                <div className={styles.heroStat}>
                  <span>Today Orders</span>
                  <strong>{todayMyOrders.length}</strong>
                </div>
                <div className={styles.heroStat}>
                  <span>Live Kitchen</span>
                  <strong>{filteredKitchenOrders.filter((kot: any) => normalizeText(kot.status) !== 'ready').length}</strong>
                </div>
              </div>
            </section>
            <section className={`${styles.dashboardCard} ${styles.summaryCard}`}>
              <div className={styles.summaryHeader}>
                <span className={styles.eyebrow}>Today Summary</span>
                <div className={styles.summaryLegend}>
                  <span className={styles.legendDotPaid}>Paid</span>
                  <span className={styles.legendDotUnpaid}>Unpaid</span>
                </div>
              </div>
                <div className={styles.summaryAmounts}>
                  <div className={`${styles.amountPanel} ${styles.amountPanelPaid}`}>
                    <span>Paid</span>
                    <strong>{formatMoney(todayPaidAmount)}</strong>
                  </div>
                  <div className={`${styles.amountPanel} ${styles.amountPanelUnpaid}`}>
                    <span>Unpaid</span>
                    <strong>{formatMoney(todayUnpaidAmount)}</strong>
                  </div>
                </div>
              <div className={styles.statusStrip}>
                <div className={styles.statusPillCard}><span>Pending</span><strong>{todayPendingCount}</strong></div>
                <div className={styles.statusPillCard}><span>Preparing</span><strong>{todayPreparingCount}</strong></div>
                <div className={styles.statusPillCard}><span>Ready</span><strong>{todayReadyCount}</strong></div>
              </div>
            </section>
            <section className={`${styles.dashboardCard} ${styles.fullWidth}`}>
              <div className={styles.sectionTitleBar}><span>Today's Orders</span><strong>{todayMyOrders.length}</strong></div>
              <div className={styles.dashboardOrderList}>
                {todayMyOrders.map((order: any) => {
                  const kitchen = kitchenStatusByOrderId.get(Number(order.id));
                  const isExpanded = expandedDashboardOrderId === Number(order.id);
                  return <article key={order.id} className={styles.dashboardOrderItem}>
                    <button className={styles.dashboardOrderSummary} type="button" onClick={() => setExpandedDashboardOrderId((current) => current === Number(order.id) ? null : Number(order.id))}>
                      <span className={styles.dashboardOrderNumber}>{formatVisibleOrderNumber(order)}</span>
                      <span className={styles.dashboardOrderMetaFront}>{order.table_number ? `Table ${order.table_number}` : formatOrderType(order.order_type)}</span>
                      <span className={`${styles.dashboardOrderAmount} ${getDashboardAmountClass(order)}`}>{formatMoney(order.total_amount || 0)}</span>
                      <span className={styles.dashboardOrderToggle}>{isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
                    </button>
                    {isExpanded && <div className={styles.dashboardOrderDetails}>
                      <div><span>Status</span><strong className={getDashboardKitchenStatusClass(kitchen?.status || order.order_status)}>{kitchen?.status || order.order_status}</strong></div>
                      <div><span>KOT</span><strong>{kitchen?.kotNumber || '-'}</strong></div>
                      <div><span>Table</span><strong>{order.table_number || '-'}</strong></div>
                      <div><span>Customer</span><strong>{order.customer_name || 'Walk-in Customer'}</strong></div>
                      <div><span>Type</span><strong>{formatOrderType(order.order_type)}</strong></div>
                      <div><span>Date</span><strong>{formatDate(order.created_at)}</strong></div>
                    </div>}
                  </article>;
                })}
                {todayMyOrders.length === 0 && <div className={styles.emptyState}><strong>No orders placed today</strong><span>Today&apos;s paid and unpaid orders will appear here automatically.</span></div>}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'take_order' && (
          <div className={styles.takeOrderShell}>
            <section className={styles.menuSection}>
              <div className={styles.orderMetaGrid}>
                <div className={`${styles.fieldStack} ${styles.modeField}`}><span>Order#</span><div className={styles.staticField}>{editingOrderId ? formatVisibleOrderNumber(editingSnapshot || { order_number: editingSnapshot?.order_number, id: editingOrderId }) : 'New Order'}</div></div>
                <label className={styles.fieldStack}><span>Search Customer</span><input type="text" className={styles.fieldInput} placeholder="Name, phone, code..." value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} /></label>
                <label className={styles.fieldStack}><span>Customer</span><select className={styles.fieldInput} value={selectedCustomerId || ''} onChange={(event) => setSelectedCustomerId(event.target.value ? Number(event.target.value) : null)}><option value="">Walk-in Customer</option>{filteredCustomers.map((customer: any) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone_number ? ` | ${customer.phone_number}` : ''}{customer.customer_code ? ` | ${customer.customer_code}` : ''}</option>)}</select></label>
                <label className={styles.fieldStack}><span>Order Type</span><select className={styles.fieldInput} value={selectedOrderType} onChange={(event) => setSelectedOrderType(event.target.value as UiOrderType)}><option value="takeaway">Takeaway</option><option value="dine_in">Dine-in</option></select></label>
                <label className={styles.fieldStack}><span>Table</span><select className={styles.fieldInput} value={selectedTableId || ''} onChange={(event) => setSelectedTableId(event.target.value ? Number(event.target.value) : null)} disabled={selectedOrderType !== 'dine_in'}><option value="">{selectedOrderType === 'dine_in' ? 'Select Table' : 'Not Required'}</option>{tables.map((table: any) => <option key={table.id} value={table.id}>{table.table_number}</option>)}</select></label>
              </div>
              <div className={styles.menuToolbar}>
                <div className={styles.toolbarRow}>
                  <div className={styles.menuSearch}><Search size={16} /><input type="text" placeholder="Search menu item..." value={menuSearch} onChange={(event) => setMenuSearch(event.target.value)} /></div>
                  <div className={styles.viewToggle} role="group" aria-label="Product view">
                    <button className={`${styles.toggleBtn} ${productView === 'grid' ? styles.active : ''}`} onClick={() => setProductView('grid')}>Grid</button>
                    <button className={`${styles.toggleBtn} ${productView === 'list' ? styles.active : ''}`} onClick={() => setProductView('list')}>List</button>
                  </div>
                </div>
                <div className={styles.categoryList}>{categories.map((category) => <button key={category} className={`${styles.categoryBtn} ${activeCategory === category ? styles.active : ''}`} onClick={() => setActiveCategory(category)}>{category}</button>)}</div>
              </div>
              <div className={`${styles.menuList} ${productView === 'list' ? styles.menuListView : ''}`}>
                {filteredMenu.map((item) => {
                  const qtyInCart = cart.filter((line) => line.productId === item.id).reduce((sum, line) => sum + Number(line.qty || 0), 0);
                  return <button key={item.id} className={styles.menuCard} onClick={() => addMenuItem(item)}>{qtyInCart > 0 && <span className={styles.productQtyBadge}>{qtyInCart}</span>}<div className={styles.menuCardHead}><strong>{item.name}</strong><span className={styles.priceTag}>{formatMoney(item.price)}</span></div></button>;
                })}
                {filteredMenu.length === 0 && <div className={styles.emptyState}><strong>No sellable items found</strong><span>Items with zero price are hidden automatically.</span></div>}
              </div>
            </section>

            <button className={styles.cartToggle} onClick={() => setCartOpen((current) => !current)}>{cartOpen ? <X size={16} /> : <ShoppingCart size={16} />}<span>{cartOpen ? 'Hide Cart' : 'Cart'}</span></button>

            <aside className={`${styles.cartSection} ${cartOpen ? styles.cartOpen : styles.cartClosed} ${editingOrderId ? styles.cartEditMode : ''}`}>
              <div className={styles.cartHeader}>
                <div><h3>{editingOrderId ? 'Edit Order' : 'Current Order'}</h3><p>{selectedCustomer?.name || 'Walk-in Customer'}{selectedTableId ? ` - Table ${tables.find((table: any) => Number(table.id) === Number(selectedTableId))?.table_number || selectedTableId}` : ''}</p></div>
                <button className={styles.iconBtn} onClick={() => setCartOpen(false)} title="Hide Cart"><X size={16} /></button>
              </div>
              <div className={styles.cartBody}>
                <label className={styles.fieldStack}><span>Order Note</span><input type="text" className={styles.fieldInput} placeholder="General instruction for this order" value={generalNote} onChange={(event) => setGeneralNote(event.target.value)} /></label>
                {cart.length === 0 ? <div className={styles.emptyState}><strong>Cart is empty</strong><span>Keep the cart hidden on mobile and tap items from the menu to build the order.</span></div> : cart.map((line) => {
                  const reductionLocked = Boolean(line.orderItemId) && isPastReduceWindow(line.createdAt, branchDetail);
                  return <div key={line.key} className={styles.cartItem}><div className={styles.cartItemTop}><div><strong>{line.name}</strong><span>{formatMoney(line.price)} each</span></div><strong>{formatMoney(line.price * line.qty)}</strong></div><div className={styles.cartControls}><div className={styles.qtyControl}><button className={styles.qtyBtn} disabled={reductionLocked} onClick={() => decreaseQty(line.key)}><Minus size={14} /></button><span>{line.qty}</span><button className={styles.qtyBtn} onClick={() => increaseQty(line.key)}><Plus size={14} /></button></div><input type="text" className={styles.inlineInput} placeholder="Item note" value={line.comment} onChange={(event) => updateLineComment(line.key, event.target.value)} /><button className={styles.iconBtn} disabled={reductionLocked} onClick={() => removeLine(line.key)} title="Remove line"><X size={14} /></button></div>{reductionLocked && <div className={styles.inlineHint}>Qty reduction or removal is locked by branch time policy for this line.</div>}</div>;
                })}
              </div>
              <div className={styles.cartFooter}>
                <div className={styles.totalRow}><span>Total</span><strong>{formatMoney(currentOrderTotal)}</strong></div>
                <div className={styles.actionRow}>
                  <button className={styles.secondaryBtn} onClick={resetComposer}>{editingOrderId ? 'Discard Edit' : 'Clear'}</button>
                  <button className={styles.primaryBtn} disabled={isSubmitting || cart.length === 0} onClick={() => void saveOrder()}>{isSubmitting ? 'Saving...' : editingOrderId ? 'Update Order' : 'Send to Kitchen'}</button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {activeTab === 'my_orders' && (
          <div className={styles.sectionStack}>
            <div className={styles.sectionHeader}>
              <div><h2>My Orders</h2><p>Today is default. Use filters to bring older orders back into view.</p></div>
              <div className={styles.sectionControls}>
                <div className={styles.viewToggle} role="group" aria-label="My orders view">
                  <button className={`${styles.toggleBtn} ${myOrdersView === 'list' ? styles.active : ''}`} onClick={() => setMyOrdersView('list')}>List</button>
                  <button className={`${styles.toggleBtn} ${myOrdersView === 'grid' ? styles.active : ''}`} onClick={() => setMyOrdersView('grid')}>Grid</button>
                </div>
              </div>
              <div className={styles.filterGrid}>
                <select className={styles.fieldInput} value={orderFilters.dateScope} onChange={(event) => setOrderFilters((current) => ({ ...current, dateScope: event.target.value as OrderFilters['dateScope'] }))}><option value="today">Today</option><option value="history">Older</option><option value="all">All Dates</option></select>
                <select className={styles.fieldInput} value={orderFilters.status} onChange={(event) => setOrderFilters((current) => ({ ...current, status: event.target.value }))}><option value="active">Active</option><option value="all">All Statuses</option><option value="held">Held</option><option value="pending">Pending</option><option value="preparing">Preparing</option><option value="ready">Ready</option><option value="served">Served</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>
                <select className={styles.fieldInput} value={orderFilters.type} onChange={(event) => setOrderFilters((current) => ({ ...current, type: event.target.value }))}><option value="all">All Types</option><option value="dine_in">Dine-in</option><option value="takeout">Takeout</option></select>
                <input className={styles.fieldInput} placeholder="Order, customer, table..." value={orderFilters.query} onChange={(event) => setOrderFilters((current) => ({ ...current, query: event.target.value }))} />
              </div>
            </div>
              <div className={`${styles.orderList} ${myOrdersView === 'list' ? styles.orderListView : ''}`}>
                {filteredMyOrders.map((order: any) => {
                  const kitchen = kitchenStatusByOrderId.get(Number(order.id));
                  const displayStatus = kitchen?.status || order.order_status;
                  const editable = Number(order.order_taker_id || 0) === currentUserId && canEditOrderStatus(order.order_status);
                  return <article key={order.id} className={`${styles.orderCard} ${styles.compactOrderCard}`}><div className={styles.orderCardHeader}><div className={styles.orderHeaderLine}><strong>{formatVisibleOrderNumber(order)}</strong><span className={styles.kotInline}>KOT {kitchen?.kotNumber || '-'}</span><span className={styles.statusPill}>{displayStatus}</span></div></div><div className={styles.orderCardSubRow}><span>{formatDate(order.created_at)} - {formatTime(order.created_at)}</span>{editable && <button className={styles.linkBtn} onClick={() => startEditOrder(order)}><SquarePen size={14} /><span>Edit Order</span></button>}</div><div className={styles.orderCardBody}><div><span>Type</span><strong>{formatOrderType(order.order_type)}</strong></div><div><span>Customer</span><strong>{order.customer_name || 'Walk-in Customer'}</strong></div><div><span>Table</span><strong>{order.table_number || '-'}</strong></div><div><span>Total</span><strong>{formatMoney(order.total_amount || 0)}</strong></div></div></article>;
                })}
              {filteredMyOrders.length === 0 && <div className={styles.emptyState}><strong>No orders match the current filters</strong><span>Switch from Today to Older or All Dates to review historical orders.</span></div>}
            </div>
          </div>
        )}

        {activeTab === 'kitchen' && (
          <div className={styles.sectionStack}>
            <div className={styles.sectionHeader}>
              <div><h2>Orders in Kitchen</h2><p>Own orders are shown by default, with the option to open the full branch kitchen queue.</p></div>
              <div className={styles.sectionControls}>
                <div className={styles.viewToggle} role="group" aria-label="Kitchen orders view">
                  <button className={`${styles.toggleBtn} ${kitchenView === 'list' ? styles.active : ''}`} onClick={() => setKitchenView('list')}>List</button>
                  <button className={`${styles.toggleBtn} ${kitchenView === 'grid' ? styles.active : ''}`} onClick={() => setKitchenView('grid')}>Grid</button>
                </div>
              </div>
              <div className={styles.filterGrid}>
                <select className={styles.fieldInput} value={kitchenFilters.scope} onChange={(event) => setKitchenFilters((current) => ({ ...current, scope: event.target.value as KitchenFilters['scope'] }))}><option value="mine">My Orders</option><option value="all">All Orders</option><option value="taker">Specific Order Taker</option></select>
                <select className={styles.fieldInput} value={kitchenFilters.takerId} onChange={(event) => setKitchenFilters((current) => ({ ...current, takerId: event.target.value }))} disabled={kitchenFilters.scope !== 'taker'}><option value="">Select Order Taker</option>{orderTakers.map((taker: any) => <option key={taker.id} value={taker.id}>{taker.full_name || taker.user_name}</option>)}</select>
                <select className={styles.fieldInput} value={kitchenFilters.status} onChange={(event) => setKitchenFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">All Kitchen Status</option><option value="pending">Pending</option><option value="preparing">Preparing</option><option value="ready">Ready</option></select>
                <input className={styles.fieldInput} placeholder="Table no." value={kitchenFilters.table} onChange={(event) => setKitchenFilters((current) => ({ ...current, table: event.target.value }))} />
                <input className={styles.fieldInput} placeholder="Search order or customer" value={kitchenFilters.query} onChange={(event) => setKitchenFilters((current) => ({ ...current, query: event.target.value }))} />
              </div>
            </div>
              <div className={`${styles.orderList} ${kitchenView === 'list' ? styles.orderListView : ''}`}>
                {filteredKitchenOrders.map((kot: any) => {
                  const relatedOrder = orders.find((order: any) => Number(order.id) === Number(kot.order_id));
                  const orderTime = relatedOrder?.created_at || kot.created_at;
                  return <article key={kot.id} className={`${styles.orderCard} ${styles.compactOrderCard}`}><div className={styles.orderCardHeader}><div className={styles.orderHeaderLine}><strong>{formatVisibleOrderNumber({ ...relatedOrder, order_number: kot.order_number || relatedOrder?.order_number, id: kot.order_id })}</strong><span className={styles.kotInline}>KOT {formatVisibleKotNumber(kot, String(kot.id))}</span><span className={styles.statusPill}>{kot.status}</span></div></div><div className={styles.orderCardSubRow}><span>{formatDate(orderTime)} - {formatTime(orderTime)}</span><span>{relatedOrder?.table_number || kot.table_number || '-'}</span></div><div className={styles.orderCardBody}><div><span>Order Taker</span><strong>{relatedOrder?.order_taker_name || relatedOrder?.order_taker_username || '-'}</strong></div><div><span>Customer</span><strong>{relatedOrder?.customer_name || 'Walk-in Customer'}</strong></div><div><span>Table</span><strong>{kot.table_number || relatedOrder?.table_number || '-'}</strong></div><div><span>Items</span><strong>{Array.isArray(kot.items) ? kot.items.length : 0}</strong></div></div></article>;
                })}
              {filteredKitchenOrders.length === 0 && <div className={styles.emptyState}><strong>No kitchen orders found</strong><span>Adjust the order taker or table filters to widen the kitchen queue.</span></div>}
            </div>
          </div>
        )}

        {activeTab === 'search' && (
          <div className={styles.sectionStack}>
            <div className={styles.sectionHeader}>
              <div><h2>Search Orders</h2><p>Find orders by number, customer, table, or order taker.</p></div>
              <div className={styles.sectionControls}>
                <div className={styles.viewToggle} role="group" aria-label="Search results view">
                  <button className={`${styles.toggleBtn} ${searchView === 'list' ? styles.active : ''}`} onClick={() => setSearchView('list')}>List</button>
                  <button className={`${styles.toggleBtn} ${searchView === 'grid' ? styles.active : ''}`} onClick={() => setSearchView('grid')}>Grid</button>
                </div>
              </div>
            </div>
              <div className={`${styles.orderList} ${searchView === 'list' ? styles.orderListView : ''}`}>
                {globalSearch.trim().length < 2 ? <div className={styles.emptyState}><strong>Search is waiting for input</strong><span>Type at least 2 characters in the top search bar.</span></div> : searchedOrders.map((order: any) => {
                  const kitchen = kitchenStatusByOrderId.get(Number(order.id));
                  const displayStatus = kitchen?.status || order.order_status;
                  return <article key={order.id} className={styles.orderCard}><div className={styles.orderCardHeader}><div><strong>{formatVisibleOrderNumber(order)}</strong><span>{order.order_taker_name || order.order_taker_username || '-'}</span></div><span className={styles.statusPill}>{displayStatus}</span></div><div className={styles.orderCardBody}><div><span>Customer</span><strong>{order.customer_name || 'Walk-in Customer'}</strong></div><div><span>Table</span><strong>{order.table_number || '-'}</strong></div><div><span>Type</span><strong>{formatOrderType(order.order_type)}</strong></div><div><span>Kitchen</span><strong>{kitchen?.status || '-'}</strong></div></div></article>;
                })}
              </div>
          </div>
        )}
      </main>
    </div>
  );
}
