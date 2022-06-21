import * as THREE from "three";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import { BufferGeometryUtils } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Vector3 } from "three";

let axis;

let container, labelContainer;
let camera, scene, renderer, light;
let controller;

let hitTestSource = null;
let hitTestSourceRequested = false;

let measurements = [];
let labels = [];

let reticle;
let currentLine = null;

let axisXLine = null;
let axisYLine = null;
let axisZLine = null;

let distances = [];

let width, height;

let model3D;

function toScreenPosition(point, camera) {
  var vector = new THREE.Vector3();

  vector.copy(point);
  vector.project(camera);

  vector.x = ((vector.x + 1) * width) / 2;
  vector.y = ((-vector.y + 1) * height) / 2;
  vector.z = 0;

  return vector;
}

function getCenterPoint(points) {
  let line = new THREE.Line3(...points);
  return line.getCenter();
}

function matrixToVector(matrix) {
  let vector = new THREE.Vector3();
  vector.setFromMatrixPosition(matrix);
  return vector;
}

function initLine(point) {
  let lineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    linewidth: 5,
    linecap: "round",
  });

  let lineGeometry = new THREE.BufferGeometry().setFromPoints([point, point]);
  return new THREE.Line(lineGeometry, lineMaterial);
}

function initAxisLine(point, type) {
  const color = type === "x" ? "red" : type === "y" ? "green" : "blue";
  let lineMaterial = new THREE.LineBasicMaterial({
    color,
    linewidth: 5,
    linecap: "round",
  });

  let lineGeometry = new THREE.BufferGeometry().setFromPoints([
    new Vector3(0, 0, 0),
    point,
  ]);
  return new THREE.Line(lineGeometry, lineMaterial);
}

function updateLine(matrix) {
  let positions = currentLine.geometry.attributes.position.array;
  positions[3] = matrix.elements[12];
  positions[4] = matrix.elements[13];
  positions[5] = matrix.elements[14];
  currentLine.geometry.attributes.position.needsUpdate = true;
  currentLine.geometry.computeBoundingSphere();
}

function drawAxis() {
  const zeroVector = new Vector3(0, 0, 0);
  const xUnitVector = new Vector3(5, 0, 0);
  const yUnitVector = new Vector3(0, 5, 0);
  const zUnitVector = new Vector3(0, 0, 5);
  let xText = document.createElement("div");
  let yText = document.createElement("div");
  let zText = document.createElement("div");
  xText.className = "label";
  xText.style.color = "red";
  xText.textContent = "X axis";
  document.querySelector("#container").appendChild(xText);

  labels.push({
    div: xText,
    point: getCenterPoint([zeroVector, xUnitVector]),
  });

  yText.className = "label";
  yText.style.color = "green";
  yText.textContent = "Y axis";
  document.querySelector("#container").appendChild(yText);

  labels.push({
    div: yText,
    point: getCenterPoint([zeroVector, yUnitVector]),
  });

  zText.className = "label";
  zText.style.color = "blue";
  zText.textContent = "Z axis";

  document.querySelector("#container").appendChild(zText);

  labels.push({
    div: zText,
    point: getCenterPoint([zeroVector, zUnitVector]),
  });

  axisXLine = initAxisLine(xUnitVector, "x");
  axisYLine = initAxisLine(yUnitVector, "y");
  axisZLine = initAxisLine(zUnitVector, "z");
  scene.add(axisXLine);
  scene.add(axisYLine);
  scene.add(axisZLine);
}

function initReticle() {
  let ring = new THREE.RingBufferGeometry(0.045, 0.05, 32).rotateX(
    -Math.PI / 2
  );
  let dot = new THREE.CircleBufferGeometry(0.005, 32).rotateX(-Math.PI / 2);
  reticle = new THREE.Mesh(
    BufferGeometryUtils.mergeBufferGeometries([ring, dot]),
    new THREE.MeshBasicMaterial()
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
}

function initRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
}

function initLabelContainer() {
  labelContainer = document.createElement("div");
  labelContainer.style.position = "absolute";
  labelContainer.style.top = "0px";
  labelContainer.style.pointerEvents = "none";
  labelContainer.setAttribute("id", "container");
}

function initCamera() {
  camera = new THREE.PerspectiveCamera(70, width / height, 0.01, 20);
}

function initLight() {
  light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 5);
  light.position.set(0.5, 1, 0.25);
}

function initScene() {
  scene = new THREE.Scene();
}

function getDistance(points) {
  if (points.length <= 1) return 0;
  if (points.length == 2) return points[0].distanceTo(points[1]);
  if (points.length == 3) return points[1].distanceTo(points[2]);
}

function init3DLoader() {
  const loader = new GLTFLoader();

  loader.load(
    // "src/models/wood-table-3d-model/wood_table_001_4k.gltf",
    // "src/models/nonTextureTile/nonTextureTile.gltf",
    "src/models/woodTile/woodTile.gltf",
    function (gltf) {
      model3D = gltf.scene;
      model3D.position.set(0.0001, 0, 0);
      model3D.scale.set(0.01, 0.01, 0.01);
      // scene.add(gltf.scene);
      // scene.add(model3D);
    },
    undefined,
    function (error) {
      console.error(error);
    }
  );
}

function initXR() {
  container = document.createElement("div");
  document.body.appendChild(container);

  width = window.innerWidth;
  height = window.innerHeight;

  initScene();

  initCamera();

  initLight();
  scene.add(light);

  initRenderer();
  container.appendChild(renderer.domElement);

  initLabelContainer();
  container.appendChild(labelContainer);

  document.body.appendChild(
    ARButton.createButton(renderer, {
      optionalFeatures: ["dom-overlay"],
      domOverlay: { root: document.querySelector("#container") },
      requiredFeatures: ["hit-test"],
    })
  );

  controller = renderer.xr.getController(0);
  controller.addEventListener("select", onSelect);
  scene.add(controller);

  init3DLoader();

  initReticle();
  scene.add(reticle);

  window.addEventListener("resize", onWindowResize, false);
  animate();

  drawAxis();
}

function onSelect() {
  if (reticle.visible) {
    measurements.push(matrixToVector(reticle.matrix));
    if (measurements.length == 2) {
      let distance = Math.round(getDistance(measurements) * 100);
      distances.push(distance);

      let text = document.createElement("div");
      text.className = "label";
      text.style.color = "rgb(255,255,255)";
      text.textContent = distance + " cm";

      document.querySelector("#container").appendChild(text);

      labels.push({
        div: text,
        point: getCenterPoint([measurements[0], measurements[1]]),
      });

      currentLine = initLine(measurements[1]);
      scene.add(currentLine);
      // measurements = [];
      // currentLine = null;
    } else if (measurements.length == 3) {
      scene.add(model3D);
      let distance = Math.round(getDistance(measurements) * 100);
      distances.push(distance);

      let text = document.createElement("div");
      text.className = "label";
      // text.style.color = "rgb(37,219,0)";
      text.style.color = "rgb(255,255,255)";
      text.textContent = distance + " cm";

      document.querySelector("#container").appendChild(text);

      labels.push({
        div: text,
        point: getCenterPoint([measurements[1], measurements[2]]),
      });

      measurements = [];
      currentLine = null;
    } else {
      currentLine = initLine(measurements[0]);
      scene.add(currentLine);
    }
  }
}

function onWindowResize() {
  width = window.innerWidth;
  height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
  if (frame) {
    let referenceSpace = renderer.xr.getReferenceSpace();
    let session = renderer.xr.getSession();
    if (hitTestSourceRequested === false) {
      session.requestReferenceSpace("viewer").then(function (referenceSpace) {
        session
          .requestHitTestSource({ space: referenceSpace })
          .then(function (source) {
            hitTestSource = source;
          });
      });
      session.addEventListener("end", function () {
        hitTestSourceRequested = false;
        hitTestSource = null;
      });
      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      let hitTestResults = frame.getHitTestResults(hitTestSource);
      if (hitTestResults.length) {
        let hit = hitTestResults[0];
        reticle.visible = true;
        reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
      } else {
        reticle.visible = false;
      }

      if (currentLine) {
        updateLine(reticle.matrix);
      }
      if (axisXLine) {
        // updateAxisXLine(reticle.matrix);
      }
    }

    labels.map((label) => {
      let pos = toScreenPosition(label.point, renderer.xr.getCamera(camera));
      let x = pos.x;
      let y = pos.y;
      label.div.style.transform =
        "translate(-50%, -50%) translate(" + x + "px," + y + "px)";
    });
  }
  renderer.render(scene, camera);
}

export { initXR };
