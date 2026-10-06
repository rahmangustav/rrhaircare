// Objek 3D untuk bagian "story" landing RR Hair Care (three.js, tanpa model
// eksternal — semua dibangun dari geometri dasar supaya ringan dan gratis).
// Posisi adegan dibaca dari window.RR_STORY.p (0..4) yang ditulis js/rr.js.
//   0 pembuka (video salon) · 1 signature (alat melayang) · 2 the craft (gunting)
//   3 potong rambut → butterfly cut (manekin + ±1.500 helai, mengikuti scroll)
//   4 Inaura (jar) · 5 booking (cincin cahaya, CSS) — debu emas di semua adegan.
// Kalau WebGL tidak ada / gagal, kanvas disembunyikan dan halaman tetap utuh.
import * as THREE from 'three';

const canvas = document.getElementById('gl');
const diam = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function mulai() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { canvas.style.display = 'none'; return; }
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  // ── Lingkungan pantulan: studio gelap + softbox hangat + strip LED emas ──
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: 0x0b0907, side: THREE.BackSide })));
  const panel = (w, h, warna, kuat, x, y, z, ry = 0, rx = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(warna).multiplyScalar(kuat), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m);
  };
  panel(12, 6, 0xfff1dc, 4.2, 0, 8, 2, 0, Math.PI / 2);        // softbox atas
  panel(9, 9, 0x8a6a45, 1.4, -9, 1, 3, Math.PI / 2);          // dinding hangat kiri
  panel(9, 9, 0x6b5238, 1.2, 0, 0, -10);                       // latar hangat belakang
  panel(0.5, 9, 0xe8b96a, 6, -7, 0, -2, Math.PI / 2.4);        // strip LED kiri
  panel(0.5, 9, 0xe8b96a, 6, 7, 0, -2, -Math.PI / 2.4);        // strip LED kanan
  panel(6, 3, 0xffe2b0, 1.6, 0, -1, 9, Math.PI);               // pantulan depan lembut
  panel(0.35, 7, 0xffffff, 4, 3, 1, -8);                       // garis putih belakang
  scene.environment = pmrem.fromScene(env, 0.02).texture;

  const key = new THREE.DirectionalLight(0xffe1b3, 2.2); key.position.set(-4, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xd9a85a, 3.2); rim.position.set(5, 2, -4); scene.add(rim);
  scene.add(new THREE.AmbientLight(0x2a2017, 0.6));

  const krom = new THREE.MeshPhysicalMaterial({ color: 0xf1f1f4, metalness: 1, roughness: 0.17, envMapIntensity: 1.9 });
  const emas = new THREE.MeshPhysicalMaterial({ color: 0xd2a45b, metalness: 1, roughness: 0.22, envMapIntensity: 1.25 });
  const hitam = new THREE.MeshPhysicalMaterial({ color: 0x0f0d0c, metalness: 0.25, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
  const putih = new THREE.MeshPhysicalMaterial({ color: 0xf3efe8, metalness: 0, roughness: 0.36, clearcoat: 0.7, clearcoatRoughness: 0.18 });

  // ── Gunting ──
  function belahan() {
    const g = new THREE.Group();
    const s = new THREE.Shape();
    s.moveTo(-0.05, -0.13); s.lineTo(0.35, -0.15);
    s.bezierCurveTo(1.3, -0.14, 2.2, -0.08, 2.85, 0.03);
    s.bezierCurveTo(2.3, 0.07, 1.3, 0.16, 0.35, 0.17);
    s.lineTo(-0.05, 0.13); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.014, bevelSegments: 3, curveSegments: 24 });
    geo.translate(0, 0, -0.025);
    g.add(new THREE.Mesh(geo, krom));
    const kurva = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.45, -0.1, 0), new THREE.Vector3(-0.86, -0.3, 0)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(kurva, 24, 0.055, 12, false), emas));
    const cincin = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.062, 18, 56), emas);
    cincin.position.set(-1.14, -0.5, 0); cincin.scale.set(1.12, 0.92, 1);
    g.add(cincin);
    return g;
  }
  const gunting = new THREE.Group();
  const isi = new THREE.Group(); isi.position.x = -0.7; gunting.add(isi);
  const pa = new THREE.Group(), pb = new THREE.Group();
  const ha = belahan(); ha.position.z = 0.032; pa.add(ha);
  const hb = belahan(); hb.rotation.x = Math.PI; hb.position.z = -0.032; pb.add(hb);
  isi.add(pa, pb);
  const baut = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.16, 24), emas);
  baut.rotation.x = Math.PI / 2; isi.add(baut);
  scene.add(gunting);

  // ── Sisir ──
  const sisir = new THREE.Group();
  const punggung = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.24, 0.07), hitam); punggung.position.y = 0.26; sisir.add(punggung);
  const lis = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.035, 0.075), emas); lis.position.y = 0.39; sisir.add(lis);
  const gigi = new THREE.InstancedMesh(new THREE.BoxGeometry(0.038, 0.5, 0.055), hitam, 32);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 32; i++) {
    const x = -1.22 + i * (2.44 / 31);
    const pendek = i > 15 ? 0.82 : 1;  // separuh gigi lebih rapat/pendek, seperti sisir salon
    m4.makeScale(1, pendek, 1); m4.setPosition(x, 0.14 - 0.25 * pendek, 0);
    gigi.setMatrixAt(i, m4);
  }
  sisir.add(gigi);
  scene.add(sisir);

  // ── Jar Inaura ──
  const jar = new THREE.Group();
  const v2 = (a) => a.map(([x, y]) => new THREE.Vector2(x, y));
  jar.add(new THREE.Mesh(new THREE.LatheGeometry(v2([[0, -0.5], [0.8, -0.5], [0.87, -0.47], [0.9, -0.4], [0.9, 0.38], [0.86, 0.43], [0.8, 0.45], [0.8, 0.5]]), 72), putih));
  const tutup = new THREE.Mesh(new THREE.LatheGeometry(v2([[0.79, 0.46], [0.92, 0.47], [0.955, 0.51], [0.955, 0.73], [0.93, 0.78], [0.6, 0.795], [0, 0.8]]), 72), putih);
  jar.add(tutup);
  const garisEmas = new THREE.Mesh(new THREE.TorusGeometry(0.957, 0.012, 8, 96), emas);
  garisEmas.rotation.x = Math.PI / 2; garisEmas.position.y = 0.53; tutup.add(garisEmas);
  // Label digambar di kanvas setelah font siap
  const kanvas = document.createElement('canvas'); kanvas.width = 1024; kanvas.height = 420;
  const tek = new THREE.CanvasTexture(kanvas); tek.colorSpace = THREE.SRGBColorSpace; tek.anisotropy = 4;
  function gambarLabel() {
    const c = kanvas.getContext('2d');
    c.clearRect(0, 0, 1024, 420);
    c.textAlign = 'center';
    c.fillStyle = '#1a1612';
    c.font = '800 118px Montserrat, Arial, sans-serif';
    c.fillText('iNAURA', 512, 190);
    c.fillStyle = '#b38a4c'; c.fillRect(392, 228, 240, 4);
    c.fillStyle = '#3a332c';
    c.font = '600 40px Montserrat, Arial, sans-serif';
    c.fillText('K E R A T I N   ·   H A I R   C A R E', 512, 300);
    tek.needsUpdate = true;
  }
  gambarLabel();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(gambarLabel);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.905, 0.905, 0.62, 72, 1, true, -Math.PI * 0.55, Math.PI * 1.1),
    new THREE.MeshStandardMaterial({ map: tek, transparent: true, roughness: 0.5, metalness: 0 }));
  label.rotation.y = Math.PI / 2 + Math.PI; // hadap ke kamera saat rotasi 0
  label.position.y = -0.02; jar.add(label);
  scene.add(jar);

  // ── Debu emas ──
  const N = 700, pos = new Float32Array(N * 3), acak = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 18; pos[i * 3 + 1] = (Math.random() - 0.5) * 11; pos[i * 3 + 2] = -6 + Math.random() * 9;
    acak[i] = Math.random();
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const titik = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,236,200,1)'); gr.addColorStop(0.25, 'rgba(235,190,120,.55)'); gr.addColorStop(1, 'rgba(201,160,97,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const debu = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.075, map: titik, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd9a0, opacity: 0.85 }));
  scene.add(debu);


  // ── Manekin + rambut (adegan 3: rambut panjang dipotong → butterfly cut) ──
  // Dilihat dari belakang, seperti foto hasil kerja salon. Tiap helai = garis
  // bertitik: menempel di kulit kepala, lalu jatuh ke bawah. Bentuk "lurus
  // panjang" dan "butterfly" dihitung tiap frame lalu dicampur.
  const rambut = new THREE.Group(); scene.add(rambut);
  const kepala = new THREE.Group(); rambut.add(kepala);
  const RX = 0.78, RY = 0.95, RZ = 0.85, CY = 0.55;
  const tengkorak = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshStandardMaterial({ color: 0x1a110b, roughness: 0.8, transparent: true }));
  tengkorak.scale.set(RX, RY, RZ); tengkorak.position.y = CY; kepala.add(tengkorak);
  const PROFIL = [[0, -2.1], [1.28, -2.1], [1.34, -1.55], [1.22, -1.14], [0.78, -0.93], [0.37, -0.8], [0.3, -0.45], [0.3, -0.1], [0, -0.1]];
  const BZ = 0.55;
  const badan = new THREE.Mesh(new THREE.LatheGeometry(v2(PROFIL), 64),
    new THREE.MeshPhysicalMaterial({ color: 0x4a3a2e, metalness: 0.15, roughness: 0.55, clearcoat: 0.15, clearcoatRoughness: 0.4, sheen: 0.4, sheenColor: new THREE.Color(0xc9a061), transparent: true }));
  badan.scale.z = BZ; kepala.add(badan);
  // Jari-jari badan pada ketinggian y, arah sudut a (badan dipipihkan di sumbu z)
  // Dipanggil puluhan ribu kali per frame → pakai tabel, bukan hitung ulang.
  const TAB_N = 128, TAB_Y0 = 0, TAB_Y1 = -2.8, tabR = new Float32Array(TAB_N);
  for (let j = 0; j < TAB_N; j++) {
    const y = TAB_Y0 + (TAB_Y1 - TAB_Y0) * (j / (TAB_N - 1));
    let r = 0;
    for (let i = 1; i < PROFIL.length - 1; i++) {
      const [r1, y1] = PROFIL[i], [r2, y2] = PROFIL[i + 1];
      if ((y <= y1 && y >= y2) || (y >= y1 && y <= y2)) { r = r1 + (r2 - r1) * ((y - y1) / ((y2 - y1) || 1)); break; }
    }
    if (y < -1.55) r = 1.34;
    tabR[j] = r;
  }
  // fA = faktor arah (badan dipipihkan di sumbu z), dihitung sekali per helai
  function jariBadan(y, fA) {
    let j = Math.round((y - TAB_Y0) / (TAB_Y1 - TAB_Y0) * (TAB_N - 1));
    j = j < 0 ? 0 : (j >= TAB_N ? TAB_N - 1 : j);
    return tabR[j] * fA;
  }

  const NS = (canvas.clientWidth < 760) ? 700 : 1300, K1 = 7, K2 = 18, KP = K1 + K2, SEG = KP - 1;
  const helai = [];
  for (let i = 0; i < NS; i++) {
    const phi = (Math.random() * 2 - 1) * Math.PI;
    const depan = Math.abs(phi) > 2.15;
    const t0 = 0.06 + Math.sqrt(Math.random()) * 1.22;
    const lf = t0 / 1.28;
    helai.push({
      phi, t0, lf, depan,
      tD: 1.95 - 0.32 * (Math.abs(phi) / Math.PI),
      lapis: 1.03 + 0.06 * (1 - lf) + Math.random() * 0.015,
      L: 2.2 + 0.35 * Math.cos(phi) + Math.random() * 0.18 - (depan ? 0.2 : 0),   // ujung melengkung U
      untai: (Math.round(phi * 15) / 15 - phi) * 0.8,                            // helai berkelompok jadi untaian
      jatuhX: (Math.random() - 0.5) * 0.35, jatuhV: 0.8 + Math.random() * 0.5,
      punyaEkor: Math.random() < 0.35,   // tidak semua helai menjatuhkan potongan
      fA: 1 / Math.sqrt(Math.sin(phi) ** 2 + (Math.cos(phi) ** 2) / (BZ * BZ)),
      Lb: (depan ? 0.38 + 0.25 * lf : 0.5 + 0.85 * lf) + Math.random() * 0.09,
      ikal: lf < 0.48 ? 1 : -1,
      vol: 0.8 + Math.random() * 0.4,
      seed: Math.random() * 10,
      dipotong: -1,
    });
  }
  const posR = new Float32Array(NS * SEG * 6), warR = new Float32Array(NS * SEG * 6);
  const ekorN = 5, posE = new Float32Array(NS * (ekorN - 1) * 6), warE = new Float32Array(NS * (ekorN - 1) * 6), warE0 = new Float32Array(NS * (ekorN - 1) * 6);
  const cAkar = new THREE.Color(0x1f130b), cTengah = new THREE.Color(0x5a3a20), cUjung = new THREE.Color(0xb88a55), cKilau = new THREE.Color(0xe8c287);
  const cc = new THREE.Color();
  helai.forEach((h, i) => {
    const kilau = Math.random() < 0.2;
    const terang = 0.5 + 0.6 * Math.max(0, Math.cos(h.phi + 0.45)) + 0.25 * (1 - h.lf);
    for (let k = 0; k < KP; k++) {
      const s = k / (KP - 1);
      if (s < 0.4) cc.copy(cAkar).lerp(cTengah, s / 0.4); else cc.copy(cTengah).lerp(kilau ? cKilau : cUjung, (s - 0.4) / 0.6);
      cc.multiplyScalar(terang);
      const w = (v) => {
        if (k < KP - 1) { const o = (i * SEG + k) * 6; warR[o] = cc.r; warR[o + 1] = cc.g; warR[o + 2] = cc.b; }
        if (k > 0) { const o = (i * SEG + k - 1) * 6 + 3; warR[o] = cc.r; warR[o + 1] = cc.g; warR[o + 2] = cc.b; }
      };
      w();
    }
    for (let j = 0; j < (ekorN - 1) * 2; j++) { const o = (i * (ekorN - 1) * 2 + j) * 3; cc.copy(kilau ? cKilau : cUjung).multiplyScalar(terang); warE[o] = cc.r; warE[o + 1] = cc.g; warE[o + 2] = cc.b; }
  });
  warE0.set(warE);
  const gR = new THREE.BufferGeometry();
  gR.setAttribute('position', new THREE.BufferAttribute(posR, 3).setUsage(THREE.DynamicDrawUsage));
  gR.setAttribute('color', new THREE.BufferAttribute(warR, 3));
  const garisRambut = new THREE.LineSegments(gR, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92 }));
  garisRambut.frustumCulled = false; kepala.add(garisRambut);
  const gE = new THREE.BufferGeometry();
  gE.setAttribute('position', new THREE.BufferAttribute(posE, 3).setUsage(THREE.DynamicDrawUsage));
  gE.setAttribute('color', new THREE.BufferAttribute(warE, 3).setUsage(THREE.DynamicDrawUsage));
  const ekor = new THREE.LineSegments(gE, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }));
  ekor.frustumCulled = false; kepala.add(ekor);

  const P = new Float32Array(KP * 3);
  function bentukHelai(h, len, m, t) {
    // bagian di kulit kepala
    for (let k = 0; k < K1; k++) {
      const th = h.t0 + (h.tD - h.t0) * (k / (K1 - 1)), r = h.lapis;
      P[k * 3] = RX * r * Math.sin(th) * Math.sin(h.phi);
      P[k * 3 + 1] = CY + RY * r * Math.cos(th);
      P[k * 3 + 2] = RZ * r * Math.sin(th) * Math.cos(h.phi);
    }
    const dx = P[(K1 - 1) * 3], dy = P[(K1 - 1) * 3 + 1], dz = P[(K1 - 1) * 3 + 2];
    const r0 = Math.hypot(dx, dz) || 0.001, ux = dx / r0, uz = dz / r0;
    for (let k = 1; k <= K2; k++) {
      const u = k / K2, idx = (K1 - 1 + k) * 3;
      const radS = r0 + 0.05 * u, yS = dy - len * u;
      const k2 = Math.max(0, (u - 0.55) / 0.45);
      let radB = r0 + (0.1 * u + 0.15 * u * u) * h.vol + h.ikal * 0.17 * k2 * k2 + 0.025 * Math.sin(u * 5 + h.seed) * u;
      const yB = dy - len * u + 0.22 * k2 * k2 * len;
      let rad = radS + (radB - radS) * m;
      const y = yS + (yB - yS) * m;
      rad = Math.max(rad, jariBadan(y, h.fA) + 0.04);
      // untaian + gelombang lembut (gelombang hanya di bentuk butterfly)
      const dl = h.untai * u * (1 + 0.4 * m) + m * 0.05 * Math.sin(u * 4.5 + h.seed) * u;
      const cs = Math.cos(dl), sn = Math.sin(dl);
      P[idx] = (ux * cs + uz * sn) * rad; P[idx + 1] = y; P[idx + 2] = (uz * cs - ux * sn) * rad;
    }
    return { dy, r0, ux, uz };
  }
  function tulisHelai(i) {
    const o0 = i * SEG * 6;
    for (let k = 0; k < SEG; k++) {
      const o = o0 + k * 6, a = k * 3, b = (k + 1) * 3;
      posR[o] = P[a]; posR[o + 1] = P[a + 1]; posR[o + 2] = P[a + 2];
      posR[o + 3] = P[b]; posR[o + 4] = P[b + 1]; posR[o + 5] = P[b + 2];
    }
  }
  const vTmp = new THREE.Vector3();
  let uLama = -1, adaEkor = false;
  const BAWAH = -2.15;   // potongan menghilang di balik bawah badan, tidak menutupi teks
  // u: kemajuan adegan 0..1 → hasil: sudut gunting (null kalau tidak memotong)
  function animasiRambut(u, t, now) {
    const pot = THREE.MathUtils.smoothstep(u, 0.12, 0.55);   // sapuan potong
    const m = THREE.MathUtils.smoothstep(u, 0.58, 0.86);     // styling butterfly
    const phiC = -Math.PI + 2 * Math.PI * pot;
    // Bentuk rambut hanya bergantung pada u: kalau u tidak berubah dan tidak ada
    // potongan yang sedang jatuh, buffer tidak perlu dihitung ulang.
    if (Math.abs(u - uLama) < 1e-5 && !adaEkor) return (u > 0.06 && u < 0.62) ? phiC : null;
    uLama = u; adaEkor = false;
    for (let i = 0; i < NS; i++) {
      const h = helai[i];
      const harusPotong = pot > 0 && h.phi < phiC;
      if (harusPotong && h.dipotong < 0) h.dipotong = now;
      if (!harusPotong) h.dipotong = -1;
      const len = h.dipotong >= 0 ? h.Lb : h.L;
      const d = bentukHelai(h, len, m, t);
      tulisHelai(i);
      // potongan yang jatuh (sebagian helai saja), memudar lalu hilang
      const o0 = i * (ekorN - 1) * 6;
      const dt = h.dipotong >= 0 ? now - h.dipotong : 99;
      const hidup = h.punyaEkor && dt < 1.1 && !diam;
      if (hidup) {
        adaEkor = true;
        const jatuh = 2.6 * h.jatuhV * dt * dt + 0.2 * dt, pudar = 1 - dt / 1.1;
        for (let k = 0; k < ekorN - 1; k++) {
          for (let e = 0; e < 2; e++) {
            const uu = (k + e) / (ekorN - 1);
            const ll = h.Lb + (h.L - h.Lb) * uu;
            const y = d.dy - ll - jatuh;
            const rad = Math.max(d.r0 + 0.05 * (ll / h.L), jariBadan(d.dy - ll, h.fA) + 0.04) + 0.18 * dt;
            const o = o0 + k * 6 + e * 3;
            if (y < BAWAH) { posE[o] = posE[o + 1] = posE[o + 2] = 0; continue; }
            posE[o] = d.ux * rad + h.jatuhX * dt; posE[o + 1] = y; posE[o + 2] = d.uz * rad;
            warE[o] = warE0[o] * pudar; warE[o + 1] = warE0[o + 1] * pudar; warE[o + 2] = warE0[o + 2] * pudar;
          }
        }
      } else if (posE[o0 + 1] !== 0 || posE[o0 + 4] !== 0) {
        for (let k = 0; k < (ekorN - 1) * 6; k++) posE[o0 + k] = 0;
      }
    }
    gR.attributes.position.needsUpdate = true;
    gE.attributes.position.needsUpdate = true;
    gE.attributes.color.needsUpdate = true;
    return (u > 0.06 && u < 0.62) ? phiC : null;
  }

  // ── Kunci adegan: [x, y, z, skala, rx, ry, rz] relatif terhadap jangkar ──
  const K = {
    gunting: [[3, 2.6, -3, 0, 0.3, 0.6, -0.8], [-0.9, 0.55, 0, 0.82, 0.35, 0.5, -0.55], [-0.3, 0.05, 0.8, 1.18, 0.15, -0.25, 0.42], [-1.9, 1.5, 0.6, 0.42, 0.3, 0.2, -0.6], [2.6, 2.3, -2.5, 0.45, 0.6, 1.2, 0.2], [-1.55, 1.6, 0.4, 0.42, 0.4, 0.3, -1.0]],
    sisir: [[2.5, -3, -2, 0, 0.4, 0.2, 0.9], [1.0, -0.75, -0.4, 0.82, 0.45, 0.25, 0.85], [2.8, -2.4, -2.5, 0.35, 0.8, 0.6, 1.4], [3.5, -3, -3, 0, 0.8, 0.6, 1.4], [3.5, -3, -3, 0, 0.8, 0.6, 1.4], [3.5, -3, -3, 0, 0.8, 0.6, 1.4]],
    jar: [[1.5, 2, -4, 0, 0.2, 0, 0], [2.3, 1.55, -2.2, 0.46, 0.25, -0.4, 0.12], [3, 1.2, -3.5, 0.3, 0.3, 0, 0.2], [3.4, 1.6, -4, 0, 0.3, 0, 0.2], [0, -0.15, 0.6, 1.3, 0.22, 0, 0], [-4.2, 0.6, -3, 0, 0.2, 0, 0]],
  };
  const tmp = [0, 0, 0, 0, 0, 0, 0];
  function ambil(arr, p) {
    const i = Math.min(Math.floor(p), arr.length - 2), t = p - i;
    for (let k = 0; k < 7; k++) tmp[k] = arr[i][k] + (arr[i + 1][k] - arr[i][k]) * t;
    return tmp;
  }

  let W = 1, H = 1, hp = false, jx = 0, jy = 0, skalaLayar = 1, sH = 1, hy = 0;
  function ukur() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    hp = W < 760;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hp ? 1.5 : 1.75));
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const halfW = halfH * camera.aspect;
    if (hp) { jx = 0; jy = halfH * 0.36; skalaLayar = Math.min(1, halfW / 2.6) * 0.82; sH = Math.min(0.56, halfW / 2.7); hy = halfH * 0.46; }
    else { jx = halfW * 0.42; jy = 0; skalaLayar = Math.min(1.1, halfW / 5.4); sH = Math.min(0.95, halfH / 3.3); hy = 0.1; }
  }
  ukur();
  window.addEventListener('resize', ukur);

  let mx = 0, my = 0, rx = 0, ry = 0;
  window.addEventListener('pointermove', (e) => { mx = (e.clientX / innerWidth) * 2 - 1; my = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });

  function tata(obj, kunci, p, t, ekstra) {
    const k = ambil(kunci, p);
    const s = k[3] * skalaLayar;
    obj.visible = s > 0.01;
    if (!obj.visible) return;
    obj.position.set(jx + k[0] * skalaLayar, jy + k[1] * skalaLayar + Math.sin(t * 0.9 + ekstra) * 0.06, k[2]);
    obj.scale.setScalar(s);
    // Goyang bolak-balik, bukan berputar penuh — kalau berputar, gunting & sisir
    // sesekali terlihat dari samping dan tinggal garis tipis.
    obj.rotation.set(k[4] + Math.sin(t * 0.5 + ekstra) * 0.06, k[5] + (diam ? 0 : Math.sin(t * 0.32 + ekstra) * 0.42), k[6] + Math.sin(t * 0.27 + ekstra) * 0.05);
  }

  const jam = new THREE.Clock();
  let jalan = true;
  document.addEventListener('visibilitychange', () => { jalan = !document.hidden; if (jalan) loop(); });
  function loop() {
    if (!jalan) return;
    requestAnimationFrame(loop);
    const st = window.RR_STORY || { p: 0, aktif: true };
    if (!st.aktif) return;
    const t = diam ? 0 : jam.getElapsedTime(), p = st.p;

    tata(gunting, K.gunting, p, t, 1);
    tata(sisir, K.sisir, p, t, 2.2);
    tata(jar, K.jar, p, t, 4.1);
    // Adegan 2 (the craft): gunting menggunting pelan
    const wCraft = Math.max(0, 1 - Math.abs(p - 2) * 1.4);
    let buka = 0.12 + 0.3 * (1 - wCraft) * Math.min(1, p) + wCraft * (0.18 + 0.2 * (0.5 + 0.5 * Math.sin(t * 2.4)));
    if (wCraft > 0) gunting.rotation.y += wCraft * Math.sin(t * 0.4) * 0.35;
    // Adegan 3: potong rambut → butterfly
    const wH = Math.max(0, 1 - Math.abs(p - 3) * 1.25);
    rambut.visible = wH > 0.03;
    if (rambut.visible) {
      const u = (st.prog && st.prog[3]) || (p > 3 ? 1 : 0);
      const e = THREE.MathUtils.smoothstep(wH, 0, 1);
      rambut.position.set(jx, hy + 0.5 * sH, (1 - e) * -1);
      rambut.scale.setScalar(sH * (0.9 + 0.1 * e));
      garisRambut.material.opacity = 0.92 * e; ekor.material.opacity = 0.9 * e;
      tengkorak.material.opacity = e; badan.material.opacity = e;
      kepala.rotation.y = -0.55 + u * 1.1 + (diam ? 0 : Math.sin(t * 0.5) * 0.06);
      kepala.rotation.x = 0.08;
      const phiC = animasiRambut(u, t, jam.elapsedTime);
      if (phiC !== null) {
        // gunting mengelilingi kepala di garis potong
        vTmp.set(Math.sin(phiC) * 1.5, -0.62, Math.cos(phiC) * 1.5 * (RZ / RX));
        kepala.localToWorld(vTmp);
        const b = THREE.MathUtils.smoothstep(u, 0.06, 0.13) * (1 - THREE.MathUtils.smoothstep(u, 0.55, 0.62)) * e;
        gunting.visible = true;
        gunting.position.lerp(vTmp, b);
        gunting.scale.setScalar(gunting.scale.x + (0.58 * sH - gunting.scale.x) * b);
        gunting.rotation.set(0.1, phiC + kepala.rotation.y + Math.PI, 0.12);
        buka = buka * (1 - b) + b * (0.1 + 0.32 * (0.5 + 0.5 * Math.sin(t * 16)));
      }
    }
    pa.rotation.z = buka / 2; pb.rotation.z = -buka / 2;
    // Adegan 4 (Inaura): tutup jar terangkat
    const wJar = Math.max(0, 1 - Math.abs(p - 4) * 1.6);
    tutup.position.y = wJar * 0.42; tutup.rotation.y = wJar * 0.6;
    jar.rotation.y = (diam ? 0 : t * 0.35) - 0.2;

    debu.rotation.y = t * 0.02 + p * 0.25;
    debu.position.y = (t * 0.05) % 1 - p * 0.4;

    rx += (my * 0.12 - rx) * 0.05; ry += (mx * 0.18 - ry) * 0.05;
    camera.position.x = ry * 1.2; camera.position.y = -rx * 0.8;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  loop();
}

try { mulai(); } catch (e) { if (canvas) canvas.style.display = 'none'; console.warn('[rr3d]', e); }
