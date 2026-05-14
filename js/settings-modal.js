/**
 * js/settings-modal.js — Modal paramètres joueur
 * ─────────────────────────────────────────────────────────
 * Usage :
 *   import { initSettingsModal } from './settings-modal.js';
 *   initSettingsModal(userId);  // appeler après auth
 *
 * Settings sauvegardés : cloud (profiles.settings) + cache localStorage.
 * Structure : { sound_enabled, sound_volume, anim_victory, anim_friend_request }
 */

const DEFAULTS = {
  sound_enabled:              true,
  sound_volume:               1.0,
  anim_victory:               true,
  anim_friend_request:        true,
  anim_friend_request_style:  'calling_card',
};

let _userId = null;

/** Ouvre le modal settings (appelé par le bouton ⚙ sur profile.html). */
export function openSettingsModal() {
  _ensureModal();
  const modal = document.getElementById('settingsModal');
  _loadIntoForm(_readSettings());
  requestAnimationFrame(() => modal.classList.add('sm--visible'));
}

export function initSettingsModal(userId) {
  _userId = userId;
  const btn = document.getElementById('settingsBtn');
  if (btn && !btn._settingsListenerBound) {
    btn.addEventListener('click', openSettingsModal);
    btn._settingsListenerBound = true;
  }
}

// ─────────────────────────────────────────────────────────
// Interne
// ─────────────────────────────────────────────────────────

function _ensureModal() {
  if (document.getElementById('settingsModal')) return;

  const t = (key, fallback) => window.i18n?.t?.(key) || fallback;

  const el = document.createElement('div');
  el.id = 'settingsModal';
  el.innerHTML = `
    <div class="sm-backdrop" id="smBackdrop"></div>
    <div class="sm-panel" role="dialog" aria-modal="true" aria-labelledby="smTitle">
      <div class="sm-header">
        <h2 class="sm-title" id="smTitle">${t('settings.title', 'Settings')}</h2>
        <button class="sm-close" id="smClose" aria-label="Close">✕</button>
      </div>

      <!-- SON -->
      <div>
        <p class="sm-section-title">${t('settings.sound', 'Sound')}</p>
        <div class="sm-row">
          <span class="sm-label">${t('settings.sound_enabled', 'Enable sound')}</span>
          <label class="switch sm-toggle">
            <input type="checkbox" id="smSoundEnabled">
            <span class="slider round"></span>
          </label>
        </div>
        <div class="sm-row">
          <span class="sm-label">${t('settings.sound_volume', 'Volume')}</span>
          <div class="sm-volume-row">
            <input type="range" id="smSoundVolume" min="0" max="1" step="0.05">
            <span class="sm-volume-val" id="smVolumeVal">100%</span>
          </div>
        </div>
      </div>

      <!-- ANIMATIONS -->
      <div>
        <p class="sm-section-title">${t('settings.animations', 'Animations')}</p>
        <div class="sm-row">
          <span class="sm-label">${t('settings.anim_victory', 'Victory animations')}</span>
          <label class="switch sm-toggle">
            <input type="checkbox" id="smAnimVictory">
            <span class="slider round"></span>
          </label>
        </div>
        <div class="sm-row">
          <span class="sm-label">${t('settings.anim_friend_request', 'Friend request animation')}</span>
          <label class="switch sm-toggle">
            <input type="checkbox" id="smAnimFriendRequest">
            <span class="slider round"></span>
          </label>
        </div>
        <div class="sm-row sm-style-row" id="smStyleRow">
          <span class="sm-label sm-label-sub">${t('settings.anim_fr_style', 'Style')}</span>
          <div class="sm-style-btns">
            <button type="button" class="sm-style-btn" data-style="calling_card" id="smStyleCC">
              🃏 ${t('settings.anim_style_cc', 'Calling Card')}
            </button>
            <button type="button" class="sm-style-btn" data-style="persona4_tv" id="smStyleTV">
              📺 ${t('settings.anim_style_tv', 'P4 TV')}
            </button>
            <button type="button" class="sm-style-btn" data-style="persona3_evoker" id="smStyleP3">
              🔫 ${t('settings.anim_style_p3', 'P3 Evoker')}
            </button>
          </div>
        </div>
      </div>

      <button class="sm-save" id="smSave">${t('settings.save', 'Save')}</button>
      <p class="sm-save-status hidden" id="smStatus"></p>
    </div>
  `;
  document.body.appendChild(el);

  // Volume display
  el.querySelector('#smSoundVolume').addEventListener('input', e => {
    el.querySelector('#smVolumeVal').textContent = `${Math.round(e.target.value * 100)}%`;
  });

  // Style selector buttons
  el.querySelectorAll('.sm-style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.sm-style-btn').forEach(b => b.classList.remove('sm-style-btn--active'));
      btn.classList.add('sm-style-btn--active');
    });
  });

  // Afficher/masquer le sélecteur de style selon l'état du toggle
  el.querySelector('#smAnimFriendRequest').addEventListener('change', e => {
    el.querySelector('#smStyleRow').style.display = e.target.checked ? '' : 'none';
  });

  // Fermer
  el.querySelector('#smClose').addEventListener('click', _close);
  el.querySelector('#smBackdrop').addEventListener('click', _close);

  // Sauvegarder
  el.querySelector('#smSave').addEventListener('click', _save);
}

function _loadIntoForm(s) {
  document.getElementById('smSoundEnabled').checked      = s.sound_enabled        ?? true;
  document.getElementById('smSoundVolume').value         = s.sound_volume          ?? 1.0;
  document.getElementById('smAnimVictory').checked       = s.anim_victory          ?? true;
  document.getElementById('smVolumeVal').textContent =
    `${Math.round((s.sound_volume ?? 1.0) * 100)}%`;

  const animOn = s.anim_friend_request ?? true;
  document.getElementById('smAnimFriendRequest').checked = animOn;
  document.getElementById('smStyleRow').style.display = animOn ? '' : 'none';

  const style = s.anim_friend_request_style ?? 'calling_card';
  document.querySelectorAll('.sm-style-btn').forEach(b => {
    b.classList.toggle('sm-style-btn--active', b.dataset.style === style);
  });
}

function _readSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('personaSettings') || '{}') };
  } catch { return { ...DEFAULTS }; }
}

async function _save() {
  const btn    = document.getElementById('smSave');
  const status = document.getElementById('smStatus');

  const activeStyleBtn = document.querySelector('.sm-style-btn--active');
  const newSettings = {
    sound_enabled:              document.getElementById('smSoundEnabled').checked,
    sound_volume:               parseFloat(document.getElementById('smSoundVolume').value),
    anim_victory:               document.getElementById('smAnimVictory').checked,
    anim_friend_request:        document.getElementById('smAnimFriendRequest').checked,
    anim_friend_request_style:  activeStyleBtn?.dataset.style ?? 'calling_card',
  };

  btn.disabled = true;
  status.classList.add('hidden');

  try {
    // Sauvegarder en cloud
    if (_userId && window._personadleApi) {
      await window._personadleApi.user.update(_userId, { settings: newSettings });
    }
    // Cache local
    localStorage.setItem('personaSettings', JSON.stringify(newSettings));

    const t = (key, fallback) => window.i18n?.t?.(key) || fallback;
    status.textContent = t('settings.saved', '✓ Saved!');
    status.classList.remove('hidden');
    setTimeout(() => status.classList.add('hidden'), 2000);
  } catch (err) {
    status.textContent = err.message || 'Save failed';
    status.classList.remove('hidden');
  } finally {
    btn.disabled = false;
  }
}

function _close() {
  const modal = document.getElementById('settingsModal');
  modal?.classList.remove('sm--visible');
}
