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

    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    mountRef.current.appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(5, 64, 64);

    // 🔥 FIXED TEXTURE PATH
    const texture = new THREE.TextureLoader().load(
      window.location.origin + "/earth_texture.jpg"
    );

    const material = new THREE.MeshBasicMaterial({
      map: texture,
    });

    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    function animate() {
      requestAnimationFrame(animate);
      globe.rotation.y += 0.01;
      renderer.render(scene, camera);
    }

    animate();
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}
