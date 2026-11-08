/* =====================================================================
   scene.js — المشهد ثلاثي الأبعاد، الإضاءة، بناء المستودع، والبوابة
   ===================================================================== */

var renderer;
var dpr = window.devicePixelRatio;
try {
  // تعطيل antialias على الهواتف لرفع الأداء بشكل فوري
  renderer = new THREE.WebGLRenderer({ antialias: (!isMobile && dpr < 2), powerPreference: 'high-performance' });
} catch (e) {
  document.getElementById('err').style.display = 'flex';
}
// ضبط كثافة البكسل: 1.0 على الهواتف لخفض حمل المعالجة بنسبة 60-75%، وبحد أقصى 2.0 على الحواسيب
renderer.setPixelRatio(isMobile ? 1.0 : Math.min(dpr, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.insertBefore(renderer.domElement, document.body.firstChild);

var scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a2230);
scene.fog = new THREE.Fog(0x1a2230, 30, 80);
var camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 120);
scene.add(camera);

/* بيئة الانعكاسات الاستوديو المدمجة للمواد المعدنية */
(function () {
  var es = new THREE.Scene();
  var c = document.createElement('canvas'); c.width = 4; c.height = 256;
  var x = c.getContext('2d');
  var g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#8fa6c0'); g.addColorStop(0.5, '#3a4452'); g.addColorStop(1, '#14161a');
  x.fillStyle = g; x.fillRect(0, 0, 4, 256);
  es.add(new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.BackSide })));
  for (var i = 0; i < 7; i++) {
    var m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    m.color.setScalar(9);
    var p = new THREE.Mesh(new THREE.PlaneGeometry(16, 1.4), m);
    p.position.set(Math.cos(i) * 12, 10 + i % 3 * 2, Math.sin(i) * 12);
    p.lookAt(0, 0, 0);
    es.add(p);
  }
  var pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(es, 0.03).texture;
  pm.dispose();
  es.traverse(function (obj) {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
})();

/* خامات المستودع والأسطح: استخدام MeshLambertMaterial في الهواتف للجدران والأسفلت لتخفيف الشيدر */
var steel = mat(0xc6ced6, 0.94, 0.28);
var darkSteel = mat(0x282c32, 0.85, 0.45);
var concrete, asphalt, wallMat;

if (isMobile) {
  concrete = new THREE.MeshLambertMaterial({ color: 0xffffff, map: noiseTex('#8d9094', 4, 2, true) });
  asphalt = new THREE.MeshLambertMaterial({ color: 0xffffff, map: noiseTex('#2a2d31', 8, 8, false) });
  wallMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: noiseTex('#9a9c9f', 2, 2, true) });
} else {
  concrete = mat(0xffffff, 0, 0.92, { map: noiseTex('#8d9094', 6, 2, true) });
  asphalt = mat(0xffffff, 0, 0.98, { map: noiseTex('#2a2d31', 12, 12, false) });
  wallMat = mat(0xffffff, 0, 0.95, { map: noiseTex('#9a9c9f', 3, 2, true) });
}
var epoxy = isMobile ? mat(0x383e46, 0.15, 0.4) : mat(0x383e46, 0.25, 0.32, { envMapIntensity: 0.65 });

/* مبنى المستودع والجدران */
var pierW = 7, wallH = 8.5;
[-1, 1].forEach(function (s) {
  scene.add(box(pierW, wallH, 1.2, wallMat, s * (W / 2 + pierW / 2), wallH / 2, -0.4));
});
scene.add(box(W, wallH - (H + 1), 1.2, wallMat, 0, H + 1 + (wallH - H - 1) / 2, -0.4));
scene.add(box(W, 1, 0.1, darkSteel, 0, H + 0.5, -0.95));

/* لافتة مدخل المعرض باللغة العربية */
var sign = new THREE.Mesh(
  new THREE.PlaneGeometry(5.4, 1.5),
  new THREE.MeshStandardMaterial({
    map: label('مصنع ورشة الحديد · قسم المبيعات', 5.4, 1.5, 42),
    roughness: 0.6,
    metalness: 0.1
  })
);
sign.position.set(0, H + 1 + 1.2, 0.21);
scene.add(sign);

/* مسامير وقضبان توجيه البوابة السحابة */
var boltGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.04, 8);
var bolts = new THREE.InstancedMesh(boltGeo, steel, 18);
bolts.frustumCulled = false;
var boltDummy = new THREE.Object3D(), bi = 0;
[-1, 1].forEach(function (s) {
  scene.add(box(0.24, H + 1, 0.34, darkSteel, s * (W / 2 + 0.06), (H + 1) / 2, 0));
  for (var i = 0; i < 9; i++) {
    boltDummy.position.set(s * (W / 2 + 0.06), 0.4 + i * 0.55, 0.19);
    boltDummy.rotation.set(Math.PI / 2, 0, 0);
    boltDummy.updateMatrix();
    bolts.setMatrixAt(bi++, boltDummy.matrix);
  }
});
bolts.instanceMatrix.needsUpdate = true;
scene.add(bolts);

/* أسطوانة لف الستارة العلوية */
var core = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.05, R - 0.05, W + 0.1, isMobile ? 12 : 24), darkSteel);
core.rotation.z = Math.PI / 2;
core.position.set(0, H, -R);
scene.add(core);

[-1, 1].forEach(function (s) {
  var d = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.07, isMobile ? 14 : 28), darkSteel);
  d.rotation.z = Math.PI / 2;
  d.position.set(s * (W / 2 + 0.1), H, -R);
  scene.add(d);
});

/* أرضية الخارج والصالة الداخلية */
var ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 50), asphalt);
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, 0, 24);
scene.add(ground);

var hall = new THREE.Mesh(new THREE.BoxGeometry(18, wallH, 24), concrete);
hall.material.side = THREE.BackSide;
hall.position.set(0, wallH / 2, -13);
scene.add(hall);

var floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 24), epoxy);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, 0.01, -13);
scene.add(floor);

/* خطوط إضاءة السقف النيون */
var lamp = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffe6b8, emissiveIntensity: 2.6 });
[-3, 3].forEach(function (x) {
  scene.add(box(0.3, 0.08, 20, lamp, x, wallH - 0.1, -13));
});

/* إضاءة المشهد الشاملة والإضاءة الحافية للمعدن */
scene.add(new THREE.HemisphereLight(0xbfd0e0, 0x1a1a1a, isMobile ? 0.95 : 0.5));
var spot = new THREE.SpotLight(0xffe2b0, 2.4, 32, 0.85, 0.55);
spot.position.set(0, H + 3, 7);
spot.target.position.set(0, H / 2, 0);
scene.add(spot, spot.target);

if (isMobile) {
  // تقليل المصابيح النقطية لمصباح مركزي واحد على الهاتف لتوفير استهلاك الـ GPU
  var pl = new THREE.PointLight(0xffe2b0, 1.8, 30, 1.2);
  pl.position.set(0, 7.2, -12);
  scene.add(pl);
} else {
  for (var i = 0; i < 4; i++) {
    var pl = new THREE.PointLight(0xffe2b0, 1.45, 18, 2);
    pl.position.set(0, 7.2, -4 - i * 5.5);
    scene.add(pl);
  }
}

/* إضاءة حافية صناعية مميزة تبرز حواف الحديد والأنابيب */
var rimLight = new THREE.DirectionalLight(0x7aa4d4, 0.85);
rimLight.position.set(-8, 7.5, -22);
rimLight.target.position.set(0, 1.5, -13);
scene.add(rimLight, rimLight.target);

/* الستارة المعدنية للبوابة */
var slatGeo = (function () {
  var t = 0.06, hh = HS * 0.5 - 0.004, sh = new THREE.Shape();
  sh.moveTo(t / 2, -hh);
  sh.lineTo(t / 2, hh);
  sh.quadraticCurveTo(-t * 1.6, 0, t / 2, -hh);
  var g = new THREE.ExtrudeGeometry(sh, { depth: W, bevelEnabled: false, curveSegments: isMobile ? 4 : 10 });
  g.translate(0, 0, -W / 2);
  g.rotateY(Math.PI / 2);
  return g;
})();

var slats = new THREE.InstancedMesh(slatGeo, steel, N);
slats.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
slats.frustumCulled = false;
scene.add(slats);

var lockMat = mat(0xcaa84a, 0.9, 0.35);
var bar = new THREE.Group();
bar.add(box(W + 0.04, BARH, 0.12, darkSteel, 0, 0, 0.02));
bar.add(box(0.2, 0.13, 0.06, lockMat, 0, 0, 0.1));
bar.add(box(0.34, 0.06, 0.05, steel, -1.7, 0, 0.1));
scene.add(bar);

var lastDoorO = -999, slatDummy = new THREE.Object3D();
function openDoor(O) {
  if (Math.abs(O - lastDoorO) < 0.0001) return;
  lastDoorO = O;
  for (var i = 0; i < N; i++) {
    var u = (i + 0.5) * HS, s = O - u;
    if (s <= 0) {
      slatDummy.position.set(0, H - u + O, 0);
      slatDummy.rotation.x = 0;
    } else {
      var phi = (-R + Math.sqrt(R * R + 2 * SPIRAL * s)) / SPIRAL;
      var r = R + SPIRAL * phi;
      slatDummy.position.set(0, H + r * Math.sin(phi), -R + r * Math.cos(phi));
      slatDummy.rotation.x = -phi;
    }
    slatDummy.updateMatrix();
    slats.setMatrixAt(i, slatDummy.matrix);
  }
  slats.instanceMatrix.needsUpdate = true;
  var bu = H - BARH / 2, bs = O - bu;
  if (bs <= 0) {
    bar.position.set(0, H - bu + O, 0);
    bar.rotation.x = 0;
  } else {
    var bphi = (-R + Math.sqrt(R * R + 2 * SPIRAL * bs)) / SPIRAL;
    var br = R + SPIRAL * bphi;
    bar.position.set(0, H + br * Math.sin(bphi), -R + br * Math.cos(bphi));
    bar.rotation.x = -bphi;
  }
}
openDoor(0);
