/* =====================================================================
   ui.js — واجهات الفحص وشراء المنتجات وسجل الميزان والتنبيهات
   ===================================================================== */

var pickHintEl = document.getElementById('pickHint');
var focusUI = document.getElementById('focusUI');
var focusKicker = document.getElementById('focusKicker');
var focusTitle = document.getElementById('focusTitle');
var focusDesc = document.getElementById('focusDesc');
var focusSpecs = document.getElementById('focusSpecs');
var focusQty = document.getElementById('focusQty');
var focusTotal = document.getElementById('focusTotal');
var focusBuy = document.getElementById('focusBuy');
var focusReturn = document.getElementById('focusReturn');
var focusClose = document.getElementById('focusClose');
var focusBlock = document.getElementById('focusBlock');

var invUI = document.getElementById('invUI');
var invBlock = document.getElementById('invBlock');
var invClose = document.getElementById('invClose');
var invBody = document.getElementById('invBody');
var invGrandTotal = document.getElementById('invGrandTotal');
var invContent = document.getElementById('invContent');

var focusedKey = null, focusPhase = null, focusItem = null, focusHome = null;

/* توجيه زاوية العرض المميزة لكل منتج أثناء الفحص */
function presentationQuat(key) {
  if (key === 'لفائف أسلاك' || key === 'ألواح صلب') {
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0.16));
  }
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, -0.12));
}

function focusTargetFor(p) {
  var narrow = innerWidth < 768;
  var dist = narrow ? 2.8 : 3.4;
  var visibleH = 2 * dist * Math.tan(camera.fov * Math.PI / 360);
  var visibleW = visibleH * (innerWidth / innerHeight);
  var size = p.size || new THREE.Vector3(1, 1, 1);
  var maxDim = Math.max(size.x, size.y, size.z) || 1;
  var desired = (narrow ? 0.70 : 0.44) * visibleW;
  var s = (p.homeScale ? p.homeScale.x : 1) * desired / maxDim;
  s = clamp(s, 0.3, 8);

  // في الواجهة العربية RTL: نجعل المجسم إلى اليمين قليلاً واللوحة لليسار
  var pos = new THREE.Vector3(
    narrow ? 0 : 0.18 * visibleW,
    narrow ? 0.16 * visibleH : 0.02 * visibleH,
    -dist
  );
  return { pos: pos, quat: presentationQuat(focusedKey), scale: new THREE.Vector3(s, s, s) };
}

function updateTotal() {
  var info = focusUI._info || { price: 0 };
  var q = parseInt(focusQty.value, 10);
  if (!(q > 0)) q = 1;
  q = clamp(q, 1, 99);
  focusTotal.textContent = money(info.price * q);
}

function populateFocus(key) {
  var info = PRODUCT_INFO[key] || { title: key, desc: '', spec: '', price: 0, kicker: 'منتج' };
  focusUI._info = info;
  focusKicker.textContent = info.kicker || 'منتج معتمد';
  focusTitle.textContent = info.title || key;
  focusDesc.textContent = info.desc || '';
  focusSpecs.textContent = info.spec || '';
  focusQty.value = '1';
  updateTotal();
}

function openFocus(key) {
  if (focusedKey || invUI.classList.contains('open')) return;
  var p = window.ironProducts[key];
  if (!p || !p.topItem) return;

  focusedKey = key;
  focusPhase = 'in';
  focusItem = p.topItem;
  focusHome = { pos: p.homePos.clone(), quat: p.homeQuat.clone(), scale: p.homeScale.clone() };

  clearHover();
  lockScroll();
  focusUI.classList.add('open');
  focusUI.setAttribute('aria-hidden', 'false');
  hint.style.opacity = 0;
  populateFocus(key);

  camera.updateMatrixWorld(true);
  camera.attach(focusItem);
  focusItem.traverse(function (o) { o.layers.set(1); });

  var t = focusTargetFor(p);
  tweenObj(focusItem, t.pos, t.quat, t.scale, 0.85, function () {
    focusPhase = 'idle';
  });
  dirty = true;
}

function closeFocus() {
  if (!focusedKey || focusPhase === 'out') return;
  var item = focusItem, home = focusHome;
  focusUI.classList.remove('open');
  focusUI.setAttribute('aria-hidden', 'true');
  stopTweens(item);
  scene.attach(item);
  item.traverse(function (o) { o.layers.set(0); });
  focusPhase = 'out';

  tweenObj(item, home.pos, home.quat, home.scale, 0.65, function () {
    item.position.copy(home.pos);
    item.quaternion.copy(home.quat);
    item.scale.copy(home.scale);
    focusedKey = null; focusPhase = null; focusItem = null; focusHome = null;
    unlockScroll();
    hintState = -1;
    hoverDirty = true;
    dirty = true;
    if (insideRoom && !dragging) renderer.domElement.style.cursor = CURSOR_CROSSHAIR;
  });
  dirty = true;
}

/* =====================================================================
   حركة الشراء: نقل المجسم مباشرة من واجهة الفحص إلى منصة الميزان
   ===================================================================== */
function buyFocus() {
  if (!focusedKey || focusPhase === 'out' || !focusItem) return;
  var key = focusedKey;
  var p = window.ironProducts[key];
  var info = PRODUCT_INFO[key] || { title: key, price: 0 };
  var q = clamp(parseInt(focusQty.value, 10) || 1, 1, 99);

  // إغلاق الواجهة فوراً
  focusUI.classList.remove('open');
  focusUI.setAttribute('aria-hidden', 'true');
  stopTweens(focusItem);

  // إرجاع المنتج إلى الطبقة العامة وفصله عن الكاميرا إلى فضاء المشهد
  focusItem.traverse(function (o) { o.layers.set(0); });
  scene.attach(focusItem);

  // تعويض المعروض في رف المتجر بنسخة جديدة ليبقى المعرض مكتملاً
  var shelfCopy = focusItem.clone(true);
  shelfCopy.position.copy(focusHome.pos);
  shelfCopy.quaternion.copy(focusHome.quat);
  shelfCopy.scale.copy(focusHome.scale);
  scene.add(shelfCopy);
  shelfCopy.updateMatrixWorld(true);
  p.topItem = shelfCopy;

  shelfCopy.traverse(function (o) {
    if (o.isMesh) {
      o.userData.ironProduct = key;
      pickables.push(o);
    }
  });

  // تسجيل الكمية في سجل الميزان
  if (!scaleInventory[key]) {
    scaleInventory[key] = { qty: 0, mesh: null };
  }
  scaleInventory[key].qty += q;

  // توجيه المجسم الطائر مباشرة إلى موقع الميزان في نهاية المعرض
  var flyMesh = focusItem;
  var targetPos = new THREE.Vector3(0, SCALE_TOP_Y + 0.6, SCALE_Z);
  var targetScale = p.homeScale.clone().multiplyScalar(0.70);
  var targetQuat = (key === 'لفائف أسلاك')
    ? new THREE.Quaternion()
    : new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
  targetQuat.multiply(p.homeQuat || new THREE.Quaternion());

  tweenObj(flyMesh, targetPos, targetQuat, targetScale, 0.9, function () {
    // عند الوصول إلى الميزان، نقوم بتحديث ترتيب المنصة بالكامل
    if (scaleInventory[key].mesh && scaleInventory[key].mesh !== flyMesh) {
      scene.remove(flyMesh);
    } else {
      scaleInventory[key].mesh = flyMesh;
      flyMesh.traverse(function (o) {
        if (o.isMesh) {
          o.userData.scaleProduct = key;
          scalePickables.push(o);
        }
      });
    }
    updateScaleItems();
  });

  focusedKey = null; focusPhase = null; focusItem = null; focusHome = null;
  unlockScroll();
  hintState = -1;
  hoverDirty = true;
  dirty = true;

  var totalItemKg = scaleInventory[key].qty * (UNIT_KG[key] || 0);
  showToast('تم نقل ' + q + ' × ' + info.title + ' مباشرة إلى الميزان (الإجمالي: ' + scaleInventory[key].qty + ' وحدات · ' + totalItemKg.toFixed(1) + ' كجم)');
}

/* =====================================================================
   سجل حمولة الميزان (قائمة تفاعلية باللغة العربية)
   ===================================================================== */
function rebuildInventoryRows() {
  var activeKeys = Object.keys(scaleInventory).filter(function (k) {
    return scaleInventory[k] && scaleInventory[k].qty > 0;
  });

  if (!activeKeys.length) {
    invContent.innerHTML = '<div class="inv-empty">منصة الميزان فارغة حالياً.<br><span style="font-size:13px;opacity:.7">عاين أي مادة حديدية في المعرض واضغط على <b>شراء ووضع على الميزان</b>.</span></div>';
    invBody = null;
    invGrandTotal = null;
    return;
  }

  var rowsHtml = '';
  activeKeys.forEach(function (key) {
    var entry = scaleInventory[key];
    var ukg = UNIT_KG[key] || 0;
    var subTotal = (entry.qty * ukg).toFixed(2);
    rowsHtml += '<tr><td><b>' + key + '</b></td>' +
      '<td style="text-align:center"><div class="inv-qty-wrap">' +
      '<button class="inv-qty-btn inv-minus" data-key="' + key + '" type="button" aria-label="تقليل الكمية">−</button>' +
      '<input type="number" min="0" max="99" value="' + entry.qty + '" data-key="' + key + '" inputmode="numeric">' +
      '<button class="inv-qty-btn inv-plus" data-key="' + key + '" type="button" aria-label="زيادة الكمية">+</button>' +
      '</div></td>' +
      '<td>' + ukg.toFixed(1) + ' كجم</td>' +
      '<td style="font-family:monospace;font-weight:700" data-sub="' + key + '">' + subTotal + ' كجم</td>' +
      '<td style="text-align:center"><button class="inv-remove-btn" data-key="' + key + '" title="إزالة من الميزان">×</button></td></tr>';
  });

  invContent.innerHTML = '<table class="inv-table"><thead><tr><th>المادة الفولاذية</th><th style="text-align:center">الكمية</th><th>وزن الوحدة</th><th>الوزن الإجمالي</th><th style="text-align:center">حذف</th></tr></thead><tbody id="invBody">' + rowsHtml + '</tbody><tfoot><tr class="inv-total-row"><td colspan="3">إجمالي وزن الحمولة القائم:</td><td id="invGrandTotal" style="color:#7dffb0;font-size:16px;font-family:monospace;font-weight:700">0.00 كجم</td><td></td></tr></tfoot></table>';
  invBody = document.getElementById('invBody');
  invGrandTotal = document.getElementById('invGrandTotal');
  invGrandTotal.textContent = getTotalScaleKg().toFixed(2) + ' كجم';
}

function openInventory() {
  if (focusedKey) return;
  rebuildInventoryRows();
  invUI.classList.add('open');
  invUI.setAttribute('aria-hidden', 'false');
  clearHover();
  lockScroll();
  dirty = true;
}

function closeInventory() {
  invUI.classList.remove('open');
  invUI.setAttribute('aria-hidden', 'true');
  unlockScroll();
  hintState = -1;
  hoverDirty = true;
  dirty = true;
}

/* ربط أزرار النوافذ */
focusClose.addEventListener('click', closeFocus);
focusReturn.addEventListener('click', closeFocus);
focusBuy.addEventListener('click', buyFocus);
focusQty.addEventListener('input', updateTotal);

invClose.addEventListener('click', closeInventory);
invBlock.addEventListener('click', function (e) {
  if (e.target === invBlock) closeInventory();
});

invContent.addEventListener('click', function (e) {
  var btn = e.target.closest('button');
  if (!btn) return;
  var key = btn.getAttribute('data-key');
  if (!key || !scaleInventory[key]) return;

  if (btn.classList.contains('inv-plus')) {
    scaleInventory[key].qty = Math.min(99, scaleInventory[key].qty + 1);
  } else if (btn.classList.contains('inv-minus')) {
    scaleInventory[key].qty = Math.max(0, scaleInventory[key].qty - 1);
  } else if (btn.classList.contains('inv-remove-btn')) {
    scaleInventory[key].qty = 0;
  }

  updateScaleItems();
  rebuildInventoryRows();
});

invContent.addEventListener('input', function (e) {
  var inp = e.target;
  if (inp.tagName !== 'INPUT') return;
  var key = inp.getAttribute('data-key');
  if (!key || !scaleInventory[key]) return;
  var val = parseInt(inp.value, 10);
  if (isNaN(val) || val < 0) val = 0;
  if (val > 99) val = 99;
  scaleInventory[key].qty = val;
  updateScaleItems();
  var ukg = UNIT_KG[key] || 0;
  var subEl = invContent.querySelector('[data-sub="' + key + '"]');
  if (subEl) subEl.textContent = (val * ukg).toFixed(2) + ' كجم';
  invGrandTotal.textContent = getTotalScaleKg().toFixed(2) + ' كجم';
});
