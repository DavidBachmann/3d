export const constants = {
  maxAltitude: 3,
  droneAttributes: {
    size: 0.38,
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
