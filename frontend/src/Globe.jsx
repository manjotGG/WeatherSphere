import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function Globe() {
  const mountRef = useRef();

  useEffect(() => {
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    camera.position.set(0, 0, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000);

    // attach canvas
    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    // 🌍 Earth (simple visible version)
    const geometry = new THREE.SphereGeometry(5, 64, 64);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      wireframe: true,
    });

    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    // animation loop
    function animate() {
      requestAnimationFrame(animate);
      globe.rotation.y += 0.01;
      renderer.render(scene, camera);
    }

    animate();

    // cleanup
    return () => {
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
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