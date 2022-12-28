import { Fragment, useRef } from "react";
import * as THREE from "three";
import { RootState, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Sphere,
  Trail,
  PresentationControls,
} from "@react-three/drei";
import { TrefoilKnot } from "three-stdlib";
import { LayerMaterial, Color, Depth, Noise } from "lamina";

/* We're building a cube-mapped environment declaratively.
  Anything you put in here will be filmed (once) by a cubemap-camera and applied to the scenes environment, and optionally background. */
const LaminaCubeMap = () => (
  <Environment background resolution={64}>
    <mesh scale={64}>
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
  const position = new THREE.Vector3();
  const curve = new TrefoilKnot();
  const track = new THREE.TubeGeometry(curve, 250, 0.05, 10, true);
  const camera = useThree((state) => state.camera);

  useFrame((state: RootState) => {
    if (!sphere.current) {
      return;
    }

    const time = state.clock.getElapsedTime() * 1000;
    const looptime = 20 * 1000;
    const t = (time % looptime) / looptime;

    track.parameters.path.getPointAt(t, position);

    position.multiplyScalar(scale);

    // Move sphere along curve
    sphere.current.position.copy(position);

    camera.lookAt(position);
  });

  return (
    <Fragment key="01">
      <LaminaCubeMap />
      <group>
        <mesh scale={[scale, scale, scale]} geometry={track}>
          <meshStandardMaterial color={0xff0ff} />
        </mesh>
        <PresentationControls
          global={true} // Spin globally or by dragging the model
          cursor={true} // Whether to toggle cursor style on drag
          snap={true} // Snap-back to center (can also be a spring config)
          speed={0.5} // Speed factor
          zoom={1} // Zoom factor when half the polar-max is reached
          config={{ mass: 1, tension: 170, friction: 26 }} // Spring config
        >
          <group>
            <Trail
              width={200}
              length={10}
              color={0xff00ff}
              local={false}
              attenuation={(t: number) => {
                return t * t * t * t;
              }}
            >
              <Sphere ref={sphere} args={[20, 32, 32]} position={[0, 0, 0]}>
                <meshStandardMaterial color={0xff00ff} />
              </Sphere>
            </Trail>
          </group>
        </PresentationControls>
      </group>
      <axesHelper />
    </Fragment>
  );
};

export default Scene;
