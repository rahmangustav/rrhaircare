// Keranjang belanja — disimpan di localStorage, dipakai bersama semua halaman.
const Cart = (() => {
  const KEY = 'rrhc_cart';
  let items = JSON.parse(localStorage.getItem(KEY) || '[]');
  const save = () => { localStorage.setItem(KEY, JSON.stringify(items)); render(); };
  const rupiah = n => 'Rp' + (Number(n)||0).toLocaleString('id-ID');

  function add(p){
    const ex = items.find(i => i.id === p.id);
    if (ex) ex.qty++;
    else items.push({ id: p.id, name: p.name, price: p.price, image: p.image, qty: 1 });
    save();
  }
  function setQty(id, q){
    const it = items.find(i => i.id === id);
    if (!it) return;
    it.qty = Math.max(1, q);
    save();
  }
  function remove(id){ items = items.filter(i => i.id !== id); save(); }
  function clear(){ items = []; save(); }
  const count = () => items.reduce((s,i) => s + i.qty, 0);
  const subtotal = () => items.reduce((s,i) => s + i.price * i.qty, 0);
  const all = () => items;

  function render(){
    const badge = document.getElementById('cartCount');
    if (badge){ const c = count(); badge.textContent = c; badge.style.display = c ? 'flex' : 'none'; }
    const box = document.getElementById('cartItems');
    if (!box) return;
    const footer = document.getElementById('cartFooter');
    if (!items.length){
      box.innerHTML = '<div class="empty"><i class="fa-solid fa-bag-shopping" style="font-size:2rem;color:var(--blush)"></i><p style="margin-top:12px">Keranjang masih kosong</p></div>';
      if (footer) footer.style.display = 'none';
      return;
    }
    if (footer) footer.style.display = 'block';
    box.innerHTML = items.map(i => {
      const thumb = i.image ? `<img class="ci-thumb" src="${i.image}"/>` : `<div class="ci-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--blush)"><i class="fa-solid fa-bottle-droplet"></i></div>`;
      return `<div class="cart-item">${thumb}
        <div class="ci-info">
          <h4>${esc(i.name)}</h4>
          <div class="ci-price">${rupiah(i.price)}</div>
          <div class="qty">
            <button data-dec="${i.id}">−</button><span>${i.qty}</span><button data-inc="${i.id}">+</button>
          </div>
        </div>
        <button class="ci-remove" data-rm="${i.id}"><i class="fa-solid fa-trash-can"></i></button>
      </div>`;
    }).join('');
    const sub = document.getElementById('cartSubtotal');
    if (sub) sub.textContent = rupiah(subtotal());
    box.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => setQty(b.dataset.inc, qtyOf(b.dataset.inc)+1));
    box.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => setQty(b.dataset.dec, qtyOf(b.dataset.dec)-1));
    box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => remove(b.dataset.rm));
  }
  const qtyOf = id => (items.find(i => i.id === id)||{}).qty || 1;
  function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

  document.addEventListener('DOMContentLoaded', render);
  render();
  return { add, setQty, remove, clear, count, subtotal, all, render };
})();

// Drawer + toast helper (kalau elemennya ada di halaman)
function toast(msg){
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200);
}
document.addEventListener('DOMContentLoaded', () => {
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('overlay');
  const open = () => { drawer?.classList.add('show'); overlay?.classList.add('show'); };
  const close = () => { drawer?.classList.remove('show'); overlay?.classList.remove('show'); };
  document.getElementById('cartBtn')?.addEventListener('click', open);
  document.getElementById('closeCart')?.addEventListener('click', close);
  overlay?.addEventListener('click', close);
});
