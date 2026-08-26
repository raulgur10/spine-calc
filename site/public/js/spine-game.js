/* SpineCalc — easter egg: "El Duende de la Columna"
 * Un runner oculto estilo el dinosaurio de Chrome, temática vertebral.
 * Se activa con el icono de columna del pie de página. Todo corre en el cliente.
 */
(function () {
  "use strict";

  var TRIGGER_ID = "spine-easter-egg";

  // ── Configuración ──────────────────────────────────────────────────────
  var GRAVITY = 2300;      // px/s²
  var JUMP_V = -820;       // velocidad inicial de salto (px/s)
  var BASE_SPEED = 340;    // px/s
  var MAX_SPEED = 820;
  var ACCEL = 9;           // px/s² de aceleración
  var GNOME_W = 34;
  var GNOME_H = 46;
  var SCREW_COOLDOWN = 0.22; // s
  var SCREW_SPEED = 720;   // px/s

  // ── Estado ─────────────────────────────────────────────────────────────
  var overlay = null, canvas = null, ctx = null;
  var raf = null, last = 0;
  var started = false, dead = false, closed = false;
  var speed = BASE_SPEED, score = 0, dist = 0;
  var gnome = null, vertebrae = [], screws = [], parts = [];
  var spawnT = 0, screwCd = 0, high = 0;

  try { high = parseInt(localStorage.getItem("spinecalc_game_high") || "0", 10) || 0; } catch (e) {}

  // ── DOM overlay ────────────────────────────────────────────────────────
  function buildOverlay() {
    var ov = document.createElement("div");
    ov.id = "spine-game-overlay";
    ov.innerHTML =
      '<div class="sg-frame">' +
        '<div class="sg-bar">' +
          '<span class="sg-title">El Duende de la Columna</span>' +
          '<span class="sg-score" id="sg-score">0</span>' +
          '<button class="sg-close" id="sg-close" aria-label="Cerrar">✕</button>' +
        '</div>' +
        '<canvas id="sg-canvas"></canvas>' +
        '<div class="sg-hint" id="sg-hint">Espacio / clic · saltar &nbsp;|&nbsp; X · lanzar tornillo</div>' +
        '<button class="sg-throw" id="sg-throw" aria-label="Lanzar tornillo">🔩</button>' +
        '<div class="sg-dead" id="sg-dead" hidden>' +
          '<div class="sg-dead-box">' +
            '<div class="sg-dead-title">¡Aplastado!</div>' +
            '<div class="sg-dead-score" id="sg-dead-score"></div>' +
            '<button class="sg-retry" id="sg-retry">Reintentar (R)</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    return ov;
  }

  function injectStyles() {
    if (document.getElementById("sg-styles")) return;
    var s = document.createElement("style");
    s.id = "sg-styles";
    s.textContent =
      "#spine-game-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(10,16,22,.92);display:flex;align-items:center;justify-content:center;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}" +
      ".sg-frame{position:relative;width:min(680px,94vw);height:min(460px,74vh);border-radius:14px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.55);border:1px solid #2a3540;background:#0f1a22}" +
      ".sg-bar{display:flex;align-items:center;gap:12px;padding:10px 14px;background:#141f28;color:#cfd8de;font-size:12px;letter-spacing:.04em}" +
      ".sg-title{font-weight:700;color:#e6b980;letter-spacing:.08em}" +
      ".sg-score{margin-left:auto;font-weight:700;font-variant-numeric:tabular-nums;color:#e8e3d5}" +
      ".sg-close{border:none;background:none;color:#7d8a94;font-size:16px;cursor:pointer;line-height:1;padding:4px 6px}" +
      ".sg-close:hover{color:#fff}" +
      "#sg-canvas{display:block;width:100%;height:calc(100% - 40px);cursor:pointer;touch-action:manipulation}" +
      ".sg-hint{position:absolute;left:14px;bottom:10px;color:#7d8a94;font-size:11px;pointer-events:none;letter-spacing:.03em}" +
      ".sg-throw{position:absolute;right:14px;bottom:10px;width:46px;height:46px;border-radius:50%;border:1px solid #3a4650;background:#1b2833;color:#fff;font-size:20px;cursor:pointer;touch-action:manipulation}" +
      ".sg-throw:active{background:#2a3946}" +
      ".sg-dead{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(8,12,16,.55)}" +
      ".sg-dead-box{text-align:center;color:#e8e3d5}" +
      ".sg-dead-title{font-size:26px;font-weight:800;color:#e36b5a;letter-spacing:.05em;margin-bottom:6px}" +
      ".sg-dead-score{font-size:14px;color:#cfd8de;margin-bottom:16px}" +
      ".sg-retry{border:1px solid #3a4650;background:#1b2833;color:#fff;font-size:14px;font-weight:700;padding:10px 22px;border-radius:8px;cursor:pointer}" +
      ".sg-retry:hover{background:#2a3946}";
    document.head.appendChild(s);
  }

  // ── Reinicio de ronda ──────────────────────────────────────────────────
  function reset() {
    speed = BASE_SPEED;
    score = 0;
    dist = 0;
    spawnT = 0.6;
    screwCd = 0;
    vertebrae = [];
    screws = [];
    parts = [];
    dead = false;
    started = true;
    var gy = groundY();
    gnome = { x: 70, y: gy - GNOME_H, vy: 0, onGround: true, blink: 0 };
    var deadBox = document.getElementById("sg-dead");
    if (deadBox) deadBox.hidden = true;
  }

  function groundY() {
    return canvas ? Math.round(canvas.height * 0.82) : 300;
  }

  // ── Entidades ──────────────────────────────────────────────────────────
  function spawnVertebra() {
    var h = 34 + Math.random() * 26;
    var w = 30 + Math.random() * 14;
    vertebrae.push({ x: canvas.width + 40, y: groundY() - h, w: w, h: h, vy: 0 });
  }

  function fireScrew() {
    if (screwCd > 0) return;
    screwCd = SCREW_COOLDOWN;
    var cy = gnome.y + GNOME_H * 0.42;
    screws.push({ x: gnome.x + GNOME_W, y: cy, w: 20, h: 7, spin: 0 });
  }

  function burst(x, y) {
    for (var i = 0; i < 14; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 60 + Math.random() * 220;
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, color: "#d9cfae" });
    }
  }

  // ── Física / update ────────────────────────────────────────────────────
  function update(dt) {
    if (dead) return;

    speed = Math.min(MAX_SPEED, speed + ACCEL * dt);
    dist += speed * dt;
    score = Math.floor(dist / 14);

    // gnome
    if (!gnome.onGround) {
      gnome.vy += GRAVITY * dt;
      gnome.y += gnome.vy * dt;
      if (gnome.y >= groundY() - GNOME_H) {
        gnome.y = groundY() - GNOME_H;
        gnome.vy = 0;
        gnome.onGround = true;
      }
    }
    gnome.blink += dt;

    // screws
    for (var i = screws.length - 1; i >= 0; i--) {
      var sc = screws[i];
      sc.x += SCREW_SPEED * dt;
      sc.spin += dt * 26;
      if (sc.x > canvas.width + 30) { screws.splice(i, 1); continue; }
      for (var j = vertebrae.length - 1; j >= 0; j--) {
        var v = vertebrae[j];
        if (sc.x + sc.w > v.x && sc.x < v.x + v.w && sc.y + sc.h > v.y && sc.y < v.y + v.h) {
          burst(v.x + v.w / 2, v.y + v.h / 2);
          vertebrae.splice(j, 1);
          screws.splice(i, 1);
          score += 5;
          break;
        }
      }
    }

    // vertebrae
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnVertebra();
      spawnT = 0.85 + Math.random() * 0.9 - Math.min(0.45, (speed - BASE_SPEED) / 1400);
    }
    for (var k = vertebrae.length - 1; k >= 0; k--) {
      var vv = vertebrae[k];
      vv.x -= speed * dt;
      if (vv.x + vv.w < -20) { vertebrae.splice(k, 1); continue; }
      // colisión con el duende
      if (vv.x < gnome.x + GNOME_W && vv.x + vv.w > gnome.x && vv.y < gnome.y + GNOME_H && vv.y + vv.h > gnome.y) {
        die();
        return;
      }
    }

    // particles
    for (var m = parts.length - 1; m >= 0; m--) {
      var p = parts[m];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += GRAVITY * 0.5 * dt;
      p.life -= dt;
      if (p.life <= 0) parts.splice(m, 1);
    }

    if (screwCd > 0) screwCd -= dt;
  }

  function die() {
    dead = true;
    if (score > high) { high = score; try { localStorage.setItem("spinecalc_game_high", String(high)); } catch (e) {} }
    var db = document.getElementById("sg-dead");
    if (db) {
      db.hidden = false;
      document.getElementById("sg-dead-score").textContent = "Puntuación: " + score + "  ·  Récord: " + high;
    }
  }

  // ── Dibujo ─────────────────────────────────────────────────────────────
  function draw() {
    var W = canvas.width, H = canvas.height, gy = groundY();
    ctx.clearRect(0, 0, W, H);

    // fondo
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#12202b");
    g.addColorStop(1, "#0b141c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // silueta sutil de columna de fondo
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = "#e8e3d5";
    for (var sx = 40; sx < W; sx += 90) {
      for (var sy = 0, i = 0; sy < gy; sy += 46, i++) {
        var ww = 34 - (i % 3) * 4;
        ctx.fillRect(sx - ww / 2, sy + 8, ww, 30);
      }
    }
    ctx.restore();

    // suelo
    ctx.fillStyle = "#1a2732";
    ctx.fillRect(0, gy, W, H - gy);
    ctx.strokeStyle = "#33434f";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, gy + 0.5);
    ctx.lineTo(W, gy + 0.5);
    ctx.stroke();

    // vértebras
    for (var vi = 0; vi < vertebrae.length; vi++) drawVertebra(vertebrae[vi]);

    // tornillos
    for (var si = 0; si < screws.length; si++) drawScrew(screws[si]);

    // partículas
    for (var pi = 0; pi < parts.length; pi++) {
      var p = parts[pi];
      ctx.globalAlpha = Math.max(0, p.life / 0.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // duende
    drawGnome();

    // score en canvas (grande y tenue)
    ctx.fillStyle = "rgba(232,227,213,0.16)";
    ctx.font = "700 44px ui-monospace, Menlo, monospace";
    ctx.textAlign = "right";
    ctx.fillText(String(score), W - 16, gy - 18);
    ctx.textAlign = "left";

    var scEl = document.getElementById("sg-score");
    if (scEl) scEl.textContent = String(score);
  }

  function drawGnome() {
    var x = gnome.x, y = gnome.y;
    var bob = gnome.onGround ? Math.sin(dist / 90) * 1.6 : 0;
    ctx.save();
    ctx.translate(x + GNOME_W / 2, y + GNOME_H + bob);

    // sombra
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 0, GNOME_W * 0.55, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // piernas / botas
    ctx.fillStyle = "#5b3a22";
    ctx.fillRect(-11, -10, 7, 10);
    ctx.fillRect(4, -10, 7, 10);

    // cuerpo
    ctx.fillStyle = "#c98a4b";
    ctx.beginPath();
    ctx.roundRect(-12, -34, 24, 26, 7);
    ctx.fill();

    // barba
    ctx.fillStyle = "#f2efe4";
    ctx.beginPath();
    ctx.moveTo(-11, -22);
    ctx.lineTo(11, -22);
    ctx.lineTo(0, -8);
    ctx.closePath();
    ctx.fill();

    // cara / ojos
    ctx.fillStyle = "#e6b188";
    ctx.fillRect(-6, -32, 12, 9);
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(-3, -27, 1.6, 0, Math.PI * 2);
    ctx.arc(3, -27, 1.6, 0, Math.PI * 2);
    ctx.fill();

    // nariz
    ctx.fillStyle = "#d9826a";
    ctx.beginPath();
    ctx.arc(0, -24, 2.6, 0, Math.PI * 2);
    ctx.fill();

    // gorro puntiagudo
    ctx.fillStyle = "#3f9d6e";
    ctx.beginPath();
    ctx.moveTo(-11, -30);
    ctx.quadraticCurveTo(0, -46, 0, -62);
    ctx.quadraticCurveTo(0, -46, 11, -30);
    ctx.closePath();
    ctx.fill();
    // pompón
    ctx.fillStyle = "#e8e3d5";
    ctx.beginPath();
    ctx.arc(0, -61, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawVertebra(v) {
    ctx.save();
    ctx.translate(v.x + v.w / 2, v.y + v.h / 2);
    var s = v.w / 40;
    ctx.fillStyle = "#ded7bd";
    ctx.strokeStyle = "#9a8f6f";
    ctx.lineWidth = 1.5;
    // cuerpo vertebral
    ctx.beginPath();
    ctx.roundRect(-14 * s, -10 * s, 28 * s, 20 * s, 5 * s);
    ctx.fill();
    ctx.stroke();
    // apófisis transversas
    ctx.beginPath();
    ctx.roundRect(-20 * s, -4 * s, 6 * s, 8 * s, 2 * s);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(14 * s, -4 * s, 6 * s, 8 * s, 2 * s);
    ctx.fill();
    ctx.stroke();
    // apófisis espinosa (arriba)
    ctx.beginPath();
    ctx.roundRect(-2.5 * s, -16 * s, 5 * s, 8 * s, 2 * s);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawScrew(s) {
    ctx.save();
    ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
    ctx.rotate(-s.spin);
    ctx.fillStyle = "#aab4bd";
    ctx.strokeStyle = "#5c6670";
    ctx.lineWidth = 1;
    // cabeza
    ctx.beginPath();
    ctx.roundRect(-8, -4, 6, 8, 2);
    ctx.fill();
    ctx.stroke();
    // rosca
    ctx.fillStyle = "#c7ced4";
    ctx.beginPath();
    ctx.roundRect(-2, -2.5, 12, 5, 2);
    ctx.fill();
    ctx.stroke();
    // espiral
    ctx.strokeStyle = "#5c6670";
    ctx.beginPath();
    ctx.moveTo(0, -2.5);
    ctx.lineTo(2, 2.5);
    ctx.moveTo(4, -2.5);
    ctx.lineTo(6, 2.5);
    ctx.moveTo(8, -2.5);
    ctx.lineTo(10, 2.5);
    ctx.stroke();
    ctx.restore();
  }

  // ── Loop ───────────────────────────────────────────────────────────────
  function frame(t) {
    if (closed) return;
    var dt = last ? Math.min((t - last) / 1000, 0.033) : 0.016;
    last = t;
    if (started) update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  // ── Input ──────────────────────────────────────────────────────────────
  function jump() {
    if (!started) reset();
    if (dead) return;
    if (gnome.onGround) { gnome.onGround = false; gnome.vy = JUMP_V; }
  }

  function onKey(e) {
    if (e.key === "Escape") { close(); return; }
    if (e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
      e.preventDefault();
      if (dead) { reset(); return; }
      jump();
    } else if (e.key === "x" || e.key === "X" || e.key === "j" || e.key === "J") {
      if (!started || dead) return;
      e.preventDefault();
      fireScrew();
    } else if (e.key === "r" || e.key === "R") {
      reset();
    }
  }

  // ── Apertura / cierre ──────────────────────────────────────────────────
  function open() {
    if (overlay) return;
    injectStyles();
    overlay = buildOverlay();
    canvas = overlay.querySelector("#sg-canvas");
    ctx = canvas.getContext("2d");

    function sizeCanvas() {
      var r = canvas.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);

    overlay.querySelector("#sg-close").addEventListener("click", close);
    overlay.querySelector("#sg-retry").addEventListener("click", reset);
    overlay.querySelector("#sg-throw").addEventListener("click", fireScrew);
    canvas.addEventListener("pointerdown", function () { if (dead) { reset(); } else { jump(); } });
    window.addEventListener("keydown", onKey);

    reset();
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function close() {
    closed = true;
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKey);
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null; canvas = null; ctx = null;
    started = false; dead = false; closed = false;
  }

  function bindTrigger() {
    var el = document.getElementById(TRIGGER_ID);
    if (el) el.addEventListener("click", open);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindTrigger);
  } else {
    bindTrigger();
  }
})();
