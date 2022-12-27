import { Canvas, RootState, useFrame } from "@react-three/fiber";
import { Environment, OrbitControls, useHelper } from "@react-three/drei";
import { Perf } from "r3f-perf";
import { LayerMaterial, Color, Depth, Noise } from "lamina";
import * as THREE from "three";
import { useEffect, useRef } from "react";
import { controller } from "./controller";

import ActiveScene from "./scenes/01-follow-curve";

const onCreated = (state: RootState) => {};

/* We're building a cube-mapped environment declaratively.
  Anything you put in here will be filmed (once) by a cubemap-camera and applied to the scenes environment, and optionally background. */
const LaminaCubeMap = () => (
  <Environment background resolution={64}>
    <mesh scale={100}>
      <sphereGeometry args={[1, 64, 64]} />
      <LayerMaterial side={THREE.BackSide}>
        <Color color="blue" alpha={1} mode="normal" />
        <Depth
          colorA="#00ffff"
          colorB="#ff8f00"
          alpha={0.1}
          mode="normal"
          near={0}
          far={200}
          origin={[100, 100, 100]}
        />
        <Noise mapping="local" type="cell" scale={0.2} mode="softlight" />
      </LayerMaterial>
    </mesh>
  </Environment>
);

const Stage = () => {
  const spotLight = useRef();
  useHelper(spotLight, THREE.SpotLightHelper);
  const presets = {
    rembrandt: {
      main: [1, 2, 1],
      fill: [-2, -0.5, -2],
    },
    portrait: {
      main: [-1, 2, 0.5],
      fill: [-1, 0.5, -1.5],
    },
    upfront: {
      main: [0, 2, 1],
      fill: [-1, 0.5, -1.5],
    },
    soft: {
      main: [-2, 4, 4],
      fill: [-1, 0.5, -1.5],
    },
  };
  const config = presets.rembrandt;
  const intensity = 0.2;
  const radius = 1;

  return (
    <group position={[0, 20, 10]}>
      <ambientLight intensity={intensity / 3} />
      <spotLight
        ref={spotLight}
        penumbra={1}
        position={[
          config.main[0] * radius,
          config.main[1] * radius,
          config.main[2] * radius,
        ]}
        intensity={intensity * 2}
        castShadow
        shadow-bias={-0.0001}
        shadow-normalBias={0}
        shadow-mapSize={1024}
      />
      <pointLight
        position={[
          config.fill[0] * radius,
          config.fill[1] * radius,
          config.fill[2] * radius,
        ]}
        intensity={intensity}
      />
    </group>
  );
};

const App = () => {
  useEffect(() => {
    controller.start();
    return () => controller.stop();
  });

  return (
    <Canvas
      camera={{ position: [0, 0, 1000], near: 0.01, far: 10000, fov: 60 }}
      onCreated={onCreated}
      shadows
      dpr={[1, 2]}
    >
      <Perf position="top-left" />
      <OrbitControls makeDefault />
      <ActiveScene />
      <LaminaCubeMap />
    </Canvas>
  );
};

export default App;
