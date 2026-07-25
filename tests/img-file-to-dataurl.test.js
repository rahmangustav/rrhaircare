import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

// Bug yang diperbaiki: fileToDataURL() (public/js/img.js) dipakai admin.js &
// checkout.html untuk mengubah file gambar (produk/galeri/foto situs/QRIS/
// bukti bayar) jadi data URL sebelum diunggah. Sebelumnya, kalau file gagal
// dibaca/didekode (mis. bukan gambar sungguhan meski lolos accept="image/*",
// atau file rusak), Promise-nya ditolak dengan objek Event mentah dari
// img.onerror/reader.onerror -- BUKAN Error. Setiap pemanggil yang menangkap
// error lalu menampilkan `e.message` (checkout.html, dan hampir semua
// pemanggil di admin.js) jadi menampilkan teks "undefined" ke pengguna,
// bukan pesan yang jelas. Satu pemanggil (pratinjau galeri di admin.js)
// bahkan tidak punya try/catch sama sekali -> unhandled promise rejection,
// gagal total diam-diam tanpa feedback apa pun ke admin.
//
// public/js/img.js dimuat sebagai <script> biasa (bukan ES module) supaya
// bisa dipakai langsung dari HTML tanpa bundler, jadi tidak bisa di-`import`
// langsung di sini. Dijalankan lewat vm dengan mock minimal Image/FileReader/
// document.createElement('canvas') yang meniru API yang benar-benar dipakai
// fileToDataURL().

const imgJsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../public/js/img.js');
const imgJsSource = readFileSync(imgJsPath, 'utf8');

function loadFileToDataURL({ readerFails = false, imageFails = false } = {}) {
  class FakeFileReader {
    readAsDataURL() {
      queueMicrotask(() => {
        if (readerFails) this.onerror && this.onerror(new Event('error'));
        else { this.result = 'data:image/png;base64,ZmFrZQ=='; this.onload && this.onload(); }
      });
    }
  }
  class FakeImage {
    set src(_v) {
      queueMicrotask(() => {
        if (imageFails) this.onerror && this.onerror(new Event('error'));
        else { this.width = 800; this.height = 600; this.onload && this.onload(); }
      });
    }
  }
  const fakeCanvas = {
    width: 0, height: 0,
    getContext: () => ({ drawImage: () => {} }),
    toDataURL: () => 'data:image/jpeg;base64,cmVzaXplZA==',
  };
  const sandbox = {
    Event, Promise, Math, Error,
    FileReader: FakeFileReader,
    Image: FakeImage,
    document: { createElement: () => fakeCanvas },
  };
  vm.createContext(sandbox);
  vm.runInContext(imgJsSource, sandbox);
  return sandbox.fileToDataURL;
}

test('file kosong -> resolve string kosong, tidak reject', async () => {
  const fileToDataURL = loadFileToDataURL();
  assert.equal(await fileToDataURL(null), '');
});

test('file valid -> resolve data URL hasil resize', async () => {
  const fileToDataURL = loadFileToDataURL();
  const url = await fileToDataURL({ name: 'foto.jpg' });
  assert.match(url, /^data:image\/jpeg;base64,/);
});

test('FileReader gagal baca file -> reject dengan Error berpesan jelas, bukan Event mentah', async () => {
  const fileToDataURL = loadFileToDataURL({ readerFails: true });
  await assert.rejects(
    () => fileToDataURL({ name: 'rusak.jpg' }),
    (err) => {
      assert.ok(err instanceof Error, 'harus berupa Error, bukan Event mentah');
      assert.ok(err.message && err.message !== 'undefined', `pesan error harus jelas, dapat: ${err.message}`);
      return true;
    }
  );
});

test('file bukan gambar valid (Image gagal decode) -> reject dengan Error berpesan jelas', async () => {
  const fileToDataURL = loadFileToDataURL({ imageFails: true });
  await assert.rejects(
    () => fileToDataURL({ name: 'bukan-gambar.txt' }),
    (err) => {
      assert.ok(err instanceof Error, 'harus berupa Error, bukan Event mentah');
      assert.ok(err.message && err.message !== 'undefined', `pesan error harus jelas, dapat: ${err.message}`);
      return true;
    }
  );
});
