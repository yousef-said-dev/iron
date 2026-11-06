/* =====================================================================
   interaction.js — التفاعل اللمسي والفأرة وتدوير المنتجات ثلاثية الأبعاد
   ===================================================================== */

var raycasterScale = new THREE.Raycaster();

var pointerX = innerWidth / 2, pointerY = innerHeight / 2;
var hoverKey = null, hoverDirty = false;
var pressActive = false, pressMoved = false, pressStartX = 0, pressStartY = 0;

var insideRoom = false, dragging = false;
var lookYaw = 0, lookPitch = 0, PITCH_LIMIT = 1.45;
var dragStartX = 0, dragStartY = 0, dragStartYaw = 0, dragStartPitch = 0;

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
  var w = pickHintEl.offsetWidth || 170, h = pickHintEl.offsetHeight || 34;
  var x = Math.max(8, Math.min(pointerX + 16, innerWidth - w - 10));
  var y = Math.max(8, Math.min(pointerY + 16, innerHeight - h - 10));
  pickHintEl.style.transform = 'translate(' + x + 'px,' + y + 'px)';
}

function showHint(text) {
  pickHintEl.textContent = text;
  pickHintEl.classList.add('show');
  positionHint();
}

function clearHover() {
  hoverKey = null;
  hoverDirty = false;
  hoverRing.visible = false;
  pickHintEl.classList.remove('show');
  if (insideRoom && !dragging && !focusedKey) {
    renderer.domElement.style.cursor = CURSOR_CROSSHAIR;
  }
}

function hitProductAt(x, y) {
  ndc.x = (x / innerWidth) * 2 - 1;
  ndc.y = -(y / innerHeight) * 2 + 1;
  camera.updateMatrixWorld(true);
  raycaster.setFromCamera(ndc, camera);
  var hits = raycaster.intersectObjects(pickables, false);
  if (!hits.length) return null;
  var key = hits[0].object.userData.ironProduct;
  if (!key) return null;
  return { key: key, p: window.ironProducts[key] };
}

function tryPickAt(x, y) {
  if (focusedKey || invUI.classList.contains('open')) return false;

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

function updateHover() {
  hoverDirty = false;
  if (!insideRoom || focusedKey || invUI.classList.contains('open') || dragging || pressActive) {
    clearHover();
    return;
  }

  if (hitScaleAt(pointerX, pointerY)) {
    hoverKey = 'SCALE';
    hoverRing.visible = false;
    var totalKg = getTotalScaleKg();
    showHint('انقر على الميزان لعرض قائمة المواد (' + totalKg.toFixed(1) + ' كجم)');
    renderer.domElement.style.cursor = 'pointer';
    dirty = true;
    return;
  }

  var h = hitProductAt(pointerX, pointerY);
  if (!h) {
    clearHover();
    return;
  }

  var key = h.key, p = h.p, info = PRODUCT_INFO[key] || { title: key };
  var dist = camera.position.distanceTo(p.sphere.center) - p.sphere.radius;
  if (dist > NEAR_DIST) {
    hoverKey = null;
    hoverRing.visible = false;
    showHint('اقترب أكثر لمعاينة ' + info.title);
    renderer.domElement.style.cursor = insideRoom ? CURSOR_CROSSHAIR : 'default';
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

  showHint('انقر لمعاينة ' + info.title);
  renderer.domElement.style.cursor = 'pointer';
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
   معالجة أحداث اللمس والفأرة المتطورة (دعم كامل للهواتف والأجهزة اللمسية)
   ===================================================================== */
var touchIsDragging = false;

renderer.domElement.addEventListener('pointerdown', function (e) {
  if (focusedKey || invUI.classList.contains('open')) return;
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
    renderer.domElement.style.cursor = 'grabbing';
    if (renderer.domElement.setPointerCapture) {
      renderer.domElement.setPointerCapture(e.pointerId);
    }
  }
});

addEventListener('pointermove', function (e) {
  pointerX = e.clientX;
  pointerY = e.clientY;

  if (pickHintEl.classList.contains('show')) positionHint();

  if (pressActive) {
    var distMoved = Math.hypot(e.clientX - pressStartX, e.clientY - pressStartY);
    if (distMoved > 8) {
      pressMoved = true;
    }
  }

  if (dragging && insideRoom && !focusedKey) {
    var deltaX = e.clientX - dragStartX;
    var deltaY = e.clientY - dragStartY;
    // في الواجهة العربية RTL: السحب الأفقي يتوافق مع حركة الكاميرا
    lookYaw = dragStartYaw - (deltaX / innerWidth) * Math.PI * 2.2;
    lookPitch = clamp(dragStartPitch - (deltaY / innerHeight) * Math.PI, -PITCH_LIMIT, PITCH_LIMIT);
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
    renderer.domElement.style.cursor = insideRoom ? CURSOR_CROSSHAIR : 'default';
  }

  if (isClick) {
    tryPickAt(clientX, clientY);
  }
  hoverDirty = true;
}

addEventListener('pointerup', endPointer);
addEventListener('pointercancel', endPointer);

/* =====================================================================
   تدوير المنتج باللمس والسحب أثناء نافذة الفحص (Focus Mode)
   ===================================================================== */
var itemDragActive = false, itemDragMoved = false;
var itemDragLastX = 0, itemDragLastY = 0;

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

function endItemDrag(e) {
  if (!itemDragActive) return;
  itemDragActive = false;
  focusBlock.classList.remove('grabbing');
  // إذا كانت نقرة خفيفة دون سحب، يتم إغلاق المعاينة والعودة للمعرض
  if (!itemDragMoved && e && e.type === 'pointerup') {
    closeFocus();
  }
}

focusBlock.addEventListener('pointerup', endItemDrag);
focusBlock.addEventListener('pointercancel', endItemDrag);

/* دعم مفاتيح لوحة المفاتيح */
addEventListener('keydown', function (e) {
  if (invUI.classList.contains('open') && e.key === 'Escape') {
    closeInventory();
    return;
  }
  if (!focusedKey) return;
  if (e.key === 'Escape') {
    closeFocus();
    return;
  }
  if (e.target && e.target.tagName === 'INPUT') return;
  if ([' ', 'Spacebar', 'PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp'].indexOf(e.key) >= 0) {
    e.preventDefault();
  }
});
