import * as THREE from "three";

export const repeatTextures = (
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
