// @ts-check
'use strict';

/* ================= state ================= */
const DEFAULTS = {
  mode: 'simple', rate: 0.9, voiceURI: null, layout: 'grid',
  people: [
    { name: 'Delma',  photo: null },
    { name: 'David',  photo: null },
    { name: 'Hester', photo: null },
    { name: 'Eryka',  photo: null },
    { name: 'the family', photo: null },
  ],
  recent: [],
  ntfy: '',
  callName: '',
  scenes: [],
  btnSize: 'big',
  choiceSets: [],
  recVoice: 'william',
  theme: 'auto',
  showType: false,
  setupDone: false,
  photoBtns: {},
  phrases: ['Please stay with me', 'I need a rest', 'Can you fix my pillow?'],
  signals: [],
  sounds: [],
  peopleLoaded: false,
};
let S = load();
function load() {
  try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem('talkboard-v1') || '{}')); }
  catch (e) { return Object.assign({}, DEFAULTS); }
}
function save() { localStorage.setItem('talkboard-v1', JSON.stringify(S)); }

/* ================= speech ================= */
let voices = [];
function loadVoices() { voices = speechSynthesis.getVoices(); }
loadVoices();
if (typeof speechSynthesis !== 'undefined') speechSynthesis.onvoiceschanged = loadVoices;

function pickVoice() {
  if (S.voiceURI) { const v = voices.find(v => v.voiceURI === S.voiceURI); if (v) return v; }
  return voices.find(v => v.lang === 'en-AU') ||
         voices.find(v => v.lang && v.lang.startsWith('en-GB')) ||
         voices.find(v => v.lang && v.lang.startsWith('en')) || null;
}
/* Natural recorded voice for known phrases; system voice for typed/custom text. */
let AUDIO_MAP = {};
fetch('./audio/map.json').then(r => r.json()).then(m => { AUDIO_MAP = m; }).catch(() => {});
const player = new Audio();
const REC_VOICES = [
  ['william',  'William — Australian'],
  ['mitchell', 'Mitchell — New Zealand'],
  ['ryan',     'Ryan — British'],
  ['thomas',   'Thomas — British'],
  ['natasha',  'Natasha — Australian, female'],
];
function speak(text) {
  // tolerate trailing-period drift between button text and recorded phrases
  const file = AUDIO_MAP[text] || AUDIO_MAP[text + '.'] || AUDIO_MAP[text.replace(/\.$/, '')];
  if (file) {
    try { speechSynthesis.cancel(); } catch (e) {}
    player.pause();
    // map values are william-relative full paths (keeps old cached clients working);
    // swap the voice directory for the selected voice
    const vdir = S.recVoice || 'william';
    player.src = './' + file.replace('audio/william/', 'audio/' + vdir + '/');
    player.currentTime = 0;
    player.play().catch(() => speakTTS(text));
    return;
  }
  speakTTS(text);
}
function speakTTS(text) {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  loadVoices();                          // iOS loads the voice list late; refresh before picking
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) u.voice = v;
  u.lang = v ? v.lang : 'en-AU';         // never let it fall to a non-English system default
  u.rate = S.rate;
  speechSynthesis.speak(u);
}

/* ================= big display ================= */
const big = document.getElementById('big');
const bigIcon = document.getElementById('big-icon');
const bigTxt = document.getElementById('big-txt');
const bigNote = document.getElementById('big-note');
let lastSpoken = '';
let lastTapAt = 0;
let bigTimer = null;
function showBig(icon, text, speakText, photo, pic) {
  if (typeof stopReadAloud === 'function') stopReadAloud();
  const now = Date.now();
  if (now - lastTapAt < (S.mode === 'full' ? 300 : 1000)) return;   // tremor guard; longer in his modes
  lastTapAt = now;
  lastSpoken = speakText || text;
  if (text !== 'YES' && text !== 'NO') {
    S.recent = [{ em: icon, lbl: text, say: lastSpoken, img: pic || null, photo: photo || null }]
      .concat((S.recent || []).filter(r => r.say !== lastSpoken)).slice(0, 4);
    save();
  }
  if (photo) bigIcon.innerHTML = '<img class="face" src="' + photo + '" alt="">';
  else if (pic) bigIcon.innerHTML = '<img class="pic' + (String(pic).indexOf('data:') === 0 ? ' photo' : '') + '" src="' + pic + '" alt="">';
  else bigIcon.textContent = icon || '';
  bigTxt.textContent = text;
  bigNote.textContent = '';
  big.classList.toggle('lite', S.mode !== 'full');   // his modes: no buttons, any tap closes, auto-dismiss
  big.classList.add('show');
  clearTimeout(bigTimer);
  if (S.mode !== 'full') bigTimer = setTimeout(() => big.classList.remove('show'), 8000);
  speak(lastSpoken);
}

/* ---- call-family alert via ntfy.sh (no account, no server) ---- */
function sendCall() {
  showBig('📣', 'COME HERE', 'I need someone to come, please');
  if (!S.ntfy) {
    bigNote.textContent = 'Phone alerts not set up yet — see Settings';
    return;
  }
  bigNote.textContent = 'Alerting family phones…';
  fetch('https://ntfy.sh/' + encodeURIComponent(S.ntfy), {
    method: 'POST',
    body: S.callName ? S.callName + ' needs you to come now.' : 'Please come to the bedside now.',
    headers: { 'Title': 'Talk Board', 'Priority': 'urgent', 'Tags': 'bell' },
  }).then(r => {
    bigNote.textContent = r.ok ? '✓ Family phones alerted' : 'Alert failed — check the topic name';
  }).catch(() => {
    bigNote.textContent = 'No internet — alert not sent';
  });
}
document.getElementById('big-again').addEventListener('click', e => { e.stopPropagation(); speak(lastSpoken); });
document.getElementById('big-close').addEventListener('click', () => big.classList.remove('show'));
big.addEventListener('click', e => { if (big.classList.contains('lite') || e.target === big) big.classList.remove('show'); });

/* ================= top bar ================= */
document.getElementById('btn-yes').addEventListener('click', () => showBig('👍', 'YES', 'Yes'));
document.getElementById('btn-no').addEventListener('click', () => showBig('👎', 'NO', 'No'));
document.getElementById('btn-again').addEventListener('click', () => { if (lastSpoken) speak(lastSpoken); });
document.getElementById('btn-home').addEventListener('click', () => show('home'));
(() => {  // gear: hold ~0.6s to open — a stray tap must not land him in Settings
  const gear = document.getElementById('gear');
  let t = null;
  gear.addEventListener('pointerdown', () => { t = setTimeout(() => show('settings'), 600); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => gear.addEventListener(ev, () => clearTimeout(t)));
})();

/* ================= content ================= */
const I = n => './icons/' + n + '.png';
const NEEDS = [
  { em: '💧', img: I('drink'),      lbl: 'Drink',      say: 'I want a drink please' },
  { em: '🚻', img: I('toilet'),     lbl: 'Toilet',     say: 'I need to go to the toilet' },
  { em: '🔔', img: I('nurse'),      lbl: 'Nurse',      say: 'Please call the nurse or doctor' },
  { em: '🙋', img: I('help'),       lbl: 'Help',       say: 'I need some help please' },
  { em: '😮‍💨', img: I('breathe'),  lbl: 'Breathing',  say: "I'm having trouble breathing" },
  { em: '🤢', img: I('sick'),       lbl: 'Feel sick',  say: 'I feel sick in my stomach' },
  { em: '💫', img: I('dizzy'),      lbl: 'Dizzy',      say: "I'm feeling dizzy" },
  { em: '💊', img: I('medication'), lbl: 'My tablets', say: 'I think I need my medication' },
  { em: '🛏️', img: I('move'),       lbl: 'Move me',    say: "Can you help me move? I'm uncomfortable" },
  { em: '🙇', img: I('situp'),      lbl: 'Sit me up',  say: 'Can you help me sit up?' },
  { em: '✋', img: I('stop'),       lbl: 'Stop', say: "Stop please — I've had enough for now" },
  { em: '🥵', img: I('hot'),        lbl: 'Too hot',    say: "I'm too hot" },
  { em: '🥶', img: I('cold'),       lbl: 'Too cold',   say: "I'm cold" },
  { em: '🍽️', img: I('hungry'),     lbl: 'Hungry',     say: "I'm hungry" },
  { em: '😴', img: I('sleep'),      lbl: 'Rest',       say: "I'm tired. I need to rest" },
  { em: '👄', img: I('drymouth'),   lbl: 'Dry mouth',  say: 'My mouth is dry' },
  { em: '⚠️', img: I('wrong'),      lbl: "Something's wrong", say: 'Something is wrong. Please check on me' },
  { em: '❓', img: I('question'),   lbl: 'Ask me questions', say: 'I need something — please ask me yes or no questions' },
];
const EVERYDAY = [
  { em: '🚰', img: I('water'),   lbl: 'Water',        say: 'Can I have some water?' },
  { em: '☕', img: I('coffee'),  lbl: 'Coffee',       say: "I'd like a coffee please" },
  { em: '🍽️', img: I('eat'),     lbl: 'Something to eat', say: "I'd like something to eat" },
  { em: '📺', img: I('tv'),      lbl: 'TV on',        say: 'Can you put the television on?' },
  { em: '🎵', img: I('music'),   lbl: 'Music',        say: "I'd like some music on" },
  { em: '🔆', img: I('bright'),  lbl: 'Too bright',   say: "It's too bright in here" },
  { em: '🔇', img: I('loud'),    lbl: 'Too loud',     say: "It's too loud" },
  { em: '🪟', img: I('air'),     lbl: 'Fresh air',    say: 'Can you open a window for some fresh air?' },
  { em: '👓', img: I('glasses'), lbl: 'My glasses',   say: 'Can you pass me my glasses?' },
  { em: '📱', img: I('phone'),   lbl: 'My phone',     say: 'Can you pass me my phone?' },
  { em: '🧻', img: I('tissue'),  lbl: 'Tissue',       say: 'Can I have a tissue?' },
  { em: '🧣', img: I('blanket'), lbl: 'Blanket',      say: 'I want a blanket please' },
  { em: '⏳', img: I('wait'),    lbl: 'Wait', say: 'Wait a moment please' },
  { em: '👍', img: I('ok'),      lbl: 'I feel better', say: "I'm feeling a bit better now" },
];
const SPORT = [
  { em: '🎾', img: I('tennis'), lbl: 'Tennis on',   say: 'Turn the tennis on' },
  { em: '⛳', img: I('golf'),   lbl: 'Golf on',     say: 'Put the golf on' },
  { em: '🏉', img: I('footy'),  lbl: 'Footy on',    say: 'Put the footy on' },
  { em: '🏆', img: I('win'),    lbl: "Who's winning?", say: "Who's winning?" },
  { em: '👏', img: I('goodshot'), lbl: 'Good shot', say: 'Good shot' },
  { em: '🔊', lbl: 'Turn it up',   say: 'Turn it up' },
  { em: '🔉', lbl: 'Turn it down', say: 'Turn it down' },
];
const FEELINGS = [
  { em: '❤️', img: I('love'),       lbl: 'I love you',   say: 'I love you' },
  { em: '🙏', img: I('thanks'),     lbl: 'Thank you',    say: 'Thank you' },
  { em: '🫶', img: I('thanks'),     lbl: 'Thanks for looking after me', say: 'Thank you for looking after me' },
  { em: '👍', img: I('ok'),         lbl: "I'm okay",     say: "I'm okay" },
  { em: '🤗', img: I('together'),   lbl: "Glad you're here", say: "I'm glad you're here" },
  { em: '🧑‍🤝‍🧑', img: I('sit'),     lbl: 'Sit with me',  say: 'Come and sit with me' },
  { em: '🤲', img: I('holdhand'),   lbl: 'Hold my hand', say: 'Will you hold my hand?' },
  { em: '🤫', img: I('quiet'),      lbl: 'Quiet please', say: "I'd like some quiet please" },
  { em: '🚪', img: I('alone'),      lbl: 'Leave me be',  say: "I'd like some time on my own for a bit" },
  { em: '😟', img: I('scared'),     lbl: "I'm scared",   say: "I'm feeling scared" },
  { em: '😤', img: I('frustrated'), lbl: 'Frustrated',   say: "I'm frustrated — give me a moment" },
  { em: '😕', img: I('confused'),   lbl: 'Confused',     say: "I'm confused" },
];
const HEART = [
  { em: '❤️', img: I('love'),    lbl: 'I love you',        say: 'I love you' },
  { em: '🙏', img: I('thanks'),  lbl: 'Thank you',         say: 'Thank you for everything' },
  { em: '🕊️', img: I('sorry'),   lbl: 'Please forgive me', say: 'Please forgive me' },
  { em: '🤝', img: I('forgive'), lbl: 'I forgive you',     say: 'I forgive you' },
  { em: '🥹', img: I('proud'),   lbl: "I'm proud of you",  say: 'I am so proud of you' },
  { em: '🙂', lbl: "Don't worry",       say: "Don't worry about me" },
  { em: '😌', img: I('peace'),   lbl: "I'm at peace",      say: "I'm at peace" },
  { em: '💪', img: I('strong'),  lbl: "I'm not scared",    say: "I'm not scared" },
  { em: '💕', img: I('family'),  lbl: 'Love to everyone',  say: 'Give everyone my love' },
  { em: '🪑', img: I('together'), lbl: 'Stay with me',     say: 'Please stay with me' },
  { em: '👋', img: I('closer'),  lbl: 'Come closer',       say: 'Come closer' },
  { em: '🤍', lbl: 'Just sit with me', say: "I just want company — we don't need to talk" },
  { em: '🤗', img: I('holdhand'), lbl: 'Hold my hand',     say: 'Hold my hand' },
  { em: '😘', img: I('kiss'),    lbl: 'Kiss me',           say: 'Give me a kiss' },
  { em: '👋', img: I('goodbye'), lbl: 'Goodbye',           say: 'Goodbye. I love you all.' },
];
const SAYINGS = [
  { em: '❤️', img: I('love'),  lbl: 'I love you',        say: 'I love you' },
  { em: '💪', img: I('ok'),    lbl: "I'll be okay",      say: "I'll be okay" },
  { em: '🦁', img: I('strong'), lbl: 'I want to be strong', say: 'I want to be strong' },
  { em: '🫡', lbl: "I'm still here",    say: "I'm still here" },
  { em: '😌', lbl: "That's better",     say: "That's better" },
  { em: '😤', img: I('frustrated'), lbl: "It's frustrating", say: "It's frustrating" },
  { em: '👂', img: I('understand'), lbl: 'I understand', say: 'I can understand you' },
  { em: '👂', img: I('heard'), lbl: 'I heard you',       say: 'I heard you' },
  { em: '✋', lbl: "Leave it, I'm fine", say: "Leave it, I'm fine" },
  { em: '🤫', img: I('quiet'), lbl: 'Be quiet',          say: 'Be quiet' },
  { em: '🛑', img: I('stop'),  lbl: 'Enough',            say: 'Enough' },
  { em: '🤨', lbl: 'What are you doing?', say: 'What are you doing?' },
  { em: '🤔', lbl: 'Why are you asking?', say: 'Why are you asking?' },
  { em: '💩', lbl: "That's bullshit",   say: "That's bullshit" },
  { em: '🙄', lbl: 'Fucking ridiculous', say: "That's fucking ridiculous" },
  { em: '🥹', img: I('proud'), lbl: "I'm proud of you",  say: "I'm proud of you" },
  { em: '⏳', img: I('wait'),  lbl: 'Give me a minute',  say: 'Give me a minute' },
  { em: '😉', lbl: 'I know',            say: 'I know' },
  { em: '💬', img: I('talk'),  lbl: 'Tell me about your day', say: 'Tell me about your day' },
];
/* conversation moves, not needs: with good comprehension he can hold up his end
   of a chat if the board gives him listener turns (AAC "small talk" comment sets) */
const CHAT = [
  { em: '💬', img: I('talk'), lbl: 'Tell me about your day', say: 'Tell me about your day' },
  { em: '📰', lbl: 'Tell me the news',  say: "Tell me what's been happening" },
  { em: '➕', lbl: 'Tell me more',      say: 'Tell me more' },
  { em: '❓', lbl: 'What happened?',    say: 'What happened next?' },
  { em: '😮', lbl: 'Really?',           say: 'Really?' },
  { em: '😄', lbl: "That's funny",      say: "That's funny" },
  { em: '👏', lbl: "That's great",      say: "That's great" },
  { em: '😕', lbl: "That's no good",    say: "That's no good" },
  { em: '👍', lbl: 'I agree',           say: 'I agree' },
  { em: '👎', lbl: "I don't agree",     say: "I don't agree" },
  { em: '🤷', lbl: "I don't know",      say: "I don't know" },
  { em: '💭', lbl: 'What do you think?', say: 'What do you think?' },
  { em: '🔁', lbl: 'Say that again',    say: 'Can you say that again?' },
  { em: '🐢', lbl: 'Slow down',         say: 'Slow down a bit please' },
];
const PAIN_PARTS = [
  { em: '🤕', img: I('head'),     lbl: 'Head',   part: 'head' },
  { em: '👄', img: I('throat'),   lbl: 'Mouth', part: 'mouth or throat' },
  { em: '🫁', img: I('chest'),    lbl: 'Chest',  part: 'chest' },
  { em: '🤢', img: I('tummy'),    lbl: 'Tummy',  part: 'tummy' },
  { em: '⬅️', img: I('backpain'), lbl: 'Back',   part: 'back' },
  { em: '💪', img: I('arm'),      lbl: 'Arms',   part: 'arm' },
  { em: '🦵', img: I('leg'),      lbl: 'Legs',   part: 'leg' },
  { em: '🧣', img: I('neck'),     lbl: 'Neck',   part: 'neck' },
  { em: '😖', img: I('pain'),     lbl: 'Everywhere', part: null },
];
const SEVERITIES = [
  { em: '🙂', lbl: 'A little', say: 'a little bit' },
  { em: '😣', lbl: 'Bad',      say: 'quite bad' },
  { em: '😖', lbl: 'Very bad', say: 'very bad' },
];
const CHOICE_PRESETS = [
  ['Now', 'Later'],
  ['Water', 'Tea'],
  ['More', "That's enough"],
  ['This one', 'That one'],
];

/* ================= rendering ================= */
const screenEl = document.getElementById('screen');
/** @returns {any} first element of the parsed fragment (typed loosely; runtime is always an HTMLElement) */
function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
function photoFor(lbl) { return (S.photoBtns || {})[lbl] || null; }
function tileVisual(item) {
  const ov = photoFor(item.lbl);
  if (ov) return '<img class="pic photo" src="' + ov + '" alt="">';
  return item.img
    ? '<img class="pic" src="' + item.img + '" alt="" onerror="this.outerHTML=\'<div class=&quot;em&quot;>' + item.em + '</div>\'">'
    : '<div class="em">' + item.em + '</div>';
}
function tileBtn(item, cls) {
  const b = el('<button class="tile ' + (cls || '') + '">' + tileVisual(item) + '<div class="lbl">' + item.lbl + '</div></button>');
  b.addEventListener('click', () => showBig(item.em, item.lbl, item.say, null, photoFor(item.lbl) || item.img));
  return b;
}
function navTile(em, lbl, target, cls) {
  const b = el('<button class="tile ' + (cls || 'nav') + '"><div class="em">' + em + '</div><div class="lbl">' + lbl + '</div></button>');
  b.addEventListener('click', () => show(target));
  return b;
}
function titleRow(text, backTo) {
  const d = el('<div class="screen-title"></div>');
  if (backTo) {
    const back = el('<button class="backbtn">‹ Back</button>');
    back.addEventListener('click', () => show(backTo));
    d.appendChild(back);
  }
  d.appendChild(el('<span>' + text + '</span>'));
  return d;
}

/* ---- encrypted family photos: people.enc ships with the app but only the family
   code can read it (PBKDF2 + AES-GCM via WebCrypto). Decrypted photos stay on-device. ---- */
let PEOPLE_ENC = null;
async function decryptPeople(code, blob) {
  const raw = Uint8Array.from(atob(blob), c => c.charCodeAt(0));
  const salt = raw.slice(0, 16), iv = raw.slice(16, 28), ct = raw.slice(28);
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt, iterations: 300000, hash: 'SHA-256' },
    km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(pt));
}
function mergePeople(list) {
  (list || []).forEach(p => {
    if (!p || typeof p.name !== 'string') return;
    const i = S.people.findIndex(x => x.name.trim().toLowerCase() === p.name.trim().toLowerCase());
    if (i >= 0) S.people[i].photo = p.photo || S.people[i].photo;
    else S.people.push({ name: p.name.trim(), photo: p.photo || null });
  });
}
/* ---- read the buttons aloud: he browses by listening (reading never required) ---- */
let readTimer = null;
function stopReadAloud() {
  clearTimeout(readTimer); readTimer = null;
  document.querySelectorAll('.tile.reading').forEach(t => t.classList.remove('reading'));
}
function readAloudChip(grid) {
  const b = el('<button class="chip" style="margin:0 6px 10px;">🔊 Read them out</button>');
  b.addEventListener('click', () => {
    if (readTimer) { stopReadAloud(); return; }
    const tiles = Array.prototype.slice.call(grid.querySelectorAll('.tile'));
    let i = 0;
    const step = () => {
      stopReadAloud();
      if (i >= tiles.length) return;
      const t = tiles[i];
      t.classList.add('reading');
      t.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      const lbl = t.querySelector('.lbl');
      speakTTS(lbl ? lbl.textContent : '');
      i++;
      readTimer = setTimeout(step, 2000);
    };
    step();
  });
  return b;
}

const SCREENS = {};
SCREENS.unlock = () => {
  const wrap = el('<div style="max-width:520px;margin:6vh auto 0;text-align:center;padding:0 10px;"></div>');
  wrap.appendChild(el('<div style="font-size:72px;">👨‍👩‍👧‍👦</div>'));
  wrap.appendChild(el('<h2 style="font-size:clamp(26px,4vw,34px);margin:12px 0 8px;">Family photos</h2>'));
  wrap.appendChild(el('<div style="font-size:19px;color:var(--muted);margin-bottom:20px;">Enter the family code to load everyone\'s photos onto this device. Asked once — the photos then stay on this device.</div>'));
  const inp = el('<input class="choice-input" type="password" inputmode="numeric" autocomplete="off" placeholder="Family code" style="text-align:center;font-size:30px;letter-spacing:.3em;">');
  const msg = el('<div style="color:var(--red);font-weight:700;min-height:1.4em;margin:8px 0;"></div>');
  const go = el('<button class="primary-btn">Unlock the photos</button>');
  const skip = el('<button class="backbtn" style="margin-top:14px;">Skip for now</button>');
  go.addEventListener('click', () => {
    const code = inp.value.trim();
    if (!code) return;
    go.disabled = true; msg.textContent = 'Unlocking…'; msg.style.color = 'var(--muted)';
    decryptPeople(code, PEOPLE_ENC).then(d => {
      mergePeople(d.people);
      S.peopleLoaded = true; save();
      show(S.setupDone ? 'home' : 'setup');
    }).catch(() => {
      go.disabled = false; msg.style.color = 'var(--red)';
      msg.textContent = "That's not the family code — try again.";
    });
  });
  skip.addEventListener('click', () => { S.peopleLoaded = true; save(); show(S.setupDone ? 'home' : 'setup'); });
  wrap.appendChild(inp); wrap.appendChild(msg); wrap.appendChild(go); wrap.appendChild(el('<div></div>')).appendChild(skip);
  screenEl.appendChild(wrap);
};
function applyChrome() {
  // yesno: giant on-screen YES/NO already exist — a second smaller pair splits motor learning.
  // his modes: no repeat/home icons — one mis-tap lands him somewhere unfamiliar. Family: hold the gear.
  const yn = S.mode === 'yesno';
  const lite = S.mode !== 'full';
  document.getElementById('topbar').style.display = yn ? 'none' : '';
  document.getElementById('btn-again').style.display = lite ? 'none' : '';
  document.getElementById('btn-home').style.display = lite ? 'none' : '';
}
function show(name, arg) {
  if (typeof stopCam === 'function' && name !== 'eyeCam') stopCam();
  if (typeof stopMic === 'function') stopMic();
  stopReadAloud();
  applyChrome();
  screenEl.innerHTML = '';
  screenEl.scrollTop = 0;
  SCREENS[name](arg);
}

/* ---- home ---- */
function callTile(big) {
  const b = el('<button class="tile" style="background:var(--red-bg);color:var(--red);' + (big ? 'min-height:24vh;grid-column:1 / -1;' : '') + '">' + tileVisual({ em: '📣', img: I('call'), lbl: 'COME HERE' }) + '<div class="lbl"' + (big ? ' style="font-size:clamp(30px,5vw,48px);"' : '') + '>COME HERE</div></button>');
  b.addEventListener('click', sendCall);
  return b;
}

SCREENS.home = () => {
  const g = el('<div class="grid big"></div>');
  const painItem = { em: '🤕', img: I('pain'), lbl: 'Pain' };
  if (S.mode === 'yesno') {
    g.classList.add('fill2');
    const yes = el('<button class="tile" style="min-height:34vh;background:var(--green-bg);color:var(--green);"><div class="em">👍</div><div class="lbl" style="font-size:clamp(30px,5vw,48px);">YES</div></button>');
    yes.addEventListener('click', () => showBig('👍', 'YES', 'Yes'));
    const no = el('<button class="tile" style="min-height:34vh;background:var(--red-bg);color:var(--red);"><div class="em">👎</div><div class="lbl" style="font-size:clamp(30px,5vw,48px);">NO</div></button>');
    no.addEventListener('click', () => showBig('👎', 'NO', 'No'));
    const pain = el('<button class="tile warn" style="min-height:34vh;">' + tileVisual(painItem) + '<div class="lbl" style="font-size:clamp(30px,5vw,48px);">PAIN</div></button>');
    pain.addEventListener('click', () => showBig('🤕', 'PAIN', "I'm in pain", null, I('pain')));
    const need = el('<button class="tile" style="min-height:34vh;">' + tileVisual({ em: '❓', img: I('question') }) + '<div class="lbl" style="font-size:clamp(30px,5vw,48px);">HELP</div></button>');
    need.addEventListener('click', () => showBig('❓', 'HELP', 'I need some help please', null, I('question')));
    g.appendChild(yes); g.appendChild(no); g.appendChild(pain); g.appendChild(need);
    g.appendChild(callTile(true));
  } else if (S.mode === 'simple') {
    g.classList.add('fill2', 'many');
    const byLbl = (list, lbl) => list.find(x => x.lbl === lbl);
    // needs first, then his own words — the phrases HE actually says
    g.appendChild(tileBtn(byLbl(NEEDS, 'Drink')));
    g.appendChild(tileBtn(byLbl(NEEDS, 'Toilet')));
    const pain = el('<button class="tile warn">' + tileVisual(painItem) + '<div class="lbl">Pain</div></button>');
    pain.addEventListener('click', () => showBig('🤕', 'PAIN', "I'm in pain", null, I('pain')));
    g.appendChild(pain);
    g.appendChild(callTile(false));
    g.appendChild(tileBtn(byLbl(SAYINGS, 'I love you'), 'c-heart'));
    g.appendChild(tileBtn(byLbl(SAYINGS, 'Be quiet'), 'c-words'));
    g.appendChild(tileBtn(byLbl(SAYINGS, "That's bullshit"), 'c-words'));
    screenEl.appendChild(readAloudChip(g));
  } else {
    if (S.recent && S.recent.length) {
      screenEl.appendChild(el('<div class="recent-lbl">Recently said</div>'));
      const rr = el('<div class="recent-row"></div>');
      S.recent.forEach(r => {
        const c = el('<button class="chip">' + escapeHtml(r.lbl) + '</button>');
        c.addEventListener('click', () => showBig(r.em, r.lbl, r.say, r.photo, r.img));
        rr.appendChild(c);
      });
      screenEl.appendChild(rr);
    }
    const pain = el('<button class="tile warn">' + tileVisual(painItem) + '<div class="lbl">Pain</div></button>');
    pain.addEventListener('click', () => show('pain'));
    g.appendChild(pain);
    g.appendChild(tileBtn(NEEDS[0], 'c-need'));
    g.appendChild(tileBtn(NEEDS[1], 'c-need'));
    g.appendChild(tileBtn(NEEDS[2], 'c-need'));
    g.appendChild(callTile(false));
    g.appendChild(navTile('🛎️', 'I need…', 'needs', 'c-need'));
    g.appendChild(navTile('🏠', 'Everyday', 'everyday', 'c-day'));
    g.appendChild(navTile('🎾', 'Sport / TV', 'sport', 'c-sport'));
    g.appendChild(navTile('🗣️', 'My sayings', 'sayings', 'c-words'));
    g.appendChild(navTile('💬', 'Chat', 'chat', 'c-feel'));
    g.appendChild(navTile('❤️', 'From the heart', 'heart', 'c-heart'));
    g.appendChild(navTile('😊', 'Feelings', 'feelings', 'c-feel'));
    g.appendChild(navTile('👨‍👩‍👧', 'People', 'people', 'c-people'));
    if (S.scenes && S.scenes.length) g.appendChild(navTile('🖼️', 'My room', 'scenes', 'c-people'));
    g.appendChild(navTile('❓', 'Ask him', 'ask'));
    if (S.showType) g.appendChild(navTile('⌨️', 'Type', 'talk'));
  }
  screenEl.appendChild(g);
};

/* ---- shared list-screen builder: title, "read them out" chip, tile grid ---- */
function listScreen(title, items, cls) {
  screenEl.appendChild(titleRow(title, 'home'));
  const g = el('<div class="grid"></div>');
  items.forEach(n => g.appendChild(tileBtn(n, cls)));
  screenEl.appendChild(readAloudChip(g));
  screenEl.appendChild(g);
}
SCREENS.needs = () => listScreen('I need…', NEEDS, 'c-need');
SCREENS.everyday = () => listScreen('Everyday', EVERYDAY, 'c-day');
SCREENS.sport = () => listScreen('Sport / TV', SPORT, 'c-sport');
SCREENS.feelings = () => listScreen('Feelings', FEELINGS, 'c-feel');
SCREENS.sayings = () => listScreen('My sayings', SAYINGS, 'c-words');
SCREENS.heart = () => listScreen('From the heart', HEART, 'c-heart');
SCREENS.chat = () => listScreen('Chat', CHAT, 'c-feel');

/* ---- tap anywhere = YES: no aiming, any touch is the signal ---- */
SCREENS.tapYes = () => {
  const wrap = el('<div style="position:fixed;inset:0;z-index:40;background:var(--green-bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3vh;"></div>');
  const exit = el('<button class="backbtn" style="position:absolute;top:10px;left:10px;">‹ Done</button>');
  exit.addEventListener('click', e => { e.stopPropagation(); wrap.remove(); show('home'); });
  wrap.appendChild(exit);
  wrap.appendChild(el('<div style="font-size:clamp(18px,2.6vw,24px);color:var(--muted);">Ask him a yes/no question out loud, then hand him the screen.</div>'));
  wrap.appendChild(el('<div style="font-size:clamp(80px,20vw,220px);line-height:1;">👍</div>'));
  wrap.appendChild(el('<div style="font-size:clamp(40px,9vw,110px);font-weight:800;color:var(--green);">TOUCH = YES</div>'));
  const said = el('<div style="font-size:clamp(26px,4vw,40px);font-weight:700;color:var(--green);min-height:1.3em;"></div>');
  wrap.appendChild(said);
  wrap.addEventListener('click', () => {
    speak('Yes');
    said.textContent = '✓ He said YES';
    setTimeout(() => { said.textContent = ''; }, 4000);
  });
  document.body.appendChild(wrap);
};

/* ---- tap code: no aiming at all — the NUMBER of taps anywhere is the message ---- */
SCREENS.tapCode = () => {
  const wrap = el('<div style="position:fixed;inset:0;z-index:40;background:var(--bg);display:flex;flex-direction:column;padding:10px;gap:8px;"></div>');
  const exit = el('<button class="backbtn" style="align-self:flex-start;">‹ Done</button>');
  exit.addEventListener('click', e => { e.stopPropagation(); wrap.remove(); show('ask'); });
  wrap.appendChild(exit);
  wrap.appendChild(el('<div style="font-size:clamp(16px,2.2vw,20px);color:var(--muted);">Tap ANYWHERE on the screen — the number of taps is the message. The cards are just reminders.</div>'));
  const legend = el('<div class="grid" style="flex:1;grid-template-columns:repeat(2,1fr);pointer-events:none;"></div>');
  const CODES = [
    { n: '1 tap',  em: '👍', lbl: 'YES' },
    { n: '2 taps', em: '👎', lbl: 'NO' },
    { n: '3 taps', em: '📣', img: I('call'), lbl: 'COME HERE' },
    { n: 'HOLD',   em: '🤕', img: I('pain'), lbl: 'PAIN' },
  ];
  CODES.forEach(c => {
    legend.appendChild(el('<div class="tile" style="min-height:24vh;"><div style="font-size:clamp(20px,3.5vh,30px);font-weight:800;color:var(--blue);">' + c.n + '</div>' + tileVisual(c) + '<div class="lbl">' + c.lbl + '</div></div>'));
  });
  wrap.appendChild(legend);
  // inline feedback (not the big overlay) so the whole screen stays tappable for the next message
  const fb = el('<div style="min-height:14vh;display:flex;align-items:center;justify-content:center;gap:16px;font-size:clamp(34px,8vh,64px);font-weight:800;"></div>');
  wrap.appendChild(fb);
  let taps = 0, commitT = null, holdT = null, held = false, fbT = null;
  function said(em, word, color, sayText) {
    fb.innerHTML = '<span>' + em + '</span><span style="color:' + color + ';">' + word + '</span>';
    clearTimeout(fbT);
    fbT = setTimeout(() => { fb.innerHTML = ''; }, 6000);
    speak(sayText);
  }
  function fire() {
    const n = taps; taps = 0;
    if (n === 1) said('👍', 'YES', 'var(--green)', 'Yes');
    else if (n === 2) said('👎', 'NO', 'var(--red)', 'No');
    else if (n >= 3) {
      said('📣', 'COME HERE', 'var(--red)', 'I need someone to come, please');
      if (S.ntfy) fetch('https://ntfy.sh/' + encodeURIComponent(S.ntfy), {
        method: 'POST',
        body: S.callName ? S.callName + ' needs you to come now.' : 'Please come to the bedside now.',
        headers: { 'Title': 'Talk Board', 'Priority': 'urgent', 'Tags': 'bell' },
      }).catch(() => {});
    }
  }
  wrap.addEventListener('pointerdown', e => {
    if (e.target.closest('.backbtn')) return;
    held = false;
    holdT = setTimeout(() => { held = true; taps = 0; clearTimeout(commitT); said('🤕', 'PAIN', 'var(--red)', "I'm in pain"); }, 900);
  });
  wrap.addEventListener('pointerup', e => {
    if (e.target.closest('.backbtn')) return;
    clearTimeout(holdT);
    if (held) return;
    taps++;
    clearTimeout(commitT);
    commitT = setTimeout(fire, 800);
  });
  document.body.appendChild(wrap);
};

/* ---- our signals: the family's shared dictionary of HIS off-screen signals ---- */
SCREENS.signals = () => {
  screenEl.appendChild(titleRow('Our signals', 'ask'));
  const wrap = el('<div style="max-width:680px;margin:0 auto;"></div>');
  if (!S.signals.length) {
    wrap.appendChild(el('<div style="font-size:20px;color:var(--muted);padding:10px 6px;line-height:1.5;">No signals recorded yet. When he uses something consistently — a hand squeeze, looking up, a sound — agree what it means and add it in ⚙️ Settings → <b>Our signals</b>, so every visitor, nurse and carer reads him the same way.</div>'));
  }
  S.signals.forEach(sg => {
    wrap.appendChild(el('<div class="tile" style="width:100%;min-height:0;padding:18px;margin-bottom:10px;flex-direction:row;gap:14px;justify-content:flex-start;"><div class="lbl" style="font-size:clamp(22px,3.4vw,30px);">' + escapeHtml(sg.sig) + '</div><div style="font-size:clamp(22px,3.4vw,30px);color:var(--muted);">→</div><div class="lbl" style="font-size:clamp(22px,3.4vw,30px);color:var(--green);">' + escapeHtml(sg.means) + '</div></div>'));
  });
  screenEl.appendChild(wrap);
};

/* ---- his sounds: learn HIS repeatable sounds and match them to phrases.
   Voiceitt-style closed-set matching, but fully on-device and offline: sounds are
   stored as small spectral fingerprints (never raw audio, never uploaded). ---- */
let micStream = null, micRunning = false;
function stopMic() {
  micRunning = false;
  if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
}
/* listen for one vocalisation and return its fingerprint: 20 spectral bands + duration + pitch slope */
async function captureSound(onStatus, onDone) {
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  await ac.resume();
  micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const an = ac.createAnalyser();
  an.fftSize = 1024; an.smoothingTimeConstant = 0.3;
  ac.createMediaStreamSource(micStream).connect(an);
  const bins = an.frequencyBinCount, buf = new Uint8Array(bins);
  const frames = [];
  let noise = 0.08, quiet = 0, capturing = false, t0 = 0;
  micRunning = true;
  onStatus('listening');
  const tick = () => {
    if (!micRunning) { ac.close().catch(() => {}); return; }
    an.getByteFrequencyData(buf);
    let e = 0; for (let i = 2; i < 220; i++) e += buf[i];
    e /= (218 * 255);
    if (!capturing) {
      noise = Math.min(noise * 0.98 + e * 0.02, 0.2);
      if (e > noise * 2 + 0.045) { capturing = true; t0 = performance.now(); onStatus('hearing'); }
    }
    if (capturing) {
      frames.push(Array.prototype.slice.call(buf));
      if (e < noise * 1.5 + 0.02) quiet++; else quiet = 0;
      const dur = (performance.now() - t0) / 1000;
      if ((quiet > 14 && dur > 0.25) || dur > 3) {
        stopMic(); ac.close().catch(() => {});
        onDone(fingerprint(frames.slice(0, Math.max(1, frames.length - quiet)), dur));
        return;
      }
    }
    requestAnimationFrame(tick);
  };
  tick();
}
function fingerprint(frames, dur) {
  const BANDS = 20, half = frames[0].length;
  const spec = new Array(BANDS).fill(0);
  const centroid = f => {
    let s = 0, w = 0;
    for (let i = 2; i < 300; i++) { s += f[i]; w += f[i] * i; }
    return s > 0 ? w / s : 0;
  };
  frames.forEach(f => {
    for (let b = 0; b < BANDS; b++) {
      // log-spaced band edges over the lower half of the spectrum (voice range)
      const lo = Math.floor(Math.pow(half / 2, b / BANDS)), hi = Math.max(lo + 1, Math.floor(Math.pow(half / 2, (b + 1) / BANDS)));
      let s = 0; for (let i = lo; i < hi; i++) s += f[i];
      spec[b] += s / (hi - lo);
    }
  });
  let norm = Math.sqrt(spec.reduce((a, v) => a + v * v, 0)) || 1;
  const third = Math.max(1, Math.floor(frames.length / 3));
  const slope = (centroidAvg(frames.slice(-third)) - centroidAvg(frames.slice(0, third))) / 100;
  function centroidAvg(fs) { return fs.reduce((a, f) => a + centroid(f), 0) / fs.length; }
  return { spec: spec.map(v => +(v / norm).toFixed(4)), dur: +dur.toFixed(2), slope: +slope.toFixed(3) };
}
function soundDist(a, b) {
  let dot = 0;
  for (let i = 0; i < a.spec.length; i++) dot += a.spec[i] * b.spec[i];
  return (1 - dot) + Math.min(1, Math.abs(a.dur - b.dur) / 1.5) * 0.35 + Math.min(1, Math.abs(a.slope - b.slope)) * 0.25;
}
function matchSound(fp) {
  const scored = S.sounds
    .filter(s => s.samples.length)
    .map(s => ({ s, d: Math.min.apply(null, s.samples.map(x => soundDist(fp, x))) }))
    .sort((x, y) => x.d - y.d);
  if (!scored.length) return null;
  const best = scored[0], second = scored[1];
  return { sound: best.s, d: best.d, sure: best.d < 0.35 && (!second || second.d - best.d > 0.08) };
}

SCREENS.hisSounds = () => {
  screenEl.appendChild(titleRow('His sounds (experimental)', 'ask'));
  const wrap = el('<div style="max-width:680px;margin:0 auto;text-align:center;"></div>');
  const trained = S.sounds.filter(s => s.samples.length >= 2);
  if (trained.length < 2) {
    wrap.appendChild(el('<div style="font-size:20px;color:var(--muted);line-height:1.5;text-align:left;">Teach the app at least TWO of his sounds first (⚙️ Settings → <b>His sounds</b> → record 3–5 samples of each). Then this screen listens and shows its best guess at what he means — you confirm with him. It only ever suggests; he stays in charge.</div>'));
    screenEl.appendChild(wrap); return;
  }
  const status = el('<div style="font-size:22px;color:var(--muted);min-height:1.4em;margin:8px 0;">Starting microphone…</div>');
  const guess = el('<div class="tile" style="min-height:30vh;margin:6px 0 12px;"></div>');
  const btnRow = el('<div style="display:flex;gap:12px;justify-content:center;"></div>');
  wrap.appendChild(status); wrap.appendChild(guess); wrap.appendChild(btnRow);
  screenEl.appendChild(wrap);
  let current = null;
  function listen() {
    guess.innerHTML = '<div class="lbl" style="color:var(--muted);">Waiting for a sound…</div>';
    btnRow.innerHTML = '';
    captureSound(
      st => { status.textContent = st === 'hearing' ? '👂 Hearing him…' : '🎙️ Listening — quiet room works best'; },
      fp => {
        const m = matchSound(fp);
        current = m;
        if (!m) { listen(); return; }
        guess.innerHTML = '<div style="font-size:16px;color:var(--muted);letter-spacing:.05em;">' + (m.sure ? 'SOUNDS LIKE' : 'MAYBE — not sure') + '</div>' +
          '<div class="lbl" style="font-size:clamp(30px,5vw,46px);">' + escapeHtml(m.sound.name) + '</div>' +
          '<div style="font-size:clamp(20px,3vw,28px);color:var(--green);font-weight:700;">“' + escapeHtml(m.sound.say) + '”</div>';
        const yes = el('<button class="tile" style="flex:2;min-height:90px;background:var(--green-bg);color:var(--green);"><div class="lbl">✓ That\'s it — say it</div></button>');
        yes.addEventListener('click', () => { lastTapAt = 0; showBig('👂', m.sound.say, m.sound.say); setTimeout(listen, 400); });
        const no = el('<button class="tile" style="flex:1;min-height:90px;"><div class="lbl">✗ No — listen again</div></button>');
        no.addEventListener('click', listen);
        btnRow.appendChild(yes); btnRow.appendChild(no);
        status.textContent = 'Check with him, then tap.';
      }
    ).catch(() => { status.textContent = "Microphone couldn't start — check the browser's mic permission for this site."; });
  }
  listen();
};

/* ---- eye pointing: options at screen extremes, family reads his gaze ---- */
SCREENS.eyeShow = (opts) => {
  screenEl.appendChild(titleRow('Watch his eyes, tap what they choose', 'ask'));
  screenEl.appendChild(el('<div style="font-size:18px;color:var(--muted);text-align:center;margin-bottom:2vh;">Hold the screen facing him at eye level, ~50 cm away. Say: "Look at the one you want."</div>'));
  const wrap = el('<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:16vw;row-gap:6vh;align-items:center;min-height:52vh;"></div>');
  opts.slice(0, 4).forEach(o => {
    const b = el('<button class="tile" style="min-height:24vh;"><div class="lbl" style="font-size:clamp(28px,4.5vw,44px);">' + escapeHtml(o) + '</div></button>');
    b.addEventListener('click', () => showBig('👀', o, o));
    wrap.appendChild(b);
  });
  screenEl.appendChild(wrap);
};

/* ---- live eye view: front camera + on-device iris tracking, left/right dwell ---- */
let camStream = null, camRunning = false;
function stopCam() {
  camRunning = false;
  if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
}
SCREENS.eyeCam = (opts) => {
  stopCam();
  const [optL, optR] = opts;
  let swap = false;
  const tr = titleRow('Live eye view', 'ask');
  screenEl.appendChild(tr);
  const status = el('<div style="font-size:18px;color:var(--muted);text-align:center;margin-bottom:8px;">Starting camera…</div>');
  const video = el('<video autoplay playsinline muted style="width:180px;border-radius:14px;display:block;margin:0 auto 10px;transform:scaleX(-1);"></video>');
  const row = el('<div style="display:flex;gap:10vw;min-height:46vh;"></div>');
  const mk = txt => el('<button class="tile" style="flex:1;min-height:44vh;transition:background .2s,outline .2s;"><div class="lbl" style="font-size:clamp(28px,4.5vw,44px);">' + escapeHtml(txt) + '</div></button>');
  const panL = mk(optL), panR = mk(optR);
  panL.addEventListener('click', () => showBig('👀', optL, optL));
  panR.addEventListener('click', () => showBig('👀', optR, optR));
  row.appendChild(panL); row.appendChild(panR);
  const swapB = el('<button class="toggle-btn" style="display:block;margin:12px auto 0;">⇄ Swap sides (if the highlight is backwards)</button>');
  swapB.addEventListener('click', () => { swap = !swap; });
  screenEl.appendChild(status); screenEl.appendChild(video); screenEl.appendChild(row); screenEl.appendChild(swapB);

  const votes = [];
  function highlight(side) {
    panL.style.outline = side === 'L' ? '8px solid var(--green)' : 'none';
    panR.style.outline = side === 'R' ? '8px solid var(--green)' : 'none';
  }
  (async () => {
    try {
      status.textContent = 'Loading eye model… (needs internet the first time)';
      const vision = await import('./vendor/vision_bundle.mjs');
      const fileset = await vision.FilesetResolver.forVisionTasks('./vendor/wasm');
      const lm = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: './vendor/face_landmarker.task' },
        runningMode: 'VIDEO', numFaces: 1,
      });
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      video.srcObject = camStream;
      camRunning = true;
      status.textContent = 'Watching — the green outline follows his eyes. Tap a side to confirm.';
      const loop = () => {
        if (!camRunning) return;
        if (video.readyState >= 2) {
          const res = lm.detectForVideo(video, performance.now());
          const f = res.faceLandmarks && res.faceLandmarks[0];
          if (f) {
            // iris position within each eye: 0 = image-left corner, 1 = image-right corner
            const r1 = irisRatio(f, 468, 33, 133);
            const r2 = irisRatio(f, 473, 362, 263);
            const r = (r1 + r2) / 2;
            // iris toward image-right = he is looking toward HIS left = screen-left option
            let side = r > 0.58 ? 'L' : r < 0.42 ? 'R' : null;
            if (side && swap) side = side === 'L' ? 'R' : 'L';
            votes.push(side);
            if (votes.length > 14) votes.shift();
            const l = votes.filter(v => v === 'L').length, ri = votes.filter(v => v === 'R').length;
            highlight(l >= 9 ? 'L' : ri >= 9 ? 'R' : null);
          } else {
            highlight(null);
          }
        }
        requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      status.textContent = "Camera view couldn't start (" + (e && e.message ? e.message : e) + '). Use the no-camera eye pointing instead — your eyes reading his work just as well.';
    }
  })();
};
function irisRatio(f, iris, cA, cB) {
  const xmin = Math.min(f[cA].x, f[cB].x), xmax = Math.max(f[cA].x, f[cB].x);
  return xmax > xmin ? (f[iris].x - xmin) / (xmax - xmin) : 0.5;
}

/* ---- how to enable iPadOS eye tracking ---- */
SCREENS.eyeHelp = () => {
  screenEl.appendChild(titleRow('Built-in eye tracking (iPad & iPhone)', 'ask'));
  screenEl.appendChild(el(`<div style="max-width:680px;margin:0 auto;font-size:20px;line-height:1.55;-webkit-user-select:text;user-select:text;">
    <p><b>Works on:</b> iPad 8th generation or newer (incl. 9th and 10th gen) running <b>iPadOS 18 or later</b>, and iPhone 12 or newer running <b>iOS 18 or later</b>. If you can't find the menu below, update the device first: Settings → General → Software Update. (The bigger iPad screen is much easier for his eyes to aim at than a phone.)</p>
    <p><b>Turn it on (same on iPad and iPhone):</b> Settings → Accessibility → scroll to <i>Physical and Motor</i> → <b>Eye Tracking</b> → switch on.</p>
    <p><b>Calibration:</b> the screen shows a bright dot that moves around. Hold the device steady about 45&nbsp;cm from his face (prop it — don't handhold) and let him watch the dot. A bright moving dot grabs attention on its own, so he may pass without needing to understand anything. It takes ~15 seconds.</p>
    <p><b>If it works:</b> a pointer follows his eyes everywhere in this app, and resting his gaze on a button taps it (that's "Dwell"). Turn the dwell time UP (3–4 seconds) in the same settings so glances don't mis-fire.</p>
    <p><b>If calibration doesn't take</b> — likely, and fine — use Eye pointing here instead (⚙️ Settings → Ask him → Eye pointing): you read his eyes, and yours don't need calibrating.</p>
  </div>`));
};

/* ---- partner-assisted scanning: one option at a time, carer watches for his signal ---- */
SCREENS.scanPick = () => {
  screenEl.appendChild(titleRow('One at a time (family/carer)', 'ask'));
  screenEl.appendChild(el('<div style="font-size:19px;color:var(--muted);margin:0 6px 12px;max-width:640px;">Options appear ONE at a time, big, and spoken. Watch him — any signal (squeeze, blink, nod, sound) means yes: tap <b>That\'s it</b>. No signal: tap <b>Next</b>. Pick which list to go through:</div>'));
  const g = el('<div class="grid"></div>');
  [['I need…', 'needs'], ['Everyday', 'everyday'], ['Feelings', 'feelings'], ['From the heart', 'heart'], ['People', 'people']].forEach(([lbl, key]) => {
    const b = el('<button class="tile nav"><div class="lbl">' + lbl + '</div></button>');
    b.addEventListener('click', () => show('scan', key));
    g.appendChild(b);
  });
  screenEl.appendChild(g);
};
SCREENS.scan = (key) => {
  const lists = {
    needs: NEEDS, everyday: EVERYDAY, feelings: FEELINGS, heart: HEART,
    people: S.people.map(p => ({ em: '🙂', lbl: p.name, say: 'I want to see ' + p.name + '.', photo: p.photo })),
  };
  const items = lists[key] || NEEDS;
  let idx = 0;
  const card = el('<div style="max-width:720px;margin:0 auto;text-align:center;"></div>');
  const counter = el('<div class="recent-lbl" style="text-align:center;"></div>');
  const itemBox = el('<div class="tile" style="min-height:38vh;margin-bottom:14px;"></div>');
  const row = el('<div style="display:flex;gap:12px;"></div>');
  const yesB = el('<button class="tile" style="flex:2;min-height:110px;background:var(--green-bg);color:var(--green);"><div class="lbl" style="font-size:clamp(24px,4vw,34px);">✓ That\'s it</div></button>');
  const nextB = el('<button class="tile" style="flex:1;min-height:110px;"><div class="lbl">Next ›</div></button>');
  function render() {
    const it = items[idx];
    counter.textContent = (idx + 1) + ' of ' + items.length;
    const visual = it.photo ? '<img class="face" src="' + it.photo + '" alt="">' : tileVisual(it);
    itemBox.innerHTML = visual + '<div class="lbl" style="font-size:clamp(30px,5vw,48px);">' + escapeHtml(it.lbl) + '</div>';
    speak(it.say);
  }
  yesB.addEventListener('click', () => {
    const it = items[idx];
    lastTapAt = 0;                       // bypass double-tap guard: this tap is the carer's, deliberate
    showBig(it.em, it.lbl, it.say, it.photo || null, it.img || null);
  });
  nextB.addEventListener('click', () => { idx = (idx + 1) % items.length; render(); });
  screenEl.appendChild(titleRow('Watch him, then tap', 'scanPick'));
  row.appendChild(yesB); row.appendChild(nextB);
  card.appendChild(counter); card.appendChild(itemBox); card.appendChild(row);
  screenEl.appendChild(card);
  render();
};

/* ---- visual scenes: photo of his real room with tappable spots ---- */
SCREENS.scenes = () => {
  if (S.scenes.length === 1) { show('sceneView', S.scenes[0]); return; }
  screenEl.appendChild(titleRow('Point at the photo', 'home'));
  const g = el('<div class="grid"></div>');
  S.scenes.forEach(sc => {
    const b = el('<button class="tile c-people"><img class="pic" style="width:120px;height:90px;border-radius:12px;object-fit:cover;" src="' + sc.photo + '" alt=""><div class="lbl">' + escapeHtml(sc.name) + '</div></button>');
    b.addEventListener('click', () => show('sceneView', sc));
    g.appendChild(b);
  });
  screenEl.appendChild(g);
};
SCREENS.sceneView = (sc) => {
  screenEl.appendChild(titleRow(escapeHtml(sc.name), S.scenes.length === 1 ? 'home' : 'scenes'));
  const wrap = el('<div class="scene-wrap"><img src="' + sc.photo + '" alt=""></div>');
  sc.spots.forEach(sp => {
    const b = el('<button class="spot" style="left:' + (sp.x * 100) + '%;top:' + (sp.y * 100) + '%;">' + escapeHtml(sp.say) + '</button>');
    b.addEventListener('click', () => showBig('👉', sp.say, sp.say));
    wrap.appendChild(b);
  });
  screenEl.appendChild(wrap);
};
SCREENS.sceneEdit = (draft) => {
  screenEl.appendChild(titleRow('Tap the photo where a spot should go', 'settings'));
  const wrap = el('<div class="scene-wrap"><img src="' + draft.photo + '" alt=""></div>');
  const img = wrap.querySelector('img');
  function drawSpots() {
    wrap.querySelectorAll('.spot').forEach(s => s.remove());
    draft.spots.forEach((sp, i) => {
      const b = el('<button class="spot editing" style="left:' + (sp.x * 100) + '%;top:' + (sp.y * 100) + '%;">' + escapeHtml(sp.say) + ' ✕</button>');
      b.addEventListener('click', e => { e.stopPropagation(); draft.spots.splice(i, 1); drawSpots(); });
      wrap.appendChild(b);
    });
  }
  img.addEventListener('click', e => {
    const r = img.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const say = prompt('What should this spot say when he taps it?');
    if (say && say.trim()) { draft.spots.push({ x, y, say: say.trim() }); drawSpots(); }
  });
  drawSpots();
  screenEl.appendChild(wrap);
  const saveBtn = el('<button class="primary-btn" style="max-width:920px;display:block;margin:14px auto 0;">Save this scene</button>');
  saveBtn.addEventListener('click', () => {
    if (!draft.spots.length) { alert('Tap the photo to add at least one spot first.'); return; }
    S.scenes.push(draft); save(); show('settings');
  });
  screenEl.appendChild(saveBtn);
};

/* ---- guided device setup for family ---- */
SCREENS.setup = (idx) => {
  idx = idx || 0;
  function nxt() { save(); applyBtnSize(); applyLayout(); show('setup', idx + 1); }
  const steps = [
    { title: 'Set up this device', sub: 'A few quick choices — all changeable later in Settings (hold the gear in the corner).',
      opts: [['Start ›', () => show('setup', 1)]] },
    { title: 'How is he going right now?', sub: 'This sets how much appears on his screen. Match it to his day.',
      opts: [
        ['Very hard days — Yes/No only', () => { S.mode = 'yesno'; nxt(); }],
        ['Most days — 4 essential buttons', () => { S.mode = 'simple'; nxt(); }],
        ['Clearer windows — everything', () => { S.mode = 'full'; nxt(); }]] },
    { title: 'Button size', sub: 'Bigger is easier to hit. When unsure, go bigger.',
      opts: [
        ['Huge', () => { S.btnSize = 'huge'; nxt(); }],
        ['Big', () => { S.btnSize = 'big'; nxt(); }],
        ['Normal', () => { S.btnSize = 'normal'; nxt(); }]] },
    { title: 'Does he notice both sides of the screen?', sub: 'After a left-side brain injury some people stop seeing the RIGHT side. If everything he responds to is on the left, pick One column.',
      opts: [
        ['Both sides fine — normal grid', () => { S.layout = 'grid'; nxt(); }],
        ['He misses the right side — one column, on the left', () => { S.layout = 'column'; nxt(); }]] },
    { title: 'Pick his voice', sub: 'Tap each to hear it. This voice speaks every button.', voice: true,
      opts: [['Keep this voice ›', () => nxt()]] },
    { title: 'All set', sub: 'Worth doing next in Settings: add family PHOTOS under People (photos beat symbols for him), set up COME HERE phone alerts, and read the two-minute tips page.',
      opts: [['Done', () => { S.setupDone = true; save(); applyBtnSize(); applyLayout(); show('home'); }]] },
  ];
  const st = steps[Math.min(idx, steps.length - 1)];
  const wrap = el('<div style="max-width:640px;margin:4vh auto 0;text-align:center;padding:0 8px;"></div>');
  wrap.appendChild(el('<div style="font-size:15px;color:var(--muted);letter-spacing:.05em;">STEP ' + (idx + 1) + ' OF ' + steps.length + '</div>'));
  wrap.appendChild(el('<h2 style="font-size:clamp(26px,4vw,36px);margin:10px 0 8px;">' + st.title + '</h2>'));
  wrap.appendChild(el('<div style="font-size:19px;color:var(--muted);margin-bottom:3vh;">' + st.sub + '</div>'));
  if (st.voice) {
    REC_VOICES.forEach(([key, lbl]) => {
      const b = el('<button class="toggle-btn' + (S.recVoice === key ? ' on' : '') + '" style="display:block;width:100%;text-align:left;margin:0 0 8px;">' + lbl + '</button>');
      b.addEventListener('click', () => { S.recVoice = key; save(); speak('Hello, I love you all.'); show('setup', idx); });
      wrap.appendChild(b);
    });
  }
  st.opts.forEach(([lbl, fn]) => {
    const b = el('<button class="primary-btn" style="margin-bottom:10px;">' + lbl + '</button>');
    b.addEventListener('click', fn);
    wrap.appendChild(b);
  });
  if (idx > 0 && idx < steps.length - 1) {
    const skip = el('<button class="backbtn" style="margin-top:6px;">Skip</button>');
    skip.addEventListener('click', () => show('setup', idx + 1));
    wrap.appendChild(skip);
  }
  screenEl.appendChild(wrap);
};

/* ---- tips for family ---- */
SCREENS.tips = () => {
  screenEl.appendChild(titleRow('Tips for family & carers', 'settings'));
  screenEl.appendChild(el(`<div style="max-width:680px;margin:0 auto;font-size:20px;line-height:1.55;color:var(--ink);-webkit-user-select:text;user-select:text;">
    <p><b>He understands more than he can say.</b> Speak adult-to-adult, in a natural tone. Never talk over his head about him.</p>
    <p><b>One idea at a time.</b> Short sentences, slow down, use gesture. Writing or showing a key word while you speak helps it land.</p>
    <p><b>Give him time.</b> Wait 5–10 seconds after asking. Don't finish his sentences unless he invites it.</p>
    <p><b>Verify.</b> When he indicates something, confirm it: "So you mean X — yes?"</p>
    <p><b>Offer choices, not open questions.</b> The Choices screen is built for this — you type the options, he picks. Yes/no questions beat "what do you want?"</p>
    <p><b>Watch fatigue.</b> Mornings are often his best window. Keep sessions short and stop at the first signs of tiring. Sitting together in silence counts as communication.</p>
    <p><b>As ability changes, step down the ladder:</b> typing → picture buttons → yes/no → hand squeeze or blink. Agree the hand-squeeze yes/no signal with everyone <i>now</i>, so it's ready if needed.</p>
    <p><b>Teach through his hands, not through explaining.</b> If instructions aren't landing but repeated physical actions become automatic (like his transfers), use that: guide his hand to tap YES while saying "yes" — ten times, several short sessions a day, one or two buttons only, always the same spot. Guide him <i>before</i> he can get it wrong; never quiz. The movement can become automatic even when the explanation can't. The same method teaches a hand squeeze.</p>
    <p><b>When choosing between options is too much,</b> use <b>Choices → One at a time</b>: the screen shows and speaks one option at a time, and he only has to give you any yes-signal. You tap, he signals — that's the whole task.</p>
    <p><b>Show, don't ask.</b> Hold up the actual thing — the cup, the remote, the blanket — and say its word as you do. Recognising real objects outlasts words and pictures; he answers "the cup in your hand", not the sentence. Photograph his own things onto the buttons (Settings → Real photos).</p>
    <p><b>His eyes still point.</b> Choices → Eye pointing puts options at opposite sides — hold the screen facing him at eye level and watch where his eyes go, then tap it for him. Looking at what you want needs no instructions at all. The camera Live eye view can help you see it; your own eyes are just as good.</p>
    <p><b>Don't test him</b> ("what's this called?"). Every interaction should be real communication, not practice.</p>
    <p><b>If he can't tell you about pain</b>, nurses can assess it by observation (the PAINAD scale) — ask his palliative team to show you what they watch for.</p>
    <p style="color:var(--muted);font-size:16px;margin-top:24px;">Based on Supported Conversation for Adults with Aphasia (Aphasia Institute), ASHA end-of-life AAC guidance, and Ira Byock's <i>The Four Things That Matter Most</i>. Pictographic symbols © Government of Aragón, author Sergio Palao, ARASAAC (arasaac.org), CC BY-NC-SA.</p>
  </div>`));
};

/* ---- pain: part then severity ---- */
SCREENS.pain = () => {
  screenEl.appendChild(titleRow('Where does it hurt?', 'home'));
  const g = el('<div class="grid"></div>');
  PAIN_PARTS.forEach(p => {
    const b = el('<button class="tile warn">' + tileVisual(p) + '<div class="lbl">' + p.lbl + '</div></button>');
    b.addEventListener('click', () => show('painLevel', p));
    g.appendChild(b);
  });
  screenEl.appendChild(readAloudChip(g));
  screenEl.appendChild(g);
};
SCREENS.painLevel = (part) => {
  speak(part.part ? 'My ' + part.part + ' hurts.' : "I'm in pain.");
  screenEl.appendChild(titleRow('How bad is it?', 'pain'));
  const g = el('<div class="grid big"></div>');
  SEVERITIES.forEach(sv => {
    const b = el('<button class="tile warn"><div class="em">' + sv.em + '</div><div class="lbl">' + sv.lbl + '</div></button>');
    b.addEventListener('click', () => {
      const where = part.part ? 'My ' + part.part + ' hurts. ' : "I'm in pain. ";
      const label = (part.part ? part.lbl + ' pain' : 'Pain') + ' — ' + sv.lbl.toLowerCase();
      showBig(sv.em, label, where + "It's " + sv.say + '.');
    });
    g.appendChild(b);
  });
  screenEl.appendChild(g);
};

/* ---- people ---- */
SCREENS.people = () => {
  screenEl.appendChild(titleRow('People', 'home'));
  const g = el('<div class="grid"></div>');
  if (!S.people.length) {
    screenEl.appendChild(el('<div style="font-size:22px;color:var(--muted);padding:20px 8px;">No people added yet — open ⚙️ Settings (bottom right) to add family photos and names.</div>'));
  }
  S.people.forEach(p => {
    const inner = p.photo ? '<img class="face" src="' + p.photo + '" alt="">' : '<div class="em">🙂</div>';
    const b = el('<button class="tile c-people">' + inner + '<div class="lbl">' + escapeHtml(p.name) + '</div></button>');
    b.addEventListener('click', () => showBig(null, p.name, 'I want to see ' + p.name + '.', p.photo));
    g.appendChild(b);
  });
  screenEl.appendChild(g);
};

/* ---- choices (caregiver sets up, he picks) ---- */
/* ---- "Ask him" hub: every way to ask, ordered easiest-for-him first ---- */
SCREENS.ask = () => {
  screenEl.appendChild(titleRow('Ask him something (family/carer)', 'home'));
  const wrap = el('<div style="max-width:680px;margin:0 auto;"></div>');
  const card = (em, name, when, fn) => {
    const b = el('<button class="tile" style="width:100%;min-height:0;padding:16px 18px;margin-bottom:10px;flex-direction:row;justify-content:flex-start;gap:16px;text-align:left;"><div class="em" style="font-size:40px;">' + em + '</div><div><div class="lbl" style="font-size:22px;">' + name + '</div><div style="font-size:17px;color:var(--muted);margin-top:2px;">' + when + '</div></div></button>');
    b.addEventListener('click', fn);
    wrap.appendChild(b);
  };
  card('🔁', 'One at a time', 'You flip through spoken options; he gives ANY yes-signal. Start here — no tapping concept needed.', () => show('scanPick'));
  card('✋', 'Tap anywhere = YES', 'One yes/no question out loud: any touch means YES. No aiming.', () => show('tapYes'));
  card('🔢', 'Tap code', 'Taps anywhere ARE the message: 1 = yes, 2 = no, 3 = come here, hold = pain. Reminder cards stay on screen.', () => show('tapCode'));
  card('🤝', 'Our signals', "The family's dictionary of his own signals (squeeze, look, sound) — so everyone reads him the same way.", () => show('signals'));
  card('👂', 'His sounds', 'Experimental: the app learns his repeatable sounds and guesses what he means — you confirm. Teach it in Settings first.', () => show('hisSounds'));
  card('👀', 'Eye pointing', 'When tapping is too hard: hold the screen up, he looks, you tap it for him.', () => show('choiceSetup', 'eye'));
  card('🔀', 'He taps a choice', 'Good windows only: 2–4 big options he taps himself.', () => show('choiceSetup', 'tap'));
  card('📷', 'Live eye view', "Only if you can't read his eyes yourself — the camera highlights the side he looks at.", () => show('choiceSetup', 'cam'));
  card('ℹ️', 'Built-in eye tracking (iPad & iPhone)', 'How to turn on the pointer-follows-his-eyes feature in the device settings.', () => show('eyeHelp'));
  screenEl.appendChild(wrap);
};

SCREENS.choiceSetup = (target) => {
  const titles = { tap: 'He taps a choice', eye: 'Eye pointing', cam: 'Live eye view' };
  screenEl.appendChild(titleRow(titles[target] || 'Choices', 'ask'));
  const wrap = el('<div style="max-width:640px;margin:0 auto;"></div>');
  wrap.appendChild(el('<div style="font-size:19px;color:var(--muted);margin-bottom:12px;">Type ' + (target === 'cam' ? '2' : '2–4') + ' options, then hand him the screen.</div>'));
  const inputs = [];
  for (let i = 0; i < 4; i++) {
    const inp = el('<input class="choice-input" placeholder="Option ' + (i + 1) + (i < 2 ? '' : ' (optional)') + '">');
    inputs.push(inp); wrap.appendChild(inp);
  }
  const presetRow = el('<div class="chips"></div>');
  CHOICE_PRESETS.forEach(ps => {
    const c = el('<button class="chip">' + ps.join(' / ') + '</button>');
    c.addEventListener('click', () => { inputs.forEach((inp, i) => inp.value = ps[i] || ''); });
    presetRow.appendChild(c);
  });
  wrap.appendChild(presetRow);
  if (S.choiceSets && S.choiceSets.length) {
    wrap.appendChild(el('<div class="recent-lbl">Recent questions</div>'));
    const recRow = el('<div class="chips"></div>');
    S.choiceSets.forEach(set => {
      const c = el('<button class="chip">' + set.map(escapeHtml).join(' / ') + '</button>');
      c.addEventListener('click', () => { if (target === 'eye') show('eyeShow', set); else if (target === 'cam') show('eyeCam', set.slice(0, 2)); else show('choicesShow', set); });
      recRow.appendChild(c);
    });
    wrap.appendChild(recRow);
  }
  function getOpts() {
    const opts = inputs.map(i => i.value.trim()).filter(Boolean);
    if (opts.length >= 2) {
      const key = JSON.stringify(opts);
      S.choiceSets = [opts].concat((S.choiceSets || []).filter(s => JSON.stringify(s) !== key)).slice(0, 5);
      save();
    }
    return opts;
  }
  const go = el('<button class="primary-btn">Show him ›</button>');
  go.addEventListener('click', () => {
    const o = getOpts();
    if (o.length < 2) return;
    if (target === 'eye') show('eyeShow', o);
    else if (target === 'cam') show('eyeCam', o.slice(0, 2));
    else show('choicesShow', o);
  });
  wrap.appendChild(go);
  screenEl.appendChild(wrap);
};
SCREENS.choicesShow = (opts) => {
  screenEl.appendChild(titleRow('Tap what you want', 'ask'));
  const g = el('<div class="grid big" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr));"></div>');
  opts.forEach(o => {
    const b = el('<button class="tile" style="min-height:200px;"><div class="lbl" style="font-size:clamp(30px,4.5vw,44px);">' + escapeHtml(o) + '</div></button>');
    b.addEventListener('click', () => showBig('👉', o, o));
    g.appendChild(b);
  });
  const none = el('<button class="tile warn" style="min-height:200px;"><div class="em">🚫</div><div class="lbl">None of these</div></button>');
  none.addEventListener('click', () => showBig('🚫', 'None of these', 'None of these, please ask me something else'));
  g.appendChild(none);
  screenEl.appendChild(g);
};

/* ---- talk / type ---- */
let talkText = '';
SCREENS.talk = () => {
  screenEl.appendChild(titleRow('Type', 'home'));

  screenEl.appendChild(el('<div class="recent-lbl">Saved phrases — tap to speak</div>'));
  const chips = el('<div class="chips"></div>');
  S.phrases.forEach(ph => {
    const c = el('<button class="chip">' + escapeHtml(ph) + '</button>');
    c.addEventListener('click', () => showBig('💬', ph, ph));
    chips.appendChild(c);
  });
  screenEl.appendChild(chips);

  screenEl.appendChild(el('<div class="recent-lbl">Add a word</div>'));
  const wordRow = el('<div class="chips"></div>');
  ["I want", "I don't want", 'more', 'please', 'now', 'later', 'not', 'help'].forEach(w => {
    const c = el('<button class="chip save">' + escapeHtml(w) + '</button>');
    c.addEventListener('click', () => {
      talkText += (talkText && !talkText.endsWith(' ') ? ' ' : '') + w + ' ';
      renderOut();
    });
    wordRow.appendChild(c);
  });
  screenEl.appendChild(wordRow);

  const out = el('<div id="talk-out"></div>');
  screenEl.appendChild(out);
  function renderOut() {
    out.innerHTML = escapeHtml(talkText) + '<span class="cursor">|</span>';
  }
  renderOut();

  const kb = el('<div class="kb"></div>');
  const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  rows.forEach((row, ri) => {
    const r = el('<div class="kb-row"></div>');
    if (ri === 2) {
      const del = el('<button class="key action">⌫</button>');
      del.addEventListener('click', () => { talkText = talkText.slice(0, -1); renderOut(); });
      r.appendChild(del);
    }
    row.split('').forEach(ch => {
      const k = el('<button class="key">' + ch + '</button>');
      k.addEventListener('click', () => { talkText += ch.toLowerCase(); renderOut(); });
      r.appendChild(k);
    });
    if (ri === 2) {
      const clr = el('<button class="key action">Clear</button>');
      clr.addEventListener('click', () => { talkText = ''; renderOut(); });
      r.appendChild(clr);
    }
    kb.appendChild(r);
  });
  const bottom = el('<div class="kb-row"></div>');
  const saveB = el('<button class="key action">💾 Save</button>');
  saveB.addEventListener('click', () => {
    const t = talkText.trim();
    if (t && !S.phrases.includes(t)) { S.phrases.unshift(t); S.phrases = S.phrases.slice(0, 8); save(); show('talk'); }
  });
  const space = el('<button class="key wide">Space</button>');
  space.addEventListener('click', () => { talkText += ' '; renderOut(); });
  const speakB = el('<button class="key speak wide">🔊 Speak</button>');
  speakB.addEventListener('click', () => { const t = talkText.trim(); if (t) showBig('💬', t, t); });
  bottom.appendChild(saveB); bottom.appendChild(space); bottom.appendChild(speakB);
  kb.appendChild(bottom);
  screenEl.appendChild(kb);
};

/* ---- settings ---- */
SCREENS.settings = () => {
  screenEl.appendChild(titleRow('Settings (family/carer)', 'home'));
  const wrap = el('<div style="max-width:680px;margin:0 auto;"></div>');

  /* family quick links (his modes hide the home button, so this is the family's doorway) */
  const qlRow = el('<div class="set-row"><h3>Family screens</h3><div></div></div>');
  const qlBox = qlRow.querySelector('div:last-child');
  [['❓ Ask him', 'ask'], ['👀 Eye tracking', 'eyeHelp'], ['📖 Tips', 'tips'], ['🧭 Device setup', 'setup']].forEach(([lbl, scr]) => {
    const b = el('<button class="toggle-btn">' + lbl + '</button>');
    b.addEventListener('click', () => show(scr, scr === 'setup' ? 0 : undefined));
    qlBox.appendChild(b);
  });
  wrap.appendChild(qlRow);

  /* mode */
  const modeRow = el('<div class="set-row"><h3>Screen mode</h3><label>Match the mode to his day: Yes/No for the hardest days, Simple for 6 big buttons, Full for everything.</label><div></div></div>');
  const modeBtns = modeRow.querySelector('div:last-child');
  [['yesno', 'Yes/No only'], ['simple', 'Simple'], ['full', 'Full']].forEach(([m, lbl]) => {
    const b = el('<button class="toggle-btn' + (S.mode === m ? ' on' : '') + '">' + lbl + '</button>');
    b.addEventListener('click', () => { S.mode = m; save(); show('settings'); });
    modeBtns.appendChild(b);
  });
  wrap.appendChild(modeRow);

  /* appearance */
  const thRow = el('<div class="set-row"><h3>Appearance</h3><label>Auto follows the device\'s light/dark setting.</label><div></div></div>');
  const thBtns = thRow.querySelector('div:last-child');
  [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].forEach(([k, lbl]) => {
    const b = el('<button class="toggle-btn' + (S.theme === k ? ' on' : '') + '">' + lbl + '</button>');
    b.addEventListener('click', () => { S.theme = k; save(); applyTheme(); show('settings'); });
    thBtns.appendChild(b);
  });
  wrap.appendChild(thRow);

  /* typing screen */
  const tyRow = el('<div class="set-row"><h3>Typing screen</h3><label>Hidden by default — typing asks a lot. Turn it on for a sharp window.</label><div></div></div>');
  const tyBtns = tyRow.querySelector('div:last-child');
  [[false, 'Hidden'], [true, 'Shown']].forEach(([v, lbl]) => {
    const b = el('<button class="toggle-btn' + (S.showType === v ? ' on' : '') + '">' + lbl + '</button>');
    b.addEventListener('click', () => { S.showType = v; save(); show('settings'); });
    tyBtns.appendChild(b);
  });
  wrap.appendChild(tyRow);

  /* layout */
  const lyRow = el('<div class="set-row"><h3>Layout</h3><label>If he only notices things on the LEFT side of the screen (common after a left-side brain injury), switch to one column — everything lines up down the left where he can see and reach it.</label><div></div></div>');
  const lyBtns = lyRow.querySelector('div:last-child');
  [['grid', 'Grid'], ['column', 'One column (left)']].forEach(([k, lbl]) => {
    const b = el('<button class="toggle-btn' + (S.layout === k ? ' on' : '') + '">' + lbl + '</button>');
    b.addEventListener('click', () => { S.layout = k; save(); applyLayout(); show('settings'); });
    lyBtns.appendChild(b);
  });
  wrap.appendChild(lyRow);

  /* button size */
  const sizeRow = el('<div class="set-row"><h3>Button size</h3><label>Bigger buttons are easier to hit but fit fewer per screen.</label><div></div></div>');
  const sizeBtns = sizeRow.querySelector('div:last-child');
  [['normal', 'Normal'], ['big', 'Big'], ['huge', 'Huge']].forEach(([k, lbl]) => {
    const b = el('<button class="toggle-btn' + (S.btnSize === k ? ' on' : '') + '">' + lbl + '</button>');
    b.addEventListener('click', () => { S.btnSize = k; save(); applyBtnSize(); show('settings'); });
    sizeBtns.appendChild(b);
  });
  wrap.appendChild(sizeRow);

  /* come-here phone alerts */
  const callRow = el('<div class="set-row"><h3>COME HERE phone alerts</h3><label>The red COME HERE button always speaks aloud. To also ping family phones: 1) install the free <b>ntfy</b> app on each phone, 2) in ntfy, subscribe to a topic with a hard-to-guess name (e.g. <b>gray-family-8241</b>), 3) type that exact topic here on his device. Optional: his first name, used in the alert text.</label><div></div></div>');
  const callBox = callRow.querySelector('div:last-child');
  const topicIn = el('<input class="choice-input" style="margin-top:10px;" placeholder="ntfy topic (same on every phone)">');
  topicIn.value = S.ntfy || '';
  topicIn.addEventListener('change', () => { S.ntfy = topicIn.value.trim(); save(); });
  const nameIn2 = el('<input class="choice-input" placeholder="His first name (optional, stays on this device)">');
  nameIn2.value = S.callName || '';
  nameIn2.addEventListener('change', () => { S.callName = nameIn2.value.trim(); save(); });
  const testBtn = el('<button class="toggle-btn">📣 Send test alert</button>');
  testBtn.addEventListener('click', () => {
    S.ntfy = topicIn.value.trim(); S.callName = nameIn2.value.trim(); save();
    sendCall();
  });
  callBox.appendChild(topicIn); callBox.appendChild(nameIn2); callBox.appendChild(testBtn);
  wrap.appendChild(callRow);

  /* visual scenes */
  const scRow = el('<div class="set-row"><h3>Room photo with tap spots</h3><label>Take a photo of his actual room, then tap the photo to place spots — each spot speaks when he taps it (e.g. the window, the TV, his chair). Real photos are the most reliable images for aphasia.</label><div id="sclist"></div><div></div></div>');
  const sclist = scRow.querySelector('#sclist');
  S.scenes.forEach((sc, idx) => {
    const r = el('<div class="person-row"><img style="border-radius:10px;" src="' + sc.photo + '"><span class="nm">' + escapeHtml(sc.name) + ' (' + sc.spots.length + ' spots)</span></div>');
    const rm = el('<button class="rm">Remove</button>');
    rm.addEventListener('click', () => { if (confirm('Remove ' + sc.name + '?')) { S.scenes.splice(idx, 1); save(); show('settings'); } });
    r.appendChild(rm);
    sclist.appendChild(r);
  });
  const scBox = scRow.querySelector('div:last-child');
  const scName = el('<input class="choice-input" style="margin-top:10px;" placeholder="Scene name (e.g. My room)">');
  const scFile = el('<input type="file" accept="image/*" style="font-size:18px;margin-bottom:10px;">');
  const scAdd = el('<button class="toggle-btn">＋ Add scene &amp; place spots</button>');
  scAdd.addEventListener('click', () => {
    const nm = scName.value.trim() || 'My room';
    const f = scFile.files && scFile.files[0];
    if (!f) { alert('Choose a photo first'); return; }
    shrinkImage(f, dataUrl => show('sceneEdit', { name: nm, photo: dataUrl, spots: [] }), 900);
  });
  scBox.appendChild(scName); scBox.appendChild(scFile); scBox.appendChild(scAdd);
  wrap.appendChild(scRow);

  /* our signals */
  const sgRow = el('<div class="set-row"><h3>Our signals</h3><label>His own reliable signals and what the family agreed they mean (e.g. "One squeeze" → "Yes"). Everyone — visitors, nurses, carers — should read him the same way. Shown big under Ask him → Our signals.</label><div id="sglist"></div><div></div></div>');
  const sglist = sgRow.querySelector('#sglist');
  S.signals.forEach((sg, idx) => {
    const r = el('<div class="person-row"><span class="nm">' + escapeHtml(sg.sig) + ' → ' + escapeHtml(sg.means) + '</span></div>');
    const rm = el('<button class="rm">Remove</button>');
    rm.addEventListener('click', () => { S.signals.splice(idx, 1); save(); show('settings'); });
    r.appendChild(rm);
    sglist.appendChild(r);
  });
  const sgBox = sgRow.querySelector('div:last-child');
  const sigIn = el('<input class="choice-input" style="margin-top:10px;" placeholder="The signal (e.g. One hand squeeze)">');
  const meanIn = el('<input class="choice-input" placeholder="What it means (e.g. Yes)">');
  const sgAdd = el('<button class="toggle-btn">＋ Add signal</button>');
  sgAdd.addEventListener('click', () => {
    const sig = sigIn.value.trim(), means = meanIn.value.trim();
    if (!sig || !means) { alert('Fill in both the signal and what it means.'); return; }
    S.signals.push({ sig, means }); save(); show('settings');
  });
  sgBox.appendChild(sigIn); sgBox.appendChild(meanIn); sgBox.appendChild(sgAdd);
  wrap.appendChild(sgRow);

  /* his sounds trainer */
  const snRow = el('<div class="set-row"><h3>His sounds (experimental)</h3><label>If he makes the SAME sound for the same thing, teach it here: add the sound, then record 3–5 samples of him making it (quiet room). Then Ask him → <b>His sounds</b> listens and guesses. Sounds are stored as tiny fingerprints on this device only — no audio is kept or uploaded.</label><div id="snlist"></div><div></div></div>');
  const snlist = snRow.querySelector('#snlist');
  const snStatus = el('<div style="font-size:17px;color:var(--blue);font-weight:700;min-height:1.3em;margin-top:6px;"></div>');
  S.sounds.forEach((sn, idx) => {
    const r = el('<div class="person-row"><span class="nm">' + escapeHtml(sn.name) + ' → “' + escapeHtml(sn.say) + '” <span style="color:var(--muted);font-weight:600;">(' + sn.samples.length + ' sample' + (sn.samples.length === 1 ? '' : 's') + ')</span></span></div>');
    const rec = el('<button class="toggle-btn" style="margin:0;">🎙️ Record</button>');
    rec.addEventListener('click', () => {
      snStatus.textContent = '🎙️ Listening — have him make the "' + sn.name + '" sound now…';
      captureSound(
        st => { if (st === 'hearing') snStatus.textContent = '👂 Hearing it…'; },
        fp => { sn.samples.push(fp); save(); show('settings'); }
      ).catch(() => { snStatus.textContent = "Microphone couldn't start — check mic permission for this site."; });
    });
    const rm = el('<button class="rm">✕</button>');
    rm.addEventListener('click', () => { if (confirm('Remove "' + sn.name + '" and its samples?')) { S.sounds.splice(idx, 1); save(); show('settings'); } });
    r.appendChild(rec); r.appendChild(rm);
    snlist.appendChild(r);
  });
  snlist.appendChild(snStatus);
  const snBox = snRow.querySelector('div:last-child');
  const snName = el('<input class="choice-input" style="margin-top:10px;" placeholder="The sound (e.g. Long hum)">');
  const snSay = el('<input class="choice-input" placeholder="What it means — spoken aloud (e.g. I want company)">');
  const snAdd = el('<button class="toggle-btn">＋ Add sound</button>');
  snAdd.addEventListener('click', () => {
    const name = snName.value.trim(), say = snSay.value.trim();
    if (!name || !say) { alert('Fill in the sound and what it means.'); return; }
    S.sounds.push({ name, say, samples: [] }); save(); show('settings');
  });
  snBox.appendChild(snName); snBox.appendChild(snSay); snBox.appendChild(snAdd);
  wrap.appendChild(snRow);

  /* tips */
  const tipsRow = el('<div class="set-row"><h3>Talking with him</h3><label>Short, practical tips from aphasia and palliative-care specialists.</label><div style="margin-top:10px;"></div></div>');
  const tipsBtn = el('<button class="toggle-btn">📖 Read the tips</button>');
  tipsBtn.addEventListener('click', () => show('tips'));
  tipsRow.querySelector('div:last-child').appendChild(tipsBtn);
  wrap.appendChild(tipsRow);

  /* backup & transfer */
  const bkRow = el('<div class="set-row"><h3>Back up &amp; copy to another device</h3><label>Saves everything on this device (photos, people, scenes, phrases, settings) to a file. Open the app on another device and import the file there to copy the whole setup across.</label><div style="margin-top:10px;"></div></div>');
  const bkBox = bkRow.querySelector('div:last-child');
  const expBtn = el('<button class="toggle-btn">⬇ Export backup</button>');
  expBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'talkboard-backup.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
  const impIn = el('<input type="file" accept="application/json,.json" style="display:none;">');
  const impBtn = el('<button class="toggle-btn">⬆ Import backup</button>');
  impBtn.addEventListener('click', () => impIn.click());
  impIn.addEventListener('change', () => {
    const f = impIn.files && impIn.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const data = JSON.parse(String(fr.result));
        if (typeof data !== 'object' || !data) throw new Error('bad');
        const okDataUrl = s => s == null || (typeof s === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s));
        if (Array.isArray(data.people)) data.people = data.people.filter(p => p && typeof p.name === 'string' && okDataUrl(p.photo));
        if (Array.isArray(data.scenes)) data.scenes = data.scenes.filter(sc => sc && typeof sc.name === 'string' && okDataUrl(sc.photo) && Array.isArray(sc.spots));
        if (!confirm('Replace everything on this device with the backup?')) return;
        S = Object.assign({}, DEFAULTS, data);
        save(); applyBtnSize(); show('settings');
        alert('Backup imported.');
      } catch (e) { alert("That file doesn't look like a Talk Board backup."); }
    };
    fr.readAsText(f);
  });
  bkBox.appendChild(expBtn); bkBox.appendChild(impBtn); bkBox.appendChild(impIn);
  wrap.appendChild(bkRow);

  /* recorded voice */
  const rvRow = el('<div class="set-row"><h3>His voice</h3><label>Natural recorded voice used for all board buttons. Tap one to hear it.</label><div></div></div>');
  const rvBox = rvRow.querySelector('div:last-child');
  REC_VOICES.forEach(([key, lbl]) => {
    const b = el('<button class="toggle-btn' + (S.recVoice === key ? ' on' : '') + '" style="display:block;width:100%;text-align:left;margin-right:0;">' + lbl + '</button>');
    b.addEventListener('click', () => {
      S.recVoice = key; save();
      speak('Hello, I love you all.');
      rvBox.querySelectorAll('.toggle-btn').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
    });
    rvBox.appendChild(b);
  });
  wrap.appendChild(rvRow);

  /* voice */
  const vRow = el('<div class="set-row"><h3>Typing voice</h3><label>Used only for typed text and custom choices (the board buttons use the recorded voice above). Tip: download "Karen (Premium)" on the iPad (Settings → Accessibility → Spoken Content → Voices) for a much better typing voice.</label><select id="voice-sel"></select><label>Speed</label><input type="range" id="rate" min="0.6" max="1.2" step="0.05"><div style="margin-top:10px;"></div></div>');
  const sel = vRow.querySelector('#voice-sel');
  sel.appendChild(el('<option value="">Automatic (Australian if available)</option>'));
  voices.filter(v => v.lang && v.lang.startsWith('en')).forEach(v => {
    const o = el('<option value="' + escapeHtml(v.voiceURI) + '">' + escapeHtml(v.name + ' (' + v.lang + ')') + '</option>');
    if (S.voiceURI === v.voiceURI) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => { S.voiceURI = sel.value || null; save(); speak('Hello, this is my voice.'); });
  const rate = vRow.querySelector('#rate');
  rate.value = S.rate;
  rate.addEventListener('change', () => { S.rate = parseFloat(rate.value); save(); speak('This is how fast I talk.'); });
  const test = el('<button class="toggle-btn">🔊 Test voice</button>');
  test.addEventListener('click', () => speak('Hello, I love you all.'));
  vRow.querySelector('div:last-child').appendChild(test);
  wrap.appendChild(vRow);

  /* real photos on his buttons */
  // Help / Move me / Sit me up / Wait have the weakest pictograms — a real photo helps those most
  const PHOTO_SLOTS = ['Drink', 'Toilet', 'Pain', 'COME HERE', 'Help', 'Move me', 'Sit me up', 'Wait', 'Hungry', 'Rest', 'Nurse', 'Coffee', 'Water', 'TV on', 'Blanket', 'My tablets'];
  const pbRow = el('<div class="set-row"><h3>Real photos on his buttons</h3><label>His recognition of REAL things outlasts symbols and words. Photograph HIS actual mug, HIS chair, the actual toilet door — one object, plain background, good light — and put it on the button. Photos stay on this device.</label><div id="pblist"></div></div>');
  const pblist = pbRow.querySelector('#pblist');
  PHOTO_SLOTS.forEach(lbl => {
    const cur = photoFor(lbl);
    const r = el('<div class="person-row">' + (cur ? '<img style="border-radius:10px;" src="' + cur + '">' : '<span style="font-size:32px;">🖼️</span>') + '<span class="nm">' + escapeHtml(lbl) + '</span></div>');
    const fi = el('<input type="file" accept="image/*" style="display:none;">');
    const add = el('<button class="toggle-btn" style="margin:0;">' + (cur ? 'Change' : 'Add photo') + '</button>');
    add.addEventListener('click', () => fi.click());
    fi.addEventListener('change', () => {
      const f = fi.files && fi.files[0];
      if (f) shrinkImage(f, d => { S.photoBtns[lbl] = d; save(); show('settings'); });
    });
    r.appendChild(add); r.appendChild(fi);
    if (cur) {
      const rm = el('<button class="rm">✕</button>');
      rm.addEventListener('click', () => { delete S.photoBtns[lbl]; save(); show('settings'); });
      r.appendChild(rm);
    }
    pblist.appendChild(r);
  });
  wrap.appendChild(pbRow);

  /* people */
  const pRow = el('<div class="set-row"><h3>People</h3><label>Add family and friends with a photo. Photos stay on this device only — nothing is uploaded.</label><div id="plist"></div></div>');
  const plist = pRow.querySelector('#plist');
  S.people.forEach((p, idx) => {
    const r = el('<div class="person-row">' + (p.photo ? '<img src="' + p.photo + '">' : '<span style="font-size:40px;">🙂</span>') + '<span class="nm">' + escapeHtml(p.name) + '</span></div>');
    const rm = el('<button class="rm">Remove</button>');
    rm.addEventListener('click', () => { if (confirm('Remove ' + p.name + '?')) { S.people.splice(idx, 1); save(); show('settings'); } });
    r.appendChild(rm);
    plist.appendChild(r);
  });
  const addWrap = el('<div style="margin-top:12px;"></div>');
  const nameIn = el('<input class="choice-input" placeholder="Name (e.g. David)">');
  const fileIn = el('<input type="file" accept="image/*" style="font-size:18px;margin-bottom:10px;">');
  const addBtn = el('<button class="toggle-btn">＋ Add person</button>');
  addBtn.addEventListener('click', () => {
    const name = nameIn.value.trim();
    if (!name) { alert('Type a name first'); return; }
    const f = fileIn.files && fileIn.files[0];
    if (f) {
      shrinkImage(f, dataUrl => { S.people.push({ name, photo: dataUrl }); save(); show('settings'); });
    } else {
      S.people.push({ name, photo: null }); save(); show('settings');
    }
  });
  addWrap.appendChild(nameIn); addWrap.appendChild(fileIn); addWrap.appendChild(addBtn);
  /* re-open the family-code unlock (e.g. after skipping it on first launch) */
  const unlockBtn = el('<button class="toggle-btn">🔐 Load family photos (code)</button>');
  unlockBtn.addEventListener('click', () => {
    fetch('./people.enc').then(r => { if (!r.ok) throw 0; return r.text(); })
      .then(t => { PEOPLE_ENC = t; show('unlock'); })
      .catch(() => alert('The photo bundle could not be loaded — are you online?'));
  });
  addWrap.appendChild(unlockBtn);
  /* one-tap people import: a JSON file of {people:[{name, photo}]} merges into the list
     (same-name entries are updated). Only people are touched — no other settings. */
  const ppIn = el('<input type="file" accept="application/json,.json" style="display:none;">');
  const ppBtn = el('<button class="toggle-btn">⬆ Import people file</button>');
  ppBtn.addEventListener('click', () => ppIn.click());
  ppIn.addEventListener('change', () => {
    const f = ppIn.files && ppIn.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        let data = JSON.parse(String(fr.result));
        const list = Array.isArray(data) ? data : data.people;
        if (!Array.isArray(list)) throw new Error('bad');
        const okDataUrl = s => s == null || (typeof s === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s));
        const clean = list.filter(p => p && typeof p.name === 'string' && p.name.trim() && okDataUrl(p.photo));
        if (!clean.length) throw new Error('empty');
        clean.forEach(p => {
          const i = S.people.findIndex(x => x.name.trim().toLowerCase() === p.name.trim().toLowerCase());
          if (i >= 0) S.people[i].photo = p.photo || S.people[i].photo;
          else S.people.push({ name: p.name.trim(), photo: p.photo || null });
        });
        save(); show('settings');
        alert(clean.length + ' people imported.');
      } catch (e) { alert("That file doesn't look like a people file."); }
    };
    fr.readAsText(f);
  });
  addWrap.appendChild(ppBtn); addWrap.appendChild(ppIn);
  pRow.appendChild(addWrap);
  wrap.appendChild(pRow);

  screenEl.appendChild(wrap);
};

/* ================= helpers ================= */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function shrinkImage(file, cb, max) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    max = max || 300;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    cb(c.toDataURL('image/jpeg', 0.75));
  };
  img.onerror = () => { URL.revokeObjectURL(url); alert('Could not read that photo — try another.'); };
  img.src = url;
}

/* ================= boot ================= */
const BTN_SIZES = { normal: '160px', big: '200px', huge: '250px' };
function applyBtnSize() {
  document.documentElement.style.setProperty('--tilemin', BTN_SIZES[S.btnSize] || BTN_SIZES.normal);
}
applyBtnSize();

function applyTheme() {
  document.documentElement.classList.toggle('force-dark', S.theme === 'dark');
  document.documentElement.classList.toggle('force-light', S.theme === 'light');
}
applyTheme();

function applyLayout() {
  document.documentElement.classList.toggle('one-col', S.layout === 'column');
}
applyLayout();

/* Keep the screen awake while the board is open, so he never faces a lock screen. */
let wakeLock = null;
async function keepAwake() {
  try {
    if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
  } catch (e) { /* not supported or low battery — fine */ }
}
keepAwake();
document.addEventListener('visibilitychange', () => { if (!document.hidden) keepAwake(); });

show(S.setupDone ? 'home' : 'setup');
/* first launch on this device: offer to unlock the built-in family photos */
if (!S.peopleLoaded) {
  fetch('./people.enc').then(r => { if (!r.ok) throw 0; return r.text(); })
    .then(t => { PEOPLE_ENC = t; show('unlock'); })
    .catch(() => {});
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
