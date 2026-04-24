import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

export default function Globe() {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // ✅ Prevent duplicate canvas (React Strict Mode fix)
    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }

    const scene = new THREE.Scene();

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // 🎥 Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 0, 10);

    // 🖥️ Renderer
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

    // 🎮 Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.minDistance = 6;
    controls.maxDistance = 20;
    controls.enablePan = false;

    // 🎯 Raycasting (hover detection)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();

      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    window.addEventListener("mousemove", onMouseMove);

    // 🔁 Animation
    let frameId;
    const animate = () => {
      frameId = requestAnimationFrame(animate);

      controls.update();

      // 🎯 Detect hover on globe
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(globe);

      if (intersects.length > 0) {
        const point = intersects[0].point;

        const radius = 5;

        const lat = 90 - (Math.acos(point.y / radius) * 180) / Math.PI;
        const lon =
          ((Math.atan2(point.z, point.x) * 180) / Math.PI + 180) % 360 - 180;

        console.log(
          "Lat:",
          lat.toFixed(2),
          "Lon:",
          lon.toFixed(2)
        );
      }

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

    // 🧹 Cleanup
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", onMouseMove);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    />
  );
}