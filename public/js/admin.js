// Admin panel logic
let TOKEN = sessionStorage.getItem('rrhc_admin');
const rupiah = n => 'Rp' + (Number(n)||0).toLocaleString('id-ID');
const esc = s => String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),2400); }

async function api(path, opts={}){
  opts.headers = { ...(opts.headers||{}), Authorization: 'Bearer ' + TOKEN };
  // Kirim JSON kalau body berupa objek biasa
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)){
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(path, opts);
  if (res.status === 401){ logout(); throw new Error('Sesi habis, login lagi'); }
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}

// ── Login ──
async function doLogin(){
  const password = document.getElementById('pw').value;
  try {
    const res = await fetch('/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({password}) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error||'Gagal login');
    TOKEN = data.token; sessionStorage.setItem('rrhc_admin', TOKEN);
    enterDash();
  } catch(e){ toast(e.message); }
}
function logout(){ TOKEN=null; sessionStorage.removeItem('rrhc_admin');
  document.getElementById('loginView').style.display='block';
  document.getElementById('dash').style.display='none';
  document.getElementById('logoutBtn').style.display='none'; }
document.getElementById('logoutBtn').addEventListener('click', e=>{e.preventDefault();
  api('/api/admin/logout',{method:'POST'}).catch(()=>{}); logout();});

function enterDash(){
  document.getElementById('loginView').style.display='none';
  document.getElementById('dash').style.display='block';
  document.getElementById('logoutBtn').style.display='inline';
  loadProducts(); loadOrders(); loadSettings();
}

// ── Tabs ──
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  document.getElementById('v-'+t.dataset.view).classList.add('active');
}));

// ── Produk ──
async function loadProducts(){
  const list = await api('/api/admin/products');
  const body = document.getElementById('prodBody');
  if (!list.length){ body.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:30px">Belum ada produk. Klik “Tambah Produk”.</td></tr>'; return; }
  body.innerHTML = list.map(p => {
    const img = p.image ? `<img class="p-thumb" src="${p.image}"/>` : `<div class="p-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--blush)"><i class="fa-solid fa-bottle-droplet"></i></div>`;
    return `<tr>
      <td>${img}</td>
      <td><b>${esc(p.name)}</b><div style="font-size:.75rem;color:var(--muted)">${esc((p.description||'').slice(0,40))}</div></td>
      <td>${esc(p.category||'-')}</td>
      <td>${rupiah(p.price)}</td>
      <td>${p.stock}</td>
      <td>${p.active!==false?'<span class="badge b-kirim">Tampil</span>':'<span class="badge b-selesai">Hidden</span>'}</td>
      <td style="white-space:nowrap">
        <button class="icon-btn" onclick='editProduct(${JSON.stringify(p)})'><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn danger" onclick="delProduct('${p.id}','${esc(p.name)}')"><i class="fa-solid fa-trash-can"></i></button>
      </td></tr>`;
  }).join('');
}
function openProduct(){
  document.getElementById('modalTitle').textContent='Tambah Produk';
  ['pId','pName','pCat','pPrice','pStock','pDesc'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('pActive').checked=true;
  document.getElementById('pImg').value=''; document.getElementById('pImgPreview').innerHTML='';
  document.getElementById('prodModal').classList.add('show');
}
function editProduct(p){
  document.getElementById('modalTitle').textContent='Edit Produk';
  document.getElementById('pId').value=p.id;
  document.getElementById('pName').value=p.name;
  document.getElementById('pCat').value=p.category||'';
  document.getElementById('pPrice').value=p.price;
  document.getElementById('pStock').value=p.stock;
  document.getElementById('pDesc').value=p.description||'';
  document.getElementById('pActive').checked=p.active!==false;
  document.getElementById('pImg').value='';
  document.getElementById('pImgPreview').innerHTML = p.image?`<img class="p-thumb" style="width:80px;height:80px" src="${p.image}"/>`:'';
  document.getElementById('prodModal').classList.add('show');
}
function closeProduct(){ document.getElementById('prodModal').classList.remove('show'); }
async function saveProduct(){
  const id = document.getElementById('pId').value;
  const name = document.getElementById('pName').value.trim();
  const price = document.getElementById('pPrice').value;
  const stock = document.getElementById('pStock').value;
  if (!name || price===''||stock===''){ toast('Nama, harga, dan stok wajib diisi'); return; }
  const body = {
    name,
    category: document.getElementById('pCat').value.trim(),
    price, stock,
    description: document.getElementById('pDesc').value.trim(),
    active: document.getElementById('pActive').checked
  };
  const f = document.getElementById('pImg').files[0];
  if (f) body.imageData = await fileToDataURL(f);
  try {
    await api(id? `/api/admin/products/${id}` : '/api/admin/products', { method: id?'PUT':'POST', body });
    toast(id?'Produk diperbarui':'Produk ditambahkan'); closeProduct(); loadProducts();
  } catch(e){ toast(e.message); }
}
async function delProduct(id,name){
  if (!confirm(`Hapus produk "${name}"?`)) return;
  try { await api(`/api/admin/products/${id}`,{method:'DELETE'}); toast('Produk dihapus'); loadProducts(); }
  catch(e){ toast(e.message); }
}

// ── Pesanan ──
const STATUS = {
  menunggu_pembayaran:{l:'Menunggu Pembayaran',c:'b-wait'},
  menunggu_verifikasi:{l:'Perlu Verifikasi',c:'b-verif'},
  diproses:{l:'Diproses',c:'b-proses'},
  dikirim:{l:'Dikirim',c:'b-kirim'},
  selesai:{l:'Selesai',c:'b-selesai'},
  batal:{l:'Batal',c:'b-selesai'}
};
async function loadOrders(){
  const list = await api('/api/admin/orders');
  // Statistik
  const perlu = list.filter(o=>o.status==='menunggu_verifikasi').length;
  const proses = list.filter(o=>o.status==='diproses').length;
  const omzet = list.filter(o=>['diproses','dikirim','selesai'].includes(o.status)).reduce((s,o)=>s+o.total,0);
  document.getElementById('orderStats').innerHTML = `
    <div class="stat"><div class="n">${list.length}</div><div class="l">Total Pesanan</div></div>
    <div class="stat"><div class="n" style="color:#1f5fb5">${perlu}</div><div class="l">Perlu Verifikasi</div></div>
    <div class="stat"><div class="n" style="color:#5b3fb5">${proses}</div><div class="l">Sedang Diproses</div></div>
    <div class="stat"><div class="n" style="color:var(--rose-gold)">${rupiah(omzet)}</div><div class="l">Omzet (terbayar)</div></div>`;
  const box = document.getElementById('orderList');
  if (!list.length){ box.innerHTML='<div class="empty">Belum ada pesanan.</div>'; return; }
  box.innerHTML = list.map(o => {
    const st = STATUS[o.status]||{l:o.status,c:'b-selesai'};
    const items = o.items.map(i=>`<div class="summary-item" style="display:flex;justify-content:space-between;padding:6px 0"><span>${esc(i.name)} ×${i.qty}</span><span>${rupiah(i.price*i.qty)}</span></div>`).join('');
    const proof = o.paymentProof? `<div><b>Bukti bayar:</b><br><a href="${o.paymentProof}" target="_blank"><img class="proof-img" src="${o.paymentProof}"/></a></div>` : '<div class="help">Belum ada bukti pembayaran.</div>';
    const d = new Date(o.createdAt);
    return `<details class="order">
      <summary>
        <span><b>${o.code}</b> · ${esc(o.customer.name)} · ${rupiah(o.total)}</span>
        <span class="badge ${st.c}">${st.l}</span>
      </summary>
      <div class="od">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
          <div>
            <p class="help">${d.toLocaleString('id-ID')}</p>
            <p style="margin:8px 0"><b>${esc(o.customer.name)}</b> · ${esc(o.customer.phone)}<br>
            ${esc(o.customer.address)}${o.customer.city?', '+esc(o.customer.city):''}
            ${o.customer.note?`<br><i>Catatan: ${esc(o.customer.note)}</i>`:''}</p>
            <div style="margin-top:10px">${items}
              <div class="summary-item" style="display:flex;justify-content:space-between;padding:6px 0"><span>Ongkir (${esc(o.shipping.label)})</span><span>${o.shipping.price?rupiah(o.shipping.price):'Gratis'}</span></div>
              <div class="row-total grand" style="margin-top:6px"><span>Total</span><span>${rupiah(o.total)}</span></div>
            </div>
          </div>
          <div>
            ${proof}
            <label style="margin-top:14px">Ubah status</label>
            <select onchange="setStatus('${o.id}',this.value)">
              ${Object.keys(STATUS).map(k=>`<option value="${k}" ${o.status===k?'selected':''}>${STATUS[k].l}</option>`).join('')}
            </select>
            <a class="btn btn-outline btn-block" style="margin-top:10px" target="_blank"
              href="https://wa.me/${(o.customer.phone||'').replace(/\D/g,'').replace(/^0/,'62')}?text=${encodeURIComponent('Halo '+o.customer.name+', pesanan '+o.code+' di RR Hair Care')}">
              <i class="fa-brands fa-whatsapp"></i> Chat Pembeli</a>
          </div>
        </div>
      </div></details>`;
  }).join('');
}
async function setStatus(id,status){
  try { await api(`/api/admin/orders/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});
    toast('Status diperbarui'); loadOrders(); } catch(e){ toast(e.message); }
}

// ── Pengaturan ──
let SHIP = [];
async function loadSettings(){
  const s = await api('/api/admin/settings');
  document.getElementById('setName').value = s.storeName||'';
  document.getElementById('setWa').value = s.whatsapp||'';
  document.getElementById('setBank').value = s.bankInfo||'';
  document.getElementById('qrisPreview').innerHTML = s.qrisImage? `<img src="${s.qrisImage}" style="max-width:150px;border-radius:10px;border:1px solid var(--line)"/>`:'<span class="help">Belum ada QRIS.</span>';
  SHIP = s.shippingOptions||[];
  renderShipEditor();
}
function renderShipEditor(){
  document.getElementById('shipEditor').innerHTML = SHIP.map((s,i)=>`
    <div class="ship-line">
      <input value="${esc(s.label)}" oninput="SHIP[${i}].label=this.value" placeholder="Nama zona"/>
      <input type="number" value="${s.price}" oninput="SHIP[${i}].price=Number(this.value)" placeholder="Harga"/>
      <button class="icon-btn danger" onclick="SHIP.splice(${i},1);renderShipEditor()"><i class="fa-solid fa-xmark"></i></button>
    </div>`).join('');
}
function addShipLine(){ SHIP.push({id:'z_'+Date.now().toString(36),label:'',price:0}); renderShipEditor(); }
async function saveShip(){
  SHIP = SHIP.filter(s=>s.label.trim()).map(s=>({id:s.id||('z_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5)),label:s.label.trim(),price:Number(s.price)||0}));
  try { await api('/api/admin/settings',{method:'PUT',body:{shippingOptions:SHIP}}); toast('Ongkir disimpan'); loadSettings(); } catch(e){ toast(e.message); }
}
async function saveInfo(){
  const body = {
    storeName: document.getElementById('setName').value.trim(),
    whatsapp: document.getElementById('setWa').value.trim(),
    bankInfo: document.getElementById('setBank').value.trim()
  };
  const q = document.getElementById('setQris').files[0];
  if (q) body.qrisData = await fileToDataURL(q);
  try { await api('/api/admin/settings',{method:'PUT',body}); toast('Info toko disimpan'); loadSettings(); } catch(e){ toast(e.message); }
}
async function changePw(){
  const np = document.getElementById('newPw').value;
  if (np.length < 6){ toast('Password minimal 6 karakter'); return; }
  try { await api('/api/admin/settings',{method:'PUT',body:{newPassword:np}}); toast('Password diganti'); document.getElementById('newPw').value=''; } catch(e){ toast(e.message); }
}

// Auto-enter kalau sudah ada token
if (TOKEN) enterDash();
