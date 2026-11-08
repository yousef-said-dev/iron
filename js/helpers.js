/* =====================================================================
   helpers.js — دوال مساعدة لإنشاء الخامات والمؤثرات والحركات
   ===================================================================== */

/* توليد خامات الضجيج المحببة للجدران والأرضيات والخرسانة (بدون تحميل صور خارجية) */
function noiseTex(base, rx, ry, dark) {
  var c = document.createElement('canvas');
  var size = (typeof isMobile !== 'undefined' && isMobile) ? 128 : 256;
  var count = (typeof isMobile !== 'undefined' && isMobile) ? 800 : 3000;
  c.width = c.height = size;
  var x = c.getContext('2d');
  x.fillStyle = base;
  x.fillRect(0, 0, size, size);
  for (var i = 0; i < count; i++) {
    var v = Math.random() < 0.5 ? (dark ? 0 : 255) : 128;
    x.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',.07)';
    x.fillRect(Math.random() * size, Math.random() * size, Math.random() * 3 + 1, Math.random() * 3 + 1);
  }
  var t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

/* توليد لافتات ثلاثية الأبعاد للنصوص العربية */
function label(txt, w, h, fs) {
  var c = document.createElement('canvas');
  c.width = 512;
  c.height = Math.round(512 * h / w);
  var x = c.getContext('2d');
  x.fillStyle = 'rgba(14, 16, 20, .88)';
  x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = '#d9622b';
  x.lineWidth = 6;
  x.strokeRect(5, 5, c.width - 10, c.height - 10);
  x.fillStyle = '#f2efe8';
  x.font = 'bold ' + fs + 'px "Cairo", system-ui, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(txt, c.width / 2, c.height / 2 + 2);
  var t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

function mat(color, m, r, extra) {
  var o = { color: color, metalness: m, roughness: r };
  if (extra) {
    for (var k in extra) o[k] = extra[k];
  }
  return new THREE.MeshStandardMaterial(o);
}

function box(w, h, d, m, x, y, z) {
  var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x || 0, y || 0, z || 0);
  return b;
}

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

function ease(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function money(n) {
  return '$' + n.toFixed(2);
}

/* إشعار عائم في أسفل الشاشة */
var toastEl = document.getElementById('toast');
var toastTimer = 0;
function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    toastEl.classList.remove('show');
  }, 2800);
}

/* التحكم بقفل التمرير عند فتح النوافذ المنبثقة */
var savedScrollY = 0;
function lockScroll() {
  savedScrollY = window.scrollY || window.pageYOffset || 0;
  document.documentElement.classList.add('focus-lock');
  document.body.classList.add('focus-lock');
}

function unlockScroll() {
  document.documentElement.classList.remove('focus-lock');
  document.body.classList.remove('focus-lock');
  window.scrollTo(0, savedScrollY);
}

/* محرك الانتقال الحركي السلس للأجسام (Tweens) */
var tweens = [];
function tweenObj(obj, toPos, toQuat, toScale, dur, onDone) {
  tweens.push({
    obj: obj,
    fromPos: obj.position.clone(), toPos: toPos.clone(),
    fromQuat: obj.quaternion.clone(), toQuat: toQuat.clone(),
    fromScale: obj.scale.clone(), toScale: toScale.clone(),
    t: 0, dur: Math.max(0.05, dur), onDone: onDone
  });
}

function stopTweens(obj) {
  for (var i = tweens.length - 1; i >= 0; i--) {
    if (tweens[i].obj === obj) tweens.splice(i, 1);
  }
}

function updateTweens(dt) {
  for (var i = tweens.length - 1; i >= 0; i--) {
    var tw = tweens[i];
    tw.t += dt;
    var k = Math.min(1, tw.t / tw.dur);
    var e = ease(k);
    tw.obj.position.lerpVectors(tw.fromPos,tw.toPos, e);
    tw.obj.quaternion.copy(tw.fromQuat).slerp(tw.toQuat, e);
    tw.obj.scale.lerpVectors(tw.fromScale, tw.toScale, e);
    if (k >= 1) {
      tw.obj.position.copy(tw.toPos);
      tw.obj.quaternion.copy(tw.toQuat);
      tw.obj.scale.copy(tw.toScale);
      tweens.splice(i, 1);
      if (tw.onDone) tw.onDone();
    }
  }
}
