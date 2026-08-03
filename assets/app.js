(function () {
  const h = React.createElement;
  const { useEffect, useMemo, useRef, useState } = React;
  const API_BASE = normalizeApiBase(window.APP_CONFIG?.apiBase || document.querySelector('meta[name="app-api-base"]')?.getAttribute('content') || '../api');
  const SUPPORTED_EXTENSIONS = ['xlsx', 'xls', 'xml', 'csv', 'txt'];
  const EXTENSION_LABELS = { xlsx: 'XLSX', xls: 'XLS/XML', xml: 'XML', csv: 'CSV', txt: 'TXT' };
  const PAGE_SIZE = 50;
  const LINK_PROCESS_OPTIONS = [
    'Data',
    'Persiapan dan asesmen',
    'Monitoring dan evaluasi',
    'Rujukan terminasi',
    'Koordinasi lapangan',
    'Regulasi dan panduan',
    'Pelaporan',
    'Lainnya',
  ];
  const DEFAULT_ABOUT_TITLE = 'Tentang Project CPNS Padan Data KAT';
  const DEFAULT_ABOUT_SUMMARY = 'Ruang kerja untuk membaca persebaran KAT, memadankan BNBA, dan menjaga arsip operasional agar mudah dipakai ulang.';
  const DISTRIBUTION_DOCUMENT_FIELDS = [
    ['doc_surat_usulan_kadis', 'Surat Usulan Kadis', 'FileText'],
    ['doc_rekomendasi_bupati', 'Rekomendasi Bupati', 'BadgeCheck'],
    ['doc_pemetaan_sosial', 'Hasil Pemetaan Sosial', 'Map'],
    ['doc_bnba_pusdatin', 'BNBA Format Pusdatin', 'FileSpreadsheet'],
    ['doc_status_lahan', 'Status Lahan Clean & Clear', 'LandPlot'],
    ['doc_instrumen_skoring_pa', 'Instrumen Skoring PA', 'ClipboardCheck'],
    ['doc_laporan_studi_kelayakan', 'Laporan Studi Kelayakan', 'NotebookTabs'],
    ['doc_bnba_clear_padan', 'BNBA Clear Padan', 'TableProperties'],
    ['doc_ktp_kk_kpm', 'KTP dan KK Calon KPM', 'ContactRound'],
  ];
  const DEFAULT_ABOUT_HTML = `
    <h2>Project CPNS untuk kerja data KAT yang lebih tertata</h2>
    <p>Platform ini disiapkan sebagai ruang kerja operasional untuk membaca persebaran Komunitas Adat Terpencil, melakukan padan data BNBA, memantau hasil pengecekan, dan menyimpan arsip tautan kerja yang sudah dikurasi.</p>
    <h3>Fokus utama</h3>
    <ul>
      <li>Menyatukan peta wilayah, upload Excel, hasil padan data, dan arsip link dalam satu alur kerja.</li>
      <li>Membantu pengguna menelusuri proses data dari input, pengecekan, hasil, sampai riwayat job.</li>
      <li>Menjaga agar referensi kerja penting tidak tercecer melalui approval admin dan pinned link archive.</li>
    </ul>
    <h3>Arah pengembangan</h3>
    <p>Sistem ini terus diarahkan menjadi workspace yang mudah dipakai di lapangan, tetap rapi untuk administrasi, dan cukup fleksibel untuk berpindah sumber data ketika infrastruktur berubah.</p>
    <blockquote>Konten ini adalah template awal. Admin dapat mengubahnya dari panel Admin melalui editor halaman About.</blockquote>
  `;
  let publicRuntimeConfig = {};

  function normalizeApiBase(value) {
    const raw = String(value || '../api').trim() || '../api';
    try {
      return new URL(raw.replace(/\/+$/, ''), window.location.href).toString().replace(/\/+$/, '');
    } catch (_) {
      return new URL('../api', window.location.href).toString().replace(/\/+$/, '');
    }
  }

  function apiUrl(path) {
    return `${API_BASE}/${String(path).replace(/^\/+/, '')}`;
  }

  function queryValueFromUrl(url, key) {
    try {
      return new URL(String(url || ''), window.location.href).searchParams.get(key) || '';
    } catch (_) {
      return '';
    }
  }

  function shortlinkParamName() {
    const param = String(publicRuntimeConfig.shortlink_query_param || window.APP_CONFIG?.shortlinkParam || 's').replace(/[^A-Za-z0-9_]/g, '');
    return param || 's';
  }

  function shortlinkPathPrefix() {
    const prefix = String(publicRuntimeConfig.shortlink_path_prefix || window.APP_CONFIG?.shortlinkPathPrefix || 's').replace(/[^A-Za-z0-9_\-/]/g, '').replace(/^\/+|\/+$/g, '');
    return prefix || 's';
  }

  function shortCodeFromText(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const direct = raw.replace(/[^A-Za-z0-9]/g, '');
    if (/^[A-Za-z0-9]{6,24}$/.test(raw) || (!/[?:/#]/.test(raw) && direct)) {
      return direct.slice(0, 24);
    }
    try {
      const url = new URL(raw, window.location.href);
      return String(url.searchParams.get(shortlinkParamName()) || url.searchParams.get('s') || url.searchParams.get('code') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 24);
    } catch (_) {
      return raw.replace(/[^A-Za-z0-9]/g, '').slice(0, 24);
    }
  }

  function shortCodeFromLocation() {
    const query = currentQuery();
    return shortCodeFromText(query.get(shortlinkParamName()) || query.get('s') || query.get('code') || '');
  }

  function shortRedirectCodeFromPath(pathname) {
    const prefixParts = shortlinkPathPrefix().split('/').filter(Boolean).map(part => part.toLowerCase());
    const parts = String(pathname || '').split('/').filter(Boolean);
    if (!prefixParts.length || parts.length < prefixParts.length + 1) return '';
    for (let start = 0; start <= parts.length - prefixParts.length - 1; start += 1) {
      const matches = prefixParts.every((part, idx) => String(parts[start + idx] || '').toLowerCase() === part);
      if (matches) {
        return String(parts[start + prefixParts.length] || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 24);
      }
    }
    return '';
  }

  function shortRedirectCodeFromLocation() {
    const query = currentQuery();
    const pathFrom404 = query.get('short_path') || query.get('path') || '';
    return shortRedirectCodeFromPath(pathFrom404) || shortRedirectCodeFromPath(window.location.pathname || '');
  }

  function jobShortUrl(job) {
    const explicit = String(job?.short_url || '').trim();
    if (explicit) return explicit;
    const code = shortCodeFromText(job?.short_code || '');
    if (!code) return '';
    let base = String(publicRuntimeConfig.frontend_base_url || window.APP_CONFIG?.frontendBase || window.location.origin + window.location.pathname).replace(/\/+$/, '');
    if (/^https?:\/\/[^/]+$/i.test(base)) base += '/';
    const separator = base.includes('?') ? '&' : '?';
    const params = new URLSearchParams({ [shortlinkParamName()]: code });
    return `${base}${separator}${params.toString()}`;
  }

  function archiveShortUrl(link) {
    const explicit = String(link?.short_url || '').trim();
    if (explicit) return explicit;
    const code = shortCodeFromText(link?.short_code || '');
    if (!code) return '';
    const base = String(publicRuntimeConfig.frontend_base_url || window.APP_CONFIG?.frontendBase || window.location.origin).replace(/\/+$/, '');
    return `${base}/${shortlinkPathPrefix()}/${encodeURIComponent(code)}`;
  }

  function resultDownloadUrl(job, file = 'package', adminKey = '') {
    const id = String(job?.id || '').trim();
    const token = String(job?.download_token || queryValueFromUrl(job?.result_file_url, 'token') || '').trim();
    if (id && (adminKey || token)) {
      const query = new URLSearchParams({ type: 'result', id });
      if (file) query.set('file', file);
      if (adminKey) query.set('key', adminKey);
      else query.set('token', token);
      return apiUrl(`download.php?${query.toString()}`);
    }

    if (job?.result_file_url) {
      const url = new URL(String(job.result_file_url), window.location.href);
      if (file && file !== 'package') url.searchParams.set('file', file);
      return url.toString();
    }
    return '#';
  }

  function currentQuery() {
    return new URLSearchParams(window.location.search || '');
  }

  function readInitialTab() {
    const query = currentQuery();
    if (shortCodeFromLocation()) return 'padan';
    if (query.get('admin') === '1') return 'admin';
    if (query.get('about') === '1') return 'about';
    if (query.get('archive') === '1' || query.get('links') === '1') return 'links';
    if (query.get('padan') === '1' || query.get('upload') === '1') return 'padan';
    return 'home';
  }

  function tabQuery(tab) {
    if (tab === 'admin') return '?admin=1';
    if (tab === 'about') return '?about=1';
    if (tab === 'links') return '?links=1';
    if (tab === 'padan') return '?upload=1';
    return window.location.pathname || '';
  }

  function useDesignMotion() {
    useEffect(() => {
      const root = document.documentElement;
      const hero = document.querySelector('.hero-pin');
      const reduceQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      const pointerQuery = window.matchMedia?.('(pointer: coarse)');
      const viewportQuery = window.matchMedia?.('(max-width: 760px)');
      let reduce = prefersReducedMotion();
      let constrained = shouldLimitHeavyMotion();
      let rect = hero?.getBoundingClientRect();
      let frame = 0;
      let nextX = 0;
      let nextY = 0;
      let pointerFrame = 0;
      let pointerTarget = null;
      let pointerEvent = null;

      function refreshCapabilities() {
        applyMotionCapabilityClasses();
        reduce = prefersReducedMotion();
        constrained = shouldLimitHeavyMotion();
      }

      function refreshRect() {
        rect = hero?.getBoundingClientRect();
      }

      function writeCursor() {
        frame = 0;
        root.style.setProperty('--cursor-x', nextX.toFixed(3));
        root.style.setProperty('--cursor-y', nextY.toFixed(3));
      }

      function move(event) {
        if (!hero || !rect || (hasCoarsePointer() && event.pointerType !== 'mouse')) return;
        nextX = ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
        nextY = ((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
        if (!frame) frame = window.requestAnimationFrame(writeCursor);
      }

      function resetCursor() {
        nextX = 0;
        nextY = 0;
        if (!frame) frame = window.requestAnimationFrame(writeCursor);
      }

      function interactiveFromEvent(event) {
        return event.target?.closest?.('button, a, .location-card, .stat-card, .link-card, .result-download-link, .source-pill-button');
      }

      function writeInteractivePointer() {
        pointerFrame = 0;
        const target = pointerTarget;
        const event = pointerEvent;
        if (!target || !event || (hasCoarsePointer() && event.pointerType !== 'mouse')) return;
        const box = target.getBoundingClientRect();
        if (!box.width || !box.height) return;
        const x = ((event.clientX - box.left) / box.width) * 100;
        const y = ((event.clientY - box.top) / box.height) * 100;
        const tiltY = ((x - 50) / 50) * 3.2;
        const tiltX = ((50 - y) / 50) * 2.4;
        const magnetX = ((x - 50) / 50) * 4.5;
        const magnetY = ((y - 50) / 50) * 3.5;
        target.style.setProperty('--spot-x', `${Math.max(0, Math.min(100, x)).toFixed(1)}%`);
        target.style.setProperty('--spot-y', `${Math.max(0, Math.min(100, y)).toFixed(1)}%`);
        target.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`);
        target.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
        target.style.setProperty('--magnet-x', `${magnetX.toFixed(2)}px`);
        target.style.setProperty('--magnet-y', `${magnetY.toFixed(2)}px`);
      }

      function moveInteractive(event) {
        const target = interactiveFromEvent(event);
        if (!target || (hasCoarsePointer() && event.pointerType !== 'mouse')) return;
        pointerTarget = target;
        pointerEvent = event;
        if (!pointerFrame) pointerFrame = window.requestAnimationFrame(writeInteractivePointer);
      }

      function leaveInteractive(event) {
        const target = interactiveFromEvent(event);
        if (!target) return;
        target.style.setProperty('--spot-x', '50%');
        target.style.setProperty('--spot-y', '50%');
        target.style.setProperty('--tilt-x', '0deg');
        target.style.setProperty('--tilt-y', '0deg');
        target.style.setProperty('--magnet-x', '0px');
        target.style.setProperty('--magnet-y', '0px');
        pointerTarget = null;
        pointerEvent = null;
      }

      function randomizeDockMark(event) {
        const letter = event.target?.closest?.('.dock-mark-stack span');
        if (!letter || (hasCoarsePointer() && event.pointerType !== 'mouse')) return;
        const jitter = (min, max, unit = '') => `${(min + Math.random() * (max - min)).toFixed(2)}${unit}`;
        letter.style.setProperty('--kat-x', jitter(-0.28, 0.28, 'rem'));
        letter.style.setProperty('--kat-y', jitter(-0.24, 0.24, 'rem'));
        letter.style.setProperty('--kat-r', jitter(-8, 8, 'deg'));
        letter.style.setProperty('--kat-dur', jitter(0.76, 1.22, 's'));
        letter.style.setProperty('--kat-delay', jitter(-0.44, 0.12, 's'));
      }

      refreshCapabilities();
      if (!constrained) {
        if (window.Splitting) window.Splitting({ target: '.hero-title[data-splitting]' });
        else splitTitleFallback();
      }

      hero?.addEventListener('pointerenter', refreshRect, { passive: true });
      hero?.addEventListener('pointermove', move, { passive: true });
      hero?.addEventListener('pointerleave', resetCursor, { passive: true });
      document.addEventListener('pointermove', moveInteractive, { passive: true });
      document.addEventListener('pointerover', randomizeDockMark, true);
      document.addEventListener('pointerleave', leaveInteractive, true);
      document.addEventListener('pointerout', leaveInteractive, true);
      window.addEventListener('resize', refreshRect, { passive: true });
      window.addEventListener('scroll', refreshRect, { passive: true });
      reduceQuery?.addEventListener?.('change', refreshCapabilities);
      pointerQuery?.addEventListener?.('change', refreshCapabilities);
      viewportQuery?.addEventListener?.('change', refreshCapabilities);

      function cleanupMotionListeners(ctx = null) {
        if (frame) window.cancelAnimationFrame(frame);
        if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
        hero?.removeEventListener('pointerenter', refreshRect);
        hero?.removeEventListener('pointermove', move);
        hero?.removeEventListener('pointerleave', resetCursor);
        document.removeEventListener('pointermove', moveInteractive);
        document.removeEventListener('pointerover', randomizeDockMark, true);
        document.removeEventListener('pointerleave', leaveInteractive, true);
        document.removeEventListener('pointerout', leaveInteractive, true);
        window.removeEventListener('resize', refreshRect);
        window.removeEventListener('scroll', refreshRect);
        reduceQuery?.removeEventListener?.('change', refreshCapabilities);
        pointerQuery?.removeEventListener?.('change', refreshCapabilities);
        viewportQuery?.removeEventListener?.('change', refreshCapabilities);
        ctx?.revert?.();
      }

      if (reduce || !window.gsap) {
        return () => cleanupMotionListeners();
      }

      const gsap = window.gsap;

      const ctx = gsap.context(() => {
        if (constrained) {
          gsap.from('.hero-title', {
            y: 16,
            opacity: 0,
            duration: 0.68,
            ease: 'power3.out',
            force3D: true,
          });
        } else {
          gsap.from('.hero-title .char', {
            yPercent: 92,
            opacity: 0,
            rotateX: -42,
            transformOrigin: '50% 100%',
            duration: 0.78,
            ease: 'expo.out',
            stagger: 0.012,
            delay: 0.08,
            force3D: true,
          });
        }
        gsap.from('.hero-kicker, .hero-copy, .hero-actions', {
          y: 18,
          opacity: 0,
          duration: 0.74,
          ease: 'power3.out',
          stagger: 0.06,
          delay: constrained ? 0.08 : 0.22,
          force3D: true,
        });
      });

      return () => {
        cleanupMotionListeners(ctx);
      };
    }, []);
  }

  function splitTitleFallback() {
    const title = document.querySelector('.hero-title[data-splitting]');
    if (!title || title.querySelector('.char')) return;
    const words = String(title.textContent || '').split(/(\s+)/);
    title.textContent = '';
    words.forEach(part => {
      if (/^\s+$/.test(part)) {
        title.appendChild(document.createTextNode(part));
        return;
      }
      const word = document.createElement('span');
      word.className = 'word';
      Array.from(part).forEach(letter => {
        const char = document.createElement('span');
        char.className = 'char';
        char.textContent = letter;
        word.appendChild(char);
      });
      title.appendChild(word);
    });
  }

  function frontendApiTimeoutMs() {
    return Number(publicRuntimeConfig.api_request_timeout_ms || window.APP_CONFIG?.apiRequestTimeoutMs || 45000);
  }

  function frontendUploadTimeoutMs() {
    return Number(publicRuntimeConfig.upload_request_timeout_ms || window.APP_CONFIG?.uploadRequestTimeoutMs || 120000);
  }

  function invalidApiPayloadMessage(raw, status, context = 'API') {
    const body = String(raw || '').trim();
    if (body.startsWith('<?php')) {
      return `${context} menerima source code PHP (${status}). Backend sedang disajikan oleh server statis; jalankan melalui PHP/hosting backend atau arahkan apiBase ke backend aktif.`;
    }
    if (/^<!doctype html|^<html/i.test(body)) {
      return `${context} menerima halaman HTML, bukan JSON (${status}). Periksa apiBase dan konfigurasi rewrite backend.`;
    }
    return `${context} tidak mengembalikan JSON valid (${status}).`;
  }

  async function parseJsonResponse(response) {
    const raw = await response.text().catch(() => '');
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch (_) {
      const error = new Error(invalidApiPayloadMessage(raw, response.status));
      error.status = response.status;
      error.data = {};
      throw error;
    }
    if (!response.ok || !data?.ok) {
      const error = new Error(errorMessage(data, response.status));
      error.status = response.status;
      error.data = data || {};
      throw error;
    }
    return data;
  }

  function errorMessage(data, status) {
    const base = data?.error || `Request gagal (${status})`;
    const remediation = String(data?.remediation || '').trim();
    const retryAfter = Number(data?.retry_after_seconds || 0);
    const message = remediation && !base.includes(remediation) ? `${base} Solusi: ${remediation}` : base;
    if (!retryAfter) return message;
    const label = retryAfter >= 60 ? `${Math.ceil(retryAfter / 60)} menit` : `${Math.ceil(retryAfter)} detik`;
    return `${message} Coba lagi sekitar ${label}.`;
  }

  function freshApiUrl(path) {
    const url = new URL(apiUrl(path), window.location.href);
    url.searchParams.set('_fresh', `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    if (window.APP_VERSION) url.searchParams.set('_v', String(window.APP_VERSION));
    return url.toString();
  }

  async function apiRequest(path, options = {}, settings = {}) {
    const timeoutMs = Math.max(0, Number(settings.timeoutMs ?? frontendApiTimeoutMs()));
    const method = String(options.method || 'GET').toUpperCase();
    const url = method === 'GET' ? freshApiUrl(path) : apiUrl(path);
    const headers = { ...(options.headers || {}) };
    const requestOptions = { cache: 'no-store', mode: 'cors', ...options, headers };
    if (!timeoutMs) return parseJsonResponse(await fetch(url, requestOptions));
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await parseJsonResponse(await fetch(url, { ...requestOptions, signal: controller.signal }));
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`Request terlalu lama (${Math.round(timeoutMs / 1000)} detik).`);
      }
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function uploadFormWithProgress(url, form, onProgress, headers = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      Object.entries(headers || {}).forEach(([key, value]) => xhr.setRequestHeader(key, value));
      xhr.timeout = Math.max(0, frontendUploadTimeoutMs());
      xhr.upload.onprogress = event => {
        if (event.lengthComputable) onProgress?.(Math.max(0, Math.min(99, Math.round((event.loaded / event.total) * 100))));
      };
      xhr.onload = () => {
        let data = null;
        try {
          data = JSON.parse(xhr.responseText || 'null');
        } catch (_) {
          reject(new Error(invalidApiPayloadMessage(xhr.responseText, xhr.status, 'Upload')));
          return;
        }
        if (xhr.status < 200 || xhr.status >= 300 || !data?.ok) {
          const error = new Error(errorMessage(data, xhr.status));
          error.status = xhr.status;
          error.data = data || {};
          reject(error);
          return;
        }
        onProgress?.(100);
        resolve(data);
      };
      xhr.onerror = () => reject(new Error('Upload gagal karena jaringan.'));
      xhr.ontimeout = () => reject(new Error('Upload terlalu lama.'));
      xhr.send(form);
    });
  }

  function cx(...items) {
    return items.filter(Boolean).join(' ');
  }

  function compactNumber(value) {
    const number = Number(value || 0);
    return new Intl.NumberFormat('id-ID', { notation: Math.abs(number) >= 10000 ? 'compact' : 'standard' }).format(number);
  }

  function fullNumber(value) {
    const number = Number(value || 0);
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(number);
  }

  function numberValue(value) {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? number : 0;
  }

  function effectiveHouseholds(row) {
    return numberValue(row?.effective_households_total ?? row?.households_total ?? 0);
  }

  function distributionHouseholds(row) {
    return numberValue(row?.distribution_households_total ?? row?.households_spread ?? row?.['PERSEBARAN KK'] ?? 0);
  }

  function bnbaHouseholds(row) {
    return numberValue(row?.bnba_households_total ?? row?.bnba_summary?.kk_unique ?? 0);
  }

  function householdMetrics(row) {
    const distribution = distributionHouseholds(row);
    const bnba = bnbaHouseholds(row);
    const effective = effectiveHouseholds(row) || (bnba > 0 ? bnba : distribution);
    const source = row?.households_effective_source || (bnba > 0 ? 'bnba' : (distribution > 0 ? 'distribution' : 'empty'));
    const delta = numberValue(row?.households_delta_bnba_distribution ?? (bnba > 0 && distribution > 0 ? bnba - distribution : 0));
    return { effective, distribution, bnba, source, delta };
  }

  function householdSourceLabel(source) {
    if (source === 'bnba') return 'By padan';
    if (source === 'distribution') return 'By Excel/persebaran';
    return 'Belum ada angka KK';
  }

  function householdSummaryText(row) {
    const metrics = householdMetrics(row);
    const diffText = metrics.delta ? `, selisih ${metrics.delta > 0 ? '+' : ''}${fullNumber(metrics.delta)}` : '';
    return `KK by Excel ${fullNumber(metrics.distribution)} / KK by padan ${fullNumber(metrics.bnba)}${diffText}. Angka final memakai padan kalau ada, bukan dijumlah.`;
  }

  function prefersReducedMotion() {
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }

  function hasCoarsePointer() {
    return Boolean(window.matchMedia?.('(pointer: coarse)').matches);
  }

  function isSmallViewport() {
    return Boolean(window.matchMedia?.('(max-width: 760px)').matches);
  }

  function isLowPowerDevice() {
    const cores = Number(navigator.hardwareConcurrency || 8);
    const memory = Number(navigator.deviceMemory || 8);
    return cores <= 4 || memory <= 4;
  }

  function shouldLimitHeavyMotion() {
    return prefersReducedMotion() || hasCoarsePointer() || isSmallViewport() || isLowPowerDevice();
  }

  function applyMotionCapabilityClasses() {
    const root = document.documentElement;
    root.classList.toggle('is-reduced-motion', prefersReducedMotion());
    root.classList.toggle('is-touch', hasCoarsePointer());
    root.classList.toggle('is-low-power', isLowPowerDevice());
  }

  function Icon({ name, size = 18, strokeWidth = 2.4, className = '', ...props }) {
    const icons = window.LucideReact || {};
    const Component = icons[name];
    if (!Component) {
      return h('span', { className: cx('inline-block shrink-0', className), style: { width: size, height: size }, 'aria-hidden': 'true' });
    }
    return h(Component, { size, strokeWidth, className: cx('shrink-0', className), 'aria-hidden': 'true', ...props });
  }

  function useHeroShader(canvasRef) {
    useEffect(() => {
      let shader = null;
      let cancelled = false;
      const canvas = canvasRef.current;
      if (!canvas || shouldLimitHeavyMotion() || !navigator.gpu) {
        canvas?.classList.add('is-fallback');
        return undefined;
      }

      async function start() {
        if (cancelled || shader || typeof window.createKatHeroShader !== 'function') return;
        try {
          shader = await window.createKatHeroShader(canvas);
          if (cancelled) shader?.destroy?.();
        } catch (error) {
          canvas.classList.add('is-fallback');
          console.debug?.('[shader] hero fallback', error?.message || error);
        }
      }

      start();
      window.addEventListener('kat-shaders-ready', start, { once: true });
      return () => {
        cancelled = true;
        window.removeEventListener('kat-shaders-ready', start);
        shader?.destroy?.();
      };
    }, [canvasRef]);
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T');
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (!value) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    return `${(value / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
  }

  function linkHost(url) {
    try {
      return new URL(String(url || ''), window.location.href).hostname.replace(/^www\./, '') || 'link';
    } catch (_) {
      return 'link';
    }
  }

  function normalizeLinkProcess(value) {
    return String(value || '').trim() || 'Lainnya';
  }

  function linkProcessOptions(links = [], serverOptions = []) {
    const seen = new Set();
    const out = [];
    [...LINK_PROCESS_OPTIONS, ...(serverOptions || []), ...(links || []).map(link => link.process_context)].forEach(item => {
      const label = normalizeLinkProcess(item);
      const key = normalizeName(label);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(label);
    });
    return out;
  }

  function linkStatusLabel(status) {
    return status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending';
  }

  function displayColumnName(column) {
    const labels = {
      source_data: 'Sumber data',
      data_year: 'Tahun masuk',
      province: 'Provinsi',
      regency: 'Kab/Kota',
      region_code: 'Kode wilayah',
      district: 'Kecamatan/Distrik',
      village: 'Desa',
      location: 'Lokasi',
      tribe: 'Suku/Komunitas',
      households_spread: 'Persebaran KK',
      sync_year: 'Tahun sinkron Dukcapil',
      households_total: 'KK final',
      effective_households_total: 'KK final',
      distribution_households_total: 'KK by Excel',
      bnba_households_total: 'KK by padan',
      is_proposed: 'Pengusulan',
      notes: 'Catatan',
      row_hash: 'Hash baris',
    };
    const key = String(column || '');
    return labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  }

  function sourceName(value) {
    return String(value || '').trim() || 'Tanpa sumber';
  }

  function dataStoreSourceMeta(mode, label = '') {
    const key = String(mode || '').trim().toLowerCase();
    const labels = {
      supabase: 'Supabase',
      mysql: 'MySQL',
      sheets: 'Google Sheets',
      json: 'Big JSON',
    };
    const icons = {
      supabase: 'DatabaseZap',
      mysql: 'Database',
      sheets: 'Sheet',
      json: 'FileJson2',
    };
    const tones = {
      supabase: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      mysql: 'bg-sky-50 text-sky-700 ring-sky-200',
      sheets: 'bg-lime-50 text-lime-700 ring-lime-200',
      json: 'bg-violet-50 text-violet-700 ring-violet-200',
    };
    return {
      key,
      label: String(label || labels[key] || (key ? key.toUpperCase() : 'Memuat')).trim(),
      icon: icons[key] || 'CircleHelp',
      tone: tones[key] || 'bg-slate-50 text-slate-600 ring-slate-200',
    };
  }

  function DataStoreSourceBadge({ mode, label, prefix = 'Data', warning = '', className = '' }) {
    const meta = dataStoreSourceMeta(mode, label);
    const title = warning ? `${prefix}: ${meta.label}. ${warning}` : `${prefix}: ${meta.label}`;
    return h('span', {
      className: cx('inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ring-1', meta.tone, className),
      title,
    }, h(Icon, { name: meta.icon, size: 13 }), h('span', { className: 'truncate' }, `${prefix}: ${meta.label}`));
  }

  function sourceFromRow(row) {
    return sourceName(row?.source_data ?? row?.['SUMBER DATA'] ?? row?.sumber ?? row?.source ?? '');
  }

  function sourceBreakdownFromRows(rows) {
    const map = new Map();
    (rows || []).forEach(row => {
      const source = sourceFromRow(row);
      const metrics = householdMetrics(row);
      const current = map.get(source) || { source_data: source, rows: 0, households_total: 0, effective_households_total: 0, distribution_households_total: 0, bnba_households_total: 0, households_delta_bnba_distribution: 0 };
      current.rows += 1;
      current.households_total += metrics.effective || numberValue(row?.['JUMLAH KK']);
      current.effective_households_total += metrics.effective || numberValue(row?.['JUMLAH KK']);
      current.distribution_households_total += metrics.distribution;
      current.bnba_households_total += metrics.bnba;
      current.households_delta_bnba_distribution += metrics.delta;
      map.set(source, current);
    });
    return Array.from(map.values()).sort((a, b) => b.rows - a.rows);
  }

  function identityDigits(value) {
    return String(value || '').replace(/\D+/g, '');
  }

  function normalizeName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
  }

  function legacyBnbaScopeKey(item) {
    return [
      item?.province,
      item?.regency,
      item?.district,
      item?.village,
      item?.location,
      item?.community_name,
      item?.job_id,
    ].map(value => normalizeName(value)).join('|');
  }

  function regionMatchKey(value) {
    let text = normalizeName(value)
      .replace(/\((NTB|NTT|DKI|DIY|NAD)\)/g, ' ')
      .replace(/\bPROVINSI\b|\bKABUPATEN\b|\bKAB\b|\bKOTA\b|\bKECAMATAN\b|\bKEC\b|\bDISTRIK\b|\bDESA\b|\bKELURAHAN\b|\bKAMPUNG\b/g, ' ')
      .replace(/[^\w]+/g, '');
    const aliases = {
      NTB: 'NUSATENGGARABARAT',
      NUSATENGGARABARATNTB: 'NUSATENGGARABARAT',
      NTT: 'NUSATENGGARATIMUR',
      NUSATENGGARATIMURNTT: 'NUSATENGGARATIMUR',
      DIY: 'DIYOGYAKARTA',
      DKI: 'DKIJAKARTA',
    };
    return aliases[text] || text;
  }

  function compatibleRegionText(left, right) {
    const a = regionMatchKey(left);
    const b = regionMatchKey(right);
    return !a || !b || a === b || a.includes(b) || b.includes(a);
  }

  function sameLocationScope(left, right) {
    return ['province', 'regency', 'district', 'village', 'location', 'community_name'].every(key => compatibleRegionText(left?.[key], right?.[key]));
  }

  function legacyBnbaGroupsToLocationItems(rows) {
    const locationGroups = new Map();
    rows.forEach(row => {
      const key = legacyBnbaScopeKey(row);
      if (!locationGroups.has(key)) locationGroups.set(key, []);
      locationGroups.get(key).push(row);
    });
    return Array.from(locationGroups.values()).map(groupRows => {
      const first = groupRows[0] || {};
      const kkGroups = new Map();
      groupRows.forEach(row => {
        const groupKey = [
          normalizeName(row.title || row.person_name),
          normalizeName(row.address),
          normalizeName(row.village),
        ].join('|');
        if (!kkGroups.has(groupKey)) {
          kkGroups.set(groupKey, { ...row, jumlah_input: 0, failed_rows: 0, checked_rows: 0 });
        }
        const current = kkGroups.get(groupKey);
        current.jumlah_input += 1;
        if (String(row.status || '') === 'failed') current.failed_rows += 1;
        else current.checked_rows += 1;
      });
      const tableRows = Array.from(kkGroups.values()).map(row => ({
        jenis: Number(row.jumlah_input || 0) > 1 ? 'duplikat' : 'unik',
        nomor_kk: row.kk_last4 ? `****${row.kk_last4}` : '-',
        nama_kepala_keluarga: row.title || row.person_name || '-',
        jumlah_input: row.jumlah_input || 0,
        desil: row.desil || '',
        percentile: row.percentile || '',
        jumlah_anggota_keluarga: '',
        pekerjaan_kepala_keluarga: '',
        alamat: row.address || '',
        hasil_cek: row.result_status || row.status || '',
      }));
      const checkedRows = groupRows.filter(row => String(row.status || '') !== 'failed').length;
      const failedRows = groupRows.length - checkedRows;
      const duplicateGroups = tableRows.filter(row => row.jenis === 'duplikat').length;
      const locationTitle = [
        first.community_name,
        first.location || first.village,
        first.district,
      ].filter(Boolean).join(' - ') || 'Lokasi BNBA';
      return {
        type: 'distribution',
        title: locationTitle,
        status: 'persebaran',
        province: first.province || null,
        regency: first.regency || null,
        district: first.district || null,
        village: first.village || null,
        location: first.location || null,
        community_name: first.community_name || null,
        source_data: 'Upload BNBA',
        households_total: tableRows.length,
        effective_households_total: tableRows.length,
        distribution_households_total: 0,
        bnba_households_total: tableRows.length,
        households_effective_source: tableRows.length > 0 ? 'bnba' : 'empty',
        households_delta_bnba_distribution: 0,
        checked_at: first.checked_at || null,
        bnba_summary: {
          has_bnba: tableRows.length > 0,
          input_rows: groupRows.length,
          checked_rows: checkedRows,
          failed_rows: failedRows,
          no_kk_rows: 0,
          kk_unique: tableRows.length,
          kk_single: tableRows.length - duplicateGroups,
          kk_duplicate: duplicateGroups,
          duplicate_rows: tableRows.reduce((sum, row) => sum + (row.jenis === 'duplikat' ? Number(row.jumlah_input || 0) : 0), 0),
          latest_job_id: first.job_id || 0,
          latest_job_name: 'Upload BNBA',
          legacy_grouped_from_bnba_rows: true,
        },
        bnba_rows: tableRows,
        bnba_jobs: first.job_id ? [{ id: first.job_id, filename: 'Upload BNBA', status: 'completed', completed_at: first.checked_at || null }] : [],
      };
    });
  }

  function normalizeMapDataPayload(payload) {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const distributionItems = items.filter(item => !item?.type || item.type === 'distribution');
    const legacyBnbaItems = items.filter(item => item?.type === 'bnba');
    if (!legacyBnbaItems.length) {
      return { ...payload, items: distributionItems };
    }
    const merged = distributionItems.map(item => ({ ...item }));
    legacyBnbaGroupsToLocationItems(legacyBnbaItems).forEach(groupItem => {
      const existing = merged.find(item => sameLocationScope(item, groupItem));
      if (!existing) {
        merged.push(groupItem);
        return;
      }
      existing.bnba_summary = groupItem.bnba_summary;
      existing.bnba_rows = groupItem.bnba_rows;
      existing.bnba_jobs = groupItem.bnba_jobs;
      existing.bnba_households_total = groupItem.bnba_households_total;
      const distributionTotal = distributionHouseholds(existing) || effectiveHouseholds(existing);
      if (Number(groupItem.bnba_households_total || 0) > 0) {
        existing.households_total = groupItem.bnba_households_total || 0;
        existing.effective_households_total = groupItem.bnba_households_total || 0;
        existing.households_effective_source = 'bnba';
        existing.households_delta_bnba_distribution = distributionTotal > 0 ? Number(groupItem.bnba_households_total || 0) - distributionTotal : 0;
      } else if (!Number(existing.households_total || 0)) {
        existing.households_total = groupItem.bnba_households_total || 0;
        existing.effective_households_total = groupItem.bnba_households_total || 0;
        existing.households_effective_source = 'empty';
      }
    });
    return { ...payload, items: merged };
  }

  function fileExt(name) {
    return String(name || '').split('.').pop()?.toLowerCase() || '';
  }

  function isSupportedFile(file, extensions = SUPPORTED_EXTENSIONS) {
    return file && extensions.includes(fileExt(file.name));
  }

  function supportedLabel(extensions = SUPPORTED_EXTENSIONS) {
    return extensions.map(ext => EXTENSION_LABELS[ext] || ext.toUpperCase()).join(', ');
  }

  function allowedEmailDomains(config) {
    return Array.isArray(config?.allowed_email_domains) ? config.allowed_email_domains : ['gmail.com'];
  }

  function emailPlaceholder(config) {
    const domain = allowedEmailDomains(config).find(item => item !== '*') || 'example.com';
    return `nama@${domain.replace(/^\*\./, '')}`;
  }

  function emailHint(config) {
    const domains = allowedEmailDomains(config);
    return domains.includes('*') ? 'Semua domain email diizinkan.' : `Domain: ${domains.map(item => item.replace(/^\*\./, '')).join(', ')}.`;
  }

  function defaultNikColumn(sheet) {
    const columns = sheet?.columns || [];
    const fromServer = (sheet?.nik_candidates || [])[0]?.column;
    return columns.includes(fromServer) ? fromServer : (columns.find(col => /\bnik\b|nomor induk/i.test(col)) || columns[0] || '');
  }

  function defaultKkColumn(sheet) {
    const columns = sheet?.columns || [];
    return columns.find(col => {
      const text = String(col || '').replace(/[_\-\/]+/g, ' ');
      return /(^|\b)(no|nomor)\s*kk\b|\bkartu keluarga\b/i.test(text) && !/\burut\b|\bjumlah\b|\banggota\b|\bjiwa\b|\bkepala\b|\bnama\b/i.test(text);
    }) || columns.find(col => {
      const text = String(col || '').replace(/[_\-\/]+/g, ' ');
      return /\bkk\b|\bkartu keluarga\b/i.test(text) && !/\burut\b|\bjumlah\b|\banggota\b|\bjiwa\b|\bkepala\b|\bnama\b/i.test(text);
    }) || '';
  }

  function basicExcelSummary(sheet) {
    return sheet?.basic_summary && typeof sheet.basic_summary === 'object' ? sheet.basic_summary : null;
  }

  function nikStats(rows, column) {
    let sample = 0;
    let valid = 0;
    for (const row of rows || []) {
      const text = String(row?.[column] ?? '').trim();
      if (!text) continue;
      sample += 1;
      if (/^\d{16}$/.test(identityDigits(text))) valid += 1;
    }
    return { sample, valid };
  }

  function buildSheetConfig(sheet, previous = {}, enabled = false) {
    const columns = sheet?.columns || [];
    return {
      enabled: previous.enabled ?? enabled,
      nik_column: columns.includes(previous.nik_column) ? previous.nik_column : defaultNikColumn(sheet),
      kk_column: columns.includes(previous.kk_column) ? previous.kk_column : defaultKkColumn(sheet),
      header_row_index: Number.isInteger(previous.header_row_index) ? previous.header_row_index : (Number.isInteger(sheet?.header_row_index) ? sheet.header_row_index : null),
    };
  }

  function Button({ children, variant = 'primary', className, ...props }) {
    const variants = {
      primary: 'bg-slate-950 text-white hover:bg-slate-800 disabled:bg-slate-300 shadow-sm',
      blue: 'bg-blue-600 text-white font-extrabold hover:bg-blue-700 disabled:bg-blue-200 shadow-sm',
      success: 'bg-emerald-600 text-white font-extrabold hover:bg-emerald-700 disabled:bg-emerald-200 shadow-sm',
      danger: 'bg-rose-600 text-white font-extrabold hover:bg-rose-700 disabled:bg-rose-200 shadow-sm',
      purple: 'bg-purple-700 text-white font-black hover:bg-purple-800 disabled:bg-purple-300 shadow-md border border-purple-800/50',
      amber: 'bg-amber-600 text-white font-black hover:bg-amber-700 disabled:bg-amber-200 shadow-md border border-amber-700/50',
      soft: 'bg-white text-slate-800 font-extrabold ring-1 ring-slate-300 hover:bg-slate-100 disabled:text-slate-300 shadow-xs',
      ghost: 'bg-transparent text-slate-700 font-extrabold hover:bg-slate-100',
    };
    const compact = /\bh-(8|9)\b/.test(className || '');
    return h('button', {
      ...props,
      'data-ui-button': '',
      'data-button-variant': variant,
      className: cx('ui-button inline-flex h-11 items-center justify-center rounded-2xl px-5 text-xs font-black transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-purple-200 disabled:cursor-not-allowed cursor-pointer', compact && 'ui-button--compact', variants[variant] || variants.primary, className),
    }, children);
  }

  function TextInput(props) {
    return h('input', {
      ...props,
      className: cx('h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition-colors duration-150 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100', props.className),
    });
  }

  function optionLabel(children) {
    if (Array.isArray(children)) return children.map(optionLabel).join('');
    if (React.isValidElement(children)) return optionLabel(children.props.children);
    return children === null || children === undefined ? '' : String(children);
  }

  function collectSelectOptions(children) {
    const options = [];
    function walk(nodes) {
      React.Children.forEach(nodes, child => {
        if (!child) return;
        if (Array.isArray(child)) return walk(child);
        if (React.isValidElement(child) && child.type === 'option') {
          const label = optionLabel(child.props.children);
          options.push({
            key: child.key || `${options.length}-${child.props.value ?? label}`,
            value: String(child.props.value ?? label),
            label,
            disabled: Boolean(child.props.disabled),
            meta: child.props.meta || null,
            subtitle: child.props.subtitle || '',
          });
          return;
        }
        if (React.isValidElement(child) && child.props?.children) {
          walk(child.props.children);
        }
      });
    }
    walk(children);
    return options;
  }

  function SelectInput({
    children,
    className,
    value = '',
    onChange,
    disabled = false,
    name,
    searchable = false,
    onSearch,
    onSelectOption,
    searchPlaceholder = 'Cari pilihan...',
    allowCustom = false,
    customOptionLabel = text => `Gunakan "${text}"`,
    ...props
  }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const rootRef = useRef(null);
    const onSearchRef = useRef(onSearch);
    const options = collectSelectOptions(children);
    const trimmedSearch = search.trim();
    const filteredOptions = searchable && search && !onSearch
      ? options.filter(option => normalizeName(`${option.label} ${option.subtitle || ''}`).includes(normalizeName(search)))
      : options;
    const customExactMatch = trimmedSearch
      ? options.some(option => {
        const needle = normalizeName(trimmedSearch);
        return normalizeName(option.value) === needle || normalizeName(option.label) === needle;
      })
      : false;
    const canUseCustom = allowCustom && trimmedSearch && !customExactMatch;
    const selected = options.find(option => option.value === String(value)) || options.find(option => option.value === '') || options[0] || { value: '', label: 'Pilih' };
    const displayValue = selected.label || 'Pilih';
    const isPlaceholder = selected.value === '';

    useEffect(() => {
      if (!open) return undefined;
      function close(event) {
        if (!rootRef.current?.contains(event.target)) setOpen(false);
      }
      function onKey(event) {
        if (event.key === 'Escape') setOpen(false);
      }
      document.addEventListener('pointerdown', close);
      document.addEventListener('keydown', onKey);
      return () => {
        document.removeEventListener('pointerdown', close);
        document.removeEventListener('keydown', onKey);
      };
    }, [open]);

    useEffect(() => {
      if (disabled) setOpen(false);
    }, [disabled]);

    useEffect(() => {
      onSearchRef.current = onSearch;
    }, [onSearch]);

    useEffect(() => {
      if (!open) {
        setSearch('');
      }
    }, [open]);

    useEffect(() => {
      if (!open || !onSearch) return undefined;
      const timer = window.setTimeout(() => onSearchRef.current?.(search), 240);
      return () => window.clearTimeout(timer);
    }, [open, search, Boolean(onSearch)]);

    function choose(option) {
      if (disabled || option.disabled) return;
      setOpen(false);
      onChange?.({
        target: { name, value: option.value },
        currentTarget: { name, value: option.value },
      });
      onSelectOption?.(option.meta || option, option);
    }

    function chooseCustom() {
      if (!canUseCustom) return;
      choose({
        value: trimmedSearch,
        label: trimmedSearch,
        meta: {
          name: trimmedSearch,
          value: trimmedSearch,
          custom: true,
        },
      });
    }

    function onTriggerKey(event) {
      if (event.key !== 'ArrowDown' && event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (!disabled) setOpen(current => !current);
    }

    return h('div', {
      ref: rootRef,
      className: cx('select-control', open && 'is-open', disabled && 'is-disabled', className),
      'data-value': String(value || ''),
    },
      name ? h('input', { type: 'hidden', name, value: String(value || '') }) : null,
      h('button', {
        type: 'button',
        disabled,
        className: 'select-trigger',
        'aria-expanded': open ? 'true' : 'false',
        'aria-haspopup': 'listbox',
        onClick: () => !disabled && setOpen(current => !current),
        onKeyDown: onTriggerKey,
        title: displayValue,
      },
        h('span', { className: cx('select-value', isPlaceholder && 'select-placeholder') }, displayValue),
        h('span', { className: 'select-caret', 'aria-hidden': 'true' })
      ),
      open ? h('div', { className: 'select-popover', role: 'listbox' },
        searchable ? h('input', {
          className: 'select-search',
          value: search,
          placeholder: searchPlaceholder,
          autoFocus: true,
          onChange: event => setSearch(event.target.value),
          onKeyDown: event => {
            event.stopPropagation();
            if (event.key === 'Enter' && canUseCustom) {
              event.preventDefault();
              chooseCustom();
            }
          },
        }) : null,
        filteredOptions.length ? filteredOptions.map(option => h('button', {
          key: option.key,
          type: 'button',
          role: 'option',
          disabled: option.disabled,
          'aria-selected': option.value === String(value) ? 'true' : 'false',
          className: cx('select-option', option.value === String(value) && 'is-selected', option.value === '' && 'is-placeholder'),
          onClick: () => choose(option),
          title: option.label,
        },
          h('span', { className: 'select-option-label' }, option.label),
          option.subtitle ? h('span', { className: 'select-option-subtitle' }, option.subtitle) : null
        )) : canUseCustom ? null : h('div', { className: 'select-empty' }, search ? 'Tidak ada pilihan cocok.' : 'Tidak ada pilihan.'),
        canUseCustom ? h('button', {
          type: 'button',
          role: 'option',
          className: 'select-option select-custom-option',
          onClick: chooseCustom,
          title: trimmedSearch,
        },
          h('span', { className: 'select-option-label' }, customOptionLabel(trimmedSearch)),
          h('span', { className: 'select-option-subtitle' }, 'Entry baru, tekan Enter atau klik untuk memakai')
        ) : null
      ) : null
    );
  }

  function TextArea(props) {
    return h('textarea', {
      ...props,
      className: cx('min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition-colors duration-150 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100', props.className),
    });
  }

  function Field({ label, hint, children }) {
    return h('div', { className: 'grid min-w-0 gap-2' },
      h('span', { className: 'text-sm font-black text-slate-800' }, label),
      children,
      hint ? h('span', { className: 'text-xs leading-5 text-slate-500' }, hint) : null
    );
  }

  function FileDropzone({ file, onFile, accept, hint, label = 'Pilih atau jatuhkan file', disabled = false, compact = false }) {
    const inputRef = useRef(null);
    const [dragging, setDragging] = useState(false);

    function choose(nextFile) {
      if (!nextFile || disabled) return;
      onFile(nextFile);
      if (inputRef.current) inputRef.current.value = '';
    }

    function onDrop(event) {
      event.preventDefault();
      event.stopPropagation();
      setDragging(false);
      choose(event.dataTransfer?.files?.[0]);
    }

    function onDrag(event, state) {
      event.preventDefault();
      event.stopPropagation();
      if (!disabled) setDragging(state);
    }

    return h('div', {
      className: cx('upload-zone', dragging && 'is-dragging', disabled && 'is-disabled', compact && 'is-compact'),
      onDragEnter: event => onDrag(event, true),
      onDragOver: event => onDrag(event, true),
      onDragLeave: event => onDrag(event, false),
      onDrop,
    },
      h('input', {
        ref: inputRef,
        type: 'file',
        accept,
        disabled,
        className: 'upload-zone-input',
        onChange: event => choose(event.target.files?.[0]),
      }),
      h('button', {
        type: 'button',
        disabled,
        className: 'upload-zone-button',
        onClick: () => inputRef.current?.click(),
      },
        h('span', { className: 'upload-zone-icon', 'aria-hidden': 'true' }, h(Icon, { name: 'UploadCloud', size: 22 })),
        h('span', { className: 'upload-zone-body' },
          h('strong', { className: 'upload-zone-title' }, file?.name || label),
          h('span', { className: 'upload-zone-meta' }, file ? formatBytes(file.size || 0) : (hint || 'Tarik file ke area ini, atau klik untuk memilih.'))
        )
      )
    );
  }

  function Notice({ message }) {
    if (!message) return null;
    const error = message.type === 'error';
    return h('div', { className: cx('rounded-2xl border p-4 text-sm font-semibold leading-6', error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-blue-200 bg-blue-50 text-blue-800') }, message.text || message);
  }

  function Badge({ children, status = 'slate' }) {
    const tones = {
      checked: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      failed: 'bg-rose-50 text-rose-700 ring-rose-200',
      rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
      pending: 'bg-amber-50 text-amber-700 ring-amber-200',
      queued: 'bg-amber-50 text-amber-700 ring-amber-200',
      processing: 'bg-blue-50 text-blue-700 ring-blue-200',
      cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
      pengusulan: 'bg-violet-50 text-violet-700 ring-violet-200',
      pinned: 'bg-sky-50 text-sky-700 ring-sky-200',
      slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    };
    return h('span', { className: cx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ring-1', tones[status] || tones.slate) }, children);
  }

  function Modal({ title, children, onClose }) {
    return h('div', { className: 'motion-modal-backdrop fixed inset-0 z-[1000] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm' },
      h('div', { className: 'motion-modal w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl' },
        h('div', { className: 'flex items-start justify-between gap-4 border-b border-slate-100 p-5' },
          h('h3', { className: 'text-lg font-black text-slate-950' }, title),
          h('button', { type: 'button', onClick: onClose, className: 'grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200', title: 'Tutup', 'aria-label': 'Tutup' }, h(Icon, { name: 'X', size: 16 }))
        ),
        h('div', { className: 'p-5' }, children)
      )
    );
  }

  function PdfConfirmationModal({ isOpen, filename, rows, existingSources = [], existingDbRows = [], onUpdateField, onApplyBatchSource, onAddRow, onRemoveRow, onSaveDraft, onSubmit, onClose, submitting }) {
    if (!isOpen) return null;

    const allSources = useMemo(() => {
      const set = new Set([
        'DATA PERSEBARAN KAT',
        'PENGUSULAN TIM KERJA PERSIAPAN ASESMEN',
        'SURAT PENGUSULAN DINAS SOSIAL',
        'LAPORAN PERSEBARAN HASIL VERVAL',
      ]);
      if (Array.isArray(existingSources)) {
        existingSources.forEach(s => { if (s && String(s).trim()) set.add(String(s).trim()); });
      }
      if (Array.isArray(rows)) {
        rows.forEach(r => { if (r && r.source_data && String(r.source_data).trim()) set.add(String(r.source_data).trim()); });
      }
      return Array.from(set);
    }, [existingSources, rows]);

    const defaultSource = allSources[0] || 'DATA PERSEBARAN KAT';
    const [batchSource, setBatchSource] = useState(rows?.[0]?.source_data || defaultSource);

    useEffect(() => {
      const firstSource = rows?.[0]?.source_data;
      if (firstSource && !firstSource.startsWith('PDF ')) {
        setBatchSource(firstSource);
      } else if (allSources[0]) {
        setBatchSource(allSources[0]);
      } else {
        setBatchSource('DATA PERSEBARAN KAT');
      }
    }, [filename, rows, allSources]);

    function normalizeLocStr(str) {
      if (!str) return '';
      return String(str)
        .toLowerCase()
        .replace(/^(kab\.?|kabupaten|kota|kec\.?|kecamatan|distrik|desa|kel\.?|kelurahan|dusun|lokasi)\s+/i, '')
        .replace(/[^a-z0-9]/g, '');
    }

    function findDbMatch(r, dbList) {
      if (!r || !Array.isArray(dbList) || !dbList.length) return null;
      const normReg = normalizeLocStr(r.regency);
      const normDist = normalizeLocStr(r.district);
      const normVill = normalizeLocStr(r.village);
      const normLoc = normalizeLocStr(r.location);
      const normTribe = normalizeLocStr(r.tribe);

      if (!normReg && !normDist && !normVill && !normLoc) return null;

      return dbList.find(db => {
        const dbReg = normalizeLocStr(db.regency);
        const dbDist = normalizeLocStr(db.district);
        const dbVill = normalizeLocStr(db.village);
        const dbLoc = normalizeLocStr(db.location);
        const dbTribe = normalizeLocStr(db.tribe);

        if (normReg && dbReg && normReg === dbReg) {
          if (normLoc && dbLoc && normLoc === dbLoc) return true;
          if (normVill && dbVill && normVill === dbVill) return true;
          if (normLoc && dbVill && normLoc === dbVill) return true;
          if (normVill && dbLoc && normVill === dbLoc) return true;
          if (normDist && dbDist && normDist === dbDist && normTribe && dbTribe && normTribe === dbTribe) return true;
        }

        if (normDist && dbDist && normDist === dbDist) {
          if (normVill && dbVill && normVill === dbVill) return true;
          if (normLoc && dbLoc && normLoc === dbLoc) return true;
        }

        return false;
      }) || null;
    }

    const rowsWithMatch = useMemo(() => {
      if (!Array.isArray(rows)) return [];
      return rows.map(r => ({
        ...r,
        _dbMatch: findDbMatch(r, existingDbRows)
      }));
    }, [rows, existingDbRows]);

    const existingInDbCount = useMemo(() => {
      return rowsWithMatch.filter(r => Boolean(r._dbMatch)).length;
    }, [rowsWithMatch]);

    const newLocationCount = Math.max(0, (rows || []).length - existingInDbCount);

    function handleApplyBatch() {
      if (typeof onApplyBatchSource === 'function') {
        onApplyBatchSource(batchSource);
      }
    }

    function handleSaveDraft() {
      if (typeof onSaveDraft === 'function') {
        onSaveDraft(batchSource);
      }
    }

    return h('div', {
      className: 'pdf-confirmation-backdrop',
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem'
      }
    },
      h('div', {
        className: 'pdf-confirmation-dialog',
        style: {
          display: 'flex',
          flexDirection: 'column',
          height: '88vh',
          maxHeight: '88vh',
          width: '100%',
          maxWidth: '85rem',
          backgroundColor: '#ffffff',
          borderRadius: '1.75rem',
          border: '1.5px solid #cbd5e1',
          boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.4)',
          overflow: 'hidden'
        }
      },
        // Header Modal (AJEG / FIXED)
        h('div', {
          className: 'pdf-confirmation-header',
          style: {
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            padding: '1.15rem 1.75rem'
          }
        },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '1rem' } },
            h('div', { style: { display: 'grid', placeItems: 'center', width: '2.75rem', height: '2.75rem', borderRadius: '1rem', background: 'linear-gradient(135deg, #6d28d9, #4f46e5)', color: '#ffffff', boxShadow: '0 4px 12px rgba(109, 40, 217, 0.3)', flexShrink: 0 } },
              h(Icon, { name: 'Sparkles', size: 22 })
            ),
            h('div', null,
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '0.75rem' } },
                h('h3', { style: { fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: 0, lineHeight: 1.2 } }, 'Konfirmasi & Edit Hasil Pembacaan Gemini AI'),
                h('span', {
                  style: {
                    backgroundColor: existingInDbCount > 0 ? '#fef3c7' : '#f3e8ff',
                    color: existingInDbCount > 0 ? '#92400e' : '#6d28d9',
                    border: `1px solid ${existingInDbCount > 0 ? '#fcd34d' : '#d8b4fe'}`,
                    padding: '0.2rem 0.75rem',
                    borderRadius: '999px',
                    fontWeight: 900,
                    fontSize: '0.72rem'
                  }
                }, `${rows.length} Lokasi Ditemukan (${newLocationCount} Baru${existingInDbCount > 0 ? `, ⚠️ ${existingInDbCount} Sudah Ada di DB` : ''})`)
              ),
              h('p', { style: { fontSize: '0.78rem', fontWeight: 600, color: '#475569', margin: '0.2rem 0 0 0' } }, `Dokumen: ${filename || 'PDF'} • Periksa dan sesuaikan data di tabel sebelum disimpan ke database`)
            )
          ),
          h('button', {
            type: 'button',
            onClick: onClose,
            style: { display: 'grid', placeItems: 'center', width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer' },
            title: 'Tutup'
          }, h(Icon, { name: 'X', size: 18 }))
        ),

        // Control Bar (Batch Sumber Data + Warning Banner - AJEG / FIXED)
        h('div', {
          className: 'pdf-confirmation-toolbar',
          style: {
            flexShrink: 0,
            backgroundColor: '#faf5ff',
            borderBottom: '1px solid #e9d5ff',
            padding: '0.85rem 1.75rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }
        },
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '0.35rem' } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#581c87', fontWeight: 800, fontSize: '0.78rem' } },
              h(Icon, { name: 'Info', size: 16, style: { stroke: '#7e22ce', color: '#7e22ce', flexShrink: 0 } }),
              h('span', null, 'Pilih Sumber Data dari dropdown atau ketik nama sumber baru pada kolom pencarian combobox.')
            ),
            existingInDbCount > 0 ? h('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#92400e', fontWeight: 800, fontSize: '0.75rem', backgroundColor: '#fef3c7', padding: '0.25rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #fcd34d' } },
              h(Icon, { name: 'AlertTriangle', size: 14, style: { stroke: '#d97706', color: '#d97706', flexShrink: 0 } }),
              h('span', null, `⚠️ Terdeteksi ${existingInDbCount} lokasi yang SUDAH ADA di Database Excel Home (Ditandai lencana "Sudah Ada di DB").`)
            ) : null
          ),
          h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' } },
            h('span', { style: { fontWeight: 900, color: '#1e293b', fontSize: '0.78rem' } }, 'Sumber Data Utama:'),
            h('div', { style: { width: '22rem' } },
              h(SelectInput, {
                value: batchSource,
                onChange: e => setBatchSource(e.target.value),
                searchable: true,
                allowCustom: true,
                searchPlaceholder: 'Ketik nama sumber data baru...',
                customOptionLabel: text => `+ Gunakan "${text}" sebagai sumber baru`,
                className: 'w-full shadow-xs font-bold text-xs'
              },
                Array.from(new Set([...allSources, batchSource].filter(Boolean))).map(src =>
                  h('option', { key: src, value: src }, src)
                )
              )
            ),
            h(
              'button',
              {
                type: 'button',
                onClick: handleApplyBatch,
                className: 'pdf-btn-apply-batch',
                style: {
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',

                  height: '2.6rem',
                  padding: '0 1.25rem',

                  backgroundColor: '#6d28d9',
                  color: '#ffffff',

                  border: '1.5px solid #5b21b6',
                  borderRadius: '0.75rem',
                  boxShadow: '0 4px 12px rgba(109, 40, 217, 0.3)',

                  fontSize: '0.78rem',
                  fontWeight: 900,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',

                  cursor: 'pointer'
                }
              },

              h(Icon, {
                name: 'CheckCheck',
                size: 15,
                style: {
                  color: '#ffffff',
                  stroke: '#ffffff',
                  flexShrink: 0
                }
              }),

              h(
                'span',
                {
                  style: {
                    color: 'inherit',
                    fontWeight: 'inherit'
                  }
                },
                'Terapkan ke Semua Baris'
              )
            )
          )
        ),

        // Scrollable Table Container (MIN-WIDTH 1980px DENGAN KOLOM STATUS DB)
        h('div', {
          className: 'pdf-confirmation-table-scroll',
          style: {
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'auto',
            padding: '1.25rem 1.75rem',
            backgroundColor: '#f8fafc'
          }
        },
          h('div', { style: { minWidth: '1980px', borderRadius: '1rem', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' } },
            h('table', { style: { width: '100%', textAlign: 'left', fontSize: '0.75rem', borderCollapse: 'collapse' } },
              h('thead', { style: { backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.7rem', borderBottom: '1.5px solid #cbd5e1' } },
                h('tr', null,
                  h('th', { style: { padding: '0.85rem 0.5rem', textAlign: 'center', width: '3.5rem', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' } }, '#'),
                  h('th', { style: { padding: '0.85rem 0.65rem', minWidth: '145px', textAlign: 'center', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' } }, 'Status DB (Deteksi)'),
                  h('th', { style: { padding: '0.85rem 0.75rem', minWidth: '220px', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' } }, 'Sumber Data (Combobox)'),
                  h('th', { style: { padding: '0.85rem 0.75rem', minWidth: '150px', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' } }, 'Suku / Komunitas'),
                  h('th', { style: { padding: '0.85rem 0.75rem', minWidth: '150px', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' } }, 'Provinsi *'),
                  h('th', { style: { padding: '0.85rem 0.75rem', minWidth: '150px', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' } }, 'Kabupaten / Kota'),
                  h('th', { style: { padding: '0.85rem 0.75rem', minWidth: '150px', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' } }, 'Kecamatan / Distrik'),
                  h('th', { style: { padding: '0.85rem 0.75rem', minWidth: '150px', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' } }, 'Desa / Kelurahan'),
                  h('th', { style: { padding: '0.85rem 0.75rem', minWidth: '150px', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' } }, 'Lokasi / Dusun'),
                  h('th', { style: { padding: '0.85rem 0.6rem', minWidth: '110px', textAlign: 'center', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' } }, 'KK Perseb.'),
                  h('th', { style: { padding: '0.85rem 0.6rem', minWidth: '110px', textAlign: 'center', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' } }, 'KK Total'),
                  h('th', { style: { padding: '0.85rem 0.6rem', minWidth: '110px', textAlign: 'center', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' } }, 'Tahun'),
                  h('th', { style: { padding: '0.85rem 0.6rem', minWidth: '95px', textAlign: 'center', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' } }, 'Usulan'),
                  h('th', { style: { padding: '0.85rem 0.75rem', minWidth: '160px', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' } }, 'Catatan'),
                  h('th', { style: { padding: '0.85rem 0.6rem', minWidth: '80px', textAlign: 'center', whiteSpace: 'nowrap' } }, 'Aksi')
                )
              ),
              h('tbody', { style: { backgroundColor: '#ffffff' } },
                rowsWithMatch.length ? rowsWithMatch.map((row, idx) =>
                  h('tr', { key: idx, style: { borderBottom: '1px solid #f1f5f9', backgroundColor: row._dbMatch ? '#fffbeb' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc') } },
                    h('td', { style: { padding: '0.6rem 0.4rem', textAlign: 'center', fontWeight: 900, color: '#64748b', borderRight: '1px solid #f1f5f9' } }, idx + 1),
                    h('td', { style: { padding: '0.4rem 0.5rem', borderRight: '1px solid #f1f5f9', textAlign: 'center' } },
                      row._dbMatch ? h('span', {
                        title: `Sudah ada di DB Excel Home: ${row._dbMatch.tribe || 'KAT'} - ${row._dbMatch.location || row._dbMatch.village || ''}, ${row._dbMatch.regency || ''}`,
                        style: { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.71rem', fontWeight: 900, cursor: 'help' }
                      },
                        h(Icon, { name: 'AlertCircle', size: 13, style: { stroke: '#d97706', color: '#d97706' } }),
                        'Sudah Ada di DB'
                      ) : h('span', {
                        title: 'Lokasi baru, belum ada di Database Excel Home',
                        style: { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.71rem', fontWeight: 900, cursor: 'help' }
                      },
                        h(Icon, { name: 'Sparkles', size: 13, style: { stroke: '#16a34a', color: '#16a34a' } }),
                        'Baru (Belum Ada)'
                      )
                    ),
                    h('td', { style: { padding: '0.4rem 0.5rem', borderRight: '1px solid #f1f5f9' } }, h(SelectInput, {
                      value: row.source_data || batchSource || defaultSource,
                      onChange: e => onUpdateField(idx, 'source_data', e.target.value),
                      searchable: true,
                      allowCustom: true,
                      searchPlaceholder: 'Cari/ketik sumber...',
                      customOptionLabel: text => `+ Gunakan "${text}"`,
                      className: 'w-full text-xs font-bold'
                    },
                      Array.from(new Set([...allSources, row.source_data].filter(Boolean))).map(src =>
                        h('option', { key: src, value: src }, src)
                      )
                    )),
                    h('td', { style: { padding: '0.4rem 0.5rem', borderRight: '1px solid #f1f5f9' } }, h('input', { type: 'text', className: 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 shadow-2xs focus:border-purple-600 focus:ring-4 focus:ring-purple-100 focus:outline-none transition-all', value: row.tribe || '', onChange: e => onUpdateField(idx, 'tribe', e.target.value), placeholder: 'Suku KAT' })),
                    h('td', { style: { padding: '0.4rem 0.5rem', borderRight: '1px solid #f1f5f9' } }, h('input', { type: 'text', className: 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 shadow-2xs focus:border-purple-600 focus:ring-4 focus:ring-purple-100 focus:outline-none transition-all', value: row.province || '', onChange: e => onUpdateField(idx, 'province', e.target.value), placeholder: 'Provinsi' })),
                    h('td', { style: { padding: '0.4rem 0.5rem', borderRight: '1px solid #f1f5f9' } }, h('input', { type: 'text', className: 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 shadow-2xs focus:border-purple-600 focus:ring-4 focus:ring-purple-100 focus:outline-none transition-all', value: row.regency || '', onChange: e => onUpdateField(idx, 'regency', e.target.value), placeholder: 'Kab/Kota' })),
                    h('td', { style: { padding: '0.4rem 0.5rem', borderRight: '1px solid #f1f5f9' } }, h('input', { type: 'text', className: 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 shadow-2xs focus:border-purple-600 focus:ring-4 focus:ring-purple-100 focus:outline-none transition-all', value: row.district || '', onChange: e => onUpdateField(idx, 'district', e.target.value), placeholder: 'Kecamatan' })),
                    h('td', { style: { padding: '0.4rem 0.5rem', borderRight: '1px solid #f1f5f9' } }, h('input', { type: 'text', className: 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 shadow-2xs focus:border-purple-600 focus:ring-4 focus:ring-purple-100 focus:outline-none transition-all', value: row.village || '', onChange: e => onUpdateField(idx, 'village', e.target.value), placeholder: 'Desa/Kel' })),
                    h('td', { style: { padding: '0.4rem 0.5rem', borderRight: '1px solid #f1f5f9' } }, h('input', { type: 'text', className: 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 shadow-2xs focus:border-purple-600 focus:ring-4 focus:ring-purple-100 focus:outline-none transition-all', value: row.location || '', onChange: e => onUpdateField(idx, 'location', e.target.value), placeholder: 'Dusun/Lokasi' })),
                    h('td', { style: { padding: '0.4rem 0.5rem', borderRight: '1px solid #f1f5f9' } }, h('input', { type: 'number', min: '0', style: { width: '100%', height: '2.5rem', borderRadius: '0.65rem', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', padding: '0 0.5rem', fontSize: '0.78rem', textAlign: 'center', fontWeight: 900, color: '#0f172a' }, value: row.households_spread ?? '', onChange: e => onUpdateField(idx, 'households_spread', e.target.value ? parseInt(e.target.value, 10) : null) })),
                    h('td', { style: { padding: '0.4rem 0.5rem', borderRight: '1px solid #f1f5f9' } }, h('input', { type: 'number', min: '0', style: { width: '100%', height: '2.5rem', borderRadius: '0.65rem', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', padding: '0 0.5rem', fontSize: '0.78rem', textAlign: 'center', fontWeight: 900, color: '#0f172a' }, value: row.households_total ?? '', onChange: e => onUpdateField(idx, 'households_total', e.target.value ? parseInt(e.target.value, 10) : null) })),
                    h('td', { style: { padding: '0.4rem 0.5rem', borderRight: '1px solid #f1f5f9' } }, h('input', { type: 'number', min: '1900', style: { width: '100%', height: '2.5rem', borderRadius: '0.65rem', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', padding: '0 0.5rem', fontSize: '0.78rem', textAlign: 'center', fontWeight: 900, color: '#0f172a' }, value: row.data_year ?? '', onChange: e => onUpdateField(idx, 'data_year', e.target.value ? parseInt(e.target.value, 10) : null) })),
                    h('td', { style: { padding: '0.4rem 0.5rem', textAlign: 'center', borderRight: '1px solid #f1f5f9' } }, h('input', { type: 'checkbox', style: { width: '1.35rem', height: '1.35rem', cursor: 'pointer', accentColor: '#6d28d9' }, checked: Boolean(row.is_proposed), onChange: e => onUpdateField(idx, 'is_proposed', e.target.checked ? 1 : 0) })),
                    h('td', { style: { padding: '0.4rem 0.5rem', borderRight: '1px solid #f1f5f9' } }, h('input', { type: 'text', className: 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 shadow-2xs focus:border-purple-600 focus:ring-4 focus:ring-purple-100 focus:outline-none transition-all', value: row.notes || '', onChange: e => onUpdateField(idx, 'notes', e.target.value), placeholder: 'Catatan' })),
                    h('td', { style: { padding: '0.4rem 0.5rem', textAlign: 'center' } }, h('button', { type: 'button', onClick: () => onRemoveRow(idx), style: { display: 'grid', placeItems: 'center', width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', color: '#dc2626', backgroundColor: '#fef2f2', border: '1.5px solid #fca5a5', cursor: 'pointer', margin: '0 auto' }, title: 'Hapus baris' }, h(Icon, { name: 'Trash2', size: 16 })))
                  )
                ) : h('tr', null, h('td', { colSpan: 15, style: { padding: '4rem 1rem', textAlign: 'center', fontWeight: 900, color: '#94a3b8', fontSize: '0.85rem' } }, 'Belum ada baris data. Klik "+ Tambah Baris Manual" di bawah untuk menambah.'))
              )
            )
          ),
          h('div', { style: { marginTop: '1rem', display: 'flex', justifyContent: 'flex-start' } },
            h('button', {
              type: 'button',
              onClick: onAddRow,
              style: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', borderRadius: '0.85rem', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', padding: '0.6rem 1.15rem', fontSize: '0.78rem', fontWeight: 900, color: '#0f172a', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', cursor: 'pointer' }
            },
              h(Icon, { name: 'Plus', size: 16, style: { stroke: '#6d28d9', color: '#6d28d9' } }),
              'Tambah Baris Manual'
            )
          )
        ),

        // Footer Modal (AJEG / STICKY AT BOTTOM WITH HIGH SPECIFICITY BUTTONS)
        h('div', {
          className: 'pdf-confirmation-footer',
          style: {
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            padding: '1.15rem 1.75rem'
          }
        },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem', fontWeight: 800, color: '#334155' } },
            h('span', { style: { display: 'grid', placeItems: 'center', width: '1.75rem', height: '1.75rem', borderRadius: '50%', backgroundColor: '#f3e8ff', color: '#6d28d9', fontWeight: 900, fontSize: '0.78rem', border: '1px solid #d8b4fe' } }, rows.length),
            h('span', null, `lokasi persebaran dikonfirmasi (${newLocationCount} baru, ${existingInDbCount} terdaftar di DB)`)
          ),
          h('div', { className: 'pdf-confirmation-footer-actions', style: { display: 'flex', alignItems: 'center', gap: '0.75rem' } },
            h('button', {
              type: 'button',
              onClick: onClose,
              disabled: submitting,
              className: 'pdf-btn-cancel',
              style: {
                height: '2.85rem',
                padding: '0 1.35rem',
                borderRadius: '0.85rem',
                backgroundColor: '#ffffff',
                background: '#ffffff',
                color: '#334155',
                fontSize: '0.82rem',
                fontWeight: 900,
                border: '1.5px solid #cbd5e1',
                cursor: 'pointer'
              }
            }, h('span', { style: { color: '#334155', fontWeight: 900 } }, 'Batal')),

            h('button', {
              type: 'button',
              onClick: handleSaveDraft,
              disabled: submitting || !rows.length,
              className: 'pdf-btn-save-draft',
              style: {
                height: '2.85rem',
                padding: '0 1.5rem',
                borderRadius: '0.85rem',
                backgroundColor: '#d97706',
                background: '#d97706',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 900,
                border: '1.5px solid #b45309',
                boxShadow: '0 4px 14px rgba(217, 119, 6, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer'
              }
            },
              h(Icon, { name: 'BookmarkCheck', size: 16, style: { stroke: '#ffffff', color: '#ffffff' } }),
              h('span', { style: { color: '#ffffff', fontWeight: 900 } }, 'Simpan Draft Lokal')
            ),

            h('button', {
              type: 'button',
              onClick: onSubmit,
              disabled: submitting || !rows.length,
              className: 'pdf-btn-submit-data',
              style: {
                height: '2.85rem',
                padding: '0 1.75rem',
                borderRadius: '0.85rem',
                background: 'linear-gradient(135deg, #6d28d9 0%, #4f46e5 100%)',
                backgroundColor: '#6d28d9',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 900,
                border: '1.5px solid #5b21b6',
                boxShadow: '0 6px 20px rgba(109, 40, 217, 0.45)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer'
              }
            },
              h(Icon, { name: 'Check', size: 16, style: { stroke: '#ffffff', color: '#ffffff' } }),
              h('span', { style: { color: '#ffffff', fontWeight: 900 } }, submitting ? 'Menyimpan ke DB...' : `Submit (${rows.length} Data)`)
            )
          )
        )
      )
    );
  }

  function PdfProcessingProgressModal({ isOpen, filename, progressPercent, statusText, secondsElapsed }) {
    if (!isOpen) return null;

    const formattedTime = `${String(Math.floor(secondsElapsed / 60)).padStart(2, '0')}:${String(secondsElapsed % 60).padStart(2, '0')}`;
    const percentInt = Math.min(100, Math.max(0, Math.round(progressPercent)));
    const stageLabel = percentInt >= 90 ? 'Menyusun Tabel Hasil' : percentInt >= 35 ? 'Analisis AI Gemini' : 'Mengunggah & Membaca PDF';

    return h('div', {
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem'
      }
    },
      h('div', {
        style: {
          position: 'relative',
          width: '100%',
          maxWidth: '28rem',
          backgroundColor: '#ffffff',
          borderRadius: '1.75rem',
          border: '1.5px solid rgba(139, 92, 246, 0.3)',
          boxShadow: '0 25px 60px -15px rgba(109, 40, 217, 0.4), 0 0 40px rgba(99, 102, 241, 0.2)',
          padding: '2rem 1.75rem 1.75rem 1.75rem',
          overflow: 'hidden',
          textAlign: 'center'
        }
      },
        // Top Animated Bar
        h('div', {
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '6px',
            background: 'linear-gradient(90deg, #7c3aed 0%, #4f46e5 50%, #06b6d4 100%)'
          }
        }),

        // Center Icon Badge
        h('div', {
          style: {
            margin: '0 auto 1rem auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '4.25rem',
            height: '4.25rem',
            borderRadius: '1.25rem',
            background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
            border: '2px solid #c7d2fe',
            boxShadow: '0 8px 24px rgba(124, 58, 237, 0.2)',
            color: '#6d28d9'
          }
        },
          h(Icon, { name: 'Sparkles', size: 32, style: { stroke: '#6d28d9', color: '#6d28d9' } })
        ),

        // Title
        h('h3', { style: { fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.35rem 0', lineHeight: 1.2 } }, 'Gemini AI Membaca PDF'),

        // Filename Badge
        h('div', { style: { display: 'flex', justifyContent: 'center' } },
          h('span', {
            style: {
              backgroundColor: '#f3e8ff',
              color: '#7e22ce',
              border: '1px solid #d8b4fe',
              padding: '0.3rem 0.85rem',
              borderRadius: '999px',
              fontWeight: 800,
              fontSize: '0.75rem',
              maxWidth: '100%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }
          }, filename || 'Dokumen PDF')
        ),

        // Progress Section
        h('div', { style: { marginTop: '1.5rem', marginBottom: '1.25rem' } },
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' } },
            h('span', { style: { color: '#6d28d9', fontWeight: 900, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' } },
              h('span', { style: { display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#7c3aed', boxShadow: '0 0 8px #7c3aed' } }),
              statusText || 'Memproses...'
            ),
            h('span', { style: { fontSize: '1.5rem', fontWeight: 900, color: '#4f46e5', lineHeight: 1 } }, `${percentInt}%`)
          ),

          // Outer Track
          h('div', {
            style: {
              height: '1rem',
              width: '100%',
              borderRadius: '999px',
              backgroundColor: '#f1f5f9',
              border: '1.5px solid #cbd5e1',
              padding: '2px',
              overflow: 'hidden',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)'
            }
          },
            // Inner Fill Bar
            h('div', {
              style: {
                height: '100%',
                borderRadius: '999px',
                background: 'linear-gradient(90deg, #7c3aed 0%, #4f46e5 50%, #2563eb 100%)',
                boxShadow: '0 0 12px rgba(124, 58, 237, 0.6)',
                width: `${Math.max(5, percentInt)}%`,
                transition: 'width 0.35s ease-out'
              }
            })
          )
        ),

        // 2 Metric Cards
        h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', textAlign: 'left' } },
          h('div', {
            style: {
              borderRadius: '1rem',
              backgroundColor: '#f8fafc',
              padding: '0.85rem 1rem',
              border: '1.5px solid #e2e8f0'
            }
          },
            h('span', { style: { display: 'block', fontSize: '0.65rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' } }, 'WAKTU BERJALAN'),
            h('span', { style: { display: 'block', fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', marginTop: '0.15rem' } }, formattedTime)
          ),
          h('div', {
            style: {
              borderRadius: '1rem',
              backgroundColor: '#fdf4ff',
              padding: '0.85rem 1rem',
              border: '1.5px solid #f5d0fe'
            }
          },
            h('span', { style: { display: 'block', fontSize: '0.65rem', fontWeight: 900, color: '#a21caf', textTransform: 'uppercase', letterSpacing: '0.05em' } }, 'TAHAP PROSES'),
            h('span', { style: { display: 'block', fontSize: '0.85rem', fontWeight: 900, color: '#86198f', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, stageLabel)
          )
        ),

        // Bottom Hint Box
        h('div', {
          style: {
            marginTop: '1.25rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.85rem',
            backgroundColor: '#f5f3ff',
            border: '1px solid #ddd6fe',
            textAlign: 'center'
          }
        },
          h('p', { style: { fontSize: '0.78rem', fontWeight: 700, color: '#4c1d95', margin: 0, lineHeight: 1.45 } },
            '💡 Gemini AI sedang mengekstrak narasi surat & lokasi persebaran. Layar konfirmasi tabel akan terbuka otomatis.'
          )
        )
      )
    );
  }

  function KatProposalModal({ isOpen, onClose, onSuccess }) {
    if (!isOpen) return null;

    const [form, setForm] = useState({
      submitted_by_name: '',
      submitted_by_email: '',
      source_data: 'PENGUSULAN MASYARAKAT',
      data_year: new Date().getFullYear(),
      province: '',
      regency: '',
      district: '',
      village: '',
      location: '',
      tribe: '',
      households_spread: '',
      households_total: '',
      notes: '',
    });
    const [file, setFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    function setField(key, val) {
      setForm(prev => ({ ...prev, [key]: val }));
    }

    async function handleSubmit(e) {
      e.preventDefault();
      if (!form.province) {
        setErrorMsg('Provinsi wajib diisi.');
        return;
      }
      if (!form.tribe && !form.location) {
        setErrorMsg('Suku/Komunitas atau Dusun/Lokasi wajib diisi.');
        return;
      }

      setSubmitting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      try {
        const formData = new FormData();
        Object.entries(form).forEach(([k, v]) => formData.append(k, v || ''));
        if (file) {
          formData.append('file', file);
        }

        const res = await fetch(freshApiUrl('distribution_proposals.php'), {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.message || 'Gagal mengirim usulan.');
        }

        setSuccessMsg(data.message || 'Usulan Anda berhasil dikirim!');
        setTimeout(() => {
          if (typeof onSuccess === 'function') onSuccess();
          onClose();
        }, 2200);
      } catch (err) {
        setErrorMsg(err.message || 'Terjadi kesalahan jaringan.');
      } finally {
        setSubmitting(false);
      }
    }

    return h('div', { className: 'fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto' },
      h('div', { className: 'relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8' },
        h('div', { className: 'flex items-center justify-between p-6 bg-gradient-to-r from-purple-900 to-indigo-900 text-white' },
          h('div', { className: 'flex items-center gap-3.5' },
            h('div', { className: 'grid place-items-center w-11 h-11 rounded-2xl bg-white/10 text-purple-200 border border-white/15' }, h(Icon, { name: 'FilePlus', size: 24 })),
            h('div', null,
              h('h3', { className: 'text-lg font-black text-white m-0' }, 'Form Pengusulan Data KAT Publik'),
              h('p', { className: 'text-xs text-purple-200 m-0 mt-0.5' }, 'Usulkan lokasi baru Komunitas Adat Terpencil untuk ditinjau Admin')
            )
          ),
          h('button', {
            type: 'button',
            onClick: onClose,
            className: 'grid place-items-center w-9 h-9 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all border border-white/10',
            title: 'Tutup formulir',
            'aria-label': 'Tutup formulir',
          }, h(Icon, { name: 'X', size: 18 }))
        ),
        h('form', { onSubmit: handleSubmit, className: 'p-6 space-y-4 max-h-[75vh] overflow-y-auto' },
          errorMsg && h('div', { className: 'p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2' }, h(Icon, { name: 'AlertCircle', size: 16 }), errorMsg),
          successMsg && h('div', { className: 'p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2' }, h(Icon, { name: 'CheckCircle2', size: 16 }), successMsg),

          h('div', { className: 'p-4 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-3' },
            h('h4', { className: 'text-xs font-black text-purple-950 uppercase tracking-wider' }, '1. Identitas Pengusul'),
            h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3' },
              h('div', null,
                h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Nama Lengkap / Instansi'),
                h('input', { type: 'text', className: 'w-full h-10 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none', value: form.submitted_by_name, onChange: e => setField('submitted_by_name', e.target.value), placeholder: 'misal: Dinas Sosial Kab. X / Andi' })
              ),
              h('div', null,
                h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Email Kontak'),
                h('input', { type: 'email', className: 'w-full h-10 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none', value: form.submitted_by_email, onChange: e => setField('submitted_by_email', e.target.value), placeholder: 'nama@email.com' })
              )
            )
          ),

          h('div', { className: 'p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3' },
            h('h4', { className: 'text-xs font-black text-slate-900 uppercase tracking-wider' }, '2. Detail Lokasi KAT'),
            h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3' },
              h('div', null,
                h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Suku / Komunitas KAT (*)'),
                h('input', { type: 'text', required: true, className: 'w-full h-10 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none', value: form.tribe, onChange: e => setField('tribe', e.target.value), placeholder: 'misal: Suku Dayak / Suku Anak Dalam' })
              ),
              h('div', null,
                h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Provinsi (*)'),
                h('input', { type: 'text', required: true, className: 'w-full h-10 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none', value: form.province, onChange: e => setField('province', e.target.value), placeholder: 'misal: Kalimantan Timur' })
              ),
              h('div', null,
                h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Kabupaten / Kota'),
                h('input', { type: 'text', className: 'w-full h-10 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none', value: form.regency, onChange: e => setField('regency', e.target.value), placeholder: 'Kabupaten X' })
              ),
              h('div', null,
                h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Kecamatan / Distrik'),
                h('input', { type: 'text', className: 'w-full h-10 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none', value: form.district, onChange: e => setField('district', e.target.value), placeholder: 'Kecamatan Y' })
              ),
              h('div', null,
                h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Desa / Kelurahan'),
                h('input', { type: 'text', className: 'w-full h-10 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none', value: form.village, onChange: e => setField('village', e.target.value), placeholder: 'Desa Z' })
              ),
              h('div', null,
                h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Dusun / Lokasi Spesifik'),
                h('input', { type: 'text', className: 'w-full h-10 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none', value: form.location, onChange: e => setField('location', e.target.value), placeholder: 'Dusun Hutan X' })
              )
            )
          ),

          h('div', { className: 'p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3' },
            h('h4', { className: 'text-xs font-black text-slate-900 uppercase tracking-wider' }, '3. Data Pendukung & Lampiran Dokumen'),
            h('div', { className: 'grid grid-cols-1 sm:grid-cols-3 gap-3' },
              h('div', null,
                h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'KK Persebaran'),
                h('input', { type: 'number', min: '0', className: 'w-full h-10 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none', value: form.households_spread, onChange: e => setField('households_spread', e.target.value), placeholder: '0' })
              ),
              h('div', null,
                h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Total KK Komunitas'),
                h('input', { type: 'number', min: '0', className: 'w-full h-10 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none', value: form.households_total, onChange: e => setField('households_total', e.target.value), placeholder: '0' })
              ),
              h('div', null,
                h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Tahun Data'),
                h('input', { type: 'number', className: 'w-full h-10 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none', value: form.data_year, onChange: e => setField('data_year', e.target.value) })
              )
            ),
            h('div', null,
              h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Lampiran Dokumen Bukti (PDF / Excel / Foto)'),
              h('input', { type: 'file', accept: '.pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png', onChange: e => setFile(e.target.files?.[0] || null), className: 'block w-full text-xs font-bold text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200 cursor-pointer' })
            ),
            h('div', null,
              h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Catatan Tambahan / Alasan Pengusulan'),
              h('textarea', { rows: 2, className: 'w-full p-3 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none', value: form.notes, onChange: e => setField('notes', e.target.value), placeholder: 'Penjelasan singkat lokasi atau nomor surat pengusulan...' })
            )
          ),

          h('div', { className: 'flex items-center justify-end gap-3 pt-3 border-t border-slate-100' },
            h('button', { type: 'button', onClick: onClose, className: 'h-11 px-5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all' }, 'Batal'),
            h('button', { type: 'submit', disabled: submitting, className: 'h-11 px-6 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-2' },
              h(Icon, { name: 'Send', size: 16 }),
              submitting ? 'Mengirim Usulan...' : 'Kirim Usulan'
            )
          )
        )
      )
    );
  }

  function PreviewTable({ rows, maxHeight = 420 }) {
    const columns = useMemo(() => {
      if (!rows?.length) return [];
      const seen = new Set();
      const all = [];
      rows.forEach(row => Object.keys(row || {}).forEach(column => {
        if (!seen.has(column)) {
          seen.add(column);
          all.push(column);
        }
      }));
      const priority = [
        'source_data', 'SUMBER DATA',
        'data_year', 'TAHUN DATA MASUK',
        'province', 'PROVINSI',
        'regency', 'KABUPATEN',
        'region_code', 'KODE WILAYAH',
        'district', 'KECAMATAN',
        'village', 'DESA',
        'location', 'LOKASI',
        'tribe', 'SUKU',
        'households_spread', 'PERSEBARAN KK',
        'sync_year', 'TAHUN DATA SINKRONISASI DENGAN DUKCAPIL',
        'households_total', 'JUMLAH KK',
        'nik', 'NIK',
        'kk_column', 'NO KK',
        'name', 'NAMA',
        'address', 'ALAMAT',
      ].map(normalizeName);
      return all
        .filter(column => !/^column\d+$/i.test(String(column)) || rows.some(row => !['', null, undefined, true, 'True', 'TRUE'].includes(row?.[column])))
        .sort((a, b) => {
          const ia = priority.indexOf(normalizeName(a));
          const ib = priority.indexOf(normalizeName(b));
          if (ia === -1 && ib === -1) return all.indexOf(a) - all.indexOf(b);
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        });
    }, [rows]);
    if (!rows?.length) {
      return h('div', { className: 'rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-500' }, 'Preview belum tersedia.');
    }
    return h('div', { className: 'preview-shell overflow-hidden rounded-2xl border border-slate-200 bg-white' },
      h('div', { className: 'flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3' },
        h('strong', { className: 'text-sm text-slate-950' }, 'Preview data'),
        h('span', { className: 'text-xs font-bold text-slate-500' }, `${compactNumber(rows.length)} baris tampil`)
      ),
      h('div', { className: 'overflow-auto', style: { maxHeight } },
        h('table', { className: 'preview-table min-w-max border-separate border-spacing-0 text-left text-sm' },
          h('thead', { className: 'sticky top-0 z-10 bg-slate-950 text-white' },
            h('tr', null, columns.map(column => h('th', { key: column, className: 'preview-heading border-r border-white/10 px-3 py-3 text-xs font-black uppercase', title: column }, displayColumnName(column))))
          ),
          h('tbody', null, rows.map((row, idx) =>
            h('tr', { key: idx, className: idx % 2 ? 'bg-slate-50' : 'bg-white' },
              columns.map(column => h('td', { key: column, title: String(row[column] ?? ''), className: 'border-r border-b border-slate-100 px-3 py-2 text-slate-700' },
                h('span', { className: 'preview-cell' }, String(row[column] ?? ''))
              ))
            )
          ))
        )
      )
    );
  }

  function SourcePills({ sources, selectedSource = '', onSelect }) {
    const rows = (sources || []).filter(Boolean);
    if (!rows.length) return null;
    return h('div', { className: 'source-pills flex flex-wrap gap-2' }, rows.map(source => {
      const value = source.source_data || source.label || '';
      const selected = normalizeName(value) === normalizeName(selectedSource);
      const title = `${value} - ${fullNumber(source.rows || source.count || 0)} baris, ${fullNumber(effectiveHouseholds(source))} KK final. ${householdSummaryText(source)}`;
      const content = [
        h(Icon, { key: 'icon', name: selected ? 'CheckCircle2' : 'Database', size: 14 }),
        h('span', { key: 'label', className: 'min-w-0 break-words' }, value),
        h('span', { key: 'count', className: 'text-slate-400' }, `(${fullNumber(source.rows || source.count || 0)})`),
      ];
      if (onSelect) {
        return h('button', {
          key: value,
          type: 'button',
          className: cx('source-pill-button inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ring-1 transition-colors duration-150', selected ? 'bg-slate-950 text-white ring-slate-950' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'),
          title,
          onClick: () => onSelect(selected ? '' : value),
        }, content);
      }
      return h('span', {
        key: source.source_data || source.label,
        className: 'inline-flex max-w-full items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200',
        title,
      }, content);
    }));
  }

  function ResultDownloadLinks({ job, adminKey = '', compact = false }) {
    const options = Array.isArray(job?.result_downloads) ? job.result_downloads : [];
    if (!options.length) return null;
    const iconMap = { zip: 'Package', xlsx: 'Sheet', csv: 'Table', txt: 'FileText', json: 'Braces', jsonl: 'Braces' };
    return h('div', { className: cx('result-download-list', compact && 'is-compact') }, options.map(option => {
      const href = resultDownloadUrl(job, option.file || 'package', adminKey);
      const filename = option.filename || option.file || 'hasil';
      const extension = String(option.extension || filename.split('.').pop() || '').toLowerCase();
      return h('a', { key: option.file, href, className: 'result-download-link', title: filename },
        h(Icon, { name: iconMap[extension] || 'Download', size: 15 }),
        h('span', null,
          h('strong', null, option.label || extension.toUpperCase() || 'Hasil'),
          h('small', null, filename)
        )
      );
    }));
  }

  async function copyText(text) {
    const value = String(text || '');
    if (!value) return false;
    try {
      await navigator.clipboard?.writeText(value);
      return true;
    } catch (_) {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', 'readonly');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand?.('copy') || false;
      textarea.remove();
      return Boolean(ok);
    }
  }

  function CopyShortlinkButton({ url, label = 'Copy link', compact = false }) {
    const [copied, setCopied] = useState(false);
    if (!url) return null;
    async function copy() {
      const ok = await copyText(url);
      setCopied(ok);
      window.setTimeout(() => setCopied(false), 1600);
    }
    return h(Button, { type: 'button', variant: copied ? 'success' : 'soft', className: cx(compact ? 'h-8 gap-1.5 px-2 text-xs' : 'gap-2', 'shrink-0'), onClick: copy },
      h(Icon, { name: copied ? 'Check' : 'Copy', size: compact ? 13 : 15 }),
      copied ? 'Tersalin' : label
    );
  }

  function ShortlinkBox({ job, url: explicitUrl = '', compact = false, title = 'Shortlink', copyLabel = '' }) {
    const url = explicitUrl || jobShortUrl(job);
    if (!url) return null;
    return h('div', { className: cx(compact ? 'mt-2' : 'mt-3', 'rounded-xl bg-white p-3 ring-1 ring-slate-200') },
      h('div', { className: 'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between' },
        h('div', { className: 'min-w-0' },
          h('p', { className: 'text-xs font-black uppercase text-slate-500' }, title),
          h('p', { className: 'mt-1 text-xs font-semibold text-slate-700', style: { wordBreak: 'break-all' } }, url)
        ),
        h(CopyShortlinkButton, { url, compact, label: copyLabel || (compact ? 'Copy' : 'Copy shortlink') })
      )
    );
  }

  function StatCard({ label, value, tone = 'slate', icon = 'BarChart3', subtitle = '', onClick, active = false, loading = false }) {
    const tones = {
      emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
      rose: 'border-rose-100 bg-rose-50 text-rose-700',
      amber: 'border-amber-100 bg-amber-50 text-amber-700',
      blue: 'border-blue-100 bg-blue-50 text-blue-700',
      cyan: 'border-cyan-100 bg-cyan-50 text-cyan-700',
      violet: 'border-violet-100 bg-violet-50 text-violet-700',
      indigo: 'border-indigo-100 bg-indigo-50 text-indigo-700',
      slate: 'border-slate-200 bg-white text-slate-900',
    };
    const element = onClick ? 'button' : 'div';
    return h(element, {
      type: onClick ? 'button' : undefined,
      onClick,
      className: cx('surface-card stat-card rounded-2xl border p-4', onClick && 'stat-card-clickable text-left', active && 'is-active', loading && 'is-loading', tones[tone] || tones.slate),
      title: onClick ? `Lihat detail ${label}` : undefined,
      'aria-busy': loading ? 'true' : undefined,
    },
      h('div', { className: 'relative z-10 flex items-start justify-between gap-4' },
        h('p', { className: 'stat-label min-w-0 text-xs font-black uppercase opacity-70' }, label),
        h('span', { className: 'stat-card-icon grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/78 text-current shadow-sm ring-1 ring-current/10' }, h(Icon, { name: icon, size: 21 }))
      ),
      h('p', { className: 'stat-value relative z-10 mt-2 text-2xl font-black' }, loading ? h('span', { className: 'stat-value-loading', 'aria-label': 'Memuat' }) : fullNumber(value)),
      h('p', { className: 'stat-subtitle relative z-10 mt-1 text-[0.68rem] font-bold opacity-70', title: subtitle || 'Klik untuk detail' }, subtitle || (onClick ? 'Klik untuk detail' : ''))
    );
  }

  function MiniMetric({ icon = 'Info', label, value }) {
    return h('div', { className: 'rounded-xl bg-white/85 p-3 ring-1 ring-slate-100' },
      h('div', { className: 'flex items-center gap-2 text-slate-500' },
        h(Icon, { name: icon, size: 14 }),
        h('span', { className: 'text-[0.68rem] font-black uppercase' }, label)
      ),
      h('strong', { className: 'mt-1 block text-base text-slate-950' }, value)
    );
  }

  function BasicExcelSummary({ summary }) {
    if (!summary) return null;
    const notes = Array.isArray(summary.notes) ? summary.notes.filter(Boolean) : [];
    const peopleTotal = Number(summary.people_total || 0);
    const nikFilled = Number(summary.nik_filled || 0);
    const kkFilled = Number(summary.kk_number_filled || 0);
    const kkValidUnique = Number(summary.kk_number_valid_unique ?? summary.kk_number_unique ?? 0);
    const sourceLine = [
      summary.households_excel_source ? `Sumber KK Excel: ${summary.households_excel_source}` : '',
      summary.nik_column ? `Kolom NIK: ${summary.nik_column}` : '',
      summary.kk_number_column ? `Kolom No KK: ${summary.kk_number_column}` : '',
    ].filter(Boolean).join(' · ');
    return h('div', { className: 'rounded-2xl border border-sky-100 bg-sky-50/70 p-4' },
      h('div', { className: 'flex flex-col gap-2 md:flex-row md:items-start md:justify-between' },
        h('div', null,
          h('p', { className: 'text-xs font-black uppercase text-sky-700' }, 'Ringkasan hitungan awal Excel'),
          h('p', { className: 'mt-1 text-sm font-semibold text-slate-600' }, sourceLine || 'Ringkasan ini dihitung dari struktur kolom dan isi file.')
        ),
        h('span', { className: 'inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-black text-sky-700 ring-1 ring-sky-100' },
          h(Icon, { name: 'FileCheck2', size: 14 }),
          'Ikut dicatat di hasil'
        )
      ),
      h('div', { className: 'mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6' },
        h(MiniMetric, { icon: 'Users', label: 'Baris warga', value: fullNumber(peopleTotal) }),
        h(MiniMetric, { icon: 'Fingerprint', label: 'NIK terisi', value: `${fullNumber(nikFilled)} / ${fullNumber(peopleTotal)}` }),
        h(MiniMetric, { icon: 'CreditCard', label: 'Nomor KK terisi', value: `${fullNumber(kkFilled)} / ${fullNumber(peopleTotal)}` }),
        h(MiniMetric, { icon: 'CopyCheck', label: 'Nomor KK unik', value: fullNumber(summary.kk_number_unique || 0) }),
        h(MiniMetric, { icon: 'House', label: 'Estimasi keluarga', value: fullNumber(summary.households_excel_total || 0) }),
        h(MiniMetric, { icon: 'TriangleAlert', label: 'Perlu cek awal', value: fullNumber(summary.problem_rows || 0) })
      ),
      h('p', { className: 'mt-3 text-xs font-semibold text-slate-600' },
        `${fullNumber(summary.nik_valid_unique || 0)} NIK valid unik. ${fullNumber(kkValidUnique)} Nomor KK valid unik. `,
        `${fullNumber(summary.people_with_nik_and_kk || 0)} warga memiliki NIK dan KK terisi; ${fullNumber(summary.people_missing_both || 0)} warga tidak memiliki keduanya.`
      ),
      notes.length ? h('div', { className: 'mt-3 flex flex-wrap gap-2' }, notes.slice(0, 5).map((note, idx) =>
        h('span', { key: `${idx}-${note}`, className: 'rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200' }, note)
      )) : null,
      Number(summary.empty_or_separator_rows || 0) > 0 ? h('p', { className: 'mt-3 text-xs font-semibold text-slate-500' }, `${fullNumber(summary.empty_or_separator_rows)} baris kosong/separator tidak dihitung sebagai jiwa.`) : null
    );
  }

  function itemLocationLine(item) {
    return [
      item?.regency ? `Kab/Kota: ${item.regency}` : '',
      item?.district ? `Kec: ${item.district}` : '',
      item?.village ? `Kel/Desa: ${item.village}` : '',
      item?.province ? `Prov: ${item.province}` : '',
    ].filter(Boolean).join(' / ') || '-';
  }

  function locationItemKey(item, idx) {
    return [
      item?.type || '',
      item?.job_id || '',
      item?.region_code || '',
      item?.title || '',
      item?.province || '',
      item?.regency || '',
      item?.district || '',
      item?.village || '',
      item?.location || '',
      idx,
    ].join('|');
  }

  function regionSeedFromItem(item = {}) {
    return {
      province: item.province || '',
      regency: item.regency || '',
      district: item.district || '',
      village: item.village || '',
      location: item.location || (item.type === 'location' ? item.title : '') || '',
      community_name: item.community_name || '',
      __label: item.title || item.community_name || item.location || item.village || item.regency || item.province || 'Wilayah KAT',
    };
  }

  function distributionDocumentSummary(record = {}) {
    const apiItems = Array.isArray(record.documents) ? record.documents : [];
    const apiByKey = new Map(apiItems.map(item => [item.key, item]));
    const items = DISTRIBUTION_DOCUMENT_FIELDS.map(([key, label, icon]) => {
      const apiItem = apiByKey.get(key) || {};
      const urlKey = `${key}_url`;
      return {
        key,
        label,
        icon,
        checked: Object.prototype.hasOwnProperty.call(record, key) ? Boolean(Number(record[key] || 0)) : Boolean(apiItem.checked),
        url: Object.prototype.hasOwnProperty.call(record, urlKey) ? (record[urlKey] || '') : (apiItem.url || ''),
      };
    });
    return {
      items,
      complete: items.filter(item => item.checked).length,
      linked: items.filter(item => item.url).length,
      total: items.length,
      folderUrl: record.documents_folder_url || '',
      updatedAt: record.documents_updated_at || '',
    };
  }

  function distributionRecordFromMapItem(item = {}) {
    const record = { ...item };
    const summary = distributionDocumentSummary(item);
    summary.items.forEach(document => {
      record[document.key] = document.checked ? 1 : 0;
      record[`${document.key}_url`] = document.url || '';
    });
    record.documents_folder_url = summary.folderUrl || '';
    return record;
  }

  function DistributionDocumentChecklist({ value = {}, onChange = null, editable = false }) {
    const summary = distributionDocumentSummary(value);
    const setValue = (key, nextValue) => onChange?.(key, nextValue);
    return h('section', { className: cx('distribution-document-checklist', editable && 'is-editable') },
      h('div', { className: 'distribution-document-head' },
        h('div', { className: 'min-w-0' },
          h('p', { className: 'distribution-document-kicker' }, h(Icon, { name: 'FolderCheck', size: 14 }), 'Kelengkapan dokumen usulan'),
          h('strong', null, `${summary.complete} dari ${summary.total} lengkap`),
          h('small', null, `${summary.linked} item memiliki tautan bukti`)
        ),
        h('span', { className: cx('distribution-document-score', summary.complete === summary.total && 'is-complete') }, `${summary.complete}/${summary.total}`)
      ),
      editable ? h(Field, { label: 'Link folder dokumen kabupaten/lokasi' },
        h(TextInput, {
          value: summary.folderUrl,
          type: 'url',
          placeholder: 'https://drive.google.com/drive/folders/...',
          onChange: event => setValue('documents_folder_url', event.target.value),
        })
      ) : summary.folderUrl ? h('a', { className: 'distribution-document-folder', href: summary.folderUrl, target: '_blank', rel: 'noopener noreferrer' },
        h(Icon, { name: 'FolderOpen', size: 15 }),
        'Buka folder dokumen'
      ) : null,
      h('div', { className: 'distribution-document-items' },
        summary.items.map(item => h('div', { key: item.key, className: cx('distribution-document-item', item.checked && 'is-checked') },
          h('label', { className: 'distribution-document-toggle' },
            h('input', {
              type: 'checkbox',
              checked: item.checked,
              disabled: !editable,
              onChange: event => setValue(item.key, event.target.checked ? 1 : 0),
            }),
            h('span', { className: 'distribution-document-icon' }, h(Icon, { name: item.icon, size: 15 })),
            h('span', null, item.label)
          ),
          editable ? h('input', {
            className: 'distribution-document-url',
            type: 'url',
            value: item.url,
            placeholder: 'Tempel link dokumen',
            'aria-label': `Link ${item.label}`,
            onChange: event => setValue(`${item.key}_url`, event.target.value),
          }) : item.url ? h('a', { className: 'distribution-document-open', href: item.url, target: '_blank', rel: 'noopener noreferrer', title: `Buka ${item.label}` },
            h(Icon, { name: 'ExternalLink', size: 14 }),
            'Buka'
          ) : h('span', { className: 'distribution-document-no-link' }, 'Belum ada link')
        ))
      ),
      summary.updatedAt ? h('p', { className: 'distribution-document-updated' }, `Diperbarui ${formatDateTime(summary.updatedAt)}`) : null
    );
  }

  function LocationField({ icon, label, value }) {
    return h('div', { className: 'location-field rounded-xl bg-white/85 p-3 ring-1 ring-slate-100' },
      h('div', { className: 'flex items-center gap-2 text-slate-500' },
        h(Icon, { name: icon, size: 14 }),
        h('span', { className: 'text-[0.66rem] font-black uppercase' }, label)
      ),
      h('strong', { className: 'mt-1 block min-w-0 text-sm leading-snug text-slate-950' }, value || '-')
    );
  }

  function LocationDetailPanel({ item, onClose, onStartPadan, onDocumentsSaved }) {
    const [documentDraft, setDocumentDraft] = useState(() => distributionRecordFromMapItem(item || {}));
    const [documentsEditing, setDocumentsEditing] = useState(false);
    const [documentsSaving, setDocumentsSaving] = useState(false);
    const [documentsMessage, setDocumentsMessage] = useState(null);
    useEffect(() => {
      setDocumentDraft(distributionRecordFromMapItem(item || {}));
    }, [item?.distribution_id, item?.documents_updated_at]);
    useEffect(() => {
      setDocumentsEditing(false);
      setDocumentsMessage(null);
    }, [item?.distribution_id]);
    if (!item) return null;
    const bnba = item.bnba_summary || {};
    const hasBnba = Boolean(bnba.has_bnba || Number(bnba.kk_unique || 0) > 0 || Number(bnba.checked_rows || 0) > 0);
    const households = householdMetrics(item);
    const adminKey = localStorage.getItem('admin_key') || '';
    const canEditDocuments = Boolean(adminKey && Number(item.distribution_id || 0) > 0);
    const setDocumentValue = (key, value) => setDocumentDraft(current => ({ ...current, [key]: value }));
    const cancelDocumentEdit = () => {
      setDocumentDraft(distributionRecordFromMapItem(item));
      setDocumentsEditing(false);
      setDocumentsMessage(null);
    };
    const saveDocuments = async () => {
      const documentUrls = [
        documentDraft.documents_folder_url,
        ...DISTRIBUTION_DOCUMENT_FIELDS.map(([key]) => documentDraft[`${key}_url`]),
      ].map(value => String(value || '').trim()).filter(Boolean);
      if (documentUrls.some(url => !/^https?:\/\//i.test(url))) {
        setDocumentsMessage({ type: 'error', text: 'Link dokumen harus diawali http:// atau https://.' });
        return;
      }
      setDocumentsSaving(true);
      setDocumentsMessage(null);
      try {
        const result = await apiRequest('distribution.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
          body: JSON.stringify({ action: 'save_documents', id: item.distribution_id, documents: documentDraft }),
        });
        const savedRow = result.row || {};
        const updatedItem = {
          ...item,
          ...savedRow,
          distribution_id: Number(savedRow.id || item.distribution_id),
          community_name: savedRow.tribe || item.community_name,
          documents: savedRow.documents || distributionDocumentSummary(documentDraft).items,
        };
        setDocumentDraft(distributionRecordFromMapItem(updatedItem));
        setDocumentsEditing(false);
        setDocumentsMessage({
          type: result.pending_sync ? 'info' : 'success',
          text: result.warning || 'Checklist dan link dokumen tersimpan.',
        });
        onDocumentsSaved?.(updatedItem);
      } catch (error) {
        setDocumentsMessage({ type: 'error', text: error.message || 'Checklist dokumen gagal disimpan.' });
      } finally {
        setDocumentsSaving(false);
      }
    };
    return h('section', { className: 'location-detail-panel rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm' },
      h('div', { className: 'flex items-start justify-between gap-3' },
        h('div', { className: 'min-w-0' },
          h('p', { className: 'flex items-center gap-2 text-xs font-black uppercase text-slate-500' }, h(Icon, { name: 'MapPinned', size: 14 }), 'Detail lokasi'),
          h('h2', { className: 'mt-1 text-base font-black leading-snug text-slate-950', title: item.title }, item.title || '-'),
          h('p', { className: 'mt-1 text-xs leading-5 text-slate-500' }, itemLocationLine(item))
        ),
        h('button', { type: 'button', onClick: onClose, className: 'grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200', title: 'Tutup detail' },
          h(Icon, { name: 'X', size: 17 })
        )
      ),
      item.address ? h('p', { className: 'mt-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-600' }, item.address) : null,
      h('div', { className: 'location-fields mt-3 grid grid-cols-2 gap-2 text-xs' },
        h(LocationField, { icon: 'Map', label: 'Provinsi', value: item.province }),
        h(LocationField, { icon: 'Landmark', label: 'Kabupaten/Kota', value: item.regency }),
        h(LocationField, { icon: 'Network', label: 'Kecamatan', value: item.district }),
        h(LocationField, { icon: 'MapPinned', label: 'Kelurahan/Desa', value: item.village }),
        h(LocationField, { icon: 'LocateFixed', label: 'Lokasi', value: item.location || item.title }),
        h(LocationField, { icon: 'UsersRound', label: 'Komunitas', value: item.community_name })
      ),
      h('div', { className: 'mt-3 grid grid-cols-2 gap-2 text-xs' },
        h(MiniMetric, { icon: 'Users', label: 'KK final', value: `${fullNumber(households.effective)} KK` }),
        h(MiniMetric, { icon: 'Database', label: 'KK by Excel', value: `${fullNumber(households.distribution)} KK` }),
        h(MiniMetric, { icon: 'FileSpreadsheet', label: 'KK by padan', value: `${fullNumber(households.bnba)} KK` }),
        h(MiniMetric, { icon: 'GitCompareArrows', label: 'Sumber angka', value: householdSourceLabel(households.source) }),
        households.delta ? h(MiniMetric, { icon: 'Activity', label: 'Selisih BNBA', value: `${households.delta > 0 ? '+' : ''}${fullNumber(households.delta)} KK` }) : null,
        h(MiniMetric, { icon: 'Database', label: 'Sumber', value: item.source_data || item.type || '-' }),
        h(MiniMetric, { icon: 'CalendarDays', label: 'Tahun data', value: item.data_year || item.sync_year || '-' }),
        h(MiniMetric, { icon: 'Hash', label: 'Kode wilayah', value: item.region_code || '-' }),
        hasBnba ? h(MiniMetric, { icon: 'FileSpreadsheet', label: 'KK input BNBA', value: fullNumber(bnba.input_rows || 0) }) : null,
        hasBnba ? h(MiniMetric, { icon: 'CopyCheck', label: 'KK unik/duplikat', value: `${fullNumber(bnba.kk_unique || 0)} / ${fullNumber(bnba.kk_duplicate || 0)}` }) : null
      ),
      h('div', { className: 'mt-3 flex flex-wrap gap-2 bg-transparent' },
        item.community_name ? h(Badge, { status: 'slate' }, item.community_name) : null,
        item.status ? h(Badge, { status: item.status }, item.status) : null,
        hasBnba ? h(Badge, { status: 'checked' }, 'ada data BNBA') : null,
        bnba.fix_status ? h(Badge, { status: bnba.fix_status }, bnba.fix_status === 'approved' ? 'fix disetujui' : 'fix menunggu') : null,
        item.updated_at || item.checked_at || item.uploaded_at ? h(Badge, { status: 'processing' }, formatDateTime(item.updated_at || item.checked_at || item.uploaded_at)) : null
      ),
      h('div', { className: 'mt-3 grid gap-2' },
        canEditDocuments ? h('div', { className: 'flex items-center justify-end gap-2' },
          documentsEditing ? h(React.Fragment, null,
            h(Button, { type: 'button', variant: 'soft', className: 'h-9 gap-2 px-3 text-xs', onClick: cancelDocumentEdit, disabled: documentsSaving }, h(Icon, { name: 'X', size: 14 }), 'Batal'),
            h(Button, { type: 'button', variant: 'success', className: 'h-9 gap-2 px-3 text-xs', onClick: saveDocuments, disabled: documentsSaving }, h(Icon, { name: documentsSaving ? 'LoaderCircle' : 'Save', size: 14 }), documentsSaving ? 'Menyimpan' : 'Simpan')
          ) : h(Button, { type: 'button', variant: 'soft', className: 'h-9 gap-2 px-3 text-xs', onClick: () => setDocumentsEditing(true) }, h(Icon, { name: 'Pencil', size: 14 }), 'Edit dokumen')
        ) : null,
        documentsMessage ? h(Notice, { message: documentsMessage }) : null,
        h(DistributionDocumentChecklist, { value: documentsEditing ? documentDraft : item, editable: documentsEditing, onChange: setDocumentValue })
      ),
      h('div', { className: 'mt-3' },
        h(Button, { type: 'button', variant: 'blue', className: 'w-full gap-2', onClick: () => onStartPadan?.(item) },
          h(Icon, { name: 'UploadCloud', size: 16 }),
          'Padankan lokasi ini'
        )
      )
    );
  }

  function BnbaLocationTable({ item }) {
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [columnFilters, setColumnFilters] = useState({});
    const [sort, setSort] = useState({ key: 'jumlah_input', dir: 'desc' });
    const summary = item?.bnba_summary || {};
    const rows = Array.isArray(item?.bnba_rows) ? item.bnba_rows : [];
    const hasBnba = Boolean(summary.has_bnba || Number(summary.kk_unique || 0) > 0 || rows.length);
    const columns = [
      ['jenis', 'Jenis'],
      ['nomor_kk', 'Nomor KK'],
      ['nama_kepala_keluarga', 'Kepala Keluarga'],
      ['jumlah_input', 'Jumlah Input'],
      ['desil', 'Desil'],
      ['percentile', 'Percentile'],
      ['jumlah_anggota_keluarga', 'Anggota'],
      ['pekerjaan_kepala_keluarga', 'Pekerjaan'],
      ['alamat', 'Alamat'],
      ['hasil_cek', 'Hasil'],
    ];

    const filteredRows = useMemo(() => {
      const globalNeedle = normalizeName(query);
      const filters = Object.entries(columnFilters)
        .map(([key, value]) => [key, normalizeName(value)])
        .filter(([, value]) => value);
      const filtered = rows.filter(row => {
        if (typeFilter !== 'all' && String(row.jenis || '') !== typeFilter) return false;
        if (globalNeedle) {
          const haystack = normalizeName(columns.map(([key]) => row[key] ?? '').join(' '));
          if (!haystack.includes(globalNeedle)) return false;
        }
        return filters.every(([key, value]) => normalizeName(row[key] ?? '').includes(value));
      });
      const dir = sort.dir === 'asc' ? 1 : -1;
      return filtered.slice().sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        const an = Number(av);
        const bn = Number(bv);
        if (!Number.isNaN(an) && !Number.isNaN(bn) && String(av ?? '').trim() !== '' && String(bv ?? '').trim() !== '') {
          return (an - bn) * dir;
        }
        return String(av ?? '').localeCompare(String(bv ?? ''), 'id') * dir;
      });
    }, [rows, query, typeFilter, columnFilters, sort]);

    function changeColumnFilter(key, value) {
      setColumnFilters(current => ({ ...current, [key]: value }));
    }

    function toggleSort(key) {
      setSort(current => current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
    }

    if (!item) return null;
    return h('section', { className: 'bnba-location-panel rounded-2xl border border-slate-200 bg-white/92 p-4 shadow-sm backdrop-blur-xl' },
      h('div', { className: 'flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between' },
        h('div', { className: 'min-w-0' },
          h('p', { className: 'flex items-center gap-2 text-xs font-black uppercase text-slate-500' }, h(Icon, { name: 'FileSpreadsheet', size: 15 }), 'Detail koneksi pengusulan dan BNBA'),
          h('h2', { className: 'mt-1 text-lg font-black text-slate-950' }, item.title || 'Lokasi terpilih'),
          h('p', { className: 'mt-1 text-xs font-semibold leading-5 text-slate-500' }, hasBnba ? `Diambil dari job #${summary.latest_job_id || '-'} ${summary.latest_job_name || ''}` : 'Belum ada job BNBA selesai yang cocok dengan lokasi ini.')
        ),
        h('div', { className: 'flex flex-wrap gap-2' },
          h(Badge, { status: item.status }, item.status || 'lokasi'),
          hasBnba ? h(Badge, { status: 'checked' }, 'ada data BNBA') : h(Badge, { status: 'pending' }, 'belum ada BNBA'),
          summary.fix_status ? h(Badge, { status: summary.fix_status }, summary.fix_status === 'approved' ? 'fix disetujui' : 'fix menunggu') : null
        )
      ),
      h('div', { className: 'bnba-stat-grid mt-4 grid gap-3' },
        h(MiniMetric, { icon: 'Rows3', label: 'KK input', value: fullNumber(summary.input_rows || 0) }),
        h(MiniMetric, { icon: 'CopyCheck', label: 'KK unik', value: fullNumber(summary.kk_unique || 0) }),
        h(MiniMetric, { icon: 'CopyX', label: 'KK duplikat', value: fullNumber(summary.kk_duplicate || 0) }),
        h(MiniMetric, { icon: 'AlertCircle', label: 'Tanpa KK/Tidak padan', value: fullNumber(summary.no_kk_rows || 0) })
      ),
      h('div', { className: 'mt-4 grid gap-3 lg:grid-cols-[1fr_auto]' },
        h('label', { className: 'bnba-search-box' },
          h(Icon, { name: 'Search', size: 16 }),
          h('input', { value: query, onChange: event => setQuery(event.target.value), placeholder: 'Search semua kolom BNBA...' })
        ),
        h('div', { className: 'bnba-segments' },
          [['all', 'Semua'], ['unik', 'Unik'], ['duplikat', 'Duplikat']].map(([key, label]) =>
            h('button', { key, type: 'button', className: cx(typeFilter === key && 'is-active'), onClick: () => setTypeFilter(key) }, label)
          )
        )
      ),
      hasBnba ? h('div', { className: 'bnba-table-shell mt-4 overflow-auto rounded-2xl border border-slate-200' },
        h('table', { className: 'bnba-table min-w-max text-left text-xs' },
          h('thead', null,
            h('tr', null, columns.map(([key, label]) =>
              h('th', { key, className: 'px-3 py-2 align-top' },
                h('button', { type: 'button', className: 'bnba-sort-button', onClick: () => toggleSort(key) },
                  h('span', null, label),
                  h(Icon, { name: sort.key === key ? (sort.dir === 'asc' ? 'ArrowUp' : 'ArrowDown') : 'ArrowUpDown', size: 13 })
                ),
                h('input', { value: columnFilters[key] || '', onChange: event => changeColumnFilter(key, event.target.value), placeholder: 'Filter kolom' })
              )
            ))
          ),
          h('tbody', null,
            filteredRows.length ? filteredRows.slice(0, 300).map((row, idx) =>
              h('tr', { key: `${row.nomor_kk || idx}-${idx}` },
                columns.map(([key]) => h('td', { key, title: String(row[key] ?? ''), className: 'px-3 py-2 align-top' },
                  key === 'jenis'
                    ? h(Badge, { status: row.jenis === 'duplikat' ? 'pending' : 'checked' }, row.jenis || '-')
                    : String(row[key] ?? '-')
                ))
              )
            ) : h('tr', null, h('td', { colSpan: columns.length, className: 'py-8 text-center font-bold text-slate-500' }, 'Tidak ada baris yang cocok dengan filter.'))
          )
        )
      ) : h('div', { className: 'mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500' }, 'Lokasi ini masih pengusulan tanpa hasil BNBA yang cocok.')
    );
  }

  function StatDetailModal({ stat, rows = [], onClose }) {
    const [search, setSearch] = useState('');
    const needle = normalizeName(search);
    const sourceRows = Array.isArray(rows) ? rows : [];
    const filteredRows = useMemo(() => {
      if (!needle) return sourceRows;
      return sourceRows.filter(row => normalizeName([
        row.name,
        row.province,
        row.regency,
        row.district,
        row.village,
        row.location,
        row.community_name,
        row.source_data,
        row.region_code,
      ].filter(Boolean).join(' ')).includes(needle));
    }, [needle, sourceRows]);
    const groups = useMemo(() => {
      const grouped = new Map();
      filteredRows.forEach(row => {
        const groupName = stat?.key === 'province' ? 'Semua provinsi' : (row.province || 'Tanpa provinsi');
        if (!grouped.has(groupName)) grouped.set(groupName, []);
        grouped.get(groupName).push(row);
      });
      return Array.from(grouped.entries()).map(([name, groupRows]) => ({ name, rows: groupRows }));
    }, [filteredRows, stat]);

    useEffect(() => {
      function closeOnEscape(event) {
        if (event.key === 'Escape') onClose?.();
      }
      document.addEventListener('keydown', closeOnEscape);
      return () => document.removeEventListener('keydown', closeOnEscape);
    }, [onClose]);

    if (!stat) return null;

    function renderLocationMeta(row) {
      return [
        ['Provinsi', row.province],
        ['Kab/Kota', row.regency],
        ['Kecamatan', row.district],
        ['Kel/Desa', row.village],
        ['Sumber', row.source_data],
        ['Tahun', row.data_year],
      ].filter(([, value]) => value !== null && value !== undefined && value !== '').map(([label, value]) =>
        h('span', { key: `${label}-${value}`, className: 'stat-detail-chip' }, h('b', null, label), String(value))
      );
    }

    return h('div', {
      className: 'stat-modal-backdrop',
      role: 'presentation',
      onMouseDown: event => {
        if (event.target === event.currentTarget) onClose?.();
      },
    },
      h('section', { className: 'stat-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Detail ${stat.label}` },
        h('header', { className: 'stat-modal-head' },
          h('div', { className: 'stat-modal-title' },
            h('span', { className: cx('stat-modal-icon', `tone-${stat.tone || 'slate'}`) }, h(Icon, { name: stat.icon, size: 23 })),
            h('div', { className: 'min-w-0' },
              h('p', { className: 'text-xs font-black uppercase text-slate-500' }, 'Detail statistik'),
              h('h2', { className: 'break-words text-xl font-black text-slate-950', title: stat.label }, stat.label),
              h('p', { className: 'mt-1 text-xs font-bold text-slate-500' }, `${fullNumber(filteredRows.length)} baris cocok dari ${fullNumber(sourceRows.length)} entri`)
            )
          ),
          h('button', { type: 'button', className: 'stat-modal-close', onClick: onClose, title: 'Tutup' }, h(Icon, { name: 'X', size: 19 }))
        ),
        h('div', { className: 'stat-modal-summary' },
          h('strong', null, fullNumber(stat.value)),
          h('span', null, stat.subtitle || 'Klik kartu statistik untuk melihat daftar detailnya.')
        ),
        h('label', { className: 'stat-modal-search' },
          h(Icon, { name: 'Search', size: 17 }),
          h('input', { value: search, onChange: event => setSearch(event.target.value), placeholder: 'Cari provinsi, kabupaten, kecamatan, kelurahan, lokasi...', autoFocus: true })
        ),
        h('div', { className: 'stat-modal-body' },
          filteredRows.length ? groups.slice(0, 80).map(group =>
            h('section', { key: group.name, className: 'stat-detail-group' },
              h('div', { className: 'stat-detail-group-head' },
                h('strong', null, group.name),
                h('span', null, `${fullNumber(group.rows.length)} entri`)
              ),
              h('div', { className: 'stat-detail-list' },
                group.rows.slice(0, 140).map((row, index) => {
                  const households = householdMetrics(row);
                  return h('article', { key: `${group.name}-${row.name}-${row.region_code || index}`, className: 'stat-detail-row' },
                    h('div', { className: 'min-w-0' },
                      h('h3', { title: row.name }, row.name || '-'),
                      h('div', { className: 'stat-detail-chips' }, renderLocationMeta(row))
                    ),
                    h('div', { className: 'stat-detail-counts' },
                      h('span', null, h(Icon, { name: 'LocateFixed', size: 14 }), `${fullNumber(row.locations || 0)} lokasi`),
                      Number(row.documents_total || 0) ? h('span', { title: `${fullNumber(row.documents_missing || 0)} dokumen belum lengkap` }, h(Icon, { name: 'FolderCheck', size: 14 }), `${fullNumber(row.documents_complete || 0)}/${fullNumber(row.documents_total || 0)} dokumen`) : null,
                      h('span', { title: householdSummaryText(row) }, h(Icon, { name: 'Users', size: 14 }), `${fullNumber(households.effective)} KK final`),
                      h('span', { title: 'KK dari angka awal Excel/persebaran' }, h(Icon, { name: 'Table', size: 14 }), `${fullNumber(households.distribution)} by Excel`),
                      h('span', { title: 'KK unik dari hasil padan BNBA' }, h(Icon, { name: 'FileSpreadsheet', size: 14 }), `${fullNumber(households.bnba)} by padan`)
                    )
                  );
                }
                )
              )
            )
          ) : h('div', { className: 'stat-modal-empty' }, 'Tidak ada detail yang cocok dengan pencarian ini.')
        )
      )
    );
  }

  function LinkProcessChip({ process }) {
    const label = normalizeLinkProcess(process);
    return h('span', { className: 'link-process-chip', title: label },
      h(Icon, { name: 'Workflow', size: 13 }),
      h('span', { className: 'break-words' }, label)
    );
  }

  function LinkArchiveCard({ link, compact = false, admin = false, actions = null }) {
    const host = link.link_host || linkHost(link.url);
    const status = linkStatusLabel(link.status);
    const shortUrl = archiveShortUrl(link);
    return h('article', { className: cx('link-card', compact && 'is-compact', link.is_pinned && 'is-pinned') },
      h('div', { className: 'link-card-head' },
        h('span', { className: 'link-card-icon' }, h(Icon, { name: link.is_pinned ? 'Pin' : 'Link2', size: 18 })),
        h('div', { className: 'min-w-0' },
          h('a', { href: link.url, target: '_blank', rel: 'noreferrer', className: 'link-card-title', title: link.title || host }, link.title || host),
          h('p', { className: 'link-card-host', title: link.url }, host)
        ),
        h('a', { href: link.url, target: '_blank', rel: 'noreferrer', className: 'link-card-open', title: 'Buka link' }, h(Icon, { name: 'ExternalLink', size: 16 }))
      ),
      link.description ? h('p', { className: 'link-card-description' }, link.description) : null,
      shortUrl ? h(ShortlinkBox, { url: shortUrl, compact: true, title: 'Shortlink arsip', copyLabel: 'Copy' }) : null,
      h('div', { className: 'link-card-meta' },
        h(LinkProcessChip, { process: link.process_context }),
        link.is_pinned ? h(Badge, { status: 'pinned' }, 'pinned') : null,
        admin ? h(Badge, { status }, status) : null
      ),
      admin ? h('div', { className: 'link-card-audit' },
        h('span', null, `Diajukan ${formatDateTime(link.created_at)}`),
        link.submitted_by_name ? h('span', null, link.submitted_by_name) : null,
        link.submitted_by_email ? h('span', null, link.submitted_by_email) : null
      ) : null,
      actions ? h('div', { className: 'link-card-actions' }, actions) : null
    );
  }

  function LinkArchiveHome({ onOpenArchive }) {
    const [links, setLinks] = useState([]);
    const [summary, setSummary] = useState({});
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
      let alive = true;
      async function loadPinnedLinks() {
        setLoading(true);
        try {
          const data = await apiRequest('link_archive.php?pinned=1&limit=6');
          if (!alive) return;
          setLinks(data.links || []);
          setSummary(data.summary || {});
        } catch (error) {
          if (alive) setMessage({ type: 'error', text: error.message });
        } finally {
          if (alive) setLoading(false);
        }
      }
      loadPinnedLinks();
      return () => { alive = false; };
    }, []);

    return h('section', { className: 'link-home-panel' },
      h('div', { className: 'link-home-head' },
        h('div', { className: 'min-w-0' },
          h('p', { className: 'section-kicker' }, 'Pinned link archive'),
          h('h2', { className: 'section-title' }, 'Shortcut operasional yang sudah dikurasi admin'),
          h('p', { className: 'link-home-copy' }, 'Link penting untuk data, persiapan, asesmen, monitoring, evaluasi, dan rujukan bisa dipakai langsung tanpa membongkar chat atau dokumen lama.')
        ),
        h('div', { className: 'link-home-actions' },
          h('span', { className: 'link-home-count' }, h(Icon, { name: 'Archive', size: 15 }), `${fullNumber(summary.pinned || links.length || 0)} pinned`),
          h(Button, { type: 'button', variant: 'soft', className: 'gap-2', onClick: onOpenArchive }, h(Icon, { name: 'LibraryBig', size: 16 }), 'Semua arsip')
        )
      ),
      message ? h('div', { className: 'mt-4' }, h(Notice, { message })) : null,
      h('div', { className: 'link-home-grid' },
        loading ? [0, 1, 2].map(item => h('div', { key: item, className: 'link-card link-card-skeleton' },
          h('span', null),
          h('strong', null),
          h('p', null)
        )) : links.length ? links.map(link => h(LinkArchiveCard, { key: link.id, link, compact: true })) : h('div', { className: 'link-home-empty' },
          h(Icon, { name: 'PinOff', size: 20 }),
          h('span', null, 'Belum ada link yang dipin admin. Link approved tetap bisa dibuka dari halaman arsip.')
        )
      )
    );
  }

  function LinkArchivePage() {
    const empty = { title: '', url: '', description: '', process_context: 'Data', submitted_by_name: '', submitted_by_email: '' };
    const [links, setLinks] = useState([]);
    const [summary, setSummary] = useState({});
    const [serverOptions, setServerOptions] = useState([]);
    const [query, setQuery] = useState('');
    const [processFilter, setProcessFilter] = useState('');
    const [form, setForm] = useState(empty);
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const processOptions = linkProcessOptions(links, serverOptions);
    const processBreakdown = Object.entries(summary.processes || {})
      .map(([name, count]) => ({ name, count: Number(count) || 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 4);
    const processPreview = processBreakdown.length
      ? processBreakdown
      : processOptions.slice(0, 4).map(name => ({ name, count: 0 }));
    const heroLinks = links.slice(0, 2);

    async function loadLinks(overrides = {}) {
      setLoading(true);
      setMessage(null);
      try {
        const params = new URLSearchParams({ limit: 200 });
        const nextQuery = Object.prototype.hasOwnProperty.call(overrides, 'query') ? overrides.query : query;
        const nextProcess = Object.prototype.hasOwnProperty.call(overrides, 'process') ? overrides.process : processFilter;
        if (String(nextQuery || '').trim()) params.set('q', String(nextQuery).trim());
        if (String(nextProcess || '').trim()) params.set('process', String(nextProcess).trim());
        const data = await apiRequest(`link_archive.php?${params.toString()}`);
        setLinks(data.links || []);
        setSummary(data.summary || {});
        setServerOptions(data.process_options || []);
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    useEffect(() => { loadLinks(); }, []);

    function setField(name, value) {
      setForm(current => ({ ...current, [name]: value }));
    }

    async function submitLink(event) {
      event.preventDefault();
      setSubmitting(true);
      setMessage(null);
      try {
        await apiRequest('link_archive.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'submit', ...form }),
        });
        setForm(empty);
        setMessage({ type: 'info', text: 'Link dikirim ke antrean approval admin. Jika dipin, link akan tampil di Home.' });
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setSubmitting(false);
      }
    }

    return h('main', { className: 'link-archive-page grid gap-5' },
      h('section', { className: 'link-archive-hero' },
        h('div', { className: 'link-archive-copy' },
          h('p', { className: 'section-kicker' }, 'Link archive'),
          h('h2', { className: 'section-title' }, 'Arsip link kerja KAT yang siap dicari, dipakai, dan dipin'),
          h('p', { className: 'link-archive-lead' }, 'Semua link yang tampil di sini sudah melewati approval. Link baru tetap bisa diajukan, lalu admin menentukan apakah cukup masuk arsip atau ikut dipin ke Home.'),
          h('div', { className: 'link-archive-stats' },
            h(MiniMetric, { icon: 'LibraryBig', label: 'Approved', value: fullNumber(summary.approved || links.length || 0) }),
            h(MiniMetric, { icon: 'Pin', label: 'Pinned', value: fullNumber(summary.pinned || 0) }),
            h(MiniMetric, { icon: 'Workflow', label: 'Proses', value: fullNumber(Object.keys(summary.processes || {}).length || processOptions.length) })
          ),
          h('div', { className: 'link-process-overview' },
            h('div', { className: 'link-process-overview-head' },
              h('span', null, 'Sebaran proses'),
              h('strong', null, processBreakdown.length ? `${fullNumber(processBreakdown.reduce((sum, item) => sum + item.count, 0))} link aktif` : 'Siap dikurasi')
            ),
            h('div', { className: 'link-process-overview-grid' },
              processPreview.length ? processPreview.map(item => h('span', { key: item.name, className: 'link-process-row' },
                h('span', null, item.name),
                h('strong', null, item.count ? fullNumber(item.count) : 'baru')
              )) : h('span', { className: 'link-process-row is-empty' },
                h('span', null, 'Belum ada proses'),
                h('strong', null, '0')
              )
            )
          ),
          h('div', { className: 'link-archive-quick' },
            h('div', { className: 'link-archive-quick-head' },
              h('span', null, 'Link siap pakai'),
              h('strong', null, loading ? 'Memuat' : `${fullNumber(heroLinks.length)} ditampilkan`)
            ),
            h('div', { className: 'link-archive-quick-grid' },
              loading ? [0, 1].map(item => h('span', { key: item, className: 'link-quick-skeleton' })) :
                heroLinks.length ? heroLinks.map(link => h('a', {
                  key: link.id,
                  href: link.url,
                  target: '_blank',
                  rel: 'noreferrer',
                  className: cx('link-quick-card', link.is_pinned && 'is-pinned'),
                  title: link.title || linkHost(link.url),
                },
                  h('span', { className: 'link-quick-icon' }, h(Icon, { name: link.is_pinned ? 'Pin' : 'ExternalLink', size: 14 })),
                  h('span', { className: 'link-quick-text' },
                    h('strong', null, link.title || linkHost(link.url)),
                    h('small', null, normalizeLinkProcess(link.process_context))
                  )
                )) : h('span', { className: 'link-quick-empty' }, 'Belum ada link pada filter ini.')
            )
          )
        ),
        h('form', { className: 'link-submit-panel', onSubmit: submitLink },
          h('div', { className: 'flex items-start justify-between gap-3' },
            h('div', null,
              h('h3', { className: 'text-base font-black text-slate-950' }, 'Ajukan link'),
              h('p', { className: 'mt-1 text-xs font-semibold leading-5 text-slate-500' }, 'Masuk sebagai pending sampai admin approve.')
            ),
            h('span', { className: 'link-submit-icon' }, h(Icon, { name: 'Send', size: 18 }))
          ),
          h('div', { className: 'link-submit-stack' },
            h(Field, { label: 'Judul link (wajib)' }, h(TextInput, { value: form.title, required: true, onChange: event => setField('title', event.target.value), placeholder: 'Contoh: Template asesmen awal' })),
            h(Field, { label: 'URL link (wajib)' }, h(TextInput, { value: form.url, required: true, onChange: event => setField('url', event.target.value), placeholder: 'https://...' })),
            h(Field, { label: 'Proses (wajib)' }, h('select', { value: form.process_context, required: true, onChange: event => setField('process_context', event.target.value), className: 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none' },
              processOptions.map(item => h('option', { key: item, value: item }, item))
            )),
            h(Field, { label: 'Deskripsi link (wajib)' }, h(TextArea, { value: form.description, required: true, onChange: event => setField('description', event.target.value), placeholder: 'Isi, konteks penggunaan, dan kapan link ini dipakai.' })),
            h('div', { className: 'link-submit-grid' },
              h(Field, { label: 'Nama pengusul' }, h(TextInput, { value: form.submitted_by_name, onChange: event => setField('submitted_by_name', event.target.value), placeholder: 'Opsional' })),
              h(Field, { label: 'Email pengusul' }, h(TextInput, { value: form.submitted_by_email, onChange: event => setField('submitted_by_email', event.target.value), placeholder: 'Opsional' }))
            ),
            h(Button, { type: 'submit', variant: 'success', className: 'gap-2', disabled: submitting }, h(Icon, { name: submitting ? 'LoaderCircle' : 'Send', size: 16 }), submitting ? 'Mengirim...' : 'Kirim untuk approval')
          )
        )
      ),
      h('section', { className: 'link-archive-toolbar' },
        h(TextInput, { value: query, onChange: event => setQuery(event.target.value), onKeyDown: event => { if (event.key === 'Enter') loadLinks(); }, placeholder: 'Cari judul, deskripsi, proses, atau domain' }),
        h('select', { value: processFilter, onChange: event => { setProcessFilter(event.target.value); loadLinks({ process: event.target.value }); }, className: 'h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none' },
          h('option', { value: '' }, 'Semua proses'),
          processOptions.map(item => h('option', { key: item, value: item }, item))
        ),
        h(Button, { type: 'button', variant: 'blue', className: 'gap-2', disabled: loading, onClick: () => loadLinks() }, h(Icon, { name: loading ? 'LoaderCircle' : 'Search', size: 16 }), loading ? '...' : 'Cari')
      ),
      h(Notice, { message }),
      h('section', { className: 'link-archive-grid' },
        loading ? [0, 1, 2, 3, 4, 5].map(item => h('div', { key: item, className: 'link-card link-card-skeleton' },
          h('span', null),
          h('strong', null),
          h('p', null)
        )) : links.length ? links.map(link => h(LinkArchiveCard, { key: link.id, link })) : h('div', { className: 'link-archive-empty' },
          h(Icon, { name: 'SearchX', size: 24 }),
          h('strong', null, 'Belum ada link approved pada filter ini'),
          h('span', null, 'Coba ubah pencarian atau ajukan link baru untuk direview admin.')
        )
      )
    );
  }

  function HomeMap({ appConfig, onOpenArchive, onStartPadan }) {
    const mapRef = useRef(null);
    const mapBoxRef = useRef(null);
    const layerRef = useRef(null);
    const popupRef = useRef(null);
    const queryRef = useRef('');
    const dataRequestSeqRef = useRef(0);
    const drillRequestSeqRef = useRef(0);
    const mapRequestSeqRef = useRef(0);
    const mapBusyRef = useRef(false);
    const pendingSelectionKeyRef = useRef('');
    const [query, setQuery] = useState('');
    const [selectedProvince, setSelectedProvince] = useState('');
    const [selectedRegion, setSelectedRegion] = useState({});
    const [mapLevel, setMapLevel] = useState('province');
    const [mapNotice, setMapNotice] = useState('');
    const [mapLoading, setMapLoading] = useState(false);
    const [mapPanelCollapsed, setMapPanelCollapsed] = useState(false);
    const [mapFeatureCount, setMapFeatureCount] = useState(0);
    const [drillOptions, setDrillOptions] = useState([]);
    const [drillLoading, setDrillLoading] = useState(false);
    const [selectedSource, setSelectedSource] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [statDetailKey, setStatDetailKey] = useState('');
    const [data, setData] = useState({ summary: {}, province_stats: [], source_breakdown: [], breakdowns: {}, items: [] });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [proposalModalOpen, setProposalModalOpen] = useState(false);

    useEffect(() => { queryRef.current = query; }, [query]);

    const mapLevels = [
      { key: 'province', label: 'Provinsi', next: 'regency', icon: 'Map' },
      { key: 'regency', label: 'Kab/Kota', next: 'district', icon: 'Landmark' },
      { key: 'district', label: 'Kecamatan/Distrik', next: 'village', icon: 'Network' },
      { key: 'village', label: 'Desa/Kelurahan', next: '', icon: 'MapPinned' },
    ];
    const mapLevelMeta = mapLevels.find(item => item.key === mapLevel) || mapLevels[0];
    const selectedTrail = mapLevels
      .filter(item => selectedRegion[item.key])
      .map(item => ({ ...item, value: selectedRegion[item.key] }));

    function mapNextLevel(level) {
      return (mapLevels.find(item => item.key === level) || {}).next || '';
    }

    function mapLevelLabel(level) {
      return (mapLevels.find(item => item.key === level) || {}).label || 'Wilayah';
    }

    function officialProvinceCode(name) {
      const codes = {
        ACEH: '11',
        'SUMATERA UTARA': '12',
        'SUMATERA BARAT': '13',
        RIAU: '14',
        JAMBI: '15',
        'SUMATERA SELATAN': '16',
        BENGKULU: '17',
        LAMPUNG: '18',
        'KEPULAUAN BANGKA BELITUNG': '19',
        'KEPULAUAN RIAU': '21',
        'DKI JAKARTA': '31',
        'DAERAH KHUSUS IBUKOTA JAKARTA': '31',
        'JAWA BARAT': '32',
        'JAWA TENGAH': '33',
        'DI YOGYAKARTA': '34',
        'DAERAH ISTIMEWA YOGYAKARTA': '34',
        'JAWA TIMUR': '35',
        BANTEN: '36',
        BALI: '51',
        'NUSA TENGGARA BARAT': '52',
        'NUSA TENGGARA TIMUR': '53',
        'KALIMANTAN BARAT': '61',
        'KALIMANTAN TENGAH': '62',
        'KALIMANTAN SELATAN': '63',
        'KALIMANTAN TIMUR': '64',
        'KALIMANTAN UTARA': '65',
        'SULAWESI UTARA': '71',
        'SULAWESI TENGAH': '72',
        'SULAWESI SELATAN': '73',
        'SULAWESI TENGGARA': '74',
        GORONTALO: '75',
        'SULAWESI BARAT': '76',
        MALUKU: '81',
        'MALUKU UTARA': '82',
        PAPUA: '91',
        'PAPUA BARAT': '92',
        'PAPUA SELATAN': '93',
        'PAPUA TENGAH': '94',
        'PAPUA PEGUNUNGAN': '95',
        'PAPUA BARAT DAYA': '96',
      };
      return codes[normalizeName(name)] || '';
    }

    function featureNameByLevel(feature, level = mapLevel) {
      const props = feature?.properties || {};
      if (level === 'province') return props.nama_provinsi || props.NAMA_PROP || props.PROVINSI || props.Propinsi || props.name || props.NAME_1 || 'Wilayah';
      if (level === 'regency') return props.nama_kabupaten || props.NAMA_KAB || props.KABUPATEN || props.KAB_KOTA || props.name || props.NAME_2 || 'Kabupaten/Kota';
      if (level === 'district') return props.nama_kecamatan || props.NAMA_KEC || props.KECAMATAN || props.DISTRIK || props.name || props.NAME_3 || 'Kecamatan/Distrik';
      if (level === 'village') return props.nama_desa || props.NAMA_DESA || props.DESA || props.KELURAHAN || props.KAMPUNG || props.name || props.NAME_4 || 'Desa/Kelurahan';
      return props.name || 'Wilayah';
    }

    function featureProvince(feature) {
      const props = feature?.properties || {};
      return props.nama_provinsi || props.NAMA_PROP || props.PROVINSI || props.Propinsi || props.NAME_1 || props.province || '';
    }

    function featureRegency(feature) {
      const props = feature?.properties || {};
      return props.nama_kabupaten || props.NAMA_KAB || props.KABUPATEN || props.KAB_KOTA || props.NAME_2 || props.regency || '';
    }

    function featureDistrict(feature) {
      const props = feature?.properties || {};
      return props.nama_kecamatan || props.NAMA_KEC || props.KECAMATAN || props.DISTRIK || props.NAME_3 || props.district || '';
    }

    function featureCodeValue(feature, keys) {
      const props = feature?.properties || {};
      for (const key of keys) {
        const digits = String(props[key] || '').replace(/\D+/g, '');
        if (digits) return digits;
      }
      return '';
    }

    function featureCodeByLevel(feature, level = mapLevel) {
      const props = feature?.properties || {};
      if (level === 'province') {
        return officialProvinceCode(featureNameByLevel(feature, 'province'))
          || featureCodeValue(feature, ['kode_prov', 'KODE_PROV', 'NO_PROP', 'id', 'code']);
      }
      const code = level === 'province'
        ? (props.kode_prov || props.KODE_PROV || props.NO_PROP || props.id || props.code)
        : level === 'regency'
          ? (props.kode_kab || props.KODE_KAB || props.NO_KAB || props.code)
          : level === 'district'
            ? (props.kode_kec || props.KODE_KEC || props.NO_KEC || props.code)
            : (props.kode_desa || props.KODE_DESA || props.NO_DESA || props.code);
      return String(code || '').replace(/\D+/g, '');
    }

    function featureScopeMeta(feature, level = mapLevel) {
      const code = featureCodeByLevel(feature, level);
      return {
        code,
        province_code: level === 'province'
          ? code
          : featureCodeValue(feature, ['kode_prov', 'KODE_PROV', 'NO_PROP', 'province_code']) || selectedRegion.province_code || officialProvinceCode(featureProvince(feature)),
        regency_code: level === 'regency'
          ? code
          : featureCodeValue(feature, ['kode_kab', 'KODE_KAB', 'NO_KAB', 'regency_code']) || selectedRegion.regency_code,
        district_code: level === 'district'
          ? code
          : featureCodeValue(feature, ['kode_kec', 'KODE_KEC', 'NO_KEC', 'district_code']) || selectedRegion.district_code,
        village_code: level === 'village' ? code : selectedRegion.village_code,
      };
    }

    function featureMatchesScope(feature, level, scope) {
      const province = featureProvince(feature);
      const regency = featureRegency(feature);
      const district = featureDistrict(feature);
      const provinceCode = featureCodeValue(feature, ['kode_prov', 'KODE_PROV', 'NO_PROP', 'province_code']);
      const regencyCode = featureCodeValue(feature, ['kode_kab', 'KODE_KAB', 'NO_KAB', 'regency_code']);
      const districtCode = featureCodeValue(feature, ['kode_kec', 'KODE_KEC', 'NO_KEC', 'district_code']);
      if (level !== 'province' && scope.province_code && provinceCode && String(provinceCode) !== String(scope.province_code)) return false;
      if (['district', 'village'].includes(level) && scope.regency_code && regencyCode && String(regencyCode) !== String(scope.regency_code)) return false;
      if (level === 'village' && scope.district_code && districtCode && String(districtCode) !== String(scope.district_code)) return false;
      if (level !== 'province' && scope.province && province && !compatibleRegionText(scope.province, province)) return false;
      if (['district', 'village'].includes(level) && scope.regency && regency && !compatibleRegionText(scope.regency, regency)) return false;
      if (level === 'village' && scope.district && district && !compatibleRegionText(scope.district, district)) return false;
      return true;
    }

    function geojsonScopeForLevel(level, scope) {
      if (level === 'regency') return scope.province_code || scope.province || '';
      if (level === 'district') return scope.regency_code || (scope.province && scope.regency ? `${scope.province}|${scope.regency}` : scope.regency || scope.province_code || scope.province || '');
      if (level === 'village') return scope.district_code || (scope.province && scope.regency && scope.district ? `${scope.province}|${scope.regency}|${scope.district}` : scope.district || scope.regency_code || scope.regency || '');
      return '';
    }

    function scopeForLevel(level, name, base = selectedRegion, meta = {}) {
      const next = { ...base, [level]: name };
      const code = String(meta.code || '').replace(/\D+/g, '');
      if (code) next[`${level}_code`] = code;
      ['province_code', 'regency_code', 'district_code', 'village_code'].forEach(key => {
        const value = String(meta[key] || '').replace(/\D+/g, '');
        if (value) next[key] = value;
      });
      if (level === 'province' && !next.province_code) {
        const provinceCode = officialProvinceCode(name);
        if (provinceCode) next.province_code = provinceCode;
      }
      if (level === 'province') {
        delete next.regency;
        delete next.district;
        delete next.village;
        delete next.regency_code;
        delete next.district_code;
        delete next.village_code;
      }
      if (level === 'regency') {
        delete next.district;
        delete next.village;
        delete next.district_code;
        delete next.village_code;
      }
      if (level === 'district') {
        delete next.village;
        delete next.village_code;
      }
      return next;
    }

    function statsForScope(scope) {
      const rows = (data.items || []).filter(item => {
        if (scope.province && !compatibleRegionText(scope.province, item.province)) return false;
        if (scope.regency && !compatibleRegionText(scope.regency, item.regency)) return false;
        if (scope.district && !compatibleRegionText(scope.district, item.district)) return false;
        if (scope.village && !compatibleRegionText(scope.village, item.village)) return false;
        return true;
      });
      return rows.reduce((acc, row) => {
        const metrics = householdMetrics(row);
        acc.locations += 1;
        acc.households += metrics.effective;
        acc.effective_households_total += metrics.effective;
        acc.distribution_households_total += metrics.distribution;
        acc.bnba_households_total += metrics.bnba;
        if (metrics.source === 'bnba') acc.households_from_bnba_locations += 1;
        else if (metrics.source === 'distribution') acc.households_from_distribution_locations += 1;
        else acc.households_empty_locations += 1;
        if (metrics.bnba > 0 && metrics.distribution > 0 && metrics.bnba !== metrics.distribution) acc.households_bnba_diff_locations += 1;
        return acc;
      }, {
        locations: 0,
        households: 0,
        effective_households_total: 0,
        distribution_households_total: 0,
        bnba_households_total: 0,
        households_from_bnba_locations: 0,
        households_from_distribution_locations: 0,
        households_empty_locations: 0,
        households_bnba_diff_locations: 0,
      });
    }

    function seedFromScope(scope) {
      return {
        province: scope.province || '',
        regency: scope.regency || '',
        district: scope.district || '',
        village: scope.village || '',
        location: '',
        community_name: '',
        title: scope.village || scope.district || scope.regency || scope.province || 'Wilayah KAT',
        type: scope.village ? 'village' : scope.district ? 'district' : scope.regency ? 'regency' : 'province',
      };
    }

    async function loadDrillChoices(level, scope) {
      if (!level) {
        drillRequestSeqRef.current += 1;
        setDrillOptions([]);
        setDrillLoading(false);
        return;
      }
      const seq = ++drillRequestSeqRef.current;
      setDrillLoading(true);
      try {
        const params = new URLSearchParams({ level, limit: '80' });
        if (scope.province) params.set('province', scope.province);
        if (scope.regency) params.set('regency', scope.regency);
        if (scope.district) params.set('district', scope.district);
        if (scope.village) params.set('village', scope.village);
        const result = await apiRequest(`regions.php?${params.toString()}`);
        if (seq === drillRequestSeqRef.current) {
          setDrillOptions(result.regions || []);
        }
      } catch (_) {
        if (seq === drillRequestSeqRef.current) {
          setDrillOptions([]);
        }
      } finally {
        if (seq === drillRequestSeqRef.current) {
          setDrillLoading(false);
        }
      }
    }

    function resetMapDrill() {
      setSelectedRegion({});
      setSelectedProvince('');
      setMapLevel('province');
      setQuery('');
      setDrillOptions([]);
      setMapNotice('');
      setMapFeatureCount(0);
      mapBusyRef.current = true;
      pendingSelectionKeyRef.current = '';
      loadData({ province: '', query: '' });
      popupRef.current?.remove?.();
      popupRef.current = null;
    }

    function stepMapBack() {
      if (mapLevel === 'province') return resetMapDrill();
      const nextScope = {};
      mapBusyRef.current = true;
      pendingSelectionKeyRef.current = `back|${mapLevel}|${Date.now()}`;
      popupRef.current?.remove?.();
      popupRef.current = null;
      if (mapLevel === 'regency') {
        setSelectedRegion(nextScope);
        setSelectedProvince('');
        setMapLevel('province');
        setQuery('');
        setMapNotice('Klik provinsi untuk masuk ke kabupaten/kota.');
        loadData({ province: '', query: '' });
        setDrillOptions([]);
        setDrillLoading(false);
        return;
      }
      if (mapLevel === 'district') {
        nextScope.province = selectedRegion.province || '';
        nextScope.province_code = selectedRegion.province_code || officialProvinceCode(nextScope.province);
        setSelectedRegion(nextScope);
        setMapLevel('regency');
        setQuery('');
        setMapNotice(`Pilih kabupaten/kota di dalam ${nextScope.province || 'provinsi aktif'}.`);
        loadData({ province: nextScope.province || '', query: '' });
        setDrillOptions([]);
        setDrillLoading(true);
        return;
      }
      nextScope.province = selectedRegion.province || '';
      nextScope.regency = selectedRegion.regency || '';
      nextScope.province_code = selectedRegion.province_code || officialProvinceCode(nextScope.province);
      nextScope.regency_code = selectedRegion.regency_code || '';
      setSelectedRegion(nextScope);
      setMapLevel('district');
      setQuery(nextScope.regency || '');
      setMapNotice(`Pilih kecamatan/distrik di dalam ${nextScope.regency || 'kabupaten aktif'}.`);
      loadData({ province: nextScope.province || '', query: nextScope.regency || '' });
      setDrillOptions([]);
      setDrillLoading(true);
    }

    function openRegionPopup(latlng, scope, level, nextLevel) {
      const map = mapRef.current;
      if (!map || !window.L) return;
      const activeName = scope[level] || scope.village || scope.district || scope.regency || scope.province || 'Wilayah';
      const stats = statsForScope(scope);
      const statsHouseholds = householdMetrics(stats);
      const content = document.createElement('div');
      content.className = 'kat-popup-card';
      const label = mapLevelLabel(level);
      const nextLabel = nextLevel ? mapLevelLabel(nextLevel) : '';
      content.innerHTML = `
        <div class="kat-popup-kicker">${label} aktif</div>
        <strong class="kat-popup-title"></strong>
        <div class="kat-popup-path"></div>
        <div class="kat-popup-metrics">
          <span><b>${fullNumber(stats.locations)}</b><small>Lokasi</small></span>
          <span><b>${fullNumber(statsHouseholds.effective)}</b><small>KK final</small></span>
          <span><b>${fullNumber(statsHouseholds.distribution)}</b><small>KK by Excel</small></span>
          <span><b>${fullNumber(statsHouseholds.bnba)}</b><small>KK by padan</small></span>
        </div>
        <div class="kat-popup-actions">
          <button type="button" class="kat-popup-primary" data-map-padan>Padankan wilayah</button>
          ${nextLevel ? `<button type="button" class="kat-popup-secondary" data-map-drill>Pilih ${nextLabel}</button>` : ''}
        </div>
      `;
      content.querySelector('.kat-popup-title').textContent = activeName;
      content.querySelector('.kat-popup-path').textContent = ['province', 'regency', 'district', 'village'].map(key => scope[key]).filter(Boolean).join(' / ');
      content.querySelector('[data-map-padan]')?.addEventListener('click', () => onStartPadan?.(seedFromScope(scope)));
      content.querySelector('[data-map-drill]')?.addEventListener('click', () => {
        mapBusyRef.current = true;
        setMapLevel(nextLevel);
        setDrillOptions([]);
        setDrillLoading(true);
      });
      window.L.DomEvent.disableScrollPropagation(content);
      popupRef.current = window.L.popup({ className: 'kat-map-popup', closeButton: true, autoPanPadding: [18, 18], maxWidth: 320 })
        .setLatLng(latlng)
        .setContent(content)
        .openOn(map);
    }

    function chooseMapRegion(level, name, latlng = null, meta = {}) {
      const nextScope = scopeForLevel(level, name, selectedRegion, meta);
      const nextLevel = mapNextLevel(level);
      const selectionKey = [level, name, meta.code || '', nextScope.province_code || '', nextScope.regency_code || '', nextScope.district_code || ''].join('|');
      if (mapBusyRef.current && pendingSelectionKeyRef.current === selectionKey) {
        return;
      }
      pendingSelectionKeyRef.current = selectionKey;
      mapBusyRef.current = true;
      popupRef.current?.remove?.();
      popupRef.current = null;
      setSelectedRegion(nextScope);
      setMapLevel(nextLevel || level);
      setMapNotice(nextLevel ? `Pilih ${mapLevelLabel(nextLevel)} di dalam ${name}.` : `${name} sudah menjadi level terdalam yang tersedia.`);
      setDrillOptions([]);
      setDrillLoading(Boolean(nextLevel));
      if (level === 'province') {
        setSelectedProvince(name);
        setQuery('');
        loadData({ province: name, query: '' });
      } else {
        setSelectedProvince(nextScope.province || selectedProvince);
        setQuery(name);
        loadData({ province: nextScope.province || selectedProvince, query: name });
      }
      if (latlng) openRegionPopup(latlng, nextScope, level, nextLevel);
    }

    function chooseDrillOption(option) {
      const name = option?.name || '';
      if (!name) return;
      const level = mapLevel;
      const center = mapRef.current?.getCenter?.();
      chooseMapRegion(level, name, center || null, option);
    }

    async function loadData(overrides = {}) {
      const seq = ++dataRequestSeqRef.current;
      setLoading(true);
      setMessage(null);
      try {
        const nextQuery = Object.prototype.hasOwnProperty.call(overrides, 'query') ? overrides.query : queryRef.current;
        const nextProvince = Object.prototype.hasOwnProperty.call(overrides, 'province') ? overrides.province : selectedProvince;
        const nextSource = Object.prototype.hasOwnProperty.call(overrides, 'source') ? overrides.source : selectedSource;
        const params = new URLSearchParams();
        params.set('limit', '500');
        if (String(nextQuery || '').trim()) params.set('q', String(nextQuery).trim());
        if (String(nextProvince || '').trim()) params.set('province', String(nextProvince).trim());
        if (String(nextSource || '').trim()) params.set('source', String(nextSource).trim());
        const result = normalizeMapDataPayload(await apiRequest(`map_data.php?${params.toString()}`));
        if (seq !== dataRequestSeqRef.current) return;
        setData(result);
        setSelectedItem(null);
      } catch (error) {
        if (seq === dataRequestSeqRef.current) {
          setMessage({ type: 'error', text: error.message });
        }
      } finally {
        if (seq === dataRequestSeqRef.current) {
          setLoading(false);
        }
      }
    }

    function mapInstructionForLevel(level, scope) {
      if (level === 'province') return 'Klik provinsi untuk masuk ke kabupaten/kota.';
      if (level === 'regency') return `Pilih kabupaten/kota di dalam ${scope.province || 'provinsi aktif'}.`;
      if (level === 'district') return `Pilih kecamatan/distrik di dalam ${scope.regency || 'kabupaten/kota aktif'}.`;
      return 'Klik desa/kelurahan untuk membuka detail dan tombol padankan wilayah.';
    }

    function geoOptionsFromFeatures(features, level) {
      const seen = new Set();
      return (features || []).map(feature => {
        const name = featureNameByLevel(feature, level);
        const meta = featureScopeMeta(feature, level);
        return {
          ...meta,
          name,
          province: featureProvince(feature) || selectedRegion.province || '',
          regency: featureRegency(feature) || selectedRegion.regency || '',
          district: featureDistrict(feature) || selectedRegion.district || '',
          __geojson: true,
        };
      }).filter(item => {
        const key = `${item.name}|${item.code || ''}`;
        if (!item.name || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).sort((a, b) => normalizeName(a.name).localeCompare(normalizeName(b.name)));
    }

    function scopeFromLocationItem(item = {}) {
      const code = String(item.region_code || item.kode_wilayah || '').replace(/\D+/g, '');
      const scope = {
        province: item.province || '',
        regency: item.regency || '',
        district: item.district || '',
        village: item.village || '',
      };
      if (scope.province) scope.province_code = officialProvinceCode(scope.province);
      if (code.length >= 2 && !scope.province_code) scope.province_code = code.slice(0, 2);
      if (code.length >= 4) scope.regency_code = code.slice(0, 4);
      if (code.length >= 6) scope.district_code = code.slice(0, 6);
      if (code.length >= 10) scope.village_code = code.slice(0, 10);
      return Object.fromEntries(Object.entries(scope).filter(([, value]) => value));
    }

    function deepestMapLevelForScope(scope) {
      if (scope.village) return 'village';
      if (scope.district) return 'district';
      if (scope.regency) return 'regency';
      return 'province';
    }

    function selectLocationOnMap(item, idx) {
      const scope = scopeFromLocationItem(item);
      if (!scope.province) {
        setSelectedItem({ ...item, __idx: idx });
        return;
      }
      const level = deepestMapLevelForScope(scope);
      pendingSelectionKeyRef.current = `card|${locationItemKey(item, idx)}`;
      mapBusyRef.current = true;
      popupRef.current?.remove?.();
      popupRef.current = null;
      setSelectedItem({ ...item, __idx: idx });
      setSelectedProvince(scope.province || '');
      setSelectedRegion(scope);
      setMapLevel(level);
      setQuery(scope[level] || scope.regency || scope.province || '');
      setMapPanelCollapsed(false);
      setMapNotice(mapInstructionForLevel(level, scope));
    }

    function locationScopeSelected(item) {
      const scope = scopeFromLocationItem(item);
      const deepest = ['village', 'district', 'regency', 'province'].find(key => scope[key]);
      if (!deepest || !selectedRegion[deepest]) return false;
      return ['province', 'regency', 'district', 'village'].every(key => !scope[key] || compatibleRegionText(scope[key], selectedRegion[key]));
    }

    useEffect(() => { loadData(); }, []);
    useEffect(() => {
      if (!window.L || !mapBoxRef.current || mapRef.current) return;
      const indonesiaBounds = window.L.latLngBounds([[-12, 94], [7, 142]]);
      const map = window.L.map(mapBoxRef.current, {
        attributionControl: false,
        zoomControl: false,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        minZoom: 3,
        maxBounds: indonesiaBounds.pad(0.55),
        maxBoundsViscosity: 0.72,
      }).setView([-2.5, 118], 5);
      window.L.control.zoom({ position: 'bottomright' }).addTo(map);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '',
      }).addTo(map);
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 100);
      return () => { map.remove(); mapRef.current = null; };
    }, []);

    useEffect(() => {
      const map = mapRef.current;
      if (!map || !window.L) return;
      const seq = ++mapRequestSeqRef.current;
      let cancelled = false;
      mapBusyRef.current = true;
      setMapLoading(true);
      setMapFeatureCount(0);
      if (layerRef.current) {
        layerRef.current.remove();
        layerRef.current = null;
      }
      const statMap = new Map((data.province_stats || []).map(item => [normalizeName(item.province), item]));
      const geojsonScope = geojsonScopeForLevel(mapLevel, selectedRegion);
      const geojsonParams = new URLSearchParams({ level: mapLevel });
      if (geojsonScope) geojsonParams.set('scope', geojsonScope);
      fetch(freshApiUrl(`geojson.php?${geojsonParams.toString()}`), { cache: 'no-store' })
        .then(response => response.json())
        .then(geojson => {
          if (cancelled || seq !== mapRequestSeqRef.current) return;
          if (layerRef.current) layerRef.current.remove();
          const filtered = {
            ...geojson,
            features: (geojson.features || []).filter(feature => featureMatchesScope(feature, mapLevel, selectedRegion)),
          };
          const layer = window.L.geoJSON(filtered, {
            style(feature) {
              const name = featureNameByLevel(feature, mapLevel);
              const provinceStat = mapLevel === 'province' ? (statMap.get(normalizeName(name)) || {}) : {};
              const scopedStats = mapLevel === 'province'
                ? { locations: Number(provinceStat.distribution_count || 0), households: effectiveHouseholds(provinceStat) }
                : statsForScope(scopeForLevel(mapLevel, name));
              const active = normalizeName(selectedRegion[mapLevel] || '') === normalizeName(name);
              const scopedActive = !active && (
                (mapLevel === 'regency' && Boolean(selectedRegion.province))
                || (mapLevel === 'district' && Boolean(selectedRegion.regency))
                || (mapLevel === 'village' && Boolean(selectedRegion.district))
              );
              return {
                className: cx('province-shape', 'map-region-shape', `map-region-${mapLevel}`, active && 'map-region-active', scopedActive && 'map-region-scoped'),
                color: active ? '#0b3b33' : '#0f766e',
                weight: active ? 3.6 : mapLevel === 'province' ? 1.15 : 1.55,
                fillColor: active ? '#f2c76e' : scopedStats.households > 2000 ? '#0f766e' : scopedStats.locations > 25 ? '#14b8a6' : scopedStats.locations > 5 ? '#7dd3fc' : '#dbeafe',
                fillOpacity: active ? 0.74 : scopedStats.locations ? 0.48 : 0.18,
              };
            },
            onEachFeature(feature, layerItem) {
              const name = featureNameByLevel(feature, mapLevel);
              const meta = featureScopeMeta(feature, mapLevel);
              const scope = scopeForLevel(mapLevel, name, selectedRegion, meta);
              const stat = mapLevel === 'province'
                ? (statMap.get(normalizeName(name)) || {})
                : statsForScope(scope);
              const locations = mapLevel === 'province' ? Number(stat.distribution_count || 0) : Number(stat.locations || 0);
              const households = householdMetrics(stat);
              layerItem.bindTooltip(`${mapLevelLabel(mapLevel)}: ${name}`, { sticky: true, className: 'kat-map-tooltip' });
              layerItem.on({
                mouseover(event) {
                  event.target.setStyle({
                    color: '#f2c76e',
                    weight: 3.2,
                    fillOpacity: Math.max((event.target.options.fillOpacity || 0.18) + 0.2, 0.42),
                  });
                  event.target.bringToFront?.();
                },
                mouseout(event) {
                  layerRef.current?.resetStyle(event.target);
                },
                click(event) {
                  event.target.setStyle({
                    color: '#0b3b33',
                    fillColor: '#f2c76e',
                    fillOpacity: 0.8,
                    weight: 3.8,
                  });
                  event.target.bringToFront?.();
                  chooseMapRegion(mapLevel, name, event.latlng, meta);
                },
              });
              layerItem.options.title = `${name} - ${fullNumber(locations)} lokasi, ${fullNumber(households.effective)} KK final; ${householdSummaryText(stat)}`;
            },
          }).addTo(map);
          layerRef.current = layer;
          const featureCount = filtered.features?.length || 0;
          setMapFeatureCount(featureCount);
          drillRequestSeqRef.current += 1;
          setDrillOptions(featureCount ? geoOptionsFromFeatures(filtered.features, mapLevel) : []);
          setDrillLoading(false);
          if (!featureCount) {
            setMapNotice(`Layer ${mapLevelLabel(mapLevel)} belum tersedia untuk scope ini. Pilih dari daftar cepat di atas peta.`);
            loadDrillChoices(mapLevel, selectedRegion);
            mapBusyRef.current = false;
            setMapLoading(false);
            return;
          }
          setMapNotice(mapInstructionForLevel(mapLevel, selectedRegion));
          const fitLayer = () => {
            try {
              map.invalidateSize();
              const bounds = layer.getBounds();
              if (bounds.isValid()) {
                const maxZoom = mapLevel === 'province' ? 6 : mapLevel === 'regency' ? 8 : 10;
                map.fitBounds(bounds.pad(0.08), { padding: [24, 24], maxZoom, animate: false });
              }
            } catch (_) { }
          };
          requestAnimationFrame(fitLayer);
          setTimeout(fitLayer, 90);
          mapBusyRef.current = false;
          setMapLoading(false);
        })
        .catch(() => {
          if (cancelled || seq !== mapRequestSeqRef.current) return;
          mapBusyRef.current = false;
          setMapLoading(false);
          setMessage({ type: 'error', text: `GeoJSON ${mapLevelLabel(mapLevel)} belum bisa dimuat.` });
        });
      return () => { cancelled = true; };
    }, [
      mapLevel,
      selectedRegion.province,
      selectedRegion.province_code,
      selectedRegion.regency,
      selectedRegion.regency_code,
      selectedRegion.district,
      selectedRegion.district_code,
      selectedRegion.village,
      selectedRegion.village_code,
    ]);

    const summary = data.summary || {};
    const breakdowns = data.breakdowns || {};
    const selectedStat = useMemo(() => {
      if (!selectedProvince) return null;
      return (data.province_stats || []).find(item => normalizeName(item.province) === normalizeName(selectedProvince)) || null;
    }, [data.province_stats, selectedProvince]);
    const activeSources = data.source_breakdown || [];
    const items = data.items || [];
    const dataStoreMode = data.data_source || appConfig?.capabilities?.data_store_mode || '';
    const dataStoreLabel = data.data_source_label || appConfig?.capabilities?.data_store_label || '';
    const dataStoreWarning = data.warning || '';
    const dataStoreMeta = dataStoreSourceMeta(dataStoreMode, dataStoreLabel);
    const summaryHouseholds = householdMetrics(summary);
    const summaryDiffLocations = Number(summary.households_bnba_diff_locations || 0);
    const householdCardSubtitle = `${householdSummaryText(summary)}${summaryDiffLocations ? ` ${fullNumber(summaryDiffLocations)} lokasi beda angka.` : ''}`;
    const statCards = [
      { key: 'province', label: 'Persebaran Provinsi', value: summary.province_total, tone: 'blue', icon: 'Map', breakdownKey: 'province', subtitle: 'Provinsi unik setelah normalisasi' },
      { key: 'regency', label: 'Persebaran Kabupaten', value: summary.regency_total, tone: 'cyan', icon: 'Landmark', breakdownKey: 'regency', subtitle: 'Kabupaten/Kota per provinsi' },
      { key: 'district', label: 'Persebaran Kecamatan', value: summary.district_total, tone: 'emerald', icon: 'Network', breakdownKey: 'district', subtitle: 'Kecamatan dikelompokkan per provinsi' },
      { key: 'village', label: 'Persebaran Kelurahan', value: summary.village_total, tone: 'indigo', icon: 'MapPinned', breakdownKey: 'village', subtitle: 'Kelurahan/Desa per kecamatan' },
      { key: 'location', label: 'Jumlah Lokasi', value: summary.location_total || summary.distribution_total, tone: 'violet', icon: 'LocateFixed', breakdownKey: 'location', subtitle: 'Semua lokasi persebaran' },
      { key: 'households', label: 'KK final', value: summaryHouseholds.effective, tone: 'slate', icon: 'Users', breakdownKey: 'location', subtitle: householdCardSubtitle },
      { key: 'locations_with_households', label: 'Lokasi KK Terisi', value: summary.locations_with_households, tone: 'emerald', icon: 'CheckCircle2', breakdownKey: 'location', subtitle: 'Lokasi dengan KK final lebih dari 0', filter: row => effectiveHouseholds(row) > 0 },
      { key: 'locations_zero_households', label: 'Lokasi KK 0', value: summary.locations_zero_households, tone: 'amber', icon: 'CircleSlash', breakdownKey: 'location', subtitle: 'Lokasi yang masih 0 KK final', filter: row => effectiveHouseholds(row) <= 0 },
      { key: 'documents_complete', label: 'Dokumen Lengkap', value: summary.document_locations_complete, tone: 'emerald', icon: 'FolderCheck', breakdownKey: 'location', subtitle: `${fullNumber(summary.documents_complete || 0)} dari ${fullNumber(summary.documents_total || 0)} item terpenuhi`, filter: row => Number(row.documents_total || 0) > 0 && Number(row.documents_complete || 0) === Number(row.documents_total || 0) },
      { key: 'documents_missing', label: 'Dokumen Belum Lengkap', value: summary.document_locations_missing, tone: 'amber', icon: 'Files', breakdownKey: 'location', subtitle: `${fullNumber(summary.document_locations_started || 0)} lokasi sudah mulai dilengkapi`, filter: row => Number(row.documents_complete || 0) < Number(row.documents_total || 0) },
    ];
    const activeStatDetail = statCards.find(stat => stat.key === statDetailKey) || null;
    const statDetailRows = activeStatDetail
      ? ((breakdowns[activeStatDetail.breakdownKey] || []).filter(activeStatDetail.filter || (() => true)))
      : [];
    const activeScopeTitle = selectedRegion.village || selectedRegion.district || selectedRegion.regency || selectedRegion.province || selectedProvince;
    const activeScopeStats = selectedRegion.province ? statsForScope(selectedRegion) : null;
    const selectedProvinceHouseholds = householdMetrics(selectedStat || {});
    const activeLocations = activeScopeStats ? activeScopeStats.locations : Number(selectedStat?.distribution_count || 0);
    const activeHouseholds = activeScopeStats ? activeScopeStats.effective_households_total : selectedProvinceHouseholds.effective;
    const activeDistributionHouseholds = activeScopeStats ? activeScopeStats.distribution_households_total : selectedProvinceHouseholds.distribution;
    const activeBnbaHouseholds = activeScopeStats ? activeScopeStats.bnba_households_total : selectedProvinceHouseholds.bnba;
    const activeDiffLocations = activeScopeStats ? activeScopeStats.households_bnba_diff_locations : Number(selectedStat?.households_bnba_diff_locations || 0);
    return h('main', { className: 'home-map grid gap-5' },
      h('section', { className: 'stat-grid grid gap-3' },
        statCards.map(stat => h(StatCard, {
          key: stat.key,
          label: stat.label,
          value: stat.value,
          tone: stat.tone,
          icon: stat.icon,
          subtitle: stat.subtitle,
          active: statDetailKey === stat.key,
          loading,
          onClick: () => setStatDetailKey(stat.key),
        }))
      ),
      h(LinkArchiveHome, { onOpenArchive }),
      activeStatDetail ? h(StatDetailModal, { stat: activeStatDetail, rows: statDetailRows, onClose: () => setStatDetailKey('') }) : null,
      h('section', { className: 'map-layout grid min-h-[640px] gap-4' },
        h('div', { className: 'map-shell min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm' },
          h('div', { ref: mapBoxRef, className: 'h-[520px] w-full lg:h-full' }),
          h('div', { className: cx('map-drill-panel', mapPanelCollapsed && 'is-collapsed', mapLoading && 'is-loading') },
            h('div', { className: 'map-drill-head' },
              h('span', { className: 'map-drill-icon' }, h(Icon, { name: mapLevelMeta.icon, size: 16 })),
              h('span', { className: 'map-drill-copy' },
                h('strong', null, `Mode ${mapLevelMeta.label}`),
                h('small', null, mapNotice || 'Klik wilayah di peta untuk memilih level berikutnya.')
              ),
              h('span', { className: 'map-drill-actions' },
                h('button', { type: 'button', onClick: () => setMapPanelCollapsed(current => !current), title: mapPanelCollapsed ? 'Buka panel mode' : 'Minimize panel mode' }, h(Icon, { name: mapPanelCollapsed ? 'Maximize2' : 'Minimize2', size: 15 })),
                selectedTrail.length || mapLevel !== 'province' ? h('button', { type: 'button', onClick: stepMapBack, title: 'Kembali satu level' }, h(Icon, { name: 'ChevronLeft', size: 15 })) : null,
                selectedTrail.length || mapLevel !== 'province' ? h('button', { type: 'button', onClick: resetMapDrill, title: 'Reset peta' }, h(Icon, { name: 'RotateCcw', size: 15 })) : null
              )
            ),
            !mapPanelCollapsed && selectedTrail.length ? h('div', { className: 'map-drill-trail' },
              selectedTrail.map(item => h('span', { key: item.key }, `${item.label}: ${item.value}`))
            ) : null,
            !mapPanelCollapsed && (drillLoading || drillOptions.length || (mapLevel !== 'province' && selectedTrail.length)) ? h('div', { className: 'map-drill-options' },
              drillLoading ? h('span', { className: 'map-drill-loading' }, 'Memuat pilihan...') :
                drillOptions.length ? drillOptions.slice(0, 12).map(option => h('button', { key: `${mapLevel}-${option.name}-${option.subtitle || ''}`, type: 'button', onClick: () => chooseDrillOption(option), title: option.subtitle || option.name },
                  h('span', null, option.name),
                  option.count ? h('small', null, compactNumber(option.count)) : null
                )) : h('span', { className: 'map-drill-empty' }, `Belum ada daftar ${mapLevelMeta.label} untuk scope ini. Admin bisa upload GeoJSON atau data persebaran tambahan.`)
            ) : null
          )
        ),
        h('aside', { className: 'map-side-panel rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-xl' },
          h('div', { className: 'grid gap-3' },
            h('div', { className: 'flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100' },
              h('span', { className: 'text-xs font-black uppercase text-slate-500' }, 'Sumber database aktif'),
              h(DataStoreSourceBadge, { mode: dataStoreMode, label: dataStoreLabel, prefix: 'Data', warning: dataStoreWarning })
            ),
            h(Field, { label: 'Cari wilayah dan komunitas' },
              h(TextInput, { value: query, onChange: event => setQuery(event.target.value), onKeyDown: event => { if (event.key === 'Enter') loadData(); }, placeholder: 'Contoh: NTB, Bima, Tambora, Labuan Kananga' })
            ),
            h('div', { className: 'grid grid-cols-[1fr_auto] gap-2' },
              h(TextInput, { value: selectedProvince, onChange: event => setSelectedProvince(event.target.value), placeholder: 'Filter provinsi' }),
              h(Button, { type: 'button', variant: 'blue', onClick: () => loadData(), disabled: loading, className: 'gap-2 px-3' }, h(Icon, { name: loading ? 'LoaderCircle' : 'Search', size: 17 }), loading ? '...' : 'Cari')
            ),
            selectedProvince || selectedSource ? h('div', { className: 'flex flex-wrap gap-2' },
              selectedProvince ? h(Button, { type: 'button', variant: 'soft', className: 'h-9 gap-2 px-3 text-xs', onClick: () => { setSelectedProvince(''); loadData({ province: '' }); } }, h(Icon, { name: 'X', size: 14 }), 'Provinsi') : null,
              selectedSource ? h(Button, { type: 'button', variant: 'soft', className: 'h-9 gap-2 px-3 text-xs', onClick: () => { setSelectedSource(''); loadData({ source: '' }); } }, h(Icon, { name: 'X', size: 14 }), 'Sumber') : null
            ) : null,
            h(Button, {
              type: 'button',
              variant: 'success',
              onClick: () => setProposalModalOpen(true),
              className: 'w-full gap-2 text-xs font-black shadow-xs my-1 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white py-2.5 rounded-xl border border-purple-800'
            },
              h(Icon, { name: 'FilePlus', size: 16 }),
              'Usulkan Data KAT Baru (Publik)'
            ),
            h(Notice, { message })
          ),
          proposalModalOpen ? h(KatProposalModal, {
            isOpen: proposalModalOpen,
            onClose: () => setProposalModalOpen(false),
            onSuccess: () => loadData()
          }) : null,
          selectedProvince ? h('div', { className: 'region-detail mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4' },
            h('div', { className: 'flex items-start justify-between gap-3' },
              h('div', { className: 'min-w-0' },
                h('p', { className: 'text-xs font-black uppercase text-slate-500' }, 'Detail wilayah dipilih'),
                h('h2', { className: 'mt-1 break-words text-lg font-black text-slate-950', title: activeScopeTitle }, activeScopeTitle)
              ),
              h(Badge, { status: selectedStat ? 'checked' : 'pending' }, selectedStat ? 'ada data' : 'kosong')
            ),
            selectedTrail.length ? h('div', { className: 'map-side-trail mt-3' },
              selectedTrail.map(item => h('span', { key: item.key }, `${item.label}: ${item.value}`))
            ) : null,
            h('div', { className: 'mt-3 grid grid-cols-2 gap-2 text-xs' },
              h(MiniMetric, { icon: 'LocateFixed', label: 'Lokasi', value: fullNumber(activeLocations) }),
              h(MiniMetric, { icon: 'Users', label: 'KK final', value: fullNumber(activeHouseholds) }),
              h(MiniMetric, { icon: 'Table', label: 'KK by Excel', value: fullNumber(activeDistributionHouseholds) }),
              h(MiniMetric, { icon: 'FileSpreadsheet', label: 'KK by padan', value: fullNumber(activeBnbaHouseholds) }),
              activeDiffLocations ? h(MiniMetric, { icon: 'Activity', label: 'Lokasi beda angka', value: fullNumber(activeDiffLocations) }) : null,
              h(MiniMetric, { icon: dataStoreMeta.icon, label: 'Database', value: dataStoreMeta.label }),
              h(MiniMetric, { icon: 'ListFilter', label: 'Filter sumber', value: selectedSource || 'Semua' }),
              h(MiniMetric, { icon: 'ListFilter', label: 'Daftar tampil', value: fullNumber(items.length) })
            ),
            activeSources.length ? h('div', { className: 'mt-3 grid gap-2' },
              h('p', { className: 'text-xs font-black uppercase text-slate-500' }, 'Sumber data'),
              h(SourcePills, { sources: activeSources, selectedSource, onSelect: source => { setSelectedSource(source); loadData({ source }); } })
            ) : null,
            h('div', { className: 'mt-3' },
              h(Button, { type: 'button', variant: 'blue', className: 'w-full gap-2', onClick: () => onStartPadan?.(seedFromScope(selectedRegion.province ? selectedRegion : { province: selectedProvince })) },
                h(Icon, { name: 'UploadCloud', size: 16 }),
                'Padankan wilayah ini'
              )
            )
          ) : activeSources.length ? h('div', { className: 'mt-4 grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4' },
            h('div', { className: 'flex items-center justify-between gap-3' },
              h('p', { className: 'flex items-center gap-2 text-xs font-black uppercase text-slate-500' }, h(Icon, { name: 'ListFilter', size: 14 }), 'Sumber data aktif'),
              selectedSource ? h('button', { type: 'button', className: 'text-xs font-black text-blue-700 hover:text-blue-900', onClick: () => { setSelectedSource(''); loadData({ source: '' }); } }, 'Semua') : null
            ),
            h(SourcePills, { sources: activeSources, selectedSource, onSelect: source => { setSelectedSource(source); loadData({ source }); } })
          ) : null,
          selectedItem ? h('div', { className: 'mt-4' }, h(LocationDetailPanel, {
            item: selectedItem,
            onClose: () => setSelectedItem(null),
            onStartPadan,
            onDocumentsSaved: updatedItem => {
              setSelectedItem(current => current ? { ...updatedItem, __idx: current.__idx } : current);
              setData(current => ({
                ...current,
                items: (current.items || []).map(row => Number(row.distribution_id || 0) === Number(updatedItem.distribution_id || 0) ? { ...row, ...updatedItem } : row),
              }));
            },
          })) : null,
          h('div', { className: 'location-list mt-4 grid max-h-[470px] gap-3 overflow-auto pr-1' },
            items.length ? items.map((item, idx) => {
              const key = locationItemKey(item, idx);
              const selected = (selectedItem && locationItemKey(selectedItem, selectedItem.__idx ?? idx) === key) || locationScopeSelected(item);
              const households = householdMetrics(item);
              return h('article', { key, className: cx('location-card rounded-2xl border p-3 transition-colors duration-150', selected ? 'is-map-linked border-blue-200 bg-blue-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white') },
                h('button', { type: 'button', className: 'location-card-main text-left', onClick: () => selectLocationOnMap(item, idx) },
                  h('div', { className: 'flex items-start justify-between gap-3' },
                    h('div', { className: 'min-w-0' },
                      h('p', { className: 'break-words text-sm font-black text-slate-950', title: item.title }, item.title || '-'),
                      h('p', { className: 'mt-1 text-xs leading-5 text-slate-500' }, itemLocationLine(item))
                    ),
                    h('span', { className: 'flex shrink-0 items-center gap-2' },
                      h(Badge, { status: item.status }, item.status),
                      item.bnba_summary?.has_bnba ? h(Badge, { status: 'checked' }, 'BNBA') : null,
                      Number(item.documents_total || 0) ? h(Badge, { status: Number(item.documents_complete || 0) === Number(item.documents_total || 0) ? 'checked' : 'pending' }, `${fullNumber(item.documents_complete || 0)}/${fullNumber(item.documents_total || 0)} dok.`) : null,
                      h(Icon, { name: 'ChevronRight', size: 16, className: 'text-slate-400' })
                    )
                  ),
                  item.address ? h('p', { className: 'mt-2 break-words text-xs leading-5 text-slate-600' }, item.address) : null,
                  h('div', { className: 'mt-2 flex flex-wrap items-center gap-2 text-xs font-black text-slate-600' },
                    households.distribution ? h('span', { className: 'inline-flex items-center gap-1 rounded-full px-2 py-1', title: householdSummaryText(item) }, h(Icon, { name: 'Table', size: 13 }), `${fullNumber(households.distribution)} KK by Excel`) : null,
                    households.bnba ? h('span', { className: 'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-700 ring-1 ring-emerald-200', title: householdSummaryText(item) }, h(Icon, { name: 'FileSpreadsheet', size: 13 }), `${fullNumber(households.bnba)} KK by padan`) : null,
                    !households.distribution && !households.bnba && households.effective ? h('span', { className: 'inline-flex items-center gap-1 rounded-full px-2 py-1', title: householdSummaryText(item) }, h(Icon, { name: 'Users', size: 13 }), `${fullNumber(households.effective)} KK final`) : null,
                    households.delta ? h('span', { className: 'inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700 ring-1 ring-amber-200' }, h(Icon, { name: 'Activity', size: 13 }), `${households.delta > 0 ? '+' : ''}${fullNumber(households.delta)}`) : null,
                    item.source_data ? h('span', { className: 'max-w-full break-words rounded-full px-2 py-1', title: item.source_data }, item.source_data) : null,
                    item.data_year ? h('span', { className: 'rounded-full px-2 py-1' }, item.data_year) : null
                  )
                ),
                h('button', { type: 'button', className: 'location-card-padan', onClick: () => onStartPadan?.(item) },
                  h(Icon, { name: 'UploadCloud', size: 14 }),
                  'Padankan lokasi ini'
                )
              );
            }) : h('div', { className: 'rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-500' }, 'Belum ada data pada filter ini.')
          )
        )
      ),
      selectedItem ? h(BnbaLocationTable, { item: selectedItem }) : null
    );
  }

  function RegionFields({ value, onChange }) {
    const [options, setOptions] = useState({ province: [], regency: [], district: [], village: [], location: [], community: [] });
    const [loading, setLoading] = useState({});
    const update = patch => onChange({ ...value, ...patch });

    async function load(level, params = {}, q = '') {
      setLoading(current => ({ ...current, [level]: true }));
      try {
        const query = new URLSearchParams({ level, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)) });
        if (String(q || '').trim()) query.set('q', String(q).trim());
        const data = await apiRequest(`regions.php?${query.toString()}`);
        setOptions(current => ({ ...current, [level]: data.regions || [] }));
      } catch (_) {
        setOptions(current => ({ ...current, [level]: [] }));
      } finally {
        setLoading(current => ({ ...current, [level]: false }));
      }
    }

    function scopedParams(level) {
      const params = {};
      if (level !== 'province' && value.province) params.province = value.province;
      if (['district', 'village', 'location', 'community'].includes(level) && value.regency) params.regency = value.regency;
      if (['village', 'location', 'community'].includes(level) && value.district) params.district = value.district;
      if (['location', 'community'].includes(level) && value.village) params.village = value.village;
      if (level === 'community' && value.location) params.location = value.location;
      return params;
    }

    useEffect(() => {
      ['province', 'regency', 'district', 'village', 'location', 'community'].forEach(level => load(level, scopedParams(level)));
    }, []);
    useEffect(() => {
      setOptions(current => ({ ...current, regency: [], district: [], village: [], location: [], community: [] }));
      load('regency', scopedParams('regency'));
      load('district', scopedParams('district'));
      load('village', scopedParams('village'));
      load('location', scopedParams('location'));
      load('community', scopedParams('community'));
    }, [value.province]);
    useEffect(() => {
      setOptions(current => ({ ...current, district: [], village: [], location: [], community: [] }));
      load('district', scopedParams('district'));
      load('village', scopedParams('village'));
      load('location', scopedParams('location'));
      load('community', scopedParams('community'));
    }, [value.province, value.regency]);
    useEffect(() => {
      setOptions(current => ({ ...current, village: [], location: [], community: [] }));
      load('village', scopedParams('village'));
      load('location', scopedParams('location'));
      load('community', scopedParams('community'));
    }, [value.province, value.regency, value.district]);
    useEffect(() => {
      setOptions(current => ({ ...current, location: [], community: [] }));
      load('location', scopedParams('location'));
      load('community', scopedParams('community'));
    }, [value.province, value.regency, value.district, value.village]);
    useEffect(() => {
      setOptions(current => ({ ...current, community: [] }));
      load('community', scopedParams('community'));
    }, [value.province, value.regency, value.district, value.village, value.location]);
    useEffect(() => {
      if (!value.community_name && (options.community || []).length === 1) {
        update({ community_name: options.community[0].name || '' });
      }
    }, [options.community]);

    function optionScope(level, selected, fallbackValue = '') {
      const item = selected && typeof selected === 'object' ? selected : {};
      const selectedValue = fallbackValue || item.name || '';
      const patch = {};
      if (level === 'province') patch.province = selectedValue;
      if (level === 'regency') patch.regency = selectedValue;
      if (level === 'district') patch.district = selectedValue;
      if (level === 'village') patch.village = selectedValue;
      if (level === 'location') patch.location = selectedValue;
      if (level === 'community') patch.community_name = selectedValue;
      if (level === 'province') Object.assign(patch, { regency: '', district: '', village: '', location: '', community_name: '' });
      if (level === 'regency') Object.assign(patch, { district: '', village: '', location: '', community_name: '' });
      if (level === 'district') Object.assign(patch, { village: '', location: '', community_name: '' });
      if (level === 'village') Object.assign(patch, { location: '', community_name: '' });
      if (level === 'location') Object.assign(patch, { community_name: '' });
      const allowedKeys = {
        province: ['province'],
        regency: ['province', 'regency'],
        district: ['province', 'regency', 'district'],
        village: ['province', 'regency', 'district', 'village'],
        location: ['province', 'regency', 'district', 'village', 'location'],
        community: ['province', 'regency', 'district', 'village', 'location', 'community_name'],
      }[level] || [];
      allowedKeys.forEach(key => {
        if (item[key]) patch[key] = item[key];
      });
      return patch;
    }

    async function resolveScopeFromMap(level, nextValue) {
      if (!nextValue || level === 'province' || level === 'regency') return null;
      try {
        const params = new URLSearchParams({ limit: '80', q: nextValue });
        const result = normalizeMapDataPayload(await apiRequest(`map_data.php?${params.toString()}`));
        const field = level === 'community' ? 'community_name' : level;
        const exactNeedle = normalizeName(nextValue);
        const current = value || {};
        const rows = Array.isArray(result.items) ? result.items : [];
        return rows.find(item => {
          if (normalizeName(item?.[field]) !== exactNeedle) return false;
          return ['province', 'regency', 'district', 'village', 'location', 'community_name'].every(key => {
            if (!current[key]) return true;
            return compatibleRegionText(current[key], item?.[key]);
          });
        }) || rows.find(item => normalizeName(item?.[field]) === exactNeedle) || null;
      } catch (_) {
        return null;
      }
    }

    function itemHasScopeForLevel(level, item) {
      if (!item || typeof item !== 'object') return false;
      if (level === 'district') return Boolean(item.province && item.regency);
      if (level === 'village') return Boolean(item.province && item.regency && item.district);
      if (level === 'location') return Boolean(item.province && item.regency && item.village);
      if (level === 'community') return Boolean(item.province && item.regency);
      return true;
    }

    async function changeLevel(level, nextValue, selected = null) {
      if (!nextValue) {
        const patch = { [level === 'community' ? 'community_name' : level]: '' };
        if (level === 'province') Object.assign(patch, { regency: '', district: '', village: '', location: '', community_name: '' });
        if (level === 'regency') Object.assign(patch, { district: '', village: '', location: '', community_name: '' });
        if (level === 'district') Object.assign(patch, { village: '', location: '', community_name: '' });
        if (level === 'village') Object.assign(patch, { location: '', community_name: '' });
        if (level === 'location') Object.assign(patch, { community_name: '' });
        update(patch);
        return;
      }
      update(optionScope(level, selected, nextValue));
      if (!itemHasScopeForLevel(level, selected)) {
        const resolved = await resolveScopeFromMap(level, nextValue);
        if (resolved) update(optionScope(level, { ...resolved, name: nextValue }, nextValue));
      }
    }

    function regionSubtitle(level, item) {
      const parts = [];
      if (level !== 'province' && item.province) parts.push(item.province);
      if (!['province', 'regency'].includes(level) && item.regency) parts.push(item.regency);
      if (['village', 'location', 'community'].includes(level) && item.district) parts.push(item.district);
      if (['location', 'community'].includes(level) && item.village) parts.push(item.village);
      if (level === 'community' && item.location) parts.push(item.location);
      return parts.join(' / ');
    }

    function selectOptions(level) {
      const rows = Array.isArray(options[level]) ? options[level] : [];
      const names = new Set(rows.map(item => item.name).filter(Boolean));
      const selected = level === 'community' ? value.community_name || '' : value[level] || '';
      const merged = selected && !names.has(selected) ? [{ name: selected, count: null }, ...rows] : rows;
      return merged.map(item => h('option', {
        key: `${level}-${item.name}-${regionSubtitle(level, item)}`,
        value: item.name,
        meta: item,
        subtitle: regionSubtitle(level, item),
      }, item.count ? `${item.name} (${compactNumber(item.count)})` : item.name));
    }

    function regionSelect(level, label, placeholder, disabled = false, hint = null) {
      const fieldValue = level === 'community' ? value.community_name || '' : value[level] || '';
      return h(Field, { label, hint },
        h(SelectInput, {
          value: fieldValue,
          disabled,
          searchable: true,
          allowCustom: true,
          searchPlaceholder: `Cari ${label.toLowerCase()}...`,
          customOptionLabel: text => `Gunakan "${text}" sebagai ${label}`,
          onSearch: text => load(level, scopedParams(level), text),
          onChange: event => { if (!event.target.value) changeLevel(level, ''); },
          onSelectOption: selected => changeLevel(level, selected?.name || '', selected),
        },
          h('option', { value: '' }, loading[level] ? 'Memuat...' : placeholder),
          selectOptions(level)
        )
      );
    }

    const noDistrict = Boolean(value.regency) && !loading.district && !(options.district || []).length;
    const noVillage = Boolean(value.district) && !loading.village && !(options.village || []).length;
    const noLocation = Boolean(value.village || value.regency) && !loading.location && !(options.location || []).length;
    const communityRows = Array.isArray(options.community) ? options.community : [];
    const communityNames = new Set(communityRows.map(item => item.name).filter(Boolean));
    const communityOptions = value.community_name && !communityNames.has(value.community_name)
      ? [{ name: value.community_name }, ...communityRows]
      : communityRows;

    return h('div', { className: 'region-fieldset' },
      h('div', { className: 'region-grid' },
        regionSelect('province', 'Provinsi', 'Pilih atau cari provinsi'),
        regionSelect('regency', 'Kabupaten/Kota', 'Pilih atau cari kabupaten/kota'),
        regionSelect('district', 'Kecamatan/Distrik', 'Pilih atau cari kecamatan/distrik', false, noDistrict ? 'Belum ada data kecamatan untuk filter ini.' : null),
        regionSelect('village', 'Desa/Kelurahan/Kampung', 'Pilih atau cari desa/kelurahan', false, noVillage ? 'Belum ada data desa untuk filter ini.' : null),
        regionSelect('location', 'Lokasi/Dusun', 'Pilih atau cari lokasi/dusun', false, noLocation ? 'Belum ada lokasi persebaran pada filter ini.' : null),
        regionSelect('community', 'Komunitas KAT', 'Pilih atau cari komunitas KAT')
      ),
      h('p', { className: 'region-note' }, 'Bisa mulai dari provinsi, kabupaten/kota, kecamatan, desa, lokasi/dusun, atau komunitas. Pilihan level bawah akan otomatis mengisi wilayah di atasnya dari data persebaran.')
    );
  }

  function PadanDataPage({ appConfig, initialRegion, initialShortCode = '' }) {
    const [email, setEmail] = useState('');
    const [file, setFile] = useState(null);
    const [draft, setDraft] = useState(null);
    const [selectedSheet, setSelectedSheet] = useState('');
    const [sheetMode, setSheetMode] = useState('single');
    const [sheetConfigs, setSheetConfigs] = useState({});
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(null);
    const [message, setMessage] = useState(null);
    const [queued, setQueued] = useState(null);
    const [jobMode, setJobMode] = useState('nik_only');
    const [region, setRegion] = useState({ province: '', regency: '', district: '', village: '', location: '', community_name: '' });
    const [regionContext, setRegionContext] = useState(null);
    const [wantsFix, setWantsFix] = useState(false);
    const [fixConfirm, setFixConfirm] = useState(null);

    const sheets = draft?.preview?.sheets || [];
    const selectedMeta = sheets.find(sheet => sheet.name === selectedSheet) || sheets[0] || {};
    const selectedConfig = buildSheetConfig(selectedMeta, sheetConfigs[selectedSheet] || {}, true);
    const selectedBasicSummary = basicExcelSummary(selectedMeta);
    const columns = selectedMeta.columns || [];
    const needsRegion = jobMode === 'padan';

    useEffect(() => {
      if (!initialRegion?.__id) return;
      const nextRegion = {
        province: initialRegion.province || '',
        regency: initialRegion.regency || '',
        district: initialRegion.district || '',
        village: initialRegion.village || '',
        location: initialRegion.location || '',
        community_name: initialRegion.community_name || '',
      };
      setJobMode('padan');
      setRegion(current => ({ ...current, ...nextRegion }));
      setRegionContext(initialRegion);
      setWantsFix(false);
      setMessage({ type: 'info', text: 'Wilayah dari peta sudah dimasukkan. Pilih file Excel/CSV untuk langsung dipadankan ke lokasi ini.' });
    }, [initialRegion?.__id]);

    function changeJobMode(nextMode) {
      setJobMode(nextMode);
      setFixConfirm(null);
      if (nextMode === 'nik_only') setWantsFix(false);
    }

    function applyPreview(preview) {
      const nextSheets = preview?.sheets || [];
      const sheetName = preview?.selected_sheet || nextSheets[0]?.name || '';
      setSelectedSheet(sheetName);
      setRows(nextSheets.find(sheet => sheet.name === sheetName)?.preview || []);
      setSheetConfigs(current => {
        const next = {};
        nextSheets.forEach((sheet, idx) => {
          next[sheet.name] = buildSheetConfig(sheet, current[sheet.name] || {}, idx === 0);
        });
        return next;
      });
    }

    function updateConfig(sheetName, patch) {
      const sheet = sheets.find(item => item.name === sheetName) || {};
      setSheetConfigs(current => ({ ...current, [sheetName]: { ...buildSheetConfig(sheet, current[sheetName] || {}, sheetName === selectedSheet), ...patch } }));
    }

    function mappings() {
      const selected = sheetMode === 'single' ? [selectedSheet] : sheets.filter(sheet => sheetConfigs[sheet.name]?.enabled).map(sheet => sheet.name);
      return selected.map(name => {
        const sheet = sheets.find(item => item.name === name) || {};
        const config = buildSheetConfig(sheet, sheetConfigs[name] || {}, sheetMode === 'single');
        return {
          sheet_name: name,
          nik_column: config.nik_column,
          kk_column: config.kk_column || null,
          header_row_index: Number.isInteger(config.header_row_index) ? config.header_row_index : null,
        };
      }).filter(item => item.sheet_name && item.nik_column);
    }

    async function uploadDraft(event) {
      event.preventDefault();
      setMessage(null);
      setQueued(null);
      const allowed = appConfig.allowed_extensions || SUPPORTED_EXTENSIONS;
      if (!file) return setMessage({ type: 'error', text: 'Pilih file dulu.' });
      if (!isSupportedFile(file, allowed)) return setMessage({ type: 'error', text: `Format file tidak didukung. Gunakan ${supportedLabel(allowed)}.` });
      if (Number(file.size || 0) > Number(appConfig.max_upload_bytes || 0)) return setMessage({ type: 'error', text: `Ukuran file melebihi ${formatBytes(appConfig.max_upload_bytes)}.` });
      setLoading(true);
      setProgress(0);
      try {
        const form = new FormData();
        form.append('email', email);
        form.append('file', file);
        const data = await uploadFormWithProgress(apiUrl('upload.php'), form, setProgress);
        setDraft(data);
        applyPreview(data.preview);
        setMessage({ type: 'info', text: needsRegion ? 'File berhasil dibaca. Lengkapi wilayah, komunitas, dan kolom NIK/KK.' : 'File berhasil dibaca. Pilih kolom NIK/KK lalu simpan ke antrian.' });
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    async function changeSheet(sheetName, limit = 5) {
      setSelectedSheet(sheetName);
      if (!draft?.token) return;
      setLoading(true);
      try {
        const config = sheetConfigs[sheetName] || {};
        const data = await apiRequest('preview.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: draft.token, sheet_name: sheetName, header_row_index: config.header_row_index ?? null, limit }),
        });
        setDraft(current => current ? { ...current, preview: data.preview } : current);
        applyPreview(data.preview);
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    async function createJob(confirmExisting = false, wantsFixOverride = wantsFix) {
      const sheetMappings = mappings();
      if (!draft?.token) return;
      if (!sheetMappings.length) return setMessage({ type: 'error', text: 'Pilih sheet dan kolom NIK dulu.' });
      if (needsRegion && (!region.province || !region.regency)) return setMessage({ type: 'error', text: 'Provinsi dan kabupaten/kota wajib dipilih/diisi.' });
      const stats = nikStats(rows, sheetMappings[0]?.nik_column);
      if (stats.sample > 0 && stats.valid === 0) return setMessage({ type: 'error', text: 'Kolom NIK yang dipilih belum terlihat berisi NIK 16 digit.' });
      setLoading(true);
      setMessage(null);
      try {
        const data = await apiRequest('jobs.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: draft.token,
            email,
            sheet_name: selectedSheet,
            nik_column: sheetMappings[0]?.nik_column || '',
            kk_column: sheetMappings[0]?.kk_column || null,
            header_row_index: sheetMappings[0]?.header_row_index ?? null,
            sheet_mode: sheetMode,
            sheet_mappings: sheetMappings,
            preview_rows: rows.slice(0, 25),
            job_mode: jobMode,
            target_province: needsRegion ? region.province : '',
            target_regency: needsRegion ? region.regency : '',
            target_district: needsRegion ? region.district : '',
            target_village: needsRegion ? region.village : '',
            target_location: needsRegion ? region.location : '',
            community_name: needsRegion ? region.community_name : '',
            wants_fix: needsRegion && Boolean(wantsFixOverride),
            confirmed_existing_fix: Boolean(confirmExisting),
          }),
        });
        setQueued(data.job);
        setDraft(null);
        setFile(null);
        setRows([]);
        setProgress(null);
        setMessage({ type: 'info', text: `Job #${data.job.id} masuk antrian. ${data.job.queue_ahead ? `${data.job.queue_ahead} job di depan. ` : ''}${data.job.wants_fix ? 'Akan diajukan fix setelah selesai.' : ''}` });
      } catch (error) {
        if (error.data?.requires_fix_confirmation) {
          setFixConfirm(error.data.existing_fix || {});
        } else {
          setMessage({ type: 'error', text: error.message });
        }
      } finally {
        setLoading(false);
      }
    }

    return h('main', { className: 'padan-layout' },
      h('section', { className: 'grid gap-5' },
        h('form', { className: 'panel panel-solid padan-upload', onSubmit: uploadDraft },
          h('div', { className: 'section-head' },
            h('div', null,
              h('p', { className: 'section-kicker' }, needsRegion ? 'Pilih wilayah lalu unggah' : 'Unggah file NIK'),
              h('h2', { className: 'section-title' }, needsRegion ? 'Padan data BNBA' : 'Cek NIK saja')
            ),
            h('span', { className: 'section-pill' }, supportedLabel(appConfig.allowed_extensions || SUPPORTED_EXTENSIONS))
          ),
          h('div', { className: 'form-grid mt-4' },
            h(Field, { label: 'Email notifikasi', hint: emailHint(appConfig) },
              h(TextInput, { type: 'email', value: email, onChange: event => setEmail(event.target.value), placeholder: emailPlaceholder(appConfig), required: true })
            )
          ),
          h('div', { className: 'mt-4' },
            h(FileDropzone, {
              file,
              onFile: setFile,
              accept: (appConfig.allowed_extensions || SUPPORTED_EXTENSIONS).map(ext => `.${ext}`).join(','),
              hint: `Maks ${formatBytes(appConfig.max_upload_bytes)}. Preview sheet dan kolom akan muncul setelah file dibaca.`,
            })
          ),
          h('div', { className: 'mode-switch mt-4', role: 'group', 'aria-label': 'Mode pengecekan' },
            h('button', { type: 'button', className: cx('mode-option', jobMode === 'nik_only' && 'is-active'), onClick: () => changeJobMode('nik_only') },
              h('span', { className: 'mode-option-title' }, 'Cek NIK saja'),
              h('span', { className: 'mode-option-meta' }, 'Tanpa wilayah')
            ),
            h('button', { type: 'button', className: cx('mode-option', jobMode === 'padan' && 'is-active'), onClick: () => changeJobMode('padan') },
              h('span', { className: 'mode-option-title' }, 'Padan wilayah KAT'),
              h('span', { className: 'mode-option-meta' }, 'Dengan komunitas')
            )
          ),
          needsRegion && regionContext ? h('div', { className: 'padan-context-banner' },
            h('span', { className: 'padan-context-icon' }, h(Icon, { name: 'MapPinned', size: 18 })),
            h('span', { className: 'padan-context-copy' },
              h('strong', null, regionContext.__label || 'Wilayah KAT terpilih'),
              h('small', null, [region.province, region.regency, region.district, region.village, region.location, region.community_name].filter(Boolean).join(' / ') || 'Wilayah dari peta')
            ),
            h('button', { type: 'button', className: 'padan-context-clear', onClick: () => setRegionContext(null), title: 'Sembunyikan konteks' }, h(Icon, { name: 'X', size: 15 }))
          ) : null,
          needsRegion ? h('div', { className: 'mt-4' }, h(RegionFields, { value: region, onChange: setRegion })) : null,
          progress !== null ? h('div', { className: 'mt-4 h-2 overflow-hidden rounded-full bg-slate-100' }, h('div', { className: 'h-full rounded-full bg-blue-600', style: { width: `${progress}%`, transition: 'width 220ms cubic-bezier(0.2, 0.8, 0.2, 1)' } })) : null,
          h('div', { className: 'action-row mt-4' }, h(Button, { type: 'submit', variant: 'blue', disabled: loading }, loading ? 'Membaca...' : 'Upload dan preview'))
        ),
        h(Notice, { message }),
        draft ? h('section', { className: 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm' },
          h('div', { className: 'flex flex-col gap-3 md:flex-row md:items-end md:justify-between' },
            h('div', null,
              h('h2', { className: 'text-xl font-black text-slate-950' }, needsRegion ? 'Konfirmasi padan data' : 'Konfirmasi cek NIK'),
              h('p', { className: 'mt-1 text-sm text-slate-500' }, needsRegion ? `${sheets.length} sheet terbaca. Metadata wilayah akan ikut tersimpan ke database.` : `${sheets.length} sheet terbaca. Job ini disimpan tanpa metadata wilayah.`)
            ),
            h('div', { className: 'flex flex-wrap gap-2' },
              h(Button, { type: 'button', variant: sheetMode === 'single' ? 'primary' : 'soft', onClick: () => setSheetMode('single') }, 'Sheet ini'),
              h(Button, { type: 'button', variant: sheetMode === 'multiple' ? 'primary' : 'soft', onClick: () => setSheetMode('multiple') }, 'Beberapa sheet')
            )
          ),
          needsRegion ? h('div', { className: 'mt-5 grid gap-4' },
            h('label', { className: 'flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800' },
              h('input', { type: 'checkbox', checked: wantsFix, onChange: event => setWantsFix(event.target.checked), className: 'mt-1 h-4 w-4' }),
              h('span', null, 'Ajukan hasil job ini sebagai kandidat data fix setelah worker selesai.')
            )
          ) : null,
          h('div', { className: 'mt-5 grid gap-4 md:grid-cols-3' },
            h(Field, { label: 'Sheet aktif' },
              h(SelectInput, { value: selectedSheet, onChange: event => changeSheet(event.target.value) }, sheets.map(sheet => h('option', { key: sheet.name, value: sheet.name }, `${sheet.name} (${compactNumber(sheet.row_count || sheet.preview?.length || 0)} baris)`)))
            ),
            h(Field, { label: 'Kolom NIK' },
              h(SelectInput, { value: selectedConfig.nik_column, onChange: event => updateConfig(selectedSheet, { nik_column: event.target.value }) }, columns.map(column => h('option', { key: column, value: column }, column)))
            ),
            h(Field, { label: 'Kolom KK' },
              h(SelectInput, { value: selectedConfig.kk_column, onChange: event => updateConfig(selectedSheet, { kk_column: event.target.value }) },
                h('option', { value: '' }, 'Tidak dipakai'),
                columns.map(column => h('option', { key: column, value: column }, column))
              )
            )
          ),
          h('div', { className: 'mt-4' }, h(BasicExcelSummary, { summary: selectedBasicSummary })),
          sheetMode === 'multiple' ? h('div', { className: 'mt-5 grid gap-3 md:grid-cols-2' },
            sheets.map(sheet => {
              const config = buildSheetConfig(sheet, sheetConfigs[sheet.name] || {}, false);
              return h('label', { key: sheet.name, className: cx('rounded-2xl border p-4', config.enabled ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50') },
                h('div', { className: 'flex items-center gap-3' },
                  h('input', { type: 'checkbox', checked: config.enabled, onChange: event => updateConfig(sheet.name, { enabled: event.target.checked }) }),
                  h('strong', { className: 'text-sm text-slate-900' }, sheet.name)
                ),
                h('p', { className: 'mt-2 text-xs font-semibold text-slate-500' }, `${sheet.columns?.length || 0} kolom`)
              );
            })
          ) : null,
          h('div', { className: 'mt-4 flex flex-wrap justify-end gap-2' },
            h(Button, { type: 'button', variant: 'soft', disabled: loading || !draft?.token, onClick: () => changeSheet(selectedSheet, 5000) }, 'Tampilkan semua preview'),
            h(Button, { type: 'button', variant: 'success', disabled: loading, onClick: () => createJob(false) }, 'Simpan ke antrian')
          ),
          h('div', { className: 'mt-4' }, h(PreviewTable, { rows }))
        ) : null
      ),
      h('aside', { className: 'grid content-start gap-5' },
        queued ? h('div', { className: 'rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800' },
          h('p', null, `Job #${queued.id} siap dicek di panel status.`),
          h(ShortlinkBox, { job: queued })
        ) : null,
        h(StatusPanel, { initialJobId: queued?.id || '', initialEmail: email, initialShortCode: queued?.short_code || initialShortCode })
      ),
      fixConfirm ? h(Modal, { title: 'Data fix sudah ada', onClose: () => setFixConfirm(null) },
        h('div', { className: 'grid gap-4 text-sm leading-6 text-slate-600' },
          h('p', null, `Fix terakhir untuk komunitas ini disetujui ${formatDateTime(fixConfirm.reviewed_at)}. Pilih bagaimana upload baru ini disimpan.`),
          h('div', { className: 'grid gap-2 sm:grid-cols-2' },
            h(Button, { type: 'button', variant: 'soft', onClick: () => { setFixConfirm(null); createJob(true, false); } }, 'Simpan biasa'),
            h(Button, { type: 'button', variant: 'success', onClick: () => { setWantsFix(true); setFixConfirm(null); createJob(true, true); } }, 'Ajukan fix baru')
          )
        )
      ) : null
    );
  }

  function StatusPanel({ initialJobId = '', initialEmail = '', initialShortCode = '' }) {
    const [jobId, setJobId] = useState(initialJobId);
    const [email, setEmail] = useState(initialEmail);
    const [shortCode, setShortCode] = useState(shortCodeFromText(initialShortCode));
    const [job, setJob] = useState(null);
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [fixConfirm, setFixConfirm] = useState(null);

    useEffect(() => { if (initialJobId) setJobId(String(initialJobId)); }, [initialJobId]);
    useEffect(() => { if (initialEmail) setEmail(initialEmail); }, [initialEmail]);
    useEffect(() => {
      const code = shortCodeFromText(initialShortCode);
      if (!code) return;
      setShortCode(code);
      loadShortlink(code);
    }, [initialShortCode]);

    async function loadShortlink(value) {
      const code = shortCodeFromText(value);
      if (!code) return;
      setLoading(true);
      setMessage(null);
      try {
        const data = await apiRequest(`shortlink.php?kind=job&code=${encodeURIComponent(code)}`);
        setJob(data.job);
        if (data.job?.id) setJobId(String(data.job.id));
        setShortCode(data.job?.short_code || code);
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    async function checkStatus(event) {
      event?.preventDefault?.();
      if (shortCodeFromText(shortCode)) {
        await loadShortlink(shortCode);
        return;
      }
      if (!jobId || !email) return;
      setLoading(true);
      setMessage(null);
      try {
        const query = new URLSearchParams({ id: jobId, email });
        const data = await apiRequest(`status.php?${query.toString()}`);
        setJob(data.job);
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    async function submitFix(confirmExisting = false) {
      if (!job) return;
      setLoading(true);
      setMessage(null);
      try {
        const data = await apiRequest('fix_requests.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'submit', job_id: job.id, email, confirm_existing_fix: confirmExisting }),
        });
        setJob(current => current ? { ...current, fix_request: data.request } : current);
        setMessage({ type: 'info', text: data.already_pending ? 'Pengajuan fix sudah menunggu review admin.' : 'Pengajuan fix dikirim ke admin.' });
      } catch (error) {
        if (error.data?.requires_fix_confirmation) setFixConfirm(error.data.existing_fix || {});
        else setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    const progress = job ? Math.round((Number(job.rows_processed || 0) / Math.max(1, Number(job.rows_total || 0))) * 100) : 0;
    return h('section', { className: 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm' },
      h('h2', { className: 'text-lg font-black text-slate-950' }, 'Cek status'),
      h('form', { className: 'mt-4 grid gap-3', onSubmit: checkStatus },
        h(TextInput, { value: shortCode, onChange: event => setShortCode(event.target.value), placeholder: 'Kode atau URL shortlink' }),
        h(TextInput, { value: jobId, onChange: event => setJobId(event.target.value), placeholder: 'ID job' }),
        h(TextInput, { type: 'email', value: email, onChange: event => setEmail(event.target.value), placeholder: 'Email upload' }),
        h(Button, { type: 'submit', variant: 'soft', disabled: loading || (!shortCodeFromText(shortCode) && (!jobId || !email)) }, loading ? 'Mengecek...' : 'Cek')
      ),
      h(Notice, { message }),
      job ? h('div', { className: 'mt-4 rounded-2xl bg-slate-50 p-4' },
        h('div', { className: 'flex items-start justify-between gap-3' },
          h('div', { className: 'min-w-0' },
            h('p', { className: 'text-sm font-black text-slate-950' }, `#${job.id} ${job.original_filename}`),
            h('p', { className: 'mt-1 text-xs text-slate-500' }, [job.community_name, job.target_village, job.target_district, job.target_regency, job.target_province].filter(Boolean).join(', '))
          ),
          h(Badge, { status: job.status }, job.status)
        ),
        h('div', { className: 'mt-4 h-2 overflow-hidden rounded-full bg-white' }, h('div', { className: 'h-full rounded-full bg-blue-600', style: { width: `${progress}%` } })),
        h('p', { className: 'mt-2 text-xs font-bold text-slate-500' }, `${compactNumber(job.rows_processed || 0)} / ${compactNumber(job.rows_total || 0)} baris`),
        h(ShortlinkBox, { job }),
        h('div', { className: 'mt-3' }, h(ResultDownloadLinks, { job })),
        job.fix_request ? h('div', { className: 'mt-3 flex items-center justify-between gap-3 rounded-xl bg-white p-3' },
          h('span', { className: 'text-xs font-bold text-slate-600' }, `Pengajuan fix #${job.fix_request.id}`),
          h(Badge, { status: job.fix_request.status }, job.fix_request.status)
        ) : job.status === 'completed' && email ? h(Button, { type: 'button', variant: 'success', className: 'mt-3 w-full', disabled: loading, onClick: () => submitFix(false) }, 'Ajukan sebagai fix') : null
      ) : null,
      fixConfirm ? h(Modal, { title: 'Konfirmasi fix baru', onClose: () => setFixConfirm(null) },
        h('div', { className: 'grid gap-4' },
          h('p', { className: 'text-sm leading-6 text-slate-600' }, `Ada fix sebelumnya yang disetujui ${formatDateTime(fixConfirm.reviewed_at)}.`),
          h(Button, { type: 'button', variant: 'success', onClick: () => { setFixConfirm(null); submitFix(true); } }, 'Tetap ajukan fix baru')
        )
      ) : null
    );
  }

  function AboutPage() {
    const [content, setContent] = useState(null);
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let live = true;
      setLoading(true);
      apiRequest('site_content.php?slug=about')
        .then(data => {
          if (!live) return;
          setContent(data.content || null);
          setMessage(null);
        })
        .catch(error => {
          if (!live) return;
          setMessage({ type: 'error', text: error.message });
        })
        .finally(() => {
          if (live) setLoading(false);
        });
      return () => { live = false; };
    }, []);

    const title = content?.title || DEFAULT_ABOUT_TITLE;
    const summary = content?.summary || DEFAULT_ABOUT_SUMMARY;
    const hasCustomHtml = Boolean(String(content?.content_html || '').trim());
    const html = hasCustomHtml ? content.content_html : DEFAULT_ABOUT_HTML;

    return h('main', { className: 'about-page grid gap-5' },
      h('section', { className: 'about-hero-panel' },
        h('div', { className: 'about-hero-copy' },
          h('p', { className: 'section-kicker' }, 'Tentang sistem'),
          h('h1', { className: 'about-title' }, title),
          h('p', { className: 'about-summary' }, summary),
          h('div', { className: 'about-chip-row' },
            ['Project CPNS', 'Padan Data BNBA', 'Komunitas Adat Terpencil', 'Arsip Kerja'].map(item =>
              h('span', { key: item, className: 'about-chip' }, item)
            )
          )
        ),
        h('div', { className: 'about-signature' },
          h('span', { className: 'about-signature-mark' }, 'KAT'),
          h('strong', null, 'Operational data workspace'),
          h('small', null, 'Didesain untuk kerja data yang bisa ditelusuri, dikurasi, dan dipakai lintas proses.')
        )
      ),
      h(Notice, { message }),
      h('section', { className: 'about-content-grid' },
        h('article', { className: cx('about-prose', loading && 'is-refreshing', !hasCustomHtml && 'is-fallback') },
          h('div', { dangerouslySetInnerHTML: { __html: html } }),
          loading && h('p', { className: 'about-refresh-note' },
            h(Icon, { name: 'LoaderCircle', size: 14 }),
            'Mengecek versi terbaru dari admin...'
          )
        ),
        h('aside', { className: 'about-workflow' },
          h('p', { className: 'section-kicker' }, 'Alur kerja'),
          [
            ['Map', 'Baca wilayah', 'Pilih provinsi, kabupaten/kota, kecamatan, sampai desa bila layer tersedia.'],
            ['UploadCloud', 'Padankan data', 'Bawa konteks wilayah langsung ke form upload agar metadata tidak lepas.'],
            ['LibraryBig', 'Kurasi arsip', 'Simpan link kerja yang sudah disetujui admin untuk dipakai ulang.'],
            ['ShieldCheck', 'Jaga riwayat', 'Job, hasil, dan perubahan admin tercatat sebagai bahan monitoring.'],
          ].map(([icon, label, copy], index) =>
            h('div', { key: label, className: 'about-workflow-step' },
              h('span', { className: 'about-workflow-index' }, String(index + 1).padStart(2, '0')),
              h('span', { className: 'about-workflow-icon' }, h(Icon, { name: icon, size: 17 })),
              h('span', { className: 'about-workflow-copy' },
                h('strong', null, label),
                h('small', null, copy)
              )
            )
          )
        )
      )
    );
  }

  function RichTextEditor({ value, onChange }) {
    const editorRef = useRef(null);
    const [active, setActive] = useState({});

    useEffect(() => {
      const editor = editorRef.current;
      if (!editor) return;
      if (document.activeElement !== editor && editor.innerHTML !== String(value || '')) {
        editor.innerHTML = String(value || '');
      }
    }, [value]);

    function emit() {
      onChange?.(editorRef.current?.innerHTML || '');
    }

    function refreshActive() {
      try {
        setActive({
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline'),
          insertUnorderedList: document.queryCommandState('insertUnorderedList'),
          insertOrderedList: document.queryCommandState('insertOrderedList'),
        });
      } catch (_) {
        setActive({});
      }
    }

    function runCommand(command, argument = null) {
      editorRef.current?.focus();
      if (command === 'createLink') {
        const url = window.prompt('Masukkan URL link');
        if (!url) return;
        document.execCommand(command, false, url);
      } else {
        document.execCommand(command, false, argument);
      }
      emit();
      refreshActive();
    }

    const tools = [
      ['bold', 'Bold', 'B', null],
      ['italic', 'Italic', 'I', null],
      ['underline', 'Underline', 'U', null],
      ['formatBlock', 'Heading', 'H2', '<h2>'],
      ['insertUnorderedList', 'Bullet list', 'List', null],
      ['insertOrderedList', 'Numbered list', 'ListOrdered', null],
      ['formatBlock', 'Quote', 'Quote', '<blockquote>'],
      ['createLink', 'Link', 'Link', null],
      ['removeFormat', 'Clear style', 'Eraser', null],
    ];

    return h('div', { className: 'rte-shell' },
      h('div', { className: 'rte-toolbar', role: 'toolbar', 'aria-label': 'Editor konten' },
        tools.map(([command, label, icon, argument]) =>
          h('button', {
            key: `${command}-${label}`,
            type: 'button',
            className: cx('rte-tool', active[command] && 'is-active'),
            title: label,
            onMouseDown: event => event.preventDefault(),
            onClick: () => runCommand(command, argument),
          }, icon.length <= 2 ? h('span', null, icon) : h(Icon, { name: icon, size: 16 }))
        )
      ),
      h('div', {
        ref: editorRef,
        className: 'rte-editor',
        contentEditable: true,
        role: 'textbox',
        'aria-multiline': 'true',
        onInput: emit,
        onBlur: () => { emit(); refreshActive(); },
        onKeyUp: refreshActive,
        onMouseUp: refreshActive,
        dangerouslySetInnerHTML: { __html: String(value || '') },
      })
    );
  }

  function ContentAdmin({ adminKey }) {
    const [form, setForm] = useState({ title: '', summary: '', content_html: '' });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    async function load() {
      setLoading(true);
      setMessage(null);
      try {
        const data = await apiRequest('site_content.php?slug=about');
        const content = data.content || {};
        setForm({
          title: content.title || '',
          summary: content.summary || '',
          content_html: content.content_html || '',
        });
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    async function save(event) {
      event?.preventDefault();
      if (!adminKey) return setMessage({ type: 'error', text: 'Masukkan admin key dulu.' });
      setLoading(true);
      setMessage(null);
      try {
        const data = await apiRequest('site_content.php?slug=about', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
          body: JSON.stringify({ slug: 'about', ...form }),
        });
        const content = data.content || {};
        setForm({
          title: content.title || form.title,
          summary: content.summary || form.summary,
          content_html: content.content_html || form.content_html,
        });
        setMessage({ type: 'info', text: 'Konten About berhasil disimpan dan langsung dipakai di halaman publik.' });
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    function applyDefaultAboutTemplate() {
      setForm(current => ({
        title: String(current.title || '').trim() ? current.title : DEFAULT_ABOUT_TITLE,
        summary: String(current.summary || '').trim() ? current.summary : DEFAULT_ABOUT_SUMMARY,
        content_html: String(current.content_html || '').trim() ? current.content_html : DEFAULT_ABOUT_HTML,
      }));
      setMessage({ type: 'info', text: 'Template awal About dimuat. Silakan edit lalu simpan jika sudah cocok.' });
    }

    useEffect(() => { load(); }, []);

    return h('section', { className: 'panel panel-solid content-admin' },
      h('div', { className: 'section-head' },
        h('div', null,
          h('p', { className: 'section-kicker' }, 'Konten publik'),
          h('h2', { className: 'section-title' }, 'Editor halaman About')
        ),
        h('div', { className: 'action-row' },
          h(Button, { type: 'button', variant: 'soft', className: 'gap-2', disabled: loading, onClick: load }, h(Icon, { name: loading ? 'LoaderCircle' : 'RefreshCcw', size: 16 }), loading ? 'Memuat...' : 'Refresh'),
          h(Button, { type: 'button', variant: 'soft', className: 'gap-2', disabled: loading, onClick: applyDefaultAboutTemplate }, h(Icon, { name: 'Sparkles', size: 16 }), 'Template awal')
        )
      ),
      h(Notice, { message }),
      h('form', { className: 'mt-4 grid gap-4', onSubmit: save },
        h(Field, { label: 'Judul halaman' },
          h(TextInput, { value: form.title, onChange: event => setForm(current => ({ ...current, title: event.target.value })), placeholder: 'Tentang Project CPNS Padan Data KAT' })
        ),
        h(Field, { label: 'Ringkasan' },
          h(TextArea, { value: form.summary, onChange: event => setForm(current => ({ ...current, summary: event.target.value })), className: 'min-h-20', placeholder: 'Ringkasan pendek yang tampil di hero About.' })
        ),
        h(Field, { label: 'Isi About', hint: 'Editor ini mendukung heading, bold, italic, list, quote, dan link. Konten disanitasi sebelum disimpan.' },
          h(RichTextEditor, { value: form.content_html, onChange: html => setForm(current => ({ ...current, content_html: html })) })
        ),
        h('div', { className: 'action-row' },
          h(Button, { type: 'submit', variant: 'success', className: 'gap-2', disabled: loading || !adminKey }, h(Icon, { name: 'Save', size: 16 }), loading ? 'Menyimpan...' : 'Simpan About')
        )
      )
    );
  }

  function AdminPage() {
    const adminTabs = [
      ['jobs', 'Job', 'BriefcaseBusiness'],
      ['distribution', 'Persebaran', 'MapPinned'],
      ['fix', 'Fix', 'BadgeCheck'],
      ['mail', 'Email', 'MailCheck'],
      ['store', 'Data Store', 'DatabaseZap'],
      ['links', 'Link Archive', 'LibraryBig'],
      ['content', 'Konten', 'FileText'],
      ['geojson', 'GeoJSON', 'Layers3'],
    ];
    const storedAdminKey = localStorage.getItem('admin_key') || '';
    const [key, setKey] = useState(storedAdminKey);
    const [activeKey, setActiveKey] = useState(storedAdminKey);
    const [tab, setTab] = useState(() => {
      const requested = currentQuery().get('admin_tab') || localStorage.getItem('admin_tab') || 'jobs';
      return adminTabs.some(([name]) => name === requested) ? requested : 'jobs';
    });
    const [jobs, setJobs] = useState([]);
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [busyJobs, setBusyJobs] = useState({});
    const adminTabsRef = useRef(null);

    useEffect(() => {
      const container = adminTabsRef.current;
      if (!container) return undefined;
      const frame = window.requestAnimationFrame(() => {
        const activeButton = container.querySelector('[data-admin-tab-active="true"]');
        if (!activeButton) return;
        const targetLeft = activeButton.offsetLeft - ((container.clientWidth - activeButton.offsetWidth) / 2);
        container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
      });
      return () => window.cancelAnimationFrame(frame);
    }, [tab]);

    function switchAdminTab(nextTab) {
      if (!adminTabs.some(([name]) => name === nextTab)) return;
      setTab(nextTab);
      localStorage.setItem('admin_tab', nextTab);
      const params = currentQuery();
      params.set('admin', '1');
      if (nextTab === 'jobs') params.delete('admin_tab');
      else params.set('admin_tab', nextTab);
      window.history.replaceState(null, '', `?${params.toString()}${window.location.hash || ''}`);
    }

    function adminHeaders() {
      return { 'Content-Type': 'application/json', 'X-Admin-Key': activeKey };
    }

    async function loadJobs(options = {}) {
      const candidateKey = key.trim();
      if (!candidateKey) return setMessage({ type: 'error', text: 'Masukkan admin key.' });
      setLoading(true);
      if (!options.silent) setActiveKey('');
      if (!options.silent) setMessage(null);
      try {
        const query = new URLSearchParams({ key: candidateKey, limit: PAGE_SIZE });
        const data = await apiRequest(`jobs.php?${query.toString()}`);
        localStorage.setItem('admin_key', candidateKey);
        setKey(candidateKey);
        setActiveKey(candidateKey);
        setJobs(data.jobs || []);
        if (!options.silent) setMessage({ type: 'info', text: 'Akses admin aktif. Semua kontrol sekarang dapat digunakan.' });
      } catch (error) {
        localStorage.removeItem('admin_key');
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    async function jobAction(job, action) {
      const labels = { cancel: 'Batalkan', stop: 'Stop aman', requeue: 'Requeue', resolve_dispute: 'Resolve' };
      const optimistic = {
        cancel: { status: 'cancelled', worker_name: '', error_message: '' },
        stop: { status: 'queued', rows_processed: 0, worker_name: '', error_message: 'Dihentikan admin dan kembali ke antrian.' },
        requeue: { status: 'queued', rows_total: 0, rows_processed: 0, worker_name: '', error_message: '', result_downloads: [], result_file_url: '' },
        resolve_dispute: { dispute_status: 'resolved' },
      };
      setBusyJobs(current => ({ ...current, [job.id]: true }));
      setLoading(true);
      setMessage({ type: 'info', text: `${labels[action] || 'Aksi'} job #${job.id} sedang diproses...` });
      if (optimistic[action]) {
        setJobs(current => current.map(item => Number(item.id) === Number(job.id) ? { ...item, ...optimistic[action] } : item));
      }
      try {
        const result = await apiRequest('admin_action.php', { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ id: job.id, action }) });
        const firstError = (result.results || []).find(row => !row.ok)?.error;
        if (result.failed) {
          setMessage({ type: 'error', text: `${labels[action] || 'Aksi'} job #${job.id} belum berhasil: ${firstError || 'sebagian aksi gagal.'}` });
        } else {
          const nextStatus = action === 'requeue' ? 'masuk antrian lagi' : action === 'stop' ? 'dihentikan aman dan balik ke antrian' : action === 'cancel' ? 'dibatalkan' : 'diperbarui';
          setMessage({ type: 'info', text: `Job #${job.id} ${nextStatus}. Tampilan sudah disegarkan.` });
        }
        await loadJobs({ silent: true });
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
        setLoading(false);
      } finally {
        setBusyJobs(current => {
          const next = { ...current };
          delete next[job.id];
          return next;
        });
      }
    }

    return h('main', { className: 'grid gap-5' },
      h('section', { className: 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm' },
        h('div', { className: 'admin-auth-grid grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]' },
          h(Field, { label: 'Admin key' }, h(TextInput, {
            type: 'password',
            value: key,
            onChange: event => {
              const nextKey = event.target.value;
              setKey(nextKey);
              if (nextKey.trim() !== activeKey) setActiveKey('');
            },
            onKeyDown: event => {
              if (event.key === 'Enter' && !loading && key.trim()) loadJobs();
            },
            placeholder: 'Masukkan ADMIN_KEY lalu tekan Enter',
          })),
          h('div', { className: 'admin-auth-actions flex items-end gap-2' },
            h(Button, { type: 'button', variant: 'blue', disabled: loading || !key.trim(), onClick: loadJobs }, loading ? 'Memverifikasi...' : activeKey ? 'Muat ulang' : 'Buka admin'),
            h('a', {
              href: activeKey ? apiUrl(`export_jobs.php?key=${encodeURIComponent(activeKey)}`) : '#',
              'aria-disabled': activeKey ? 'false' : 'true',
              onClick: event => {
                if (!activeKey) {
                  event.preventDefault();
                  setMessage({ type: 'error', text: 'Buka akses admin terlebih dahulu sebelum export.' });
                }
              },
              className: cx('admin-export-button inline-flex h-11 items-center rounded-xl bg-white px-4 text-sm font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50', !activeKey && 'cursor-not-allowed opacity-45'),
            }, h(Icon, { name: 'Download', size: 15 }), h('span', null, 'Export'))
          )
        ),
        !activeKey
          ? h('div', { className: 'mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900' },
              h(Icon, { name: 'LockKeyhole', size: 17, className: 'mt-1 shrink-0' }),
              h('span', null, 'Panel masih terkunci. Masukkan ADMIN_KEY lalu klik Buka admin. Kontrol operasional akan aktif setelah key berhasil diverifikasi.'))
          : h('div', { className: 'mt-3 flex items-center gap-2 text-xs font-black text-emerald-700' },
              h(Icon, { name: 'ShieldCheck', size: 16 }), 'Akses admin terverifikasi'),
        h('div', { ref: adminTabsRef, className: 'admin-tabs mt-4 flex flex-wrap gap-2' }, adminTabs.map(([name, label, icon]) =>
          h(Button, { key: name, type: 'button', variant: tab === name ? 'primary' : 'soft', className: 'gap-2', 'data-admin-tab-active': tab === name ? 'true' : 'false', 'aria-pressed': tab === name ? 'true' : 'false', onClick: () => switchAdminTab(name) }, h(Icon, { name: icon, size: 16 }), label)
        )),
        h('div', { className: 'mt-4' }, h(Notice, { message }))
      ),
      tab === 'jobs' ? h(AdminJobs, { jobs, adminKey: activeKey, busyJobs, onAction: jobAction }) : null,
      tab === 'distribution' ? h(DistributionAdmin, { adminKey: activeKey, headers: adminHeaders }) : null,
      tab === 'fix' ? h(FixAdmin, { adminKey: activeKey, headers: adminHeaders }) : null,
      tab === 'mail' ? h(MailAdmin, { adminKey: activeKey }) : null,
      tab === 'store' ? h(DataStoreAdmin, { adminKey: activeKey }) : null,
      tab === 'links' ? h(LinkArchiveAdmin, { adminKey: activeKey }) : null,
      tab === 'content' ? h(ContentAdmin, { adminKey: activeKey }) : null,
      tab === 'geojson' ? h(GeojsonAdmin, { adminKey: activeKey, headers: adminHeaders }) : null
    );
  }

  function AdminJobs({ jobs, adminKey, busyJobs = {}, onAction }) {
    const summary = useMemo(() => {
      const base = { total: jobs.length, queued: 0, processing: 0, completed: 0, failed: 0, cancelled: 0, disputed: 0 };
      jobs.forEach(job => {
        if (Object.prototype.hasOwnProperty.call(base, job.status)) base[job.status]++;
        if (job.dispute_status === 'submitted') base.disputed++;
      });
      return base;
    }, [jobs]);
    const summaryCards = [
      ['Total job', summary.total, 'BriefcaseBusiness', 'slate'],
      ['Antrian', summary.queued, 'ListChecks', 'amber'],
      ['Berjalan', summary.processing, 'LoaderCircle', 'blue'],
      ['Selesai', summary.completed, 'CheckCircle2', 'emerald'],
      ['Gagal', summary.failed, 'TriangleAlert', 'rose'],
      ['Dibatalkan', summary.cancelled, 'CircleSlash', 'slate'],
    ];
    return h('section', { className: 'grid gap-4' },
      h('div', { className: 'admin-job-summary grid gap-3' },
        summaryCards.map(([label, value, icon, tone]) => h('article', { key: label, className: cx('admin-mini-card rounded-2xl border bg-white p-4 shadow-sm', `tone-${tone}`) },
          h('div', { className: 'flex items-center justify-between gap-3' },
            h('p', { className: 'text-xs font-black uppercase text-slate-500' }, label),
            h('span', { className: 'grid h-9 w-9 place-items-center rounded-xl bg-slate-50 text-slate-700 ring-1 ring-slate-100' }, h(Icon, { name: icon, size: 18 }))
          ),
          h('strong', { className: 'mt-2 block text-2xl font-black text-slate-950' }, fullNumber(value))
        ))
      ),
      h('div', { className: 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm' },
        h('div', { className: 'border-b border-slate-100 p-4' },
          h('h2', { className: 'text-base font-black text-slate-950' }, 'Kontrol job'),
          h('p', { className: 'mt-1 text-xs font-semibold text-slate-500' }, 'Stop aman mengembalikan job processing ke antrian tanpa penalti retry. Requeue mengulang job dari awal.')
        ),
        h('div', { className: 'admin-table-scroll overflow-auto' },
          h('table', { className: 'admin-job-table min-w-[1180px] w-full border-separate border-spacing-0 text-left text-sm' },
            h('thead', { className: 'bg-slate-950 text-white' },
              h('tr', null, ['ID', 'File', 'Wilayah', 'Status', 'Upload', 'Progress', 'BNBA/Fix', 'Hasil', 'Aksi'].map(col => h('th', { key: col, className: 'px-3 py-3 text-xs font-black uppercase' }, col)))
            ),
            h('tbody', null, jobs.length ? jobs.map(job => h('tr', { key: job.id, className: 'admin-job-row border-b border-slate-100 odd:bg-white even:bg-slate-50' },
              h('td', { className: 'px-3 py-3', 'data-label': 'ID' },
                h('div', { className: 'grid gap-2' },
                  h('span', { className: 'font-black' }, `#${job.id}`),
                  jobShortUrl(job) ? h(CopyShortlinkButton, { url: jobShortUrl(job), compact: true, label: '' }) : null
                )
              ),
              h('td', { className: 'max-w-64 break-words px-3 py-3', 'data-label': 'File', title: job.original_filename }, job.original_filename),
              h('td', { className: 'px-3 py-3 text-xs leading-5 text-slate-600', 'data-label': 'Wilayah' }, [job.community_name, job.target_location, job.target_village, job.target_district, job.target_regency, job.target_province].filter(Boolean).join(', ') || '-'),
              h('td', { className: 'px-3 py-3', 'data-label': 'Status' }, h(Badge, { status: job.status }, job.status)),
              h('td', { className: 'px-3 py-3 text-slate-500', 'data-label': 'Upload' }, formatDateTime(job.uploaded_at)),
              h('td', { className: 'px-3 py-3 text-slate-600', 'data-label': 'Progress' }, `${compactNumber(job.rows_processed || 0)} / ${compactNumber(job.rows_total || 0)}`),
              h('td', { className: 'px-3 py-3 text-xs leading-5 text-slate-600', 'data-label': 'BNBA/Fix' },
                h('div', { className: 'flex items-center gap-3' },
                  h('div', { className: 'min-w-0' },
                    h('span', { className: 'font-black text-slate-950 block' }, `${fullNumber(job.bnba_summary?.kk_unique || 0)} KK unik`),
                    h('span', { className: 'block text-slate-600' }, `${fullNumber(job.bnba_summary?.kk_duplicate || 0)} KK duplikat`)
                  ),
                  job.fix_status ? h(Badge, { status: job.fix_status }, job.fix_status === 'approved' ? 'fix disetujui' : job.fix_status === 'pending' ? 'request fix' : job.fix_status) : (job.wants_fix ? h(Badge, { status: 'pending' }, 'request fix') : h(Badge, { status: 'slate' }, 'bukan fix'))
                )
              ),
              h('td', { className: 'px-3 py-3', 'data-label': 'Hasil' }, h(ResultDownloadLinks, { job, adminKey, compact: true })),
              h('td', { className: 'px-3 py-3', 'data-label': 'Aksi' },
                h('div', { className: 'admin-action-row flex items-center gap-2 flex-nowrap whitespace-nowrap' },
                  job.status === 'processing' ? h(Button, { type: 'button', variant: 'soft', disabled: Boolean(busyJobs[job.id]), className: 'h-8 gap-1.5 px-2 text-xs', onClick: () => onAction(job, 'stop') }, h(Icon, { name: 'OctagonPause', size: 14 }), busyJobs[job.id] ? '...' : 'Stop') : null,
                  ['queued', 'processing'].includes(job.status) ? h(Button, { type: 'button', variant: 'danger', disabled: Boolean(busyJobs[job.id]), className: 'h-8 gap-1.5 px-2 text-xs', onClick: () => onAction(job, 'cancel') }, h(Icon, { name: 'Ban', size: 14 }), busyJobs[job.id] ? '...' : 'Cancel') : null,
                  ['failed', 'cancelled', 'completed'].includes(job.status) ? h(Button, { type: 'button', variant: 'soft', disabled: Boolean(busyJobs[job.id]), className: 'h-8 gap-1.5 px-2 text-xs', onClick: () => onAction(job, 'requeue') }, h(Icon, { name: 'RefreshCcw', size: 14 }), busyJobs[job.id] ? '...' : 'Requeue') : null,
                  job.dispute_status === 'submitted' ? h(Button, { type: 'button', variant: 'success', disabled: Boolean(busyJobs[job.id]), className: 'h-8 gap-1.5 px-2 text-xs', onClick: () => onAction(job, 'resolve_dispute') }, h(Icon, { name: 'BadgeCheck', size: 14 }), busyJobs[job.id] ? '...' : 'Resolve') : null
                )
              )
            )) : h('tr', null, h('td', { colSpan: 9, className: 'px-4 py-10 text-center text-slate-500' }, 'Belum ada data job.')))
          )
        )
      )
    );
  }

  function DistributionAdmin({ adminKey }) {
    const empty = {
      source_data: 'DATA PERSEBARAN KAT',
      data_year: new Date().getFullYear(),
      province: '',
      regency: '',
      district: '',
      village: '',
      location: '',
      tribe: '',
      households_spread: '',
      households_total: '',
      is_proposed: 1,
      documents_folder_url: '',
      ...Object.fromEntries(DISTRIBUTION_DOCUMENT_FIELDS.flatMap(([key]) => [[key, 0], [`${key}_url`, '']])),
    };
    const [rows, setRows] = useState([]);

    const existingSources = useMemo(() => {
      const set = new Set([
        'DATA PERSEBARAN KAT',
        'PENGUSULAN TIM KERJA PERSIAPAN ASESMEN',
        'SURAT PENGUSULAN DINAS SOSIAL',
        'LAPORAN PERSEBARAN HASIL VERVAL',
      ]);
      if (Array.isArray(rows)) {
        rows.forEach(r => {
          if (r && r.source_data && String(r.source_data).trim()) {
            set.add(String(r.source_data).trim());
          }
        });
      }
      return Array.from(set);
    }, [rows]);

    const [form, setForm] = useState(empty);
    const [query, setQuery] = useState('');
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);

    const [proposals, setProposals] = useState([]);
    const [proposalStatusFilter, setProposalStatusFilter] = useState('pending');
    const [adminSubTab, setAdminSubTab] = useState('data');
    const [proposalCount, setProposalCount] = useState({ total: 0, pending: 0 });

    async function loadProposals(statusFilter = proposalStatusFilter) {
      if (!adminKey) return;
      try {
        const query = statusFilter ? `?status=${statusFilter}` : '';
        const data = await apiRequest(`distribution_proposals.php${query}`, {
          headers: { 'X-Admin-Key': adminKey }
        });
        if (data.ok) {
          setProposals(data.proposals || []);
          setProposalCount(data.summary || { total: 0, pending: 0 });
        }
      } catch (err) {
        console.error(err);
      }
    }

    useEffect(() => {
      if (adminKey) {
        loadProposals('pending');
      }
    }, [adminKey]);

    async function handleApproveProposal(id) {
      if (!confirm('Apakah Anda yakin ingin menyetujui usulan ini dan menerbitkannya ke Peta Persebaran KAT?')) return;
      setLoading(true);
      try {
        const data = await apiRequest('distribution_proposals.php?action=approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
          body: JSON.stringify({ id })
        });
        setMessage({ type: 'info', text: data.message });
        await loadProposals(proposalStatusFilter);
        await loadRows();
      } catch (err) {
        setMessage({ type: 'error', text: err.message });
      } finally {
        setLoading(false);
      }
    }

    async function handleRejectProposal(id) {
      const notes = prompt('Masukkan alasan penolakan (opsional):');
      if (notes === null) return;
      setLoading(true);
      try {
        const data = await apiRequest('distribution_proposals.php?action=reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
          body: JSON.stringify({ id, admin_notes: notes })
        });
        setMessage({ type: 'info', text: data.message });
        await loadProposals(proposalStatusFilter);
      } catch (err) {
        setMessage({ type: 'error', text: err.message });
      } finally {
        setLoading(false);
      }
    }

    const [pdfFile, setPdfFile] = useState(null);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfSubmitting, setPdfSubmitting] = useState(false);
    const [pdfModalOpen, setPdfModalOpen] = useState(false);
    const [pdfFilename, setPdfFilename] = useState('');
    const [pdfConfirmRows, setPdfConfirmRows] = useState([]);

    const [pdfProgressModalOpen, setPdfProgressModalOpen] = useState(false);
    const [pdfProgressPercent, setPdfProgressPercent] = useState(0);
    const [pdfStatusText, setPdfStatusText] = useState('Mengunggah PDF...');
    const [pdfSecondsElapsed, setPdfSecondsElapsed] = useState(0);

    const DRAFT_KEY = 'kat_pdf_distribution_draft';

    function getPdfCacheKey(file) {
      if (!file) return null;
      return `kat_pdf_cache_${file.name.replace(/\s+/g, '_')}_${file.size}`;
    }

    const [hasLocalDraft, setHasLocalDraft] = useState(() => {
      try { return Boolean(localStorage.getItem(DRAFT_KEY)); } catch (_) { return false; }
    });

    const [savedDraftInfo, setSavedDraftInfo] = useState(() => {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (_) { return null; }
    });

    async function extractPdfWithGemini(forceReExtract = false) {
      if (!pdfFile) return setMessage({ type: 'error', text: 'Pilih file PDF terlebih dahulu.' });

      // 1. SMART CACHE CHECK (MENGHEMAT TOKEN GEMINI AI)
      if (!forceReExtract) {
        const cacheKey = getPdfCacheKey(pdfFile);
        let cachedPayload = null;

        try {
          const raw = localStorage.getItem(cacheKey);
          if (raw) cachedPayload = JSON.parse(raw);
        } catch (_) { }

        // Fallback: check active local draft if filename matches
        if (!cachedPayload && savedDraftInfo && savedDraftInfo.filename === pdfFile.name && savedDraftInfo.rows?.length) {
          cachedPayload = {
            filename: savedDraftInfo.filename,
            records: savedDraftInfo.rows,
            total_extracted: savedDraftInfo.rows.length,
            fromDraft: true
          };
        }

        if (cachedPayload && cachedPayload.records && cachedPayload.records.length > 0) {
          setPdfFilename(cachedPayload.filename || pdfFile.name);
          setPdfConfirmRows(cachedPayload.records);
          setPdfModalOpen(true);
          setMessage({
            type: 'info',
            text: `⚡ HEMAT TOKEN GEMINI AI! Menggunakan hasil ekstraksi dari cache/draft lokal (${cachedPayload.records.length} lokasi data) untuk "${pdfFile.name}".`
          });
          return;
        }
      }

      // 2. PROSES EKSTRAKSI GEMINI AI (JIKA BELUM ADA DI CACHE)
      setPdfLoading(true);
      setPdfProgressPercent(5);
      setPdfStatusText('Mengunggah file PDF ke server...');
      setPdfSecondsElapsed(0);
      setPdfProgressModalOpen(true);
      setMessage(null);

      let seconds = 0;
      const timerInterval = setInterval(() => {
        seconds += 1;
        setPdfSecondsElapsed(seconds);

        setPdfProgressPercent(current => {
          if (current < 25) return current + 3;
          if (current < 50) {
            setPdfStatusText('Menghubungkan ke Google Gemini AI...');
            return current + 2;
          }
          if (current < 75) {
            setPdfStatusText('Gemini AI sedang membaca narasi & lokasi PDF...');
            return current + 1;
          }
          if (current < 95) {
            setPdfStatusText('Mengekstrak lokasi persebaran & normalisasi wilayah...');
            return current + 0.5;
          }
          setPdfStatusText('Menyiapkan konfirmasi data...');
          return Math.min(98, current + 0.2);
        });
      }, 400);

      try {
        const upload = new FormData();
        upload.append('action', 'pdf_extract');
        upload.append('admin_key', adminKey);
        upload.append('file', pdfFile);

        const data = await uploadFormWithProgress(apiUrl('distribution.php'), upload, uploadPercent => {
          const mappedUploadPercent = Math.round((uploadPercent / 100) * 25);
          setPdfProgressPercent(prev => Math.max(prev, mappedUploadPercent));
          if (uploadPercent < 100) {
            setPdfStatusText(`Mengunggah file PDF (${uploadPercent}%)...`);
          } else {
            setPdfStatusText('Upload selesai! Menghubungkan ke Gemini AI...');
          }
        });

        clearInterval(timerInterval);
        setPdfProgressPercent(100);
        setPdfStatusText('Selesai!');

        // OTOMATIS SIMPAN KE CACHE LOKAL AGAR HEMAT TOKEN GEMINI AI DI MASA DEPAN
        try {
          const cacheKey = getPdfCacheKey(pdfFile);
          const cachePayload = {
            filename: data.filename || pdfFile.name,
            records: data.records || [],
            total_extracted: data.total_extracted || 0,
            savedAt: new Date().toISOString()
          };
          if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(cachePayload));

          const draftPayload = {
            filename: data.filename || pdfFile.name,
            batchSource: existingSources[0] || 'DATA PERSEBARAN KAT',
            rows: data.records || [],
            savedAt: new Date().toISOString()
          };
          localStorage.setItem(DRAFT_KEY, JSON.stringify(draftPayload));
          setHasLocalDraft(true);
          setSavedDraftInfo(draftPayload);
        } catch (_) { }

        setTimeout(() => {
          setPdfProgressModalOpen(false);
          setPdfFilename(data.filename || pdfFile.name);
          setPdfConfirmRows(data.records || []);
          setPdfModalOpen(true);
          setMessage({ type: 'info', text: `✓ Gemini AI berhasil mengekstrak ${compactNumber(data.total_extracted || 0)} lokasi dari PDF. Hasil disimpan di cache lokal agar hemat token!` });
        }, 400);

      } catch (error) {
        clearInterval(timerInterval);
        setPdfProgressModalOpen(false);
        setMessage({ type: 'error', text: `Gagal mengekstrak PDF: ${error.message}` });
      } finally {
        setPdfLoading(false);
      }
    }

    function updatePdfRowField(index, field, value) {
      setPdfConfirmRows(current => {
        const next = [...(current || [])];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    }

    function saveDraftToLocalStorage(currentBatchSource) {
      if (!pdfConfirmRows.length) return;
      const draftPayload = {
        filename: pdfFilename || 'Dokumen Draft',
        batchSource: currentBatchSource || existingSources[0] || 'DATA PERSEBARAN KAT',
        rows: pdfConfirmRows,
        savedAt: new Date().toISOString()
      };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draftPayload));
        setHasLocalDraft(true);
        setSavedDraftInfo(draftPayload);
        setMessage({ type: 'info', text: `✓ Draft lokal berhasil disimpan (${pdfConfirmRows.length} lokasi data) di browser Anda!` });
      } catch (err) {
        setMessage({ type: 'error', text: 'Gagal menyimpan draft ke browser localStorage.' });
      }
    }

    function restoreDraftFromLocalStorage() {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const payload = JSON.parse(raw);
        setPdfFilename(payload.filename || 'Draft Tersimpan');
        setPdfConfirmRows(payload.rows || []);
        setPdfModalOpen(true);
        setMessage({ type: 'info', text: `Berhasil memuat draft tersimpan lokal dari browser (${payload.rows?.length || 0} lokasi).` });
      } catch (err) {
        setMessage({ type: 'error', text: 'Gagal membaca draft lokal.' });
      }
    }

    function clearDraftFromLocalStorage() {
      try {
        localStorage.removeItem(DRAFT_KEY);
        setHasLocalDraft(false);
        setSavedDraftInfo(null);
        setMessage({ type: 'info', text: 'Draft lokal berhasil dihapus.' });
      } catch (_) { }
    }

    function addPdfRow() {
      const defaultSource = existingSources?.[0] || 'DATA PERSEBARAN KAT';
      setPdfConfirmRows(current => [
        ...current,
        {
          source_data: defaultSource,
          data_year: new Date().getFullYear(),
          province: '',
          regency: '',
          district: '',
          village: '',
          location: '',
          tribe: '',
          households_spread: '',
          households_total: '',
          is_proposed: 1,
          notes: '',
        }
      ]);
    }

    function applyBatchSourceToPdfRows(sourceValue) {
      setPdfConfirmRows(current => current.map(r => ({ ...r, source_data: sourceValue })));
    }

    function removePdfRow(index) {
      setPdfConfirmRows(current => current.filter((_, i) => i !== index));
    }

    async function submitPdfConfirmedRows() {
      if (!pdfConfirmRows.length) {
        return setMessage({ type: 'error', text: 'Tidak ada baris data untuk disimpan.' });
      }
      const validRows = pdfConfirmRows.filter(r => String(r.province || '').trim());
      if (!validRows.length) {
        return setMessage({ type: 'error', text: 'Setidaknya satu lokasi harus mengisi nama Provinsi.' });
      }

      setPdfSubmitting(true);
      try {
        const data = await apiRequest('distribution.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
          body: JSON.stringify({ action: 'pdf_commit', records: pdfConfirmRows })
        });
        try {
          localStorage.removeItem(DRAFT_KEY);
          setHasLocalDraft(false);
          setSavedDraftInfo(null);
        } catch (_) { }
        setPdfModalOpen(false);
        setPdfConfirmRows([]);
        setPdfFile(null);
        setMessage({ type: 'info', text: `Berhasil menambahkan ${compactNumber(data.inserted || 0)} lokasi persebaran dari PDF!` });
        await loadRows();
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setPdfSubmitting(false);
      }
    }
    const qualitySummary = useMemo(() => {
      const summary = { total: Array.isArray(rows) ? rows.length : 0, withLocation: 0, needsReview: 0, clean: 0 };
      if (Array.isArray(rows)) {
        rows.forEach(row => {
          const hasDistrict = Boolean(String(row?.district || '').trim());
          const hasVillage = Boolean(String(row?.village || '').trim());
          const hasLocation = Boolean(String(row?.location || '').trim());
          const mergedVillage = /\b(kec\.?|kecamatan|kecamaran|distrik|dusun|lokasi)\b/i.test(String(row?.village || ''));
          const mergedLocation = /\b(kec\.?|kecamatan|kecamaran|distrik)\b/i.test(String(row?.location || ''));
          if (hasLocation) summary.withLocation += 1;
          if (!hasDistrict || (!hasVillage && !hasLocation) || mergedVillage || mergedLocation) summary.needsReview += 1;
          if (hasDistrict && (hasVillage || hasLocation) && !mergedVillage && !mergedLocation) summary.clean += 1;
        });
      }
      return summary;
    }, [rows]);

    async function loadRows() {
      if (!adminKey) return;
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: 100 });
        if (query) params.set('q', query);
        const data = await apiRequest(`distribution.php?${params.toString()}`);
        setRows(data.rows || []);
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    async function saveRow() {
      if (!String(form.province || '').trim()) {
        setMessage({ type: 'error', text: 'Provinsi wajib diisi sebelum data persebaran disimpan.' });
        return;
      }
      setLoading(true);
      try {
        await apiRequest('distribution.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey }, body: JSON.stringify({ action: 'save', id: form.id || 0, record: form }) });
        setForm(empty);
        setMessage({ type: 'info', text: `Data persebaran tersimpan dengan ${compactNumber(form.households_total || form.households_spread || 0)} KK.` });
        await loadRows();
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    async function deleteRow(id) {
      if (!window.confirm('Hapus data persebaran ini?')) return;
      await apiRequest('distribution.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey }, body: JSON.stringify({ action: 'delete', id }) });
      await loadRows();
    }

    async function importPreview() {
      if (!file) return setMessage({ type: 'error', text: 'Pilih file import.' });
      setLoading(true);
      try {
        const upload = new FormData();
        upload.append('action', 'import_preview');
        upload.append('admin_key', adminKey);
        upload.append('file', file);
        const data = await uploadFormWithProgress(apiUrl('distribution.php'), upload, null);
        setPreview(data);
        setMessage({ type: 'info', text: `${compactNumber(data.new_count)} baris baru, ${compactNumber(data.update_count || 0)} checklist akan diperbarui, ${compactNumber(data.duplicate_count)} duplikat.` });
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    async function importCommit() {
      if (!preview?.token) return;
      setLoading(true);
      try {
        const data = await apiRequest('distribution.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey }, body: JSON.stringify({ action: 'import_commit', token: preview.token }) });
        setPreview(null);
        setMessage({ type: 'info', text: `${compactNumber(data.inserted)} baris ditambahkan dan ${compactNumber(data.updated || 0)} checklist lokasi diperbarui.` });
        await loadRows();
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    function setField(name, value) {
      setForm(current => ({ ...current, [name]: value }));
    }

    return h('section', { className: 'distribution-admin-grid grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]' },
      h('div', { className: 'distribution-admin-switcher' },
        h('div', { className: 'distribution-admin-switcher-actions' },
          h('button', {
            type: 'button',
            onClick: () => setAdminSubTab('data'),
            className: cx('px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2', adminSubTab === 'data' ? 'bg-purple-700 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')
          }, h(Icon, { name: 'Database', size: 16 }), 'Data Peta Persebaran'),
          h('button', {
            type: 'button',
            onClick: () => { setAdminSubTab('proposals'); loadProposals(proposalStatusFilter); },
            className: cx('px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2 relative', adminSubTab === 'proposals' ? 'bg-purple-700 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')
          },
            h(Icon, { name: 'FileCheck', size: 16 }),
            'Verifikasi Usulan Publik',
            proposalCount.pending > 0 && h('span', { className: 'px-2 py-0.5 text-[10px] font-black rounded-full bg-rose-500 text-white shadow-xs' }, proposalCount.pending)
          )
        )
      ),

      adminSubTab === 'proposals' ? h('div', { className: 'distribution-admin-proposals rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4' },
        h('div', { className: 'flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4' },
          h('div', null,
            h('h2', { className: 'text-lg font-black text-slate-900 m-0' }, 'Verifikasi Usulan KAT Publik'),
            h('p', { className: 'text-xs text-slate-500 m-0 mt-0.5 font-semibold' }, 'Daftar pengusulan lokasi baru dari publik/dinas yang membutuhkan persetujuan Admin.')
          ),
          h('div', { className: 'flex items-center gap-2' },
            ['pending', 'approved', 'rejected', ''].map(st =>
              h('button', {
                key: st || 'all',
                type: 'button',
                onClick: () => { setProposalStatusFilter(st); loadProposals(st); },
                className: cx('px-3 py-1.5 text-xs font-black rounded-lg border transition-all', proposalStatusFilter === st ? 'bg-purple-100 border-purple-300 text-purple-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100')
              }, st === 'pending' ? '⏳ Pending' : st === 'approved' ? '✅ Disetujui' : st === 'rejected' ? '❌ Ditolak' : 'Semua Usulan')
            )
          )
        ),
        proposals.length ? h('div', { className: 'overflow-x-auto rounded-xl border border-slate-200' },
          h('table', { className: 'w-full text-left text-xs' },
            h('thead', { className: 'bg-slate-100 font-black text-slate-800 uppercase text-[11px] border-b border-slate-200' },
              h('tr', null,
                h('th', { className: 'p-3 text-center' }, '#'),
                h('th', { className: 'p-3' }, 'Status'),
                h('th', { className: 'p-3' }, 'Pengusul'),
                h('th', { className: 'p-3' }, 'Suku / Komunitas'),
                h('th', { className: 'p-3' }, 'Wilayah (Prov / Kab / Kec / Desa)'),
                h('th', { className: 'p-3 text-center' }, 'KK'),
                h('th', { className: 'p-3' }, 'Dokumen Lampiran'),
                h('th', { className: 'p-3 text-center' }, 'Aksi')
              )
            ),
            h('tbody', { className: 'divide-y divide-slate-100 font-semibold text-slate-700' },
              proposals.map((item, idx) =>
                h('tr', { key: item.id || idx, className: item.status === 'pending' ? 'bg-amber-50/50' : 'hover:bg-slate-50' },
                  h('td', { className: 'p-3 text-center font-bold text-slate-400' }, idx + 1),
                  h('td', { className: 'p-3 font-bold' },
                    item.status === 'pending' ? h('span', { className: 'px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-300' }, '⏳ Pending') :
                    item.status === 'approved' ? h('span', { className: 'px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300' }, '✅ Disetujui') :
                    h('span', { className: 'px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300' }, '❌ Ditolak')
                  ),
                  h('td', { className: 'p-3' },
                    h('div', { className: 'font-black text-slate-900' }, item.submitted_by_name || 'Masyarakat'),
                    item.submitted_by_email && h('div', { className: 'text-[11px] text-slate-500 font-bold' }, item.submitted_by_email)
                  ),
                  h('td', { className: 'p-3 font-black text-purple-900' }, item.tribe || '-'),
                  h('td', { className: 'p-3' },
                    h('div', { className: 'font-bold text-slate-900' }, `${item.province}${item.regency ? `, ${item.regency}` : ''}`),
                    h('div', { className: 'text-[11px] text-slate-500' }, `${item.district || ''} ${item.village || ''} ${item.location ? `(${item.location})` : ''}`)
                  ),
                  h('td', { className: 'p-3 text-center font-black' }, item.households_spread || 0),
                  h('td', { className: 'p-3' },
                    item.submitted_file_url ? h('a', { href: item.submitted_file_url, target: '_blank', rel: 'noopener noreferrer', className: 'inline-flex items-center gap-1 text-purple-700 hover:underline font-bold text-xs' }, h(Icon, { name: 'FileText', size: 14 }), item.original_filename || 'Buka File') : h('span', { className: 'text-slate-400 text-[11px]' }, 'Tanpa file')
                  ),
                  h('td', { className: 'p-3 text-center' },
                    item.status === 'pending' ? h('div', { className: 'flex items-center justify-center gap-2' },
                      h('button', { type: 'button', onClick: () => handleApproveProposal(item.id), className: 'px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-black text-xs shadow-xs hover:bg-emerald-700 flex items-center gap-1' }, h(Icon, { name: 'Check', size: 14 }), 'Setujui'),
                      h('button', { type: 'button', onClick: () => handleRejectProposal(item.id), className: 'px-3 py-1.5 rounded-lg bg-rose-600 text-white font-black text-xs shadow-xs hover:bg-rose-700 flex items-center gap-1' }, h(Icon, { name: 'X', size: 14 }), 'Tolak')
                    ) : h('span', { className: 'text-xs text-slate-400 font-bold' }, item.reviewed_by ? `Oleh ${item.reviewed_by}` : '-')
                  )
                )
              )
            )
          )
        ) : h('div', { className: 'p-8 text-center text-slate-400 font-bold bg-slate-50 rounded-xl border border-dashed border-slate-200' }, 'Belum ada usulan data publik pada filter ini.')
      ) : null,

      adminSubTab === 'data' && h('div', { className: 'distribution-admin-form rounded-2xl border border-slate-200 bg-white p-5 shadow-sm' },
        h('h2', { className: 'text-lg font-black text-slate-950' }, 'Data persebaran'),
        h('p', { className: 'mt-1 text-xs font-bold leading-5 text-slate-500' }, 'Field desa, distrik/kecamatan, dan lokasi dibersihkan otomatis saat disimpan atau diimport. Dusun masuk ke lokasi, bukan desa.'),
        h('div', { className: 'mt-4 grid gap-3' },
          [
            ['source_data', 'Sumber data'],
            ['data_year', 'Tahun data'],
            ['province', 'Provinsi (wajib)'],
            ['regency', 'Kabupaten/Kota'],
            ['district', 'Kecamatan/Distrik'],
            ['village', 'Desa/Kelurahan'],
            ['location', 'Lokasi/Dusun'],
            ['tribe', 'Suku/Komunitas'],
            ['households_spread', 'KK menurut data persebaran'],
            ['households_total', 'Jumlah KK total'],
          ].map(([name, label]) =>
            h(Field, { key: name, label },
              h(TextInput, {
                value: form[name] ?? '',
                type: ['data_year', 'households_spread', 'households_total'].includes(name) ? 'number' : 'text',
                min: ['households_spread', 'households_total'].includes(name) ? '0' : undefined,
                onChange: event => setField(name, event.target.value),
              })
            )
          ),
          h('label', { className: 'flex items-center gap-2 text-sm font-bold text-slate-700' }, h('input', { type: 'checkbox', checked: Boolean(form.is_proposed), onChange: event => setField('is_proposed', event.target.checked ? 1 : 0) }), 'Pengusulan'),
          h(DistributionDocumentChecklist, { value: form, editable: true, onChange: setField }),
          h(Button, { type: 'button', variant: 'success', disabled: loading || !adminKey, onClick: saveRow }, form.id ? 'Update' : 'Tambah')
        ),
        h('div', { className: 'mt-5 border-t border-slate-100 pt-5' },
          h('h3', { className: 'text-sm font-black text-slate-950' }, 'Import Excel/CSV'),
          h('div', { className: 'mt-3 grid gap-2' },
            h(FileDropzone, {
              file,
              onFile: setFile,
              accept: SUPPORTED_EXTENSIONS.map(ext => `.${ext}`).join(','),
              compact: true,
              hint: 'Drop XLSX, CSV, XML, atau TXT untuk dicek duplikat sebelum ditambahkan.',
            }),
            h(Button, { type: 'button', variant: 'soft', disabled: loading || !file || !adminKey, onClick: importPreview }, 'Preview import'),
            preview ? h(Button, { type: 'button', variant: 'blue', disabled: loading, onClick: importCommit },
              `Proses ${compactNumber((preview.new_count || 0) + (preview.update_count || 0))} baris`
            ) : null
          )
        ),
        h('div', { className: 'pdf-import-container' },
          h('div', { className: 'pdf-import-header-row' },
            h('div', { className: 'pdf-import-badge-icon' }, h(Icon, { name: 'Sparkles', size: 20 })),
            h('div', { className: 'pdf-import-header-texts' },
              h('h3', { className: 'pdf-import-main-title' }, 'Import PDF via Gemini AI'),
              h('span', { className: 'pdf-import-sub-badge' }, 'Ekstraksi Otomatis')
            )
          ),
          h('p', { className: 'pdf-import-description' }, 'Unggah file PDF (Surat Dinas, Pengusulan, atau Laporan). Gemini AI akan membaca lokasi persebaran KAT dan menampilkan konfirmasi & edit sebelum disimpan.'),

          hasLocalDraft && savedDraftInfo ? h('div', { className: 'pdf-local-draft-card' },
            h('div', { className: 'pdf-draft-header' },
              h('div', { className: 'pdf-draft-icon-box' }, h(Icon, { name: 'Bookmark', size: 16 })),
              h('div', { className: 'pdf-draft-text-group' },
                h('span', { className: 'pdf-draft-title-line' }, `Draft Tersimpan (${savedDraftInfo?.rows?.length || 0} lokasi)`),
                h('span', { className: 'pdf-draft-meta-line' }, `${savedDraftInfo?.filename || 'PDF'} • ${savedDraftInfo?.savedAt ? new Date(savedDraftInfo.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`)
              )
            ),
            h('div', { className: 'pdf-draft-action-row' },
              h('button', {
                type: 'button',
                onClick: restoreDraftFromLocalStorage,
                className: 'btn-open-draft-action',
                style: {
                  flex: '1 1 0',
                  height: '2.75rem',
                  borderRadius: '0.85rem',
                  backgroundColor: '#d97706',
                  background: '#d97706',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 900,
                  border: '1.5px solid #b45309',
                  boxShadow: '0 4px 12px rgba(217, 119, 6, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer'
                }
              },
                h(Icon, { name: 'FolderOpen', size: 16, style: { stroke: '#ffffff', color: '#ffffff' } }),
                h('span', { style: { color: '#ffffff', fontWeight: 900, fontSize: '0.82rem' } }, 'Buka Draft')
              ),
              h('button', {
                type: 'button',
                onClick: clearDraftFromLocalStorage,
                className: 'btn-delete-draft-action',
                style: {
                  height: '2.75rem',
                  padding: '0 1.15rem',
                  borderRadius: '0.85rem',
                  backgroundColor: '#ffffff',
                  background: '#ffffff',
                  color: '#78350f',
                  fontSize: '0.82rem',
                  fontWeight: 900,
                  border: '1.5px solid #fcd34d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }
              }, h('span', { style: { color: '#78350f', fontWeight: 900 } }, 'Hapus'))
            )
          ) : null,

          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '0.85rem' } },
            h(FileDropzone, {
              file: pdfFile,
              onFile: setPdfFile,
              accept: '.pdf',
              compact: true,
              hint: 'Drop file PDF laporan atau lokasi persebaran.',
            }),
            h('button', {
              type: 'button',
              disabled: loading || pdfLoading || !pdfFile || !adminKey,
              onClick: extractPdfWithGemini,
              className: 'btn-gemini-extract-action',
              style: (loading || pdfLoading || !pdfFile || !adminKey) ? {
                width: '100%',
                height: '3rem',
                borderRadius: '0.9rem',
                backgroundColor: '#f1f5f9',
                background: '#f1f5f9',
                color: '#0f172a',
                fontSize: '0.82rem',
                fontWeight: 900,
                border: '2px solid #94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'not-allowed',
                boxShadow: 'none'
              } : {
                width: '100%',
                height: '3rem',
                borderRadius: '0.9rem',
                background: 'linear-gradient(135deg, #6d28d9 0%, #4f46e5 100%)',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 900,
                border: '1.5px solid #5b21b6',
                boxShadow: '0 6px 18px rgba(109, 40, 217, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer'
              }
            },
              h(Icon, {
                name: 'Sparkles',
                size: 16,
                style: (loading || pdfLoading || !pdfFile || !adminKey) ? { stroke: '#0f172a', color: '#0f172a' } : { stroke: '#ffffff', color: '#ffffff' }
              }),
              h('span', {
                style: (loading || pdfLoading || !pdfFile || !adminKey) ? { color: '#0f172a', fontWeight: 900 } : { color: '#ffffff', fontWeight: 900 }
              }, pdfLoading ? 'Gemini sedang membaca PDF...' : '⚡ Ekstrak PDF dengan Gemini AI')
            )
          )
        ),
        h('div', { className: 'mt-4' }, h(Notice, { message }))
      ),
      h('div', { className: 'distribution-admin-list rounded-2xl border border-slate-200 bg-white p-5 shadow-sm' },
        h('div', { className: 'distribution-admin-head' },
          h('div', null,
            h('p', { className: 'section-kicker' }, 'Data quality'),
            h('h2', { className: 'section-title' }, 'Audit persebaran'),
            h('p', { className: 'distribution-admin-copy' }, 'Pantau hasil normalisasi seed/import sebelum dipakai di peta dan padan wilayah.')
          ),
          h('span', { className: 'distribution-admin-badge' }, h(Icon, { name: 'Sparkles', size: 15 }), 'auto-normalized')
        ),
        h('div', { className: 'distribution-quality-grid' },
          [
            ['Database rows', qualitySummary.total, 'Rows3', 'slate'],
            ['Lokasi terisi', qualitySummary.withLocation, 'MapPin', 'emerald'],
            ['Butuh cek', qualitySummary.needsReview, 'ScanSearch', qualitySummary.needsReview ? 'amber' : 'emerald'],
            ['Struktur rapi', qualitySummary.clean, 'ShieldCheck', 'blue'],
          ].map(([label, value, icon, tone]) =>
            h('article', { key: label, className: cx('distribution-quality-card', `tone-${tone}`) },
              h('span', { className: 'distribution-quality-icon' }, h(Icon, { name: icon, size: 16 })),
              h('small', null, label),
              h('strong', null, compactNumber(value))
            )
          )
        ),
        h('div', { className: 'grid gap-2 md:grid-cols-[1fr_auto]' },
          h(TextInput, { value: query, onChange: event => setQuery(event.target.value), placeholder: 'Cari persebaran' }),
          h(Button, { type: 'button', variant: 'blue', disabled: loading || !adminKey, onClick: loadRows }, loading ? '...' : 'Muat')
        ),
        preview ? h('div', { className: 'mt-4 grid gap-3' },
          h('div', { className: 'rounded-2xl border border-blue-100 bg-blue-50 p-4' },
            h('div', { className: 'flex flex-wrap items-center justify-between gap-3' },
              h('div', null,
                h('p', { className: 'text-sm font-black text-blue-950' }, 'Ringkasan import'),
                h('p', { className: 'mt-1 text-xs font-bold text-blue-700' }, `${compactNumber(preview.total_rows || 0)} baris dibaca, ${compactNumber(preview.new_count || 0)} baru, ${compactNumber(preview.update_count || 0)} update checklist, ${compactNumber(preview.duplicate_count || 0)} duplikat`)
              ),
              h(SourcePills, { sources: sourceBreakdownFromRows(preview.preview_rows || []) })
            )
          ),
          h(PreviewTable, { rows: preview.preview_rows || [], maxHeight: 300 })
        ) : null,
        h('div', { className: 'distribution-record-list mt-4' },
          (Array.isArray(rows) && rows.length) ? rows.map(row => h('article', { key: row.id, className: 'distribution-record-card' },
            h('div', { className: 'distribution-record-main' },
              h('span', { className: 'distribution-record-icon' }, h(Icon, { name: row.location ? 'MapPin' : 'MapPinned', size: 17 })),
              h('div', { className: 'min-w-0' },
                h('p', { className: 'distribution-record-title' }, `${row.tribe || 'Komunitas KAT'}${row.location || row.village ? ` - ${row.location || row.village}` : ''}`),
                h('p', { className: 'distribution-record-route' }, [row.location, row.village, row.district, row.regency, row.province].filter(Boolean).join(' / '))
              ),
              h(Badge, { status: row.is_proposed ? 'pengusulan' : 'slate' }, row.is_proposed ? 'usulan' : 'data')
            ),
            h('div', { className: 'distribution-meta-grid' },
              [
                ['KK', compactNumber(row.households_total || row.households_spread || 0), 'UsersRound'],
                ['Desa/Kel.', row.village || 'Belum ada', 'Landmark'],
                ['Kec./Distrik', row.district || 'Belum ada', 'Route'],
                ['Sumber', row.source_data || 'Tanpa sumber', 'Database'],
              ].map(([label, value, icon]) =>
                h('span', { key: label, className: 'distribution-meta-chip', title: String(value) },
                  h(Icon, { name: icon, size: 13 }),
                  h('b', null, label),
                  h('em', null, String(value))
                )
              )
            ),
            h('div', { className: 'distribution-record-actions' },
              row.data_year ? h('span', { className: 'distribution-year-pill' }, row.data_year) : null,
              h('span', {
                className: cx('distribution-year-pill', Number(row.documents_complete || 0) === Number(row.documents_total || DISTRIBUTION_DOCUMENT_FIELDS.length) && 'is-complete'),
                title: `${fullNumber(row.documents_linked || 0)} tautan dokumen`,
              }, `${fullNumber(row.documents_complete || 0)}/${fullNumber(row.documents_total || DISTRIBUTION_DOCUMENT_FIELDS.length)} dok.`),
              h(Button, { type: 'button', variant: 'soft', className: 'h-8 gap-1.5 px-2 text-xs', onClick: () => setForm(row) }, h(Icon, { name: 'Pencil', size: 13 }), 'Edit'),
              h(Button, { type: 'button', variant: 'danger', className: 'h-8 gap-1.5 px-2 text-xs', onClick: () => deleteRow(row.id) }, h(Icon, { name: 'Trash2', size: 13 }), 'Hapus')
            )
          )) : h('div', { className: 'rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500' }, 'Muat data untuk mulai.')
        )
      ),
      h(PdfConfirmationModal, {
        isOpen: pdfModalOpen,
        filename: pdfFilename,
        rows: pdfConfirmRows,
        existingSources: existingSources,
        existingDbRows: rows,
        onUpdateField: updatePdfRowField,
        onApplyBatchSource: applyBatchSourceToPdfRows,
        onAddRow: addPdfRow,
        onRemoveRow: removePdfRow,
        onSaveDraft: saveDraftToLocalStorage,
        onSubmit: submitPdfConfirmedRows,
        onClose: () => setPdfModalOpen(false),
        submitting: pdfSubmitting,
      }),
      h(PdfProcessingProgressModal, {
        isOpen: pdfProgressModalOpen,
        filename: pdfFile?.name,
        progressPercent: pdfProgressPercent,
        statusText: pdfStatusText,
        secondsElapsed: pdfSecondsElapsed,
      })
    );
  }

  function FixAdmin({ adminKey }) {
    const empty = { job_id: '', requested_by_email: 'admin@example.com', request_source: 'admin', status: 'pending', province: '', regency: '', district: '', village: '', community_name: '', note: '', review_note: '' };
    const [requests, setRequests] = useState([]);
    const [form, setForm] = useState(empty);
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('');
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);

    async function load() {
      if (!adminKey) return;
      setLoading(true);
      try {
        const params = new URLSearchParams({ key: adminKey });
        if (query) params.set('q', query);
        if (status) params.set('status', status);
        const data = await apiRequest(`fix_requests.php?${params.toString()}`);
        setRequests(data.requests || []);
        if (data.fallback_storage) setMessage({ type: 'info', text: 'Pengajuan fix memakai storage lokal demo karena database belum aktif.' });
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    async function review(request, action) {
      setLoading(true);
      try {
        await apiRequest('fix_requests.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey }, body: JSON.stringify({ action, id: request.id }) });
        setMessage({ type: 'info', text: action === 'approve' ? 'Fix disetujui.' : 'Fix ditolak.' });
        await load();
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
        setLoading(false);
      }
    }

    async function save() {
      if (!adminKey) return;
      setLoading(true);
      try {
        await apiRequest('fix_requests.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey }, body: JSON.stringify({ action: 'save', id: form.id || 0, record: form }) });
        setForm(empty);
        setMessage({ type: 'info', text: 'Pengajuan fix tersimpan.' });
        await load();
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    async function deleteRequest(request) {
      if (!window.confirm(`Hapus pengajuan fix #${request.id}?`)) return;
      setLoading(true);
      try {
        await apiRequest('fix_requests.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey }, body: JSON.stringify({ action: 'delete', id: request.id }) });
        setMessage({ type: 'info', text: 'Pengajuan fix dihapus.' });
        await load();
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    function setField(name, value) {
      setForm(current => ({ ...current, [name]: value }));
    }

    return h('section', { className: 'grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]' },
      h('div', { className: 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm' },
        h('div', { className: 'flex items-center justify-between gap-3' },
          h('div', null,
            h('h2', { className: 'text-lg font-black text-slate-950' }, form.id ? `Edit fix #${form.id}` : 'Buat pengajuan fix'),
            h('p', { className: 'mt-1 text-xs font-semibold text-slate-500' }, 'CRUD manual untuk simulasi request, approve, reject, dan data fix.')
          ),
          h('span', { className: 'grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' }, h(Icon, { name: 'BadgeCheck', size: 19 }))
        ),
        h('div', { className: 'mt-4 grid gap-3' },
          h(Field, { label: 'Job ID' }, h(TextInput, { value: form.job_id ?? '', onChange: event => setField('job_id', event.target.value), placeholder: '21' })),
          h(Field, { label: 'Email pemohon' }, h(TextInput, { value: form.requested_by_email ?? '', onChange: event => setField('requested_by_email', event.target.value), placeholder: 'admin@example.com' })),
          h(Field, { label: 'Status' }, h('select', { value: form.status || 'pending', onChange: event => setField('status', event.target.value), className: 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none' },
            ['pending', 'approved', 'rejected'].map(item => h('option', { key: item, value: item }, item))
          )),
          ['province', 'regency', 'district', 'village', 'community_name'].map(name =>
            h(Field, { key: name, label: name.replace(/_/g, ' ') },
              h(TextInput, { value: form[name] ?? '', onChange: event => setField(name, event.target.value) })
            )
          ),
          h(Field, { label: 'Catatan pemohon' }, h(TextInput, { value: form.note ?? '', onChange: event => setField('note', event.target.value), placeholder: 'Alasan/ruang lingkup fix' })),
          h(Field, { label: 'Catatan review' }, h(TextInput, { value: form.review_note ?? '', onChange: event => setField('review_note', event.target.value), placeholder: 'Catatan admin' })),
          h('div', { className: 'flex flex-wrap gap-2' },
            h(Button, { type: 'button', variant: 'success', className: 'gap-2', disabled: loading || !adminKey, onClick: save }, h(Icon, { name: form.id ? 'Save' : 'Plus', size: 16 }), form.id ? 'Update' : 'Create'),
            form.id ? h(Button, { type: 'button', variant: 'soft', className: 'gap-2', disabled: loading, onClick: () => setForm(empty) }, h(Icon, { name: 'RotateCcw', size: 16 }), 'Batal edit') : null
          )
        ),
        h('div', { className: 'mt-4' }, h(Notice, { message }))
      ),
      h('div', { className: 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm' },
        h('div', { className: 'grid gap-2 md:grid-cols-[1fr_160px_auto]' },
          h(TextInput, { value: query, onChange: event => setQuery(event.target.value), placeholder: 'Cari email, wilayah, komunitas' }),
          h('select', { value: status, onChange: event => setStatus(event.target.value), className: 'h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none' },
            h('option', { value: '' }, 'Semua status'),
            ['pending', 'approved', 'rejected'].map(item => h('option', { key: item, value: item }, item))
          ),
          h(Button, { type: 'button', variant: 'blue', className: 'gap-2', disabled: loading || !adminKey, onClick: load }, h(Icon, { name: loading ? 'LoaderCircle' : 'RefreshCcw', size: 16 }), loading ? '...' : 'Muat')
        ),
        h('div', { className: 'mt-4 grid gap-3' },
          requests.length ? requests.map(request => h('article', { key: request.id, className: 'rounded-2xl border border-slate-100 bg-slate-50 p-4' },
            h('div', { className: 'flex flex-col gap-3 md:flex-row md:items-start md:justify-between' },
              h('div', { className: 'min-w-0' },
                h('p', { className: 'text-sm font-black text-slate-950' }, `Fix #${request.id} dari job #${request.job_id}`),
                h('p', { className: 'mt-1 text-xs leading-5 text-slate-500' }, [request.community_name, request.village, request.district, request.regency, request.province].filter(Boolean).join(', ') || '-'),
                h('p', { className: 'mt-1 text-xs text-slate-500' }, `Diajukan ${formatDateTime(request.requested_at)} oleh ${request.requested_by_email}`)
              ),
              h('div', { className: 'flex flex-wrap gap-2' },
                h(Badge, { status: request.status }, request.status),
                request.changed_from_previous === true ? h(Badge, { status: 'pending' }, 'berbeda') : request.changed_from_previous === false ? h(Badge, { status: 'checked' }, 'sama') : null
              )
            ),
            request.note ? h('p', { className: 'mt-3 rounded-xl bg-white p-3 text-xs font-semibold leading-5 text-slate-600 ring-1 ring-slate-100' }, request.note) : null,
            h('div', { className: 'mt-3 flex flex-wrap gap-2' },
              request.status === 'pending' ? h(Button, { type: 'button', variant: 'success', className: 'h-9 gap-2 px-3 text-xs', onClick: () => review(request, 'approve') }, h(Icon, { name: 'Check', size: 14 }), 'Acc fix') : null,
              request.status === 'pending' ? h(Button, { type: 'button', variant: 'danger', className: 'h-9 gap-2 px-3 text-xs', onClick: () => review(request, 'reject') }, h(Icon, { name: 'X', size: 14 }), 'Tolak') : null,
              h(Button, { type: 'button', variant: 'soft', className: 'h-9 gap-2 px-3 text-xs', onClick: () => setForm({ ...empty, ...request }) }, h(Icon, { name: 'Pencil', size: 14 }), 'Edit'),
              h(Button, { type: 'button', variant: 'danger', className: 'h-9 gap-2 px-3 text-xs', onClick: () => deleteRequest(request) }, h(Icon, { name: 'Trash2', size: 14 }), 'Hapus')
            )
          )) : h('div', { className: 'rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500' }, 'Belum ada pengajuan.')
        )
      )
    );
  }

  function MailAdmin({ adminKey }) {
    const [config, setConfig] = useState(null);
    const [settings, setSettings] = useState(null);
    const [email, setEmail] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState(null);
    const [relayProbe, setRelayProbe] = useState(null);
    const [mailObservability, setMailObservability] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [logsLoading, setLogsLoading] = useState(false);
    const smtp = config?.smtp || {};
    const editableSmtp = settings?.smtp || {};
    const api = config?.api || {};
    const relay = config?.relay || {};
    const editableApi = settings?.api || {};
    const editableRelay = settings?.relay || {};
    const php = config?.php || {};
    const savedMethod = String(config?.method || '').toLowerCase();
    const activeMethod = String(settings?.method || config?.method || 'smtp').toLowerCase();
    const isSmtp = savedMethod === 'smtp';
    const isApi = savedMethod === 'api';
    const editingSmtp = activeMethod === 'smtp';
    const editingApi = activeMethod === 'api';
    const editingMail = activeMethod === 'mail';
    const currentApiProvider = String(editableApi.provider || api.provider || 'resend').toLowerCase();
    const editingCustomApi = editingApi && currentApiProvider === 'custom';
    const relayEndpoint = editableRelay.endpoint || relay.endpoint || '';
    const observabilitySummary = mailObservability?.summary || {};
    const observabilityEvents = Array.isArray(mailObservability?.events) ? mailObservability.events : [];
    const smtpReady = !isSmtp || (smtp.host && smtp.username_configured && smtp.password_configured && (smtp.encryption === 'none' || php.openssl));
    const apiReady = !isApi || (api.api_key_configured && api.endpoint && api.http_client !== 'missing');
    const mailReady = isSmtp ? smtpReady : (isApi ? apiReady : true);
    const apiProviderEndpoints = {
      resend: 'https://api.resend.com/emails',
      brevo: 'https://api.brevo.com/v3/smtp/email',
      sendgrid: 'https://api.sendgrid.com/v3/mail/send',
      custom: '',
    };
    const apiProviderLabels = {
      resend: 'Resend',
      brevo: 'Brevo',
      sendgrid: 'SendGrid',
      custom: 'Custom API / KAT Relay',
    };

    async function load() {
      if (!adminKey) return;
      setLoading(true);
      try {
        const [testData, settingsData, obsData] = await Promise.all([
          apiRequest(`mail_test.php?key=${encodeURIComponent(adminKey)}`),
          apiRequest(`mail_settings.php?key=${encodeURIComponent(adminKey)}`),
          apiRequest(`mail_observability.php?key=${encodeURIComponent(adminKey)}`).catch(error => ({ ok: false, error: error.message })),
        ]);
        setConfig(testData.config || null);
        setSettings(settingsData.settings || null);
        setMailObservability(obsData?.ok === false ? { error: obsData.error, events: [], summary: {} } : (obsData || null));
        setMessage(null);
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    function setMailSetting(name, value) {
      setSettings(current => ({ ...(current || {}), [name]: value }));
    }

    function setSmtpSetting(name, value) {
      setSettings(current => ({ ...(current || {}), smtp: { ...((current || {}).smtp || {}), [name]: value } }));
    }

    function setApiSetting(name, value) {
      setSettings(current => ({ ...(current || {}), api: { ...((current || {}).api || {}), [name]: value } }));
    }

    function setRelaySetting(name, value) {
      setSettings(current => ({ ...(current || {}), relay: { ...((current || {}).relay || {}), [name]: value } }));
    }

    function applySmtpPreset(encryption, port) {
      setSettings(current => ({ ...(current || {}), method: 'smtp', smtp: { ...((current || {}).smtp || {}), encryption, port } }));
    }

    function applyApiPreset(provider) {
      setSettings(current => {
        const currentApi = ((current || {}).api || {});
        const endpoint = apiProviderEndpoints[provider] || (provider === 'custom' ? currentApi.endpoint || '' : apiProviderEndpoints.resend);
        return { ...(current || {}), method: 'api', api: { ...currentApi, provider, endpoint } };
      });
    }

    async function loadObservability() {
      if (!adminKey) return;
      setLogsLoading(true);
      try {
        const data = await apiRequest(`mail_observability.php?key=${encodeURIComponent(adminKey)}`, {}, { timeoutMs: 25000 });
        setMailObservability(data || null);
      } catch (error) {
        setMailObservability({ error: error.message, events: [], summary: {} });
      } finally {
        setLogsLoading(false);
      }
    }

    async function saveSettings(event) {
      event?.preventDefault?.();
      if (!adminKey) return setMessage({ type: 'error', text: 'Masukkan admin key dulu.' });
      if (!settings) return setMessage({ type: 'error', text: 'Konfigurasi belum terbaca.' });
      setSaving(true);
      setMessage({ type: 'info', text: 'Menyimpan konfigurasi mail...' });
      try {
        const data = await apiRequest('mail_settings.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
          body: JSON.stringify(settings),
        }, { timeoutMs: 45000 });
        setSettings(data.settings || settings);
        const testData = await apiRequest(`mail_test.php?key=${encodeURIComponent(adminKey)}`);
        setConfig(testData.config || config);
        setMessage({ type: 'info', text: 'Konfigurasi mail tersimpan. Test email dan email job riil akan memakai setting ini.' });
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setSaving(false);
      }
    }

    async function testEmail(event) {
      event?.preventDefault?.();
      if (!adminKey) return setMessage({ type: 'error', text: 'Masukkan admin key dulu.' });
      setLoading(true);
      setMessage({ type: 'info', text: 'Mengirim test email...' });
      try {
        const data = await apiRequest('mail_test.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
          body: JSON.stringify({ email, subject }),
        }, { timeoutMs: 70000 });
        setConfig(data.config || config);
        if (data.sent) {
          setMessage({ type: 'info', text: 'Test email berhasil dikirim. Cek inbox atau spam penerima.' });
        } else {
          setMessage({ type: 'error', text: data.error || 'SMTP menolak pengiriman tanpa detail.' });
        }
        loadObservability();
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    async function checkRelayEndpoint(event) {
      event?.preventDefault?.();
      if (!relayEndpoint) {
        setRelayProbe({ type: 'error', text: 'Endpoint relay belum tersedia.' });
        return;
      }
      setRelayProbe({ type: 'info', text: 'Mengecek endpoint relay...' });
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(new URL(relayEndpoint, window.location.href).toString(), {
          cache: 'no-store',
          mode: 'cors',
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || `Relay menolak cek endpoint (${response.status}).`);
        }
        const summary = data.relay || {};
        const health = summary.enabled && summary.secret_configured ? 'siap menerima request' : 'terbaca, tapi secret/aktif belum lengkap';
        setRelayProbe({
          type: summary.enabled && summary.secret_configured ? 'info' : 'error',
          text: `Relay ${health}. Signature ${summary.require_signature ? 'wajib' : 'opsional'}, limit ${formatBytes(summary.max_payload_bytes || 0)}.`,
        });
      } catch (error) {
        setRelayProbe({ type: 'error', text: error?.name === 'AbortError' ? 'Cek relay timeout 15 detik.' : (error.message || 'Endpoint relay tidak bisa dicek.') });
      } finally {
        window.clearTimeout(timer);
      }
    }

    async function copyRelayEndpoint(event) {
      event?.preventDefault?.();
      if (!relayEndpoint) {
        setRelayProbe({ type: 'error', text: 'Endpoint relay belum tersedia.' });
        return;
      }
      try {
        await navigator.clipboard?.writeText(relayEndpoint);
        setRelayProbe({ type: 'info', text: 'Endpoint relay disalin.' });
      } catch (_error) {
        setRelayProbe({ type: 'error', text: 'Browser tidak mengizinkan copy otomatis. Pilih teks endpoint lalu salin manual.' });
      }
    }

    useEffect(() => { if (adminKey) load(); }, [adminKey]);

    function mailEventTone(event) {
      if (event?.sent === true) return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
      if (event?.event === 'auth_failed' || Number(event?.status || 0) >= 400 || event?.sent === false) return 'bg-rose-50 text-rose-700 ring-rose-100';
      return 'bg-slate-50 text-slate-700 ring-slate-200';
    }

    function mailEventLabel(event) {
      if (!event) return 'event';
      if (event.sent === true) return 'sent';
      if (event.event === 'idempotent_replay') return 'replay';
      if (event.event === 'auth_failed') return 'auth failed';
      if (event.source === 'mail') return 'mail error';
      return event.event || 'event';
    }

    const rows = [
      ['Mode mail', config?.method || '-', isApi ? 'Server memakai HTTPS API eksternal.' : (isSmtp ? 'Server memakai SMTP.' : 'Server memakai fungsi mail() PHP.')],
      ...(isSmtp ? [
        ['SMTP host', smtp.host || '-', smtp.port ? `${smtp.port} / ${smtp.encryption || 'none'}` : 'Belum ada port.'],
        ['Username', smtp.username || '-', smtp.username_configured ? 'Terisi.' : 'Belum diisi.'],
        ['Password', smtp.password_configured ? 'configured' : 'empty', smtp.password_has_spaces ? `Spasi akan dibersihkan, panjang efektif ${smtp.password_length_after_strip}.` : `Panjang efektif ${smtp.password_length_after_strip || 0}.`],
        ['OpenSSL', php.openssl ? 'loaded' : 'missing', php.openssl ? 'Siap TLS/SSL.' : 'TLS/SSL SMTP butuh OpenSSL.'],
        ['Port mode', smtp.encryption || '-', smtp.port_hint || '587 biasanya STARTTLS, 465 biasanya SSL/SMTPS.'],
        ['Certificate check', smtp.verify_peer ? 'on' : 'off', smtp.verify_peer ? 'Koneksi SMTP memverifikasi sertifikat server.' : 'Verifikasi sertifikat SMTP dimatikan.'],
      ] : []),
      ...(isApi ? [
        ['API provider', api.provider || '-', api.endpoint || 'Endpoint mengikuti preset provider.'],
        ['API key', api.api_key_configured ? 'configured' : 'empty', `HTTP client: ${api.http_client || '-'}. Timeout ${api.timeout || 30}s. Signature ${api.sign_relay_requests ? 'on' : 'off'}.`],
        ['cURL / HTTPS', php.curl ? 'curl' : (php.allow_url_fopen ? 'stream' : 'missing'), php.curl ? 'API eksternal memakai cURL.' : (php.allow_url_fopen ? 'Fallback stream tersedia.' : 'API eksternal butuh cURL atau allow_url_fopen.')],
      ] : []),
      ['Relay inbound', relay.secret_configured ? 'ready' : 'needs secret', relay.endpoint ? `${relay.endpoint} - ${relay.enabled ? 'aktif' : 'nonaktif'} - signature ${relay.require_signature ? 'wajib' : 'opsional'}` : 'Endpoint relay ada di /api/mail_relay.php pada server B.'],
      ['Relay payload', relay.max_payload_bytes ? formatBytes(relay.max_payload_bytes) : '-', `Limit request; aman untuk serverless kecil. Rate ${relay.rate_limit_per_hour || 0}/jam.`],
      ['Relay replay guard', relay.idempotency_ttl_seconds ? `${relay.idempotency_ttl_seconds}s` : 'off', relay.require_signature ? `TTL signature ${relay.signature_ttl_seconds || 300}s, HMAC wajib.` : `TTL signature ${relay.signature_ttl_seconds || 300}s, HMAC opsional.`],
      ['From', config?.from || '-', config?.from_matches_username ? 'Sama dengan username.' : (config?.from_auto_username ? 'Auto fallback ke username jika From default.' : 'Mengikuti config manual.')],
      ['Log error', config?.debug_log ? config.log_path : 'disabled', config?.debug_log ? 'Gagal kirim ditulis ke log ini.' : 'Logging mail dimatikan.'],
    ];

    return h('section', { className: 'grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]' },
      h('div', { className: 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm' },
        h('div', { className: 'flex items-start justify-between gap-4' },
          h('div', null,
            h('h2', { className: 'text-lg font-black text-slate-950' }, 'Email delivery check'),
            h('p', { className: 'mt-1 max-w-2xl text-sm leading-6 text-slate-500' }, 'Panel ini membaca konfigurasi mail tanpa menampilkan secret, lalu memberi opsi SMTP atau API eksternal jika server hosting memblokir port email.')
          ),
          h('span', { className: cx('grid h-11 w-11 place-items-center rounded-xl ring-1', mailReady ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-amber-50 text-amber-700 ring-amber-100') }, h(Icon, { name: mailReady ? 'ShieldCheck' : 'TriangleAlert', size: 21 }))
        ),
        h('div', { className: 'mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4' },
          h(MiniMetric, { icon: 'Server', label: 'Mode', value: config?.method || '-' }),
          h(MiniMetric, { icon: 'LockKeyhole', label: 'TLS/SSL', value: php.openssl ? 'ready' : 'missing' }),
          h(MiniMetric, { icon: 'KeyRound', label: isApi ? 'API key' : 'App password', value: isApi ? (api.api_key_configured ? 'configured' : 'empty') : (smtp.looks_like_gmail_app_password ? '16 char' : (smtp.password_configured ? `${smtp.password_length_after_strip || 0} char` : 'empty')) }),
          h(MiniMetric, { icon: relay.require_signature ? 'ShieldCheck' : 'Shield', label: 'Relay HMAC', value: relay.require_signature ? 'wajib' : 'opsional' })
        ),
        h('form', { className: 'mt-5 grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4', onSubmit: saveSettings },
          h('div', { className: 'flex flex-wrap items-start justify-between gap-3' },
            h('div', null,
              h('h3', { className: 'text-sm font-black text-slate-950' }, 'Konfigurasi mail aktif'),
              h('p', { className: 'mt-1 text-xs font-semibold leading-5 text-slate-500' }, 'Simpan di sini untuk dipakai saat test email dan pengiriman hasil job riil.')
            ),
            h('div', { className: 'flex flex-wrap gap-2' },
              h(Button, { type: 'button', variant: 'soft', className: 'h-9 gap-2 px-3 text-xs', onClick: () => applySmtpPreset('tls', 587) }, h(Icon, { name: 'ShieldCheck', size: 14 }), '587 STARTTLS'),
              h(Button, { type: 'button', variant: 'soft', className: 'h-9 gap-2 px-3 text-xs', onClick: () => applySmtpPreset('ssl', 465) }, h(Icon, { name: 'LockKeyhole', size: 14 }), '465 SSL'),
              h(Button, { type: 'button', variant: 'soft', className: 'h-9 gap-2 px-3 text-xs', onClick: () => applyApiPreset('brevo') }, h(Icon, { name: 'Webhook', size: 14 }), 'API Brevo free'),
              h(Button, { type: 'button', variant: 'soft', className: 'h-9 gap-2 px-3 text-xs', onClick: () => applyApiPreset('custom') }, h(Icon, { name: 'Cloud', size: 14 }), 'KAT Relay')
            )
          ),
          h('div', { className: 'grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]' },
            h(Field, { label: 'Mail method' },
              h('select', { value: settings?.method || 'smtp', onChange: event => setMailSetting('method', event.target.value), className: 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none' },
                h('option', { value: 'smtp' }, 'SMTP'),
                h('option', { value: 'api' }, 'API eksternal'),
                h('option', { value: 'mail' }, 'PHP mail()')
              )
            ),
            h(Field, { label: 'From email' }, h(TextInput, { type: 'email', value: settings?.from || '', onChange: event => setMailSetting('from', event.target.value), placeholder: 'nama@gmail.com' })),
            h(Field, { label: 'From name' }, h(TextInput, { value: settings?.from_name || '', onChange: event => setMailSetting('from_name', event.target.value), placeholder: 'NIK Queue' }))
          ),
          h('label', { className: 'flex w-fit items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200' }, h('input', { type: 'checkbox', checked: Boolean(settings?.auto_from_username ?? true), onChange: event => setMailSetting('auto_from_username', event.target.checked) }), 'From ikut username jika From kosong/default'),
          editingSmtp ? h('div', { className: 'rounded-2xl bg-white p-3 ring-1 ring-slate-200' },
            h('div', { className: 'flex flex-wrap items-start justify-between gap-3' },
              h('div', null,
                h('h4', { className: 'text-xs font-black uppercase tracking-wide text-slate-600' }, 'SMTP aktif'),
                h('p', { className: 'mt-1 text-xs font-semibold leading-5 text-slate-500' }, editableSmtp.encryption === 'ssl' ? 'Mode SSL/SMTPS memakai koneksi implicit TLS, umumnya port 465.' : 'Mode STARTTLS memakai koneksi TLS setelah handshake, umumnya port 587.')
              )
            ),
            h('div', { className: 'mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3' },
              h(Field, { label: 'SMTP host' }, h(TextInput, { value: editableSmtp.host || '', onChange: event => setSmtpSetting('host', event.target.value), placeholder: 'smtp.gmail.com' })),
              h(Field, { label: 'Port' }, h(TextInput, { type: 'number', min: 1, max: 65535, value: editableSmtp.port || '', onChange: event => setSmtpSetting('port', Number(event.target.value || 0)), placeholder: '587 / 465' })),
              h(Field, { label: 'Encryption' },
                h('select', { value: editableSmtp.encryption || 'tls', onChange: event => setSmtpSetting('encryption', event.target.value), className: 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none' },
                  h('option', { value: 'tls' }, 'TLS / STARTTLS (587)'),
                  h('option', { value: 'ssl' }, 'SSL / SMTPS (465)'),
                  h('option', { value: 'none' }, 'None / plain')
                )
              ),
              h(Field, { label: 'Username SMTP' }, h(TextInput, { value: editableSmtp.username || '', onChange: event => setSmtpSetting('username', event.target.value), placeholder: 'nama@gmail.com' })),
              h(Field, { label: 'Password SMTP', hint: editableSmtp.password_configured ? 'Kosongkan jika tetap memakai password tersimpan.' : 'Isi App Password atau password SMTP provider.' },
                h(TextInput, { type: 'password', value: editableSmtp.password || '', onChange: event => setSmtpSetting('password', event.target.value), placeholder: editableSmtp.password_configured ? 'Password tersimpan' : 'App Password 16 karakter' })
              ),
              h(Field, { label: 'Timeout SMTP' }, h(TextInput, { type: 'number', min: 5, max: 120, value: editableSmtp.timeout || 30, onChange: event => setSmtpSetting('timeout', Number(event.target.value || 30)) }))
            ),
            h('div', { className: 'mt-3 grid gap-2 text-xs font-bold text-slate-600 sm:grid-cols-3' },
              h('label', { className: 'flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200' }, h('input', { type: 'checkbox', checked: Boolean(editableSmtp.auth ?? true), onChange: event => setSmtpSetting('auth', event.target.checked) }), 'SMTP auth'),
              h('label', { className: 'flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200' }, h('input', { type: 'checkbox', checked: Boolean(editableSmtp.strip_password_spaces ?? true), onChange: event => setSmtpSetting('strip_password_spaces', event.target.checked) }), 'Hapus spasi password'),
              h('label', { className: 'flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200' }, h('input', { type: 'checkbox', checked: Boolean(editableSmtp.verify_peer ?? true), onChange: event => setSmtpSetting('verify_peer', event.target.checked) }), 'Verify certificate')
            )
          ) : null,
          editingApi ? h('div', { className: 'rounded-2xl bg-white p-3 ring-1 ring-slate-200' },
            h('div', { className: 'flex flex-wrap items-start justify-between gap-3' },
              h('div', null,
                h('h4', { className: 'text-xs font-black uppercase tracking-wide text-slate-600' }, 'API eksternal aktif'),
                h('p', { className: 'mt-1 text-xs font-semibold leading-5 text-slate-500' }, 'Gunakan ini kalau SMTP tetap gagal. Custom API bisa diarahkan ke server B: https://server-b.example.com/api/mail_relay.php.')
              )
            ),
            h('div', { className: 'mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4' },
              h(Field, { label: 'Provider API' },
                h('select', { value: currentApiProvider, onChange: event => applyApiPreset(event.target.value), className: 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none' },
                  Object.entries(apiProviderLabels).map(([value, label]) => h('option', { key: value, value }, label))
                )
              ),
              h(Field, { label: 'Endpoint API' }, h(TextInput, { value: editableApi.endpoint || '', onChange: event => setApiSetting('endpoint', event.target.value), placeholder: currentApiProvider === 'custom' ? 'https://server-b.example.com/api/mail_relay.php' : apiProviderEndpoints[currentApiProvider || 'resend'] })),
              h(Field, { label: currentApiProvider === 'custom' ? 'Shared secret relay' : 'API key', hint: editableApi.api_key_configured ? 'Kosongkan jika tetap memakai secret/API key tersimpan.' : (currentApiProvider === 'custom' ? 'Isi secret yang sama dengan server relay.' : 'Isi API key provider email.') },
                h(TextInput, { type: 'password', value: editableApi.api_key || '', onChange: event => setApiSetting('api_key', event.target.value), placeholder: editableApi.api_key_configured ? 'Secret tersimpan' : 're_... / xkeysib-... / SG... / secret bebas' })
              ),
              h(Field, { label: 'Timeout API' }, h(TextInput, { type: 'number', min: 5, max: 120, value: editableApi.timeout || 30, onChange: event => setApiSetting('timeout', Number(event.target.value || 30)) }))
            ),
            editingCustomApi ? h('label', { className: 'mt-3 flex w-fit items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200' }, h('input', { type: 'checkbox', checked: Boolean(editableApi.sign_relay_requests ?? true), onChange: event => setApiSetting('sign_relay_requests', event.target.checked) }), 'Sign request KAT Relay') : null
          ) : null,
          editingMail ? h('div', { className: 'rounded-2xl bg-white p-4 ring-1 ring-slate-200' },
            h('div', { className: 'flex items-start gap-3' },
              h('span', { className: 'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-700 ring-1 ring-slate-200' }, h(Icon, { name: 'Mail', size: 18 })),
              h('div', null,
                h('h4', { className: 'text-sm font-black text-slate-950' }, 'PHP mail() aktif'),
                h('p', { className: 'mt-1 text-xs font-semibold leading-5 text-slate-500' }, 'Mode ini hanya memakai mail server bawaan hosting. Tidak perlu SMTP/API key, tetapi deliverability biasanya lebih sulit diprediksi.')
              )
            )
          ) : null,
          h('details', { className: 'rounded-2xl bg-white p-3 ring-1 ring-slate-200' },
            h('summary', { className: 'cursor-pointer text-xs font-black uppercase tracking-wide text-slate-600' }, 'Relay API server B'),
            h('div', { className: 'mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4' },
              h(Field, { label: 'Endpoint relay' }, h(TextInput, { value: editableRelay.endpoint || relay.endpoint || '', readOnly: true })),
              h(Field, { label: 'Relay secret', hint: editableRelay.secret_configured ? 'Kosongkan jika tetap memakai secret tersimpan.' : 'Isi secret yang sama dengan API key di server A.' },
                h(TextInput, { type: 'password', value: editableRelay.secret || '', onChange: event => setRelaySetting('secret', event.target.value), placeholder: editableRelay.secret_configured ? 'Secret tersimpan' : 'buat-secret-relay-panjang' })
              ),
              h(Field, { label: 'Limit/jam' }, h(TextInput, { type: 'number', min: 0, max: 10000, value: editableRelay.rate_limit_per_hour || 120, onChange: event => setRelaySetting('rate_limit_per_hour', Number(event.target.value || 0)) })),
              h(Field, { label: 'Max payload byte' }, h(TextInput, { type: 'number', min: 1024, max: 104857600, value: editableRelay.max_payload_bytes || 4718592, onChange: event => setRelaySetting('max_payload_bytes', Number(event.target.value || 4718592)) })),
              h(Field, { label: 'TTL signature detik' }, h(TextInput, { type: 'number', min: 30, max: 3600, value: editableRelay.signature_ttl_seconds || 300, onChange: event => setRelaySetting('signature_ttl_seconds', Number(event.target.value || 300)) })),
              h(Field, { label: 'TTL idempotency detik' }, h(TextInput, { type: 'number', min: 0, max: 604800, value: editableRelay.idempotency_ttl_seconds || 86400, onChange: event => setRelaySetting('idempotency_ttl_seconds', Number(event.target.value || 86400)) }))
            ),
            h('div', { className: 'mt-3 grid gap-2 text-xs font-bold text-slate-600 sm:grid-cols-2' },
              h('label', { className: 'flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200' }, h('input', { type: 'checkbox', checked: Boolean(editableRelay.enabled ?? true), onChange: event => setRelaySetting('enabled', event.target.checked) }), 'Aktifkan endpoint relay'),
              h('label', { className: 'flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200' }, h('input', { type: 'checkbox', checked: Boolean(editableRelay.honor_sender ?? false), onChange: event => setRelaySetting('honor_sender', event.target.checked) }), 'Hormati From dari server A'),
              h('label', { className: 'flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200' }, h('input', { type: 'checkbox', checked: Boolean(editableRelay.require_signature ?? false), onChange: event => setRelaySetting('require_signature', event.target.checked) }), 'Wajib HMAC signature')
            ),
            h('p', { className: 'mt-3 text-xs font-semibold leading-5 text-slate-500' }, 'Pola aman: server A pakai method API custom menuju endpoint ini, server B menyimpan secret relay dan mengirim email dengan SMTP/API lokalnya.'),
            h('div', { className: 'mt-3 flex flex-wrap gap-2' },
              h(Button, { type: 'button', variant: 'soft', className: 'h-9 gap-2 px-3 text-xs', onClick: checkRelayEndpoint }, h(Icon, { name: 'Radar', size: 14 }), 'Cek endpoint'),
              h(Button, { type: 'button', variant: 'ghost', className: 'h-9 gap-2 px-3 text-xs', onClick: copyRelayEndpoint }, h(Icon, { name: 'Copy', size: 14 }), 'Copy endpoint')
            ),
            relayProbe ? h('div', { className: 'mt-3' }, h(Notice, { message: relayProbe })) : null
          ),
          h('div', { className: 'flex flex-wrap items-center justify-between gap-3' },
            h('p', { className: 'text-xs font-semibold leading-5 text-slate-500' }, 'Urutan cadangan yang disarankan: 587 STARTTLS, 465 SSL, lalu API eksternal jika port SMTP tetap ditutup hosting.'),
            h(Button, { type: 'submit', variant: 'success', className: 'gap-2', disabled: saving || loading || !adminKey || !settings }, h(Icon, { name: saving ? 'LoaderCircle' : 'Save', size: 16 }), saving ? 'Menyimpan...' : 'Simpan setting mail')
          )
        ),
        h('div', { className: 'mt-4 overflow-hidden rounded-2xl border border-slate-100' },
          rows.map(([label, value, detail]) => h('div', { key: label, className: 'grid gap-1 border-b border-slate-100 px-4 py-3 last:border-b-0 md:grid-cols-[170px_minmax(0,1fr)_minmax(0,1.4fr)]' },
            h('span', { className: 'text-xs font-black uppercase text-slate-500' }, label),
            h('strong', { className: 'min-w-0 break-words text-sm text-slate-950' }, String(value || '-')),
            h('span', { className: 'text-xs font-semibold leading-5 text-slate-500' }, detail)
          ))
        ),
        config?.tips?.length ? h('div', { className: 'mt-4 flex flex-wrap gap-2' },
          config.tips.map(tip => h('span', { key: tip, className: 'inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200' }, h(Icon, { name: 'Info', size: 13 }), tip))
        ) : null,
        h('div', { className: 'mt-4 flex flex-wrap gap-2' },
          h(Button, { type: 'button', variant: 'soft', className: 'gap-2', disabled: loading || !adminKey, onClick: load }, h(Icon, { name: loading ? 'LoaderCircle' : 'RefreshCcw', size: 16 }), loading ? 'Membaca...' : 'Refresh konfigurasi')
        )
      ),
      h('form', { className: 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm', onSubmit: testEmail },
        h('div', { className: 'flex items-start justify-between gap-4' },
          h('div', null,
            h('h2', { className: 'text-lg font-black text-slate-950' }, 'Kirim test'),
            h('p', { className: 'mt-1 text-sm leading-6 text-slate-500' }, 'Kosongkan penerima untuk mencoba kirim ke username SMTP yang tersimpan.')
          ),
          h('span', { className: 'grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100' }, h(Icon, { name: 'Send', size: 18 }))
        ),
        h('div', { className: 'mt-4 grid gap-3' },
          h(Field, { label: 'Email penerima', hint: 'Tidak wajib. Jika kosong, sistem pakai username SMTP atau From.' }, h(TextInput, { type: 'email', value: email, onChange: event => setEmail(event.target.value), placeholder: 'nama@gmail.com' })),
          h(Field, { label: 'Subject test', hint: 'Opsional.' }, h(TextInput, { value: subject, onChange: event => setSubject(event.target.value), placeholder: 'Test email NIK Queue' })),
          h(Button, { type: 'submit', variant: 'blue', className: 'gap-2', disabled: loading || !adminKey }, h(Icon, { name: loading ? 'LoaderCircle' : 'Send', size: 16 }), loading ? 'Mengirim...' : 'Kirim test email')
        ),
        h('div', { className: 'mt-4' }, h(Notice, { message }))
      ),
      h('section', { className: 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-start-2' },
        h('div', { className: 'flex items-start justify-between gap-4' },
          h('div', null,
            h('h2', { className: 'text-lg font-black text-slate-950' }, 'Mail observability'),
            h('p', { className: 'mt-1 text-sm leading-6 text-slate-500' }, 'Log aman untuk melihat kegagalan SMTP/API/relay tanpa menampilkan secret atau email penuh.')
          ),
          h('span', { className: 'grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-slate-700 ring-1 ring-slate-200' }, h(Icon, { name: 'Activity', size: 18 }))
        ),
        h('div', { className: 'mt-4 grid grid-cols-2 gap-3' },
          h(MiniMetric, { icon: 'Send', label: 'Relay sent', value: fullNumber(observabilitySummary.relay_sent || 0) }),
          h(MiniMetric, { icon: 'TriangleAlert', label: 'Failed', value: fullNumber((observabilitySummary.relay_failed || 0) + (observabilitySummary.mail_errors || 0)) }),
          h(MiniMetric, { icon: 'ShieldAlert', label: 'Auth fail', value: fullNumber(observabilitySummary.relay_auth_failed || 0) }),
          h(MiniMetric, { icon: 'Clock3', label: 'Latest', value: observabilitySummary.latest_at ? formatDateTime(observabilitySummary.latest_at) : '-' })
        ),
        h('div', { className: 'mt-4 flex flex-wrap items-center justify-between gap-2' },
          h('p', { className: 'text-xs font-semibold leading-5 text-slate-500' }, observabilitySummary.log_retention_note || 'Menampilkan log lokal terakhir.'),
          h(Button, { type: 'button', variant: 'soft', className: 'h-9 gap-2 px-3 text-xs', disabled: logsLoading || !adminKey, onClick: loadObservability }, h(Icon, { name: logsLoading ? 'LoaderCircle' : 'RefreshCcw', size: 14 }), logsLoading ? 'Membaca...' : 'Refresh log')
        ),
        mailObservability?.error ? h('div', { className: 'mt-3' }, h(Notice, { message: { type: 'error', text: mailObservability.error } })) : null,
        h('div', { className: 'mt-4 grid max-h-[420px] gap-2 overflow-y-auto pr-1' },
          observabilityEvents.length ? observabilityEvents.slice(0, 12).map((event, index) => h('article', { key: `${event.source}-${event.time}-${event.request_id}-${index}`, className: 'rounded-xl border border-slate-100 bg-slate-50 p-3' },
            h('div', { className: 'flex flex-wrap items-center justify-between gap-2' },
              h('span', { className: cx('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black uppercase ring-1', mailEventTone(event)) }, mailEventLabel(event)),
              h('span', { className: 'text-[11px] font-bold text-slate-500' }, event.time ? formatDateTime(event.time) : '-')
            ),
            h('p', { className: 'mt-2 text-xs font-semibold leading-5 text-slate-600' }, event.error || (event.sent ? 'Email terkirim lewat relay.' : 'Event relay tercatat.')),
            h('div', { className: 'mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold text-slate-500' },
              event.status ? h('span', { className: 'rounded-full bg-white px-2 py-1 ring-1 ring-slate-200' }, `HTTP ${event.status}`) : null,
              event.to_domain ? h('span', { className: 'rounded-full bg-white px-2 py-1 ring-1 ring-slate-200' }, event.to_domain) : null,
              event.request_id ? h('span', { className: 'rounded-full bg-white px-2 py-1 ring-1 ring-slate-200' }, `req ${event.request_id.slice(0, 10)}`) : null,
              event.ip_hash ? h('span', { className: 'rounded-full bg-white px-2 py-1 ring-1 ring-slate-200' }, `ip#${event.ip_hash}`) : null,
              event.attachment ? h('span', { className: 'rounded-full bg-white px-2 py-1 ring-1 ring-slate-200' }, 'attachment') : null
            )
          )) : h('div', { className: 'rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-500' }, 'Belum ada log mail/relay yang terbaca.')
        )
      )
    );
  }

  function DataStoreAdmin({ adminKey }) {
    const [summary, setSummary] = useState(null);
    const [driveSummary, setDriveSummary] = useState(null);
    const [driveFolders, setDriveFolders] = useState({});
    const [driveOauth, setDriveOauth] = useState({ client_id: '', client_secret: '', redirect_uri: '' });
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [driveLoading, setDriveLoading] = useState(false);
    const store = summary?.store || {};
    const counts = store.counts || {};
    const mysqlCounts = summary?.mysql_counts || {};
    const supabaseCounts = summary?.supabase?.counts || {};
    const migrationReport = summary?.production_migration_report || null;
    const tableLabels = {
      jobs: 'Jobs',
      workers: 'Workers',
      job_events: 'Events',
      regions: 'Regions',
      geojson_layers: 'GeoJSON',
      kat_distribution_records: 'Persebaran',
      bnba_records: 'BNBA',
      bnba_fix_requests: 'Fix',
      link_archive: 'Link Archive',
      site_content: 'Konten Situs',
    };

    async function load() {
      if (!adminKey) return;
      setLoading(true);
      try {
        const data = await apiRequest(`data_store.php?key=${encodeURIComponent(adminKey)}`);
        setSummary(data);
        setMessage(null);
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    async function runAction(action, payload = {}) {
      if (!adminKey) return setMessage({ type: 'error', text: 'Masukkan admin key dulu.' });
      if (action === 'export_mysql_to_sheets' && !window.confirm('Migrasi akan mengganti isi seluruh tab Google Sheets tujuan dengan data MySQL saat ini. Lanjutkan?')) return;
      if (action === 'migrate_table' && !window.confirm(`Isi tabel ${payload.table} pada ${payload.destination} akan diganti dengan data dari database aktif. Lanjutkan?`)) return;
      if (action === 'set_runtime_data_store_mode' && !window.confirm(`Gunakan ${payload.mode} sebagai database aktif untuk semua CRUD?`)) return;
      const labels = {
        export_mysql_to_json: 'Membuat Big JSON dari MySQL...',
        export_mysql_to_sheets: 'Memigrasikan seluruh tabel MySQL ke Google Sheets...',
        prepare_sheets: 'Menyiapkan seluruh tab dan header Google Sheets...',
        seed_link_archive: 'Menanam seed Link Archive...',
        seed_link_archive_json: 'Menanam seed Link Archive ke Big JSON...',
        seed_link_archive_mysql: 'Menanam seed Link Archive ke MySQL...',
        migrate_table: `Memigrasikan tabel ${payload.table || ''}...`,
        migrate_all_to_supabase: 'Memigrasikan seluruh tabel ke Supabase...',
        set_runtime_data_store_mode: `Mengaktifkan database ${payload.mode || ''}...`,
      };
      setLoading(true);
      setMessage({ type: 'info', text: labels[action] || 'Memproses data store...' });
      try {
        const data = await apiRequest('data_store.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
          body: JSON.stringify({ action, ...payload }),
        }, { timeoutMs: 120000 });
        setSummary(current => ({ ...(current || {}), ...data }));
        setMessage({ type: 'info', text: data.message || 'Data store selesai diperbarui.' });
        await load();
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    async function loadDrive(refresh = false) {
      if (!adminKey) return;
      setDriveLoading(true);
      try {
        const data = await apiRequest(`google_drive_accounts.php?key=${encodeURIComponent(adminKey)}${refresh ? '&refresh=1' : ''}`);
        setDriveSummary(data);
        setDriveFolders(Object.fromEntries((data.accounts || []).map(account => [account.id, account.folder_id || ''])));
        setDriveOauth(current => ({
          client_id: data.oauth_client_id || current.client_id || '',
          client_secret: '',
          redirect_uri: data.redirect_uri || current.redirect_uri || '',
        }));
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setDriveLoading(false);
      }
    }

    async function driveAction(action, account = null, changes = {}) {
      if (!adminKey) return setMessage({ type: 'error', text: 'Masukkan admin key dulu.' });
      setDriveLoading(true);
      try {
        const data = await apiRequest('google_drive_accounts.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
          body: JSON.stringify({
            action,
            account_id: account?.id || '',
            folder_id: account ? (driveFolders[account.id] || '') : '',
            enabled: changes.enabled ?? (account?.enabled !== false),
            storage_mode: changes.storage_mode || '',
            limit: changes.limit || 10,
            oauth_client_id: changes.oauth_client_id || '',
            oauth_client_secret: changes.oauth_client_secret || '',
            oauth_redirect_uri: changes.oauth_redirect_uri || '',
          }),
        }, { timeoutMs: 120000 });
        if (action === 'connect_url') {
          window.location.href = data.url;
          return;
        }
        if (action === 'save_oauth_config') {
          setDriveOauth(current => ({ ...current, client_secret: '' }));
        }
        const migrationDetail = data.migration
          ? ` Sisa ${fullNumber(data.migration.remaining_files || 0)} file lokal; gagal ${fullNumber(data.migration.failed_jobs || 0)} job.${data.migration.errors?.[0]?.error ? ` Error pertama: ${data.migration.errors[0].error}` : ''}`
          : '';
        setMessage({ type: data.migration?.failed_jobs ? 'error' : 'info', text: (data.message || (action === 'update' ? 'Target Google Drive disimpan.' : action === 'disconnect' ? 'Akun Google Drive dilepas.' : 'Aksi Google Drive berhasil.')) + migrationDetail });
        await loadDrive(true);
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setDriveLoading(false);
      }
    }

    useEffect(() => {
      if (!adminKey) return;
      load();
      loadDrive(currentQuery().get('drive') === 'connected');
      const driveStatus = currentQuery().get('drive');
      if (driveStatus === 'connected') setMessage({ type: 'info', text: 'Akun Google Drive berhasil dihubungkan.' });
      if (driveStatus === 'error') setMessage({ type: 'error', text: currentQuery().get('drive_message') || 'Akun Google Drive belum berhasil dihubungkan.' });
    }, [adminKey]);

    const jsonDownload = adminKey ? apiUrl(`data_store.php?download=1&key=${encodeURIComponent(adminKey)}`) : '#';
    const tableKeys = Object.keys(tableLabels);
    const storeMode = store.mode || '-';
    const portableLabel = storeMode === 'supabase' ? 'Supabase' : (storeMode === 'sheets' ? 'Google Sheets' : (storeMode === 'json' ? 'Big JSON' : 'Database aktif'));
    const sheetsWritePreflight = summary?.sheets_write_preflight || null;
    const sheetsWriteError = sheetsWritePreflight?.errors ? Object.values(sheetsWritePreflight.errors)[0] : '';
    const workerControlPlane = summary?.worker_control_plane || null;
    const storeDescription = !adminKey
      ? 'Buka akses admin untuk membaca konfigurasi database dan mengaktifkan kontrol migrasi.'
      : summary === null
        ? 'Sedang membaca konfigurasi database aktif...'
        : storeMode === 'supabase'
          ? 'CRUD aktif memakai Supabase. Pilihan database runtime dan akun Google Drive juga persisten untuk fungsi serverless.'
          : storeMode === 'sheets'
            ? 'CRUD portable memakai satu workbook Google Sheets untuk seluruh tab operasional. Persebaran dapat memakai workbook publik terpisah.'
            : storeMode === 'json'
              ? 'CRUD portable sedang memakai satu snapshot Big JSON di storage lokal.'
              : 'MySQL masih menjadi sumber aktif. Dari panel ini data dapat disalin ke Big JSON atau Google Sheets sebelum mode dipindahkan.';
    const configuredSheets = Object.values(store.tables || {}).filter(table => table?.spreadsheet_id).length;

    return h('section', { className: 'grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]' },
      h('div', { className: 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm' },
        h('div', { className: 'flex items-start justify-between gap-4' },
          h('div', null,
            h('h2', { className: 'text-lg font-black text-slate-950' }, 'Data store & migrasi'),
            h('p', { className: 'mt-1 max-w-2xl text-sm leading-6 text-slate-500' }, storeDescription)
          ),
          h('span', { className: 'grid h-11 w-11 place-items-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100' }, h(Icon, { name: 'DatabaseZap', size: 21 }))
        ),
        h('div', { className: 'mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4' },
          h(MiniMetric, { icon: 'ToggleRight', label: 'Mode aktif', value: storeMode }),
          h(MiniMetric, { icon: storeMode === 'sheets' ? 'Sheet' : 'HardDrive', label: storeMode === 'sheets' ? 'Sheet terhubung' : 'Snapshot JSON', value: storeMode === 'sheets' ? fullNumber(configuredSheets) : (store.exists ? formatBytes(store.size_bytes || 0) : 'belum ada') }),
          h(MiniMetric, { icon: 'Clock3', label: 'Updated', value: store.updated_at ? formatDateTime(store.updated_at) : '-' }),
          h(MiniMetric, { icon: 'LibraryBig', label: 'Link seed', value: fullNumber(counts.link_archive || 0) })
        ),
        workerControlPlane?.fallback_active ? h('div', { className: 'mt-4 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200' },
          h('div', { className: 'flex items-start gap-3' },
            h('span', { className: 'grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800' }, h(Icon, { name: 'ShieldAlert', size: 18 })),
            h('div', null,
              h('p', { className: 'text-sm font-black text-amber-950' }, 'Worker tetap berjalan melalui JSON darurat'),
              h('p', { className: 'mt-1 text-xs font-semibold leading-5 text-amber-900' },
                `Google Sheets sedang bermasalah. Claim, heartbeat, progress, dan hasil job disimpan lokal lalu disinkronkan kembali${workerControlPlane.retry_at ? ` setelah ${formatDateTime(workerControlPlane.retry_at)}` : ' saat koneksi pulih'}.`),
              workerControlPlane.reason ? h('p', { className: 'mt-1 break-words text-xs font-semibold leading-5 text-amber-800' }, workerControlPlane.reason) : null
            )
          )
        ) : null,
        storeMode !== 'sheets' ? h('div', { className: 'mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100' },
          h('p', { className: 'text-xs font-black uppercase text-slate-500' }, 'Path Big JSON'),
          h('p', { className: 'mt-1 break-all text-sm font-black text-slate-950' }, store.json_relative_path || 'data/bigjson.json'),
          h('p', { className: 'mt-1 break-all text-xs font-semibold text-slate-500' }, store.json_path || '')
        ) : h('div', { className: 'mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100' },
          h('p', { className: 'text-xs font-black uppercase text-slate-500' }, 'Konfigurasi Google Sheets'),
          h('p', { className: 'mt-1 text-sm font-black text-slate-950' }, `${configuredSheets} tabel memiliki spreadsheet ID.`),
          h('p', { className: cx('mt-1 text-xs font-black leading-5', sheetsWritePreflight?.ok ? 'text-emerald-700' : 'text-rose-700') }, sheetsWritePreflight?.ok
            ? 'Google Sheets API siap mengakses seluruh workbook tujuan.'
            : `Belum siap menulis: ${sheetsWriteError || 'akses Google Sheets API belum diuji.'}`),
          !sheetsWritePreflight?.ok && /404|requested entity was not found/i.test(sheetsWriteError || '') ? h('p', { className: 'mt-1 text-xs font-black leading-5 text-rose-700' }, 'Solusi: bagikan workbook sebagai Editor ke minimal satu akun Google aktif di bagian Google Drive storage.') : null,
          h('p', { className: 'mt-1 text-xs font-semibold leading-5 text-slate-500' }, 'Gunakan satu worker saat seluruh queue memakai Sheets karena Google Sheets tidak memiliki transaksi lintas-server.')
        ),
        h('div', { className: 'mt-4 flex flex-wrap gap-2' },
          h(Button, { type: 'button', variant: 'soft', className: 'gap-2', disabled: loading || !adminKey, onClick: load }, h(Icon, { name: loading ? 'LoaderCircle' : 'RefreshCcw', size: 16 }), loading ? 'Memuat...' : 'Refresh'),
          h(Button, { type: 'button', variant: 'success', className: 'gap-2', disabled: loading || !adminKey, onClick: () => runAction('prepare_sheets') }, h(Icon, { name: 'TableProperties', size: 16 }), 'Siapkan tab Sheets'),
          h(Button, { type: 'button', variant: 'blue', className: 'gap-2', disabled: loading || !adminKey || sheetsWritePreflight?.ok === false, onClick: () => runAction('export_mysql_to_sheets') }, h(Icon, { name: 'Sheet', size: 16 }), 'Migrasi MySQL ke Sheets'),
          h(Button, { type: 'button', variant: 'blue', className: 'gap-2', disabled: loading || !adminKey || !summary?.supabase?.configured, onClick: () => runAction('migrate_all_to_supabase', { source: storeMode }) }, h(Icon, { name: 'DatabaseZap', size: 16 }), 'Migrasi semua ke Supabase'),
          h(Button, { type: 'button', variant: 'soft', className: 'gap-2', disabled: loading || !adminKey || storeMode !== 'mysql', onClick: () => runAction('export_mysql_to_json') }, h(Icon, { name: 'FileJson2', size: 16 }), 'Snapshot Big JSON'),
          h(Button, { type: 'button', variant: 'success', className: 'gap-2', disabled: loading || !adminKey, onClick: () => runAction('seed_link_archive') }, h(Icon, { name: 'Sprout', size: 16 }), 'Seed Link Archive'),
          store.exists ? h('a', { href: jsonDownload, className: 'inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50' }, h(Icon, { name: 'Download', size: 16 }), 'Download JSON') : null
        ),
        h('div', { className: 'mt-4 border-t border-slate-100 pt-4' },
          h('p', { className: 'text-xs font-black uppercase text-slate-500' }, 'Database aktif'),
          h('div', { className: 'mt-2 flex flex-wrap gap-2' },
            ['supabase', 'mysql', 'sheets', 'json'].map(mode => h(Button, {
              key: mode,
              type: 'button',
              variant: storeMode === mode ? 'blue' : 'soft',
              disabled: loading || !adminKey || storeMode === mode || (mode === 'supabase' && !summary?.supabase?.configured),
              onClick: () => runAction('set_runtime_data_store_mode', { mode }),
            }, mode === 'supabase' ? 'Supabase' : mode === 'sheets' ? 'Google Sheets' : mode === 'json' ? 'Big JSON' : 'MySQL'))
          )
        ),
        migrationReport ? h('div', { className: 'mt-4 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200' },
          h('p', { className: 'text-xs font-black uppercase text-amber-800' }, 'Audit migrasi produksi'),
          h('p', { className: 'mt-1 text-xs font-semibold leading-5 text-amber-900' },
            `Dipulihkan: ${fullNumber(migrationReport.recovered_counts?.jobs || 0)} job, ${fullNumber(migrationReport.recovered_counts?.job_events || 0)} event, ${fullNumber(migrationReport.recovered_counts?.kat_distribution_records || 0)} persebaran, dan ${fullNumber(migrationReport.recovered_counts?.bnba_records || 0)} BNBA.`),
          migrationReport.unrecoverable_counts?.bnba_records ? h('p', { className: 'mt-1 text-xs font-black leading-5 text-rose-700' },
            `${fullNumber(migrationReport.unrecoverable_counts.bnba_records)} baris BNBA lama belum dapat dipulihkan karena API produksi tidak mengekspos isi barisnya.`) : null
        ) : null,
        h('div', { className: 'mt-4' }, h(Notice, { message }))
      ),
      h('div', { className: 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm' },
        h('h2', { className: 'text-lg font-black text-slate-950' }, 'Tabel & migrasi'),
        h('div', { className: 'mt-4 grid gap-2' },
          tableKeys.map(key => h('div', { key, className: 'rounded-xl bg-slate-50 px-3 py-3 ring-1 ring-slate-100' },
            h('div', { className: 'flex items-center justify-between gap-3' },
              h('span', { className: 'break-words text-xs font-black text-slate-700', title: tableLabels[key] }, tableLabels[key]),
              h('div', { className: 'flex items-center gap-3 text-right text-[11px] font-black' },
                h('span', { className: 'text-indigo-700', title: portableLabel }, `Aktif ${counts[key] === null ? 'error' : fullNumber(counts[key] || 0)}`),
                h('span', { className: 'text-emerald-700', title: 'Supabase' }, `Supa ${supabaseCounts[key] == null ? '-' : fullNumber(supabaseCounts[key])}`),
                h('span', { className: 'text-slate-500', title: mysqlCounts[key]?.ok ? 'MySQL' : (mysqlCounts[key]?.error || 'MySQL tidak dicek') }, `SQL ${mysqlCounts[key]?.ok ? fullNumber(mysqlCounts[key].total || 0) : '-'}`)
              )
            ),
            h('div', { className: 'mt-2 flex flex-wrap gap-1.5' },
              h(Button, { type: 'button', variant: 'soft', disabled: loading || !adminKey || storeMode === 'supabase' || !summary?.supabase?.configured, onClick: () => runAction('migrate_table', { table: key, source: 'active', destination: 'supabase' }) }, 'Ke Supabase'),
              h(Button, { type: 'button', variant: 'soft', disabled: loading || !adminKey || storeMode === 'sheets', onClick: () => runAction('migrate_table', { table: key, source: 'active', destination: 'sheets' }) }, 'Ke Sheets'),
              h('a', { href: adminKey ? apiUrl(`data_store.php?download_table=${encodeURIComponent(key)}&source=active&key=${encodeURIComponent(adminKey)}`) : '#', className: 'inline-flex h-9 items-center gap-1 rounded-lg bg-white px-3 text-xs font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100' }, h(Icon, { name: 'Download', size: 14 }), 'Excel')
            )
          ))
        ),
        h('p', { className: 'mt-4 text-xs font-semibold leading-5 text-slate-500' }, 'Migrasi per tabel mengganti isi tabel tujuan saja. Export Excel selalu mengambil database yang sedang aktif.')
      ),
      h('section', { className: 'xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm' },
        h('div', { className: 'flex flex-wrap items-start justify-between gap-3' },
          h('div', null,
            h('h2', { className: 'text-lg font-black text-slate-950' }, 'Google Drive storage'),
            h('p', { className: 'mt-1 text-sm font-semibold text-slate-500' }, !adminKey
              ? 'Status belum diperiksa karena panel admin masih terkunci.'
              : driveSummary === null
                ? (driveLoading ? 'Sedang memeriksa konfigurasi OAuth dan akun Google...' : 'Status akun Google belum berhasil dimuat.')
                : driveSummary.configured
                  ? `${fullNumber(driveSummary.account_count || 0)} akun terhubung, ${fullNumber(driveSummary.enabled_count || 0)} siap sebagai target storage.${driveSummary?.reconnect_required_count ? ` ${fullNumber(driveSummary.reconnect_required_count)} perlu dihubungkan ulang.` : ''}`
                  : `OAuth belum lengkap: ${(driveSummary.missing_env || []).join(', ') || 'periksa konfigurasi Google pada backend.'}`),
            h('p', { className: 'mt-1 text-xs font-semibold leading-5 text-slate-500' }, 'Akun yang siap juga dipakai untuk membaca dan menulis workbook Sheets bila service account tidak tersedia. Pastikan OAuth consent screen Google berstatus In production; mode Testing dapat membuat refresh token kedaluwarsa setelah 7 hari.'),
            driveSummary?.encryption_key_source === 'admin_key_fallback'
              ? h('p', { className: 'mt-2 text-xs font-bold leading-5 text-amber-700' }, 'Kunci token masih mengikuti ADMIN_KEY. Isi GOOGLE_TOKEN_ENCRYPTION_KEY yang tetap agar perubahan admin key tidak memutus akun Google.')
              : driveSummary?.encryption_key_source === 'oauth_client_secret_fallback'
                ? h('p', { className: 'mt-2 text-xs font-bold leading-5 text-emerald-700' }, 'Token memakai OAuth client secret yang stabil dan token lama dimigrasikan otomatis. GOOGLE_TOKEN_ENCRYPTION_KEY khusus tetap direkomendasikan untuk produksi.')
              : null
          ),
          h('div', { className: 'flex flex-wrap gap-2' },
            h(Button, { type: 'button', variant: 'soft', className: 'gap-2', disabled: driveLoading || !adminKey, onClick: () => loadDrive(true) }, h(Icon, { name: driveLoading ? 'LoaderCircle' : 'RefreshCcw', size: 16 }), 'Refresh kuota'),
            h(Button, {
              type: 'button',
              variant: 'success',
              className: 'gap-2',
              disabled: driveLoading || !adminKey || !(driveSummary?.enabled_count > 0),
              onClick: () => {
                if (window.confirm('Pindahkan maksimal 10 job lokal ke seluruh target Drive aktif? Metadata job diperbarui dulu sebelum file lokal dihapus.')) {
                  driveAction('migrate_job_files', null, { limit: 10 });
                }
              },
            }, h(Icon, { name: 'FolderSync', size: 16 }), 'Migrasikan file job lama'),
            h(Button, { type: 'button', variant: 'blue', className: 'gap-2', disabled: driveLoading || !adminKey, onClick: () => driveAction('connect_url') }, h(Icon, { name: 'UserPlus', size: 16 }), driveSummary?.reconnect_required_count ? 'Hubungkan ulang akun' : 'Tambah akun Google')
          )
        ),
        driveSummary?.reconnect_required_count
          ? h('div', { className: 'mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900' },
              `${fullNumber(driveSummary.reconnect_required_count)} akun tidak dapat membuka token tersimpan. Hubungkan ulang akun tersebut; akun bermasalah tidak akan dipakai untuk Sheets maupun upload Drive.`)
          : null,
        adminKey && driveSummary && !driveSummary.configured
          ? h('div', { className: 'mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4' },
              h('div', { className: 'flex items-start justify-between gap-3' },
                h('div', null,
                  h('p', { className: 'text-sm font-black text-indigo-950' }, 'Konfigurasi OAuth Google'),
                  h('p', { className: 'mt-1 text-xs font-semibold leading-5 text-indigo-800' }, 'Masukkan credential OAuth Web application dari Google Cloud. Client Secret disimpan terenkripsi di Supabase dan tidak pernah ditampilkan kembali.')
                ),
                h(Badge, { status: 'pending' }, 'perlu setup')
              ),
              h('div', { className: 'mt-3 grid gap-3 lg:grid-cols-2' },
                h(Field, { label: 'OAuth Client ID' }, h(TextInput, {
                  value: driveOauth.client_id,
                  onChange: event => setDriveOauth(current => ({ ...current, client_id: event.target.value })),
                  placeholder: '...apps.googleusercontent.com',
                })),
                h(Field, { label: 'OAuth Client Secret' }, h(TextInput, {
                  type: 'password',
                  value: driveOauth.client_secret,
                  onChange: event => setDriveOauth(current => ({ ...current, client_secret: event.target.value })),
                  placeholder: driveSummary.oauth_source === 'admin_runtime' ? 'Kosongkan untuk mempertahankan secret' : 'Masukkan client secret',
                })),
                h('div', { className: 'lg:col-span-2' },
                  h(Field, { label: 'Authorized redirect URI' }, h(TextInput, {
                    value: driveOauth.redirect_uri,
                    onChange: event => setDriveOauth(current => ({ ...current, redirect_uri: event.target.value })),
                    placeholder: apiUrl('google_drive_oauth.php'),
                  }))
                )
              ),
              h('div', { className: 'mt-3 flex flex-wrap items-center justify-between gap-3' },
                h('p', { className: 'break-all text-xs font-bold text-indigo-800' }, `Daftarkan URI ini persis di Google Cloud: ${driveOauth.redirect_uri || apiUrl('google_drive_oauth.php')}`),
                h(Button, {
                  type: 'button',
                  variant: 'blue',
                  className: 'gap-2',
                  disabled: driveLoading || !driveOauth.client_id.trim() || (!driveOauth.client_secret.trim() && driveSummary.oauth_source !== 'admin_runtime'),
                  onClick: () => driveAction('save_oauth_config', null, {
                    oauth_client_id: driveOauth.client_id.trim(),
                    oauth_client_secret: driveOauth.client_secret,
                    oauth_redirect_uri: driveOauth.redirect_uri.trim(),
                  }),
                }, h(Icon, { name: 'Save', size: 16 }), 'Simpan OAuth')
              )
            )
          : null,
        h('div', { className: 'mt-4 grid gap-3 sm:grid-cols-3' },
          h(MiniMetric, { icon: 'Users', label: 'Akun terhubung', value: fullNumber(driveSummary?.account_count || 0) }),
          h(MiniMetric, { icon: 'HardDrive', label: 'Total kapasitas', value: driveSummary?.quota?.limit ? formatBytes(driveSummary.quota.limit) : '-' }),
          h(MiniMetric, { icon: 'DatabaseBackup', label: 'Sisa terukur', value: driveSummary?.quota?.free != null ? formatBytes(driveSummary.quota.free) : '-' })
        ),
        h('div', { className: 'mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4' },
          h('div', { className: 'flex flex-wrap items-start justify-between gap-3' },
            h('div', null,
              h('p', { className: 'text-xs font-black uppercase text-slate-500' }, 'Lokasi upload baru'),
              h('p', { className: cx('mt-1 text-sm font-black', driveSummary?.storage_mode === 'local' ? 'text-amber-700' : 'text-emerald-700') },
                driveSummary?.storage_mode === 'drive'
                  ? 'Google Drive aktif'
                  : driveSummary?.storage_mode === 'hybrid'
                    ? 'Hybrid aktif: server + Google Drive'
                    : 'Lokal aktif: file belum dikirim ke Google Drive')
            ),
            h('div', { className: 'inline-flex overflow-hidden rounded-lg border border-slate-200 bg-white p-1' },
              ['local', 'drive', 'hybrid'].map(mode => h('button', {
                key: mode,
                type: 'button',
                disabled: driveLoading || !adminKey || (mode !== 'local' && !(driveSummary?.enabled_count > 0)),
                onClick: () => driveAction('set_storage_mode', null, { storage_mode: mode }),
                className: cx('h-9 px-3 text-xs font-black transition', driveSummary?.storage_mode === mode ? 'rounded-md bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100', 'disabled:cursor-not-allowed disabled:opacity-40'),
              }, mode === 'local' ? 'Lokal' : mode === 'drive' ? 'Drive' : 'Hybrid'))
            )
          ),
          h('p', { className: 'mt-2 text-xs font-semibold leading-5 text-slate-500' }, driveSummary?.storage_mode === 'drive'
            ? 'Draft, input padan, dan hasil baru disimpan ke seluruh target Drive aktif.'
            : driveSummary?.storage_mode === 'hybrid'
              ? 'Draft, input padan, dan hasil baru memiliki salinan lokal serta replika Drive.'
              : 'Akun Drive boleh sudah terhubung, tetapi upload tetap berada di server sampai mode Drive atau Hybrid dipilih.')
        ),
        h('div', { className: 'mt-4 grid gap-3 lg:grid-cols-2' },
          (driveSummary?.accounts || []).map(account => {
            const quota = account.quota || {};
            const reconnectRequired = !!account.reconnect_required;
            return h('article', { key: account.id, className: 'rounded-xl border border-slate-200 bg-slate-50 p-4' },
              h('div', { className: 'flex items-start justify-between gap-3' },
                h('div', { className: 'min-w-0' },
                  h('strong', { className: 'block break-all text-sm font-black text-slate-950' }, account.email || account.display_name || 'Akun Google Drive'),
                  h('span', { className: 'mt-1 block text-xs font-bold text-slate-500' }, quota.limit ? `${formatBytes(quota.usage)} terpakai dari ${formatBytes(quota.limit)} (${fullNumber(quota.percent_used || 0)}%)` : `${formatBytes(quota.usage || 0)} terpakai; batas tidak dilaporkan Google`)
                ),
                h(Badge, { status: reconnectRequired || account.last_error ? 'failed' : account.enabled ? 'checked' : 'pending' }, reconnectRequired ? 'hubungkan ulang' : account.last_error ? 'error' : account.enabled ? 'aktif' : 'nonaktif')
              ),
              account.last_error ? h('p', { className: 'mt-2 text-xs font-bold text-rose-600' }, account.last_error) : null,
              h('div', { className: 'mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]' },
                h(TextInput, { value: driveFolders[account.id] ?? account.folder_id ?? '', onChange: event => setDriveFolders(current => ({ ...current, [account.id]: event.target.value })), placeholder: 'Folder ID Drive; kosong = My Drive' }),
                h(Button, { type: 'button', variant: 'soft', className: 'gap-2', disabled: driveLoading, onClick: () => driveAction('update', account) }, h(Icon, { name: 'Save', size: 15 }), 'Simpan')
              ),
              h('div', { className: 'mt-3 flex flex-wrap gap-2' },
                h(Button, { type: 'button', variant: 'soft', className: 'h-9 gap-2 px-3 text-xs', disabled: driveLoading || reconnectRequired, onClick: () => driveAction('test_upload', account) }, h(Icon, { name: 'UploadCloud', size: 14 }), 'Uji upload'),
                h(Button, { type: 'button', variant: account.enabled ? 'soft' : 'success', className: 'h-9 gap-2 px-3 text-xs', disabled: driveLoading || reconnectRequired, onClick: () => driveAction('update', account, { enabled: !account.enabled }) }, h(Icon, { name: account.enabled ? 'Pause' : 'Play', size: 14 }), account.enabled ? 'Nonaktifkan' : 'Aktifkan'),
                h(Button, { type: 'button', variant: 'danger', className: 'h-9 gap-2 px-3 text-xs', disabled: driveLoading, onClick: () => { if (window.confirm(`Lepas akun ${account.email || account.display_name || ''}?`)) driveAction('disconnect', account); } }, h(Icon, { name: 'Unplug', size: 14 }), 'Lepas')
              )
            );
          }),
          driveSummary?.configured && !(driveSummary.accounts || []).length ? h('div', { className: 'rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-500 lg:col-span-2' }, 'Belum ada akun Drive terhubung.') : null
        )
      )
    );
  }

  function LinkArchiveAdmin({ adminKey }) {
    const empty = { title: '', url: '', short_code: '', description: '', process_context: 'Data', status: 'approved', is_pinned: 0, pin_order: 0, submitted_by_name: 'admin', submitted_by_email: '', review_note: '' };
    const [links, setLinks] = useState([]);
    const [summary, setSummary] = useState({});
    const [form, setForm] = useState(empty);
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('');
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const processOptions = linkProcessOptions(links, []);

    async function load() {
      if (!adminKey) return;
      setLoading(true);
      setMessage(null);
      try {
        const params = new URLSearchParams({ key: adminKey, limit: 200 });
        if (query) params.set('q', query);
        if (status) params.set('status', status);
        const data = await apiRequest(`link_archive.php?${params.toString()}`);
        setLinks(data.links || []);
        setSummary(data.summary || {});
        if (data.warning) setMessage({ type: 'info', text: data.warning });
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    useEffect(() => { if (adminKey) load(); }, [adminKey]);

    function setField(name, value) {
      setForm(current => ({ ...current, [name]: value }));
    }

    async function save() {
      if (!adminKey) return;
      setLoading(true);
      try {
        await apiRequest('link_archive.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey }, body: JSON.stringify({ action: 'save', id: form.id || 0, record: form }) });
        setForm(empty);
        setMessage({ type: 'info', text: 'Link archive tersimpan.' });
        await load();
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    async function review(link, action, pin = false) {
      setLoading(true);
      try {
        await apiRequest('link_archive.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
          body: JSON.stringify({ action, id: link.id, is_pinned: pin ? 1 : 0, pin_order: link.pin_order || 0 }),
        });
        setMessage({ type: 'info', text: action === 'approve' ? (pin ? 'Link disetujui dan dipin.' : 'Link disetujui.') : 'Link ditolak.' });
        await load();
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
        setLoading(false);
      }
    }

    async function togglePin(link) {
      setLoading(true);
      try {
        await apiRequest('link_archive.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
          body: JSON.stringify({ action: 'pin', id: link.id, is_pinned: link.is_pinned ? 0 : 1, pin_order: link.pin_order || 0 }),
        });
        setMessage({ type: 'info', text: link.is_pinned ? 'Pin link dilepas.' : 'Link dipin ke Home.' });
        await load();
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
        setLoading(false);
      }
    }

    async function deleteLink(link) {
      if (!window.confirm(`Hapus link "${link.title || link.link_host || link.url}"?`)) return;
      setLoading(true);
      try {
        await apiRequest('link_archive.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey }, body: JSON.stringify({ action: 'delete', id: link.id }) });
        setMessage({ type: 'info', text: 'Link archive dihapus.' });
        await load();
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    return h('section', { className: 'grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]' },
      h('div', { className: 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm' },
        h('div', { className: 'flex items-center justify-between gap-3' },
          h('div', null,
            h('h2', { className: 'text-lg font-black text-slate-950' }, form.id ? `Edit link #${form.id}` : 'Tambah link archive'),
            h('p', { className: 'mt-1 text-xs font-semibold text-slate-500' }, 'Approve link publik, lalu pin yang paling penting ke Home.')
          ),
          h('span', { className: 'grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100' }, h(Icon, { name: 'LibraryBig', size: 19 }))
        ),
        h('div', { className: 'mt-4 grid gap-3' },
          h(Field, { label: 'Judul link' }, h(TextInput, { value: form.title ?? '', onChange: event => setField('title', event.target.value), placeholder: 'Template asesmen awal' })),
          h(Field, { label: 'URL link' }, h(TextInput, { value: form.url ?? '', onChange: event => setField('url', event.target.value), placeholder: 'https://...' })),
          h(Field, { label: 'Kode shortlink (opsional)' }, h(TextInput, { value: form.short_code ?? '', onChange: event => setField('short_code', event.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 24)), placeholder: 'acmw' })),
          h(Field, { label: 'Proses' }, h(TextInput, { value: form.process_context ?? '', onChange: event => setField('process_context', event.target.value), list: 'link-process-options-admin', placeholder: 'Data, persiapan, monitoring...' })),
          h('datalist', { id: 'link-process-options-admin' }, processOptions.map(item => h('option', { key: item, value: item }))),
          h(Field, { label: 'Deskripsi' }, h(TextArea, { value: form.description ?? '', onChange: event => setField('description', event.target.value), placeholder: 'Konteks penggunaan link' })),
          h('div', { className: 'grid gap-3 md:grid-cols-2' },
            h(Field, { label: 'Status' }, h('select', { value: form.status || 'pending', onChange: event => setField('status', event.target.value), className: 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none' },
              ['pending', 'approved', 'rejected'].map(item => h('option', { key: item, value: item }, item))
            )),
            h(Field, { label: 'Urutan pin' }, h(TextInput, { type: 'number', min: '0', value: form.pin_order ?? 0, onChange: event => setField('pin_order', event.target.value), placeholder: '0' }))
          ),
          h('label', { className: 'flex items-center gap-2 text-sm font-bold text-slate-700' }, h('input', { type: 'checkbox', checked: Boolean(form.is_pinned), onChange: event => setField('is_pinned', event.target.checked ? 1 : 0) }), 'Pin ke Home jika approved'),
          h('div', { className: 'grid gap-3 md:grid-cols-2' },
            h(Field, { label: 'Nama pengusul' }, h(TextInput, { value: form.submitted_by_name ?? '', onChange: event => setField('submitted_by_name', event.target.value) })),
            h(Field, { label: 'Email pengusul' }, h(TextInput, { value: form.submitted_by_email ?? '', onChange: event => setField('submitted_by_email', event.target.value) }))
          ),
          h(Field, { label: 'Catatan review' }, h(TextInput, { value: form.review_note ?? '', onChange: event => setField('review_note', event.target.value), placeholder: 'Opsional' })),
          h('div', { className: 'flex flex-wrap gap-2' },
            h(Button, { type: 'button', variant: 'success', className: 'gap-2', disabled: loading || !adminKey, onClick: save }, h(Icon, { name: form.id ? 'Save' : 'Plus', size: 16 }), form.id ? 'Update' : 'Create'),
            form.id ? h(Button, { type: 'button', variant: 'soft', className: 'gap-2', disabled: loading, onClick: () => setForm(empty) }, h(Icon, { name: 'RotateCcw', size: 16 }), 'Batal edit') : null
          )
        ),
        h('div', { className: 'mt-4' }, h(Notice, { message }))
      ),
      h('div', { className: 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm' },
        h('div', { className: 'link-admin-summary' },
          h(MiniMetric, { icon: 'Clock3', label: 'Pending', value: fullNumber(summary.pending || 0) }),
          h(MiniMetric, { icon: 'CheckCircle2', label: 'Approved', value: fullNumber(summary.approved || 0) }),
          h(MiniMetric, { icon: 'Pin', label: 'Pinned', value: fullNumber(summary.pinned || 0) })
        ),
        h('div', { className: 'mt-4 grid gap-2 md:grid-cols-[1fr_160px_auto]' },
          h(TextInput, { value: query, onChange: event => setQuery(event.target.value), onKeyDown: event => { if (event.key === 'Enter') load(); }, placeholder: 'Cari judul, domain, proses' }),
          h('select', { value: status, onChange: event => setStatus(event.target.value), className: 'h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none' },
            h('option', { value: '' }, 'Semua status'),
            ['pending', 'approved', 'rejected'].map(item => h('option', { key: item, value: item }, item))
          ),
          h(Button, { type: 'button', variant: 'blue', className: 'gap-2', disabled: loading || !adminKey, onClick: load }, h(Icon, { name: loading ? 'LoaderCircle' : 'RefreshCcw', size: 16 }), loading ? '...' : 'Muat')
        ),
        h('div', { className: 'link-admin-list mt-4' },
          links.length ? links.map(link => h(LinkArchiveCard, {
            key: link.id,
            link,
            admin: true,
            actions: [
              link.status === 'pending' ? h(Button, { key: 'approve-pin', type: 'button', variant: 'success', className: 'h-9 gap-2 px-3 text-xs', disabled: loading, onClick: () => review(link, 'approve', true) }, h(Icon, { name: 'Pin', size: 14 }), 'Approve + pin') : null,
              link.status === 'pending' ? h(Button, { key: 'approve', type: 'button', variant: 'soft', className: 'h-9 gap-2 px-3 text-xs', disabled: loading, onClick: () => review(link, 'approve', false) }, h(Icon, { name: 'Check', size: 14 }), 'Approve') : null,
              link.status === 'pending' ? h(Button, { key: 'reject', type: 'button', variant: 'danger', className: 'h-9 gap-2 px-3 text-xs', disabled: loading, onClick: () => review(link, 'reject') }, h(Icon, { name: 'X', size: 14 }), 'Tolak') : null,
              link.status === 'approved' ? h(Button, { key: 'pin', type: 'button', variant: link.is_pinned ? 'soft' : 'blue', className: 'h-9 gap-2 px-3 text-xs', disabled: loading, onClick: () => togglePin(link) }, h(Icon, { name: link.is_pinned ? 'PinOff' : 'Pin', size: 14 }), link.is_pinned ? 'Unpin' : 'Pin') : null,
              h(Button, { key: 'edit', type: 'button', variant: 'soft', className: 'h-9 gap-2 px-3 text-xs', disabled: loading, onClick: () => setForm({ ...empty, ...link, is_pinned: link.is_pinned ? 1 : 0 }) }, h(Icon, { name: 'Pencil', size: 14 }), 'Edit'),
              h(Button, { key: 'delete', type: 'button', variant: 'danger', className: 'h-9 gap-2 px-3 text-xs', disabled: loading, onClick: () => deleteLink(link) }, h(Icon, { name: 'Trash2', size: 14 }), 'Hapus'),
            ],
          })) : h('div', { className: 'rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500' }, 'Belum ada link archive.')
        )
      )
    );
  }

  function GeojsonAdmin({ adminKey }) {
    const [layers, setLayers] = useState([]);
    const [level, setLevel] = useState('province');
    const [scope, setScope] = useState('');
    const [label, setLabel] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [file, setFile] = useState(null);
    const [raw, setRaw] = useState('');
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);

    async function load() {
      if (!adminKey) return;
      setLoading(true);
      try {
        const data = await apiRequest(`geojson_admin.php?key=${encodeURIComponent(adminKey)}`);
        setLayers(data.layers || []);
        if (data.fallback_storage) {
          setMessage({ type: 'info', text: 'Layer GeoJSON dibaca dari storage lokal karena database belum aktif.' });
        }
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    async function upload() {
      if (!file) return setMessage({ type: 'error', text: 'Pilih file GeoJSON.' });
      setLoading(true);
      try {
        const form = new FormData();
        form.append('action', 'upload');
        form.append('admin_key', adminKey);
        form.append('level', level);
        form.append('scope_code', scope);
        form.append('label', label);
        form.append('source_url', sourceUrl);
        form.append('file', file);
        const result = await uploadFormWithProgress(apiUrl('geojson_admin.php'), form, null);
        setMessage({ type: 'info', text: 'GeoJSON tersimpan.' });
        setFile(null);
        if (result.layer) {
          setScope(result.layer.scope_code || scope);
          setLabel(result.layer.label || label);
        }
        await load();
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    async function saveRaw() {
      setLoading(true);
      try {
        await apiRequest('geojson_admin.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey }, body: JSON.stringify({ action: 'save', level, scope_code: scope, label, source_url: sourceUrl, geojson: raw }) });
        setMessage({ type: 'info', text: 'GeoJSON editor tersimpan.' });
        await load();
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    async function editLayer(layer) {
      setLoading(true);
      try {
        const response = await fetch(freshApiUrl(`geojson.php?level=${encodeURIComponent(layer.level)}&scope=${encodeURIComponent(layer.scope_code || '')}`), { cache: 'no-store' });
        const geojson = await response.json();
        if (!response.ok || !geojson || geojson.type !== 'FeatureCollection') {
          throw new Error('Layer GeoJSON tidak bisa dibuka sebagai FeatureCollection.');
        }
        setLevel(layer.level || 'province');
        setScope(layer.scope_code || '');
        setLabel(layer.label || '');
        setSourceUrl(layer.source_url || '');
        setRaw(JSON.stringify(geojson, null, 2));
        setMessage({ type: 'info', text: `Layer "${layer.label || layer.level}" dimuat ke editor.` });
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    async function deleteLayer(layer) {
      if (layer.readonly) {
        setMessage({ type: 'error', text: 'Layer bawaan public tidak dihapus. Simpan override baru jika ingin menggantinya.' });
        return;
      }
      if (!window.confirm(`Hapus layer "${layer.label || layer.level}"?`)) return;
      setLoading(true);
      try {
        const result = await apiRequest('geojson_admin.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
          body: JSON.stringify({ action: 'delete', level: layer.level, scope_code: layer.scope_code || '' }),
        });
        setMessage({ type: 'info', text: result.deleted ? 'Layer GeoJSON dihapus.' : 'Layer tidak ditemukan, daftar disegarkan.' });
        await load();
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    }

    useEffect(() => { if (adminKey) load(); }, [adminKey]);

    return h('section', { className: 'grid gap-5 lg:grid-cols-[390px_minmax(0,1fr)]' },
      h('div', { className: 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm' },
        h('h2', { className: 'text-lg font-black text-slate-950' }, 'GeoJSON wilayah'),
        h('div', { className: 'mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs font-bold leading-5 text-emerald-950' },
          'Layer bawaan bisa diganti: klik Edit pada layer public, ubah/upload GeoJSON, lalu Simpan. Untuk level besar, lebih aman pakai scope kode/nama agar peta tidak memuat seluruh Indonesia sekaligus.'
        ),
        h('div', { className: 'mt-4 grid gap-3' },
          h(Field, { label: 'Level' },
            h(SelectInput, { value: level, onChange: event => setLevel(event.target.value) }, ['province', 'regency', 'district', 'village'].map(item => h('option', { key: item, value: item }, item)))
          ),
          h(Field, { label: 'Scope opsional', hint: 'Kosong untuk default nasional. Isi kode/nama scope untuk file pecahan: 72 untuk kab/kota Sulawesi Tengah, 7201 untuk kecamatan Banggai, 720101 untuk desa Batui.' }, h(TextInput, { value: scope, onChange: event => setScope(event.target.value), placeholder: 'contoh: 72, 7201, 720101, Sulawesi Tengah' })),
          h(Field, { label: 'Label' }, h(TextInput, { value: label, onChange: event => setLabel(event.target.value), placeholder: 'Batas Provinsi' })),
          h(Field, { label: 'Source URL', hint: 'Opsional, untuk mencatat asal file GeoJSON.' }, h(TextInput, { value: sourceUrl, onChange: event => setSourceUrl(event.target.value), placeholder: 'https://wilayah-id-restapi.vercel.app/api/v1/boundaries/...' })),
          h(Field, { label: 'Upload file' },
            h(FileDropzone, {
              file,
              onFile: setFile,
              accept: '.geojson,.json',
              compact: true,
              hint: 'Drop file GeoJSON/JSON untuk menyimpan layer wilayah.',
            })
          ),
          h(Button, { type: 'button', variant: 'blue', disabled: loading || !adminKey, onClick: upload }, 'Upload GeoJSON'),
          h(Field, { label: 'Editor GeoJSON', hint: 'Klik Edit pada layer tersimpan untuk memuat isi lama, lalu simpan ulang setelah perubahan.' }, h(TextArea, { value: raw, onChange: event => setRaw(event.target.value), className: 'geojson-editor', placeholder: '{"type":"FeatureCollection","features":[]}' })),
          h(Button, { type: 'button', variant: 'soft', disabled: loading || !adminKey || !raw.trim(), onClick: saveRaw }, 'Simpan dari editor')
        ),
        h('div', { className: 'mt-4' }, h(Notice, { message }))
      ),
      h('div', { className: 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm' },
        h('div', { className: 'flex items-center justify-between gap-3' },
          h('h3', { className: 'font-black text-slate-950' }, 'Layer tersimpan'),
          h(Button, { type: 'button', variant: 'soft', disabled: loading || !adminKey, onClick: load }, 'Muat')
        ),
        h('div', { className: 'mt-4 grid gap-3' },
          layers.length ? layers.map(layer => h('article', { key: `${layer.level}-${layer.scope_code}`, className: 'rounded-2xl border border-slate-100 bg-slate-50 p-4' },
            h('div', { className: 'flex items-start justify-between gap-3' },
              h('div', { className: 'min-w-0' },
                h('p', { className: 'text-sm font-black text-slate-950' }, layer.label),
                h('p', { className: 'mt-1 text-xs text-slate-500' }, `${layer.level}${layer.scope_code ? ` / ${layer.scope_code}` : ''} - ${compactNumber(layer.feature_count)} fitur`),
                h('p', { className: 'mt-1 break-words text-xs text-slate-400', title: layer.relative_path || layer.source_url || '' }, layer.readonly ? 'public bawaan' : (layer.fallback_storage ? 'storage lokal' : (layer.relative_path || layer.source_url || 'database')))
              ),
              h('div', { className: 'flex flex-wrap justify-end gap-2' },
                h(Button, { type: 'button', variant: 'soft', className: 'h-8 px-2 text-xs', disabled: loading || !adminKey, onClick: () => editLayer(layer) }, layer.readonly ? 'Edit override' : 'Edit'),
                h('a', { href: apiUrl(`geojson.php?level=${encodeURIComponent(layer.level)}&scope=${encodeURIComponent(layer.scope_code || '')}`), target: '_blank', className: 'inline-flex h-8 items-center rounded-lg bg-white px-2 text-xs font-black text-slate-700 ring-1 ring-slate-200' }, 'Buka'),
                layer.readonly ? null : h(Button, { type: 'button', variant: 'danger', className: 'h-8 px-2 text-xs', disabled: loading || !adminKey, onClick: () => deleteLayer(layer) }, 'Hapus')
              )
            )
          )) : h('div', { className: 'rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500' }, 'Belum ada layer admin.')
        )
      )
    );
  }

  function App() {
    const [tab, setTab] = useState(readInitialTab);
    const [appConfig, setAppConfig] = useState({ max_upload_bytes: 26214400, allowed_extensions: SUPPORTED_EXTENSIONS });
    const [padanSeed, setPadanSeed] = useState(null);
    const [shortRedirect, setShortRedirect] = useState(null);
    const heroShaderRef = useRef(null);
    const workbenchRef = useRef(null);
    useDesignMotion();
    useHeroShader(heroShaderRef);

    function scrollWorkbench() {
      window.setTimeout(() => {
        workbenchRef.current?.scrollIntoView({
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          block: 'start',
        });
      }, 40);
    }

    function switchTab(nextTab, options = {}) {
      if (!nextTab) return;
      const nextUrl = `${tabQuery(nextTab)}${window.location.hash || ''}`;
      if (nextUrl !== `${window.location.search || window.location.pathname}${window.location.hash || ''}`) {
        window.history.replaceState(null, '', nextUrl);
      }
      const update = () => {
        if (window.ReactDOM?.flushSync) window.ReactDOM.flushSync(() => setTab(nextTab));
        else setTab(nextTab);
      };
      if (!prefersReducedMotion() && typeof document.startViewTransition === 'function') {
        document.startViewTransition(update);
      } else {
        update();
      }
      if (options.scroll) scrollWorkbench();
    }

    function startPadanFromMap(item) {
      setPadanSeed({ ...regionSeedFromItem(item), __id: Date.now() });
      switchTab('padan', { scroll: true });
    }

    const primaryNavItems = [
      ['home', 'Beranda', 'Map'],
      ['padan', 'Padan', 'ClipboardCheck'],
      ['links', 'Arsip', 'LibraryBig'],
      ['about', 'Tentang', 'Info'],
      ['admin', 'Admin', 'Settings2'],
    ];
    const adminNavItems = [
      ['admin', 'Admin', 'Settings2'],
    ];
    const renderDockButton = ([key, label, icon]) =>
      h('button', { key, type: 'button', onClick: () => switchTab(key), className: cx('dock-tab', tab === key && 'is-active'), 'data-nav-key': key, 'aria-current': tab === key ? 'page' : undefined },
        h('span', { className: 'dock-tab-icon' }, h(Icon, { name: icon, size: 18 })),
        h('span', { className: 'dock-tab-label' }, label)
      );
    const heroByTab = {
      home: {
        kicker: 'KAT BNBA Spatial Intelligence',
        title: 'Peta Padan Data KAT',
        copy: 'Data persebaran, BNBA, status pengecekan, dan histori fix bergerak di atas peta Indonesia yang bisa dibaca cepat di desktop, tablet, maupun layar kecil.',
        actions: [
          ['padan', 'Mulai padan data', 'UploadCloud', 'primary'],
          ['home', 'Lihat peta', 'Map', 'ghost'],
          ['links', 'Arsip link', 'LibraryBig', 'ghost'],
        ],
      },
      padan: {
        kicker: 'Workflow pengecekan',
        title: 'Padan Data BNBA',
        copy: 'Upload Excel, pilih wilayah, jalankan pengecekan, lalu unduh output yang tetap mengikuti file input dan ringkasan hasil kerja.',
        actions: [
          ['padan', 'Upload file', 'UploadCloud', 'primary'],
          ['home', 'Pilih dari peta', 'MapPinned', 'ghost'],
          ['links', 'Buka arsip', 'LibraryBig', 'ghost'],
        ],
      },
      links: {
        kicker: 'Link archive',
        title: 'Arsip Link Kerja KAT',
        copy: 'Link approved dan link pinned disatukan dalam ruang kerja yang mudah dicari, dikurasi admin, dan siap dipakai saat proses lapangan.',
        actions: [
          ['links', 'Ajukan link', 'Send', 'primary'],
          ['home', 'Kembali ke peta', 'Map', 'ghost'],
          ['padan', 'Padan data', 'ClipboardCheck', 'ghost'],
        ],
      },
      about: {
        kicker: 'Tentang project',
        title: 'Project CPNS KAT',
        copy: 'Ruang dokumentasi singkat tentang tujuan, konteks, dan arah pengembangan project Padan Data KAT.',
        actions: [
          ['about', 'Baca about', 'Info', 'primary'],
          ['home', 'Lihat peta', 'Map', 'ghost'],
          ['links', 'Arsip link', 'LibraryBig', 'ghost'],
        ],
      },
      admin: {
        kicker: 'Admin control room',
        title: 'Konsol Admin KAT',
        copy: 'Kelola job, persebaran, email, data store, konten, link archive, dan layer GeoJSON dari satu panel operasional.',
        actions: [
          ['admin', 'Buka kontrol', 'Settings2', 'primary'],
          ['home', 'Lihat peta', 'Map', 'ghost'],
          ['links', 'Audit link', 'LibraryBig', 'ghost'],
        ],
      },
    };
    const heroMeta = heroByTab[tab] || heroByTab.home;
    const activeDataStoreMode = appConfig?.capabilities?.data_store_mode || '';
    const activeDataStoreLabel = appConfig?.capabilities?.data_store_label || '';
    const initialShortCode = shortCodeFromLocation();
    const redirectCode = shortRedirectCodeFromLocation();

    useEffect(() => {
      let live = true;
      apiRequest('public_config.php')
        .then(data => {
          if (data.config) publicRuntimeConfig = data.config;
          if (live && data.config) setAppConfig(data.config);
        })
        .catch(() => { });
      return () => { live = false; };
    }, []);

    useEffect(() => {
      if (!redirectCode) return;
      let live = true;
      setShortRedirect({ type: 'loading', text: `Membuka shortlink /${shortlinkPathPrefix()}/${redirectCode}...` });
      apiRequest(`shortlink.php?kind=link&code=${encodeURIComponent(redirectCode)}`)
        .then(data => {
          if (!live) return;
          if (data.redirect_url) {
            setShortRedirect({ type: 'loading', text: 'Shortlink ditemukan. Mengalihkan ke link tujuan...' });
            window.location.replace(data.redirect_url);
            return;
          }
          if (data.job) {
            const params = new URLSearchParams({ upload: '1', [shortlinkParamName()]: redirectCode });
            window.history.replaceState(null, '', `?${params.toString()}`);
            setShortRedirect({ type: 'info', text: 'Kode ini adalah shortlink job. Membuka panel status...' });
            setTab('padan');
            scrollWorkbench();
            return;
          }
          setShortRedirect({ type: 'error', text: 'Shortlink tidak ditemukan.' });
        })
        .catch(error => {
          if (live) setShortRedirect({ type: 'error', text: error.message || 'Shortlink tidak bisa dibuka.' });
        });
      return () => { live = false; };
    }, [redirectCode]);

    return h('div', { className: cx('site-canvas min-h-screen text-slate-900', `site-canvas-${tab}`), 'data-tab': tab },
      h('section', { className: 'hero-pin' },
        h('div', { className: 'hero-photo', 'aria-hidden': 'true' }),
        h('canvas', { ref: heroShaderRef, className: 'hero-shader-canvas', 'aria-hidden': 'true' }),
        h('div', { className: 'hero-vignette', 'aria-hidden': 'true' }),
        h('div', { className: 'hero-noise', 'aria-hidden': 'true' }),
        h('div', { className: 'hero-smoke', 'aria-hidden': 'true' }),
        h('div', { className: 'hero-pointer-glow', 'aria-hidden': 'true' }),
        h('div', { className: 'hero-content' },
          h('p', { className: 'hero-kicker' }, h(Icon, { name: 'Sparkles', size: 15 }), heroMeta.kicker),
          h('h1', { className: 'hero-title', 'data-splitting': '' }, heroMeta.title),
          h('p', { className: 'hero-copy' }, heroMeta.copy),
          h('div', { className: 'hero-actions' },
            heroMeta.actions.map(([target, label, icon, variant]) =>
              h('button', { key: `${target}-${label}`, type: 'button', onClick: () => switchTab(target, { scroll: true }), className: cx('hero-cta', variant === 'primary' ? 'hero-cta-primary' : 'hero-cta-ghost') }, h(Icon, { name: icon, size: 18 }), label)
            )
          )
        )
      ),
      h('div', { ref: workbenchRef, className: 'app-workbench mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8' },
        shortRedirect ? h('div', { className: cx('mb-5 rounded-2xl border p-4 text-sm font-bold shadow-sm', shortRedirect.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-sky-200 bg-sky-50 text-sky-700') },
          h('span', { className: 'inline-flex items-center gap-2' },
            h(Icon, { name: shortRedirect.type === 'error' ? 'CircleAlert' : 'Link2', size: 16 }),
            shortRedirect.text
          )
        ) : null,
        h('header', { className: 'app-dock mb-5' },
          h('div', { className: 'dock-brand' },
            h('span', { className: 'dock-mark about-signature-mark dock-signature-mark' }, 'KAT'),
            h('div', null,
              h('p', { className: 'dock-eyebrow' }, 'Ruang kerja'),
              h('div', { className: 'flex flex-wrap items-center gap-2' },
                h('strong', { className: 'dock-title' }, tab === 'home' ? 'Peta operasional' : tab === 'padan' ? 'Padan data BNBA' : tab === 'links' ? 'Arsip link' : tab === 'about' ? 'Tentang project' : 'Admin data KAT'),
                h(DataStoreSourceBadge, { mode: activeDataStoreMode, label: activeDataStoreLabel, prefix: 'Data' })
              )
            )
          ),
          h('div', { className: 'dock-menu' },
            h('nav', { className: 'dock-nav dock-nav-primary', 'aria-label': 'Navigasi utama' }, primaryNavItems.map(renderDockButton)),
            h('span', { className: 'dock-menu-separator', 'aria-hidden': 'true' }),
            h('nav', { className: 'dock-nav dock-nav-admin', 'aria-label': 'Navigasi admin' }, adminNavItems.map(renderDockButton))
          )
        ),
        h('div', { key: tab, className: 'content-stack motion-page' },
          tab === 'home' ? h(HomeMap, { appConfig, onOpenArchive: () => switchTab('links'), onStartPadan: startPadanFromMap }) : tab === 'padan' ? h(PadanDataPage, { appConfig, initialRegion: padanSeed, initialShortCode }) : tab === 'links' ? h(LinkArchivePage) : tab === 'about' ? h(AboutPage) : h(AdminPage)
        )
      )
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(h(App));
})();
