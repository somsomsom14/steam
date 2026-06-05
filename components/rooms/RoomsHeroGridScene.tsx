"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import "./rooms-hero-grid.css";

const GRID_VERTEX = `
  varying vec2 vUv;
  varying vec3 vPosition;
  uniform float uTime;

  void main() {
    vUv = uv;
    vPosition = position;
    vec3 pos = position;
    pos.y += sin(pos.x * 0.1 + uTime * 0.45) * 1.5;
    pos.y += cos(pos.z * 0.1 + uTime * 0.36) * 1.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const GRID_FRAGMENT = `
  varying vec2 vUv;
  varying vec3 vPosition;
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;

  void main() {
    vec2 gridUv = vUv * vec2(20.0, 100.0);
    gridUv.y += uTime * 0.95;
    vec2 grid = abs(fract(gridUv - 0.5) - 0.5) / fwidth(gridUv);
    float line = min(grid.x, grid.y);
    float thickness = 1.2;
    float glow = 1.0 - smoothstep(0.0, thickness, line);
    float core = 1.0 - smoothstep(0.0, thickness * 0.3, line);
    float mixFactor = (vPosition.x + 120.0) / 240.0;
    vec3 baseColor = mix(uColor1, uColor2, mixFactor);
    float edgeFade = smoothstep(115.0, 55.0, abs(vPosition.x));
    vec3 finalColor = baseColor * glow * edgeFade + vec3(1.0) * core * edgeFade * 0.5;
    gl_FragColor = vec4(finalColor, glow * edgeFade);
  }
`;

export function RoomsHeroGridScene() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.className = "rooms-hero-grid__canvas";
    container.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#070510");
    scene.fog = new THREE.FogExp2("#070510", 0.009);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
    camera.position.set(0, 5, 20);
    camera.lookAt(0, 0, -30);

    const geometry = new THREE.PlaneGeometry(240, 200, 120, 200);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.ShaderMaterial({
      vertexShader: GRID_VERTEX,
      fragmentShader: GRID_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color("#6622ff") },
        uColor2: { value: new THREE.Color("#00ffaa") },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    const gridPlane = new THREE.Mesh(geometry, material);
    gridPlane.position.z = -50;
    scene.add(gridPlane);

    const orbMat = new THREE.MeshBasicMaterial({
      color: "#6622ff",
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
    });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(30, 64, 64), orbMat);
    orb.position.set(0, 10, -100);
    scene.add(orb);

    const orbCoreMat = new THREE.MeshBasicMaterial({
      color: "#00ffaa",
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });
    const orbCore = new THREE.Mesh(new THREE.SphereGeometry(15, 32, 32), orbCoreMat);
    orbCore.position.set(0, 5, -95);
    scene.add(orbCore);

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const clock = new THREE.Clock();
    let frame = 0;

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      material.uniforms.uTime.value = t;
      camera.position.x = Math.sin(t * 0.08) * 1.2;
      camera.position.y = 5 + Math.cos(t * 0.1) * 0.6;
      camera.lookAt(0, 0, -30);
      orb.rotation.y = t * 0.02;
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      geometry.dispose();
      material.dispose();
      orb.geometry.dispose();
      orb.material.dispose();
      orbCore.geometry.dispose();
      orbCore.material.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, []);

  return (
    <div ref={containerRef} className="rooms-hero-grid" aria-hidden>
      <div className="rooms-hero-grid__overlay" />
    </div>
  );
}
