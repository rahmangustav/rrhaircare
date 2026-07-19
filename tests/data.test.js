// Test unit untuk fungsi murni di netlify/lib/data.js — auth (password/token),
// klasifikasi sumber pengunjung, dan parser CSV daftar harga. Semuanya logika
// yang tidak menyentuh Netlify Blobs, jadi bisa diuji tanpa jaringan/mock store.
// Jalankan: node --test tests/
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword, verifyPassword,
  signToken, verifyToken,
  classifySource,
  parsePricelistCsv,
} from '../netlify/lib/data.js';

describe('hashPassword / verifyPassword', () => {
  test('password yang benar terverifikasi', () => {
    const stored = hashPassword('admin123');
    assert.equal(verifyPassword('admin123', stored), true);
  });

  test('password yang salah ditolak', () => {
    const stored = hashPassword('admin123');
    assert.equal(verifyPassword('salah', stored), false);
  });

  test('setiap hash pakai salt berbeda meski password sama', () => {
    const a = hashPassword('sama-sama');
    const b = hashPassword('sama-sama');
    assert.notEqual(a, b);
    assert.equal(verifyPassword('sama-sama', a), true);
    assert.equal(verifyPassword('sama-sama', b), true);
  });

  test('stored kosong atau tanpa pemisah ":" ditolak, bukan dilempar error', () => {
    assert.equal(verifyPassword('apa saja', ''), false);
    assert.equal(verifyPassword('apa saja', null), false);
    assert.equal(verifyPassword('apa saja', 'tanpa-pemisah'), false);
  });
});

describe('signToken / verifyToken', () => {
  const secret = 'rahasia-uji';

  test('token yang baru ditandatangani valid', () => {
    const token = signToken(secret, 12);
    assert.equal(verifyToken(token, secret), true);
  });

  test('token dengan secret yang salah ditolak', () => {
    const token = signToken(secret, 12);
    assert.equal(verifyToken(token, 'secret-lain'), false);
  });

  test('token yang sudah kedaluwarsa ditolak', () => {
    const token = signToken(secret, -1); // exp di masa lalu
    assert.equal(verifyToken(token, secret), false);
  });

  test('payload yang diutak-atik (signature tak cocok) ditolak', () => {
    const token = signToken(secret, 12);
    const [, sig] = token.split('.');
    const payloadPalsu = Buffer.from(JSON.stringify({ exp: Date.now() + 999e9 })).toString('base64url');
    assert.equal(verifyToken(payloadPalsu + '.' + sig, secret), false);
  });

  test('token kosong atau tanpa titik pemisah ditolak', () => {
    assert.equal(verifyToken('', secret), false);
    assert.equal(verifyToken('tanpa-titik', secret), false);
  });

  test('payload bukan JSON valid ditolak tanpa melempar error', () => {
    const badPayload = Buffer.from('bukan-json').toString('base64url');
    assert.equal(verifyToken(badPayload + '.somesig', secret), false);
  });
});

describe('classifySource', () => {
  test('alias kampanye dikenal → nama kanal baku', () => {
    assert.equal(classifySource('', 'yt'), 'YouTube');
    assert.equal(classifySource('', 'YT'), 'YouTube');
    assert.equal(classifySource('', 'ig'), 'Instagram');
    assert.equal(classifySource('', 'wa'), 'WhatsApp');
    assert.equal(classifySource('', 'fb'), 'Facebook');
    assert.equal(classifySource('', 'tiktok'), 'TikTok');
    assert.equal(classifySource('', 'tt'), 'TikTok');
  });

  test('kampanye tak dikenal dikapitalisasi apa adanya', () => {
    assert.equal(classifySource('', 'newsletter'), 'Newsletter');
  });

  test('tanpa referrer maupun kampanye → Langsung', () => {
    assert.equal(classifySource('', ''), 'Langsung');
  });

  test('referrer dikenali dari host', () => {
    assert.equal(classifySource('https://www.youtube.com/watch?v=x'), 'YouTube');
    assert.equal(classifySource('https://m.instagram.com/p/x'), 'Instagram');
    assert.equal(classifySource('https://www.google.com/search?q=rr'), 'Google Penelusuran');
    assert.equal(classifySource('https://l.instagram.com/'), 'Instagram');
  });

  test('host tak dikenal dipakai apa adanya (dipotong 60 karakter)', () => {
    assert.equal(classifySource('https://blog-tetangga.example/artikel'), 'blog-tetangga.example');
  });

  test('referrer bukan URL valid → Langsung, bukan error', () => {
    assert.equal(classifySource('bukan-url'), 'Langsung');
  });

  test('navigasi internal (referrer = situs sendiri) tidak dihitung', () => {
    assert.equal(classifySource('https://rrhaircare.id/toko', '', 'rrhaircare.id'), '');
    assert.equal(classifySource('https://www.rrhaircare.id/toko', '', 'rrhaircare.id'), '');
  });

  test('kampanye menang atas referrer', () => {
    assert.equal(classifySource('https://www.google.com/search', 'yt'), 'YouTube');
  });
});

describe('parsePricelistCsv', () => {
  test('teks kosong menghasilkan daftar kosong', () => {
    assert.deepEqual(parsePricelistCsv(''), []);
    assert.deepEqual(parsePricelistCsv(null), []);
  });

  test('format tak dikenali (kolom wajib hilang) menghasilkan daftar kosong', () => {
    const csv = 'A,B,C\n1,2,3';
    assert.deepEqual(parsePricelistCsv(csv), []);
  });

  // Format asli ekspor POS: Indonesia — titik ribuan, koma desimal (mis. "150.000,00").
  test('parsing baris standar dengan harga & durasi', () => {
    const csv = [
      'Type,Treatment Name,Group Name,Item Name,Retail Price,Special Price,Duration',
      'Service,Hair Spa,Hair Care,Hair Spa Reguler,"150.000,00","",60 menit',
    ].join('\n');
    const out = parsePricelistCsv(csv);
    assert.equal(out.length, 1);
    assert.equal(out[0].name, 'Hair Spa Reguler');
    assert.equal(out[0].category, 'Hair Spa'); // kategori = Treatment Name, Group Name cuma fallback
    assert.equal(out[0].price, 150000);
    assert.equal(out[0].promo, 0);
    assert.equal(out[0].duration, '60 menit');
  });

  test('harga promo hanya dipakai bila positif dan lebih murah dari harga normal', () => {
    const csv = [
      'Type,Treatment Name,Group Name,Item Name,Retail Price,Special Price,Duration',
      'Service,Coloring,Hair Color,Coloring Full,"300.000,00","200.000,00",',
      'Service,Coloring,Hair Color,Coloring Aneh,"300.000,00","999.000,00",',
    ].join('\n');
    const out = parsePricelistCsv(csv);
    assert.equal(out[0].promo, 200000); // promo lebih murah → dipakai
    assert.equal(out[1].promo, 0);      // "promo" lebih mahal → diabaikan
  });

  test('baris tanpa nama item atau harga <= 0 dilewati', () => {
    const csv = [
      'Type,Treatment Name,Group Name,Item Name,Retail Price,Special Price,Duration',
      'Service,X,Y,,100000,,',
      'Service,X,Y,Item Gratis,0,,',
      'Service,X,Y,Item Sah,50000,,',
    ].join('\n');
    const out = parsePricelistCsv(csv);
    assert.equal(out.length, 1);
    assert.equal(out[0].name, 'Item Sah');
  });

  test('kategori Package dipaksa jadi "Paket Layanan"', () => {
    const csv = [
      'Type,Treatment Name,Group Name,Item Name,Retail Price,Special Price,Duration',
      'Package,Apa Saja,Grup Lain,Paket Bulanan,500000,,',
    ].join('\n');
    const out = parsePricelistCsv(csv);
    assert.equal(out[0].category, 'Paket Layanan');
  });

  test('kategori "Coloring" diganti jadi "Coloring & Highlight"', () => {
    const csv = [
      'Type,Treatment Name,Group Name,Item Name,Retail Price,Special Price,Duration',
      'Service,Coloring,Hair Color,Full Color,250000,,',
    ].join('\n');
    const out = parsePricelistCsv(csv);
    assert.equal(out[0].category, 'Coloring & Highlight');
  });

  test('field berisi koma di dalam tanda kutip diparse utuh', () => {
    const csv = [
      'Type,Treatment Name,Group Name,Item Name,Retail Price,Special Price,Duration',
      'Service,Spa,Hair Care,"Spa, Pijat, dan Masker",120000,,',
    ].join('\n');
    const out = parsePricelistCsv(csv);
    assert.equal(out[0].name, 'Spa, Pijat, dan Masker');
  });

  test('entitas HTML pada nama didekode', () => {
    const csv = [
      'Type,Treatment Name,Group Name,Item Name,Retail Price,Special Price,Duration',
      'Service,X,Y,"Smoothing &amp; Rebonding",200000,,',
    ].join('\n');
    const out = parsePricelistCsv(csv);
    assert.equal(out[0].name, 'Smoothing & Rebonding');
  });
});
