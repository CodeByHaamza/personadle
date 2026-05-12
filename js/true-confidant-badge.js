/**
 * js/true-confidant-badge.js — True Confidant Badge (rang 10 Social Link)
 * Éditeur canvas par moitié + animation de génération RP
 */

const SIZE = 240; // px du canvas preview

// ─────────────────────────────────────────────────────────────────
// HELPER : t() sécurisé
// ─────────────────────────────────────────────────────────────────
function _t(key, vars = {}, fallback = '') {
  const r = window.i18n?.t?.(key);
  let str = (r && r !== key) ? r : fallback;
  Object.entries(vars).forEach(([k, v]) => { str = str.replace(`{{${k}}}`, v); });
  return str;
}

// ─────────────────────────────────────────────────────────────────
// RENDU CANVAS : dessine le badge (preview ou final)
// ─────────────────────────────────────────────────────────────────
/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ avatar_data, crop_x, crop_y, crop_scale, ring_color, bg_color, overlay }|null} configLeft
 * @param {{ avatar_data, crop_x, crop_y, crop_scale, ring_color, bg_color, overlay }|null} configRight
 * @param {boolean} rightPending - grise la moitié droite si true
 */
export function renderConfidantBadgeCanvas(canvas, configLeft, configRight, rightPending = false) {
  const ctx = canvas.getContext('2d');
  const s   = canvas.width; // carré
  const r   = s / 2;
  const cx  = r;
  const cy  = r;

  ctx.clearRect(0, 0, s, s);

  // Fond global transparent
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
  ctx.clip();

  // Moitié gauche
  _drawHalf(ctx, s, 'left', configLeft, false);
  // Moitié droite
  _drawHalf(ctx, s, 'right', configRight, rightPending);

  ctx.restore();

  // Ligne lumineuse dorée centrale
  const grad = ctx.createLinearGradient(cx, 0, cx, s);
  grad.addColorStop(0,   'rgba(245,200,66,0)');
  grad.addColorStop(0.2, 'rgba(245,200,66,0.7)');
  grad.addColorStop(0.5, 'rgba(255,220,100,0.9)');
  grad.addColorStop(0.8, 'rgba(245,200,66,0.7)');
  grad.addColorStop(1,   'rgba(245,200,66,0)');
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = grad;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, s);
  ctx.stroke();
  ctx.restore();

  // Anneau extérieur bicolore
  const ringLeft  = configLeft?.ring_color  || '#f5c842';
  const ringRight = configRight?.ring_color || (rightPending ? '#555' : '#f5c842');
  ctx.lineWidth = 4;
  // Arc gauche (de 90° à 270° = moitié gauche)
  ctx.strokeStyle = rightPending ? '#555' : ringLeft;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2, Math.PI / 2, -Math.PI / 2, false);
  ctx.stroke();
  // Arc droit (de -90° à 90° = moitié droite)
  ctx.strokeStyle = rightPending ? '#333' : ringRight;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2, -Math.PI / 2, Math.PI / 2, false);
  ctx.stroke();
}

function _drawHalf(ctx, s, side, config, pending) {
  const r = s / 2;
  ctx.save();
  // Clip : demi-cercle
  ctx.beginPath();
  if (side === 'left') {
    ctx.rect(0, 0, r, s);
  } else {
    ctx.rect(r, 0, r, s);
  }
  ctx.clip();

  // Fond
  const bg = config?.bg_color || (pending ? '#1a1a1a' : '#1a1a2e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, s, s);

  // Avatar
  if (config?.avatar_data) {
    const img   = new Image();
    img.src     = config.avatar_data;
    const scale = config.crop_scale || 1;
    const ox    = (config.crop_x || 0) * r;
    const oy    = (config.crop_y || 0) * s;
    const dim   = s * scale;
    const drawX = side === 'left' ? (r / 2 - dim / 2) + ox : (r + r / 2 - dim / 2) + ox;
    const drawY = s / 2 - dim / 2 + oy;
    if (img.complete) {
      ctx.globalAlpha = pending ? 0.3 : 1;
      ctx.drawImage(img, drawX, drawY, dim, dim);
      ctx.globalAlpha = 1;
    } else {
      img.onload = () => {
        ctx.globalAlpha = pending ? 0.3 : 1;
        ctx.drawImage(img, drawX, drawY, dim, dim);
        ctx.globalAlpha = 1;
      };
    }
  } else if (pending) {
    // Icône sablier
    ctx.fillStyle    = '#555';
    ctx.font         = `${s * 0.2}px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⌛', side === 'left' ? r / 2 : r + r / 2, s / 2);
  }

  // Overlay
  if (config?.overlay === 'glow' && !pending) {
    const grd = ctx.createRadialGradient(
      side === 'left' ? r / 2 : r + r / 2, s / 2, 0,
      side === 'left' ? r / 2 : r + r / 2, s / 2, r
    );
    grd.addColorStop(0, 'rgba(255,220,80,0.25)');
    grd.addColorStop(1, 'rgba(255,220,80,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
  } else if (config?.overlay === 'shadow' && !pending) {
    const grd = ctx.createRadialGradient(
      side === 'left' ? r / 2 : r + r / 2, s / 2, r * 0.5,
      side === 'left' ? r / 2 : r + r / 2, s / 2, r * 1.2
    );
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────
// ÉDITEUR MODAL
// ─────────────────────────────────────────────────────────────────
let _editorState = null;

/**
 * Ouvre l'éditeur de badge pour un ami.
 * @param {number} friendId
 * @param {string} friendPseudo
 * @param {string|null} friendAvatar
 * @param {'left'|'right'} yourSide  'left' si authId < friendId (ordre canonique)
 * @param {object|null} existingConfig  config précédente si déjà soumise
 * @param {boolean} friendSubmitted
 */
export function openBadgeEditor(friendId, friendPseudo, friendAvatar, yourSide, existingConfig = null, friendSubmitted = false) {
  if (document.getElementById('tcb-modal')) return;

  _editorState = {
    friendId,
    friendPseudo,
    friendAvatar,
    yourSide,
    friendSubmitted,
    config: {
      avatar_data: existingConfig?.avatar_data || null,
      crop_x:      existingConfig?.crop_x      || 0,
      crop_y:      existingConfig?.crop_y      || 0,
      crop_scale:  existingConfig?.crop_scale  || 1,
      ring_color:  existingConfig?.ring_color  || '#f5c842',
      bg_color:    existingConfig?.bg_color     || null,
      overlay:     existingConfig?.overlay      || 'none',
    },
    isDragging:       false,
    dragStart:        { x: 0, y: 0 },
    alreadySubmitted: existingConfig?.submitted || false,
  };

  const modal = document.createElement('div');
  modal.id        = 'tcb-modal';
  modal.className = 'tcb-modal-overlay';
  modal.innerHTML = _buildEditorHTML(friendPseudo, yourSide, existingConfig, friendSubmitted);
  document.body.appendChild(modal);

  _bindEditorEvents(modal);
  _refreshPreview(modal);

  // Fermer sur clic hors modal
  modal.addEventListener('click', e => {
    if (e.target === modal) _closeEditor();
  });
}

function _buildEditorHTML(friendPseudo, yourSide, existingConfig, friendSubmitted) {
  return `
  <div class="tcb-modal">
    <button class="tcb-close" aria-label="close">✕</button>
    <h2 class="tcb-title">${_t('badges.true_confidant_editor_title', {}, 'True Confidant Badge')}</h2>
    <p class="tcb-subtitle">${_t('badges.true_confidant_editor_subtitle', { pseudo: friendPseudo }, '')}</p>

    <div class="tcb-preview-wrap">
      <canvas id="tcb-canvas" width="${SIZE}" height="${SIZE}" class="tcb-canvas"></canvas>
      <p class="tcb-preview-hint">↔ ${_t('badges.true_confidant_your_half', {}, 'Your half')}</p>
    </div>

    <div class="tcb-controls">
      <label class="tcb-label">${_t('badges.true_confidant_avatar_label', {}, 'Avatar')}</label>
      <div class="tcb-avatar-list" id="tcb-avatar-list"></div>

      <label class="tcb-label">${_t('badges.true_confidant_zoom_label', {}, 'Zoom')}</label>
      <input type="range" id="tcb-zoom" class="tcb-range" min="0.3" max="3" step="0.05" value="${_editorState.config.crop_scale}">

      <label class="tcb-label">${_t('badges.true_confidant_ring_label', {}, 'Ring color')}</label>
      <input type="color" id="tcb-ring" class="tcb-color" value="${_editorState.config.ring_color}">

      <label class="tcb-label">${_t('badges.true_confidant_bg_label', {}, 'Background')}</label>
      <input type="color" id="tcb-bg" class="tcb-color" value="${_editorState.config.bg_color || '#1a1a2e'}">

      <label class="tcb-label">${_t('badges.true_confidant_overlay_label', {}, 'Effect')}</label>
      <select id="tcb-overlay" class="tcb-select">
        <option value="none"   ${_editorState.config.overlay === 'none'   ? 'selected' : ''}>${_t('badges.true_confidant_overlay_none',   {}, 'None')}</option>
        <option value="glow"   ${_editorState.config.overlay === 'glow'   ? 'selected' : ''}>${_t('badges.true_confidant_overlay_glow',   {}, 'Glow')}</option>
        <option value="shadow" ${_editorState.config.overlay === 'shadow' ? 'selected' : ''}>${_t('badges.true_confidant_overlay_shadow', {}, 'Shadow')}</option>
      </select>
    </div>

    <button id="tcb-submit" class="tcb-submit-btn">
      ${_t('badges.true_confidant_submit_btn', {}, 'Validate my half')}
    </button>
    ${friendSubmitted ? `<p class="tcb-friend-ready">✓ ${friendPseudo} is ready!</p>` : ''}
  </div>`;
}

function _closeEditor() {
  document.getElementById('tcb-modal')?.remove();
  _editorState = null;
}

function _bindEditorEvents(modal) {
  modal.querySelector('.tcb-close').addEventListener('click', _closeEditor);

  // Zoom
  modal.querySelector('#tcb-zoom').addEventListener('input', e => {
    _editorState.config.crop_scale = parseFloat(e.target.value);
    _refreshPreview(modal);
  });

  // Ring color
  modal.querySelector('#tcb-ring').addEventListener('input', e => {
    _editorState.config.ring_color = e.target.value;
    _refreshPreview(modal);
  });

  // BG color
  modal.querySelector('#tcb-bg').addEventListener('input', e => {
    _editorState.config.bg_color = e.target.value;
    _refreshPreview(modal);
  });

  // Overlay
  modal.querySelector('#tcb-overlay').addEventListener('change', e => {
    _editorState.config.overlay = e.target.value;
    _refreshPreview(modal);
  });

  // Drag crop (mouse)
  const canvas = modal.querySelector('#tcb-canvas');
  canvas.addEventListener('mousedown', e => {
    _editorState.isDragging = true;
    _editorState.dragStart  = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('mousemove', e => {
    if (!_editorState?.isDragging) return;
    const dx = (e.clientX - _editorState.dragStart.x) / SIZE;
    const dy = (e.clientY - _editorState.dragStart.y) / SIZE;
    _editorState.config.crop_x = Math.max(-1, Math.min(1, (_editorState.config.crop_x || 0) + dx));
    _editorState.config.crop_y = Math.max(-1, Math.min(1, (_editorState.config.crop_y || 0) + dy));
    _editorState.dragStart = { x: e.clientX, y: e.clientY };
    _refreshPreview(modal);
  });
  window.addEventListener('mouseup', () => { if (_editorState) _editorState.isDragging = false; });

  // Touch drag
  canvas.addEventListener('touchstart', e => {
    _editorState.isDragging = true;
    _editorState.dragStart  = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    if (!_editorState?.isDragging) return;
    const dx = (e.touches[0].clientX - _editorState.dragStart.x) / SIZE;
    const dy = (e.touches[0].clientY - _editorState.dragStart.y) / SIZE;
    _editorState.config.crop_x = Math.max(-1, Math.min(1, (_editorState.config.crop_x || 0) + dx));
    _editorState.config.crop_y = Math.max(-1, Math.min(1, (_editorState.config.crop_y || 0) + dy));
    _editorState.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    _refreshPreview(modal);
  }, { passive: true });
  canvas.addEventListener('touchend', () => { if (_editorState) _editorState.isDragging = false; });

  // Avatar list
  _buildAvatarList(modal.querySelector('#tcb-avatar-list'), modal);

  // Submit
  modal.querySelector('#tcb-submit').addEventListener('click', () => _handleSubmit(modal));
}

function _buildAvatarList(container, modal) {
  const profile = JSON.parse(localStorage.getItem('personaProfile') || '{}');
  const avatars = [];
  if (profile.avatar_data) avatars.push({ src: profile.avatar_data, label: 'Profile' });
  for (let i = 0; i < 5; i++) {
    const saved = localStorage.getItem(`savedAvatar_${i}`);
    if (saved) avatars.push({ src: saved, label: `Saved ${i + 1}` });
  }
  if (!avatars.length) {
    container.innerHTML = `<span class="tcb-no-avatar">No saved avatars found</span>`;
    return;
  }
  container.innerHTML = avatars.map((a, i) =>
    `<img src="${a.src}" class="tcb-avatar-thumb${i === 0 && !_editorState.config.avatar_data ? ' tcb-avatar-thumb--active' : ''}" data-idx="${i}" title="${a.label}" alt="${a.label}">`
  ).join('');
  if (!_editorState.config.avatar_data && avatars.length) {
    _editorState.config.avatar_data = avatars[0].src;
  }
  container.querySelectorAll('.tcb-avatar-thumb').forEach((img, i) => {
    img.addEventListener('click', () => {
      container.querySelectorAll('.tcb-avatar-thumb').forEach(t => t.classList.remove('tcb-avatar-thumb--active'));
      img.classList.add('tcb-avatar-thumb--active');
      _editorState.config.avatar_data = avatars[i].src;
      _refreshPreview(modal);
    });
  });
}

function _refreshPreview(modal) {
  const canvas = modal.querySelector('#tcb-canvas');
  if (!canvas) return;
  const s   = _editorState;
  const cfg = s.config;
  const friendConfig = s.friendAvatar
    ? { avatar_data: s.friendAvatar, crop_x: 0, crop_y: 0, crop_scale: 1, ring_color: '#888', bg_color: null, overlay: 'none' }
    : null;

  const leftConfig   = s.yourSide === 'left'  ? cfg : friendConfig;
  const rightConfig  = s.yourSide === 'right' ? cfg : friendConfig;
  const rightPending = s.yourSide === 'left'  && !s.friendSubmitted;
  const leftPending  = s.yourSide === 'right' && !s.friendSubmitted;

  renderConfidantBadgeCanvas(canvas, leftConfig, rightConfig, rightPending || leftPending);
}

async function _handleSubmit(modal) {
  const s = _editorState;
  if (!s) return;
  if (!s.config.avatar_data) { alert('Please select an avatar first.'); return; }

  if (s.alreadySubmitted) {
    const msg = _t('badges.true_confidant_modify_confirm', { pseudo: s.friendPseudo }, `Modify will re-notify ${s.friendPseudo}. Continue?`);
    if (!confirm(msg)) return;
  }

  const btn = modal.querySelector('#tcb-submit');
  btn.disabled    = true;
  btn.textContent = '…';

  try {
    const api  = window._personadleApi;
    const data = await api.socialLink.saveBadgeConfig(s.friendId, { ...s.config, submit: true });

    if (data.both_submitted) {
      _closeEditor();
      const me          = window._currentUser;
      const profile     = JSON.parse(localStorage.getItem('personaProfile') || '{}');
      const friendProfile = await api.user.getPublic(s.friendId).catch(() => ({}));
      showConfidantAnimation(
        me?.pseudo || 'You',
        s.friendPseudo,
        profile.avatar_data || null,
        friendProfile.avatar_data || s.friendAvatar || null,
        async () => { await api.socialLink.saveBadgeFinal(s.friendId); }
      );
    } else {
      btn.disabled    = false;
      btn.textContent = _t('badges.true_confidant_submit_btn', {}, 'Validate my half');
      s.alreadySubmitted = true;
      const existing = modal.querySelector('.tcb-wait-msg');
      if (!existing) {
        const msg = document.createElement('p');
        msg.className   = 'tcb-wait-msg';
        msg.textContent = _t('badges.true_confidant_waiting', { pseudo: s.friendPseudo }, `Waiting for ${s.friendPseudo}…`);
        btn.insertAdjacentElement('afterend', msg);
      }
    }
  } catch (err) {
    btn.disabled    = false;
    btn.textContent = _t('badges.true_confidant_submit_btn', {}, 'Validate my half');
    alert(err.message || 'Error saving badge config.');
  }
}

// ─────────────────────────────────────────────────────────────────
// ANIMATION DE GÉNÉRATION
// ─────────────────────────────────────────────────────────────────
/**
 * Joue l'animation complète de génération du badge.
 * @param {string} pseudoA
 * @param {string} pseudoB
 * @param {string|null} avatarA  base64
 * @param {string|null} avatarB  base64
 * @param {function} onComplete  appelé après animation (pour sauver en BDD)
 */
export function showConfidantAnimation(pseudoA, pseudoB, avatarA, avatarB, onComplete) {
  if (document.getElementById('tcb-anim')) return;

  const overlay     = document.createElement('div');
  overlay.id        = 'tcb-anim';
  overlay.className = 'tcb-anim-overlay';
  overlay.innerHTML = `
    <canvas id="tcb-anim-canvas" class="tcb-anim-canvas"></canvas>
    <div class="tcb-anim-text" id="tcb-anim-text"></div>
    <canvas id="tcb-anim-badge" class="tcb-anim-badge" width="200" height="200" style="opacity:0"></canvas>
  `;
  document.body.appendChild(overlay);

  const text        = overlay.querySelector('#tcb-anim-text');
  const animCanvas  = overlay.querySelector('#tcb-anim-canvas');
  const badgeCanvas = overlay.querySelector('#tcb-anim-badge');
  animCanvas.width  = window.innerWidth;
  animCanvas.height = window.innerHeight;

  const fullMsg = _t('badges.true_confidant_anim_text', { a: pseudoA, b: pseudoB },
    `An unbreakable bond has been forged between ${pseudoA} and ${pseudoB}.`);

  // Phase 1 : typewriter (0–3s)
  let charIdx = 0;
  const typeInterval = setInterval(() => {
    text.textContent = fullMsg.slice(0, ++charIdx);
    if (charIdx >= fullMsg.length) clearInterval(typeInterval);
  }, 3000 / fullMsg.length);

  // Phase 2 : orbites avec traînées (après 3.2s)
  setTimeout(() => {
    text.style.opacity = '0';
    _runOrbitAnimation(animCanvas, avatarA, avatarB, badgeCanvas, pseudoA, pseudoB, onComplete, overlay);
  }, 3200);
}

function _runOrbitAnimation(canvas, avatarA, avatarB, badgeCanvas, pseudoA, pseudoB, onComplete, overlay) {
  const ctx = canvas.getContext('2d');
  const w   = canvas.width;
  const h   = canvas.height;
  const cx  = w / 2;
  const cy  = h / 2;

  const imgA = new Image(); imgA.src = avatarA || '';
  const imgB = new Image(); imgB.src = avatarB || '';

  let t       = 0;
  let phase   = 'orbit';
  let crashed = false;

  const RADIUS    = Math.min(w, h) * 0.28;
  const BALL_SIZE = Math.min(w, h) * 0.12;

  const trailA = [];
  const trailB = [];
  const MAX_TRAIL = 30;

  function tick() {
    if (phase === 'done') return;
    t += 0.04;

    // Spirale vers le centre
    const spiral = Math.max(0, 1 - t / 6);
    const r      = RADIUS * spiral;
    const ax     = cx + r * Math.cos(t * 1.7);
    const ay     = cy + r * Math.sin(t * 1.3);
    const bx     = cx + r * Math.cos(t * 1.7 + Math.PI);
    const by     = cy + r * Math.sin(t * 1.3 + Math.PI);

    trailA.push({ x: ax, y: ay }); if (trailA.length > MAX_TRAIL) trailA.shift();
    trailB.push({ x: bx, y: by }); if (trailB.length > MAX_TRAIL) trailB.shift();

    // Clear semi-transparent → effet traîné persistant
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 0, w, h);

    _drawTrail(ctx, trailA, '#f5c842');
    _drawTrail(ctx, trailB, '#c084fc');

    _drawAvatarCircle(ctx, ax, ay, BALL_SIZE, imgA, '#f5c842');
    _drawAvatarCircle(ctx, bx, by, BALL_SIZE, imgB, '#c084fc');

    if (!crashed && Math.hypot(ax - bx, ay - by) < BALL_SIZE * 1.5) {
      crashed = true;
      phase   = 'crash';
      _doCrash(ctx, cx, cy, w, h, badgeCanvas, pseudoA, pseudoB, onComplete, overlay);
      return;
    }

    requestAnimationFrame(tick);
  }

  let loaded = 0;
  const tryStart = () => { if (++loaded >= 2) requestAnimationFrame(tick); };

  if (!avatarA && !avatarB) { tryStart(); tryStart(); }
  else if (!avatarA) { tryStart(); if (imgB.complete) tryStart(); else imgB.onload = tryStart; }
  else if (!avatarB) { if (imgA.complete) tryStart(); else imgA.onload = tryStart; tryStart(); }
  else {
    if (imgA.complete) tryStart(); else imgA.onload = tryStart;
    if (imgB.complete) tryStart(); else imgB.onload = tryStart;
  }
}

function _drawTrail(ctx, trail, color) {
  trail.forEach((p, i) => {
    const alpha = (i / trail.length) * 0.6;
    const size  = 6 * (i / trail.length);
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, size), 0, Math.PI * 2);
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = color;
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

function _drawAvatarCircle(ctx, x, y, size, img, ringColor) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.clip();
  if (img.complete && img.naturalWidth) {
    ctx.drawImage(img, x - size, y - size, size * 2, size * 2);
  } else {
    ctx.fillStyle = ringColor;
    ctx.fill();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.strokeStyle = ringColor;
  ctx.lineWidth   = 3;
  ctx.stroke();
}

function _doCrash(ctx, cx, cy, w, h, badgeCanvas, pseudoA, pseudoB, onComplete, overlay) {
  let flashAlpha = 1;
  const flashInt = setInterval(() => {
    ctx.fillStyle = `rgba(255, 220, 80, ${flashAlpha})`;
    ctx.fillRect(0, 0, w, h);
    flashAlpha -= 0.08;
    if (flashAlpha <= 0) {
      clearInterval(flashInt);
      _revealBadge(badgeCanvas, pseudoA, pseudoB, onComplete, overlay);
    }
  }, 30);
}

function _revealBadge(badgeCanvas, pseudoA, pseudoB, onComplete, overlay) {
  badgeCanvas.style.transition = 'opacity 1.2s ease, transform 1.2s ease';
  badgeCanvas.style.opacity    = '1';
  badgeCanvas.style.transform  = 'scale(1)';

  if (onComplete) onComplete();

  setTimeout(() => {
    overlay.style.transition = 'opacity 0.8s';
    overlay.style.opacity    = '0';
    setTimeout(() => overlay.remove(), 800);
  }, 4000);
}

// ── Bridges globaux (pour accès depuis profile-view.js sans import ES6) ──────
window._openConfidantBadgeEditor = openBadgeEditor;
window._showConfidantAnimation   = showConfidantAnimation;
