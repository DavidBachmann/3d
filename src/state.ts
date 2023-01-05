import create from "zustand";
import { combine } from "zustand/middleware";

// Drone flight state
export const useDroneFlightStore = create(() => ({
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

export const useDroneControlsStore = create(
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
export const useDroneCameraStore = create(() => ({
  camera: null,
  mutation: {
    isActive: false,
  },
}));

// Battery state
export const useDroneBatteryStore = create(
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
