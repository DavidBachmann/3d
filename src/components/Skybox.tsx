import { useThree } from "@react-three/fiber";
import { CubeTextureLoader } from "three";

function Skybox() {
  const { scene } = useThree();
  const loader = new CubeTextureLoader();
  const texture = loader.load([
    "/textures/skybox/BlueSky_LF.png",
    "/textures/skybox/BlueSky_RT.png",
    "/textures/skybox/BlueSky_UP.png",
    "/textures/skybox/BlueSky_DN.png",
    "/textures/skybox/BlueSky_FR.png",
    "/textures/skybox/BlueSky_BK.png",
  ]);

  scene.background = texture;
  return null;
}

export default Skybox;
