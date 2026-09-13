import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Realistic 3D hardware rig showing all physical components of the
 * irrigation system: ESP32 board, capacitive soil moisture sensor,
 * relay module, water pump, reservoir, plant pot with soil, and
 * connecting wires. Includes animated water flow when watering is
 * active, soil that darkens when wet, and a plant that droops when dry.
 *
 * Hover over any component to see its label.
 */
export default function HardwareRig3D({ watering = false, moisture = 50 }) {
  const mountRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const wateringRef = useRef(watering);
  const moistureRef = useRef(moisture);
  wateringRef.current = watering;
  moistureRef.current = moisture;

  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeef2f6);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(6, 5, 7);
    camera.lookAt(0, 1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.target.set(0, 1, 0);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0xb0c4de, 0.3);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);

    // Wooden bench/table surface
    const benchGeo = new THREE.BoxGeometry(12, 0.2, 8);
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x8b6f47, roughness: 0.8 });
    const bench = new THREE.Mesh(benchGeo, benchMat);
    bench.position.y = 0;
    bench.receiveShadow = true;
    scene.add(bench);

    // Helper to create a labeled mesh
    const labeledMeshes = [];
    function makeLabeled(mesh, label) {
      mesh.userData.label = label;
      labeledMeshes.push(mesh);
      return mesh;
    }

    // --- ESP32 DevKit board ---
    const esp32Group = new THREE.Group();
    const boardGeo = new THREE.BoxGeometry(2.2, 0.12, 0.9);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.6 });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.castShadow = true;
    esp32Group.add(board);

    // ESP32 metal can (WiFi shield)
    const canGeo = new THREE.BoxGeometry(0.7, 0.2, 0.5);
    const canMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.8, roughness: 0.3 });
    const metalCan = new THREE.Mesh(canGeo, canMat);
    metalCan.position.set(0.55, 0.16, 0);
    esp32Group.add(metalCan);

    // USB port
    const usbGeo = new THREE.BoxGeometry(0.25, 0.18, 0.35);
    const usbMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7 });
    const usbPort = new THREE.Mesh(usbGeo, usbMat);
    usbPort.position.set(-1.1, 0.06, 0);
    esp32Group.add(usbPort);

    // Pin headers (two rows of gold pins)
    const pinMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9 });
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 15; i++) {
        const pin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.06), pinMat);
        pin.position.set(-1.0 + i * 0.14, 0.11, row === 0 ? -0.38 : 0.38);
        esp32Group.add(pin);
      }
    }

    // Onboard LED
    const ledMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x004400 });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), ledMat);
    led.position.set(-0.6, 0.1, -0.3);
    esp32Group.add(led);

    esp32Group.position.set(-2.5, 0.16, 0.5);
    scene.add(esp32Group);
    makeLabeled(board, 'ESP32 DevKit v1 (12-bit ADC, WiFi)');

    // --- Capacitive soil moisture sensor ---
    const sensorGroup = new THREE.Group();
    // Sensor module PCB
    const pcbGeo = new THREE.BoxGeometry(1.0, 0.08, 0.6);
    const pcbMat = new THREE.MeshStandardMaterial({ color: 0x004400, roughness: 0.7 });
    const pcb = new THREE.Mesh(pcbGeo, pcbMat);
    sensorGroup.add(pcb);

    // Potentiometer on module
    const potGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16);
    const potMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 });
    const pot = new THREE.Mesh(potGeo, potMat);
    pot.position.set(0.25, 0.07, 0.15);
    sensorGroup.add(pot);

    // Connector header
    const connGeo = new THREE.BoxGeometry(0.3, 0.06, 0.2);
    const connMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const conn = new THREE.Mesh(connGeo, connMat);
    conn.position.set(-0.35, 0.07, 0);
    sensorGroup.add(conn);

    sensorGroup.position.set(-0.5, 0.14, -1.5);
    scene.add(sensorGroup);
    makeLabeled(pcb, 'Capacitive Soil Moisture Sensor v1.2');

    // Sensor probe (the part that goes into soil)
    const probeGeo = new THREE.BoxGeometry(0.12, 1.2, 0.4);
    const probeMat = new THREE.MeshStandardMaterial({ color: 0x006400, roughness: 0.8 });
    const probe = new THREE.Mesh(probeGeo, probeMat);
    probe.position.set(0.8, 0.6, 0.8);
    probe.rotation.z = 0.1;
    scene.add(probe);
    makeLabeled(probe, 'Capacitive probe (inserted into soil)');

    // --- Relay module ---
    const relayGroup = new THREE.Group();
    const relayBoardGeo = new THREE.BoxGeometry(1.2, 0.08, 0.7);
    const relayBoardMat = new THREE.MeshStandardMaterial({ color: 0x004400, roughness: 0.7 });
    const relayBoard = new THREE.Mesh(relayBoardGeo, relayBoardMat);
    relayGroup.add(relayBoard);

    // Relay box (the blue box on the module)
    const relayBoxGeo = new THREE.BoxGeometry(0.6, 0.4, 0.45);
    const relayBoxMat = new THREE.MeshStandardMaterial({ color: 0x1e90ff, roughness: 0.5 });
    const relayBox = new THREE.Mesh(relayBoxGeo, relayBoxMat);
    relayBox.position.set(0.1, 0.24, 0);
    relayGroup.add(relayBox);

    // Screw terminals
    for (let i = 0; i < 3; i++) {
      const termGeo = new THREE.BoxGeometry(0.12, 0.08, 0.12);
      const termMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6 });
      const term = new THREE.Mesh(termGeo, termMat);
      term.position.set(-0.45 + i * 0.18, 0.08, 0.25);
      relayGroup.add(term);
    }

    relayGroup.position.set(1.5, 0.14, -1.2);
    scene.add(relayGroup);
    makeLabeled(relayBoard, '1-Channel 5V Relay Module (opto-isolated)');

    // --- Water reservoir ---
    const resGroup = new THREE.Group();
    const resGeo = new THREE.CylinderGeometry(0.7, 0.6, 1.2, 24);
    const resMat = new THREE.MeshStandardMaterial({
      color: 0x4488aa,
      transparent: true,
      opacity: 0.5,
      roughness: 0.1,
      metalness: 0.3,
    });
    const reservoir = new THREE.Mesh(resGeo, resMat);
    reservoir.position.y = 0.6;
    resGroup.add(reservoir);

    // Water level inside reservoir
    const waterGeo = new THREE.CylinderGeometry(0.65, 0.55, 0.7, 24);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x2266aa,
      transparent: true,
      opacity: 0.7,
    });
    const resWater = new THREE.Mesh(waterGeo, waterMat);
    resWater.position.y = 0.4;
    resGroup.add(resWater);

    resGroup.position.set(2.8, 0.1, 0.5);
    scene.add(resGroup);
    makeLabeled(reservoir, 'Water Reservoir');

    // --- Water pump (submersible, inside reservoir) ---
    const pumpGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 });
    const pump = new THREE.Mesh(pumpGeo, pumpMat);
    pump.position.set(2.8, 0.3, 0.5);
    scene.add(pump);
    makeLabeled(pump, '5V DC Submersible Water Pump');

    // --- Plant pot with soil ---
    const potGroup = new THREE.Group();

    // Pot (trapezoidal cylinder)
    const plantPotGeo = new THREE.CylinderGeometry(0.55, 0.4, 1.0, 24);
    const plantPotMat = new THREE.MeshStandardMaterial({ color: 0xa0522d, roughness: 0.8 });
    const plantPot = new THREE.Mesh(plantPotGeo, plantPotMat);
    plantPot.position.y = 0.5;
    potGroup.add(plantPot);

    // Soil inside pot (color changes with moisture)
    const soilGeo = new THREE.CylinderGeometry(0.5, 0.42, 0.15, 24);
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.95 });
    const soil = new THREE.Mesh(soilGeo, soilMat);
    soil.position.y = 0.92;
    soil.name = 'soil';
    potGroup.add(soil);

    // Plant stem
    const stemGeo = new THREE.CylinderGeometry(0.04, 0.06, 1.0, 8);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 1.45;
    stem.name = 'stem';
    potGroup.add(stem);

    // Plant leaves
    for (let i = 0; i < 5; i++) {
      const leafGeo = new THREE.SphereGeometry(0.2, 8, 6);
      leafGeo.scale(1, 0.4, 0.7);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x32cd32, roughness: 0.7 });
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      const angle = (i / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(angle) * 0.18, 1.8 + Math.sin(i) * 0.1, Math.sin(angle) * 0.18);
      leaf.rotation.z = Math.cos(angle) * 0.3;
      leaf.name = 'leaf';
      potGroup.add(leaf);
    }

    potGroup.position.set(0.8, 0.1, 0.8);
    scene.add(potGroup);
    makeLabeled(plantPot, 'Plant Pot with Soil');

    // --- Jumper wires (colored cylinders connecting components) ---
    function makeWire(x1, y1, z1, x2, y2, z2, color) {
      const start = new THREE.Vector3(x1, y1, z1);
      const end = new THREE.Vector3(x2, y2, z2);
      const dir = new THREE.Vector3().subVectors(end, start);
      const len = dir.length();
      const wireGeo = new THREE.CylinderGeometry(0.025, 0.025, len, 8);
      const wireMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      const wire = new THREE.Mesh(wireGeo, wireMat);
      wire.position.copy(start.clone().add(end).multiplyScalar(0.5));
      wire.lookAt(end);
      wire.rotateX(Math.PI / 2);
      scene.add(wire);
      return wire;
    }

    // Sensor -> ESP32 (3 wires)
    makeWire(-0.85, 0.18, -1.5, -3.0, 0.22, 0.12, 0xff0000); // VCC red
    makeWire(-0.85, 0.18, -1.6, -3.0, 0.22, 0.0, 0x000000); // GND black
    makeWire(-0.85, 0.18, -1.4, -3.0, 0.22, -0.12, 0xffff00); // A0 yellow

    // ESP32 -> Relay (control wire)
    makeWire(-1.8, 0.22, 0.5, 1.0, 0.18, -1.2, 0xff8c00); // GPIO control

    // Relay -> Pump (power switched through relay)
    makeWire(2.0, 0.18, -1.2, 2.8, 0.3, 0.5, 0x00aa00);

    // --- Water tube from pump to pot ---
    const tubeGeo = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(2.8, 0.5, 0.5),
        new THREE.Vector3(2.2, 0.8, 0.6),
        new THREE.Vector3(1.5, 1.0, 0.7),
        new THREE.Vector3(1.0, 1.0, 0.8),
        new THREE.Vector3(0.8, 0.95, 0.8),
      ]),
      20,
      0.04,
      8
    );
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x88aacc, transparent: true, opacity: 0.6 });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    scene.add(tube);
    makeLabeled(tube, 'Water delivery tube');

    // Animated water droplets
    const droplets = [];
    for (let i = 0; i < 8; i++) {
      const dropGeo = new THREE.SphereGeometry(0.04, 8, 8);
      const dropMat = new THREE.MeshStandardMaterial({ color: 0x2299ff, transparent: true, opacity: 0.8 });
      const drop = new THREE.Mesh(dropGeo, dropMat);
      drop.visible = false;
      drop.userData.progress = i / 8;
      scene.add(drop);
      droplets.push(drop);
    }

    // Power supply (5V/2A USB)
    const psuGeo = new THREE.BoxGeometry(0.8, 0.5, 0.8);
    const psuMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    const psu = new THREE.Mesh(psuGeo, psuMat);
    psu.position.set(-4.0, 0.25, 1.5);
    scene.add(psu);
    makeLabeled(psu, '5V/2A Power Supply (USB)');

    // Separate pump power supply
    const psu2Geo = new THREE.BoxGeometry(0.6, 0.4, 0.6);
    const psu2 = new THREE.Mesh(psu2Geo, psuMat);
    psu2.position.set(3.8, 0.2, 1.5);
    scene.add(psu2);
    makeLabeled(psu2, 'Pump Power Supply (separate)');

    // Raycaster for hover labels
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function handlePointerMove(event) {
      const rect = mount.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(labeledMeshes, true);

      if (hits.length > 0) {
        let obj = hits[0].object;
        while (obj && !obj.userData.label) obj = obj.parent;
        if (obj && obj.userData.label) {
          setTooltip({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            label: obj.userData.label,
          });
        }
      } else {
        setTooltip(null);
      }
    }

    function handlePointerLeave() {
      setTooltip(null);
    }

    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);

    let frameId;
    const tubePoints = tubeGeo.parameters.path.getPoints(50);

    function animate() {
      frameId = requestAnimationFrame(animate);
      controls.update();

      const isWatering = wateringRef.current;
      const moist = moistureRef.current;

      // Soil color: darker when wet
      const dryColor = new THREE.Color(0x8b6914);
      const wetColor = new THREE.Color(0x3d2817);
      const soilColor = dryColor.clone().lerp(wetColor, moist / 100);
      soil.material.color.copy(soilColor);

      // Plant droops when dry
      const droopFactor = 1 - moist / 100;
      stem.rotation.z = droopFactor * 0.3;
      potGroup.children.forEach((child) => {
        if (child.name === 'leaf') {
          child.position.y = 1.8 + Math.sin(child.rotation.z) * 0.1 - droopFactor * 0.15;
        }
      });

      // Pump vibration when active
      if (isWatering) {
        pump.position.x = 2.8 + (Math.random() - 0.5) * 0.02;
        pump.position.z = 0.5 + (Math.random() - 0.5) * 0.02;
      } else {
        pump.position.x = 2.8;
        pump.position.z = 0.5;
      }

      // Water droplets flow along tube when watering
      droplets.forEach((drop) => {
        if (isWatering) {
          drop.visible = true;
          drop.userData.progress += 0.015;
          if (drop.userData.progress > 1) drop.userData.progress -= 1;
          const idx = Math.floor(drop.userData.progress * (tubePoints.length - 1));
          const pt = tubePoints[idx];
          if (pt) {
            drop.position.copy(pt);
            drop.material.opacity = 0.8 * (1 - Math.abs(drop.userData.progress - 0.5) * 0.5);
          }
        } else {
          drop.visible = false;
        }
      });

      // Relay LED blink when active
      relayBox.material.emissive = isWatering
        ? new THREE.Color(0x0044ff)
        : new THREE.Color(0x000000);

      renderer.render(scene, camera);
    }
    animate();

    function handleResize() {
      const w = mount.clientWidth;
      const h = mount.clientHeight || 400;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
      controls.dispose();
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={mountRef} className="relative w-full h-full rounded-lg overflow-hidden border" style={{ minHeight: '400px' }}>
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-white border rounded shadow px-2 py-1 text-xs z-10"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          {tooltip.label}
        </div>
      )}
    </div>
  );
}
