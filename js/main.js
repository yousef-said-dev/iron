/* =====================================================================
   main.js — حلقة التصيير المركزية وإدارة الرسوميات والتفاعل العام
   ===================================================================== */

scene.traverse(function (o) {
  if (o.isLight) o.layers.enable(1);
});

/* تصيير المنتج المفحوص في طبقة منفصلة مع معالجة العودة السلسة بدون وميض خلفية */
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

var lastFrame = performance.now();

/* ---------------------------------------------------------------------
   حلقة التصيير الرئيسية (The Master Game / Render Loop)
   --------------------------------------------------------------------- */
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

  // عند فتح نافذة الفحص، يتم تجميد الكاميرا وتصيير طبقة المنتج المعزولة
  if (focusedKey) {
    if (dirty || hoverRing.visible) {
      dirty = false;
      renderFocused();
    }
    return;
  }

  // تحديث فيزياء التنقل السلس وحركة البوابة وموضع الكاميرا
  var navMoving = updateNavigation(dt);

  // تحديث زوايا الالتفات والانحناء بنعومة وانسيابية
  var ty = insideRoom ? lookYaw : 0;
  var tp = insideRoom ? lookPitch : 0;
  var rotSmoothing = 1 - Math.exp(-12.0 * dt);

  var rotMoving = Math.abs(ty - yaw) > 0.0003 || Math.abs(tp - pitch) > 0.0003;
  if (!navMoving && !rotMoving && !dirty && !hoverDirty && !hoverRing.visible) return;
  dirty = false;

  yaw += (ty - yaw) * rotSmoothing;
  pitch += (tp - pitch) * rotSmoothing;

  var camY = 2.3;
  var cp = Math.cos(pitch);
  camera.position.set(0, camY, camera.position.z);
  camera.lookAt(Math.sin(yaw) * cp * 10, camY + Math.sin(pitch) * 10, camera.position.z - Math.cos(yaw) * cp * 10);

  renderer.render(scene, camera);
}

frame();

/* ---------------------------------------------------------------------
   معالج تغيير أبعاد الشاشة للحواسيب والهواتف الذكية
   --------------------------------------------------------------------- */
addEventListener('resize', function () {
  if (typeof checkIsMobile === 'function') checkIsMobile();

  renderer.setPixelRatio(isMobile ? 1.0 : Math.min(window.devicePixelRatio, 2));
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
