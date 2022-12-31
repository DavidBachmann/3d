import * as THREE from "three";
import {
  PerspectiveCamera,
  useGLTF,
  useTexture,
  Environment,
  useFBO,
  OrthographicCamera,
  Plane,
  useHelper,
} from "@react-three/drei";
import { useControls } from "leva";
import create from "zustand";
import {
  forwardRef,
  Fragment,
  MutableRefObject,
  ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { GLTF } from "three-stdlib";
import {
  Debug,
  Physics,
  PublicApi,
  Quad,
  Triplet,
  useBox,
  usePlane,
} from "@react-three/cannon";
import { createPortal, useFrame, useThree, extend } from "@react-three/fiber";
import { repeatTextures } from "../utils/repeatTexture";
import { controller } from "../controller";
import { scale } from "../utils/scale";
import { clamp } from "../utils/clamp";
import { batteryShaderMaterial as BatteryShaderMaterial } from "../shaders/battery";

// Make battery shader available as jsx element
extend({ BatteryShaderMaterial });

const useGameStore = create(() => ({
  mutation: {
    altitude: 0,
    battery: 100,
    lift: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
  },
}));

const usePipStore = create(() => ({
  camera: null,
  mutation: {
    isActive: false,
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
    ["drone-battery-indicator"]: THREE.Mesh;
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

const unitVector = new THREE.Vector3();
const unitQuaternion = new THREE.Quaternion();
const worldVector = new THREE.Vector3();
const cameraVector = new THREE.Vector3();
const cameraOffset = new THREE.Vector3(0, -1, 1);
const spawnPoint = new THREE.Vector3(0, 0, 0);

const constants = {
  maxAltitude: 2.5,
  gravity: -9.8,
  droneSize: 0.32,
  droneHeight: 0.4,
  droneMass: 0.18,
  droneStableLift: 1.764,
};

// ampleLift makes the drone lift swiftly
const droneAmpleLift = constants.droneStableLift * 1.2;
// when the battery is empty it just barely doesn't provide lift
const droneBatteryEmptyLift = constants.droneStableLift - 0.015;

const Drone = forwardRef<THREE.Group, ModelProps>(
  ({ droneApi: api }, drone: MutableRefObject<THREE.Group>) => {
    const { nodes, materials } = useGLTF(
      "/gltfs/quadcopter.gltf"
    ) as unknown as GLTFResult;
    const mutation = useGameStore((state) => state.mutation);
    const droneCamera = useRef<THREE.PerspectiveCamera>(null);
    const batteryShaderMaterial = useRef<any>(null);
    const camera = useThree((state) => state.camera);
    const propellers = useRef<THREE.Mesh[]>([]);
    const pipState = usePipStore((state) => state.mutation);

    const lift = useRef(0);
    const pitch = useRef(0);
    const yaw = useRef(0);
    const roll = useRef(0);

    const quaternion = useRef<Quad>([0, 0, 0, 1]);

    useLayoutEffect(() => {
      usePipStore.setState({
        camera: droneCamera,
      });
    });

    api.quaternion.subscribe((val) => (quaternion.current = val));

    useHelper(pipState.isActive ? droneCamera : null, THREE.CameraHelper);

    useFrame((_, dt) => {
      // Get controls
      const throttling = controller.controls.throttling.value;
      const pitching = controller.controls.pitching.value;
      const rolling = controller.controls.rolling.value;
      const yawing = controller.controls.yawing.value;
      const yawInput = controller.controls.thrustYaw.value.x * -1;
      const pitchInput = controller.controls.pitchRoll.value.y;
      const rollInput = controller.controls.pitchRoll.value.x;

      // Drive shader uniform
      batteryShaderMaterial.current.uBatteryPercentage = clamp(
        mutation.battery / 100,
        1,
        0
      );

      const pos = drone.current.getWorldPosition(cameraVector);
      const altitude = Math.abs(
        drone.current.getWorldPosition(worldVector).y -
          spawnPoint.y -
          constants.droneHeight / 2
      );
      const outOfBattery = mutation.battery === 0;

      // Drive propellers
      for (const propeller of propellers.current) {
        if (!propeller) {
          break;
        }

        if (!outOfBattery) {
          propeller.rotation.y += Math.min(0.35 * lift.current, 4);
        }
      }

      // Scale lift with battery percentage
      const scaledAmpleLift = scale(
        mutation.battery,
        [100, 0],
        [droneAmpleLift, droneBatteryEmptyLift]
      );

      // Scale lift force from stable to ample by altitude
      const scaledLift = scale(
        mutation.altitude,
        [constants.maxAltitude, 0],
        [constants.droneStableLift, scaledAmpleLift]
      );

      if (throttling && !outOfBattery) {
        // Drain the batteries
        mutation.battery = Math.max(mutation.battery - 0.05, 0);

        // Gradually increase lift if throttling
        lift.current = scaledLift;
      } else {
        lift.current = Math.max(0, (lift.current -= 0.02));
      }

      // Set roll
      // "Roll" is like rolling a barrell.
      const maxRoll = 1;

      if (rolling) {
        roll.current = rollInput * maxRoll;
      } else {
        if (Math.sign(roll.current) === -1) {
          roll.current = Math.min(0, roll.current + 0.05);
        } else {
          roll.current = Math.max(0, roll.current - 0.05);
        }
      }

      // Set pitch
      // "Pitch" is like a dive.
      const maxPitch = 1;

      if (pitching) {
        pitch.current = pitchInput * maxPitch;
      } else {
        // Gradually level off pitch
        if (Math.sign(pitch.current) === -1) {
          pitch.current = Math.min((pitch.current += 0.05), 0);
        } else {
          pitch.current = Math.max((pitch.current -= 0.05), 0);
        }
      }

      // Set yaw
      // "Yaw" is like looking around.
      const maxYaw = 1;

      if (yawing) {
        yaw.current = yawInput * maxYaw;
      } else {
        // Gradually level off yaw
        if (Math.sign(yaw.current) === -1) {
          yaw.current = Math.min((yaw.current += 0.05), 0);
        } else {
          yaw.current = Math.max((yaw.current -= 0.05), 0);
        }
      }

      // Lift is the only force needed
      api.applyLocalForce([0, lift.current, 0], [0, 0, 0]);

      const canManouvre = altitude > 0.01;

      if (canManouvre) {
        api.angularVelocity.set(0, yaw.current, 0);
      }

      const torqueScale = 0.1;

      // Correct for rotation
      const qc = quaternion.current;
      const q = unitQuaternion.set(qc[0], qc[1], qc[2], qc[3]);
      const v = unitVector.set(
        pitch.current * torqueScale,
        0,
        roll.current * torqueScale
      );

      v.applyQuaternion(q);
      api.applyTorque(v.toArray());

      // Look at drone
      camera.lookAt(cameraVector);
      camera.position.lerpVectors(pos.sub(cameraOffset), cameraVector, dt);

      // Update state
      mutation.lift = lift.current;
      mutation.pitch = pitch.current;
      mutation.roll = roll.current;
      mutation.yaw = yaw.current;
      mutation.altitude = altitude;

      // Update game controls
      controller.update();
    });

    return (
      <group dispose={null} scale={0.6} ref={drone}>
        <group position={[0, 0, 0]}>
          <PerspectiveCamera
            ref={droneCamera}
            fov={60}
            position={[0, 0, constants.droneSize]}
            rotation={[Math.PI, 0, Math.PI]}
            near={0.01}
            far={10}
          />
          <mesh
            name="drone-propeller"
            ref={(ref) => propellers.current.push(ref)}
            castShadow
            receiveShadow
            geometry={nodes["drone-propeller"].geometry}
            material={materials["drone-propeller-material"]}
            position={[0.29, 0.05, -0.25]}
          />
          <group name="drone-body" position={[0.01, 0.02, 0.08]}>
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
          <group name="drone-motor" position={[0.27, -0.04, -0.24]}>
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
            position={[0.16, -0.01, -0.19]}
          />
          <mesh
            name="drone-propeller001"
            ref={(ref) => propellers.current.push(ref)}
            castShadow
            receiveShadow
            geometry={nodes["drone-propeller001"].geometry}
            material={materials["drone-propeller-material"]}
            position={[-0.29, 0.05, -0.25]}
          />
          <group name="drone-motor001" position={[-0.27, -0.04, -0.24]}>
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
            position={[-0.16, -0.01, -0.19]}
          />
          <mesh
            name="drone-propeller002"
            ref={(ref) => propellers.current.push(ref)}
            castShadow
            receiveShadow
            geometry={nodes["drone-propeller002"].geometry}
            material={materials["drone-propeller-material"]}
            position={[-0.29, 0.05, 0.19]}
          />
          <group name="drone-motor002" position={[-0.27, -0.04, 0.18]}>
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
            position={[-0.16, -0.01, 0.13]}
          />
          <mesh
            name="drone-propeller003"
            ref={(ref) => propellers.current.push(ref)}
            castShadow
            receiveShadow
            geometry={nodes["drone-propeller003"].geometry}
            material={materials["drone-propeller-material"]}
            position={[0.29, 0.05, 0.19]}
          />
          <group name="drone-motor003" position={[0.27, -0.04, 0.18]}>
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
            position={[0.16, -0.01, 0.13]}
          />
          <mesh
            name="drone-battery-indicator"
            castShadow
            receiveShadow
            geometry={nodes["drone-battery-indicator"].geometry}
            position={[0.01, 0.02, 0.08]}
          >
            <batteryShaderMaterial ref={batteryShaderMaterial} />
          </mesh>
        </group>
      </group>
    );
  }
);

const Ground = ({ size = 16 }) => {
  const [colorMap, normalMap, roughnessMap, displacementMap] = useTexture(
    [
      "/textures/stylized-stone-floor/stylized-stone-floor-color.jpg",
      "/textures/stylized-stone-floor/stylized-stone-floor-normal.jpg",
      "/textures/stylized-stone-floor/stylized-stone-floor-roughness.jpg",
      "/textures/stylized-stone-floor/stylized-stone-floor-height.png",
    ],
    (textures) => {
      repeatTextures(textures, size);
    }
  );

  const position = new THREE.Vector3(0, 0, 0);
  const rotation = new THREE.Euler(-Math.PI / 2, 0, 0);

  const [ref] = usePlane(
    () => ({
      material: {
        friction: 0.5,
        restitution: 0.5,
      },
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
      />
    </mesh>
  );
};

function PhysicsWorld() {
  const mutation = useGameStore((state) => state.mutation);
  const pipState = usePipStore((state) => state.mutation);

  const [_, update] = useControls(() => ({
    altitude: mutation.altitude,
    battery: mutation.battery,
    droneCamera: {
      value: pipState.isActive,
      onChange: (val) => {
        pipState.isActive = val;
      },
    },
    lift: mutation.lift,
    yaw: mutation.yaw,
    roll: mutation.roll,
    pitch: mutation.pitch,
  }));

  useEffect(() => {
    const id = setInterval(() => {
      update({
        altitude: mutation.altitude,
        battery: mutation.battery,
        lift: mutation.lift,
        yaw: mutation.yaw,
        roll: mutation.roll,
        pitch: mutation.pitch,
        droneCamera: pipState.isActive,
      });
    }, 100);

    return () => clearTimeout(id);
  }, []);

  const [drone, droneApi] = useBox(
    () => ({
      args: [constants.droneSize, constants.droneHeight, constants.droneSize],
      position: [0, constants.droneHeight, 0],
      material: {
        friction: 0.2,
        restitution: 1,
      },
      mass: constants.droneMass,
      angularDamping: 0,
      linearDamping: 0.5,
      fixedRotation: false,
    }),
    useRef<THREE.Group>(null)
  );
  return (
    <Fragment key="physics-world">
      <Drone ref={drone} droneApi={droneApi} />
      <Ground />
    </Fragment>
  );
}

function PhysicsDebug({
  debug = false,
  children,
}: {
  debug?: boolean;
  children: ReactNode;
}) {
  const Noop = ({ children }) => <>{children}</>;
  return debug ? <Debug>{children}</Debug> : <Noop>{children}</Noop>;
}

function Scene() {
  const [state] = useControls(() => ({
    physicsDebug: false,
  }));

  return (
    <Fragment key="04">
      <color attach="background" args={[0xf3f6fb]} />
      <fogExp2 attach="fog" color={0xf3f6fb} density={0.05} />
      <ambientLight intensity={0.8} />
      <directionalLight
        position={[2, 10, 0]}
        castShadow
        shadow-mapSize={1024}
      />
      <PerspectiveCamera makeDefault fov={70} position={[0, 0, 0]} />
      <Environment preset="forest" />
      <SceneRenderer />
      <Physics
        defaultContactMaterial={{
          contactEquationStiffness: 1e9,
        }}
        broadphase="SAP"
        gravity={[0, constants.gravity, 0]}
        allowSleep={true}
      >
        <PhysicsDebug debug={state.physicsDebug}>
          <PhysicsWorld />
        </PhysicsDebug>
      </Physics>
    </Fragment>
  );
}

function SceneRenderer() {
  const orthographicCamera = useRef();
  const pipScene = new THREE.Scene();
  const frameBuffer = useFBO();
  const pipRef = usePipStore((state) => state.camera);
  const pipState = usePipStore((state) => state.mutation);

  useFrame(({ gl, camera, scene }) => {
    gl.autoClear = false;

    // Render scene from camera to a render target
    gl.setRenderTarget(frameBuffer);
    gl.render(scene, pipRef.current);

    // Render original scene
    gl.setRenderTarget(null);
    gl.render(scene, camera);

    if (pipState.isActive) {
      // Render PIP scene
      gl.render(pipScene, orthographicCamera.current);
    }
  }, 1);

  const r = window.innerWidth / window.innerHeight;
  const SIZE = 300;
  const MARGIN = 10;

  return createPortal(
    <Fragment key="pip-scene">
      <OrthographicCamera ref={orthographicCamera} near={0.001} far={1} />
      <group
        position-z={-0.1}
        position-x={-window.innerWidth / 2 + SIZE / 2 + MARGIN}
      >
        <Plane args={[SIZE, SIZE / r, 1]} position-y={0}>
          <meshBasicMaterial map={frameBuffer.texture} />
        </Plane>
      </group>
    </Fragment>,
    pipScene
  );
}

useGLTF.preload("/gltfs/quadcopter.gltf");

export default Scene;
