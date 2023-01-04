import * as THREE from "three";
import {
  PerspectiveCamera,
  useGLTF,
  useTexture,
  Environment,
  useFBO,
  OrthographicCamera,
  Plane,
} from "@react-three/drei";
import create from "zustand";
import { combine } from "zustand/middleware";
import {
  forwardRef,
  Fragment,
  MutableRefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GLTF } from "three-stdlib";
import {
  Physics,
  PublicApi,
  Quad,
  Triplet,
  useBox,
  usePlane,
} from "@react-three/cannon";
import {
  createPortal,
  useFrame,
  useThree,
  extend,
  Canvas,
} from "@react-three/fiber";
import { Perf } from "r3f-perf";
import { Joystick } from "react-joystick-component";
import { IJoystickUpdateEvent } from "react-joystick-component/build/lib/Joystick";
import { KeyboardDevice, TouchDevice } from "@hmans/controlfreak";
import { repeatTextures } from "../utils/repeatTexture";
import { controller } from "../controller";
import { linearScale } from "../utils/scale";
import { clamp } from "../utils/clamp";
import { batteryShaderMaterial as BatteryShaderMaterial } from "../shaders/battery";
import Skybox from "../components/Skybox";

// Make battery shader available as jsx element
extend({ BatteryShaderMaterial });

type BatteryShaderMaterial = typeof THREE.ShaderMaterial & {
  uBatteryPercentage: number;
};

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
};

type ModelProps = {
  droneApi: PublicApi;
};

const parse = (num: number) => parseFloat(num.toFixed(3));

// Drone flight state
const useDroneFlightStore = create(() => ({
  mutation: {
    altitude: 0,
    charging: false,
    autoBalance: true,
    liftForce: 0,
    yawVelocity: 0,
    pitchVelocity: 0,
    pitchAngle: 0,
    rollVelocity: 0,
    rollAngle: 0,
  },
}));

const useDroneControlsStore = create(
  combine(
    {
      keyboardActive: false,
      joystickActive: false,
      mutation: {
        pitchInput: 0,
        rollInput: 0,
        throttleInput: 0,
        yawInput: 0,
      },
    },
    (set) => ({
      setKeyboardActive: (active: boolean) => set({ keyboardActive: active }),
      setJoystickActive: (active: boolean) => set({ joystickActive: active }),
    })
  )
);

// Picture-in-picture state
const useDroneCameraStore = create(() => ({
  camera: null,
  mutation: {
    isActive: false,
  },
}));

// Battery state
const useDroneBatteryStore = create(
  combine(
    {
      charging: false,
      mutation: {
        percentage: 100,
      },
    },
    (set) => ({
      charge: (active: boolean) => set({ charging: active }),
    })
  )
);

const torqueVector = new THREE.Vector3();
const torqueQuaternion = new THREE.Quaternion();
const dronePosition = new THREE.Vector3();
const droneEuler = new THREE.Euler();
const worldVector = new THREE.Vector3();
const cameraOffset = new THREE.Vector3(0, 0.5, -0.8);

const constants = {
  maxAltitude: 3,
  droneAttributes: {
    size: 0.32,
    height: 0.4,
    mass: 0.2,
    ampleLift: 2.4,
    stableLift: 1.96,
    failingLift: 1.915,
    propellerSpeed: 30,
  },
  autoBalance: {
    rollCorrection: -5,
    pitchCorrection: -5,
  },
  collisionBodies: {
    station: "STATION",
    drone: "DRONE",
  },
  controlMethods: {
    joystick: "JOYSTICK",
    keyboard: "KEYBOARD",
  },
  world: {
    gravity: -9.2,
  },
};

const Drone = forwardRef<THREE.Group, ModelProps>(
  ({ droneApi: api }, drone: MutableRefObject<THREE.Group>) => {
    const { nodes } = useGLTF(
      "/gltfs/quadcopter.gltf"
    ) as unknown as GLTFResult;
    const flightMutation = useDroneFlightStore((state) => state.mutation);
    const batteryCharging = useDroneBatteryStore((state) => state.charging);
    const batteryMutation = useDroneBatteryStore((state) => state.mutation);

    const controlsMutation = useDroneControlsStore((state) => state.mutation);
    const currentControls = useDroneControlsStore((state) =>
      state.keyboardActive
        ? constants.controlMethods.keyboard
        : state.joystickActive
        ? constants.controlMethods.joystick
        : null
    );
    const activateKeyboard = useDroneControlsStore((state) => () => {
      state.setKeyboardActive(true);
      state.setJoystickActive(false);
    });
    const activateJoystick = useDroneControlsStore((state) => () => {
      state.setKeyboardActive(false);
      state.setJoystickActive(true);
    });

    const droneCamera = useRef<THREE.PerspectiveCamera>(null);
    const batteryShaderMaterial = useRef<BatteryShaderMaterial>(null);
    const propellers = useRef<THREE.Mesh[]>([]);
    const camera = useThree((state) => state.camera);

    // Forces
    const lift = useRef(0);
    const pitch = useRef(0);
    const pitchAngle = useRef(0);
    const roll = useRef(0);
    const rollAngle = useRef(0);
    const yaw = useRef(0);

    const quaternion = useRef<Quad>([0, 0, 0, 1]);
    const rotation = useRef<Triplet>([0, 0, 0]);
    const position = useRef<Triplet>([0, 0, 0]);

    useLayoutEffect(() => {
      useDroneCameraStore.setState({
        camera: droneCamera,
      });
    });

    api.quaternion.subscribe((val) => (quaternion.current = val));
    api.rotation.subscribe((val) => (rotation.current = val));
    api.position.subscribe((val) => (position.current = val));

    controller.onDeviceChange.add((d) => {
      if (d instanceof KeyboardDevice) {
        return activateKeyboard();
      }
      if (d instanceof TouchDevice) {
        return activateJoystick();
      }
    });

    useFrame((state, dt) => {
      let pitching = false;
      let rolling = false;
      let throttling = false;
      let yawing = false;

      if (currentControls === constants.controlMethods.keyboard) {
        // Keyboard reads inputs from the controller class.
        pitching = controller.controls.pitching.value;
        rolling = controller.controls.rolling.value;
        throttling = controller.controls.throttling.value;
        yawing = controller.controls.yawing.value;
        const pitchInput = controller.controls.pitchRoll.value.y;
        const rollInput = controller.controls.pitchRoll.value.x;
        const yawInput = controller.controls.thrustYaw.value.x;

        if (throttling) {
          controlsMutation.throttleInput = 1;
        } else {
          controlsMutation.throttleInput = 0;
        }

        if (pitching) {
          controlsMutation.pitchInput = pitchInput;
        }

        if (rolling) {
          controlsMutation.rollInput = rollInput;
        }

        if (yawing) {
          controlsMutation.yawInput = yawInput * -1;
        }
      } else if (currentControls === constants.controlMethods.joystick) {
        // Joystick reads inputs directly from the store
        const pitchInput = controlsMutation.pitchInput;
        const rollInput = controlsMutation.rollInput;
        const throttleInput = controlsMutation.throttleInput;
        const yawInput = controlsMutation.yawInput;

        pitching = pitchInput !== 0;
        rolling = rollInput !== 0;
        throttling = throttleInput > 0;
        yawing = yawInput !== 0;
      }

      // Drive shader uniform
      batteryShaderMaterial.current.uBatteryPercentage = clamp(
        parse(batteryMutation.percentage / 100),
        1,
        0
      );

      // Calculate drone altitude
      const altitude = Math.abs(
        drone.current.getWorldPosition(worldVector).y -
          constants.droneAttributes.height / 2
      );

      // Drive propellers
      const propellerEfficiency = clamp(
        linearScale(batteryMutation.percentage, [30, 0], [1, 0.75]),
        1,
        0.75
      );
      const shouldPropel = throttling && batteryMutation.percentage > 0;
      const propellerValue = shouldPropel ? propellerEfficiency * 0.4 : 0;

      for (const propeller of propellers.current) {
        if (!propeller) {
          break;
        }

        propeller.rotation.y += propellerValue;
      }

      // Charge the battery
      if (batteryCharging) {
        batteryMutation.percentage = Math.min(
          batteryMutation.percentage + 0.2,
          100
        );
      }

      // Set pitch
      // "Pitch" is like a dive.
      const maxPitch = 1;
      if (pitching) {
        pitch.current = controlsMutation.pitchInput * maxPitch;
      } else {
        const balanceForce =
          maxPitch *
          flightMutation.pitchAngle *
          constants.autoBalance.pitchCorrection;
        pitch.current = balanceForce * (flightMutation.autoBalance ? 1 : 0);
      }

      // Set roll
      // "Roll" is like rolling a barrell.
      const maxRoll = 1;
      if (rolling) {
        roll.current = controlsMutation.rollInput * maxRoll;
      } else {
        const balanceForce =
          maxRoll *
          flightMutation.rollAngle *
          constants.autoBalance.rollCorrection;
        roll.current = balanceForce * (flightMutation.autoBalance ? 1 : 0);
      }

      // Scale ample and stable lifts with battery percentage
      const scaledAmpleLift = linearScale(
        batteryMutation.percentage,
        [100, 0],
        [
          constants.droneAttributes.ampleLift,
          constants.droneAttributes.failingLift,
        ]
      );
      const scaledStableLift = linearScale(
        batteryMutation.percentage,
        [100, 0],
        [
          constants.droneAttributes.stableLift,
          constants.droneAttributes.failingLift,
        ]
      );

      // Scale lift force from stable to ample by altitude
      const scaledLift = linearScale(
        flightMutation.altitude,
        [constants.maxAltitude, 0],
        [scaledStableLift, scaledAmpleLift]
      );

      if (throttling) {
        // Drain the battery
        batteryMutation.percentage = Math.max(
          batteryMutation.percentage - 0.025,
          0
        );

        // Increase lift when throttling
        lift.current = scaledLift * controlsMutation.throttleInput;
      } else {
        lift.current = Math.max(0, (lift.current -= 0.02));
      }

      // Set yaw
      // "Yaw" is like looking around.
      const maxYaw = 1.5;
      yaw.current = controlsMutation.yawInput * maxYaw * (yawing ? 1 : 0);

      const forwardMomentum = clamp(lift.current * 0.025, 1, 0);
      const appliedLift = batteryMutation.percentage > 0 ? lift.current : 0;
      api.applyLocalForce([0, appliedLift, forwardMomentum], [0, 0, 0]);

      const canManouvre = altitude > 0.01;

      const torqueScale = 0.1;

      api.angularVelocity.set(0, yaw.current * (canManouvre ? 1 : 0), 0);

      const qc = quaternion.current;
      const q = torqueQuaternion.set(qc[0], qc[1], qc[2], qc[3]);
      const v = torqueVector.set(
        pitch.current * torqueScale,
        0,
        roll.current * torqueScale
      );

      // Read the current angle of the drone
      droneEuler.setFromQuaternion(q, "YXZ");
      pitchAngle.current = droneEuler.x;
      rollAngle.current = droneEuler.z;

      // Correct for rotation
      v.applyQuaternion(q);

      // Apply angle-corrected torque to drone
      api.applyTorque(v.toArray());

      // Update state
      flightMutation.liftForce = parse(lift.current);
      flightMutation.rollVelocity = parse(roll.current);
      flightMutation.rollAngle = parse(rollAngle.current);
      flightMutation.pitchVelocity = parse(pitch.current);
      flightMutation.pitchAngle = parse(pitchAngle.current);
      flightMutation.yawVelocity = parse(yaw.current);
      flightMutation.altitude = parse(altitude);

      dronePosition.set(
        position.current[0],
        position.current[1],
        position.current[2]
      );

      // Look at drone
      camera.lookAt(dronePosition);

      camera.position.copy(dronePosition.add(cameraOffset));

      // Update game controls
      controller.update();
    });

    const gm = useTexture("/textures/threeTone.jpg");

    const colors = useMemo(
      () => ({
        propeller: new THREE.Color("#090c0d"),
        camera: new THREE.Color("#ff0000"),
        dark: new THREE.Color("#112233"),
        white: new THREE.Color("f7f7f7"),
      }),
      []
    );

    return (
      <group name={constants.collisionBodies.drone} scale={0.6} ref={drone}>
        <PerspectiveCamera
          ref={droneCamera}
          fov={70}
          position={[0, 0, constants.droneAttributes.size]}
          rotation={[Math.PI, 0, Math.PI]}
          near={0.01}
          far={100}
        />
        <group position={[0.002, 0.023, 0.167]} castShadow>
          <mesh geometry={nodes["drone-body-geometry001"].geometry}>
            <meshToonMaterial color={colors.dark} gradientMap={gm} />
          </mesh>
          <mesh geometry={nodes["drone-body-geometry001_1"].geometry}>
            <meshToonMaterial color={colors.white} gradientMap={gm} />
          </mesh>
          <mesh geometry={nodes["drone-body-geometry001_2"].geometry}>
            <meshToonMaterial color={colors.camera} gradientMap={gm} />
          </mesh>
        </group>
        <mesh
          ref={(propeller) => propellers.current.push(propeller)}
          geometry={nodes["drone-propeller"].geometry}
          position={[0.281, 0.066, 0.283]}
        >
          <meshToonMaterial color={colors.propeller} gradientMap={gm} />
        </mesh>
        <group position={[0.267, -0.04, 0.276]}>
          <mesh geometry={nodes["drone-motor-geometry"].geometry}>
            <meshToonMaterial color={colors.dark} gradientMap={gm} />
          </mesh>
          <mesh geometry={nodes["drone-motor-geometry_1"].geometry}>
            <meshToonMaterial color={colors.white} gradientMap={gm} />
          </mesh>
        </group>
        <mesh
          geometry={nodes["drone-arm-base"].geometry}
          position={[0.167, -0.003, 0.229]}
        >
          <meshToonMaterial color={colors.dark} gradientMap={gm} />
        </mesh>
        <mesh
          geometry={nodes["drone-battery-indicator"].geometry}
          position={[0, 0.059, -0.297]}
        >
          <batteryShaderMaterial ref={batteryShaderMaterial} />
        </mesh>
        <mesh
          geometry={nodes["drone-throttle-indicator"].geometry}
          position={[0.001, -0.026, -0.251]}
        >
          <meshToonMaterial color={colors.dark} gradientMap={gm} />
        </mesh>
        <mesh
          ref={(propeller) => propellers.current.push(propeller)}
          geometry={nodes["drone-propeller001"].geometry}
          position={[-0.278, 0.066, 0.283]}
        >
          <meshToonMaterial color={colors.propeller} gradientMap={gm} />
        </mesh>
        <group position={[-0.264, -0.04, 0.276]}>
          <mesh geometry={nodes["drone-motor-geometry003"].geometry}>
            <meshToonMaterial color={colors.dark} gradientMap={gm} />
          </mesh>
          <mesh geometry={nodes["drone-motor-geometry003_1"].geometry}>
            <meshToonMaterial color={colors.white} gradientMap={gm} />
          </mesh>
        </group>
        <mesh
          geometry={nodes["drone-arm-base001"].geometry}
          position={[-0.164, -0.003, 0.229]}
        >
          <meshToonMaterial color={colors.dark} gradientMap={gm} />
        </mesh>
        <mesh
          ref={(propeller) => propellers.current.push(propeller)}
          geometry={nodes["drone-propeller002"].geometry}
          position={[-0.278, 0.066, -0.218]}
        >
          <meshToonMaterial color={colors.propeller} gradientMap={gm} />
        </mesh>
        <group position={[-0.264, -0.04, -0.211]}>
          <mesh geometry={nodes["drone-motor-geometry004"].geometry}>
            <meshToonMaterial color={colors.dark} gradientMap={gm} />
          </mesh>
          <mesh geometry={nodes["drone-motor-geometry004_1"].geometry}>
            <meshToonMaterial color={colors.white} gradientMap={gm} />
          </mesh>
        </group>
        <mesh
          geometry={nodes["drone-arm-base002"].geometry}
          position={[-0.164, -0.003, -0.164]}
        >
          <meshToonMaterial color={colors.dark} gradientMap={gm} />
        </mesh>
        <mesh
          ref={(propeller) => propellers.current.push(propeller)}
          geometry={nodes["drone-propeller003"].geometry}
          position={[0.284, 0.066, -0.218]}
        >
          <meshToonMaterial color={colors.propeller} gradientMap={gm} />
        </mesh>
        <group position={[0.269, -0.04, -0.211]}>
          <mesh geometry={nodes["drone-motor-geometry006"].geometry}>
            <meshToonMaterial color={colors.dark} gradientMap={gm} />
          </mesh>
          <mesh geometry={nodes["drone-motor-geometry006_1"].geometry}>
            <meshToonMaterial color={colors.white} gradientMap={gm} />
          </mesh>
        </group>
        <mesh
          geometry={nodes["drone-arm-base003"].geometry}
          position={[0.169, -0.003, -0.164]}
        >
          <meshToonMaterial color={colors.dark} gradientMap={gm} />
        </mesh>
      </group>
    );
  }
);

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
        <PerspectiveCamera makeDefault fov={70} position={[0, 0, 0]} />
        <Environment preset="sunset" />
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