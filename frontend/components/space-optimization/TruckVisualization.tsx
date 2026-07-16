"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, ContactShadows, Html } from "@react-three/drei";
import * as THREE from "three";
import type { SpaceAllocationOut } from "@/types/api";

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

// Hard cap on per-unit boxes for a single line item so an unusually large
// quantity (e.g. hundreds of sacks) can't stall the renderer.
const MAX_UNIT_BOXES_PER_ALLOCATION = 300;

interface TruckVisualizationProps {
  truckDimensions: { length: number; width: number; height: number };
  allocations: SpaceAllocationOut[];
}

function TruckContainer({ length, width, height }: { length: number; width: number; height: number }) {
  const edges = useMemo(() => {
    const geo = new THREE.BoxGeometry(length, height, width);
    return new THREE.EdgesGeometry(geo);
  }, [length, width, height]);

  return (
    <group position={[length / 2, height / 2 + 0.5, width / 2]}>
      {/* Wireframe walls */}
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#64748b" linewidth={1} />
      </lineSegments>
      {/* Solid floor with grid look */}
      <mesh position={[0, -height / 2 + 0.3, 0]} receiveShadow>
        <boxGeometry args={[length, 0.6, width]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.1} roughness={0.8} />
      </mesh>
      {/* Back wall (translucent) */}
      <mesh position={[0, 0, -width / 2 + 0.2]}>
        <boxGeometry args={[length, height, 0.4]} />
        <meshStandardMaterial color="#94a3b8" opacity={0.08} transparent />
      </mesh>
      {/* Left wall */}
      <mesh position={[-length / 2 + 0.2, 0, 0]}>
        <boxGeometry args={[0.4, height, width]} />
        <meshStandardMaterial color="#94a3b8" opacity={0.08} transparent />
      </mesh>
      {/* Right wall — the rear door end (x = length): cargo for the earliest */}
      {/* delivery stop is loaded last and ends up nearest this face. */}
      <mesh position={[length / 2 - 0.2, 0, 0]}>
        <boxGeometry args={[0.4, height, width]} />
        <meshStandardMaterial color="#f59e0b" opacity={0.12} transparent />
      </mesh>
      <Html position={[length / 2 + 0.6, 0, 0]} center distanceFactor={12}>
        <div className="pointer-events-none whitespace-nowrap rounded bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
          ▸ REAR DOOR
        </div>
      </Html>
    </group>
  );
}

function CargoBox({
  position,
  size,
  color,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  const edges = useMemo(() => {
    const geo = new THREE.BoxGeometry(...size);
    return new THREE.EdgesGeometry(geo);
  }, [size]);

  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} metalness={0.05} roughness={0.6} opacity={0.92} transparent />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#0f172a" opacity={0.4} transparent />
      </lineSegments>
    </group>
  );
}

function Scene({ truckDimensions, allocations }: TruckVisualizationProps) {
  const { length, width, height } = truckDimensions;
  const maxDim = Math.max(length, width, height);
  const scale = 8 / maxDim;

  const boxes = useMemo(() => {
    const result: { pos: [number, number, number]; size: [number, number, number]; color: string }[] = [];
    let curX = 3;
    let curZ = 3;
    let curY = 1;
    let rowMaxH = 0;
    let rowMaxW = 0;

    // Fill in loading order (deepest-loaded first): boxes are placed starting
    // at low x (far from the door) and advance toward x = length (the rear
    // door) as more are added. Since cargo for the earliest delivery stop is
    // loaded last (see space_optimizer.py), it naturally lands near the door.
    const loadingOrder = [...allocations].sort((a, b) => a.loading_sequence - b.loading_sequence);

    loadingOrder.forEach((alloc, allocIdx) => {
      const qty = Math.min(
        Math.max(1, Math.round(alloc.quantity || 1)),
        MAX_UNIT_BOXES_PER_ALLOCATION
      );
      const unitVolCm3 = (alloc.volume_m3 / qty) * 1_000_000;
      const side = Math.cbrt(unitVolCm3);
      const bL = Math.min(side * 1.4, length * 0.3);
      const bW = Math.min(side * 1.0, width * 0.4);
      const bH = Math.min(side * 0.7, height * 0.3);
      const color = COLORS[allocIdx % COLORS.length];

      for (let unit = 0; unit < qty; unit++) {
        if (curX + bL > length - 3) {
          curX = 3;
          curZ += rowMaxW + 4;
          rowMaxW = 0;
        }
        if (curZ + bW > width - 3) {
          curZ = 3;
          curX = 3;
          curY += rowMaxH + 2;
          rowMaxH = 0;
        }

        result.push({
          pos: [curX + bL / 2, curY + bH / 2, curZ + bW / 2],
          size: [bL, bH, bW],
          color,
        });

        curX += bL + 4;
        rowMaxH = Math.max(rowMaxH, bH);
        rowMaxW = Math.max(rowMaxW, bW);
      }
    });

    return result;
  }, [allocations, length, width, height]);

  return (
    <group scale={[scale, scale, scale]}>
      <TruckContainer length={length} width={width} height={height} />
      {boxes.map((box, i) => (
        <CargoBox key={i} position={box.pos} size={box.size} color={box.color} />
      ))}
    </group>
  );
}

export default function TruckVisualization({ truckDimensions, allocations }: TruckVisualizationProps) {
  const camDist = 14;

  const legendItems = useMemo(() => {
    return [...allocations]
      .sort((a, b) => a.loading_sequence - b.loading_sequence)
      .slice(0, 8)
      .map((alloc, i) => ({
        id: alloc.id,
        label: alloc.commodity_name.split(" (")[0],
        color: COLORS[i % COLORS.length],
      }));
  }, [allocations]);

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-xl border bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Canvas shadows gl={{ antialias: true }}>
        <PerspectiveCamera makeDefault position={[camDist, camDist * 0.7, camDist]} fov={45} />
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          autoRotate
          autoRotateSpeed={0.3}
          minPolarAngle={0.3}
          maxPolarAngle={Math.PI / 2.1}
        />

        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[20, 30, 15]} intensity={1.0} castShadow shadow-mapSize={1024} />
        <directionalLight position={[-10, 20, -10]} intensity={0.3} />
        <pointLight position={[-15, 20, -15]} intensity={0.4} color="#93c5fd" />
        <pointLight position={[15, 5, 15]} intensity={0.3} color="#fbbf24" />
        <hemisphereLight intensity={0.3} color="#bfdbfe" groundColor="#1e293b" />

        {/* Ground shadow */}
        <ContactShadows position={[0, -0.5, 0]} opacity={0.3} scale={20} blur={2} />

        <Scene truckDimensions={truckDimensions} allocations={allocations} />
      </Canvas>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
        {legendItems.map(({ id, label, color }) => (
          <span key={id} className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/90 backdrop-blur-sm">
            <span className="inline-block h-2.5 w-2.5 rounded-full shadow-sm" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>

      {/* Controls hint */}
      <div className="absolute right-3 top-3 rounded-full bg-white/10 px-3 py-1.5 text-[11px] text-white/70 backdrop-blur-sm">
        🖱️ Drag to rotate · Scroll to zoom
      </div>
    </div>
  );
}
