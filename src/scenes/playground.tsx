import * as THREE from "three";
import {
  PerspectiveCamera,
  useTexture,
  Environment,
  useFBO,
  OrthographicCamera,
  Plane,
  OrbitControls,
} from "@react-three/drei";
import {
  forwardRef,
  Fragment,
  MutableRefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Debug,
  Physics,
  PublicApi,
  Triplet,
  useBox,
  usePlane,
} from "@react-three/cannon";
import { createPortal, useFrame, extend, Canvas } from "@react-three/fiber";
import { Perf } from "r3f-perf";
import { Joystick } from "react-joystick-component";
import { IJoystickUpdateEvent } from "react-joystick-component/build/lib/Joystick";
import { repeatTextures } from "../utils/repeatTexture";
import { controller } from "../controller";
import { batteryShaderMaterial as BatteryShaderMaterial } from "../shaders/battery";
import Skybox from "../components/Skybox";
import { Drone } from "../components/Drone";

import {
  useDroneBatteryStore,
  useDroneControlsStore,
  useDroneCameraStore,
} from "../state";
import { constants } from "../constants";

// Make battery shader available as jsx element
extend({ BatteryShaderMaterial });

type StationProps = {
  stationApi: PublicApi;
  position: [number, number, number];
  args: [number, number, number];
};

const Station = forwardRef<THREE.Group, StationProps>(
  (
    { stationApi: api, position, args },
    station: MutableRefObject<THREE.Group>
  ) => {
    const [charging, set] = useState(false);

    useEffect(() => {
      const unsub = useDroneBatteryStore.subscribe((state) => {
        set(state.charging);
      });

      return () => unsub();
    }, []);

    return (
      <group
        name={constants.collisionBodies.station}
        ref={station}
        position={position}
      >
        <mesh>
          <boxGeometry args={[...args]} />
          <meshStandardMaterial
            color={charging ? "green" : "orange"}
            opacity={0.5}
            transparent
          />
        </mesh>
      </group>
    );
  }
);

const Ground = ({ size = 128 }) => {
  const position = new THREE.Vector3(0, 0, 0);
  const rotation = new THREE.Euler(-Math.PI / 2, 0, 0);

  const [ref] = usePlane(
    () => ({
      type: "Static",
      material: {
        friction: 0.5,
        restitution: 0.5,
      },
      position: position.toArray() as Triplet,
      rotation: rotation.toArray() as Triplet,
    }),
    useRef<THREE.Mesh>(null)
  );

  const colorMap = useTexture("/textures/snow01.png", (textures) => {
    repeatTextures(textures);
  });

  return (
    <mesh
      ref={ref}
      position={[0, 0, 0]}
      rotation-x={-Math.PI / 2}
      receiveShadow
    >
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        map={colorMap}
        metalness={1}
        roughness={1}
        flatShading
        color={0xffffff}
      />
    </mesh>
  );
};

function PhysicsWorld() {
  const charge = useDroneBatteryStore((state) => state.charge);

  const [drone, droneApi] = useBox(
    () => ({
      args: [
        constants.droneAttributes.size,
        constants.droneAttributes.height,
        constants.droneAttributes.size,
      ],
      position: [0, constants.droneAttributes.height, 0],
      material: {
        friction: 0.2,
        restitution: 1,
      },
      mass: constants.droneAttributes.mass,
      angularDamping: 0,
      linearDamping: 0.5,
      fixedRotation: false,
    }),
    useRef<THREE.Group>(null)
  );

  const [station, stationApi] = useBox(
    () => ({
      args: [3, 0.5, 2],
      position: [0, 2, 5],
      material: {
        friction: 0.2,
        restitution: 1,
      },
      mass: 1,
      type: "Static",
      isTrigger: true,
      onCollideBegin: (event) => {
        const collidingWith = event.body.name;
        if (collidingWith === constants.collisionBodies.drone) {
          charge(true);
        }
      },
      onCollideEnd: (event) => {
        const collidingWith = event.body.name;
        if (collidingWith === constants.collisionBodies.drone) {
          charge(false);
        }
      },
    }),
    useRef<THREE.Group>(null)
  );

  return (
    <Fragment key="physics-world">
      <Drone ref={drone} droneApi={droneApi} />
      <Station
        ref={station}
        stationApi={stationApi}
        position={[0, 2, 5]}
        args={[3, 0.5, 2]}
      />
      <Ground />
    </Fragment>
  );
}

function Scene() {
  const controlsMutation = useDroneControlsStore((state) => state.mutation);
  const renderJoystick = useDroneControlsStore((state) => state.joystickActive);

  function handleLeftStickMove(e: IJoystickUpdateEvent) {
    controlsMutation.yawInput = e.x * -1;

    // We only care about positive throttling.
    if (e.y >= 0) {
      const TODO_THRESHOLD = 0.9;
      controlsMutation.throttleInput = Math.max(e.y, TODO_THRESHOLD);
    }
  }

  function handleLeftStickStop() {
    controlsMutation.throttleInput = 0;
    controlsMutation.yawInput = 0;
  }

  function handleRightStickMove(e: IJoystickUpdateEvent) {
    controlsMutation.rollInput = e.x;
    controlsMutation.pitchInput = e.y;
  }

  function handleRightStickStop() {
    controlsMutation.rollInput = 0;
    controlsMutation.pitchInput = 0;
  }

  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, []);

  return (
    <Fragment key="playground">
      <Canvas dpr={1} frameloop="always" flat>
        <Perf position="top-left" />
        <fogExp2 attach="fog" color={0xf3f6fb} density={0.05} />
        <Skybox />
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[2, 2, 2]}
          castShadow
          shadow-mapSize={1024}
        />
        <PerspectiveCamera makeDefault fov={70} position={[0, 1, 0]} />
        <Environment preset="sunset" />
        {/*<OrbitControls makeDefault />*/}
        <SceneRenderer />
        <Physics
          defaultContactMaterial={{
            contactEquationStiffness: 1e9,
          }}
          iterations={50}
          tolerance={0}
          maxSubSteps={20}
          stepSize={1 / 60}
          broadphase="SAP"
          gravity={[0, constants.world.gravity, 0]}
          allowSleep={true}
        >
          <PhysicsWorld />
        </Physics>
      </Canvas>
      {renderJoystick && (
        <Fragment key="joystick">
          <div
            style={{
              position: "fixed",
              bottom: "32px",
              left: 0,
              right: "50%",
              margin: "auto",
              width: 180,
            }}
          >
            <Joystick
              baseColor="#355764"
              stickColor="#FFEA11"
              size={180}
              move={handleLeftStickMove}
              stop={handleLeftStickStop}
            />
          </div>
          <div
            style={{
              position: "fixed",
              bottom: "32px",
              left: "50%",
              right: 0,
              margin: "auto",
              width: 180,
            }}
          >
            <Joystick
              baseColor="#355764"
              stickColor="#FFEA11"
              size={180}
              move={handleRightStickMove}
              stop={handleRightStickStop}
            />
          </div>
        </Fragment>
      )}
    </Fragment>
  );
}

function SceneRenderer() {
  const orthographicCamera = useRef();
  const pipScene = new THREE.Scene();
  const frameBuffer = useFBO();
  const pipRef = useDroneCameraStore((state) => state.camera);
  const pipState = useDroneCameraStore((state) => state.mutation);

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
      {/*<OrthographicCamera ref={orthographicCamera} near={0.001} far={1} />*/}
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

export default Scene;
