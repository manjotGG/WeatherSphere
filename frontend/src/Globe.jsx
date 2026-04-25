import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { Earcut } from "three/src/extras/Earcut.js";

const EARTH_RADIUS = 5;
const GEOJSON_URL = "/data/countries.geojson";
const ZOOM_MIN = 6;
const ZOOM_MAX = 18;
const MOUSE_MOVE_THROTTLE = 100; // ms
const CURSOR_COUNTRY_THROTTLE = 80; // ms — throttle expensive findCountry in cursor handler

function normalizeLongitude(lon) {
  let normalized = lon;
  if (normalized > 180) normalized -= 360;
  if (normalized < -180) normalized += 360;
  return normalized;
}

function latLonToVector(lon, lat, radius = EARTH_RADIUS) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

/**
 * Inverse of latLonToVector — converts a 3D point on the globe back to lat/lon.
 * Must account for the +180° theta offset used in latLonToVector.
 */
function vectorToLatLon(point, radius = EARTH_RADIUS) {
  const lat = 90 - THREE.MathUtils.radToDeg(Math.acos(point.y / radius));
  // atan2(z, x) gives theta, but latLonToVector adds 180° to lon,
  // so we must subtract 180° here to get the real longitude back.
  let lon = THREE.MathUtils.radToDeg(Math.atan2(point.z, point.x)) - 180;
  lon = normalizeLongitude(lon);
  return { lat, lon };
}

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function countryContains(feature, lon, lat) {
  if (!feature || !feature.geometry) return false;
  const type = feature.geometry.type;
  if (type === "Polygon") {
    const rings = feature.geometry.coordinates;
    if (!pointInRing(lon, lat, rings[0])) return false;
    for (let i = 1; i < rings.length; i += 1) {
      if (pointInRing(lon, lat, rings[i])) return false;
    }
    return true;
  }
  if (type === "MultiPolygon") {
    for (const polygon of feature.geometry.coordinates) {
      const outer = polygon[0];
      if (!pointInRing(lon, lat, outer)) continue;
      let insideHole = false;
      for (let i = 1; i < polygon.length; i += 1) {
        if (pointInRing(lon, lat, polygon[i])) {
          insideHole = true;
          break;
        }
      }
      if (!insideHole) return true;
    }
  }
  return false;
}

function prepareCountryData(geojson) {
  geojson.features.forEach((feature) => {
    const rings =
      feature.geometry.type === "Polygon"
        ? feature.geometry.coordinates
        : feature.geometry.coordinates.flat(1);

    let minLon = 180;
    let maxLon = -180;
    let minLat = 90;
    let maxLat = -90;

    rings.forEach((ring) => {
      ring.forEach(([lon, lat]) => {
        const normalizedLon = normalizeLongitude(lon);
        minLon = Math.min(minLon, normalizedLon);
        maxLon = Math.max(maxLon, normalizedLon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      });
    });

    feature.bbox = {
      minLon,
      maxLon,
      minLat,
      maxLat,
      crossesAntimeridian: maxLon - minLon > 180,
    };
  });
  return geojson;
}

function isInBbox(lon, lat, bbox) {
  if (lat < bbox.minLat || lat > bbox.maxLat) return false;
  if (!bbox.crossesAntimeridian) {
    return lon >= bbox.minLon && lon <= bbox.maxLon;
  }
  return lon >= bbox.maxLon || lon <= bbox.minLon;
}

function buildCountryHighlight(feature, lineMaterial, fillMaterial) {
  const group = new THREE.Group();
  if (!feature || !feature.geometry) return group;

  const polygons =
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;

  polygons.forEach((polygon) => {
    const flat = [];
    const holeIndices = [];

    polygon.forEach((ring, index) => {
      if (index > 0) holeIndices.push(flat.length / 2);
      ring.forEach(([lon, lat]) => {
        flat.push(normalizeLongitude(lon), lat);
      });
    });

    const positionList = [];
    polygon.forEach((ring) => {
      ring.forEach(([lon, lat]) => {
        const vec = latLonToVector(normalizeLongitude(lon), lat, EARTH_RADIUS * 1.001);
        positionList.push(vec.x, vec.y, vec.z);
      });
    });

    const lineVertices = [];
    polygon.forEach((ring) => {
      ring.forEach(([lon, lat]) => {
        const vec = latLonToVector(normalizeLongitude(lon), lat, EARTH_RADIUS * 1.001);
        lineVertices.push(vec.x, vec.y, vec.z);
      });
      if (ring.length > 0) {
        const [lon, lat] = ring[0];
        const first = latLonToVector(normalizeLongitude(lon), lat, EARTH_RADIUS * 1.001);
        lineVertices.push(first.x, first.y, first.z);
      }
    });

    if (lineVertices.length > 0) {
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(lineVertices, 3));
      group.add(new THREE.Line(lineGeo, lineMaterial));
    }

    try {
      const indices = Earcut(flat, holeIndices, 2);
      if (indices.length > 0) {
        const fillGeo = new THREE.BufferGeometry();
        fillGeo.setAttribute("position", new THREE.Float32BufferAttribute(positionList, 3));
        fillGeo.setIndex(indices);
        fillGeo.computeVertexNormals();
        group.add(new THREE.Mesh(fillGeo, fillMaterial));
      }
    } catch (error) {
      // ignore triangulation failures for extremely complex outlines
    }
  });

  return group;
}

export default function Globe() {
  const mountRef = useRef(null);
  const cameraRef = useRef(null);
  const countryDataRef = useRef(null);
  const weatherCacheRef = useRef({});
  const lastMouseTimeRef = useRef(0);
  const highlightGroupRef = useRef(null);
  const highlightAnimRef = useRef({ opacity: 0 });
  const tooltipAnimRef = useRef({ opacity: 0, scale: 0.8, offsetY: 10 });
  const rendererRef = useRef(null);
  const raycasterRef = useRef(null);
  const mouseRef = useRef(new THREE.Vector2());
  const globeRef = useRef(null);
  const cameraForCursorRef = useRef(null);
  const lastHoveredCountryRef = useRef(null);
  const lastCursorCountryTimeRef = useRef(0);
  const currentMousePosRef = useRef({ x: 0, y: 0 }); // track raw screen coords

  const [tooltip, setTooltip] = useState({
    x: 0,
    y: 0,
    country: null,
    temp: null,
    visible: false,
  });

  const [zoomValue, setZoomValue] = useState(10);
  const [ripples, setRipples] = useState([]);
  const [highlightOpacity, setHighlightOpacity] = useState(0);
  const [tooltipOpacity, setTooltipOpacity] = useState(0);
  const [tooltipScale, setTooltipScale] = useState(0.8);
  const [tooltipOffsetY, setTooltipOffsetY] = useState(10);

  useEffect(() => {
    fetch(GEOJSON_URL)
      .then((res) => res.json())
      .then((data) => {
        countryDataRef.current = prepareCountryData(data);
      })
      .catch((error) => {
        console.warn("Failed to load country GeoJSON:", error);
      });
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;

    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
    camera.position.set(0, 0, zoomValue);
    cameraRef.current = camera;
    cameraForCursorRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = false;
    mountRef.current.appendChild(renderer.domElement);
    renderer.domElement.style.cursor = "grab";
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight.position.set(8, 10, 8);
    scene.add(directionalLight);

    const starGeometry = new THREE.BufferGeometry();
    const starCount = 3000;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const radius = 80 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      const brightness = 0.5 + Math.random() * 0.5;
      colors[i * 3] = brightness;
      colors[i * 3 + 1] = brightness;
      colors[i * 3 + 2] = brightness;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    const earthTexture = new THREE.TextureLoader().load("https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg");
    earthTexture.minFilter = THREE.LinearMipMapLinearFilter;
    earthTexture.magFilter = THREE.LinearFilter;

    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS, 64, 64),
      new THREE.MeshStandardMaterial({
        map: earthTexture,
        roughness: 1,
        metalness: 0,
      })
    );
    scene.add(globe);
    globeRef.current = globe;

    const highlightGroup = new THREE.Group();
    scene.add(highlightGroup);
    highlightGroupRef.current = highlightGroup;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableZoom = true;
    controls.minDistance = ZOOM_MIN;
    controls.maxDistance = ZOOM_MAX;
    controls.maxPolarAngle = Math.PI * 0.95;
    controls.enablePan = false;

    const raycaster = new THREE.Raycaster();
    raycasterRef.current = raycaster;

    const clearHighlight = () => {
      while (highlightGroup.children.length) {
        const child = highlightGroup.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
        highlightGroup.remove(child);
      }
      highlightAnimRef.current.opacity = 0;
      setHighlightOpacity(0);
    };

    const updateCountryHighlight = (feature) => {
      clearHighlight();
      if (!feature) return;

      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x26d3ff,
        transparent: true,
        opacity: 0.95,
        linewidth: 2,
      });

      const fillMaterial = new THREE.MeshBasicMaterial({
        color: 0x26d3ff,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const countryMesh = buildCountryHighlight(feature, lineMaterial, fillMaterial);
      highlightGroup.add(countryMesh);

      // Animate highlight in
      highlightAnimRef.current.opacity = 0;
      const animateIn = () => {
        if (highlightAnimRef.current.opacity < 1) {
          highlightAnimRef.current.opacity = Math.min(highlightAnimRef.current.opacity + 0.08, 1);
          setHighlightOpacity(highlightAnimRef.current.opacity);
          requestAnimationFrame(animateIn);
        }
      };
      animateIn();
    };

    const findCountry = (lat, lon) => {
      const data = countryDataRef.current;
      if (!data) return null;
      const normalizedLon = normalizeLongitude(lon);
      for (const feature of data.features) {
        if (!feature.bbox || !isInBbox(normalizedLon, lat, feature.bbox)) continue;
        if (countryContains(feature, normalizedLon, lat)) return feature;
      }
      return null;
    };

    const fetchWeather = async (lat, lon) => {
      const apiKey = import.meta.env.VITE_OPENWEATHERMAP_API_KEY;
      let response;
      if (apiKey) {
        response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`
        );
      } else {
        response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius`
        );
      }
      const data = await response.json();
      return apiKey
        ? data?.main?.temp ?? "N/A"
        : data?.current_weather?.temperature ?? "N/A";
    };

    const addRipple = (x, y) => {
      const id = Math.random();
      setRipples((prev) => [...prev, { id, x, y, radius: 0 }]);

      let radius = 0;
      const maxRadius = 40;
      const duration = 600;
      const startTime = Date.now();

      const animateRipple = () => {
        const elapsed = Date.now() - startTime;
        radius = (elapsed / duration) * maxRadius;

        setRipples((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, radius } : r
          )
        );

        if (elapsed < duration) {
          requestAnimationFrame(animateRipple);
        } else {
          setRipples((prev) => prev.filter((r) => r.id !== id));
        }
      };

      animateRipple();
    };

    const dismissTooltip = () => {
      clearHighlight();
      setTooltip({ x: 0, y: 0, country: null, temp: null, visible: false });
      setTooltipOpacity(0);
    };

    const handleMove = (event) => {
      const now = Date.now();
      if (now - lastMouseTimeRef.current < MOUSE_MOVE_THROTTLE) return;
      lastMouseTimeRef.current = now;

      // Store current screen position so async callbacks use fresh coords
      currentMousePosRef.current = { x: event.clientX, y: event.clientY };

      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouseRef.current, camera);
      const intersects = raycaster.intersectObject(globe);

      if (intersects.length > 0) {
        const point = intersects[0].point;
        const { lat, lon } = vectorToLatLon(point);

        const countryFeature = findCountry(lat, lon);
        const countryName =
          countryFeature?.properties?.name ||
          countryFeature?.properties?.ADMIN ||
          countryFeature?.properties?.NAME ||
          null;

        if (countryName) {
          addRipple(event.clientX - rect.left, event.clientY - rect.top);

          const cacheKey = `${countryName}|${lat.toFixed(1)}|${lon.toFixed(1)}`;
          let temp = weatherCacheRef.current[cacheKey];

          if (temp === undefined) {
            fetchWeather(lat, lon)
              .then((weatherTemp) => {
                weatherCacheRef.current[cacheKey] = weatherTemp;
                // Use latest mouse position (not the stale event coords)
                const pos = currentMousePosRef.current;
                setTooltip({
                  x: pos.x,
                  y: pos.y,
                  country: countryName,
                  temp: weatherTemp,
                  visible: true,
                });
                animateTooltipIn();
              })
              .catch(() => {
                weatherCacheRef.current[cacheKey] = "N/A";
                const pos = currentMousePosRef.current;
                setTooltip({
                  x: pos.x,
                  y: pos.y,
                  country: countryName,
                  temp: "N/A",
                  visible: true,
                });
                animateTooltipIn();
              });
          } else {
            setTooltip({
              x: event.clientX,
              y: event.clientY,
              country: countryName,
              temp,
              visible: true,
            });
            animateTooltipIn();
          }

          updateCountryHighlight(countryFeature);
        } else {
          dismissTooltip();
        }
      } else {
        dismissTooltip();
      }
    };

    const animateTooltipIn = () => {
      tooltipAnimRef.current = { opacity: 0, scale: 0.8, offsetY: 10 };
      const animateIn = () => {
        if (tooltipAnimRef.current.opacity < 1) {
          tooltipAnimRef.current.opacity = Math.min(tooltipAnimRef.current.opacity + 0.1, 1);
          tooltipAnimRef.current.scale = 0.8 + tooltipAnimRef.current.opacity * 0.2;
          tooltipAnimRef.current.offsetY = 10 - tooltipAnimRef.current.opacity * 8;
          setTooltipOpacity(tooltipAnimRef.current.opacity);
          setTooltipScale(tooltipAnimRef.current.scale);
          setTooltipOffsetY(tooltipAnimRef.current.offsetY);
          requestAnimationFrame(animateIn);
        }
      };
      animateIn();
    };

    // Cursor handler — runs a lightweight raycaster hit-test on every move,
    // but throttles the expensive findCountry() lookup.
    const handleMouseMoveCursor = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      mouseRef.current.x = x;
      mouseRef.current.y = y;

      raycaster.setFromCamera(mouseRef.current, camera);
      const intersects = raycaster.intersectObject(globe);

      if (intersects.length > 0) {
        // Only run the expensive findCountry at a throttled rate
        const now = Date.now();
        if (now - lastCursorCountryTimeRef.current < CURSOR_COUNTRY_THROTTLE) return;
        lastCursorCountryTimeRef.current = now;

        const point = intersects[0].point;
        const { lat, lon } = vectorToLatLon(point);

        const countryFeature = findCountry(lat, lon);
        const countryName =
          countryFeature?.properties?.name ||
          countryFeature?.properties?.ADMIN ||
          countryFeature?.properties?.NAME ||
          null;

        if (countryName && lastHoveredCountryRef.current !== countryName) {
          renderer.domElement.style.cursor = "pointer";
          lastHoveredCountryRef.current = countryName;
        } else if (!countryName && lastHoveredCountryRef.current !== null) {
          renderer.domElement.style.cursor = "grab";
          lastHoveredCountryRef.current = null;
        }
      } else {
        if (lastHoveredCountryRef.current !== null) {
          renderer.domElement.style.cursor = "grab";
          lastHoveredCountryRef.current = null;
        }
      }
    };

    // Reset everything when mouse leaves the canvas
    const handleMouseLeave = () => {
      renderer.domElement.style.cursor = "grab";
      lastHoveredCountryRef.current = null;
      dismissTooltip();
    };

    renderer.domElement.addEventListener("mousemove", handleMouseMoveCursor);
    renderer.domElement.addEventListener("mousemove", handleMove);
    renderer.domElement.addEventListener("mouseleave", handleMouseLeave);

    const handleResize = () => {
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);

    let frameId;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener("mousemove", handleMouseMoveCursor);
      renderer.domElement.removeEventListener("mousemove", handleMove);
      renderer.domElement.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", handleResize);
      renderer.domElement.style.cursor = "default";
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  const changeZoom = (delta) => {
    const camera = cameraRef.current;
    if (!camera) return;
    const next = THREE.MathUtils.clamp(camera.position.z + delta, ZOOM_MIN, ZOOM_MAX);
    camera.position.z = next;
    setZoomValue(next);
  };

  return (
    <>
      <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />

      <div
        style={{
          position: "fixed",
          right: 18,
          bottom: 18,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 10,
        }}
      >
        <button type="button" style={buttonStyle} onClick={() => changeZoom(-1)}>
          +
        </button>
        <button type="button" style={buttonStyle} onClick={() => changeZoom(1)}>
          -
        </button>
      </div>

      {ripples.map((ripple) => (
        <div
          key={ripple.id}
          style={{
            position: "fixed",
            left: ripple.x,
            top: ripple.y,
            width: ripple.radius * 2,
            height: ripple.radius * 2,
            borderRadius: "50%",
            border: "2px solid rgba(38, 211, 255, 0.6)",
            transform: `translate(-50%, -50%)`,
            opacity: Math.max(0, 1 - ripple.radius / 40),
            pointerEvents: "none",
            zIndex: 5,
          }}
        />
      ))}

      {tooltip.visible && (
        <div
          style={{
            position: "fixed",
            top: tooltip.y + 16 + tooltipOffsetY,
            left: tooltip.x + 16,
            minWidth: 180,
            maxWidth: 260,
            background: "rgba(8, 12, 24, 0.78)",
            color: "#f8f9ff",
            padding: "14px 16px",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
            pointerEvents: "none",
            backdropFilter: "blur(14px)",
            zIndex: 20,
            fontFamily: "system-ui, -apple-system, sans-serif",
            opacity: tooltipOpacity,
            transform: `scale(${tooltipScale})`,
            transformOrigin: "top left",
            transition: "opacity 0.2s ease-out, transform 0.2s ease-out",
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.75, marginBottom: 6 }}>
            Country Info
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            {tooltip.country}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>
            Avg Temp: {tooltip.temp}°C
          </div>
        </div>
      )}
    </>
  );
}

const buttonStyle = {
  width: 52,
  height: 52,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(9, 16, 32, 0.95)",
  color: "#fff",
  fontSize: 24,
  fontFamily: "system-ui, -apple-system, sans-serif",
  cursor: "pointer",
  boxShadow: "0 14px 28px rgba(0,0,0,0.22)",
  transition: "all 0.2s ease",
};
