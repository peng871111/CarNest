import type { VehicleBodyPanelKey } from "@/types";

export const BUYER_BODY_MAP_REFERENCE_SVG_PATH = "/body-maps/carnest-reference-embedded-body-map.svg";

export const BUYER_BODY_MAP_VIEWBOX = {
  width: 515,
  height: 675
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
  { key: "frontBumper", markerX: 257.5, markerY: 27.5, x: 170, y: 0, width: 175, height: 55, rx: 12 },
  { key: "bonnet", markerX: 257.5, markerY: 170, x: 155, y: 90, width: 205, height: 160, rx: 26 },
  { key: "roof", markerX: 257.5, markerY: 377.5, x: 180, y: 250, width: 155, height: 255, rx: 45 },
  { key: "bootLid", markerX: 257.5, markerY: 552.5, x: 165, y: 505, width: 185, height: 95, rx: 22 },
  { key: "rearBumper", markerX: 257.5, markerY: 635, x: 170, y: 605, width: 175, height: 60, rx: 12 },
  { key: "leftFrontGuard", markerX: 120, markerY: 162.5, x: 75, y: 75, width: 90, height: 175, rx: 35 },
  { key: "rightFrontGuard", markerX: 395, markerY: 162.5, x: 350, y: 75, width: 90, height: 175, rx: 35 },
  { key: "leftFrontDoor", markerX: 135, markerY: 365, x: 85, y: 250, width: 100, height: 230, rx: 18 },
  { key: "rightFrontDoor", markerX: 380, markerY: 365, x: 330, y: 250, width: 100, height: 230, rx: 18 },
  { key: "leftRearDoor", markerX: 135, markerY: 527.5, x: 80, y: 480, width: 110, height: 95, rx: 18 },
  { key: "rightRearDoor", markerX: 380, markerY: 527.5, x: 325, y: 480, width: 110, height: 95, rx: 18 },
  { key: "leftRearQuarter", markerX: 127.5, markerY: 620, x: 75, y: 575, width: 105, height: 90, rx: 18 },
  { key: "rightRearQuarter", markerX: 387.5, markerY: 620, x: 335, y: 575, width: 105, height: 90, rx: 18 }
] as const;
