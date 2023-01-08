import { useEffect } from "react";
import { useControls } from "leva";

import {
  useDroneBatteryStore,
  useDroneControlsStore,
  useDroneCameraStore,
  useDroneFlightStore,
} from "../state";

// TODO: This lags.

export default function HUD() {
  const mutation = useDroneFlightStore((state) => state.mutation);
  const battery = useDroneBatteryStore((state) => state.mutation);
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
    }, 5 / 1000);

    return () => clearTimeout(id);
  }, []);

  return null;
}
