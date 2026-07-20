"use client";

import { useMemo } from "react";
import {
  VEHICLE_WHEEL_DAMAGE_TYPE_LABELS,
  VEHICLE_WHEEL_DAMAGE_TYPES,
  VEHICLE_WHEEL_POSITION_LABELS,
  VEHICLE_WHEEL_ZONE_LABELS,
  VEHICLE_WHEEL_ZONE_MARKERS,
  VEHICLE_WHEEL_ZONES,
} from "@/lib/vehicle-wheel-condition";
import type {
  VehicleWheelDamageType,
  VehicleWheelPosition,
  VehicleWheelZone,
  WarehouseVehicleWheelDamageRecord,
} from "@/types";

type WheelTone = {
  fill: string;
  stroke: string;
  text: string;
};

const WHEEL_DAMAGE_TONES: Record<VehicleWheelDamageType, WheelTone> = {
  original: { fill: "#ECFDF5", stroke: "#6EE7B7", text: "#065F46" },
  scratch: { fill: "#FEF3C7", stroke: "#F59E0B", text: "#92400E" },
  curb_rash: { fill: "#FFE4D5", stroke: "#F97316", text: "#9A3412" },
  dent_bend: { fill: "#FEE2E2", stroke: "#EF4444", text: "#991B1B" },
  crack: { fill: "#F5D0FE", stroke: "#C026D3", text: "#86198F" },
  repaired_damage: { fill: "#E0F2FE", stroke: "#38BDF8", text: "#075985" },
};

type WheelSegment = {
  id: string;
  zone: VehicleWheelZone;
  path: string;
};

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeAnnularSector(
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
) {
  const outerStart = polarToCartesian(centerX, centerY, outerRadius, endAngle);
  const outerEnd = polarToCartesian(centerX, centerY, outerRadius, startAngle);
  const innerStart = polarToCartesian(centerX, centerY, innerRadius, startAngle);
  const innerEnd = polarToCartesian(centerX, centerY, innerRadius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M", outerStart.x, outerStart.y,
    "A", outerRadius, outerRadius, 0, largeArcFlag, 0, outerEnd.x, outerEnd.y,
    "L", innerStart.x, innerStart.y,
    "A", innerRadius, innerRadius, 0, largeArcFlag, 1, innerEnd.x, innerEnd.y,
    "Z",
  ].join(" ");
}

const QUADRANTS = [
  { key: "top", start: 315, end: 405 },
  { key: "right", start: 45, end: 135 },
  { key: "bottom", start: 135, end: 225 },
  { key: "left", start: 225, end: 315 },
] as const;

const WHEEL_SEGMENTS: WheelSegment[] = [
  ...QUADRANTS.map((quadrant) => ({
    id: `tyre_sidewall-${quadrant.key}`,
    zone: "tyre_sidewall" as const,
    path: describeAnnularSector(100, 100, 78, 96, quadrant.start, quadrant.end),
  })),
  ...QUADRANTS.map((quadrant) => ({
    id: `outer_rim_${quadrant.key}`,
    zone: `outer_rim_${quadrant.key}` as VehicleWheelZone,
    path: describeAnnularSector(100, 100, 58, 76, quadrant.start, quadrant.end),
  })),
  ...QUADRANTS.map((quadrant) => ({
    id: `inner_rim_${quadrant.key}`,
    zone: `inner_rim_${quadrant.key}` as VehicleWheelZone,
    path: describeAnnularSector(100, 100, 28, 56, quadrant.start, quadrant.end),
  })),
];

export function WheelRimConditionMap({
  position,
  records = [],
  selectedZone,
  editable = false,
  onZoneSelect,
}: {
  position: VehicleWheelPosition;
  records?: WarehouseVehicleWheelDamageRecord[];
  selectedZone?: VehicleWheelZone;
  editable?: boolean;
  onZoneSelect?: (position: VehicleWheelPosition, zone: VehicleWheelZone) => void;
}) {
  const recordsByZone = useMemo(() => {
    const next = new Map<VehicleWheelZone, WarehouseVehicleWheelDamageRecord>();
    for (const record of records) {
      next.set(record.wheelZone, record);
    }
    return next;
  }, [records]);

  const handleZoneSelect = (zone: VehicleWheelZone) => {
    if (!editable) return;
    onZoneSelect?.(position, zone);
  };

  return (
    <div className="rounded-[24px] border border-black/6 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{VEHICLE_WHEEL_POSITION_LABELS[position]}</p>
          <p className="mt-1 text-xs leading-5 text-ink/55">
            {editable ? "Tap a rim or tyre zone to record precise wheel condition." : "Recorded wheel and rim condition."}
          </p>
        </div>
      </div>

      <svg
        viewBox="0 0 200 200"
        className="mx-auto mt-4 block w-full max-w-[18rem] overflow-visible"
        role={editable ? "group" : "img"}
        aria-label={`${VEHICLE_WHEEL_POSITION_LABELS[position]} condition map`}
      >
        <circle cx="100" cy="100" r="98" fill="#F7F1E7" stroke="#D9CBB9" strokeWidth="2" />
        <circle cx="100" cy="100" r="80" fill="#FDFBF7" stroke="#E4D8C8" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="58" fill="#FBF7F1" stroke="#E6D9C8" strokeWidth="1.2" />
        <circle cx="100" cy="100" r="28" fill="#F6EFE4" stroke="#D7C8B5" strokeWidth="1.4" />

        {WHEEL_SEGMENTS.map((segment) => {
          const record = recordsByZone.get(segment.zone);
          const damageType = record?.damageType ?? "original";
          const tone = WHEEL_DAMAGE_TONES[damageType];
          const isSelected = selectedZone === segment.zone;
          const hasRecord = Boolean(record);

          return (
            <path
              key={segment.id}
              d={segment.path}
              fill={hasRecord ? tone.fill : "transparent"}
              fillOpacity={hasRecord ? 0.58 : 0}
              stroke={isSelected ? "#171512" : hasRecord ? tone.stroke : "#D8CCBD"}
              strokeWidth={isSelected ? 2.4 : 1.1}
              className={editable ? "cursor-pointer transition hover:opacity-90" : ""}
              onClick={() => handleZoneSelect(segment.zone)}
            />
          );
        })}

        {(() => {
          const record = recordsByZone.get("centre");
          const tone = WHEEL_DAMAGE_TONES[record?.damageType ?? "original"];
          const isSelected = selectedZone === "centre";
          return (
            <circle
              cx="100"
              cy="100"
              r="23"
              fill={record ? tone.fill : "#F9F4EC"}
              fillOpacity={record ? 0.64 : 1}
              stroke={isSelected ? "#171512" : record ? tone.stroke : "#D8CCBD"}
              strokeWidth={isSelected ? 2.4 : 1.3}
              className={editable ? "cursor-pointer transition hover:opacity-90" : ""}
              onClick={() => handleZoneSelect("centre")}
            />
          );
        })()}

        <circle cx="100" cy="100" r="9" fill="#1F1B17" opacity="0.82" />
        {[0, 60, 120, 180, 240, 300].map((angle) => {
          const point = polarToCartesian(100, 100, 42, angle);
          return <circle key={angle} cx={point.x} cy={point.y} r="3.2" fill="#BFA889" />;
        })}

        {VEHICLE_WHEEL_ZONES.map((zone) => {
          const record = recordsByZone.get(zone);
          if (!record) return null;
          const marker = VEHICLE_WHEEL_ZONE_MARKERS[zone];
          return (
            <g key={`marker-${zone}`}>
              <circle cx={marker.x} cy={marker.y} r="9" fill="#171512" stroke="#D1A75F" strokeWidth="1.4" />
              <text
                x={marker.x}
                y={marker.y + 0.5}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="7"
                fontWeight="700"
                fill="#F2D39A"
              >
                {record.photoIds.length || 1}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-4 flex flex-wrap gap-2">
        {VEHICLE_WHEEL_DAMAGE_TYPES.map((damageType) => {
          const tone = WHEEL_DAMAGE_TONES[damageType];
          return (
            <span
              key={damageType}
              className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
              style={{ borderColor: tone.stroke, backgroundColor: tone.fill, color: tone.text }}
            >
              {VEHICLE_WHEEL_DAMAGE_TYPE_LABELS[damageType]}
            </span>
          );
        })}
      </div>

      {selectedZone ? (
        <p className="mt-3 rounded-[18px] border border-black/6 bg-shell px-3 py-2 text-xs font-semibold text-ink/60">
          Selected: {VEHICLE_WHEEL_ZONE_LABELS[selectedZone]}
        </p>
      ) : null}
    </div>
  );
}
