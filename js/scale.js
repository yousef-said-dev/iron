/* =====================================================================
   scale.js — منصة الميزان الأرضي الصناعي وحساب الأحمال ثلاثية الأبعاد
   ===================================================================== */

var scaleInventory = {};
var scalePickables = [];
var scaleScreenCanvas = null, scaleScreenTex = null;

function getTotalScaleKg() {
  var sum = 0;
  Object.keys(scaleInventory).forEach(function (k) {
    var item = scaleInventory[k];
    if (item && item.qty > 0) {
      sum += item.qty * (UNIT_KG[k] || 0);
    }
  });
  return sum;
}

/* تحديث شاشة الميزان الرقمية باللغة العربية */
function updateScaleDisplay(totalKg) {
  if (!scaleScreenCanvas || !scaleScreenTex) return;
  var sx = scaleScreenCanvas.getContext('2d');
  sx.fillStyle = '#05130b';
  sx.fillRect(0, 0, 512, 256);

  // إطار الشاشة الصناعي
  sx.strokeStyle = '#1d5a34';
  sx.lineWidth = 8;
  sx.strokeRect(4, 4, 504, 248);

  // خطوط المسح الرقمية للشاشة الكريستالية
  sx.fillStyle = 'rgba(30, 120, 60, 0.12)';
  for (var y = 8; y < 248; y += 6) {
    sx.fillRect(8, y, 496, 2);
  }

  // رأس الشاشة وحالة المعايرة
  sx.fillStyle = '#3fd07d';
  sx.font = 'bold 22px "Cairo", monospace';
  sx.textAlign = 'right';
  sx.textBaseline = 'top';
  sx.fillText('● النظام جاهز · ميزان الشاحنات الأرضي', 484, 20);

  // القراءة الرقمية الكبيرة للوزن
  sx.fillStyle = '#7dffb0';
  sx.font = 'bold 74px monospace';
  sx.textAlign = 'center';
  sx.textBaseline = 'middle';
  sx.fillText(totalKg.toFixed(2) + ' كجم', 256, 122);

  // أسفل الشاشة
  sx.fillStyle = '#2ba05f';
  sx.font = 'bold 20px "Cairo", monospace';
  sx.textAlign = 'center';
  sx.fillText('الوزن القائم الصافي · ميزان معتمد ومختوم', 256, 204);

  scaleScreenTex.needsUpdate = true;
  dirty = true;
}

/* بناء الميزان الأرضي في نهاية الصالة */
(function () {
  var scale = new THREE.Group();
  scale.position.set(0, 0, SCALE_Z);
  scene.add(scale);

  /* صفيحة السطح الفولاذية المحفرة لمنع الانزلاق (Tread Plate Canvas) */
  var dc = document.createElement('canvas'); dc.width = 256; dc.height = 128;
  var dx = dc.getContext('2d');
  dx.fillStyle = '#7f878f'; dx.fillRect(0, 0, 256, 128);
  for (var yy = 8; yy < 128; yy += 16) {
    for (var xx = 8; xx < 256; xx += 16) {
      dx.fillStyle = '#9aa2aa'; dx.fillRect(xx, yy, 7, 3);
      dx.fillStyle = '#666e76'; dx.fillRect(xx + 3, yy + 4, 7, 3);
    }
  }
  var deckTex = new THREE.CanvasTexture(dc);
  deckTex.wrapS = deckTex.wrapT = THREE.RepeatWrapping;
  deckTex.repeat.set(3, 2);
  deckTex.encoding = THREE.sRGBEncoding;
  var deckMat = mat(0xffffff, 0.8, 0.45, { map: deckTex });

  /* خلايا قياس الوزن الأربعة أسفل المنصة */
  var footGeo = new THREE.BoxGeometry(0.45, 0.10, 0.45);
  var feet = new THREE.InstancedMesh(footGeo, darkSteel, 4);
  feet.frustumCulled = false;
  var fd = new THREE.Object3D(), fi = 0;
  [[-2.6, -1.3], [2.6, -1.3], [-2.6, 1.3], [2.6, 1.3]].forEach(function (p) {
    fd.position.set(p[0], 0.05, p[1]);
    fd.updateMatrix();
    feet.setMatrixAt(fi++, fd.matrix);
  });
  feet.instanceMatrix.needsUpdate = true;
  scale.add(feet);
  scalePickables.push(feet);

  /* إطار المنصة الحديدي والسطح الحامل */
  var frameRim = box(6.15, 0.12, 3.35, darkSteel, 0, 0.16, 0);
  scale.add(frameRim);
  scalePickables.push(frameRim);

  var deckMesh = box(6.0, 0.12, 3.2, deckMat, 0, 0.28, 0);
  scale.add(deckMesh);
  scalePickables.push(deckMesh);

  /* خطوط تحذيرية صفراء وسوداء على الحافة */
  var hc = document.createElement('canvas'); hc.width = 256; hc.height = 32;
  var hx = hc.getContext('2d');
  hx.fillStyle = '#e0a81c'; hx.fillRect(0, 0, 256, 32);
  hx.fillStyle = '#1a1a1a';
  for (var i = -32; i < 256; i += 32) {
    hx.beginPath(); hx.moveTo(i, 0); hx.lineTo(i + 16, 0); hx.lineTo(i - 16, 32); hx.lineTo(i - 32, 32); hx.closePath(); hx.fill();
  }
  var hazardTex = new THREE.CanvasTexture(hc);
  hazardTex.wrapS = THREE.RepeatWrapping; hazardTex.repeat.set(6, 1);
  hazardTex.encoding = THREE.sRGBEncoding;
  var hazard = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 0.11), mat(0xffffff, 0.2, 0.6, { map: hazardTex }));
  hazard.position.set(0, 0.28, 1.606);
  scale.add(hazard);
  scalePickables.push(hazard);

  /* عمود ورأس شاشة الوزن الرقمية */
  var post = box(0.12, 1.8, 0.12, darkSteel, 0, 1.24, -1.5);
  var head = box(0.9, 0.5, 0.22, darkSteel, 0, 2.25, -1.5);
  scale.add(post); scale.add(head);
  scalePickables.push(post); scalePickables.push(head);

  /* شاشة القراءة الرقمية */
  scaleScreenCanvas = document.createElement('canvas');
  scaleScreenCanvas.width = 512; scaleScreenCanvas.height = 256;
  scaleScreenTex = new THREE.CanvasTexture(scaleScreenCanvas);
  scaleScreenTex.encoding = THREE.sRGBEncoding;
  var screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.74, 0.36),
    new THREE.MeshBasicMaterial({ map: scaleScreenTex, toneMapped: false })
  );
  screen.position.set(0, 2.25, -1.38);
  scale.add(screen);
  scalePickables.push(screen);

  updateScaleDisplay(0);
  window.ironScale = scale;
})();

/* =====================================================================
   ترتيب المواد على منصة الميزان: 3 أعمدة × طبقتين (اثنان فوق بعض بجانب اثنين بجانب اثنين)
   ===================================================================== */
function updateScaleItems() {
  var activeKeys = Object.keys(scaleInventory).filter(function (k) {
    return scaleInventory[k] && scaleInventory[k].qty > 0;
  });

  // الأعمدة الثلاثة على المحور X (-1.85, 0.0, +1.85)
  var colX = [-1.85, 0.0, 1.85];
  var colBottomMeshes = [null, null, null];

  activeKeys.forEach(function (key, idx) {
    var entry = scaleInventory[key];
    var p = window.ironProducts[key];
    if (!p || !p.topItem) return;

    var targetCol = 0;
    var targetTier = 0;

    if (activeKeys.length <= 3) {
      if (activeKeys.length === 1) {
        targetCol = 1; // منتج وحيد في المنتصف
      } else if (activeKeys.length === 2) {
        targetCol = idx === 0 ? 0 : 2; // منتجان على الجانبين
      } else {
        targetCol = idx; // 3 منتجات بجانب بعضها
      }
      targetTier = 0;
    } else {
      // أكثر من 3 منتجات: نملأ الطبقة السفلية أولاً، ثم الطبقة العلوية فوقها مباشرة
      if (idx < 3) {
        targetCol = idx;
        targetTier = 0;
      } else {
        targetCol = idx - 3;
        targetTier = 1;
      }
    }

    var targetX = colX[targetCol];
    var targetZ = SCALE_Z;

    if (!entry.mesh) {
      // إنشاء مجسم ممثل للمنتج
      var clone = p.topItem.clone(true);
      clone.traverse(function (o) {
        o.layers.set(0);
        if (o.isMesh) {
          o.userData.scaleProduct = key;
          scalePickables.push(o);
        }
      });

      clone.scale.copy(p.homeScale || new THREE.Vector3(1, 1, 1)).multiplyScalar(0.70);
      var targetQuat = (key === 'لفائف أسلاك')
        ? new THREE.Quaternion()
        : new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
      targetQuat.multiply(p.homeQuat || new THREE.Quaternion());
      clone.quaternion.copy(targetQuat);

      clone.position.set(targetX, SCALE_TOP_Y + 0.2, targetZ);
      scene.add(clone);
      clone.updateMatrixWorld(true);

      entry.mesh = clone;
    }

    // حساب الارتفاع لضبط التراكب (فوق المنصة أو فوق المنتج السفلي في نفس العمود)
    entry.mesh.updateMatrixWorld(true);
    var b = new THREE.Box3().setFromObject(entry.mesh);

    if (targetTier === 0) {
      // يستقر مباشرة على سطح الميزان
      var floorOffset = SCALE_TOP_Y - b.min.y;
      entry.mesh.position.y += floorOffset;
      colBottomMeshes[targetCol] = entry.mesh;
      var targetPos = new THREE.Vector3(targetX, entry.mesh.position.y, targetZ);
      tweenObj(entry.mesh, targetPos, entry.mesh.quaternion.clone(), entry.mesh.scale.clone(), 0.5, null);
    } else {
      // يستقر بأمان فوق المنتج السفلي في نفس العمود
      var bottomMesh = colBottomMeshes[targetCol];
      var baseTopY = SCALE_TOP_Y + 0.6;
      if (bottomMesh) {
        bottomMesh.updateMatrixWorld(true);
        var bBot = new THREE.Box3().setFromObject(bottomMesh);
        baseTopY = bBot.max.y + 0.04;
      }
      var stackOffset = baseTopY - b.min.y;
      entry.mesh.position.y += stackOffset;
      var targetPos2 = new THREE.Vector3(targetX, entry.mesh.position.y, targetZ);
      tweenObj(entry.mesh, targetPos2, entry.mesh.quaternion.clone(), entry.mesh.scale.clone(), 0.5, null);
    }
  });

  // إزالة المجسمات التي تم تصفير كميتها
  Object.keys(scaleInventory).forEach(function (key) {
    var entry = scaleInventory[key];
    if (entry.qty <= 0 && entry.mesh) {
      scene.remove(entry.mesh);
      entry.mesh.traverse(function (o) {
        var idx = scalePickables.indexOf(o);
        if (idx >= 0) scalePickables.splice(idx, 1);
      });
      entry.mesh = null;
    }
  });

  updateScaleDisplay(getTotalScaleKg());
  dirty = true;
}

/* التحقق من نقر الميزان بالأشعة */
function hitScaleAt(x, y) {
  ndc.x = (x / innerWidth) * 2 - 1;
  ndc.y = -(y / innerHeight) * 2 + 1;
  camera.updateMatrixWorld(true);
  raycaster.setFromCamera(ndc, camera);
  var hits = raycaster.intersectObjects(scalePickables, true);
  return hits.length > 0;
}
