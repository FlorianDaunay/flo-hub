// Shared materials. Building windows are mapped in world space, so every tower and every
// instanced filler shares ONE material whatever its size.
import * as THREE from "three";
import { windowsTexture } from "./textures";

let buildingMat: THREE.MeshStandardMaterial | null = null;

export function buildingMaterial(): THREE.MeshStandardMaterial {
  if (buildingMat) return buildingMat;
  const m = new THREE.MeshStandardMaterial({
    color: "#0d111c",
    roughness: 0.35,
    metalness: 0.6,
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 1.25,
    emissiveMap: windowsTexture(),
  });
  m.onBeforeCompile = (shader) => {
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
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;")
      .replace(
        "#include <emissivemap_fragment>",
        `{
          vec2 wuv = abs(vWNrm.x) > 0.5 ? vWPos.zy : vWPos.xy;
          float side = 1.0 - step(0.5, abs(vWNrm.y));
          // No windows on the ground floor band.
          float above = step(7.5, vWPos.y);
          vec3 win = texture2D(emissiveMap, wuv / vec2(16.0, 32.0)).rgb;
          totalEmissiveRadiance *= win * side * above;
        }`
      );
  };
  buildingMat = m;
  return m;
}

const neonCache = new Map<string, THREE.MeshBasicMaterial>();

/** Unlit, untonemapped colour so bloom picks it up. `boost` > 1 pushes it over the bloom threshold. */
export function neonMaterial(color: string, boost = 3): THREE.MeshBasicMaterial {
  const key = `${color}-${boost}`;
  let m = neonCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(boost), toneMapped: false });
    neonCache.set(key, m);
  }
  return m;
}
