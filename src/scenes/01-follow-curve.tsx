import { useRef } from "react";
import * as THREE from "three";
import { RootState, useFrame } from "@react-three/fiber";
import {
  PerspectiveCamera,
  Environment,
  Sphere,
  useHelper,
} from "@react-three/drei";
import { TrefoilKnot } from "three-stdlib";
import { LayerMaterial, Color, Depth, Noise } from "lamina";

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

const Scene = () => {
  const scale = 15;
  const sphere = useRef<THREE.Group>(null);
  const perspectiveCamera = useRef<THREE.PerspectiveCamera>(null);
  const position = new THREE.Vector3();
  const curve = new TrefoilKnot();
  const track = new THREE.TubeGeometry(curve, 250, 0.2, 10, true);

  useFrame((state: RootState) => {
    if (!sphere.current || !perspectiveCamera.current) {
      return;
    }

    const time = state.clock.getElapsedTime() * 1000;
    const looptime = 20 * 1000;
    const t = (time % looptime) / looptime;

    track.parameters.path.getPointAt(t, position);

    position.multiplyScalar(scale);

    // Move sphere along curve
    sphere.current.position.copy(position);

    perspectiveCamera.current.lookAt(position);
  });

  useHelper(perspectiveCamera, THREE.CameraHelper);

  return (
    <>
      <LaminaCubeMap />
      <group>
        <mesh scale={[scale, scale, scale]} geometry={track}>
          <meshBasicMaterial color="indianred" />
        </mesh>
        <group ref={sphere}>
          <Sphere args={[20, 32, 32]} position={[0, 0, 0]}>
            <meshStandardMaterial color={0xff00ff} />
          </Sphere>
          <PerspectiveCamera
            makeDefault
            ref={perspectiveCamera}
            near={0.01}
            far={10000}
            position={[0, 0, 1000]}
            fov={60}
          />
        </group>
      </group>
    </>
  );
};

export default Scene;
