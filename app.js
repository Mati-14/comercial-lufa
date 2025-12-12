const state = { user: null, role: null, email: null, products: [], cart: [], orders: [], filterCategory: '' };
const API = window.location.origin;
const $ = (s) => document.querySelector(s);
const CATEGORIES = ['lacteos','carne','dulces','pescado','frutas','productos secos','enlatados','limpieza del hogar','cuidado personal','bebidas','arroz','fideos','yogurt','legumbres','sopas','sal','condimentos','verduras','vinos','cerveza','destilados','jugos','agua'];
const format = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

async function fetchProducts() {
  try {
    const res = await fetch(API + '/api/products');
    state.products = await res.json();
  } catch {}
}

function saveCart() { localStorage.setItem('cart', JSON.stringify(state.cart)); }
function loadCart() { const raw = localStorage.getItem('cart'); state.cart = raw ? JSON.parse(raw) : []; }

async function registerUser(name, email, password) {
  try {
    const res = await fetch(API + '/api/users/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
    if (res.ok) return { ok: true };
    const j = await res.json().catch(() => ({}));
    return { error: j.error || 'register_failed' };
  } catch {
    return { error: 'server_unreachable' };
  }
}
async function loginUser(email, password) {
  try {
    const res = await fetch(API + '/api/users/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return { error: j.error || 'invalid_credentials' };
    }
    return await res.json();
  } catch {
    return { error: 'server_unreachable' };
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

function show(id) { $('#loginSection').classList.add('hidden'); $('#registerSection').classList.add('hidden'); $('#shopSection').classList.add('hidden'); $('#adminSection').classList.add('hidden'); $('#cartSection').classList.add('hidden'); $('#profileSection').classList.add('hidden'); document.getElementById(id).classList.remove('hidden'); }
function refreshTop() {
  const isAuthed = !!state.user;
  $('#logout').classList.toggle('hidden', !isAuthed);
  $('#goAdmin').classList.toggle('hidden', !(isAuthed && state.role === 'admin'));
  document.getElementById('profileTop').classList.toggle('hidden', !isAuthed);
  document.getElementById('cartTop').classList.toggle('hidden', !isAuthed);
  document.getElementById('loginTop').classList.toggle('hidden', isAuthed);
  document.getElementById('registerTop').classList.toggle('hidden', isAuthed);
}

function renderCatalog() {
  const c = $('#catalog');
  c.innerHTML = '';
  const q = ($('#searchInput')?.value || '').toLowerCase();
  const cat = state.filterCategory || ($('#filterCategory')?.value || '');
  const filtered = state.products.filter(p => {
    const okName = !q || p.name.toLowerCase().includes(q);
    const okCat = !cat || (p.category || '').toLowerCase() === cat.toLowerCase();
    return okName && okCat;
  });
  filtered.forEach(p => {
    const el = document.createElement('div');
    el.className = 'product';
    el.innerHTML = `
      <img src="${p.image || ''}" alt="${p.name}" />
      <div class="name">${p.name}</div>
      <div class="price">${format(p.price)}</div>
      <div class="actions">
        <input type="number" min="1" value="1" data-id="${p.id}" />
        <button data-id="${p.id}">Agregar</button>
      </div>
    `;
    el.querySelector('button').addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      const qty = parseInt(el.querySelector('input').value || '1', 10);
      const prod = state.products.find(x => x.id === id);
      const existing = state.cart.find(x => x.id === id);
      if (existing) existing.qty += qty; else state.cart.push({ id, name: prod.name, price: prod.price, qty });
      saveCart();
      renderCart();
    });
    c.appendChild(el);
  });
}

function renderCart() {
  const cont = $('#cartItemsPage');
  if (!cont) return;
  cont.innerHTML = '';
  state.cart.forEach(it => {
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div>${it.name}</div>
      <div>${it.qty}</div>
      <div>${format(it.price)}</div>
      <button data-id="${it.id}" class="secondary">Quitar</button>
    `;
    row.querySelector('button').addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      state.cart = state.cart.filter(x => x.id !== id);
      saveCart();
      renderCart();
    });
    cont.appendChild(row);
  });
  const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const totalEl = document.getElementById('cartTotalPage');
  if (totalEl) totalEl.textContent = format(total);
  const ct = document.getElementById('cartTop');
  if (ct) ct.textContent = 'Carrito (' + format(total) + ')';
}

function renderAdmin() {
  const cont = $('#adminProducts');
  cont.innerHTML = '';
  state.products.forEach(p => {
    const row = document.createElement('div');
    row.className = 'admin-row';
    row.innerHTML = `
      <input type="text" value="${p.name}" data-id="${p.id}" />
      <input type="number" step="0.01" value="${p.price}" data-id="${p.id}" />
      <input type="url" value="${p.image || ''}" data-id="${p.id}" />
      <select data-id="${p.id}">${CATEGORIES.map(c => `<option ${((p.category||'')===c)?'selected':''}>${c}</option>`).join('')}</select>
      <input type="file" accept="image/*" data-file-id="${p.id}" />
      <button data-id="${p.id}">Guardar</button>
      <button data-id="${p.id}" class="secondary">Eliminar</button>
    `;
    const inputs = row.querySelectorAll('input');
    const selects = row.querySelectorAll('select');
    const nameI = inputs[0];
    const priceI = inputs[1];
    const imageI = inputs[2];
    const catS = selects[0];
    const fileI = inputs[3];
    row.querySelector('button').addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      const idx = state.products.findIndex(x => x.id === id);
      const newName = nameI.value.trim() || state.products[idx].name;
      const newPrice = parseFloat(priceI.value || state.products[idx].price);
      let newImg = imageI.value.trim();
      if (fileI && fileI.files && fileI.files[0]) {
        newImg = await readFileAsDataURL(fileI.files[0]);
        fileI.value = '';
      }
      try {
        await fetch(API + '/api/products/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName, price: newPrice, image: newImg, category: catS.value }) });
        state.products[idx].name = newName; state.products[idx].price = newPrice; state.products[idx].image = newImg; state.products[idx].category = catS.value;
        renderCatalog();
      } catch {}
    });
    row.querySelectorAll('button')[1].addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      fetch(API + '/api/products/' + id, { method: 'DELETE' }).then(() => {
        state.products = state.products.filter(x => x.id !== id);
        renderAdmin();
        renderCatalog();
      });
    });
    cont.appendChild(row);
  });
  renderAdminOrders();
}

function setAuthMsg(text, type='error') {
  const el = document.getElementById('authMsg');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
  el.classList.remove('error', 'success');
  el.classList.add(type);
}

async function login() {
  const email = $('#loginEmail').value.trim();
  const p = $('#loginPass').value.trim();
  if (!email || !p) return;
  const data = await loginUser(email, p);
  if (data && data.error) {
    if (data.error === 'server_unreachable') setAuthMsg('Servidor no disponible. Inicia el backend.', 'error');
    else setAuthMsg('Correo o contraseña inválidos.', 'error');
    return;
  }
  state.user = data.name;
  state.role = data.role || 'cliente';
  state.email = email;
  $('#welcome').textContent = `Bienvenido, ${state.user}`;
  setAuthMsg('', 'success'); document.getElementById('authMsg').classList.add('hidden');
  refreshTop();
  show('shopSection');
}

function logout() {
  state.user = null; state.role = null; state.email = null; const le = $('#loginEmail'); const lp = $('#loginPass'); if (le) le.value = ''; if (lp) lp.value = ''; show('shopSection'); refreshTop(); const ct = document.getElementById('cartTop'); if (ct) ct.textContent = 'Carrito'; }

function init() {
  fetchProducts().then(() => { renderCatalog(); });
  loadCart();
  renderCart();
  $('#loginBtn').addEventListener('click', login);
  $('#logout').addEventListener('click', logout);
  $('#goShop').addEventListener('click', () => show('shopSection'));
  $('#goAdmin').addEventListener('click', () => { fetchOrders().then(() => { renderAdmin(); show('adminSection'); showAdminTab('add'); }); });
  const lt = document.getElementById('loginTop');
  const rt = document.getElementById('registerTop');
  const ct = document.getElementById('cartTop');
  const pt = document.getElementById('profileTop');
  if (lt) lt.addEventListener('click', () => { show('loginSection'); });
  if (rt) rt.addEventListener('click', () => { show('registerSection'); });
  if (ct) ct.addEventListener('click', () => { renderCart(); show('cartSection'); });
  if (pt) pt.addEventListener('click', () => { renderProfile(); show('profileSection'); });
  const ps = document.getElementById('profileSaveName');
  if (ps) ps.addEventListener('click', async () => {
    if (!state.email) { show('loginSection'); return; }
    const ni = document.getElementById('profileNameInput');
    const newName = (ni && ni.value.trim()) || '';
    if (!newName) return;
    try {
      const res = await fetch(API + '/api/users/update_name', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: state.email, name: newName }) });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error('update_failed');
      state.user = j.name;
      document.getElementById('profileName').textContent = j.name;
      document.getElementById('welcome').textContent = `Bienvenido, ${state.user}`;
      setProfileMsg('Nombre actualizado correctamente.', 'success');
    } catch (e) {
      setProfileMsg('No se pudo actualizar el nombre.', 'error');
    }
  });
  $('#registerBtn').addEventListener('click', async () => {
    const name = $('#regName').value.trim();
    const email = $('#regEmail').value.trim();
    const pass = $('#regPass').value.trim();
    if (!name || !email || !pass) return;
    const r = await registerUser(name, email, pass);
    if (r && r.error) {
      if (r.error === 'server_unreachable') setAuthMsg('Servidor no disponible. Inicia el backend.', 'error');
      else if (r.error === 'email_exists') setAuthMsg('El correo ya está registrado.', 'error');
      else setAuthMsg('No se pudo registrar.', 'error');
      return;
    }
    setAuthMsg('Registro exitoso. Ahora puedes iniciar sesión.', 'success');
    $('#regName').value = ''; $('#regEmail').value = ''; $('#regPass').value = '';
    show('loginSection');
  });
  $('#addProductBtn').addEventListener('click', async () => {
    const name = $('#newName').value.trim();
    const price = parseFloat($('#newPrice').value);
    const image = $('#newImage').value.trim();
    const file = document.getElementById('newImageFile').files[0];
    const category = $('#newCategory').value;
    if (!name || isNaN(price)) return;
    let img = image;
    if (file) { img = await readFileAsDataURL(file); document.getElementById('newImageFile').value = ''; }
    try {
      const res = await fetch(API + '/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, price, image: img, category }) });
      const created = await res.json();
      state.products.push(created);
    } catch {}
    $('#newName').value = ''; $('#newPrice').value = ''; $('#newImage').value = '';
    renderCatalog();
    renderAdmin();
  });
  $('#checkoutBtn').addEventListener('click', async () => {
    if (!state.cart.length) return;
    if (!state.user) { const cm = document.getElementById('cartMsg'); if (cm) { cm.textContent = 'Debes iniciar sesión para comprar.'; cm.classList.remove('hidden'); cm.classList.add('error'); } show('loginSection'); return; }
    const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
    try {
      const buy_order = uid();
      const res = await fetch(API + '/api/pay/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Math.round(total), buy_order, user_email: state.email || '', cart: state.cart })
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error('simulate_failed');
      state.cart = []; saveCart(); renderCart();
      await fetchOrders();
      window.open(API + data.url, '_blank');
    } catch (e) {
      const cm = document.getElementById('cartMsg'); if (cm) { cm.textContent = 'No fue posible simular el pago.'; cm.classList.remove('hidden'); cm.classList.add('error'); }
    }
  });
  show('shopSection');
  refreshTop();
  fetchOrders();
  const si = document.getElementById('searchInput');
  const fc = document.getElementById('filterCategory');
  if (si) si.addEventListener('input', renderCatalog);
  if (fc) fc.addEventListener('change', (e) => { state.filterCategory = e.target.value || ''; renderCatalog(); });
  const sb = document.getElementById('searchBtn');
  if (sb) sb.addEventListener('click', renderCatalog);
  const chips = document.getElementById('chipFilters');
  if (chips) {
    chips.innerHTML = '';
    const all = document.createElement('button'); all.className = 'chip active'; all.textContent = 'Todos'; all.dataset.cat = '';
    chips.appendChild(all);
    CATEGORIES.forEach(cat => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = cat[0].toUpperCase() + cat.slice(1); b.dataset.cat = cat; chips.appendChild(b); });
    chips.querySelectorAll('.chip').forEach(b => b.addEventListener('click', (e) => {
      chips.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
      e.currentTarget.classList.add('active');
      state.filterCategory = e.currentTarget.dataset.cat || '';
      const sel = document.getElementById('filterCategory'); if (sel) sel.value = state.filterCategory;
      renderCatalog();
    }));
  }
  const ta = document.getElementById('tabAdminAdd');
  const te = document.getElementById('tabAdminEdit');
  const to = document.getElementById('tabAdminOrders');
  if (ta) ta.addEventListener('click', () => showAdminTab('add'));
  if (te) te.addEventListener('click', () => { showAdminTab('edit'); renderAdmin(); });
  if (to) to.addEventListener('click', () => { showAdminTab('orders'); renderAdminOrders(); });
}

document.addEventListener('DOMContentLoaded', init);
function renderProfile() {
  const n = document.getElementById('profileName');
  const e = document.getElementById('profileEmail');
  const r = document.getElementById('profileRole');
  if (n) n.textContent = state.user || '';
  if (e) e.textContent = state.email || '';
  if (r) r.textContent = state.role || '';
  const ni = document.getElementById('profileNameInput');
  if (ni) ni.value = state.user || '';
}

function setProfileMsg(text, type='success') {
  const el = document.getElementById('profileMsg');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
  el.classList.remove('error', 'success');
  el.classList.add(type);
}
async function fetchOrders() {
  try { const res = await fetch(API + '/api/orders'); state.orders = await res.json(); } catch { state.orders = []; }
}
function renderAdminOrders() {
  const list = document.getElementById('adminOrders');
  const countEl = document.getElementById('adminOrdersCount');
  if (!list) return;
  list.innerHTML = '';
  const orders = state.orders || [];
  if (countEl) countEl.textContent = 'Total pedidos: ' + orders.length;
  orders.forEach(o => {
    const wrap = document.createElement('div');
    wrap.className = 'card';
    const totalCLP = format(o.total);
    wrap.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <div><b>Orden:</b> ${o.buy_order} — <b>Cliente:</b> ${o.user_email || 'Invitado'} — <b>Total:</b> ${totalCLP} — <b>Items:</b> ${o.item_count}</div>
      <div style="display:flex;gap:8px">
        <button data-id="${o.id}" data-action="open-inline" class="secondary">Ver detalles</button>
      </div>
      </div>`;
    wrap.querySelectorAll('button').forEach(btn => {
      const act = btn.getAttribute('data-action');
      if (act === 'open-inline') btn.addEventListener('click', () => showOrderDetail(o));
    });
    list.appendChild(wrap);
  });
}
function showOrderDetail(o) {
  const meta = document.getElementById('adminOrderMeta');
  const table = document.getElementById('adminOrderTable');
  const totalEl = document.getElementById('adminOrderTotal');
  const box = document.getElementById('adminOrderDetail');
  if (!meta || !table || !totalEl || !box) return;
  meta.textContent = `Orden: ${o.buy_order} — Cliente: ${o.user_email || 'Invitado'}`;
  table.innerHTML = '';
  const header = document.createElement('div'); header.className = 'table-header';
  header.innerHTML = '<div>Producto</div><div>Cantidad</div><div>Precio</div><div>Subtotal</div>';
  table.appendChild(header);
  o.items.forEach(i => {
    const row = document.createElement('div'); row.className = 'table-row';
    const subtotal = i.price * i.qty;
    row.innerHTML = `<div>${i.name}</div><div>${i.qty}</div><div>${format(i.price)}</div><div>${format(subtotal)}</div>`;
    table.appendChild(row);
  });
  totalEl.textContent = format(o.total);
  box.classList.remove('hidden');
  const closeBtn = document.getElementById('closeOrderDetail');
  if (closeBtn) closeBtn.onclick = () => box.classList.add('hidden');
}

function showAdminTab(which) {
  const addS = document.getElementById('adminAddSection');
  const editS = document.getElementById('adminEditSection');
  const ordS = document.getElementById('adminOrdersSection');
  const ta = document.getElementById('tabAdminAdd');
  const te = document.getElementById('tabAdminEdit');
  const to = document.getElementById('tabAdminOrders');
  [addS, editS, ordS].forEach(s => s && s.classList.add('hidden'));
  [ta, te, to].forEach(b => b && b.classList.remove('active'));
  if (which === 'add') { addS && addS.classList.remove('hidden'); ta && ta.classList.add('active'); }
  if (which === 'edit') { editS && editS.classList.remove('hidden'); te && te.classList.add('active'); }
  if (which === 'orders') { ordS && ordS.classList.remove('hidden'); to && to.classList.add('active'); }
}
