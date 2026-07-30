/* ============================================================
   Merged hero. The markup is already a complete, readable hero for
   English Marcus Aurelius with the portrait painted. This file only
   re-keys it (another language, another face) and adds the ignition,
   the shelf links and the audio control.

   Params, all optional, none of them affect a normal visit:
     ?lang=en|de   ?figure=<id>   ?t=<ms> freeze the choreography
     ?motion=still  ?entry=a|b  ?playing=1
   ============================================================ */
import { addHeardSeconds } from '../utils/listenedConversion';

(function () {
'use strict';

var P = new URLSearchParams(location.search);
var LANG = P.get('lang') || (document.documentElement.lang || 'en').slice(0, 2);
if (LANG !== 'de') LANG = 'en';
var DE = LANG === 'de';
document.documentElement.lang = LANG;

var FREEZE  = P.has('t') ? Number(P.get('t')) : null;
var STILL   = P.get('motion') === 'still' ||
              (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
var ENTRY   = P.get('entry') === 'b' ? 'b' : 'a';
var FAKEPLAY = P.get('playing') === '1';

var $ = function (id) { return document.getElementById(id); };
var CDN = 'https://media.agoracosmica.org';
var mhRoot = document.querySelector('.mh');
if (!mhRoot) return;
/* the figure-set revision, stamped by the component from the app manifest */
var REV = mhRoot.dataset.figrev ? '-' + mhRoot.dataset.figrev : '';
var main  = function (id, w) { return CDN + '/images/figures/' + id + '/main' + REV + '/' + w + '.webp'; };
var trail = function (id) {
  return CDN + '/trailers/figures/' + id + '/' + LANG + '/' + id + '_trailer_' + LANG + '.mp3';
};

/* ---------- the thirty ----------
   id, slug, name EN, name DE, tradition EN, tradition DE,
   promise EN, promise DE, question EN, question DE                       */
var RAW = [
['laozi','laozi','Laozi','Laozi','Taoism','Taoismus',
 'You will learn to act without forcing.','Du lernst, ohne Zwang zu handeln.',
 'I push and push and nothing moves. What would you do instead?',
 'Ich drücke und drücke, und nichts bewegt sich. Was würdest du tun?'],
['angelou','maya-angelou','Maya Angelou','Maya Angelou','Poetry and Civil Rights','Poesie und Bürgerrechte',
 'You will learn to find your own voice.','Du lernst, deine eigene Stimme zu finden.',
 'I go quiet where I should speak. How do I get my voice back?',
 'Wo ich reden sollte, werde ich still. Wie finde ich meine Stimme wieder?'],
['austen','jane-austen','Jane Austen','Jane Austen','Literary Realism','Literarischer Realismus',
 'You will learn to read what people do not say.','Du lernst, zu lesen, was Menschen nicht sagen.',
 'I never know if people actually like me or are just being polite.',
 'Ich weiß nie, ob Leute mich mögen oder einfach nur höflich sind.'],
['aurelius','marcus-aurelius','Marcus Aurelius','Mark Aurel','Stoicism','Stoizismus',
 'You will learn to question your first reaction.','Du lernst, deine erste Reaktion zu hinterfragen.',
 'How do I stop small annoyances from taking my whole day?',
 'Wie halte ich kleine Ärgernisse davon ab, mir den ganzen Tag zu nehmen?'],
['beauvoir','simone-de-beauvoir','Simone de Beauvoir','Simone de Beauvoir','Existentialist Feminism','Existentialistischer Feminismus',
 'You will learn to see how you were made.','Du lernst, zu erkennen, wie du gemacht wurdest.',
 'How much of what I want is actually mine?',
 'Wie viel von dem, was ich will, ist wirklich meins?'],
['bingen','hildegard-von-bingen','Hildegard von Bingen','Hildegard von Bingen','Christian Mysticism','Christliche Mystik',
 'You will learn to notice the life in things.','Du lernst, das Leben in den Dingen wahrzunehmen.',
 'I feel burned out. Does anything grow back after that?',
 'Ich fühle mich ausgebrannt. Wächst danach noch mal etwas?'],
['campbell','joseph-campbell','Joseph Campbell','Joseph Campbell','Comparative Mythology','Vergleichende Mythologie',
 'You will learn to read your own turning points.','Du lernst, deine eigenen Wendepunkte zu lesen.',
 'I am in the middle of a big change. What is this part called?',
 'Ich stecke mitten in einer großen Veränderung. Wie nennt man diesen Teil?'],
['zenji','dogen-zenji','Dōgen Zenji','Dōgen Zenji','Zen Buddhism','Zen-Buddhismus',
 'You will learn to stop chasing the next moment.','Du lernst, dem nächsten Augenblick nicht mehr nachzujagen.',
 'Most of my day is chores. Is that time just lost?',
 'Mein Tag besteht meistens aus Kleinkram. Ist diese Zeit verloren?'],
['dickinson','emily-dickinson','Emily Dickinson','Emily Dickinson','American Poetry','Amerikanische Poesie',
 'You will learn to tell the truth slant.','Du lernst, die Wahrheit schräg zu sagen.',
 'How do I say a hard thing without breaking the person who hears it?',
 'Wie sage ich etwas Schweres, ohne den zu zerbrechen, der es hört?'],
['einstein','albert-einstein','Albert Einstein','Albert Einstein','Theoretical Physics','Theoretische Physik',
 'You will learn to stay amazed.','Du lernst, das Staunen zu behalten.',
 'I used to be curious about everything. When did that stop?',
 'Früher war ich auf alles neugierig. Wann hat das aufgehört?'],
['eckhart','meister-eckhart','Meister Eckhart','Meister Eckhart','Christian Mysticism','Christliche Mystik',
 'You will learn to love without a why.','Du lernst, ohne Warum zu lieben.',
 'I hold on too tight to the people I love. How do I loosen it?',
 'Ich halte die Menschen, die ich liebe, zu fest. Wie lasse ich locker?'],
['galilei','galileo-galilei','Galileo Galilei','Galileo Galilei','Natural Philosophy','Naturphilosophie',
 'You will learn to test what you are told.','Du lernst, zu prüfen, was man dir sagt.',
 'Everyone around me is sure. How do I check for myself?',
 'Alle um mich herum sind sich sicher. Wie prüfe ich es selbst?'],
['gandhi','mahatma-gandhi','Mohandas Gandhi','Mohandas Gandhi','Nonviolent Resistance','Gewaltloser Widerstand',
 'You will learn to stay willing to be wrong.','Du lernst, für den eigenen Irrtum offen zu bleiben.',
 'How do I argue with someone without needing to win?',
 'Wie streite ich mit jemandem, ohne gewinnen zu müssen?'],
['goethe','johann-wolfgang-von-goethe','Johann Wolfgang von Goethe','Johann Wolfgang von Goethe','German Classicism','Weimarer Klassik',
 'You will learn to stay with one thing.','Du lernst, bei einer Sache zu bleiben.',
 'I read a lot and understand little. What am I doing wrong?',
 'Ich lese viel und verstehe wenig. Was mache ich falsch?'],
['gautama','siddhartha-gautama','Siddhartha Gautama','Siddhartha Gautama','Buddhism','Buddhismus',
 'You will learn to watch wanting rise and fade.','Du lernst, das Verlangen kommen und gehen zu sehen.',
 'My life is good and I still feel unsatisfied. What is wrong with me?',
 'Mir geht es gut, und trotzdem fehlt etwas. Was stimmt nicht mit mir?'],
['jung','carl-gustav-jung','Carl Gustav Jung','Carl Gustav Jung','Depth Psychology','Tiefenpsychologie',
 'You will learn to meet your own shadow.','Du lernst, deinem eigenen Schatten zu begegnen.',
 'Why does one particular person get under my skin so fast?',
 'Warum geht mir ausgerechnet ein Mensch so schnell unter die Haut?'],
['kahlo','frida-kahlo','Frida Kahlo','Frida Kahlo','Art and Identity','Kunst und Identität',
 'You will learn to look at yourself without flinching.','Du lernst, dich selbst anzusehen, ohne zurückzuschrecken.',
 'How do I make something out of pain without pretending it is fine?',
 'Wie mache ich aus Schmerz etwas, ohne so zu tun, als wäre alles gut?'],
['king','martin-luther-king-jr','Martin Luther King Jr.','Martin Luther King Jr.','Civil Rights and Theology','Bürgerrechte und Theologie',
 'You will learn to hold on when nothing moves yet.','Du lernst, dranzubleiben, wenn sich noch nichts bewegt.',
 'How do I keep going when nothing I do seems to matter?',
 'Wie mache ich weiter, wenn nichts von dem, was ich tue, etwas ändert?'],
['lovelace','ada-lovelace','Ada Lovelace','Ada Lovelace','Mathematics and Computing','Mathematik und Computing',
 'You will learn where the machine stops and you begin.','Du lernst, wo die Maschine aufhört und du anfängst.',
 'They say a machine will do my job. Could it do the part that is mine?',
 'Angeblich macht bald eine Maschine meinen Job. Auch den Teil, der wirklich meiner ist?'],
['mandela','nelson-mandela','Nelson Mandela','Nelson Mandela','Ubuntu and Liberation','Ubuntu und Befreiung',
 'You will learn to free yourself from bitterness.','Du lernst, dich von Bitterkeit zu befreien.',
 'Someone took years from me. How do I stop carrying it?',
 'Jemand hat mir Jahre genommen. Wie höre ich auf, das zu tragen?'],
['mozart','wolfgang-amadeus-mozart','Wolfgang Amadeus Mozart','Wolfgang Amadeus Mozart','Classical Music','Klassische Musik',
 'You will learn to find freedom inside the rules.','Du lernst, Freiheit in den Regeln zu finden.',
 'When did the thing I loved doing turn into work?',
 'Wann ist das, was ich geliebt habe, zu Arbeit geworden?'],
['blake','william-blake','William Blake','William Blake','Visionary Poetry','Visionäre Poesie',
 'You will learn to hold your opposites together.','Du lernst, deine Gegensätze zusammenzuhalten.',
 'Two parts of me want opposite things. Do I have to give one up?',
 'Zwei Seiten in mir wollen genau das Gegenteil. Muss ich eine aufgeben?'],
['nietzsche','friedrich-nietzsche','Friedrich Nietzsche','Friedrich Nietzsche','Existential Philosophy','Existenzphilosophie',
 'You will learn to build your own meaning.','Du lernst, deinen eigenen Sinn zu bauen.',
 'Nothing I was handed to believe holds. What now?',
 'Nichts, was man mir zu glauben gab, trägt noch. Was jetzt?'],
['plato','plato','Plato','Platon','Classical Philosophy','Klassische Philosophie',
 'You will learn to examine your own life.','Du lernst, dein eigenes Leben zu prüfen.',
 'How do I know if I actually believe what I say I believe?',
 'Woher weiß ich, ob ich wirklich glaube, was ich zu glauben sage?'],
['rumi','rumi','Rumi','Rumi','Sufi Mysticism','Sufi-Mystik',
 'You will learn to let your longing guide you.','Du lernst, dich von deiner Sehnsucht führen zu lassen.',
 'I miss something I cannot name. What is it?',
 'Mir fehlt etwas, das ich nicht benennen kann. Was ist es?'],
['schopenhauer','arthur-schopenhauer','Arthur Schopenhauer','Arthur Schopenhauer','Philosophy of Will','Willensphilosophie',
 'You will learn to look behind your own restlessness.','Du lernst, hinter deine eigene Unruhe zu schauen.',
 'Why is the satisfaction always shorter than the wanting?',
 'Warum ist die Zufriedenheit immer kürzer als das Wollen?'],
['shakespeare','william-shakespeare','William Shakespeare','William Shakespeare','Renaissance Drama','Renaissance-Drama',
 'You will learn to use what you saw too late.','Du lernst zu nutzen, was du zu spät gesehen hast.',
 'I saw it clearly only after it was over. What good is that?',
 'Ich habe es erst verstanden, als es vorbei war. Was nützt mir das?'],
['woolf','virginia-woolf','Virginia Woolf','Virginia Woolf','Modernist Literature','Modernistische Literatur',
 'You will learn to defend the hour that is yours.','Du lernst, die Stunde zu verteidigen, die dir gehört.',
 'I never get an hour that is really mine. Does that matter?',
 'Ich habe nie eine Stunde, die wirklich mir gehört. Ist das schlimm?'],
['tubman','harriet-tubman','Harriet Tubman','Harriet Tubman','Liberation and Faith','Befreiung und Glaube',
 'You will learn to act before fear stops you.','Du lernst, zu handeln, bevor die Angst dich aufhält.',
 'I know what I have to do and I keep not doing it. How do you move?',
 'Ich weiß, was ich tun muss, und tue es doch nicht. Wie kommst du in Bewegung?'],
['vinci','leonardo-da-vinci','Leonardo da Vinci','Leonardo da Vinci','Renaissance Polymath','Renaissance-Universalgelehrter',
 'You will learn to connect what looks unrelated.','Du lernst zu verbinden, was nicht zusammengehört.',
 'I am curious about everything and finish nothing. Is that a flaw?',
 'Ich interessiere mich für alles und bringe nichts zu Ende. Ist das ein Fehler?']
];

var FEM = { angelou:1, austen:1, beauvoir:1, bingen:1, dickinson:1, kahlo:1,
            lovelace:1, woolf:1, tubman:1 };

/* Horizontal focal point for the phone's full-bleed crop, in percent. Cover
   trims the sides there, so a face that does not sit mid-canvas needs its own
   x. Audited across all thirty at 390 wide; anything absent is centred. */
var FOCAL = { laozi:27, campbell:36, zenji:40, goethe:40, jung:40,
              eckhart:42, kahlo:42, angelou:43, einstein:44, gandhi:46,
              shakespeare:53, blake:55, vinci:55, austen:57, galilei:58,
              king:58, bingen:64, nietzsche:64, rumi:68, mozart:85 };

var F = RAW.map(function (a) {
  return { id:a[0], slug:a[1], name: DE ? a[3] : a[2], trad: DE ? a[5] : a[4],
           promise: DE ? a[7] : a[6], q: DE ? a[9] : a[8], fem: !!FEM[a[0]] };
});
var byId = {}; F.forEach(function (f) { byId[f.id] = f; });

var T = DE ? {
  tagline:'Eine lebendige Bibliothek, mit der du sprechen kannst',
  eyebrow:'Stimmen aus der ganzen Geschichte',
  h1:'Eine lebendige Bibliothek, <i>mit der du sprechen kannst</i>',
  sub:'Lerne von 30 bemerkenswerten Menschen, von Mark Aurel bis Frida Kahlo.',
  play:'Das Echo hören', playing:'Läuft',
  qkickM:'Wohin sein Weg führt', qkickF:'Wohin ihr Weg führt',
  chapKickM:'Sein erstes Kapitel', chapKickF:'Ihr erstes Kapitel',
  chap:'Eine Lehre, als Geschichte erzählt. Kapitel eins anhören',
  askLbl:'Deine erste Frage',
  free:'30 kostenlose Nachrichten pro Tag. Ohne Anmeldung.',
  disc:'Ein Echo, keine Aufnahme. Gemalt, nicht fotografiert.',
  trust:'Gemeinnützig · Open Source · Keine Tracking-Cookies, kein Profiling',
  shelf:'Dreißig Leben. Wähle ein Gesicht.',
  entryA:'Alle dreißig ansehen', entryAshort:'Alle 30', entryB:'Einfach loslegen →',
  beats:['Hören','Fragen','Debatten','Wege'],
  below:'Jedes Leben geht unten weiter. Kapitel zum Hören, Ideen zum Durcharbeiten, vier Stimmen im Streitgespräch und ein eigener Weg.',
  nav:['Menschen','Themen','Über uns'], navCta:'Jetzt entdecken', navLang:'EN',
  figuresHref:'/de/figures/'
} : {
  tagline:'A Living Library You Can Talk To',
  eyebrow:'Voices from across history',
  h1:'A Living Library <i>You Can Talk To</i>',
  sub:"Learn from 30 of history's remarkable people, Marcus Aurelius to Frida Kahlo.",
  play:'Hear the Echo', playing:'Playing',
  qkickM:'Where his path leads', qkickF:'Where her path leads',
  chapKickM:'His first chapter', chapKickF:'Her first chapter',
  chap:'A teaching, told as a story. Play chapter one',
  askLbl:'Your first question',
  free:'30 free messages a day. No signup needed.',
  disc:'An Echo, not a recording. Painted, not photographed.',
  trust:'Nonprofit · Open Source · No tracking cookies, no profiling',
  shelf:'Thirty lives. Pick a face.',
  entryA:'Meet all thirty', entryAshort:'All 30', entryB:'Start exploring →',
  beats:['Listen','Ask','Councils','Paths'],
  below:'Every life goes on below. Chapters to hear, ideas to work through, four voices in debate, and a path of your own.',
  nav:['Figures','Themes','About'], navCta:'Start Exploring', navLang:'DE',
  figuresHref:'/figures/'
};

/* ---------- language ----------
   page.html drops the standalone file's mock header and scroll strip, so every
   write is a no-op when the element is not on this page. */
function txt(id, v) { var el = $(id); if (el) el.textContent = v; }
function html(id, v) { var el = $(id); if (el) el.innerHTML = v; }

if (DE) {
  txt('barTag', T.tagline);
  txt('navFig', T.nav[0]); txt('navThemes', T.nav[1]); txt('navAbout', T.nav[2]);
  txt('navCta', T.navCta);
  if ($('navLang')) { $('navLang').textContent = T.navLang; $('navLang').href = '?lang=en'; }
  txt('eyebrow', T.eyebrow);
  html('h1', T.h1);
  txt('sub', T.sub);
  txt('playLbl', T.play);
  txt('chapTxt', T.chap);
  txt('askLbl', T.askLbl);
  txt('free', T.free);
  txt('discl', T.disc);
  txt('trust', T.trust);
  txt('shelfLbl', T.shelf);
  txt('belowP', T.below);
  T.beats.forEach(function (b, i) { txt('b' + (i + 1), b); });
}
txt('entryAlong', T.entryA);
txt('entryAshort', T.entryAshort);
$('entryA').href = T.figuresHref;
txt('entryB', T.entryB);
/* one quiet echo of the general entry, never two */
if (ENTRY === 'b') { $('entryA').hidden = true; $('entryB').hidden = false; }

/* ---------- the shelf: real links, intercepted ----------
   The thirty anchors are in the markup, so a crawler and a no-script visitor get
   thirty honest links to the figure pages. Script only takes the click over and
   re-keys the hero in place. */
var rail = $('rail');
[].forEach.call(rail.children, function (a) {
  var id = a.dataset.id, f = byId[id];
  if (!f) return;
  a.href = (DE ? '/de/figures/' : '/figures/') + f.slug + '/';
  a.setAttribute('aria-label', f.name);
  a.title = f.name;
  a.addEventListener('click', function (e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    select(id, true);
  });
});

/* ---------- painting the current figure ---------- */
var shot = $('shot'), au = $('au'), cur = byId[P.get('figure')] ? P.get('figure') : 'aurelius';

function paint(id) {
  var f = byId[id]; cur = id;
  $('nm').textContent = f.name;
  $('tr').textContent = f.trad;
  $('qkick').textContent = f.fem ? T.qkickF : T.qkickM;
  /* the tag names THIS figure's question, so the app prefills what was clicked */
  askEl.href = '/app?figure=' + f.slug + '&lang=' + LANG + '&ask=f:' + f.id + ':1';
  askEl.setAttribute('data-agc-figure', id);
  $('chapKick').textContent = f.fem ? T.chapKickF : T.chapKickM;
  chapEl.href = '/app?figure=' + f.slug + '&lang=' + LANG + '&mode=story&chapter=1';
  chapEl.setAttribute('data-agc-figure', id);
  $('promise').innerHTML = '<em>' + f.promise + '</em>';
  words($('q'), f.q);
  shot.alt = '';
  shot.style.setProperty('--focal', (FOCAL[id] || 50) + '%');
  [].forEach.call(rail.children, function (a) {
    if (a.dataset.id === id) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
  stopAudio();
}

/* ============================================================
   THE IGNITION. One choreography, two beats, then clean air.

   Beat one, the face (~2.2s). The painting is handed to the motion layer.
   Thousands of grains, each carrying the colour of the pixel it belongs to,
   drift in out of the night and condense onto their cells. The eyes land
   first, the shoulders follow. As the face resolves the real painting rises
   underneath and the dust hands it back. The reading column never waits: every
   word of the hero is in the markup and legible at t=0.

   Beat two, the question (~1.3s). A thin stream of the same gold lifts off the
   settled face, sweeps into the lit spine, runs down it past the beats and
   splashes into the question card. The question is written in its wake.

   Then the canvas is cleared and the loop stops. Nothing floats afterward.

   No script, or reduced motion: the painting is present and the question is
   written from the first byte. Nothing is ever hidden from a crawler.
   ============================================================ */
var heroEl = document.querySelector('.hero');
var cv = $('dust'), ctx = cv.getContext('2d');
var W = 0, H = 0, DPR = 1;
var face = [], stream = [], raf = 0, t0 = 0, running = false;
var qWords = [], askEl = $('ask'), chapEl = $('chapDoor'), askLi = askEl.closest('li');
var seed = 20260728;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }

/* the two beats, in ms */
var FLY     = 1150,               /* how long one grain travels */
    SPREAD  = 880,                /* how far apart the grains are released */
    CROSS_A = 1250, CROSS_B = 2100,   /* the painting takes the face back */
    FADE_A  = 1560, FADE_B  = 2300,   /* the dust lets it go */
    Q_AT    = 2200,               /* beat two opens, after the face has landed */
    Q_SPREAD = 560, Q_FLY = [520, 840],
    FACE_OUT = FADE_B + 60,       /* the dust has handed the whole face back */
    END     = Q_AT + Q_SPREAD + Q_FLY[1] + 120;   /* 3720 */

/* The two beats can run apart. Beat one belongs to the arrival and always plays
   at once. Beat two belongs to the question, so while that card is off screen
   the words stay unlit and the stream waits there; when the reader reaches it,
   the stream is rebuilt against the layout as it stands and runs. */
var qAt = Q_AT,                   /* when beat two opens on this run */
    stopAt = END,                 /* where the running timeline ends */
    qParked = false,              /* beat two is waiting for its card */
    qDue = false,                 /* it came into view mid-beat-one */
    qWatching = false;

var GOLD = [236, 198, 116], GOLDCSS = 'rgb(236,198,116)';
function ease(x) { return 1 - Math.pow(1 - x, 3); }
function sstep(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

/* The question is one <w> per word, so the words can arrive one at a time.
   The markup ships plain text: this only re-wraps what is already there. */
function words(el, text) {
  el.textContent = '';
  qWords = [];
  text.split(/(\s+)/).forEach(function (part) {
    if (!part) return;
    if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(part)); return; }
    var w = document.createElement('w');
    w.textContent = part;
    el.appendChild(w);
    qWords.push(w);
  });
}

function boxOf(el) {
  var h = heroEl.getBoundingClientRect(), b = el.getBoundingClientRect();
  return { x: b.left - h.left, y: b.top - h.top, w: b.width, h: b.height };
}

function sizeCanvas() {
  var r = heroEl.getBoundingClientRect();
  W = r.width; H = r.height;
  DPR = Math.min(window.devicePixelRatio || 1, W < 900 ? 2 : 1.75);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

/* Sample the painting the way the browser draws it: cover, at whatever
   object-position is live (the plate anchors to the top, the phone's full-bleed
   stage carries a per-figure focal point).
   The grid is what beat one condenses into and what beat two lifts off. */
function objectPos() {
  var v = (getComputedStyle(shot).objectPosition || '50% 0%').split(/\s+/);
  var x = parseFloat(v[0]) / 100, y = parseFloat(v[1]) / 100;
  return { x: isFinite(x) ? x : 0.5, y: isFinite(y) ? y : 0 };
}

function sampleFace() {
  var m = boxOf(heroEl.querySelector('.mat'));
  if (!m.w || !m.h || !shot.complete || !shot.naturalWidth) return null;
  var iw = shot.naturalWidth, ih = shot.naturalHeight;
  var s = Math.max(m.w / iw, m.h / ih);
  var op = objectPos();
  var dx = m.x + (m.w - iw * s) * op.x, dy = m.y + (m.h - ih * s) * op.y;
  var budget = W < 900 ? 3600 : 7200;
  var aspect = m.h / m.w;
  var cols = Math.max(20, Math.round(Math.sqrt(budget / aspect)));
  var rows = Math.max(20, Math.round(cols * aspect));
  var off = document.createElement('canvas');
  off.width = cols; off.height = rows;
  var o = off.getContext('2d', { willReadFrequently: true });
  var data = null;
  try {
    o.drawImage(shot, (m.x - dx) / s, (m.y - dy) / s, m.w / s, m.h / s, 0, 0, cols, rows);
    data = o.getImageData(0, 0, cols, rows).data;
  } catch (e) { data = null; }   /* a tainted canvas still gets gold, just not colour */
  return { m: m, cols: cols, rows: rows, data: data,
           /* every one of the thirty paintings sits the eyes near 50% / 27.5% */
           eyeX: dx + iw * s * 0.5, eyeY: dy + ih * s * 0.275 };
}

function buildFace(g) {
  var m = g.m, cw = m.w / g.cols, ch = m.h / g.rows, small = W < 900;
  var faceR = m.w * 0.52;                       /* the eyes lead, the rest follows */
  var oy1 = Math.min(H, m.y + m.h + 240);
  var out = [];
  for (var j = 0; j < g.rows; j++) {
    for (var i = 0; i < g.cols; i++) {
      var gx = m.x + i * cw + cw / 2, gy = m.y + j * ch + ch / 2;
      var d = Math.hypot(gx - g.eyeX, gy - g.eyeY) / faceR;
      /* density falls away from the face, so the head reads before the ground */
      if (rnd() > Math.min(1, Math.max(0.15, 1.20 - Math.min(d, 2.4) * 0.42))) continue;
      var r = 214, gg = 168, b = 64;
      if (g.data) { var k = (j * g.cols + i) * 4; r = g.data[k]; gg = g.data[k + 1]; b = g.data[k + 2]; }
      var p = {
        /* sub-cell jitter kills the lattice: dust, not a mosaic */
        tx: gx + (rnd() - 0.5) * cw * 1.2, ty: gy + (rnd() - 0.5) * ch * 1.2,
        r: r, g: gg, b: b, lum: (r * 0.3 + gg * 0.59 + b * 0.11) / 255,
        sz: Math.max(cw, ch) * (small ? 0.80 + rnd() * 0.60 : 0.84 + rnd() * 0.76),
        dl: Math.pow(Math.min(d, 1), 1.25) * SPREAD + rnd() * 190,
        ph: rnd() * 6.283, ox: 0, oy: 0
      };
      /* it starts scattered across the night, pulled a little toward where it belongs */
      p.ox = (rnd() * W * 1.04 - W * 0.02) * 0.86 + p.tx * 0.14;
      p.oy = (-30 + rnd() * (oy1 + 30)) * 0.86 + p.ty * 0.14;
      out.push(p);
    }
  }
  face = out;
}

function pickIdx(cum, total) {
  var r = rnd() * total, lo = 0, hi = cum.length - 1;
  while (lo < hi) { var mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
  return lo;
}

/* Beat two. The stream leaves the lit planes of the face, is bent into the
   spine by its first control point, runs down the spine on its second, and
   lands on the words of the question. */
function buildStream(g) {
  stream = [];
  var hr = heroEl.getBoundingClientRect(), qEl = $('q');
  var lines = [], rl = qEl.getClientRects();
  for (var i = 0; i < rl.length; i++) {
    if (rl[i].width < 4 || rl[i].height < 4) continue;
    lines.push({ x: rl[i].left - hr.left, y: rl[i].top - hr.top, w: rl[i].width, h: rl[i].height });
  }
  if (!lines.length) lines.push(boxOf(qEl));
  var beats = boxOf(heroEl.querySelector('.beats'));
  var spineX = beats.x + 5;                       /* the gold hairline itself */
  var spineTop = beats.y + 12;
  var ask = boxOf(askEl);

  var pool = [], cum = [], acc = 0, m = g.m;
  if (g.data) {
    var cw = m.w / g.cols, ch = m.h / g.rows;
    for (var j = 0; j < g.rows; j++) {
      for (var i2 = 0; i2 < g.cols; i2++) {
        var k = (j * g.cols + i2) * 4;
        var r = g.data[k], gg = g.data[k + 1], b = g.data[k + 2];
        var lum = (r * 0.3 + gg * 0.59 + b * 0.11) / 255;
        if (lum < 0.30) continue;                 /* only the lit planes give gold */
        var x = m.x + (i2 + 0.5) * cw, y = m.y + (j + 0.5) * ch;
        var u = (x - g.eyeX) / (m.w * 0.34), v = (y - g.eyeY) / (m.h * 0.30);
        var w = Math.pow(lum, 1.5) * (0.14 + Math.exp(-(u * u + v * v)));
        if (w < 0.10) continue;
        pool.push({ x: x, y: y, r: r, g: gg, b: b, lum: lum });
        acc += w; cum.push(acc);
      }
    }
  }
  var N = W < 900 ? 240 : 460;                    /* a thin stream, not a second show */
  for (var n = 0; n < N; n++) {
    var c = pool.length ? pool[pickIdx(cum, acc)] : null;
    var sx = c ? c.x + (rnd() - 0.5) * 7 : m.x + m.w * 0.5 + (rnd() - 0.5) * m.w * 0.5;
    var sy = c ? c.y + (rnd() - 0.5) * 7 : m.y + m.h * 0.35 + (rnd() - 0.5) * m.h * 0.4;
    var ln = lines[(rnd() * lines.length) | 0];
    /* land toward the start of the line, so the words fill in reading order */
    var tx = ln.x + Math.pow(rnd(), 1.3) * ln.w;
    var ty = ln.y + rnd() * ln.h;
    stream.push({
      sx: sx, sy: sy, tx: tx, ty: ty,
      /* the first control point sits close to the spine, so the stream is bent
         into the reading column early and runs DOWN it rather than cutting
         across the middle of the hero */
      c1x: spineX + (sx - spineX) * (0.09 + rnd() * 0.13), c1y: spineTop + rnd() * 74,
      c2x: spineX + 4 + (rnd() - 0.35) * 26, c2y: ask.y - 34 + rnd() * 46,
      del: Math.pow(rnd(), 0.9) * Q_SPREAD,
      dur: Q_FLY[0] + rnd() * (Q_FLY[1] - Q_FLY[0]),
      s: 0.62 + rnd() * 1.5,
      r: c ? c.r : GOLD[0], g: c ? c.g : GOLD[1], b: c ? c.b : GOLD[2],
      lum: c ? c.lum : 0.7
    });
  }
}

function drawFace(tt) {
  var rest = sstep(FADE_A, FADE_B, tt);
  if (rest >= 1) return;
  /* the dust is already in the air on the first frame: the mat is never empty */
  var born = 0.34 + 0.66 * sstep(0, 320, tt), goldOn = false;
  for (var i = 0; i < face.length; i++) {
    var p = face[i];
    var raw = Math.min(1, Math.max(0, (tt - p.dl) / FLY));
    var e = ease(raw), n = 1 - e;
    var x = p.ox + (p.tx - p.ox) * e, y = p.oy + (p.ty - p.oy) * e;
    if (e < 1) {
      x += Math.sin(tt * 0.00085 + p.ph) * n * 18;
      y += Math.cos(tt * 0.00070 + p.ph * 1.7) * n * 15;
    }
    var rad = (2.0 + (p.sz * 0.5 - 2.0) * sstep(0.35, 1, e)) * (1 - rest);
    if (rad <= 0.06) continue;
    var al = born * (0.50 + 0.34 * e) * (1 - rest) *
             (e < 1 ? (0.74 + 0.26 * Math.sin(tt * 0.002 + p.ph * 7)) : 1);
    if (al <= 0.005) continue;
    ctx.globalAlpha = Math.min(1, al);
    /* gold on the way in, the painting's own colour once it lands */
    var k = sstep(0.40, 0.98, e);
    if (k < 0.05) { if (!goldOn) { ctx.fillStyle = GOLDCSS; goldOn = true; } }
    else {
      goldOn = false;
      ctx.fillStyle = 'rgb(' + ((GOLD[0] + (p.r - GOLD[0]) * k) | 0) + ',' +
                               ((GOLD[1] + (p.g - GOLD[1]) * k) | 0) + ',' +
                               ((GOLD[2] + (p.b - GOLD[2]) * k) | 0) + ')';
    }
    ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.283); ctx.fill();
  }
}

function drawStream(tt) {
  var t = tt - qAt;
  if (t <= 0) return;
  for (var i = 0; i < stream.length; i++) {
    var m = stream[i];
    var p = (t - m.del) / m.dur;
    if (p <= 0 || p >= 1) continue;
    var e = ease(p), n = 1 - e;
    var x = n * n * n * m.sx + 3 * n * n * e * m.c1x + 3 * n * e * e * m.c2x + e * e * e * m.tx;
    var y = n * n * n * m.sy + 3 * n * n * e * m.c1y + 3 * n * e * e * m.c2y + e * e * e * m.ty;
    /* born on the paint, spent as it becomes a word */
    var a = Math.min(1, p * 5) * (1 - Math.pow(p, 2.6)) * (0.50 + m.lum * 0.55);
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = 'rgb(' + ((m.r * 0.28 + GOLD[0] * 0.72) | 0) + ',' +
                             ((m.g * 0.28 + GOLD[1] * 0.72) | 0) + ',' +
                             ((m.b * 0.32 + GOLD[2] * 0.68) | 0) + ')';
    ctx.beginPath(); ctx.arc(x, y, m.s * (1 + n * 0.55), 0, 6.283); ctx.fill();
  }
}

/* what the two beats do to the page itself */
function reveal(tt) {
  shot.style.opacity = sstep(CROSS_A, CROSS_B, tt);
  var frac = Math.min(1, Math.max(0, (tt - qAt - 60) / (Q_SPREAD + Q_FLY[0])));
  var upto = Math.round(frac * (qWords.length + 1.2));
  for (var i = 0; i < qWords.length; i++) qWords[i].classList.toggle('in', i < upto);
  askEl.classList.toggle('cool', frac < 0.5);
  if (askLi) askLi.classList.toggle('dim', frac < 0.3);
}

function renderAt(tt) {
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  drawFace(tt);
  drawStream(tt);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  reveal(tt);
}

function loop(ts) {
  if (!t0) t0 = ts;
  var tt = ts - t0;
  if (tt >= stopAt) {
    ctx.clearRect(0, 0, W, H); running = false; raf = 0;
    if (!qParked) { arrive(); return; }
    faceArrived();
    if (qDue) { qDue = false; runQuestion(); }
    return;
  }
  renderAt(tt);
  raf = requestAnimationFrame(loop);
}

/* the resolved state: the painting present, the question written */
function arrive() {
  for (var i = 0; i < qWords.length; i++) qWords[i].classList.add('in');
  askEl.classList.remove('cool');
  if (askLi) askLi.classList.remove('dim');
  qParked = false;
  shot.classList.remove('gone');
  shot.style.transition = '';
  shot.style.opacity = '';
  document.documentElement.classList.remove('settling');
}

/* beat one is resolved: the painting is present, the question still waits.
   The root keeps its marker, which is what holds the words unlit. */
function faceArrived() {
  shot.classList.remove('gone');
  shot.style.transition = '';
  shot.style.opacity = '1';
}

function inView(el, frac) {
  var r = el.getBoundingClientRect(), vh = window.innerHeight || 1;
  var vis = Math.min(r.bottom, vh) - Math.max(r.top, 0);
  return vis >= Math.min(r.height, vh) * frac;
}

/* beat two, once, when the card the stream writes is actually on screen */
function watchQuestion() {
  if (qWatching) return;
  qWatching = true;
  var io = new IntersectionObserver(function (e) {
    if (!e[0].isIntersecting) return;
    io.disconnect();
    qWatching = false;
    if (running) { qDue = true; return; }
    runQuestion();
  }, { threshold: 0.55 });
  io.observe(askEl);
}

function runQuestion() {
  if (!qParked) return;
  if (STILL) { arrive(); return; }
  sizeCanvas();
  var g = sampleFace();
  if (!g) { arrive(); return; }
  buildStream(g);
  qParked = false;
  qAt = FACE_OUT;                        /* it opens the moment it starts */
  stopAt = qAt + Q_SPREAD + Q_FLY[1] + 120;
  cancelAnimationFrame(raf);
  running = true;
  raf = requestAnimationFrame(function (ts) { t0 = ts - qAt; loop(ts); });
}

function ignite() {
  if (STILL) { arrive(); return; }
  if (!shot.complete || !shot.naturalWidth) {
    shot.addEventListener('load', ignite, { once: true });
    return;
  }
  document.documentElement.classList.add('settling');
  sizeCanvas();
  var g = sampleFace();
  if (!g) { arrive(); return; }
  buildFace(g);
  qParked = FREEZE === null && 'IntersectionObserver' in window &&
            !inView(askEl, 0.55);
  qDue = false;
  /* parked, beat two's clock sits at the end of beat one, so not a word of the
     question is written and no grain is released until the reader arrives */
  qAt = qParked ? FACE_OUT : Q_AT;
  stopAt = qParked ? FACE_OUT : END;
  if (!qParked) buildStream(g);
  shot.classList.remove('gone');
  shot.style.transition = 'none';
  shot.style.opacity = '0';
  if (FREEZE !== null) {                 /* a designed still, for the bench frames */
    if (FREEZE >= END) { arrive(); return; }
    renderAt(FREEZE);
    return;
  }
  cancelAnimationFrame(raf);
  t0 = 0; running = true;
  if (qParked) watchQuestion();
  raf = requestAnimationFrame(loop);
}

/* ============================================================
   THE DESCENT (phone only)
   The portrait is presented full bleed and held still behind the hero, so the
   room has to go dark around it as the reading column descends. --p carries
   that curve: decisively across the first screen, so no line is ever read over
   a lit face, then the rest of the way down to the question.
   ============================================================ */
var PHONE = window.matchMedia ? matchMedia('(max-width: 899px)') : null;
function isPhone() { return !!PHONE && PHONE.matches; }

var pTick = false;
function descent() {
  pTick = false;
  var vh = window.innerHeight || 1;
  var r = heroEl.getBoundingClientRect();
  var y = window.scrollY || window.pageYOffset || 0;
  var span = Math.max(1, y + r.bottom - vh);   /* the hero's last scroll position */
  /* two stages, the first decisive so no line is read over a lit face. A short
     hero gets a proportionally short first stage instead of a step. */
  var first = Math.min(vh * 0.90, span * 0.75);
  var d = 0.80 * sstep(0, first, y) + 0.20 * sstep(first, Math.max(first + 1, span), y);
  mhRoot.style.setProperty('--p', d.toFixed(4));
  /* the room closes behind you: a held layer spans the viewport, so it has to
     be gone by the time the page below owns the screen */
  var out = 1 - Math.min(1, Math.max(0, r.bottom / vh));
  mhRoot.style.setProperty('--out', out.toFixed(3));
  mhRoot.classList.toggle('mh--past', r.bottom <= 0);
}
function onDescentScroll() {
  if (!pTick) { pTick = true; requestAnimationFrame(descent); }
}
var descentOn = false;
function watchDescent() {
  var want = isPhone() && !STILL;
  if (want === descentOn) return;
  descentOn = want;
  if (want) {
    addEventListener('scroll', onDescentScroll, { passive: true });
    descent();
  } else {
    removeEventListener('scroll', onDescentScroll);
    mhRoot.style.setProperty('--p', '0');
    mhRoot.style.setProperty('--out', '0');
    mhRoot.classList.remove('mh--past');
  }
}
if (STILL) mhRoot.classList.add('mh--still');
watchDescent();
if (PHONE && PHONE.addEventListener) PHONE.addEventListener('change', watchDescent);

/* ---------- the audio: pure upside ---------- */
var playing = false;
function fmt(s) {
  if (!isFinite(s)) return '';
  return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
}
function setPlayUi(on) {
  playing = on;
  $('play').setAttribute('aria-pressed', String(on));
  $('icoPlay').hidden = on; $('icoPause').hidden = !on;
  $('playLbl').textContent = on ? T.playing : T.play;
}
function stopAudio() {
  try { au.pause(); } catch (e) {}
  au.removeAttribute('src'); au.load();
  setPlayUi(false);
  $('playT').textContent = '';
}
$('play').addEventListener('click', function () {
  if (playing) { au.pause(); return; }
  if (!au.getAttribute('src')) au.src = trail(cur);
  au.play().then(function () { setPlayUi(true); }).catch(function () {});
});
au.addEventListener('pause', function () { setPlayUi(false); });
au.addEventListener('ended', function () { setPlayUi(false); $('playT').textContent = totalTxt; });
/* no duration is claimed until the file itself reports one */
var totalTxt = '';
au.addEventListener('loadedmetadata', function () {
  totalTxt = fmt(au.duration);
  $('playT').textContent = totalTxt;
});
var lastT = null;
au.addEventListener('seeking', function () { lastT = null; });
au.addEventListener('timeupdate', function () {
  if (playing && totalTxt) $('playT').textContent = fmt(au.currentTime) + ' / ' + totalTxt;
  if (!playing) { lastT = null; return; }
  var t = au.currentTime;
  if (lastT !== null) {
    var d = t - lastT;
    if (d > 0 && d < 2) { try { addHeardSeconds(d, cur); } catch (e) {} }
  }
  lastT = t;
});

/* ---------- re-keying ----------
   The markup already holds the English lead with its portrait painted, so a
   normal visit swaps nothing. Any other face loads its own painting first, then
   the hero re-keys and the whole choreography replays with the new question. */
var DEFAULT = 'aurelius';

/* the hero opens the page, so the top of the document is the top of the stage */
function toStage() {
  try { scrollTo({ top: 0, behavior: STILL ? 'auto' : 'smooth' }); }
  catch (e) { scrollTo(0, 0); }
}

/* The stage is fixed to the viewport on a phone, so the dust can only be placed
   once a scroll has come to rest: mid-scroll the grid lands where the stage no
   longer is. The cap keeps an interrupted scroll from stalling the ignition. */
function whenSteady(fn) {
  if (!isPhone() || (window.scrollY || 0) <= 1) { fn(); return; }
  var tries = 0;
  (function step() {
    if ((window.scrollY || 0) <= 1 || ++tries > 90) { fn(); return; }
    requestAnimationFrame(step);
  })();
}

function swapTo(id) {
  var im = new Image();
  im.crossOrigin = 'anonymous';
  im.onload = function () {
    shot.removeAttribute('srcset');
    shot.src = im.src;
    paint(id);
    requestAnimationFrame(function () { whenSteady(ignite); });
  };
  im.onerror = function () { paint(id); arrive(); };
  im.src = main(id, innerWidth <= 899 ? 900 : 1200);
}

function select(id, user) {
  if (user) {
    /* dissolve first, then the new face condenses out of the dust and its own
       question is written after it */
    cancelAnimationFrame(raf); raf = 0; running = false;
    if (W) ctx.clearRect(0, 0, W, H);
    document.documentElement.classList.add('settling');
    shot.style.transition = '';
    shot.style.opacity = '';
    shot.classList.add('gone');
    /* the rail sits two screens under the painting, so the room comes back
       first: the new face is ignited where the visitor can watch it */
    if (isPhone()) toStage();
    setTimeout(function () { swapTo(id); }, 300);
    return;
  }
  if (id !== DEFAULT) { swapTo(id); return; }
  paint(id);
  ignite();
  /* a slow byte must never leave the mat empty: reveal the painting regardless.
     A parked beat two is not a stall, so it is left alone. */
  setTimeout(function () {
    if (!running && !qParked && FREEZE === null && !STILL &&
        document.documentElement.classList.contains('settling')) arrive();
  }, 2800);
}

var rt;
addEventListener('resize', function () {
  clearTimeout(rt);
  rt = setTimeout(function () {
    if (running) { cancelAnimationFrame(raf); raf = 0; running = false; }
    sizeCanvas();
    ctx.clearRect(0, 0, W, H);
    /* a phone fires resize when the URL bar collapses, which must not hand the
       question its gold before the reader has reached it */
    if (qParked) { faceArrived(); watchQuestion(); } else arrive();
    if (descentOn) descent();
  }, 160);
});

select(cur, false);
if (FAKEPLAY) { setPlayUi(true); $('playT').textContent = '0:18 / 0:52'; }

})();
