/* =====================================================================
   products.js — نماذج منتجات الحديد والصلب والمعروضات
   ===================================================================== */

var wood = mat(0x8a6a42, 0, 0.9);
var rebarMat = mat(0x3e3732, 0.72, 0.55);
var pipesMat = mat(0xb8c2cb, 0.95, 0.26, { side: THREE.DoubleSide });
var ibeamMat = mat(0x384c60, 0.7, 0.4);
var angleMat = mat(0xa6b0b8, 0.9, 0.36);
var coilMat = mat(0x767d84, 0.82, 0.42);

var rebarRodGeo = new THREE.CylinderGeometry(0.035, 0.035, 2.8, (typeof isMobile !== 'undefined' && isMobile) ? 6 : 8);
var pipeGeo = new THREE.CylinderGeometry(0.16, 0.16, 2.8, (typeof isMobile !== 'undefined' && isMobile) ? 12 : 20, 1, true);
var sheetsBoxGeo = new THREE.BoxGeometry(1.4, 0.03, 2.7);
var ibeamFlnGeo = new THREE.BoxGeometry(0.4, 0.04, 2.8);
var ibeamWebGeo = new THREE.BoxGeometry(0.04, 0.36, 2.8);
var angLegHGeo = new THREE.BoxGeometry(0.14, 0.015, 2.8);
var angLegVGeo = new THREE.BoxGeometry(0.015, 0.14, 2.8);
var coilGeo = new THREE.TorusGeometry(0.5, 0.17, (typeof isMobile !== 'undefined' && isMobile) ? 8 : 14, (typeof isMobile !== 'undefined' && isMobile) ? 18 : 30);

function pallet() {
  var g = new THREE.Group();
  g.add(box(1.6, 0.14, 2.9, wood, 0, 0.07, 0));
  return g;
}

function rebar() {
  var g = pallet(), items = [];
  for (var r = 0; r < 3; r++) {
    for (var c = 0; c < 5 - r; c++) {
      var b = new THREE.Mesh(rebarRodGeo, rebarMat);
      b.rotation.x = Math.PI / 2;
      b.position.set((c - (4 - r) / 2) * 0.09, 0.2 + r * 0.08, 0);
      g.add(b);
      items.push(b);
    }
  }
  g.userData.items = items;
  return g;
}

function pipes() {
  var g = pallet(), rad = 0.16, row = [4, 3, 2], items = [];
  row.forEach(function (n, r) {
    for (var c = 0; c < n; c++) {
      var b = new THREE.Mesh(pipeGeo, pipesMat);
      b.rotation.x = Math.PI / 2;
      b.position.set((c - (n - 1) / 2) * rad * 2.1, 0.14 + rad + r * rad * 1.8, 0);
      g.add(b);
      items.push(b);
    }
  });
  g.userData.items = items;
  return g;
}

function ibeams() {
  var g = pallet(), items = [];
  [-0.4, 0.4].forEach(function (x) {
    [0, 1].forEach(function (l) {
      var y = 0.3 + l * 0.5, beam = new THREE.Group();
      var f1 = new THREE.Mesh(ibeamFlnGeo, ibeamMat);
      f1.position.set(x, y - 0.18, 0);
      beam.add(f1);
      var f2 = new THREE.Mesh(ibeamFlnGeo, ibeamMat);
      f2.position.set(x, y + 0.18, 0);
      beam.add(f2);
      var w = new THREE.Mesh(ibeamWebGeo, ibeamMat);
      w.position.set(x, y, 0);
      beam.add(w);
      g.add(beam);
      items.push(beam);
    });
  });
  g.userData.items = items;
  return g;
}

function sheets() {
  var g = pallet(), items = [];
  for (var i = 0; i < 9; i++) {
    var s = new THREE.Mesh(sheetsBoxGeo, steel);
    s.position.set((Math.random() - 0.5) * 0.04, 0.17 + i * 0.04, (Math.random() - 0.5) * 0.04);
    g.add(s);
    items.push(s);
  }
  g.userData.items = items;
  return g;
}

function angles() {
  var g = pallet(), items = [];
  for (var r = 0; r < 2; r++) {
    for (var c = 0; c < 4; c++) {
      var x = (c - 1.5) * 0.3, y = 0.2 + r * 0.12, angle = new THREE.Group();
      var h = new THREE.Mesh(angLegHGeo, angleMat);
      h.position.set(x, y, 0);
      angle.add(h);
      var v = new THREE.Mesh(angLegVGeo, angleMat);
      v.position.set(x - 0.06, y + 0.06, 0);
      angle.add(v);
      g.add(angle);
      items.push(angle);
    }
  }
  g.userData.items = items;
  return g;
}

function coils() {
  var g = pallet(), items = [];
  [-0.8, 0.8].forEach(function (z) {
    for (var i = 0; i < 2; i++) {
      var t = new THREE.Mesh(coilGeo, coilMat);
      t.rotation.x = Math.PI / 2;
      t.position.set(0, 0.25 + i * 0.34, z);
      g.add(t);
      items.push(t);
    }
  });
  g.userData.items = items;
  return g;
}

function mergeGeoms(entries) {
  var pos = [], nor = [], uv = [], idx = [], off = 0;
  entries.forEach(function (e) {
    var geo = e.geo.clone();
    geo.applyMatrix4(e.matrix);
    var p = geo.attributes.position, n = geo.attributes.normal, u = geo.attributes.uv;
    for (var i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      if (n) nor.push(n.getX(i), n.getY(i), n.getZ(i)); else nor.push(0, 1, 0);
      if (u) uv.push(u.getX(i), u.getY(i)); else uv.push(0, 0);
    }
    if (geo.index) {
      for (var j = 0; j < geo.index.count; j++) idx.push(geo.index.getX(j) + off);
    } else {
      for (var k = 0; k < p.count; k++) idx.push(k + off);
    }
    off += p.count;
    geo.dispose();
  });
  var out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

function collapseItem(item, g, inv) {
  var buckets = [];
  item.traverse(function (o) {
    if (!o.isMesh) return;
    var b = null;
    for (var i = 0; i < buckets.length; i++) {
      if (buckets[i].src === o.material) { b = buckets[i]; break; }
    }
    if (!b) {
      b = { src: o.material, mat: o.material.clone(), entries: [] };
      buckets.push(b);
    }
    b.entries.push({ geo: o.geometry, matrix: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld) });
  });
  var center = new THREE.Box3().setFromObject(item).getCenter(new THREE.Vector3()).applyMatrix4(inv);
  var out;
  if (buckets.length === 1) {
    var geo = mergeGeoms(buckets[0].entries);
    geo.translate(-center.x, -center.y, -center.z);
    out = new THREE.Mesh(geo, buckets[0].mat);
  } else {
    out = new THREE.Group();
    buckets.forEach(function (b) {
      var geo = mergeGeoms(b.entries);
      geo.translate(-center.x, -center.y, -center.z);
      out.add(new THREE.Mesh(geo, b.mat));
    });
  }
  out.position.copy(center);
  return out;
}

function prepareGroup(g) {
  g.updateMatrixWorld(true);
  var inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  var items = g.userData.items || [];
  var keep = null, best = -Infinity;
  items.forEach(function (it) {
    var b = new THREE.Box3().setFromObject(it);
    var y = b.getCenter(new THREE.Vector3()).y;
    if (y > best) { best = y; keep = it; }
  });
  if (!keep) return null;

  var keepMeshes = [];
  keep.traverse(function (o) { if (o.isMesh) keepMeshes.push(o); });

  var buckets = [];
  g.traverse(function (o) {
    if (!o.isMesh || keepMeshes.indexOf(o) >= 0) return;
    var local = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    var b = null;
    for (var i = 0; i < buckets.length; i++) {
      if (buckets[i].mat === o.material) { b = buckets[i]; break; }
    }
    if (!b) { b = { mat: o.material, entries: [] }; buckets.push(b); }
    b.entries.push({ geo: o.geometry, matrix: local });
  });

  var top = collapseItem(keep, g, inv);
  while (g.children.length) g.remove(g.children[0]);
  buckets.forEach(function (b) { g.add(new THREE.Mesh(mergeGeoms(b.entries), b.mat)); });
  g.add(top);
  g.userData.items = [top];
  g.userData.topItem = top;
  return top;
}

var defs = [
  [-1, -6, 'حديد تسليح', rebar],
  [1, -6, 'مواسير فولاذ', pipes],
  [-1, -11.5, 'جسور فولاذية', ibeams],
  [1, -11.5, 'ألواح صلب', sheets],
  [-1, -17, 'لفائف أسلاك', coils],
  [1, -17, 'حديد زوايا', angles]
];

window.ironProducts = {};
var pickables = [];

defs.forEach(function (d) {
  var key = d[2];
  var g = d[3]();
  var top = prepareGroup(g);
  g.userData.product = key;
  if (top) top.userData.product = key;
  g.scale.setScalar(1.5);
  g.position.set(d[0] * 4.3, 0, d[1]);
  scene.add(g);
  g.updateMatrixWorld(true);

  if (top) scene.attach(top);
  window.ironProducts[key] = { group: g, topItem: top };

  /* لافتة ثلاثية الأبعاد فوق كل كومة معروضات */
  var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: label(key, 2.6, 0.7, 52), transparent: true, fog: false }));
  sp.scale.set(2.8, 0.75, 1);
  sp.position.set(d[0] * 4.3, 2.7, d[1]);
  scene.add(sp);
});

/* التخلص من القوالب البدائية لتحرير ذاكرة كارت الشاشة */
[rebarRodGeo, pipeGeo, sheetsBoxGeo, ibeamFlnGeo, ibeamWebGeo, angLegHGeo, angLegVGeo, coilGeo]
  .forEach(function (g) { if (g) g.dispose(); });

/* إعداد مناطق التقاط الأشعة وحساب الأبعاد */
Object.keys(window.ironProducts).forEach(function (key) {
  var p = window.ironProducts[key];
  var b = new THREE.Box3().setFromObject(p.group);
  if (p.topItem) b.expandByObject(p.topItem);
  p.sphere = b.getBoundingSphere(new THREE.Sphere());
  p.ringX = Math.max(1.3, (b.max.x - b.min.x) * 0.58);
  p.ringZ = Math.max(1.7, (b.max.z - b.min.z) * 0.58);

  if (p.topItem) {
    var tb = new THREE.Box3().setFromObject(p.topItem);
    p.size = tb.getSize(new THREE.Vector3());
    p.homePos = p.topItem.position.clone();
    p.homeQuat = p.topItem.quaternion.clone();
    p.homeScale = p.topItem.scale.clone();
  }

  [p.group, p.topItem].forEach(function (root) {
    if (!root) return;
    root.traverse(function (o) {
      if (o.isMesh) {
        o.userData.ironProduct = key;
        pickables.push(o);
      }
    });
  });
});
