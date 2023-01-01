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
import { useControls } from "leva";
import create from "zustand";
import { combine } from "zustand/middleware";
import {
  forwardRef,
  Fragment,
  MutableRefObject,
  useEffect,
  useLayoutEffect,
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
const droneEuler = new THREE.Euler();
const worldVector = new THREE.Vector3();
const cameraVector = new THREE.Vector3();
const cameraOffset = new THREE.Vector3(0, -1, 1);

const constants = {
  maxAltitude: 2.5,
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
    gravity: -9.8,
  },
};

const Drone = forwardRef<THREE.Group, ModelProps>(
  ({ droneApi: api }, drone: MutableRefObject<THREE.Group>) => {
    const { nodes, materials } = useGLTF(
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

    useLayoutEffect(() => {
      useDroneCameraStore.setState({
        camera: droneCamera,
      });
    });

    api.quaternion.subscribe((val) => (quaternion.current = val));
    api.rotation.subscribe((val) => (rotation.current = val));

    controller.onDeviceChange.add((d) => {
      if (d instanceof KeyboardDevice) {
        return activateKeyboard();
      }
      if (d instanceof TouchDevice) {
        return activateJoystick();
      }
    });

    useFrame((_, dt) => {
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
      const propellerValue =
        (shouldPropel ? constants.droneAttributes.propellerSpeed * dt : 0) *
        propellerEfficiency;

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

      // Look at drone
      const worldPosition = drone.current.getWorldPosition(cameraVector);
      camera.lookAt(cameraVector);

      camera.position.lerp(worldPosition.sub(cameraOffset), 0.1);

      // Update state
      flightMutation.liftForce = parse(lift.current);
      flightMutation.rollVelocity = parse(roll.current);
      flightMutation.rollAngle = parse(rollAngle.current);
      flightMutation.pitchVelocity = parse(pitch.current);
      flightMutation.pitchAngle = parse(pitchAngle.current);
      flightMutation.yawVelocity = parse(yaw.current);
      flightMutation.altitude = parse(altitude);

      // Update game controls
      controller.update();
    });

    return (
      <group name={constants.collisionBodies.drone} scale={0.6} ref={drone}>
        <group position={[0, 0, 0]}>
          <PerspectiveCamera
            ref={droneCamera}
            fov={70}
            position={[0, 0, constants.droneAttributes.size]}
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
  const mutation = useDroneFlightStore((state) => state.mutation);
  const battery = useDroneBatteryStore((state) => state.mutation);
  const charge = useDroneBatteryStore((state) => state.charge);
  const droneCameraState = useDroneCameraStore((state) => state.mutation);
  const droneControlsState = useDroneControlsStore((state) => state.mutation);

  const [_, update] = useControls(() => ({
    autoBalance: {
      value: mutation.autoBalance,
      onChange: (val) => {
        mutation.autoBalance = val;
      },
    },
    altitude: mutation.altitude,
    battery: battery.percentage,
    droneCamera: {
      value: droneCameraState.isActive,
      onChange: (val) => {
        droneCameraState.isActive = val;
      },
    },
    liftForce: mutation.liftForce,
    yawVelocity: mutation.yawVelocity,
    rollVelocity: mutation.rollVelocity,
    rollAngle: mutation.rollAngle,
    pitchVelocity: mutation.pitchVelocity,
    pitchAngle: mutation.pitchAngle,
    throttle: droneControlsState.throttleInput,
  }));

  useEffect(() => {
    const id = setInterval(() => {
      update({
        autoBalance: mutation.autoBalance,
        altitude: mutation.altitude,
        battery: battery.percentage,
        liftForce: mutation.liftForce,
        yawVelocity: mutation.yawVelocity,
        rollVelocity: mutation.rollVelocity,
        rollAngle: mutation.rollAngle,
        pitchVelocity: mutation.pitchVelocity,
        pitchAngle: mutation.pitchAngle,
        droneCamera: droneCameraState.isActive,
        throttle: droneControlsState.throttleInput,
      });
    }, 1000 / 5);

    return () => clearTimeout(id);
  }, []);

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
    <Fragment key="04">
      <Canvas>
        <Perf position="top-left" />
        <color attach="background" args={[0xf3f6fb]} />
        <fogExp2 attach="fog" color={0xf3f6fb} density={0.05} />
        <ambientLight intensity={0.8} />
        <directionalLight
          position={[2, 2, 2]}
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
