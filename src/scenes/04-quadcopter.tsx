import {
  PerspectiveCamera,
  useGLTF,
  useTexture,
  EnvironmentCube,
  OrbitControls,
  PivotControls,
} from "@react-three/drei";
import { useControls } from "leva";
import create from "zustand";
import { forwardRef, Fragment, useEffect, useRef } from "react";
import { GLTF } from "three-stdlib/loaders/GLTFLoader";
import * as THREE from "three";
import { addEffect, useFrame, useThree } from "@react-three/fiber";
import { repeatTextures } from "../utils/repeatTexture";
import {
  Debug,
  Physics,
  PublicApi,
  Triplet,
  useBox,
  usePlane,
} from "@react-three/cannon";
import { controller } from "../controller";
import { clamp } from "../utils/clamp";

const useGameStore = create(() => ({
  mutation: {
    lift: 0,
    battery: 100,
  },
}));

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

type ModelProps = {
  droneApi: PublicApi;
};

const cameraVector = new THREE.Vector3();
const cameraOffset = new THREE.Vector3(0, -1, 1);
const spawnPoint = new THREE.Vector3(0, 0, 0);

export const Model = forwardRef<THREE.Group, ModelProps>(
  ({ droneApi: api }, drone) => {
    const { nodes, materials } = useGLTF(
      "/gltfs/quadcopter.gltf"
    ) as unknown as GLTFResult;
    const mutation = useGameStore((state) => state.mutation);
    const camera = useThree((state) => state.camera);
    const propellers = useRef<THREE.Mesh[]>([]);

    const lift = useRef(0);
    const pitch = useRef(0);
    const yaw = useRef(0);
    const roll = useRef(0);

    const { pivotControls } = useControls({
      pivotControls: false,
    });

    useFrame((state, dt) => {
      const throttling = controller.controls.throttling.value;
      const pitching = controller.controls.pitching.value;
      const rolling = controller.controls.rolling.value;
      const yawing = controller.controls.yawing.value;
      const thrustInput = controller.controls.thrustYaw.value.y;
      const yawInput = controller.controls.thrustYaw.value.x * -1;
      const pitchInput = controller.controls.pitchRoll.value.y;
      const rollInput = controller.controls.pitchRoll.value.x;

      const pos = drone.current.getWorldPosition(cameraVector);

      // Drive propellers
      for (const propeller of propellers.current) {
        if (!propeller) {
          break;
        }

        propeller.rotation.y += Math.min(0.35 * lift.current, 4);
      }

      // Set lift
      const liftRequired = 2;
      if (throttling) {
        // Drain the batteries
        mutation.battery -= 0.01;
        // Gradually increase lift if throttling
        lift.current = clamp(thrustInput * liftRequired, liftRequired, 0);
      } else {
        lift.current = Math.max(0, (lift.current -= 0.02));
      }

      // Set roll
      // "Roll" is like rolling a barrell.
      const maxRoll = 0.1;
      if (rolling) {
        roll.current = rollInput * maxRoll;
      }

      if (!rolling) {
        if (roll.current > 0) {
          roll.current = Math.max(0, roll.current - 0.02);
        } else if (roll.current < 0) {
          roll.current = Math.min(0, roll.current + 0.02);
        } else {
          roll.current = 0;
        }
      }

      // Set pitch
      // "Pitch" is like a dive.
      const maxPitch = 0.2;
      if (pitching) {
        pitch.current = pitchInput * maxPitch;
      } else {
        // Gradually decrease pitch
        if (Math.sign(pitch.current) === -1) {
          pitch.current = Math.min((pitch.current += 0.05), 0);
        } else {
          pitch.current = Math.max((pitch.current -= 0.05), 0);
        }
      }

      //console.log(pitch.current);

      // Set yaw
      // "Yaw" is like looking around.
      yaw.current = yawInput;

      // Lift is the only force needed
      api.applyLocalForce([0, lift.current, 0], [0, 0, 0]);

      //api.angularVelocity.set(pitch.current, yaw.current, roll.current);
      api.angularVelocity.set(pitch.current, yaw.current, roll.current);

      // Look at drone
      camera.lookAt(cameraVector);
      camera.position.lerpVectors(pos.sub(cameraOffset), cameraVector, dt);
      controller.update();
    });

    return (
      <group dispose={null} scale={0.5} ref={drone}>
        <PivotControls visible={pivotControls}>
          <group position={[0, 0, 0]}>
            <mesh
              ref={(ref) => propellers.current.push(ref)}
              name="drone-propeller"
              castShadow
              receiveShadow
              geometry={nodes["drone-propeller"].geometry}
              material={materials["drone-propeller-material"]}
              position={[0.2867, 0.0504, -0.2463]}
            />

            <group
              name="drone-body"
              position={[0.0065, 0.0228, 0.1]}
              rotation={[0, 0, 0]}
            >
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
        </PivotControls>
      </group>
    );
  }
);

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

  const position = new THREE.Vector3(0, 0, 0);
  const rotation = new THREE.Euler(-Math.PI / 2, 0, 0);

  const [ref] = usePlane(
    () => ({
      position: position.toArray() as Triplet,
      rotation: rotation.toArray() as Triplet,
    }),
    useRef<THREE.Mesh>(null)
  );

  return (
    <mesh ref={ref} position={position} rotation={rotation} receiveShadow>
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

function PhysicsWorld() {
  const camera = useRef<THREE.Camera>(null);
  const size = 0.45;
  const height = 0.22;
  const test = new THREE.Vector3();

  const [drone, droneApi] = useBox(
    () => ({
      args: [size, height, size],
      position: [0, height / 2, 0],
      mass: 0.18,
      angularDamping: 0.9,
      linearDamping: 0.6,
      fixedRotation: false,
    }),
    useRef<THREE.Group>(null)
  );

  const { mutation } = useGameStore();

  useEffect(() =>
    addEffect(() => {
      if (drone.current) {
        const y = drone.current.getWorldPosition(test).y;
        mutation.lift = parseFloat(
          String(Math.abs(y - spawnPoint.y - height / 2))
        ).toFixed(2);
      }
    })
  );

  return (
    <Fragment key="physics-world">
      <OrbitControls camera={camera.current} />
      <PerspectiveCamera
        ref={camera}
        makeDefault
        fov={70}
        position={[0, 0, 0]}
      />
      <Model ref={drone} droneApi={droneApi} />
      <Ground />
    </Fragment>
  );
}

function Scene() {
  const mutation = useGameStore((state) => state.mutation);
  const [_, update] = useControls(() => ({
    droneLift: mutation.lift,
    droneBattery: mutation.battery,
  }));

  useEffect(() => {
    const id = setInterval(() => {
      update({ droneLift: mutation.lift, droneBattery: mutation.battery });
    }, 100);

    return () => clearTimeout(id);
  }, []);

  return (
    <Fragment key="04">
      <color attach="background" args={[0xf3f6fb]} />
      <fogExp2 attach="fog" color={0xf3f6fb} density={0.1} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[2, 3, 0]} castShadow shadow-mapSize={1024} />
      <EnvironmentCube preset="dawn" />
      <Physics iterations={32} size={10} gravity={[0, -9.8, 0]}>
        <PhysicsWorld />
      </Physics>
    </Fragment>
  );
}

useGLTF.preload("/gltfs/quadcopter.gltf");

export default Scene;
