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
  loadProducts(); loadOrders(); loadSettings(); loadStats(); loadGallery(); loadSiteImages(); loadPricelist();
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

// ── Pengunjung / Statistik ──
function ymd(d){ return new Date(d.getTime()+7*3600e3).toISOString().slice(0,10); } // WIB
async function loadStats(){
  let a;
  try { a = await api('/api/admin/stats'); } catch(e){ return; }
  const days = a.days||{}, total = a.total||{views:0,visitors:0};
  const today = ymd(new Date());
  const tv = (days[today]||{});
  // 7 hari terakhir
  let w7 = 0; for (let i=0;i<7;i++){ const k=ymd(new Date(Date.now()-i*864e5)); w7 += (days[k]||{}).visitors||0; }
  document.getElementById('visitStats').innerHTML = `
    <div class="stat"><div class="n">${total.visitors||0}</div><div class="l">Pengunjung (total)</div></div>
    <div class="stat"><div class="n" style="color:var(--rose-gold)">${total.views||0}</div><div class="l">Kunjungan halaman</div></div>
    <div class="stat"><div class="n" style="color:#1f5fb5">${tv.visitors||0}</div><div class="l">Pengunjung hari ini</div></div>
    <div class="stat"><div class="n" style="color:#5b3fb5">${w7}</div><div class="l">Pengunjung 7 hari</div></div>`;
  // Grafik 14 hari (bar)
  const bars = [];
  for (let i=13;i>=0;i--){ const dt=new Date(Date.now()-i*864e5); const k=ymd(dt);
    bars.push({ k, label: dt.getDate()+'/'+(dt.getMonth()+1), v:(days[k]||{}).visitors||0 }); }
  const max = Math.max(1, ...bars.map(b=>b.v));
  document.getElementById('visitChart').innerHTML = bars.map(b=>{
    const h = Math.round(b.v/max*130);
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px" title="${b.k}: ${b.v} pengunjung">
      <div style="font-size:.7rem;color:var(--muted)">${b.v||''}</div>
      <div style="width:100%;height:${h}px;min-height:2px;background:var(--rose-gold);border-radius:4px 4px 0 0;opacity:${b.v?1:.25}"></div>
      <div style="font-size:.62rem;color:var(--muted)">${b.label}</div>
    </div>`; }).join('');
  document.getElementById('visitFirst').textContent = a.firstAt
    ? 'Mulai mencatat sejak ' + new Date(a.firstAt).toLocaleString('id-ID')
    : 'Belum ada kunjungan tercatat.';
  // Asal pengunjung (7 hari + total), diurutkan dari yang paling ramai
  const last7 = []; for (let i=0;i<7;i++) last7.push(ymd(new Date(Date.now()-i*864e5)));
  const srcRows = Object.entries(a.sources||{}).map(([name,s])=>{
    const d = s.days||{};
    return { name, w7: last7.reduce((t,k)=>t+(d[k]||0),0), total: s.total||0 };
  }).sort((x,y)=> y.w7-x.w7 || y.total-x.total).slice(0,12);
  document.getElementById('visitSources').innerHTML = srcRows.length
    ? srcRows.map(r=>`<tr><td>${esc(r.name)}</td><td style="text-align:right">${r.w7}</td><td style="text-align:right;color:var(--muted)">${r.total}</td></tr>`).join('')
    : '<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:20px">Belum ada data.</td></tr>';
  // Halaman terpopuler
  const pages = Object.entries(a.pages||{}).sort((x,y)=>y[1]-x[1]).slice(0,10);
  document.getElementById('visitPages').innerHTML = pages.length
    ? pages.map(([p,c])=>`<tr><td>${esc(p)}</td><td style="text-align:right">${c}</td></tr>`).join('')
    : '<tr><td colspan="2" style="text-align:center;color:var(--muted);padding:20px">Belum ada data.</td></tr>';
}

// ── Galeri ──
async function loadGallery(){
  let list;
  try { list = await api('/api/admin/gallery'); } catch(e){ return; }
  const box = document.getElementById('galleryList');
  if (!list.length){ box.innerHTML='<p class="help" style="grid-column:1/-1">Belum ada foto. Upload foto pertamamu di atas.</p>'; return; }
  box.innerHTML = list.map(g=>`
    <div style="border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff">
      <div style="aspect-ratio:1/1;overflow:hidden"><img src="${g.image}" style="width:100%;height:100%;object-fit:cover"/></div>
      <div style="padding:8px 10px">
        <div style="font-size:.78rem;color:var(--charcoal);min-height:1.1em">${esc(g.caption||'')}</div>
        <button class="icon-btn danger" style="margin-top:8px;width:100%" onclick="delGalleryPhoto('${g.id}')"><i class="fa-solid fa-trash-can"></i> Hapus</button>
      </div>
    </div>`).join('');
}
async function addGalleryPhoto(){
  const f = document.getElementById('gImg').files[0];
  if (!f){ toast('Pilih foto dulu'); return; }
  const body = { caption: document.getElementById('gCaption').value.trim(), imageData: await fileToDataURL(f) };
  try {
    await api('/api/admin/gallery',{ method:'POST', body });
    toast('Foto ditambahkan ke galeri');
    document.getElementById('gImg').value=''; document.getElementById('gCaption').value='';
    document.getElementById('gImgPreview').innerHTML='';
    loadGallery();
  } catch(e){ toast(e.message); }
}
async function delGalleryPhoto(id){
  if (!confirm('Hapus foto ini dari galeri?')) return;
  try { await api(`/api/admin/gallery/${id}`,{method:'DELETE'}); toast('Foto dihapus'); loadGallery(); }
  catch(e){ toast(e.message); }
}
// ── Foto Bagian Halaman (slot tetap) ──
// Daftar slot yang bisa diganti fotonya. Tambah entri di sini untuk slot baru.
const SITE_IMG_SLOTS = [
  { key:'about', label:'“Kisah di Balik RR Hair Care” — Foto Rani & Ratih' }
];
async function loadSiteImages(){
  let imgs;
  try { imgs = await api('/api/admin/site-images'); } catch(e){ return; }
  const box = document.getElementById('siteImgList');
  box.innerHTML = SITE_IMG_SLOTS.map(s=>{
    const url = imgs[s.key];
    const preview = url
      ? `<div style="aspect-ratio:3/4;max-height:220px;overflow:hidden;border-radius:10px;border:1px solid var(--line)"><img src="${url}" style="width:100%;height:100%;object-fit:cover"/></div>`
      : `<div style="aspect-ratio:3/4;max-height:220px;display:flex;align-items:center;justify-content:center;border-radius:10px;border:1px dashed var(--line);color:var(--muted);font-size:.8rem">Belum ada foto</div>`;
    return `<div>
      <div style="font-size:.82rem;font-weight:600;margin-bottom:8px">${esc(s.label)}</div>
      ${preview}
      <input type="file" accept="image/*" style="margin-top:10px" onchange="setSiteImage('${s.key}',this)"/>
      ${url?`<button class="icon-btn danger" style="margin-top:8px;width:100%" onclick="delSiteImage('${s.key}')"><i class="fa-solid fa-trash-can"></i> Hapus Foto</button>`:''}
    </div>`;
  }).join('');
}
async function setSiteImage(key, input){
  const f = input.files[0];
  if (!f) return;
  try {
    await api('/api/admin/site-images',{ method:'POST', body:{ key, imageData: await fileToDataURL(f) } });
    toast('Foto diperbarui'); loadSiteImages();
  } catch(e){ toast(e.message); }
}
async function delSiteImage(key){
  if (!confirm('Hapus foto ini? Bagian itu akan kembali ke placeholder.')) return;
  try { await api(`/api/admin/site-images/${key}`,{method:'DELETE'}); toast('Foto dihapus'); loadSiteImages(); }
  catch(e){ toast(e.message); }
}

// Pratinjau foto saat dipilih
document.getElementById('gImg')?.addEventListener('change', async function(){
  const f = this.files[0];
  document.getElementById('gImgPreview').innerHTML = f
    ? `<img src="${await fileToDataURL(f)}" style="max-width:140px;border-radius:10px;border:1px solid var(--line)"/>` : '';
});

// ── Daftar Harga ──
async function loadPricelist(){
  let list;
  try { list = await api('/api/admin/pricelist'); } catch(e){ return; }
  document.getElementById('priceCount').textContent = list.length ? `${list.length} layanan` : '';
  const body = document.getElementById('priceBody');
  if (!list.length){ body.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:26px">Belum ada harga. Import CSV atau klik “Tambah Layanan”.</td></tr>'; return; }
  body.innerHTML = list.map(h=>`<tr>
    <td><b>${esc(h.name)}</b></td>
    <td>${esc(h.category||'-')}</td>
    <td>${rupiah(h.price)}</td>
    <td>${h.promo?`<span style="color:#b0603f">${rupiah(h.promo)}</span>`:'<span style="color:var(--muted)">—</span>'}</td>
    <td style="color:var(--muted);font-size:.82rem">${esc(h.duration||'')}</td>
    <td style="white-space:nowrap">
      <button class="icon-btn" onclick='editPrice(${JSON.stringify(h)})'><i class="fa-solid fa-pen"></i></button>
      <button class="icon-btn danger" onclick="delPrice('${h.id}','${esc(h.name)}')"><i class="fa-solid fa-trash-can"></i></button>
    </td></tr>`).join('');
}
function openPrice(){
  document.getElementById('priceModalTitle').textContent='Tambah Layanan';
  ['hId','hName','hCat','hPrice','hPromo','hDur'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('priceModal').classList.add('show');
}
function editPrice(h){
  document.getElementById('priceModalTitle').textContent='Edit Layanan';
  document.getElementById('hId').value=h.id;
  document.getElementById('hName').value=h.name||'';
  document.getElementById('hCat').value=h.category||'';
  document.getElementById('hPrice').value=h.price||0;
  document.getElementById('hPromo').value=h.promo||'';
  document.getElementById('hDur').value=h.duration||'';
  document.getElementById('priceModal').classList.add('show');
}
function closePrice(){ document.getElementById('priceModal').classList.remove('show'); }
async function savePrice(){
  const id = document.getElementById('hId').value;
  const name = document.getElementById('hName').value.trim();
  const price = document.getElementById('hPrice').value;
  if (!name || price===''){ toast('Nama & harga wajib diisi'); return; }
  const body = {
    name, category: document.getElementById('hCat').value.trim(),
    price, promo: document.getElementById('hPromo').value || 0,
    duration: document.getElementById('hDur').value.trim()
  };
  try {
    await api(id? `/api/admin/pricelist/${id}` : '/api/admin/pricelist', { method: id?'PUT':'POST', body });
    toast(id?'Layanan diperbarui':'Layanan ditambahkan'); closePrice(); loadPricelist();
  } catch(e){ toast(e.message); }
}
async function delPrice(id,name){
  if (!confirm(`Hapus "${name}" dari daftar harga?`)) return;
  try { await api(`/api/admin/pricelist/${id}`,{method:'DELETE'}); toast('Layanan dihapus'); loadPricelist(); }
  catch(e){ toast(e.message); }
}
async function importPriceCsv(){
  const file = document.getElementById('priceCsvFile').files[0];
  let csv = document.getElementById('priceCsvText').value.trim();
  if (file) csv = await file.text();
  if (!csv){ toast('Pilih file CSV atau tempel isinya'); return; }
  if (!confirm('Import CSV akan MENGGANTI seluruh daftar harga yang ada. Lanjutkan?')) return;
  try {
    const res = await api('/api/admin/pricelist',{ method:'POST', body:{ csv } });
    toast(`Berhasil import ${res.imported} layanan`);
    document.getElementById('priceCsvFile').value=''; document.getElementById('priceCsvText').value='';
    loadPricelist();
  } catch(e){ toast(e.message); }
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
