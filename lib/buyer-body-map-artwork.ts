import type { VehicleBodyPanelKey } from "@/types";

export const BUYER_BODY_MAP_REFERENCE_SVG_PATH = "/body-maps/carnest-reference-embedded-body-map.svg";

export const BUYER_BODY_MAP_VIEWBOX = {
  width: 420,
  height: 760
} as const;

export type BuyerBodyMapPanelArea = {
  key: VehicleBodyPanelKey;
  markerX: number;
  markerY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
};

export const BUYER_BODY_MAP_PANEL_AREAS: BuyerBodyMapPanelArea[] = [
  { key: "frontBumper", markerX: 210, markerY: 46, x: 120, y: 25, width: 180, height: 67, rx: 12 },
  { key: "bonnet", markerX: 210, markerY: 214, x: 125, y: 135, width: 170, height: 157, rx: 26 },
  { key: "roof", markerX: 210, markerY: 391, x: 145, y: 300, width: 130, height: 182, rx: 45 },
  { key: "bootLid", markerX: 210, markerY: 570, x: 135, y: 500, width: 150, height: 140, rx: 22 },
  { key: "rearBumper", markerX: 210, markerY: 692, x: 120, y: 650, width: 180, height: 85, rx: 12 },
  { key: "leftFrontGuard", markerX: 100, markerY: 212.5, x: 55, y: 110, width: 90, height: 205, rx: 35 },
  { key: "rightFrontGuard", markerX: 320, markerY: 212.5, x: 275, y: 110, width: 90, height: 205, rx: 35 },
  { key: "leftFrontDoor", markerX: 115, markerY: 402.5, x: 70, y: 300, width: 90, height: 205, rx: 18 },
  { key: "rightFrontDoor", markerX: 305, markerY: 402.5, x: 260, y: 300, width: 90, height: 205, rx: 18 },
  { key: "leftRearDoor", markerX: 117.5, markerY: 570, x: 75, y: 490, width: 85, height: 160, rx: 18 },
  { key: "rightRearDoor", markerX: 302.5, markerY: 570, x: 260, y: 490, width: 85, height: 160, rx: 18 },
  { key: "leftRearQuarter", markerX: 95, markerY: 647.5, x: 45, y: 560, width: 100, height: 175, rx: 18 },
  { key: "rightRearQuarter", markerX: 325, markerY: 647.5, x: 275, y: 560, width: 100, height: 175, rx: 18 }
] as const;
