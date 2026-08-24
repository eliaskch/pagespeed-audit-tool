import { gsap } from 'gsap';

const TIMEOUT_MS = 90_000;

/* Seuils Lighthouse officiels : [bon ≤, moyen ≤] — au-delà : faible. */
const METRICS = [
  { id: 'lcp', label: 'Largest Contentful Paint', short: 'LCP', good: 'moins de 2,5 s' },
  { id: 'fcp', label: 'First Contentful Paint', short: 'FCP', good: 'moins de 1,8 s' },
  { id: 'tbt', label: 'Total Blocking Time', short: 'TBT', good: 'moins de 200 ms' },
  { id: 'cls', label: 'Cumulative Layout Shift', short: 'CLS', good: 'moins de 0,1' },
  { id: 'si', label: 'Speed Index', short: 'SI', good: 'moins de 3,4 s' },
];

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const tier = (score) => (score >= 90 ? 'high' : score >= 50 ? 'mid' : 'low');
const tierLabel = { high: 'bon', mid: 'à améliorer', low: 'faible' };

/** Une jauge : anneau SVG + valeur en texte (le texte fait foi). */
function gaugeHTML(score, label) {
  const t = tier(score);
  return `
    <figure class="audit-gauge" data-tier="${t}">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle class="gauge-track" cx="60" cy="60" r="52"></circle>
        <circle class="gauge-arc" cx="60" cy="60" r="52" data-gauge-arc data-score="${score}"></circle>
      </svg>
      <figcaption>
        <b data-gauge-value data-score="${score}">0</b>
        <span>${esc(label)} — ${tierLabel[t]}</span>
      </figcaption>
    </figure>`;
}

function metricRows(data) {
  return METRICS.map(({ id, label, short, good }) => {
    const m = data[id];
    if (!m || m.display === null) return '';
    const t = m.score === null ? 'mid' : m.score >= 0.9 ? 'high' : m.score >= 0.5 ? 'mid' : 'low';
    return `
      <div class="audit-metric" data-tier="${t}">
        <dt><abbr title="${esc(label)}">${short}</abbr> <small>bon : ${good}</small></dt>
        <dd>${esc(m.display)} <span class="visually-hidden">— ${tierLabel[t]}</span></dd>
      </div>`;
  }).join('');
}

function columnHTML(title, data, subtitle) {
  if (!data) {
    return `
      <article class="audit-col audit-col--empty">
        <h3>${esc(title)}</h3>
        <p class="muted">Mesure indisponible pour cette vue.</p>
      </article>`;
  }
  return `
    <article class="audit-col">
      <h3>${esc(title)}</h3>
      ${subtitle ? `<p class="audit-sub eyebrow">${esc(subtitle)}</p>` : ''}
      ${gaugeHTML(data.performance, 'Performance')}
      <p class="audit-subscores eyebrow">
        SEO ${data.seo ?? '—'} · Accessibilité ${data.accessibility ?? '—'}
      </p>
      <dl class="audit-metrics">${metricRows(data)}</dl>
    </article>`;
}

function fmtSavings(ms) {
  return ms >= 1000 ? `≈ ${(ms / 1000).toFixed(1).replace('.', ',')} s à gagner` : `≈ ${ms} ms à gagner`;
}

function ctaHTML(score, url) {
  if (score < 50) {
    return `
      <h3>Ce score se corrige.</h3>
      <p>Un site à ${score}/100 perd des visiteurs avant même de s'afficher. Identifiez les bloquants et planifiez des améliorations de performance.</p>`;
  }
  if (score < 90) {
    return `
      <h3>Une base saine — et une marge réelle.</h3>
      <p>À ${score}/100, l'essentiel tient. Les opportunités listées ci-dessus sont le chemin vers un site réellement rapide.</p>`;
  }
  return `
    <h3>Votre site est rapide — sincèrement.</h3>
    <p>${score}/100 : votre site web a d'excellentes performances !</p>`;
}

/* --------------------------------------------------------------------------
   API Logic (Migrated from Cloudflare Worker)
   -------------------------------------------------------------------------- */

const PSI_ERRORS = {
  unreachable: "Le site n'a pas répondu à l'outil de mesure. Vérifiez que l'adresse est bien accessible publiquement.",
  robots: "Le site interdit l'analyse automatique (robots.txt). C'est un réglage de votre site, pas une panne.",
  redirect: 'La page redirige en boucle — la mesure ne peut pas aboutir.',
  quota: "Le quota de requêtes de cette clé API est épuisé ou invalide.",
  timeout: "La mesure a dépassé le temps imparti (75 s) — le site est probablement très lent ou instable.",
  api: "Le service de mesure de Google est momentanément indisponible ou la clé est invalide.",
};

function mapRuntimeError(code) {
  if (!code) return null;
  if (/FAILED_DOCUMENT_REQUEST|DNS_FAILURE|ERRORED_DOCUMENT_REQUEST|NO_FCP/.test(code)) {
    return PSI_ERRORS.unreachable;
  }
  if (/NOT_HTML/.test(code)) return "L'adresse ne renvoie pas une page web (HTML) — vérifiez l'URL.";
  return null;
}

function extractResult(psi) {
  const lr = psi.lighthouseResult;
  const runtimeError = mapRuntimeError(lr?.runtimeError?.code);
  if (runtimeError) return { error: runtimeError };
  const cat = lr.categories;
  const a = lr.audits;
  const metric = (id) => ({
    value: a[id]?.numericValue ?? null,
    display: a[id]?.displayValue ?? null,
    score: a[id]?.score ?? null,
  });
  const opportunities = Object.values(a)
    .filter(
      (audit) =>
        audit.details?.type === 'opportunity' &&
        audit.score !== null &&
        audit.score < 0.9 &&
        (audit.details.overallSavingsMs ?? 0) > 100
    )
    .sort((x, y) => (y.details.overallSavingsMs ?? 0) - (x.details.overallSavingsMs ?? 0))
    .slice(0, 3)
    .map((audit) => ({
      title: audit.title,
      savingsMs: Math.round(audit.details.overallSavingsMs),
    }));
  return {
    performance: Math.round((cat.performance?.score ?? 0) * 100),
    seo: cat.seo ? Math.round(cat.seo.score * 100) : null,
    accessibility: cat.accessibility ? Math.round(cat.accessibility.score * 100) : null,
    lcp: metric('largest-contentful-paint'),
    cls: metric('cumulative-layout-shift'),
    tbt: metric('total-blocking-time'),
    si: metric('speed-index'),
    fcp: metric('first-contentful-paint'),
    opportunities,
  };
}

async function runPsi(url, strategy, apiKey, signal, isRetry = false) {
  const api = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  api.searchParams.set('url', url);
  api.searchParams.set('strategy', strategy);
  api.searchParams.set('locale', 'fr');
  api.searchParams.append('category', 'performance');
  api.searchParams.append('category', 'seo');
  api.searchParams.append('category', 'accessibility');
  api.searchParams.set('key', apiKey);
  
  const r = await fetch(api, { signal });
  if (r.status === 400 || r.status === 403) return { error: PSI_ERRORS.quota, retryable: false };
  if (r.status === 429) return { error: PSI_ERRORS.quota, retryable: true };
  if (r.status >= 500 && !isRetry) {
    return runPsi(url, strategy, apiKey, signal, true);
  }
  if (!r.ok) {
    let detail = null;
    try {
      detail = (await r.json())?.error?.message ?? null;
    } catch {}
    if (detail && /FAILED_DOCUMENT_REQUEST|unreachable|ERRORED/.test(detail)) return { error: PSI_ERRORS.unreachable };
    if (detail && /redirect/i.test(detail)) return { error: PSI_ERRORS.redirect };
    return { error: PSI_ERRORS.api, retryable: true };
  }
  return { data: extractResult(await r.json()) };
}

async function auditDirect(url, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS - 5000);
  try {
    const [mobile, desktop] = await Promise.all([
      runPsi(url, 'mobile', apiKey, controller.signal),
      runPsi(url, 'desktop', apiKey, controller.signal),
    ]);
    if (mobile.error) return { error: mobile.error };
    if (mobile.data.error) return { error: mobile.data.error };
    return {
      result: {
        mobile: mobile.data,
        desktop: desktop.error || desktop.data.error ? null : desktop.data,
        fetchedAt: new Date().toISOString(),
      },
    };
  } catch (e) {
    return { error: e.name === 'AbortError' ? PSI_ERRORS.timeout : PSI_ERRORS.api };
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------------------------------------------------------
   UI Logic
   -------------------------------------------------------------------------- */

export function mountAudit() {
  const root = document.querySelector('[data-audit]');
  if (!root) return null;
  const form = root.querySelector('[data-audit-form]');
  const inputUrl = root.querySelector('[data-audit-input]');
  const inputKey = root.querySelector('[data-audit-key]');
  const states = {
    idle: root.querySelector('[data-audit-idle]'),
    running: root.querySelector('[data-audit-running]'),
    result: root.querySelector('[data-audit-result]'),
    error: root.querySelector('[data-audit-error]'),
  };
  const stepsEl = root.querySelector('[data-audit-steps]');
  const clockEl = root.querySelector('[data-audit-clock]');
  const errorMsg = root.querySelector('[data-audit-error-msg]');

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let inflight = null;
  let clockTimer = 0;
  let payload = null;
  let strategy = 'mobile';
  let auditedUrl = '';

  function show(name) {
    for (const [key, el] of Object.entries(states)) el.hidden = key !== name;
  }

  function setStep(index, state) {
    const items = stepsEl.querySelectorAll('li');
    if (items[index]) items[index].setAttribute('data-step', state);
  }

  function startClock() {
    const t0 = performance.now();
    clockTimer = setInterval(() => {
      const s = Math.floor((performance.now() - t0) / 1000);
      clockEl.textContent = \`\${String(Math.floor(s / 60)).padStart(2, '0')}:\${String(s % 60).padStart(2, '0')}\`;
    }, 1000);
  }
  function stopClock() {
    clearInterval(clockTimer);
  }

  function animateGauges(scope) {
    for (const arc of scope.querySelectorAll('[data-gauge-arc]')) {
      const score = Number(arc.dataset.score);
      const r = 52;
      const len = 2 * Math.PI * r;
      arc.style.strokeDasharray = String(len);
      const target = len * (1 - score / 100);
      const value = arc.closest('.audit-gauge').querySelector('[data-gauge-value]');
      if (reduced) {
        arc.style.strokeDashoffset = String(target);
        value.textContent = String(score);
        continue;
      }
      arc.style.strokeDashoffset = String(len);
      const state = { v: 0 };
      gsap.to(state, {
        v: score,
        duration: 1.2,
        ease: 'expo.out',
        onUpdate() {
          value.textContent = String(Math.round(state.v));
          arc.style.strokeDashoffset = String(len * (1 - state.v / 100));
        },
      });
    }
  }

  function renderResult() {
    const mine = payload[strategy];
    const host = (() => {
      try {
        return new URL(auditedUrl).hostname;
      } catch {
        return auditedUrl;
      }
    })();
    const when = 'Analyse à l’instant.';

    const opportunities = (mine?.opportunities ?? [])
      .map((o) => \`<li>\${esc(o.title)} <b>\${fmtSavings(o.savingsMs)}</b></li>\`)
      .join('');

    states.result.innerHTML = \`
      <header class="audit-head">
        <p class="eyebrow"><b>\${esc(host)}</b> — \${esc(when)}</p>
        <div class="audit-toggle" role="group" aria-label="Type d'appareil mesuré">
          <button type="button" data-strategy="mobile" aria-pressed="\${strategy === 'mobile'}">Mobile</button>
          <button type="button" data-strategy="desktop" aria-pressed="\${strategy === 'desktop'}">Desktop</button>
        </div>
      </header>
      <div class="audit-compare">
        \${columnHTML('Votre site', mine)}
      </div>
      \${
        opportunities
          ? \`<div class="audit-opportunities"><h3>Par où commencer</h3><ol>\${opportunities}</ol></div>\`
          : ''
      }
      <div class="audit-cta">\${mine ? ctaHTML(mine.performance, auditedUrl) : ''}</div>
      <p class="audit-again"><button type="button" class="link-arrow" data-audit-again>Mesurer un autre site</button></p>
    \`;
    show('result');
    animateGauges(states.result);

    states.result.querySelectorAll('[data-strategy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.strategy === strategy) return;
        strategy = btn.dataset.strategy;
        renderResult();
      });
    });
    states.result.querySelector('[data-audit-again]').addEventListener('click', () => {
      show('idle');
      inputUrl.focus();
    });
  }

  function showError(message) {
    errorMsg.textContent = message;
    show('error');
  }

  async function run(url, apiKey) {
    auditedUrl = url;
    show('running');
    stepsEl.querySelectorAll('li').forEach((li) => li.removeAttribute('data-step'));
    clockEl.textContent = '00:00';
    setStep(0, 'done');
    setStep(1, 'active');
    startClock();

    const response = await auditDirect(url, apiKey);
    
    stopClock();
    setStep(1, 'done');
    setStep(2, 'done');

    if (response.error) {
      showError(response.error);
    } else {
      payload = response.result;
      strategy = 'mobile';
      renderResult();
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = inputUrl.value.trim();
    const key = inputKey.value.trim();
    if (!url) { inputUrl.focus(); return; }
    if (!key) { inputKey.focus(); return; }
    
    // Auto-normalize
    let finalUrl = url;
    if (!finalUrl.startsWith('http')) finalUrl = 'https://' + finalUrl;
    run(finalUrl, key);
  });

  root.querySelector('[data-audit-cancel]')?.addEventListener('click', () => {
    // There is no easy abort since we don't return the controller out of auditDirect
    // but we can just reload the state
    show('idle');
    stopClock();
    inputUrl.focus();
  });

  root.querySelector('[data-audit-retry]')?.addEventListener('click', () => {
    show('idle');
    inputUrl.focus();
  });
}

// Start immediately
mountAudit();
