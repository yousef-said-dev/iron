/* =====================================================================
   main.js — حلقة التصيير الرئيسية، حركة التمرير السلسة، وإدارة الأحداث
   ===================================================================== */

scene.traverse(function (o) {
  if (o.isLight) o.layers.enable(1);
});

function renderFocused() {
  if (focusPhase === 'out') {
    camera.layers.set(0);
    renderer.render(scene, camera);
    return;
  }
  renderer.render(scene, camera);
  if (!focusedKey || !focusItem) return;

  var bg = scene.background;
  scene.background = null;
  camera.layers.set(1);
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(scene, camera);
  renderer.autoClear = true;
  camera.layers.set(0);
  scene.background = bg;
}

var target = 0, cur = 0, yaw = 0, pitch = 0, dirty = true;

function readScroll() {
  var m = document.documentElement.scrollHeight - innerHeight;
  target = m > 0 ? clamp(scrollY / m, 0, 1) : 0;
}
addEventListener('scroll', readScroll, { passive: true });

addEventListener('wheel', function (e) {
  if (focusedKey || (typeof invUI !== 'undefined' && invUI.classList.contains('open'))) return;
  if (e.target && e.target.closest && (e.target.closest('.focus-panel') || e.target.closest('.inv-panel'))) return;
  window.scrollBy(0, e.deltaY);
  readScroll();
  dirty = true;
}, { passive: true });

readScroll();
cur = target;

var hint = document.getElementById('hint');
var hintState = -1;
var lastFrame = performance.now();

function frame() {
  requestAnimationFrame(frame);
  var now = performance.now();
  var dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;

  if (hoverDirty && !focusedKey) updateHover();
  updateHoverRing(now);
  if (tweens.length) {
    updateTweens(dt);
    dirty = true;
  }

  // في حالة فحص منتج، يتم تجميد حركة الكاميرا وتصيير طبقة المنتج
  if (focusedKey) {
    if (dirty || hoverRing.visible) {
      dirty = false;
      renderFocused();
    }
    return;
  }

  var dp = target - cur;
  var scrollSmoothing = 1 - Math.exp(-8.5 * dt);
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
    renderer.domElement.style.cursor = insideRoom ? CURSOR_CROSSHAIR : 'default';
  }

  var ty = insideRoom ? lookYaw : 0, tp = insideRoom ? lookPitch : 0;
  var rotSmoothing = 1 - Math.exp(-12.0 * dt);
  var moving = Math.abs(dp) > 0.0001 || Math.abs(ty - yaw) > 0.0003 || Math.abs(tp - pitch) > 0.0003;

  if (!moving && !dirty && !hoverDirty && !hoverRing.visible) return;
  dirty = false;

  cur = nextCur;
  yaw += (ty - yaw) * rotSmoothing;
  pitch += (tp - pitch) * rotSmoothing;

  var pd = clamp(cur / 0.48, 0, 1);
  var pw = smoothstep(clamp((cur - 0.06) / 0.94, 0, 1));
  openDoor(smoothstep(pd) * (H + 0.4));

  var z = Z_OUTSIDE + (Z_DOOR - Z_OUTSIDE) * pd + (Z_INSIDE - Z_DOOR) * pw;
  var camY = 2.3;
  var cp = Math.cos(pitch);

  camera.position.set(0, camY, z);
  camera.lookAt(Math.sin(yaw) * cp * 10, camY + Math.sin(pitch) * 10, z - Math.cos(yaw) * cp * 10);

  // تحديث نصوص المساعدة الإرشادية باللغة العربية
  var newHintState = cur > LOOK_FROM ? 2 : (cur < 0.02 ? 1 : 0);
  if (newHintState !== hintState) {
    hintState = newHintState;
    hint.style.opacity = newHintState > 0 ? 1 : 0;
    hint.textContent = newHintState === 2
      ? 'انقر على أي منتج لمعاينته أو على الميزان · اسحب للتجول 360°'
      : 'قم بالتمرير للأسفل لفتح البوابة والنزول للمعرض ↓';
  }

  renderer.render(scene, camera);
}

frame();

/* زر تخطي المقدمة */
document.getElementById('skip').addEventListener('click', function () {
  scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
});

/* معالج تغيير حجم النافذة للهواتف والحواسيب */
addEventListener('resize', function () {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);

  if (focusedKey && focusItem && focusPhase !== 'out') {
    var p = window.ironProducts[focusedKey];
    if (p) {
      var t = focusTargetFor(p);
      stopTweens(focusItem);
      tweenObj(focusItem, t.pos, t.quat, t.scale, 0.3, function () {
        focusPhase = 'idle';
      });
    }
  }
  dirty = true;
});
