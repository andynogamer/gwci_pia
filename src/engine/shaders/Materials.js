/**
 * Agent-Engine — ShaderMaterial for energy shields and ground FX (WI-017).
 * `uTime` must be advanced by delta time from THREE.Clock.
 */
import * as THREE from 'three';

export function createShieldMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 1 },
      uColor: { value: new THREE.Color(0x3ec7ff) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vWorldPos;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPos = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      uniform vec3 uColor;

      varying vec3 vNormal;
      varying vec3 vWorldPos;

      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(dot(viewDir, normalize(vNormal)), 0.0), 2.4);

        float bands = sin(vWorldPos.y * 9.0 - uTime * 4.0) * 0.5 + 0.5;
        float hex = sin(vWorldPos.x * 14.0 + uTime) * sin(vWorldPos.z * 14.0 - uTime * 0.7);
        hex = smoothstep(0.15, 0.55, hex);

        float alpha = (fresnel * 0.75 + bands * 0.18 + hex * 0.12) * uIntensity;
        vec3 col = uColor * (0.55 + fresnel * 1.1 + bands * 0.35);
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.85));
      }
    `,
  });
}

export function createGroundEffectMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 1 },
      uColor: { value: new THREE.Color(0x2aa8ff) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      uniform vec3 uColor;

      varying vec2 vUv;

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float angle = atan(p.y, p.x);

        float ring = smoothstep(0.08, 0.0, abs(r - 0.62 - 0.08 * sin(uTime * 2.2)));
        float pulse = 0.45 + 0.55 * sin(uTime * 3.5);
        float spokes = pow(abs(sin(angle * 6.0 - uTime * 2.0)), 4.0) * smoothstep(0.95, 0.2, r);
        float core = smoothstep(0.35, 0.0, r) * 0.35;

        float alpha = (ring * pulse + spokes * 0.45 + core) * uIntensity;
        vec3 col = uColor * (0.7 + pulse * 0.5);
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.9));
      }
    `,
  });
}
