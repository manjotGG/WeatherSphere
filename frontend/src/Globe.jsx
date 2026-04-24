import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

export default function Globe() {
  const mountRef = useRef(null);
  const debounceRef = useRef(null);

  const [tooltip, setTooltip] = useState({
    x: 0,
    y: 0,
    lat: null,
    lon: null,
    temp: null,
    visible: false,
  });

  useEffect(() => {
    if (!mountRef.current) return;

    // clean old canvas
    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }

    const scene = new THREE.Scene();

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 0, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);

    mountRef.current.appendChild(renderer.domElement);

    // 🌍 Globe
    const geometry = new THREE.SphereGeometry(5, 64, 64);

    const texture = new THREE.TextureLoader().load(
      window.location.origin + "/earth_texture.jpg"
    );

    const material = new THREE.MeshBasicMaterial({ map: texture });
    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    // 🔴 Highlight dot
    const highlightGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const highlightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const highlight = new THREE.Mesh(highlightGeo, highlightMat);
    scene.add(highlight);
    highlight.visible = false;

    // 🎮 Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enableZoom = true;
    controls.minDistance = 6;
    controls.maxDistance = 20;
    controls.enablePan = false;

    // 🎯 Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();

      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(globe);

      if (intersects.length > 0) {
        const point = intersects[0].point;

        // move highlight
        highlight.position
          .copy(point.clone().normalize().multiplyScalar(5.05));
        highlight.visible = true;

        const radius = 5;

        const lat =
          90 - (Math.acos(point.y / radius) * 180) / Math.PI;

        const lon =
          ((Math.atan2(point.z, point.x) * 180) / Math.PI + 180) %
            360 -
          180;

        setTooltip((prev) => ({
          ...prev,
          x: event.clientX,
          y: event.clientY,
          lat: lat.toFixed(2),
          lon: lon.toFixed(2),
          visible: true,
        }));
      } else {
        highlight.visible = false;
        setTooltip((prev) => ({ ...prev, visible: false }));
      }
    };

    window.addEventListener("mousemove", onMouseMove);

    // 🔁 Animation
    let frameId;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // 📱 Resize
    const handleResize = () => {
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;

      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", onMouseMove);
      renderer.dispose();
    };
  }, []);

  // 🌦️ Debounced Weather Fetch (NO LAG)
  useEffect(() => {
    if (!tooltip.lat || !tooltip.lon) return;

    clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${tooltip.lat}&longitude=${tooltip.lon}&current_weather=true`
        );

        const data = await res.json();

        const temp = data?.current_weather?.temperature;

        setTooltip((prev) => ({
          ...prev,
          temp: temp ?? "N/A",
        }));
      } catch (err) {
        console.log("Weather error:", err);
      }
    }, 400); // smooth delay
  }, [tooltip.lat, tooltip.lon]);

  return (
    <>
      <div
        ref={mountRef}
        style={{ width: "100vw", height: "100vh" }}
      />

      {/* 💬 Tooltip */}
      {tooltip.visible && (
        <div
          style={{
            position: "fixed",
            top: tooltip.y + 12,
            left: tooltip.x + 12,
            background: "rgba(0,0,0,0.8)",
            color: "#fff",
            padding: "10px 12px",
            borderRadius: "10px",
            fontSize: "13px",
            pointerEvents: "none",
            backdropFilter: "blur(6px)",
          }}
        >
          🌍 {tooltip.lat}, {tooltip.lon} <br />
          🌡️ {tooltip.temp ?? "..."} °C
        </div>
      )}
    </>
  );
}