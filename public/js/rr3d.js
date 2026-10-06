// Objek 3D untuk bagian "story" landing RR Hair Care (three.js, tanpa model
// eksternal — semua dibangun dari geometri dasar supaya ringan dan gratis).
// Posisi adegan dibaca dari window.RR_STORY.p (0..4) yang ditulis js/rr.js.
//   0 pembuka (video salon) · 1 signature (alat melayang) · 2 the craft (gunting)
//   3 Inaura (jar) · 4 booking (cincin cahaya, CSS) — debu emas di semua adegan.
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

  // ── Kunci adegan: [x, y, z, skala, rx, ry, rz] relatif terhadap jangkar ──
  const K = {
    gunting: [[3, 2.6, -3, 0, 0.3, 0.6, -0.8], [-0.9, 0.55, 0, 0.82, 0.35, 0.5, -0.55], [-0.3, 0.05, 0.8, 1.18, 0.15, -0.25, 0.42], [2.6, 2.3, -2.5, 0.45, 0.6, 1.2, 0.2], [-1.55, 1.6, 0.4, 0.42, 0.4, 0.3, -1.0]],
    sisir: [[2.5, -3, -2, 0, 0.4, 0.2, 0.9], [1.0, -0.75, -0.4, 0.82, 0.45, 0.25, 0.85], [2.8, -2.4, -2.5, 0.35, 0.8, 0.6, 1.4], [3.5, -3, -3, 0, 0.8, 0.6, 1.4], [3.5, -3, -3, 0, 0.8, 0.6, 1.4]],
    jar: [[1.5, 2, -4, 0, 0.2, 0, 0], [2.3, 1.55, -2.2, 0.46, 0.25, -0.4, 0.12], [3, 1.2, -3.5, 0.3, 0.3, 0, 0.2], [0, -0.15, 0.6, 1.3, 0.22, 0, 0], [-2.5, -2.5, -2, 0, 0.2, 0, 0]],
  };
  const tmp = [0, 0, 0, 0, 0, 0, 0];
  function ambil(arr, p) {
    const i = Math.min(Math.floor(p), arr.length - 2), t = p - i;
    for (let k = 0; k < 7; k++) tmp[k] = arr[i][k] + (arr[i + 1][k] - arr[i][k]) * t;
    return tmp;
  }

  let W = 1, H = 1, hp = false, jx = 0, jy = 0, skalaLayar = 1;
  function ukur() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    hp = W < 760;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hp ? 1.5 : 1.75));
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const halfW = halfH * camera.aspect;
    if (hp) { jx = 0; jy = halfH * 0.36; skalaLayar = Math.min(1, halfW / 2.6) * 0.82; }
    else { jx = halfW * 0.42; jy = 0; skalaLayar = Math.min(1.1, halfW / 5.4); }
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
    const buka = 0.12 + 0.3 * (1 - wCraft) * Math.min(1, p) + wCraft * (0.18 + 0.2 * (0.5 + 0.5 * Math.sin(t * 2.4)));
    pa.rotation.z = buka / 2; pb.rotation.z = -buka / 2;
    if (wCraft > 0) gunting.rotation.y += wCraft * Math.sin(t * 0.4) * 0.35;
    // Adegan 3 (Inaura): tutup jar terangkat
    const wJar = Math.max(0, 1 - Math.abs(p - 3) * 1.6);
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
