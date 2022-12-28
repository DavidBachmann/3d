import { useFrame, useThree } from "@react-three/fiber";
import { useTexture, Stage } from "@react-three/drei";
import * as THREE from "three";
import { Fragment, useMemo, useRef } from "react";

const Snow = ({ depth = 30, amount = 3000 }) => {
  const tempObject = new THREE.Object3D();
  const snow = useRef<THREE.InstancedMesh>(null);
  const { viewport, camera } = useThree();

  const flakeColor = useTexture("/textures/flake.png");

  const a1Array = useMemo(() => {
    const arr = new Float32Array(amount * 3);
    for (let i = 0; i < amount; i++) {
      const z = Math.random() * depth;
      const { width, height } = viewport.getCurrentViewport(
        camera,
        new THREE.Vector3(0, 0, z)
      );
      const i3 = 3 * i;
      const w = 10 || width;
      const h = 10 || height;
      arr[i3] = THREE.MathUtils.randFloatSpread(w);
      arr[i3 + 1] = THREE.MathUtils.randFloatSpread(h) + h;
      arr[i3 + 2] = z;
    }
    return arr;
  }, [camera, viewport, amount]);

  const aVelocities = useMemo(() => {
    const arr = new Float32Array(amount * 3);
    for (let i = 0; i < amount; i++) {
      const i3 = 3 * i;
      arr[i3] = Math.floor(Math.random() * 6 - 3) * 0.2;
      arr[i3 + 1] = Math.floor(Math.random() * 6 + 3) * 0.125;
      arr[i3 + 2] = Math.floor(Math.random() * 6 - 3) * 0.1;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!snow.current) {
      return;
    }

    for (let i = 0; i < amount; i++) {
      const id = i;
      const i3 = 3 * i;
      const time = state.clock.elapsedTime;
      tempObject.position.set(
        a1Array[i3] + Math.sin(time * aVelocities[i3]) * 1.5,
        a1Array[i3 + 1] -
          ((time * aVelocities[i3 + 1]) % (1 + a1Array[i3 + 1])),
        a1Array[i3 + 2]
      );
      tempObject.updateMatrix();
      snow.current.setMatrixAt(id, tempObject.matrix);
      snow.current.lookAt(camera.position);
    }

    snow.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={snow} args={[undefined, undefined, amount]}>
      <planeGeometry args={[0.1, 0.1]}>
        <instancedBufferAttribute args={[a1Array, 3]} />
        <instancedBufferAttribute args={[aVelocities, 3]} />
      </planeGeometry>
      <meshStandardMaterial
        map={flakeColor}
        alphaMap={flakeColor}
        transparent
        alphaTest={0.4}
        opacity={0.6}
      />
    </instancedMesh>
  );
};

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

const Ground = ({ size = 200 }) => {
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
      <planeGeometry args={[size, size]} />
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

  return (
    <Fragment key="02">
      <color attach="background" args={[0xf3f6fb]} />
      <fogExp2 attach="fog" color={0xf3f6fb} density={0.02} />

      <Stage
        preset="rembrandt"
        environment="sunset"
        center={{ disableY: true }}
        shadows="contact"
        intensity={0.5}
      >
        <Snow depth={100} amount={3000} />
        <group ref={ref}>
          <Box />
        </group>
      </Stage>
      <Ground size={100} />
    </Fragment>
  );
};

export default Scene;
