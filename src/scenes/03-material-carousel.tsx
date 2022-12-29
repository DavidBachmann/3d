import { Fragment, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useControls } from "leva";
import {
  useGLTF,
  PerspectiveCamera,
  Sphere,
  Environment,
  Float,
} from "@react-three/drei";
import { animated, useSpring } from "@react-spring/three";
import { Color, Depth, LayerMaterial } from "lamina";
import type { GLTF } from "three-stdlib/loaders/GLTFLoader";
import { Mesh } from "three";

interface ModelGLTF extends GLTF {
  nodes: {
    "floor-holed": Mesh;
    "floor-main": Mesh;
    backdrop: Mesh;
    lid: Mesh;
    lid2: Mesh;
    abracadabra: Mesh;
    underside: Mesh;
  };
}

function Model({ isVisible = false }: { isVisible: boolean }) {
  const { nodes } = useGLTF("/hole.gltf") as unknown as ModelGLTF;
  const [isOpen, set] = useState(false);
  const initial = useRef(true);

  useEffect(() => {
    if (initial.current) {
      return;
    }

    set(true);

    const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
      set(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [isVisible]);

  useEffect(() => {
    initial.current = false;
  }, []);

  const { px, scale } = useSpring({
    px: isOpen ? 0.5 : 0,
    scale: isOpen ? 1 : 1.05,
    delay: isOpen ? 0 : 200,
  });
  const { ry } = useSpring({
    ry: isOpen ? Math.PI / 2 : 0,
    delay: isOpen ? 40 : 200,
  });

  return (
    <>
      <mesh
        castShadow
        receiveShadow
        geometry={nodes["floor-holed"].geometry}
        material={nodes["floor-holed"].material}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes["floor-main"].geometry}
        material={nodes["floor-main"].material}
      />
      <mesh
        geometry={nodes.backdrop.geometry}
        material={nodes.backdrop.material}
        position={[0, 5, -6.13]}
        rotation={[0, 0, -Math.PI / 2]}
        scale={10}
      />
      <animated.group rotation-y={ry}>
        <animated.mesh
          castShadow
          receiveShadow
          position-x={px}
          scale={scale}
          geometry={nodes.lid2.geometry}
          material={nodes.lid2.material}
        />
        <animated.mesh
          position-x={px.to((val) => -val)}
          scale={scale}
          geometry={nodes.lid.geometry}
          material={nodes.lid.material}
          rotation={[Math.PI, 0, Math.PI]}
        />

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.abracadabra.geometry}
          position={[0, -0.5, 0]}
        >
          <meshStandardMaterial color={0x000000} />
        </mesh>
      </animated.group>

      <mesh
        geometry={nodes.underside.geometry}
        material={nodes.underside.material}
        position={[0, -17.58, 22.73]}
      />
    </>
  );
}

const Scene = () => {
  const { isVisible } = useControls({ isVisible: false });
  const perspectiveCamera = useRef<THREE.PerspectiveCamera>(null);
  const light = useRef();
  //useHelper(perspectiveCamera, THREE.CameraHelper);
  //useHelper(light, THREE.DirectionalLightHelper);

  const { float } = useSpring({
    float: isVisible ? 1.5 : -1,
    delay: isVisible ? 400 : 200,
    config: {
      mass: 1,
      friction: 26,
      tension: 170,
      velocity: isVisible ? 0.03 : 0,
    },
  });

  return (
    <Fragment key="03">
      <color attach="background" args={[0xffffff]} />
      <PerspectiveCamera
        ref={perspectiveCamera}
        position={[0, 2.5, 3.5]}
        rotation={[-0.3, 0, 0]}
        fov={60}
        makeDefault
      />
      <Float
        speed={2} // Animation speed, defaults to 1
        rotationIntensity={0.5} // XYZ rotation intensity, defaults to 1
        floatIntensity={0.5} // Up/down float intensity, works like a multiplier with floatingRange,defaults to 1
        floatingRange={[-0.1, 0.1]} // Range of y-axis values the object will float within, defaults to [-0.1,0.1]
      >
        <animated.group position-y={float}>
          <Sphere args={[0.5, 32, 32]} position={[0, 0, 0]} castShadow>
            <meshStandardMaterial
              color="purple"
              metalness={0.3}
              roughness={0.5}
              emissive="rebeccapurple"
              emissiveIntensity={1}
            />
          </Sphere>
        </animated.group>
      </Float>
      {/*<OrbitControls />*/}
      <Model isVisible={isVisible} />
      <directionalLight
        color={0xffffff}
        position={[5, 5, 6]}
        castShadow
        intensity={0.4}
        shadow-mapSize={2048}
        ref={light}
      />
      <directionalLight
        color={0xffffff}
        position={[-5, 5, 6]}
        castShadow
        intensity={0.4}
        shadow-mapSize={2048}
      />
      <Environment resolution={64} background preset="studio">
        <mesh scale={64}>
          <sphereGeometry args={[1, 64, 64]} />
          <LayerMaterial side={THREE.BackSide}>
            <Color
              color={isVisible ? "purple" : "blue"}
              alpha={1}
              mode="multiply"
            />
            <Depth
              colorA="orange"
              colorB="blue"
              alpha={0.2}
              mode="normal"
              near={0}
              far={150}
              origin={[100, 100, 100]}
            />
          </LayerMaterial>
        </mesh>
      </Environment>
      );
    </Fragment>
  );
};

useGLTF.preload("/hole.gltf");
export default Scene;
