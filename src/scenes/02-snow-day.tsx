import { Fragment, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture, Stage, OrbitControls, Lathe } from "@react-three/drei";

const Snow = ({ depth = 30, amount = 3000, speed = 2 }) => {
  const tempObject = new THREE.Object3D();
  const snow = useRef<THREE.InstancedMesh>(null);
  const viewport = useThree((state) => state.viewport);
  const camera = useThree((state) => state.camera);

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
      arr[i3] = Math.floor(Math.random() * 6 - 3) * 0.2 * speed;
      arr[i3 + 1] = Math.floor(Math.random() * 6 + 3) * 0.125 * speed;
      arr[i3 + 2] = Math.floor(Math.random() * 6 - 3) * 0.1 * speed;
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
        map={colorMap}
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
    <mesh position={[0, 0.5, 0]} castShadow>
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
  const camera = useThree((state) => state.camera);

  useLayoutEffect(() => {
    camera.position.set(0, 1, 1);
  }, [camera]);

  const points = useMemo(() => {
    const _points: THREE.Vector2[] = [];
    for (let i = 0; i < 20; i++) {
      _points.push(new THREE.Vector2(Math.sin(i * 0.2) * 10 + 5, (i - 5) * 2));
    }

    return _points;
  }, []);

  return (
    <Fragment key="02">
      <color attach="background" args={[0xf3f6fb]} />
      <fogExp2 attach="fog" color={0xf3f6fb} density={0.1} />
      <Stage
        environment="forest"
        center={{ disableY: true }}
        shadows="contact"
        intensity={0.5}
        adjustCamera={2}
      >
        <Snow depth={32} amount={3000} />
        <group ref={ref}>
          <Box />
        </group>
      </Stage>
      <Ground size={32} />
      <OrbitControls
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2}
        zoomSpeed={1}
        enableZoom={true}
        makeDefault
      />
      <Lathe args={[points, 32]} position={[0, 0, 0]} scale={1.2}>
        <meshPhongMaterial color={0xf3f6fb} side={THREE.BackSide} />
      </Lathe>
    </Fragment>
  );
};

export default Scene;
