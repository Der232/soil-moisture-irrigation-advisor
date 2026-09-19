import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Renders each garden zone as a 3D plot with a mini hardware rig beside it.
 * Each rig shows an ESP32 board, capacitive sensor probe in the soil, relay
 * module, water pump, and reservoir — all labeled. Soil color shifts from
 * dry (light brown) to moist (dark brown) in real time. When a zone drops
 * below its watering threshold, animated water droplets flow from the
 * reservoir through the tube into the soil, and the relay LED lights up.
 *
 * Zone labels (Zone A, Zone B, etc.) float above each plot. Hovering any
 * hardware component shows its name. Hovering a plot shows moisture data.
 */
export default function GardenScene3D({ zones, readingsByZone }) {
  const mountRef = useRef(null);
  const stateRef = useRef({});
  const readingsRef = useRef(readingsByZone);
  readingsRef.current = readingsByZone;

  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(4, 5, 7);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.1;

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    const directional = new THREE.DirectionalLight(0xffffff, 0.6);
    directional.position.set(5, 10, 5);
    scene.add(ambient, directional);

    // Ground plane
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0xdcd3c0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    scene.add(ground);

    const labeledMeshes = [];
    function makeLabeled(mesh, label) {
      mesh.userData.label = label;
      labeledMeshes.push(mesh);
      return mesh;
    }

    // Create text sprites for zone labels and hardware labels
    function makeTextSprite(text, opts = {}) {
      const fontSize = opts.fontSize || 48;
      const bgColor = opts.bgColor || 'rgba(255,255,255,0.85)';
      const textColor = opts.textColor || '#1e293b';
      const pad = 8;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = `bold ${fontSize}px Arial`;
      const metrics = ctx.measureText(text);
      canvas.width = metrics.width + pad * 2;
      canvas.height = fontSize + pad * 2;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.fillStyle = textColor;
      ctx.textBaseline = 'middle';
      ctx.fillText(text, pad, canvas.height / 2);
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      const scale = opts.scale || 0.6;
      sprite.scale.set(canvas.width / canvas.height * scale, scale, 1);
      return sprite;
    }

    stateRef.current.plots = {};
    stateRef.current.soils = {};
    stateRef.current.sprinklers = {};
    stateRef.current.droplets = {};
    stateRef.current.relayLEDs = {};
    stateRef.current.zoneData = {};

    zones.forEach((zone) => {
      const cx = zone.grid_x * 3.5;
      const cz = zone.grid_y * 3.5;

      // --- Garden plot (soil bed) ---
      const plotGeo = new THREE.BoxGeometry(2.0, 0.35, 2.0);
      const plotMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.95 });
      const plot = new THREE.Mesh(plotGeo, plotMat);
      plot.position.set(cx, 0.175, cz);
      plot.userData.zoneId = zone.id;
      plot.userData.zoneName = zone.name;
      scene.add(plot);
      makeLabeled(plot, zone.name);
      stateRef.current.plots[zone.id] = plot;

      // Soil surface (thin layer on top that changes color with moisture)
      const soilGeo = new THREE.BoxGeometry(1.9, 0.08, 1.9);
      const soilMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.95 });
      const soil = new THREE.Mesh(soilGeo, soilMat);
      soil.position.set(cx, 0.39, cz);
      scene.add(soil);
      stateRef.current.soils[zone.id] = soil;

      // Zone label floating above the plot
      const zoneLabel = makeTextSprite(zone.name, { scale: 0.7, bgColor: 'rgba(30,41,59,0.9)', textColor: '#ffffff' });
      zoneLabel.position.set(cx, 1.2, cz - 1.2);
      scene.add(zoneLabel);

      // --- Hardware rig beside the plot ---
      // ESP32 board
      const espGeo = new THREE.BoxGeometry(0.6, 0.06, 0.28);
      const espMat = new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.6 });
      const esp32 = new THREE.Mesh(espGeo, espMat);
      esp32.position.set(cx + 1.5, 0.13, cz - 0.8);
      scene.add(esp32);
      makeLabeled(esp32, 'ESP32 DevKit v1');

      // ESP32 metal can (WiFi shield)
      const canGeo = new THREE.BoxGeometry(0.2, 0.08, 0.15);
      const canMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.8 });
      const espCan = new THREE.Mesh(canGeo, canMat);
      espCan.position.set(cx + 1.6, 0.19, cz - 0.8);
      scene.add(espCan);

      // Capacitive sensor probe (inserted into the soil)
      const probeGeo = new THREE.BoxGeometry(0.06, 0.5, 0.12);
      const probeMat = new THREE.MeshStandardMaterial({ color: 0x006400, roughness: 0.8 });
      const probe = new THREE.Mesh(probeGeo, probeMat);
      probe.position.set(cx + 0.7, 0.55, cz + 0.6);
      probe.rotation.z = 0.05;
      scene.add(probe);
      makeLabeled(probe, 'Capacitive Soil Sensor');

      // Sensor module PCB (connected to probe, sitting beside ESP32)
      const sensorPcbGeo = new THREE.BoxGeometry(0.3, 0.04, 0.18);
      const sensorPcbMat = new THREE.MeshStandardMaterial({ color: 0x004400 });
      const sensorPcb = new THREE.Mesh(sensorPcbGeo, sensorPcbMat);
      sensorPcb.position.set(cx + 1.2, 0.11, cz - 0.8);
      scene.add(sensorPcb);

      // Relay module
      const relayGeo = new THREE.BoxGeometry(0.38, 0.06, 0.22);
      const relayMat = new THREE.MeshStandardMaterial({ color: 0x004400 });
      const relay = new THREE.Mesh(relayGeo, relayMat);
      relay.position.set(cx + 1.5, 0.13, cz - 0.3);
      scene.add(relay);
      makeLabeled(relay, '5V Relay Module');

      // Relay box (blue cube on top)
      const relayBoxGeo = new THREE.BoxGeometry(0.2, 0.14, 0.15);
      const relayBoxMat = new THREE.MeshStandardMaterial({ color: 0x1e90ff, roughness: 0.5 });
      const relayBox = new THREE.Mesh(relayBoxGeo, relayBoxMat);
      relayBox.position.set(cx + 1.5, 0.22, cz - 0.3);
      scene.add(relayBox);

      // Relay LED (lights up when watering)
      const ledGeo = new THREE.SphereGeometry(0.03, 8, 8);
      const ledMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x000000 });
      const relayLED = new THREE.Mesh(ledGeo, ledMat);
      relayLED.position.set(cx + 1.62, 0.3, cz - 0.3);
      scene.add(relayLED);
      stateRef.current.relayLEDs[zone.id] = relayLED;

      // Water reservoir
      const resGeo = new THREE.CylinderGeometry(0.18, 0.15, 0.35, 16);
      const resMat = new THREE.MeshStandardMaterial({ color: 0x4488aa, transparent: true, opacity: 0.5 });
      const reservoir = new THREE.Mesh(resGeo, resMat);
      reservoir.position.set(cx + 1.5, 0.275, cz + 0.2);
      scene.add(reservoir);
      makeLabeled(reservoir, 'Water Reservoir');

      // Water inside reservoir
      const resWaterGeo = new THREE.CylinderGeometry(0.16, 0.13, 0.2, 16);
      const resWaterMat = new THREE.MeshStandardMaterial({ color: 0x2266aa, transparent: true, opacity: 0.7 });
      const resWater = new THREE.Mesh(resWaterGeo, resWaterMat);
      resWater.position.set(cx + 1.5, 0.22, cz + 0.2);
      scene.add(resWater);

      // Water pump (small box beside reservoir)
      const pumpGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const pumpMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 });
      const pump = new THREE.Mesh(pumpGeo, pumpMat);
      pump.position.set(cx + 1.3, 0.16, cz + 0.2);
      scene.add(pump);
      makeLabeled(pump, 'Water Pump');

      // Water tube from reservoir to soil
      const tubeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(cx + 1.5, 0.45, cz + 0.2),
        new THREE.Vector3(cx + 1.2, 0.5, cz + 0.1),
        new THREE.Vector3(cx + 0.9, 0.5, cz + 0.0),
        new THREE.Vector3(cx + 0.6, 0.45, cz + 0.3),
        new THREE.Vector3(cx + 0.3, 0.42, cz + 0.5),
      ]);
      const tubeGeo = new THREE.TubeGeometry(tubeCurve, 16, 0.025, 6);
      const tubeMat = new THREE.MeshStandardMaterial({ color: 0x88aacc, transparent: true, opacity: 0.6 });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      scene.add(tube);

      // Animated water droplets along the tube
      const droplets = [];
      const tubePoints = tubeCurve.getPoints(30);
      for (let i = 0; i < 5; i++) {
        const dropGeo = new THREE.SphereGeometry(0.035, 8, 8);
        const dropMat = new THREE.MeshStandardMaterial({ color: 0x2299ff, transparent: true, opacity: 0.8 });
        const drop = new THREE.Mesh(dropGeo, dropMat);
        drop.visible = false;
        drop.userData.progress = i / 5;
        scene.add(drop);
        droplets.push(drop);
      }
      stateRef.current.droplets[zone.id] = { meshes: droplets, points: tubePoints };

      // Sprinkler indicator (rising blue pillar when watering active)
      const sprinklerGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
      const sprinklerMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.7 });
      const sprinkler = new THREE.Mesh(sprinklerGeo, sprinklerMat);
      sprinkler.position.set(cx, 0.8, cz);
      sprinkler.visible = false;
      scene.add(sprinkler);
      stateRef.current.sprinklers[zone.id] = sprinkler;

      // Hardware label
      const hwLabel = makeTextSprite('Hardware Rig', { scale: 0.35, bgColor: 'rgba(100,116,139,0.85)', textColor: '#ffffff' });
      hwLabel.position.set(cx + 1.5, 0.6, cz - 0.8);
      scene.add(hwLabel);

      // Wires (simple thin cylinders)
      function makeWire(x1, y1, z1, x2, y2, z2, color) {
        const start = new THREE.Vector3(x1, y1, z1);
        const end = new THREE.Vector3(x2, y2, z2);
        const dir = new THREE.Vector3().subVectors(end, start);
        const len = dir.length();
        const wireGeo = new THREE.CylinderGeometry(0.012, 0.012, len, 6);
        const wireMat = new THREE.MeshStandardMaterial({ color });
        const wire = new THREE.Mesh(wireGeo, wireMat);
        wire.position.copy(start.clone().add(end).multiplyScalar(0.5));
        wire.lookAt(end);
        wire.rotateX(Math.PI / 2);
        scene.add(wire);
      }
      // Sensor -> ESP32
      makeWire(cx + 1.05, 0.13, cz - 0.8, cx + 1.35, 0.13, cz - 0.8, 0xffff00);
      // ESP32 -> Relay
      makeWire(cx + 1.5, 0.16, cz - 0.65, cx + 1.5, 0.16, cz - 0.42, 0xff8c00);
      // Relay -> Pump
      makeWire(cx + 1.45, 0.16, cz - 0.25, cx + 1.35, 0.16, cz + 0.15, 0x00aa00);

      stateRef.current.zoneData[zone.id] = { cx, cz };
    });

    // Center camera
    const avgX = zones.reduce((s, z) => s + z.grid_x, 0) / (zones.length || 1);
    const avgZ = zones.reduce((s, z) => s + z.grid_y, 0) / (zones.length || 1);
    camera.position.set(avgX * 3.5 + 5, 6, avgZ * 3.5 + 7);
    controls.target.set(avgX * 3.5, 0, avgZ * 3.5);
    controls.update();

    // Raycasting for hover tooltips
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
          const reading = readingsRef.current[obj.userData.zoneId];
          setTooltip({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            label: obj.userData.label,
            moisture: reading ? reading.moisture_percent : null,
            isZone: !!obj.userData.zoneId,
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
    function animate() {
      frameId = requestAnimationFrame(animate);
      controls.update();

      zones.forEach((zone) => {
        const plot = stateRef.current.plots[zone.id];
        const soil = stateRef.current.soils[zone.id];
        const sprinkler = stateRef.current.sprinklers[zone.id];
        const relayLED = stateRef.current.relayLEDs[zone.id];
        const dropData = stateRef.current.droplets[zone.id];
        const reading = readingsRef.current[zone.id];
        if (!plot || !reading) return;

        const moisture = reading.moisture_percent;
        const threshold = Number(zone.moisture_threshold ?? 30);
        const hasReading = Number.isFinite(Number(moisture));
        const isDry = hasReading && moisture < threshold;
        // Animation must represent an actual completed simulation event.
        // Being below a threshold is only a recommendation, not proof that
        // a pump ran; live API readings without this field stay still.
        const isWatering = reading.irrigation_active === true;

        // Plot color: red-brown when dry, amber when moderate, green when wet
        let plotColor;
        if (isDry) plotColor = 0xb45309;
        else if (hasReading && moisture < threshold + 30) plotColor = 0xca8a04;
        else plotColor = 0x16a34a;
        plot.material.color.setHex(plotColor);

        // Soil color: lerp from dry (light) to wet (dark) based on moisture
        if (soil) {
          const dryCol = new THREE.Color(0xc4a35a);
          const wetCol = new THREE.Color(0x3d2817);
          const soilCol = dryCol.clone().lerp(wetCol, hasReading ? moisture / 100 : 0);
          soil.material.color.copy(soilCol);
        }

        // Sprinkler animation
        if (sprinkler) {
          sprinkler.visible = isWatering;
          if (sprinkler.visible) {
            sprinkler.scale.y = 1 + Math.sin(Date.now() / 200) * 0.15;
          }
        }

        // Relay LED
        if (relayLED) {
          relayLED.material.emissive.setHex(isWatering ? 0xff0000 : 0x000000);
        }

        // Water droplets
        if (dropData) {
          dropData.meshes.forEach((drop) => {
            if (isWatering) {
              drop.visible = true;
              drop.userData.progress += 0.02;
              if (drop.userData.progress > 1) drop.userData.progress -= 1;
              const idx = Math.floor(drop.userData.progress * (dropData.points.length - 1));
              const pt = dropData.points[idx];
              if (pt) drop.position.copy(pt);
              drop.material.opacity = 0.8 * (1 - Math.abs(drop.userData.progress - 0.5) * 0.4);
            } else {
              drop.visible = false;
            }
          });
        }
      });

      renderer.render(scene, camera);
    }
    animate();

    function handleResize() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones]);

  return (
    <div ref={mountRef} className="relative w-full h-full rounded-lg overflow-hidden border">
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-white border rounded shadow px-2 py-1 text-xs z-10"
          style={{ left: tooltip.x + 10, top: tooltip.y + 10 }}
        >
          <p className="font-medium">{tooltip.label}</p>
          {tooltip.isZone && (
            <p>{tooltip.moisture !== null ? `${tooltip.moisture}% moisture` : 'No reading yet'}</p>
          )}
        </div>
      )}
    </div>
  );
}
