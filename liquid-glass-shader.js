/* ═══════════════════════════════════════════════════════════════
   LIQUID GLASS SHADER — Three.js port for OTT landing page
   Based on liquid-glass-3d_1.html (Jelly Edition)
   Adapted palette: emerald/cyan (green variant, not ocean blue)
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js';

/* ──────────── JELLY WOBBLE INTERACTION ──────────── */
function installJelly() {
  document.querySelectorAll('.ripple-container').forEach(el => {
    if (el._jellyInstalled) return;
    el._jellyInstalled = true;

    el.addEventListener('pointerup', () => {
      el.classList.remove('jelly-bounce');
      void el.offsetWidth;
      el.classList.add('jelly-bounce');
      setTimeout(() => el.classList.remove('jelly-bounce'), 620);
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('jelly-bounce');
    });
  });
}

/* ──────────── THREE.JS SETUP ──────────── */
const canvas = document.getElementById('glass-canvas');
if (!canvas) {
  console.warn('[LiquidGlass] #glass-canvas not found, shader disabled');
} else {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: true, premultipliedAlpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  /* ──────────── BACKGROUND TEXTURE — TikTok aesthetic ──────────── */
  function createBackgroundTexture() {
    const size = 1024;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');

    // Base true-black gradient (match .glass-bg-layer)
    const lin = ctx.createLinearGradient(0, 0, size, size);
    lin.addColorStop(0, '#040404');
    lin.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = lin;
    ctx.fillRect(0, 0, size, size);

    // Pink radial top-left (15%, 20%)
    const r1 = ctx.createRadialGradient(size*0.15, size*0.2, 0, size*0.15, size*0.2, size*0.45);
    r1.addColorStop(0, 'rgba(254, 40, 88, 0.60)');
    r1.addColorStop(1, 'rgba(254, 40, 88, 0)');
    ctx.fillStyle = r1;
    ctx.fillRect(0, 0, size, size);

    // Cyan radial bottom-right (85%, 75%)
    const r2 = ctx.createRadialGradient(size*0.85, size*0.75, 0, size*0.85, size*0.75, size*0.5);
    r2.addColorStop(0, 'rgba(42, 240, 234, 0.55)');
    r2.addColorStop(1, 'rgba(42, 240, 234, 0)');
    ctx.fillStyle = r2;
    ctx.fillRect(0, 0, size, size);

    // Rose accent top-right (75%, 15%)
    const rc = ctx.createRadialGradient(size*0.75, size*0.15, 0, size*0.75, size*0.15, size*0.4);
    rc.addColorStop(0, 'rgba(222, 140, 157, 0.35)');
    rc.addColorStop(1, 'rgba(222, 140, 157, 0)');
    ctx.fillStyle = rc;
    ctx.fillRect(0, 0, size, size);

    // Teal accent bottom-left (25%, 85%)
    const s1 = ctx.createRadialGradient(size*0.25, size*0.85, 0, size*0.25, size*0.85, size*0.45);
    s1.addColorStop(0, 'rgba(57, 118, 132, 0.50)');
    s1.addColorStop(1, 'rgba(57, 118, 132, 0)');
    ctx.fillStyle = s1;
    ctx.fillRect(0, 0, size, size);

    // Subtle diagonal light streak (low alpha — bg is dark)
    ctx.save();
    ctx.translate(size/2, size/2);
    ctx.rotate(-25 * Math.PI / 180);
    ctx.translate(-size/2, -size/2);
    const streak = ctx.createLinearGradient(0, 0, size, 0);
    streak.addColorStop(0.30, 'rgba(255, 255, 255, 0)');
    streak.addColorStop(0.40, 'rgba(255, 200, 220, 0.14)');
    streak.addColorStop(0.48, 'rgba(255, 200, 220, 0.06)');
    streak.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
    streak.addColorStop(0.70, 'rgba(200, 240, 255, 0.09)');
    streak.addColorStop(0.78, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = streak;
    ctx.fillRect(-size, 0, size*3, size);
    ctx.restore();

    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  const bgTexture = createBackgroundTexture();

  /* ──────────── SHADERS — refraction + chromatic aberration + jelly press ──────────── */
  const vertexShader = `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
  `;

  const fragmentShader = `
    precision highp float;
    uniform sampler2D uBg;
    uniform vec2 uResolution;
    uniform vec4 uPanels[32];
    uniform vec4 uPanelMeta[32];
    uniform int uPanelCount;
    uniform float uTime;
    varying vec2 vUv;

    float sdRoundRect(vec2 p, vec2 halfSize, float r) {
      vec2 q = abs(p) - halfSize + vec2(r);
      return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
    }

    vec3 glassNormal(vec2 p, vec2 halfSize, float radius, float bevel, float press) {
      float d = sdRoundRect(p, halfSize, radius);
      float edgeDist = clamp(-d / bevel, 0.0, 1.0);
      float domeCurve = mix(2.2, 1.3, press);
      float h = 1.0 - pow(1.0 - edgeDist, domeCurve);

      float eps = 0.6;
      float dx = sdRoundRect(p + vec2(eps, 0.0), halfSize, radius)
               - sdRoundRect(p - vec2(eps, 0.0), halfSize, radius);
      float dy = sdRoundRect(p + vec2(0.0, eps), halfSize, radius)
               - sdRoundRect(p - vec2(0.0, eps), halfSize, radius);
      vec2 grad = vec2(dx, dy) / (2.0 * eps);

      float slope = (1.0 - h);
      float normalStrength = mix(2.2, 1.4, press);
      return normalize(vec3(grad * slope * normalStrength, 1.0));
    }

    void main() {
      vec2 pxCoord = vUv * uResolution;
      vec2 cssCoord = vec2(pxCoord.x, uResolution.y - pxCoord.y);
      vec3 bgColor = texture2D(uBg, vUv).rgb;
      vec3 outColor = bgColor;
      float glassAlpha = 0.0;

      for (int i = 0; i < 32; i++) {
        if (i >= uPanelCount) break;
        vec4 panel = uPanels[i];
        vec4 meta = uPanelMeta[i];
        vec2 panelCenter = vec2(panel.x + panel.z * 0.5, panel.y + panel.w * 0.5);
        vec2 halfSize = vec2(panel.z * 0.5, panel.w * 0.5);
        float radius = meta.x;
        float bevel = meta.y;
        float refractStrength = meta.z;
        float press = meta.w;

        vec2 p = cssCoord - panelCenter;
        float d = sdRoundRect(p, halfSize, radius);
        if (d > 2.0) continue;
        float inside = smoothstep(2.0, -1.0, d);
        if (inside < 0.001) continue;

        vec3 n = glassNormal(p, halfSize, radius, bevel, press);
        float refractMult = mix(1.0, 1.35, press);
        vec2 refractOffset = n.xy * refractStrength * refractMult;

        // TikTok boost — stronger RGB fringe sync with pink/cyan aesthetic
        float cAb = mix(1.6, 1.9, press);
        vec2 uvR = vUv + refractOffset * (1.08 * cAb) / uResolution;
        vec2 uvG = vUv + refractOffset * 1.00 / uResolution;
        vec2 uvB = vUv + refractOffset * (0.92 / cAb) / uResolution;

        vec3 refracted;
        refracted.r = texture2D(uBg, uvR).r;
        refracted.g = texture2D(uBg, uvG).g;
        refracted.b = texture2D(uBg, uvB).b;

        float fresnel = 1.0 - n.z;
        fresnel = pow(fresnel, 1.8);
        vec3 lightDir = normalize(vec3(-0.3, 0.65, 0.8));
        float spec = pow(max(dot(n, lightDir), 0.0), 14.0) * 0.8;
        vec3 lightDir2 = normalize(vec3(0.5, 0.3, 0.8));
        float spec2 = pow(max(dot(n, lightDir2), 0.0), 20.0) * 0.4;
        float rimTop = n.y > 0.0 ? pow(max(n.y, 0.0), 1.4) * fresnel * 1.3 : 0.0;
        float rimBottom = n.y < 0.0 ? pow(max(-n.y, 0.0), 2.0) * fresnel * 0.3 : 0.0;

        // Realistis — no white tint (kaca asli tidak "menyala" putih)
        vec3 glassColor = refracted;
        glassColor += vec3(rimTop + rimBottom);
        glassColor += vec3(spec + spec2);
        glassColor = clamp(glassColor, 0.0, 1.0);

        outColor = mix(outColor, glassColor, inside);
        glassAlpha = max(glassAlpha, inside);
      }
      gl_FragColor = vec4(outColor, glassAlpha);
    }
  `;

  const MAX_PANELS = 32;
  const material = new THREE.ShaderMaterial({
    vertexShader, fragmentShader, transparent: true,
    uniforms: {
      uBg: { value: bgTexture },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uPanels: { value: Array.from({length: MAX_PANELS}, () => new THREE.Vector4()) },
      uPanelMeta: { value: Array.from({length: MAX_PANELS}, () => new THREE.Vector4()) },
      uPanelCount: { value: 0 },
      uTime: { value: 0 },
    },
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  /* ──────────── PANEL REGISTRY ──────────── */
  const panelRegistry = [];

  function registerPanels() {
    panelRegistry.length = 0;
    const selectors = [
      { sel: '.glass-workspace',  radius: 28,  bevel: 26, refract: 16 },
      { sel: '.glass-sidebar',    radius: 22,  bevel: 20, refract: 12 },
      { sel: '.glass-card',       radius: 20,  bevel: 18, refract: 11 },
      { sel: '.glass-panel',      radius: 20,  bevel: 18, refract: 11 },
      { sel: '.glass-seg',        radius: 30,  bevel: 14, refract: 8  },
      { sel: '.glass-pill',       radius: 30,  bevel: 12, refract: 6  },
      { sel: '.glass-tab',        radius: 30,  bevel: 12, refract: 6  },
      { sel: '.glass-btn',        radius: 30,  bevel: 12, refract: 6  },
      { sel: '.glass-icon-btn',   radius: 999, bevel: 12, refract: 6  },
      { sel: '.glass-corner',     radius: 999, bevel: 12, refract: 7  },
      { sel: '.glass-tile',       radius: 14,  bevel: 12, refract: 6  },
      { sel: '.glass-page',       radius: 8,   bevel: 6,  refract: 3  },
      { sel: '.glass-bar',        radius: 999, bevel: 12, refract: 7  },
    ];

    selectors.forEach(({ sel, radius, bevel, refract }) => {
      document.querySelectorAll(sel).forEach(el => {
        panelRegistry.push({ el, radius, bevel, refract, pressTarget: 0, pressCurrent: 0 });
      });
    });

    panelRegistry.forEach(entry => {
      if (entry.el._pressInstalled) return;
      entry.el._pressInstalled = true;
      entry.el.addEventListener('pointerdown', () => { entry.pressTarget = 1; });
      const release = () => { entry.pressTarget = 0; };
      entry.el.addEventListener('pointerup', release);
      entry.el.addEventListener('pointerleave', release);
      entry.el.addEventListener('pointercancel', release);
    });
  }

  function updatePanels() {
    const uniforms = material.uniforms;
    const valid = [];

    panelRegistry.forEach(entry => {
      const r = entry.el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      if (r.bottom < 0 || r.top > window.innerHeight) return;

      const speed = entry.pressTarget > entry.pressCurrent ? 0.35 : 0.18;
      entry.pressCurrent += (entry.pressTarget - entry.pressCurrent) * speed;

      const actualRadius = Math.min(entry.radius, r.height / 2, r.width / 2);
      valid.push({
        x: r.left, y: r.top, w: r.width, h: r.height,
        radius: actualRadius, bevel: entry.bevel,
        refract: entry.refract, press: entry.pressCurrent,
      });
    });

    valid.sort((a, b) => (b.w * b.h) - (a.w * a.h));
    const list = valid.slice(0, MAX_PANELS);

    for (let i = 0; i < MAX_PANELS; i++) {
      if (i < list.length) {
        const p = list[i];
        uniforms.uPanels.value[i].set(p.x, p.y, p.w, p.h);
        uniforms.uPanelMeta.value[i].set(p.radius, p.bevel, p.refract, p.press);
      } else {
        uniforms.uPanels.value[i].set(0, 0, 0, 0);
        uniforms.uPanelMeta.value[i].set(0, 0, 0, 0);
      }
    }
    uniforms.uPanelCount.value = list.length;
  }

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  /* ──────────── SCROLL SYNC — force panel update to eliminate trailing glitch ──────────── */
  let scrollPending = false;
  function onScroll() {
    if (scrollPending) return;
    scrollPending = true;
    // Run in next frame, synchronous with browser paint
    requestAnimationFrame(() => {
      updatePanels();
      renderer.render(scene, camera);
      scrollPending = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  // Also capture scrolls on scrollable ancestors (e.g., app wrappers)
  document.addEventListener('scroll', onScroll, { passive: true, capture: true });

  /* ──────────── ANIMATE LOOP ──────────── */
  const startTime = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    material.uniforms.uTime.value = (performance.now() - startTime) / 1000;
    updatePanels();
    renderer.render(scene, camera);
  }

  /* ──────────── INIT — with section load observer ──────────── */
  function init() {
    registerPanels();
    installJelly();
    animate();
  }

  // Re-register when new sections load (landing page uses async fetch)
  const mo = new MutationObserver(() => {
    clearTimeout(window._glassRegisterTimer);
    window._glassRegisterTimer = setTimeout(() => {
      registerPanels();
      installJelly();
    }, 150);
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // Initial start — wait a beat for first sections to render
  if (document.readyState === 'complete') {
    setTimeout(init, 100);
  } else {
    window.addEventListener('load', () => setTimeout(init, 100));
  }
}
