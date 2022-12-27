import { RootState, useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Sphere, useHelper } from "@react-three/drei";
import * as THREE from "three";
import { useRef } from "react";
import { TrefoilKnot } from "three-stdlib";

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
    <group>
      <mesh scale={[scale, scale, scale]} geometry={track}>
        <meshBasicMaterial color="indianred" />
      </mesh>
      <group ref={sphere}>
        <Sphere args={[20, 32, 32]} position={[0, 0, 0]}>
          <meshStandardMaterial color={0xff00ff} />
        </Sphere>
        <PerspectiveCamera
          far={1000}
          ref={perspectiveCamera}
          makeDefault={false}
          position={[0, 200, 200]}
        />
      </group>
    </group>
  );
};

export default Scene;
