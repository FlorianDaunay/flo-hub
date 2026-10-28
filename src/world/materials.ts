// Shared materials. Building windows are mapped in world space, so every tower and every
// instanced filler shares ONE material whatever its size.
import * as THREE from "three";
import { uTime } from "./batch";
import { windowsTexture } from "./textures";

let buildingMat: THREE.MeshStandardMaterial | null = null;

export function buildingMaterial(): THREE.MeshStandardMaterial {
  if (buildingMat) return buildingMat;
  const m = new THREE.MeshStandardMaterial({
    color: "#161a24",
    roughness: 0.42,
    metalness: 0.75,
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 1.6,
    emissiveMap: windowsTexture(),
    envMapIntensity: 0.9,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 wp = vec4(transformed, 1.0);
        vec3 wn = objectNormal;
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
          wn = mat3(instanceMatrix) * wn;
        #endif
        wp = modelMatrix * wp;
        vWPos = wp.xyz;
        vWNrm = normalize(mat3(modelMatrix) * wn);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;\nuniform float uTime;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        // Grime: darker and wetter toward the street, streaks running down.
        float streak = fract(sin(floor((vWPos.x + vWPos.z) * 1.7) * 91.7) * 4375.5);
        diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.0, 14.0, vWPos.y)) * (0.85 + 0.15 * streak);`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `{
          vec2 wuv = abs(vWNrm.x) > 0.5 ? vWPos.zy : vWPos.xy;
          float side = 1.0 - step(0.5, abs(vWNrm.y));
          float above = step(8.0, vWPos.y);
          vec3 win = texture2D(emissiveMap, wuv / vec2(18.0, 36.0)).rgb;
          // A few windows slowly breathe (TV light, people moving).
          float cell = floor(wuv.x / 2.25) + floor(wuv.y / 1.125) * 17.0;
          float breathe = 0.75 + 0.25 * sin(uTime * (0.3 + fract(cell * 0.137)) + cell);
          totalEmissiveRadiance *= win * side * above * breathe;
        }`
      );
  };
  buildingMat = m;
  return m;
}

/** Instanced neon bars: one draw call for any number of glowing boxes, coloured per instance. */
export interface Bar {
  p: [number, number, number];
  s: [number, number, number];
  rotY?: number;
  color: THREE.ColorRepresentation;
  boost?: number;
}

export function barsMesh(bars: Bar[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), bars.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  bars.forEach((b, i) => {
    q.setFromAxisAngle(up, b.rotY ?? 0);
    mesh.setMatrixAt(i, m.compose(new THREE.Vector3(...b.p), q, new THREE.Vector3(...b.s)));
    mesh.setColorAt(i, c.set(b.color).multiplyScalar(b.boost ?? 3));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/** Instanced additive glow quads lying on the ground: fake wet-asphalt reflections and light pools. */
export interface Glow {
  x: number;
  z: number;
  w: number;
  l: number;
  rotY: number;
  color: THREE.ColorRepresentation;
  strength?: number;
}

export function glowMesh(glows: Glow[], texture: THREE.Texture, y = 0.05): THREE.InstancedMesh {
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, mat, glows.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  glows.forEach((g, i) => {
    q.setFromAxisAngle(up, g.rotY);
    mesh.setMatrixAt(i, m.compose(new THREE.Vector3(g.x, y + i * 0.0004, g.z), q, new THREE.Vector3(g.w, 1, g.l)));
    mesh.setColorAt(i, c.set(g.color).multiplyScalar(g.strength ?? 0.5));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}
