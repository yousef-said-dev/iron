/* =====================================================================
   interaction.js — التفاعل اللمسي والفأرة والتصويب المركزي للهواتف
   ===================================================================== */

var raycasterScale = new THREE.Raycaster();

var pointerX = innerWidth / 2, pointerY = innerHeight / 2;
var hoverKey = null, hoverDirty = false;
var pressActive = false, pressMoved = false, pressStartX = 0, pressStartY = 0;

var dragging = false;
var lookYaw = 0, lookPitch = 0, PITCH_LIMIT = 1.45;
var dragStartX = 0, dragStartY = 0, dragStartYaw = 0, dragStartPitch = 0;

var mobileReticle = document.getElementById('mobileReticle');
var mobileActionBtn = document.getElementById('mobileActionBtn');

/* حلقة إشارة التحديد البرتقالية النابضة */
var hoverRing = new THREE.Mesh(
  new THREE.RingGeometry(0.92, 1.0, 48),
  new THREE.MeshBasicMaterial({ color: 0xd9622b, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })
);
hoverRing.rotation.x = -Math.PI / 2;
hoverRing.position.y = 0.025;
hoverRing.visible = false;
hoverRing.userData.sx = 1; hoverRing.userData.sz = 1;
scene.add(hoverRing);

function positionHint() {
  if (!pickHintEl || isMobile) return;
  var w = pickHintEl.offsetWidth || 170, h = pickHintEl.offsetHeight || 34;
  var x = Math.max(8, Math.min(pointerX + 16, innerWidth - w - 10));
  var y = Math.max(8, Math.min(pointerY + 16, innerHeight - h - 10));
  pickHintEl.style.transform = 'translate(' + x + 'px,' + y + 'px)';
}

function showHint(text) {
  if (!pickHintEl) return;
  pickHintEl.textContent = text;
  if (!isMobile) {
    pickHintEl.classList.add('show');
    positionHint();
  }
}

function clearHover() {
  hoverKey = null;
  hoverDirty = false;
  hoverRing.visible = false;
  if (pickHintEl) pickHintEl.classList.remove('show');
  if (mobileReticle) mobileReticle.classList.remove('active');
  if (mobileActionBtn) mobileActionBtn.classList.remove('show');
  if (insideRoom && !dragging && !focusedKey && !isMobile) {
    renderer.domElement.style.cursor = CURSOR_CROSSHAIR;
  }
}

/* حساب إحداثيات الأشعة NDC: في الهاتف نستخدم منتصف الشاشة دائماً (0, 0) */
function getRaycastNDC(x, y) {
  if (isMobile) {
    return { x: 0, y: 0 };
  } else {
    return {
      x: (x / innerWidth) * 2 - 1,
      y: -(y / innerHeight) * 2 + 1
    };
  }
}

function hitProductAt(x, y) {
  var coords = getRaycastNDC(x, y);
  ndc.x = coords.x;
  ndc.y = coords.y;
  camera.updateMatrixWorld(true);
  raycaster.setFromCamera(ndc, camera);
  var hits = raycaster.intersectObjects(pickables, false);
  if (!hits.length) return null;
  var key = hits[0].object.userData.ironProduct;
  if (!key) return null;
  return { key: key, p: window.ironProducts[key] };
}

function hitScaleAt(x, y) {
  var coords = getRaycastNDC(x, y);
  ndc.x = coords.x;
  ndc.y = coords.y;
  camera.updateMatrixWorld(true);
  raycasterScale.setFromCamera(ndc, camera);
  var hits = raycasterScale.intersectObjects(scalePickables, true);
  return hits.length > 0;
}

function tryPickAt(x, y) {
  if (focusedKey || (typeof invUI !== 'undefined' && invUI.classList.contains('open'))) return false;

  // التحقق أولاً من النقر على الميزان
  if (hitScaleAt(x, y)) {
    openInventory();
    return true;
  }

  var h = hitProductAt(x, y);
  if (!h) return false;
  var p = h.p;
  if (!p || !p.topItem) return false;

  var dist = camera.position.distanceTo(p.sphere.center) - p.sphere.radius;
  if (dist > NEAR_DIST) {
    var title = (PRODUCT_INFO[h.key] || {}).title || h.key;
    showToast('اقترب أكثر لمعاينة ' + title + '.');
    return false;
  }

  openFocus(h.key);
  return true;
}

/* تحديث التصويب والتحويم (في الهاتف: التصويب ثابت بالمنتصف ويعمل تلقائياً كـ Hover) */
function updateHover() {
  hoverDirty = false;
  if (!insideRoom || focusedKey || (typeof invUI !== 'undefined' && invUI.classList.contains('open')) || (!isMobile && (dragging || pressActive))) {
    clearHover();
    return;
  }

  var checkX = isMobile ? (innerWidth / 2) : pointerX;
  var checkY = isMobile ? (innerHeight / 2) : pointerY;

  // 1. فحص الميزان
  if (hitScaleAt(checkX, checkY)) {
    hoverKey = 'SCALE';
    hoverRing.visible = false;
    var totalKg = getTotalScaleKg();

    if (isMobile) {
      if (mobileReticle) mobileReticle.classList.add('active');
      if (mobileActionBtn) {
        mobileActionBtn.textContent = '⚖️ فتح الميزان (' + totalKg.toFixed(1) + ' كجم)';
        mobileActionBtn.classList.add('show');
      }
    } else {
      showHint('انقر على الميزان لعرض قائمة المواد (' + totalKg.toFixed(1) + ' كجم)');
      renderer.domElement.style.cursor = 'pointer';
    }
    dirty = true;
    return;
  }

  // 2. فحص المعروضات الحديدية
  var h = hitProductAt(checkX, checkY);
  if (!h) {
    clearHover();
    return;
  }

  var key = h.key, p = h.p, info = PRODUCT_INFO[key] || { title: key };
  var dist = camera.position.distanceTo(p.sphere.center) - p.sphere.radius;

  if (dist > NEAR_DIST) {
    hoverKey = null;
    hoverRing.visible = false;
    if (isMobile) {
      if (mobileReticle) mobileReticle.classList.remove('active');
      if (mobileActionBtn) mobileActionBtn.classList.remove('show');
    } else {
      showHint('اقترب أكثر لمعاينة ' + info.title);
      renderer.domElement.style.cursor = insideRoom ? CURSOR_CROSSHAIR : 'default';
    }
    return;
  }

  if (hoverKey !== key) {
    hoverKey = key;
    hoverRing.visible = true;
    hoverRing.position.set(p.group.position.x, 0.025, p.group.position.z);
    hoverRing.userData.sx = p.ringX;
    hoverRing.userData.sz = p.ringZ;
    hoverRing.scale.set(p.ringX, p.ringZ, 1);
  }

  if (isMobile) {
    if (mobileReticle) mobileReticle.classList.add('active');
    if (mobileActionBtn) {
      mobileActionBtn.textContent = '🔍 فحص: ' + info.title;
      mobileActionBtn.classList.add('show');
    }
  } else {
    showHint('انقر لمعاينة ' + info.title);
    renderer.domElement.style.cursor = 'pointer';
  }
  dirty = true;
}

function updateHoverRing(now) {
  if (!hoverRing.visible) return;
  var pulse = 0.5 + 0.5 * Math.sin(now * 0.006);
  hoverRing.material.opacity = 0.28 + 0.24 * pulse;
  var s = 1 + 0.018 * pulse;
  hoverRing.scale.set(hoverRing.userData.sx * s, hoverRing.userData.sz * s, 1);
}

/* =====================================================================
   معالجة أحداث اللمس والفأرة المتطورة
   ===================================================================== */
renderer.domElement.addEventListener('pointerdown', function (e) {
  if (focusedKey || (typeof invUI !== 'undefined' && invUI.classList.contains('open'))) return;
  pressActive = true;
  pressMoved = false;
  pressStartX = e.clientX;
  pressStartY = e.clientY;
  clearHover();

  if (insideRoom) {
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartYaw = lookYaw;
    dragStartPitch = lookPitch;
    if (!isMobile) renderer.domElement.style.cursor = 'grabbing';
    if (renderer.domElement.setPointerCapture) {
      renderer.domElement.setPointerCapture(e.pointerId);
    }
  }
});

addEventListener('pointermove', function (e) {
  pointerX = e.clientX;
  pointerY = e.clientY;

  if (pickHintEl && pickHintEl.classList.contains('show') && !isMobile) positionHint();

  if (pressActive) {
    var distMoved = Math.hypot(e.clientX - pressStartX, e.clientY - pressStartY);
    if (distMoved > 8) {
      pressMoved = true;
    }
  }

  if (dragging && insideRoom && !focusedKey) {
    var deltaX = e.clientX - dragStartX;
    var deltaY = e.clientY - dragStartY;

    lookYaw = dragStartYaw - (deltaX / innerWidth) * Math.PI * 2.0;
    lookPitch = clamp(dragStartPitch + (deltaY / innerHeight) * Math.PI * 1.5, -PITCH_LIMIT, PITCH_LIMIT);

    hoverDirty = true;
    dirty = true;
    return;
  }

  if (!focusedKey) hoverDirty = true;
});

function endPointer(e) {
  if (!pressActive && !dragging) return;
  var isClick = pressActive && !pressMoved && !focusedKey && insideRoom;
  var clientX = e ? e.clientX : pressStartX;
  var clientY = e ? e.clientY : pressStartY;

  pressActive = false;
  if (dragging) {
    dragging = false;
    if (!isMobile) renderer.domElement.style.cursor = insideRoom ? CURSOR_CROSSHAIR : 'default';
  }

  if (isClick) {
    // في الهواتف: النقر في أي مكان يلتقط العنصر المصوب عليه في المنتصف
    if (isMobile) {
      tryPickAt(innerWidth / 2, innerHeight / 2);
    } else {
      tryPickAt(clientX, clientY);
    }
  }
  hoverDirty = true;
}

addEventListener('pointerup', endPointer);
addEventListener('pointercancel', endPointer);

/* زر الفحص المباشر في الهواتف */
if (mobileActionBtn) {
  mobileActionBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    tryPickAt(innerWidth / 2, innerHeight / 2);
  });
}

/* =====================================================================
   تدوير المنتج باللمس والسحب أثناء نافذة الفحص (Focus Mode)
   ===================================================================== */
var itemDragActive = false, itemDragMoved = false;
var itemDragLastX = 0, itemDragLastY = 0;

if (focusBlock) {
  focusBlock.addEventListener('pointerdown', function (e) {
    if (!focusedKey || focusPhase !== 'idle' || !focusItem) return;
    itemDragActive = true;
    itemDragMoved = false;
    itemDragLastX = e.clientX;
    itemDragLastY = e.clientY;
    focusBlock.classList.add('grabbing');
    if (focusBlock.setPointerCapture) {
      focusBlock.setPointerCapture(e.pointerId);
    }
  });

  focusBlock.addEventListener('pointermove', function (e) {
    if (!itemDragActive || !focusedKey || !focusItem) return;
    var dx = e.clientX - itemDragLastX;
    var dy = e.clientY - itemDragLastY;
    if (Math.hypot(dx, dy) > 4) {
      itemDragMoved = true;
    }
    itemDragLastX = e.clientX;
    itemDragLastY = e.clientY;

    var rotY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * 0.009);
    var rotX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * 0.009);
    focusItem.quaternion.premultiply(rotY).premultiply(rotX);
    dirty = true;
  });

  var endItemDrag = function (e) {
    if (!itemDragActive) return;
    itemDragActive = false;
    focusBlock.classList.remove('grabbing');
    if (!itemDragMoved && e && e.type === 'pointerup') {
      closeFocus();
    }
  };

  focusBlock.addEventListener('pointerup', endItemDrag);
  focusBlock.addEventListener('pointercancel', endItemDrag);
}

/* دعم مفاتيح لوحة المفاتيح لإغلاق النوافذ */
addEventListener('keydown', function (e) {
  if (typeof invUI !== 'undefined' && invUI.classList.contains('open') && e.key === 'Escape') {
    closeInventory();
    return;
  }
  if (!focusedKey) return;
  if (e.key === 'Escape') {
    closeFocus();
    return;
  }
  if (e.target && e.target.tagName === 'INPUT') return;
});
