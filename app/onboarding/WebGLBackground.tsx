"use client";

import { useEffect, useRef } from "react";

export function WebGLBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animFrameId: number;

    (async () => {
      const THREE = await import("three");

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x030305);
      scene.fog = new THREE.Fog(0x030305, 10, 50);

      const aspect = container.clientWidth / container.clientHeight;
      const frustumSize = 25;
      const camera = new THREE.OrthographicCamera(
        (frustumSize * aspect) / -2,
        (frustumSize * aspect) / 2,
        frustumSize / 2,
        frustumSize / -2,
        1,
        1000
      );
      camera.position.set(20, 20, 20);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      const gridHelper = new THREE.GridHelper(60, 60, 0x111118, 0x0a0a10);
      gridHelper.position.y = -0.01;
      scene.add(gridHelper);

      const vertexShader = `
        varying vec3 vLocalPosition;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vLocalPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `;

      const fragmentShader = `
        uniform vec3 uColor;
        uniform float uHeight;
        uniform float uProgress;
        uniform float uTime;
        uniform float uIsWireframe;
        varying vec3 vLocalPosition;
        varying vec2 vUv;
        void main() {
          float currentBuildY = uProgress * uHeight;
          if (vLocalPosition.y > currentBuildY) discard;
          float distToEdge = currentBuildY - vLocalPosition.y;
          float edgeGlow = smoothstep(0.4, 0.0, distToEdge);
          float scanlines = sin(vLocalPosition.y * 20.0 - uTime * 2.0) * 0.5 + 0.5;
          scanlines = pow(scanlines, 4.0) * 0.1;
          vec3 finalColor;
          float alpha;
          if (uIsWireframe > 0.5) {
            finalColor = mix(vec3(1.0), uColor + vec3(0.5), edgeGlow);
            alpha = 0.3 + edgeGlow * 0.7 + scanlines * 0.5;
          } else {
            finalColor = uColor + vec3(edgeGlow * 0.8);
            float borderX = min(vUv.x, 1.0 - vUv.x);
            float borderY = min(vUv.y, 1.0 - vUv.y);
            float borderGlow = smoothstep(0.05, 0.0, min(borderX, borderY)) * 0.2;
            alpha = 0.05 + edgeGlow * 0.4 + scanlines + borderGlow;
          }
          gl_FragColor = vec4(finalColor, alpha);
        }
      `;

      const architectureGroup = new THREE.Group();
      scene.add(architectureGroup);

      const architecturalCyan = new THREE.Color(0x4a78ff);

      type Block = {
        uniforms: Array<Record<string, { value: unknown }>>;
        delay: number;
        duration: number;
      };

      let blocks: Block[] = [];

      function subdivideSpace(
        rect: { x: number; z: number; w: number; d: number },
        depth: number
      ): typeof rect[] {
        if (depth === 0) return [rect];
        const splitX = Math.random() > 0.5;
        const ratio = 0.3 + Math.random() * 0.4;
        let a, b;
        if (splitX) {
          const w1 = rect.w * ratio;
          a = { ...rect, w: w1 };
          b = { ...rect, x: rect.x + w1, w: rect.w - w1 };
        } else {
          const d1 = rect.d * ratio;
          a = { ...rect, d: d1 };
          b = { ...rect, z: rect.z + d1, d: rect.d - d1 };
        }
        return [...subdivideSpace(a, depth - 1), ...subdivideSpace(b, depth - 1)];
      }

      function generateHouse() {
        while (architectureGroup.children.length > 0) {
          const child = architectureGroup.children[0] as THREE.Mesh;
          architectureGroup.remove(child);
          child.geometry?.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else (child.material as THREE.Material)?.dispose();
        }
        blocks = [];

        const plotSize = 16;
        const rootRect = { x: -plotSize / 2, z: -plotSize / 2, w: plotSize, d: plotSize };
        const layout = subdivideSpace(rootRect, 4);
        const activeLayout = layout.filter(() => Math.random() > 0.25);

        activeLayout.forEach((rect) => {
          const gap = 0.4;
          const finalW = Math.max(0.1, rect.w - gap);
          const finalD = Math.max(0.1, rect.d - gap);
          const stories = Math.floor(Math.random() * 4) + 1;
          const height = stories * 2.5;
          const cx = rect.x + rect.w / 2;
          const cz = rect.z + rect.d / 2;

          const geometry = new THREE.BoxGeometry(finalW, height, finalD);
          geometry.translate(0, height / 2, 0);

          const baseUniforms = () => ({
            uColor: { value: architecturalCyan },
            uHeight: { value: height },
            uProgress: { value: 0.0 },
            uTime: { value: 0.0 },
            uIsWireframe: { value: 0.0 },
          });

          const solidUniforms = baseUniforms();
          solidUniforms.uIsWireframe.value = 0.0;
          const solidMaterial = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: solidUniforms,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
          });

          const wireUniforms = baseUniforms();
          wireUniforms.uIsWireframe.value = 1.0;
          const edgesGeometry = new THREE.EdgesGeometry(geometry);
          const wireframeMaterial = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: wireUniforms,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });

          const mesh = new THREE.Mesh(geometry, solidMaterial);
          const lines = new THREE.LineSegments(edgesGeometry, wireframeMaterial);
          mesh.position.set(cx, 0, cz);
          lines.position.set(cx, 0, cz);

          architectureGroup.add(mesh);
          architectureGroup.add(lines);

          const distFromCenter = Math.sqrt(cx * cx + cz * cz);
          blocks.push({
            uniforms: [
              solidMaterial.uniforms as Record<string, { value: unknown }>,
              wireframeMaterial.uniforms as Record<string, { value: unknown }>,
            ],
            delay: distFromCenter * 0.15 + Math.random() * 0.5,
            duration: 3.0 + Math.random() * 2.0,
          });
        });
      }

      generateHouse();

      const clock = new THREE.Clock();
      const STATE_BUILDING = 0;
      const STATE_HOLDING = 1;
      const STATE_DECONSTRUCTING = 2;
      let currentState = STATE_BUILDING;
      let stateTimer = 0;

      const animate = () => {
        animFrameId = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        const time = clock.getElapsedTime();
        stateTimer += delta;

        const orbitRadius = 28;
        const orbitSpeed = time * 0.05;
        camera.position.x = Math.sin(orbitSpeed) * orbitRadius;
        camera.position.z = Math.cos(orbitSpeed) * orbitRadius;
        camera.lookAt(0, 3, 0);

        let allBlocksFinished = true;

        blocks.forEach((block) => {
          block.uniforms[0].uTime.value = time;
          block.uniforms[1].uTime.value = time;

          let progressTarget = 0.0;

          if (currentState === STATE_BUILDING) {
            if (stateTimer > block.delay) {
              const activeTime = stateTimer - block.delay;
              progressTarget = Math.min(1.0, activeTime / (block.duration as number));
              const easeOut = 1 - Math.pow(1 - progressTarget, 3);
              block.uniforms[0].uProgress.value = easeOut;
              block.uniforms[1].uProgress.value = easeOut;
              if (progressTarget < 1.0) allBlocksFinished = false;
            } else {
              allBlocksFinished = false;
              block.uniforms[0].uProgress.value = 0.0;
              block.uniforms[1].uProgress.value = 0.0;
            }
          } else if (currentState === STATE_HOLDING) {
            block.uniforms[0].uProgress.value = 1.0;
            block.uniforms[1].uProgress.value = 1.0;
            if (stateTimer < 4.0) allBlocksFinished = false;
          } else if (currentState === STATE_DECONSTRUCTING) {
            const deconstructDuration = 2.0;
            progressTarget = Math.max(0.0, 1.0 - stateTimer / deconstructDuration);
            const easeIn = progressTarget * progressTarget;
            block.uniforms[0].uProgress.value = easeIn;
            block.uniforms[1].uProgress.value = easeIn;
            if (progressTarget > 0.0) allBlocksFinished = false;
          }
        });

        if (allBlocksFinished) {
          if (currentState === STATE_BUILDING) {
            currentState = STATE_HOLDING;
            stateTimer = 0;
          } else if (currentState === STATE_HOLDING) {
            currentState = STATE_DECONSTRUCTING;
            stateTimer = 0;
          } else if (currentState === STATE_DECONSTRUCTING) {
            generateHouse();
            currentState = STATE_BUILDING;
            stateTimer = 0;
          }
        }

        renderer.render(scene, camera);
      };

      const handleResize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        const a = w / h;
        (camera as THREE.OrthographicCamera).left = (-frustumSize * a) / 2;
        (camera as THREE.OrthographicCamera).right = (frustumSize * a) / 2;
        (camera as THREE.OrthographicCamera).top = frustumSize / 2;
        (camera as THREE.OrthographicCamera).bottom = -frustumSize / 2;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };

      window.addEventListener("resize", handleResize);
      animate();

      return () => {
        window.removeEventListener("resize", handleResize);
        cancelAnimationFrame(animFrameId);
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      };
    })();

    return () => cancelAnimationFrame(animFrameId);
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}
