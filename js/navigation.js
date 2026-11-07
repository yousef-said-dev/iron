/* =====================================================================
   navigation.js — نظام التنقل الحركي السلس والتحكم في كاميرا المعرض
   ===================================================================== */

var target = 0, cur = 0, yaw = 0, pitch = 0;
var insideRoom = false;

var navToggleBtn = document.getElementById('navToggle');
var scrubberWrap = document.getElementById('scrubberWrap');
var scrubberTrack = document.getElementById('scrubberTrack');
var scrubberFill = document.getElementById('scrubberFill');
var scrubberThumb = document.getElementById('scrubberThumb');
var hint = document.getElementById('hint');
var hintState = -1;

var mobileNavFwd = document.getElementById('mobileNavFwd');
var mobileNavBwd = document.getElementById('mobileNavBwd');

/* ---------------------------------------------------------------------
   1. التحكم عبر عجلة الفأرة (Desktop Mouse Wheel)
   --------------------------------------------------------------------- */
addEventListener('wheel', function (e) {
  if (focusedKey || (typeof invUI !== 'undefined' && invUI.classList.contains('open'))) return;
  if (e.target && e.target.closest && (e.target.closest('.focus-panel') || e.target.closest('.inv-panel'))) return;

  var delta = e.deltaY;
  if (e.deltaMode === 1) delta *= 28;      // Firefox lines mode
  else if (e.deltaMode === 2) delta *= 280; // pages mode

  // تراكم سلس للتمرير الافتراضي
  target = clamp(target + delta * 0.00075, 0, 1);
  dirty = true;
}, { passive: true });

/* ---------------------------------------------------------------------
   2. التحكم عبر أزرار لوحة المفاتيح (Desktop Keyboard Arrows & WASD)
   --------------------------------------------------------------------- */
addEventListener('keydown', function (e) {
  if (focusedKey || (typeof invUI !== 'undefined' && invUI.classList.contains('open'))) return;
  if (e.target && e.target.tagName === 'INPUT') return;

  // التقدم للأمام
  if (['ArrowUp', 'KeyW', 'PageDown', ' '].indexOf(e.code || e.key) >= 0 || e.key === 'ArrowUp' || e.key === ' ') {
    e.preventDefault();
    target = clamp(target + 0.12, 0, 1);
    dirty = true;
  }
  // التراجع للخلف
  else if (['ArrowDown', 'KeyS', 'PageUp'].indexOf(e.code || e.key) >= 0 || e.key === 'ArrowDown') {
    e.preventDefault();
    target = clamp(target - 0.12, 0, 1);
    dirty = true;
  }
  // الالتفات لليمين
  else if (['ArrowRight', 'KeyD'].indexOf(e.code || e.key) >= 0 || e.key === 'ArrowRight') {
    if (insideRoom) {
      e.preventDefault();
      lookYaw += 0.12;
      dirty = true;
    }
  }
  // الالتفات لليسار
  else if (['ArrowLeft', 'KeyA'].indexOf(e.code || e.key) >= 0 || e.key === 'ArrowLeft') {
    if (insideRoom) {
      e.preventDefault();
      lookYaw -= 0.12;
      dirty = true;
    }
  }
});

/* ---------------------------------------------------------------------
   3. أزرار الحركة الحصرية للهواتف الذكية (Mobile On-Screen Buttons)
   --------------------------------------------------------------------- */
var mobileMoveTimer = 0;
var mobileMoveDirection = 0; // +1 forward, -1 backward

function stepMobileMove() {
  if (mobileMoveDirection === 0) return;
  target = clamp(target + mobileMoveDirection * 0.012, 0, 1);
  dirty = true;
  mobileMoveTimer = requestAnimationFrame(stepMobileMove);
}

function startMobileMove(dir) {
  mobileMoveDirection = dir;
  cancelAnimationFrame(mobileMoveTimer);
  target = clamp(target + dir * 0.08, 0, 1);
  dirty = true;
  mobileMoveTimer = requestAnimationFrame(stepMobileMove);
}

function stopMobileMove() {
  mobileMoveDirection = 0;
  cancelAnimationFrame(mobileMoveTimer);
}

if (mobileNavFwd) {
  mobileNavFwd.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    e.stopPropagation();
    startMobileMove(1);
    if (mobileNavFwd.setPointerCapture) mobileNavFwd.setPointerCapture(e.pointerId);
  });
  mobileNavFwd.addEventListener('pointerup', stopMobileMove);
  mobileNavFwd.addEventListener('pointercancel', stopMobileMove);
}

if (mobileNavBwd) {
  mobileNavBwd.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    e.stopPropagation();
    startMobileMove(-1);
    if (mobileNavBwd.setPointerCapture) mobileNavBwd.setPointerCapture(e.pointerId);
  });
  mobileNavBwd.addEventListener('pointerup', stopMobileMove);
  mobileNavBwd.addEventListener('pointercancel', stopMobileMove);
}

/* ---------------------------------------------------------------------
   4. زر التبديل السريع (دخول المعرض / الخروج للمدخل)
   --------------------------------------------------------------------- */
if (navToggleBtn) {
  navToggleBtn.addEventListener('click', function () {
    if (cur < 0.5) {
      target = 1.0; // دخول المعرض بالكامل
    } else {
      target = 0.0; // الخروج للمدخل
    }
    dirty = true;
  });
}

/* ---------------------------------------------------------------------
   5. شريط التمرير الجانبي التفاعلي (Desktop Scrubber)
   --------------------------------------------------------------------- */
var scrubberDragging = false;

function setScrubberPosFromEvent(e) {
  if (!scrubberTrack) return;
  var rect = scrubberTrack.getBoundingClientRect();
  var clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : rect.top);
  var progress = clamp((clientY - rect.top) / rect.height, 0, 1);
  target = progress;
  dirty = true;
}

if (scrubberTrack) {
  scrubberTrack.addEventListener('pointerdown', function (e) {
    scrubberDragging = true;
    setScrubberPosFromEvent(e);
    if (scrubberTrack.setPointerCapture) scrubberTrack.setPointerCapture(e.pointerId);
  });

  scrubberTrack.addEventListener('pointermove', function (e) {
    if (scrubberDragging) setScrubberPosFromEvent(e);
  });

  var endScrub = function () { scrubberDragging = false; };
  scrubberTrack.addEventListener('pointerup', endScrub);
  scrubberTrack.addEventListener('pointercancel', endScrub);
}

/* ---------------------------------------------------------------------
   6. الدالة المركزية لحساب وتحديث حركة الكاميرا والبوابة في كل إطار
   --------------------------------------------------------------------- */
function updateNavigation(dt) {
  var dp = target - cur;
  var scrollSmoothing = 1 - Math.exp(-7.5 * dt);
  var nextCur = cur + dp * scrollSmoothing;
  var nowInside = nextCur > LOOK_FROM;

  if (nowInside !== insideRoom) {
    insideRoom = nowInside;
    hoverDirty = true;
    if (!insideRoom) {
      yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
      lookYaw = 0;
      lookPitch = 0;
      dragging = false;
    }
    renderer.domElement.style.cursor = (insideRoom && !isMobile) ? CURSOR_CROSSHAIR : 'default';
  }

  cur = nextCur;

  // تحديث شكل ومؤشر الشريط الجانبي وزر التنقل
  if (scrubberFill && scrubberThumb) {
    var pct = (cur * 100).toFixed(1) + '%';
    scrubberFill.style.height = pct;
    scrubberThumb.style.top = pct;
  }

  if (navToggleBtn) {
    if (cur > 0.6) {
      navToggleBtn.textContent = 'الخروج للمدخل ↑';
    } else {
      navToggleBtn.textContent = 'دخول المعرض ↓';
    }
  }

  // حركة فتح البوابة السحابة وتدرج حركة الكاميرا
  var pd = clamp(cur / 0.45, 0, 1);
  var pw = smoothstep(clamp((cur - 0.05) / 0.95, 0, 1));
  openDoor(smoothstep(pd) * (H + 0.4));

  var z = Z_OUTSIDE + (Z_DOOR - Z_OUTSIDE) * pd + (Z_INSIDE - Z_DOOR) * pw;
  var camY = 2.3;
  var cp = Math.cos(pitch);

  camera.position.set(0, camY, z);
  camera.lookAt(Math.sin(yaw) * cp * 10, camY + Math.sin(pitch) * 10, z - Math.cos(yaw) * cp * 10);

  // تحديث التلميح الإرشادي السفلي
  var newHintState = cur > LOOK_FROM ? 2 : (cur < 0.02 ? 1 : 0);
  if (newHintState !== hintState && hint) {
    hintState = newHintState;
    hint.style.opacity = newHintState > 0 ? 1 : 0;
    if (isMobile) {
      hint.textContent = newHintState === 2
        ? 'وجّه علامة التصويب نحو أي منتج أو الميزان للمعاينة'
        : 'استخدم أزرار الحركة بالأسفل للدخول للمعرض';
    } else {
      hint.textContent = newHintState === 2
        ? 'انقر على أي منتج أو على الميزان · اسحب أو استخدم الأسهم للتجول 360°'
        : 'استخدم عجلة الفأرة أو الأسهم (↑ / ↓) للدخول للمستودع ↓';
    }
  }

  var moving = Math.abs(dp) > 0.0001;
  return moving;
}
