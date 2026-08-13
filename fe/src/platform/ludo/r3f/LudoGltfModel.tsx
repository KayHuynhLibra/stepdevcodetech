import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import {
  Color,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
} from "three";

/** Clone GLTF scene and optionally tint standard materials. */
export function LudoGltfModel({
  url,
  tint,
  scale = 1,
  position = [0, 0, 0],
}: {
  url: string;
  tint?: string;
  scale?: number | [number, number, number];
  position?: [number, number, number];
}) {
  const { scene } = useGLTF(url);
  const root = useMemo(() => {
    const cloned = scene.clone(true);
    if (tint) {
      const c = new Color(tint);
      cloned.traverse((obj: Object3D) => {
        const mesh = obj as Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        const src = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        const next = src.map((m: Material) => {
          const mat = m.clone() as MeshStandardMaterial;
          if (mat.color) mat.color.copy(c);
          return mat;
        });
        mesh.material = next.length === 1 ? next[0]! : next;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      });
    }
    return cloned;
  }, [scene, tint]);

  return <primitive object={root} scale={scale} position={position} />;
}

export { useGLTF };
