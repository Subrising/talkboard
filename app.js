// @ts-check
'use strict';

/* ================= state ================= */
const DEFAULTS = {
  mode: 'full', rate: 0.9, voiceURI: null,
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
  btnSize: 'normal',
  choiceSets: [],
  recVoice: 'william',
  theme: 'auto',
  phrases: ['Please stay with me', 'I need a rest', 'Can you fix my pillow?'],
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
  const file = AUDIO_MAP[text];
  if (file) {
    try { speechSynthesis.cancel(); } catch (e) {}
    player.pause();
    player.src = './audio/' + (S.recVoice || 'william') + '/' + file;
    player.currentTime = 0;
    player.play().catch(() => speakTTS(text));
    return;
  }
  speakTTS(text);
}
function speakTTS(text) {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) u.voice = v;
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
function showBig(icon, text, speakText, photo, pic) {
  const now = Date.now();
  if (now - lastTapAt < 300) return;   // tremor / accidental double-tap guard
  lastTapAt = now;
  lastSpoken = speakText || text;
  if (text !== 'YES' && text !== 'NO') {
    S.recent = [{ em: icon, lbl: text, say: lastSpoken, img: pic || null, photo: photo || null }]
      .concat((S.recent || []).filter(r => r.say !== lastSpoken)).slice(0, 4);
    save();
  }
  if (photo) bigIcon.innerHTML = '<img class="face" src="' + photo + '" alt="">';
  else if (pic) bigIcon.innerHTML = '<img class="pic" src="' + pic + '" alt="">';
  else bigIcon.textContent = icon || '';
  bigTxt.textContent = text;
  bigNote.textContent = '';
  big.classList.add('show');
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
big.addEventListener('click', e => { if (e.target === big) big.classList.remove('show'); });

/* ================= top bar ================= */
document.getElementById('btn-yes').addEventListener('click', () => showBig('✓', 'YES', 'Yes'));
document.getElementById('btn-no').addEventListener('click', () => showBig('✗', 'NO', 'No'));
document.getElementById('btn-again').addEventListener('click', () => { if (lastSpoken) speak(lastSpoken); });
document.getElementById('btn-home').addEventListener('click', () => show('home'));
document.getElementById('gear').addEventListener('click', () => show('settings'));

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
  { em: '💊', img: I('medication'), lbl: 'Medication', say: 'I think I need my medication' },
  { em: '🛏️', img: I('move'),       lbl: 'Move me',    say: "Can you help me move? I'm uncomfortable" },
  { em: '🙇', img: I('situp'),      lbl: 'Sit me up',  say: 'Can you help me sit up?' },
  { em: '✋', img: I('stop'),       lbl: 'Stop — enough', say: "Stop please — I've had enough for now" },
  { em: '🥵', img: I('hot'),        lbl: 'Too hot',    say: "I'm too hot" },
  { em: '🥶', img: I('cold'),       lbl: 'Too cold',   say: "I'm cold" },
  { em: '🍽️', img: I('hungry'),     lbl: 'Hungry',     say: "I'm hungry" },
  { em: '😴', img: I('sleep'),      lbl: 'Rest',       say: "I'm tired. I need to rest" },
  { em: '👄', img: I('drymouth'),   lbl: 'Dry mouth',  say: 'My mouth is dry' },
  { em: '⚠️', img: I('wrong'),      lbl: "Something's wrong", say: 'Something is wrong. Please check on me' },
  { em: '❓', img: I('question'),   lbl: 'Something else', say: 'I need something — please ask me yes or no questions' },
];
const EVERYDAY = [
  { em: '🚰', img: I('water'),   lbl: 'Water',        say: 'Can I have some water?' },
  { em: '🍵', img: I('tea'),     lbl: 'Cup of tea',   say: "I'd like a cup of tea please" },
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
  { em: '⏳', img: I('wait'),    lbl: 'Wait a moment', say: 'Wait a moment please' },
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
  { em: '🚪', img: I('alone'),      lbl: 'Time alone',   say: "I'd like some time on my own for a bit" },
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
  { em: '🤍', lbl: 'Company — no need to talk', say: "I just want company — we don't need to talk" },
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
  { em: '👂', img: I('understand'), lbl: 'I can understand you', say: 'I can understand you' },
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
const PAIN_PARTS = [
  { em: '🤕', img: I('head'),     lbl: 'Head',   part: 'head' },
  { em: '👄', img: I('throat'),   lbl: 'Mouth / throat', part: 'mouth or throat' },
  { em: '🫁', img: I('chest'),    lbl: 'Chest',  part: 'chest' },
  { em: '🤢', img: I('tummy'),    lbl: 'Tummy',  part: 'tummy' },
  { em: '⬅️', img: I('backpain'), lbl: 'Back',   part: 'back' },
  { em: '💪', img: I('arm'),      lbl: 'Arms',   part: 'arm' },
  { em: '🦵', img: I('leg'),      lbl: 'Legs',   part: 'leg' },
  { em: '🧣', img: I('neck'),     lbl: 'Neck',   part: 'neck' },
  { em: '😖', img: I('pain'),     lbl: 'All over / not sure', part: null },
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
function tileVisual(item) {
  return item.img
    ? '<img class="pic" src="' + item.img + '" alt="" onerror="this.outerHTML=\'<div class=&quot;em&quot;>' + item.em + '</div>\'">'
    : '<div class="em">' + item.em + '</div>';
}
function tileBtn(item, cls) {
  const b = el('<button class="tile ' + (cls || '') + '">' + tileVisual(item) + '<div class="lbl">' + item.lbl + '</div></button>');
  b.addEventListener('click', () => showBig(item.em, item.lbl, item.say, null, item.img));
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

const SCREENS = {};
function show(name, arg) {
  screenEl.innerHTML = '';
  screenEl.scrollTop = 0;
  SCREENS[name](arg);
}

/* ---- home ---- */
function callTile(big) {
  const b = el('<button class="tile" style="background:var(--red-bg);color:var(--red);' + (big ? 'min-height:24vh;grid-column:1 / -1;' : '') + '">' + tileVisual({ em: '📣', img: I('call') }) + '<div class="lbl"' + (big ? ' style="font-size:clamp(30px,5vw,48px);"' : '') + '>COME HERE</div></button>');
  b.addEventListener('click', sendCall);
  return b;
}

SCREENS.home = () => {
  const g = el('<div class="grid big"></div>');
  const painItem = { em: '🤕', img: I('pain'), lbl: 'Pain' };
  if (S.mode === 'yesno') {
    g.style.gridTemplateColumns = 'repeat(2, 1fr)';
    const yes = el('<button class="tile" style="min-height:34vh;background:var(--green-bg);color:var(--green);"><div class="em">✓</div><div class="lbl" style="font-size:clamp(30px,5vw,48px);">YES</div></button>');
    yes.addEventListener('click', () => showBig('✓', 'YES', 'Yes'));
    const no = el('<button class="tile" style="min-height:34vh;background:var(--red-bg);color:var(--red);"><div class="em">✗</div><div class="lbl" style="font-size:clamp(30px,5vw,48px);">NO</div></button>');
    no.addEventListener('click', () => showBig('✗', 'NO', 'No'));
    const pain = el('<button class="tile warn" style="min-height:34vh;">' + tileVisual(painItem) + '<div class="lbl" style="font-size:clamp(30px,5vw,48px);">PAIN</div></button>');
    pain.addEventListener('click', () => showBig('🤕', 'PAIN', "I'm in pain", null, I('pain')));
    const need = el('<button class="tile" style="min-height:34vh;">' + tileVisual({ em: '❓', img: I('question') }) + '<div class="lbl" style="font-size:clamp(30px,5vw,48px);">I NEED SOMETHING</div></button>');
    need.addEventListener('click', () => showBig('❓', 'I need something', 'I need something — please ask me yes or no questions', null, I('question')));
    g.appendChild(yes); g.appendChild(no); g.appendChild(pain); g.appendChild(need);
    g.appendChild(callTile(true));
  } else if (S.mode === 'simple') {
    [NEEDS[0], NEEDS[1], NEEDS[2]].forEach(n => g.appendChild(tileBtn(n)));
    const pain = el('<button class="tile warn">' + tileVisual(painItem) + '<div class="lbl">Pain</div></button>');
    pain.addEventListener('click', () => showBig('🤕', 'PAIN', "I'm in pain", null, I('pain')));
    g.appendChild(pain);
    g.appendChild(tileBtn(NEEDS[11]));
    g.appendChild(tileBtn(FEELINGS[0]));
    g.appendChild(callTile(false));
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
    g.appendChild(navTile('❤️', 'From the heart', 'heart', 'c-heart'));
    g.appendChild(navTile('💬', 'Feelings', 'feelings', 'c-feel'));
    g.appendChild(navTile('👨‍👩‍👧', 'People', 'people', 'c-people'));
    if (S.scenes && S.scenes.length) g.appendChild(navTile('🖼️', 'My room', 'scenes', 'c-people'));
    g.appendChild(navTile('🔀', 'Choices', 'choices'));
    g.appendChild(navTile('⌨️', 'Type', 'talk'));
  }
  screenEl.appendChild(g);
};

/* ---- needs ---- */
SCREENS.needs = () => {
  screenEl.appendChild(titleRow('I need…', 'home'));
  const g = el('<div class="grid"></div>');
  NEEDS.forEach(n => g.appendChild(tileBtn(n, 'c-need')));
  screenEl.appendChild(g);
};

/* ---- everyday ---- */
SCREENS.everyday = () => {
  screenEl.appendChild(titleRow('Everyday', 'home'));
  const g = el('<div class="grid"></div>');
  EVERYDAY.forEach(n => g.appendChild(tileBtn(n, 'c-day')));
  screenEl.appendChild(g);
};

/* ---- sport / tv ---- */
SCREENS.sport = () => {
  screenEl.appendChild(titleRow('Sport / TV', 'home'));
  const g = el('<div class="grid"></div>');
  SPORT.forEach(n => g.appendChild(tileBtn(n, 'c-sport')));
  screenEl.appendChild(g);
};

/* ---- feelings ---- */
SCREENS.feelings = () => {
  screenEl.appendChild(titleRow('Feelings', 'home'));
  const g = el('<div class="grid"></div>');
  FEELINGS.forEach(f => g.appendChild(tileBtn(f, 'c-feel')));
  screenEl.appendChild(g);
};

/* ---- his own sayings ---- */
SCREENS.sayings = () => {
  screenEl.appendChild(titleRow('My sayings', 'home'));
  const g = el('<div class="grid"></div>');
  SAYINGS.forEach(s => g.appendChild(tileBtn(s, 'c-words')));
  screenEl.appendChild(g);
};

/* ---- from the heart ---- */
SCREENS.heart = () => {
  screenEl.appendChild(titleRow('From the heart', 'home'));
  const g = el('<div class="grid"></div>');
  HEART.forEach(h => g.appendChild(tileBtn(h, 'c-heart')));
  screenEl.appendChild(g);
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
SCREENS.choices = () => {
  screenEl.appendChild(titleRow('Set up a choice (family/carer)', 'home'));
  const wrap = el('<div style="max-width:640px;margin:0 auto;"></div>');
  wrap.appendChild(el('<div style="font-size:19px;color:var(--muted);margin-bottom:12px;">Type 2–4 options, tap <b>Show him the choices</b>, then hand over the screen.</div>'));
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
      c.addEventListener('click', () => show('choicesShow', set));
      recRow.appendChild(c);
    });
    wrap.appendChild(recRow);
  }
  const go = el('<button class="primary-btn">Show him the choices ›</button>');
  go.addEventListener('click', () => {
    const opts = inputs.map(i => i.value.trim()).filter(Boolean);
    if (opts.length >= 2) {
      const key = JSON.stringify(opts);
      S.choiceSets = [opts].concat((S.choiceSets || []).filter(s => JSON.stringify(s) !== key)).slice(0, 5);
      save();
      show('choicesShow', opts);
    }
  });
  wrap.appendChild(go);
  screenEl.appendChild(wrap);
};
SCREENS.choicesShow = (opts) => {
  screenEl.appendChild(titleRow('Tap what you want', 'choices'));
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

/* Keep the screen awake while the board is open, so he never faces a lock screen. */
let wakeLock = null;
async function keepAwake() {
  try {
    if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
  } catch (e) { /* not supported or low battery — fine */ }
}
keepAwake();
document.addEventListener('visibilitychange', () => { if (!document.hidden) keepAwake(); });

show('home');
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
