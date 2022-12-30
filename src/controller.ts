import {
  BooleanControl,
  Controller,
  KeyboardDevice,
  TouchDevice,
  VectorControl,
} from "@hmans/controlfreak";

export const controller = new Controller();

const keyboard = new KeyboardDevice();
const touch = new TouchDevice();

controller.addDevice(keyboard);
controller.addDevice(touch);

controller
  .addControl("thrustYaw", VectorControl)
  .addStep(keyboard.compositeVector("KeyW", "KeyS", "KeyA", "KeyD"));

controller
  .addControl("pitchRoll", VectorControl)
  .addStep(
    keyboard.compositeVector("ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight")
  );

controller
  .addControl("throttling", BooleanControl)
  .addStep(keyboard.whenKeyPressed(["KeyW"]));

controller
  .addControl("rolling", BooleanControl)
  .addStep(keyboard.whenKeyPressed(["ArrowLeft", "ArrowRight"]));

controller
  .addControl("yawing", BooleanControl)
  .addStep(keyboard.whenKeyPressed(["KeyA", "KeyD"]));

controller
  .addControl("pitching", BooleanControl)
  .addStep(keyboard.whenKeyPressed(["ArrowUp", "ArrowDown"]));

controller.onDeviceChange.add((d) => console.log("new device:", d));
