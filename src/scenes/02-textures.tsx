import { RootState, useFrame } from "@react-three/fiber";
import { PerspectiveCamera, useTexture, Stage } from "@react-three/drei";
import * as THREE from "three";
import { useRef } from "react";

const repeatTextures = (
  textures: THREE.Texture | THREE.Texture[],
  repeat = 8
) => {
  if (!Array.isArray(textures)) {
    return;
  }

  for (let i = 0; i < textures.length; i++) {
    const t = textures[i];
    t.repeat.set(repeat, repeat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
};

const Ground = () => {
  const [colorMap, normalMap, roughnessMap, aoMap] = useTexture(
    [
      "/textures/snow/snow-color.jpg",
      "/textures/snow/snow-normal.jpg",
      "/textures/snow/snow-roughness.jpg",
      "/textures/snow/snow-ambient-occlusion.jpg",
    ],
    (textures) => {
      repeatTextures(textures);
    }
  );

  return (
    <mesh position={[0, 0, 0]} rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial
        displacementScale={0.2}
        map={colorMap}
        displacementMap={colorMap}
        normalMap={normalMap}
        roughnessMap={roughnessMap}
        aoMap={aoMap}
        metalness={0}
        color={0xffffff}
      />
    </mesh>
  );
};

const Box = () => {
  const [colorMap, metalnessMap, normalMap, roughnessMap, aoMap] = useTexture([
    "/textures/stylized-crate/stylized-crate-color.jpg",
    "/textures/stylized-crate/stylized-crate-metallic.jpg",
    "/textures/stylized-crate/stylized-crate-normal.jpg",
    "/textures/stylized-crate/stylized-crate-roughness.jpg",
    "/textures/stylized-crate/stylized-crate-ambientOcclusion.jpg",
  ]);

  return (
    <mesh position={[0, 0.6, 0]} castShadow>
      <boxGeometry args={[1, 1, 1, 1, 1]} />
      <meshStandardMaterial
        map={colorMap}
        metalnessMap={metalnessMap}
        normalMap={normalMap}
        roughnessMap={roughnessMap}
        aoMap={aoMap}
      />
    </mesh>
  );
};

const Scene = () => {
  const ref = useRef<THREE.Group>(null);
  const perspectiveCamera = useRef<THREE.PerspectiveCamera>(null);

  useFrame((state: RootState, delta: number) => {
    if (!ref.current) {
      return;
    }

    ref.current.rotation.y += delta;
  });

  return (
    <group>
      <PerspectiveCamera
        makeDefault
        ref={perspectiveCamera}
        near={0.01}
        far={1000}
        position={[0, 0, 100]}
        fov={60}
      />

      <Stage
        preset="rembrandt"
        environment="forest"
        center={{ disableY: true }}
      >
        <group ref={ref}>
          <Box />
        </group>
      </Stage>
      <Ground />
    </group>
  );
};

export default Scene;
