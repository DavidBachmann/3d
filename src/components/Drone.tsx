import * as THREE from "three";
import { PerspectiveCamera, useGLTF, useTexture } from "@react-three/drei";
import {
  forwardRef,
  MutableRefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { GLTF } from "three-stdlib";
import CameraControls from "camera-controls";
import { PublicApi, Quad, Triplet } from "@react-three/cannon";
import { useFrame, useThree, extend } from "@react-three/fiber";
import { KeyboardDevice, TouchDevice } from "@hmans/controlfreak";
import { controller } from "../controller";
import { linearScale } from "../utils/scale";
import { clamp } from "../utils/clamp";
import { batteryShaderMaterial as BatteryShaderMaterial } from "../shaders/battery";

import {
  useDroneFlightStore,
  useDroneBatteryStore,
  useDroneControlsStore,
  useDroneCameraStore,
} from "../state";
import { constants } from "../constants";

// Make battery shader available as jsx element
extend({ BatteryShaderMaterial });
// Make Camera Controls available as jsx element
CameraControls.install({ THREE });
extend({ CameraControls });

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

const torqueVector = new THREE.Vector3();
const torqueQuaternion = new THREE.Quaternion();
const dronePosition = new THREE.Vector3();
const droneEuler = new THREE.Euler();
const worldVector = new THREE.Vector3();
const cameraOffset = new THREE.Vector3(0, 0, -1);

const unitVector = new THREE.Vector3();

export const Drone = forwardRef<THREE.Group, ModelProps>(
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
    const ccRef = useRef<CameraControls>(null);

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

      if (ccRef.current) {
        ccRef.current.setOrbitPoint(
          drone.current.position[0],
          drone.current.position[1],
          drone.current.position[2]
        );
      }
    }, [ccRef]);

    api.quaternion.subscribe((val) => (quaternion.current = val));
    api.rotation.subscribe((val) => (rotation.current = val));
    api.position.subscribe((val) => (position.current = val));

    //ccRef.current?.setLookAt(
    //  position.current[0] ?? 0,
    //  position.current[1] ?? 0,
    //  position.current[2] ?? 0,
    //  position.current[0] ?? 0,
    //  position.current[1] ?? 0,
    //  position.current[2] ?? 0
    //);

    controller.onDeviceChange.add((d) => {
      if (d instanceof KeyboardDevice) {
        return activateKeyboard();
      }
      if (d instanceof TouchDevice) {
        return activateJoystick();
      }
    });

    useFrame((state, dt) => {
      if (!ccRef?.current) {
        return;
      }
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

      // FLIGHT LOGIC

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

      const pc = position.current;

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

      // Look at drone
      //ccRef.current?.moveTo(0, 0, 0.5);

      //ccRef.current?.rotateTo(
      //  //Math.PI + rotation.current[1],
      //  rotation.current[1],
      //  -Math.PI / 1,
      //  false
      //);

      ccRef.current?.setLookAt(
        pc[0],
        pc[1] + 1,
        pc[2] - 1,
        pc[0],
        pc[1],
        pc[2],
        false
      );

      console.log(drone.current.getWorldDirection(unitVector));

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
        <Cam ref={ccRef} />
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

export const Cam = forwardRef<CameraControls, any>(
  (props, ref: MutableRefObject<CameraControls>) => {
    const camera = useThree((state) => state.camera);
    const gl = useThree((state) => state.gl);
    useFrame((state, delta) => ref.current.update(delta));

    useEffect(() => {
      if (ref?.current) {
        //ref.current.rotateAzimuthTo(720, true);
      }
    });

    return (
      <cameraControls ref={ref} args={[camera, gl.domElement]} {...props} />
    );
  }
);

useGLTF.preload("/gltfs/quadcopter.gltf");
