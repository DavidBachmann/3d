import {
  PerspectiveCamera,
  useGLTF,
  Float,
  PresentationControls,
  useTexture,
  EnvironmentCube,
} from "@react-three/drei";
import { forwardRef, Fragment, useRef } from "react";
import { GLTF } from "three-stdlib/loaders/GLTFLoader";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { repeatTextures } from "../utils/repeatTexture";

type GLTFResult = GLTF & {
  nodes: {
    ["drone-propeller"]: THREE.Mesh;
    ["drone-body-geometry"]: THREE.Mesh;
    ["drone-body-geometry_1"]: THREE.Mesh;
    ["drone-body-geometry_2"]: THREE.Mesh;
    ["drone-motor-geometry"]: THREE.Mesh;
    ["drone-motor-geometry_1"]: THREE.Mesh;
    ["drone-arm"]: THREE.Mesh;
    ["drone-propeller001"]: THREE.Mesh;
    ["drone-motor-geometry001"]: THREE.Mesh;
    ["drone-motor-geometry001_1"]: THREE.Mesh;
    ["drone-arm001"]: THREE.Mesh;
    ["drone-propeller002"]: THREE.Mesh;
    ["drone-motor-geometry002"]: THREE.Mesh;
    ["drone-motor-geometry002_1"]: THREE.Mesh;
    ["drone-arm002"]: THREE.Mesh;
    ["drone-propeller003"]: THREE.Mesh;
    ["drone-motor-geometry003"]: THREE.Mesh;
    ["drone-motor-geometry003_1"]: THREE.Mesh;
    ["drone-arm003"]: THREE.Mesh;
  };
  materials: {
    ["drone-propeller-material"]: THREE.MeshStandardMaterial;
    ["drone-body-dark-material"]: THREE.MeshStandardMaterial;
    ["drone-body-white-material"]: THREE.MeshStandardMaterial;
    ["drone-camera"]: THREE.MeshStandardMaterial;
  };
};

export const Model = forwardRef<THREE.Group>((_, drone) => {
  const { nodes, materials } = useGLTF(
    "/gltfs/quadcopter.gltf"
  ) as unknown as GLTFResult;

  const camera = useThree((state) => state.camera);
  const propellers = useRef<THREE.Mesh[]>([]);
  const speed = 30;

  useFrame((_, dt) => {
    for (const propeller of propellers.current) {
      if (propeller) {
        propeller.rotation.y += dt * speed;
      }
    }

    //if (drone.current) {
    //  camera.lookAt(drone.current.position);
    //}
  });

  return (
    <group ref={drone} dispose={null} scale={0.5}>
      <group name="Scene">
        <mesh
          ref={(ref) => propellers.current.push(ref)}
          name="drone-propeller"
          castShadow
          receiveShadow
          geometry={nodes["drone-propeller"].geometry}
          material={materials["drone-propeller-material"]}
          position={[0.2867, 0.0504, -0.2463]}
        />
        <group name="drone-body" position={[0.0065, 0.0228, 0.0813]}>
          <mesh
            name="drone-body-geometry"
            castShadow
            receiveShadow
            geometry={nodes["drone-body-geometry"].geometry}
            material={materials["drone-body-dark-material"]}
          />
          <mesh
            name="drone-body-geometry_1"
            castShadow
            receiveShadow
            geometry={nodes["drone-body-geometry_1"].geometry}
            material={materials["drone-body-white-material"]}
          />
          <mesh
            name="drone-body-geometry_2"
            castShadow
            receiveShadow
            geometry={nodes["drone-body-geometry_2"].geometry}
            material={materials["drone-camera"]}
          />
        </group>
        <group name="drone-motor" position={[0.2738, -0.0431, -0.2401]}>
          <mesh
            name="drone-motor-geometry"
            castShadow
            receiveShadow
            geometry={nodes["drone-motor-geometry"].geometry}
            material={materials["drone-body-dark-material"]}
          />
          <mesh
            name="drone-motor-geometry_1"
            castShadow
            receiveShadow
            geometry={nodes["drone-motor-geometry_1"].geometry}
            material={materials["drone-body-white-material"]}
          />
        </group>
        <mesh
          name="drone-arm"
          castShadow
          receiveShadow
          geometry={nodes["drone-arm"].geometry}
          material={materials["drone-body-dark-material"]}
          position={[0.164, -0.0125, -0.1876]}
        />
        <mesh
          name="drone-propeller001"
          ref={(ref) => propellers.current.push(ref)}
          castShadow
          receiveShadow
          geometry={nodes["drone-propeller001"].geometry}
          material={materials["drone-propeller-material"]}
          position={[-0.2874, 0.0504, -0.2463]}
        />
        <group name="drone-motor001" position={[-0.2745, -0.0431, -0.2401]}>
          <mesh
            name="drone-motor-geometry001"
            castShadow
            receiveShadow
            geometry={nodes["drone-motor-geometry001"].geometry}
            material={materials["drone-body-dark-material"]}
          />
          <mesh
            name="drone-motor-geometry001_1"
            castShadow
            receiveShadow
            geometry={nodes["drone-motor-geometry001_1"].geometry}
            material={materials["drone-body-white-material"]}
          />
        </group>
        <mesh
          name="drone-arm001"
          castShadow
          receiveShadow
          geometry={nodes["drone-arm001"].geometry}
          material={materials["drone-body-dark-material"]}
          position={[-0.1647, -0.0125, -0.1876]}
        />
        <mesh
          name="drone-propeller002"
          ref={(ref) => propellers.current.push(ref)}
          castShadow
          receiveShadow
          geometry={nodes["drone-propeller002"].geometry}
          material={materials["drone-propeller-material"]}
          position={[-0.2874, 0.0504, 0.1881]}
        />
        <group name="drone-motor002" position={[-0.2745, -0.0431, 0.1818]}>
          <mesh
            name="drone-motor-geometry002"
            castShadow
            receiveShadow
            geometry={nodes["drone-motor-geometry002"].geometry}
            material={materials["drone-body-dark-material"]}
          />
          <mesh
            name="drone-motor-geometry002_1"
            castShadow
            receiveShadow
            geometry={nodes["drone-motor-geometry002_1"].geometry}
            material={materials["drone-body-white-material"]}
          />
        </group>
        <mesh
          name="drone-arm002"
          castShadow
          receiveShadow
          geometry={nodes["drone-arm002"].geometry}
          material={materials["drone-body-dark-material"]}
          position={[-0.1647, -0.0125, 0.1293]}
        />
        <mesh
          name="drone-propeller003"
          ref={(ref) => propellers.current.push(ref)}
          castShadow
          receiveShadow
          geometry={nodes["drone-propeller003"].geometry}
          material={materials["drone-propeller-material"]}
          position={[0.2867, 0.0504, 0.1881]}
        />
        <group name="drone-motor003" position={[0.2738, -0.0431, 0.1818]}>
          <mesh
            name="drone-motor-geometry003"
            castShadow
            receiveShadow
            geometry={nodes["drone-motor-geometry003"].geometry}
            material={materials["drone-body-dark-material"]}
          />
          <mesh
            name="drone-motor-geometry003_1"
            castShadow
            receiveShadow
            geometry={nodes["drone-motor-geometry003_1"].geometry}
            material={materials["drone-body-white-material"]}
          />
        </group>
        <mesh
          name="drone-arm003"
          castShadow
          receiveShadow
          geometry={nodes["drone-arm003"].geometry}
          material={materials["drone-body-dark-material"]}
          position={[0.164, -0.0125, 0.1293]}
        />
      </group>
    </group>
  );
});

const Ground = ({ size = 50 }) => {
  const [colorMap, normalMap, roughnessMap, aoMap, displacementMap] =
    useTexture(
      [
        "/textures/stylized-stone-floor/stylized-stone-floor-color.jpg",
        "/textures/stylized-stone-floor/stylized-stone-floor-normal.jpg",
        "/textures/stylized-stone-floor/stylized-stone-floor-roughness.jpg",
        "/textures/stylized-stone-floor/stylized-stone-floor-ao.jpg",
        "/textures/stylized-stone-floor/stylized-stone-floor-height.png",
      ],
      (textures) => {
        repeatTextures(textures, 50);
      }
    );

  return (
    <mesh position={[0, 0, 0]} rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        map={colorMap}
        normalMap={normalMap}
        roughnessMap={roughnessMap}
        displacementMap={displacementMap}
        aoMap={aoMap}
        aoMapIntensity={2}
      />
    </mesh>
  );
};

function Scene() {
  const drone = useRef<THREE.Group>(null);
  const camera = useRef<THREE.PerspectiveCamera>(null);

  useFrame(() => {
    camera.current.lookAt(drone.current.position);
  });

  return (
    <Fragment key="04">
      <PerspectiveCamera
        ref={camera}
        makeDefault
        fov={70}
        position={[0, 1.7, 1.25]}
      />
      <color attach="background" args={[0xf3f6fb]} />
      <fogExp2 attach="fog" color={0xf3f6fb} density={0.1} />

      <ambientLight intensity={0.4} />
      <directionalLight position={[2, 3, 0]} castShadow shadow-mapSize={1024} />
      <EnvironmentCube preset="dawn" />
      <PresentationControls
        enabled={true} // the controls can be disabled by setting this to false
        global={true} // Spin globally or by dragging the model
        cursor={true} // Whether to toggle cursor style on drag
        snap={true} // Snap-back to center (can also be a spring config)
        speed={2} // Speed factor
        zoom={0.8} // Zoom factor when half the polar-max is reached
        rotation={[0, 0, 0]} // Default rotation
        polar={[-Math.PI / 10, Math.PI / 10]} // Vertical limits
        azimuth={[-Math.PI / 10, Math.PI / 10]} // Horizontal limits
        config={{ mass: 3, tension: 170, friction: 26 }} // Spring config
      >
        <Float
          ref={drone}
          speed={3} // Animation speed, defaults to 1
          rotationIntensity={1} // XYZ rotation intensity, defaults to 1
          floatIntensity={0.5} // Up/down float intensity, works like a multiplier with floatingRange,defaults to 1
          floatingRange={[1, 3]} // Range of y-axis values the object will float within, defaults to [-0.1,0.1]
        >
          <Model />
        </Float>
      </PresentationControls>
      <Ground />
    </Fragment>
  );
}

useGLTF.preload("/gltfs/quadcopter.gltf");

export default Scene;
