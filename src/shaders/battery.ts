import { shaderMaterial } from "@react-three/drei";

const batteryVertexShader = `
  varying vec2 vUv;

  void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectionPosition = projectionMatrix * viewPosition;

    gl_Position = projectionPosition;

    vUv = uv;
  }
`;

const batteryFragmentShader = `
  uniform float uBatteryPercentage;

  varying vec2 vUv;

  vec3 red = vec3(1.0, 0.0, 0.0);
  vec3 green = vec3(0.0, 1.0, 0.0);

  void main() {
    gl_FragColor = vec4(mix(red, green, uBatteryPercentage), 1.0);
  }
`;

const batteryShaderMaterial = shaderMaterial(
  {
    uBatteryPercentage: 1,
  },
  batteryVertexShader,
  batteryFragmentShader
);

export { batteryVertexShader, batteryFragmentShader, batteryShaderMaterial };
