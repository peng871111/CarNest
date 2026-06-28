import type { VehicleBodyPanelKey } from "@/types";

export const BUYER_BODY_MAP_VIEWBOX = {
  width: 320,
  height: 610
} as const;

export type BuyerBodyMapPanelGeometry = {
  key: VehicleBodyPanelKey;
  markerX: number;
  markerY: number;
  path: string;
};

export const BUYER_BODY_MAP_PANEL_GEOMETRY: BuyerBodyMapPanelGeometry[] = [
  {
    key: "frontBumper",
    markerX: 160,
    markerY: 54,
    path: "M110 40 Q160 26 210 40 Q216 42 216 48 L214 60 Q160 52 106 60 L104 48 Q104 42 110 40 Z"
  },
  {
    key: "bonnet",
    markerX: 160,
    markerY: 196,
    path: "M110 104 Q160 82 210 104 L220 168 Q218 210 204 246 L190 286 L130 286 L116 246 Q102 210 100 168 Z"
  },
  {
    key: "leftFrontGuard",
    markerX: 80,
    markerY: 186,
    path: "M82 114 Q62 122 54 150 L54 240 Q56 254 68 258 L92 258 L106 206 L102 136 Q98 118 82 114 Z"
  },
  {
    key: "rightFrontGuard",
    markerX: 240,
    markerY: 186,
    path: "M238 114 Q258 122 266 150 L266 240 Q264 254 252 258 L228 258 L214 206 L218 136 Q222 118 238 114 Z"
  },
  {
    key: "roof",
    markerX: 160,
    markerY: 356,
    path: "M128 298 Q160 282 192 298 L196 440 Q160 460 124 440 Z"
  },
  {
    key: "leftFrontDoor",
    markerX: 102,
    markerY: 322,
    path: "M74 258 Q78 252 86 252 L128 252 L128 390 L86 390 Q74 388 72 376 L70 272 Q70 262 74 258 Z"
  },
  {
    key: "rightFrontDoor",
    markerX: 218,
    markerY: 322,
    path: "M246 258 Q242 252 234 252 L192 252 L192 390 L234 390 Q246 388 248 376 L250 272 Q250 262 246 258 Z"
  },
  {
    key: "leftRearDoor",
    markerX: 102,
    markerY: 438,
    path: "M86 390 L128 390 L132 506 L94 508 Q80 506 78 494 L76 404 Q76 394 86 390 Z"
  },
  {
    key: "rightRearDoor",
    markerX: 218,
    markerY: 438,
    path: "M234 390 L192 390 L188 506 L226 508 Q240 506 242 494 L244 404 Q244 394 234 390 Z"
  },
  {
    key: "leftRearQuarter",
    markerX: 96,
    markerY: 534,
    path: "M92 506 L132 506 L138 544 L126 596 L108 596 Q86 592 76 574 L72 526 Q72 512 92 506 Z"
  },
  {
    key: "rightRearQuarter",
    markerX: 224,
    markerY: 534,
    path: "M228 506 L188 506 L182 544 L194 596 L212 596 Q234 592 244 574 L248 526 Q248 512 228 506 Z"
  },
  {
    key: "bootLid",
    markerX: 160,
    markerY: 502,
    path: "M126 440 Q160 424 194 440 L206 520 Q160 540 114 520 Z"
  },
  {
    key: "rearBumper",
    markerX: 160,
    markerY: 580,
    path: "M124 548 Q160 538 196 548 L208 594 Q160 606 112 594 Z"
  }
];

export const BUYER_BODY_MAP_OUTLINE_PATHS = {
  shell: "M114 92 Q128 80 146 76 L174 76 Q192 80 206 92 L220 114 Q230 130 232 154 L232 184 Q230 218 220 248 L204 292 Q198 306 198 330 L198 442 Q198 466 206 498 L216 538 Q220 552 218 568 L214 594 Q212 604 198 606 L122 606 Q108 604 106 594 L102 568 Q100 552 104 538 L114 498 Q122 466 122 442 L122 330 Q122 306 116 292 L100 248 Q90 218 88 184 L88 154 Q90 130 100 114 Z",
  frontGlassLeft: "M122 114 Q128 108 138 108 Q144 108 144 114 L142 126 Q140 132 132 132 L124 130 Q120 128 120 122 Z",
  frontGlassRight: "M198 114 Q192 108 182 108 Q176 108 176 114 L178 126 Q180 132 188 132 L196 130 Q200 128 200 122 Z",
  rearGlass: "M128 444 Q160 428 192 444 L188 498 Q160 510 132 498 Z",
  rearLampLeft: "M128 556 Q132 550 142 552 L148 582 Q146 588 138 586 L128 584 Q124 582 124 576 Z",
  rearLampRight: "M192 552 Q188 550 178 552 L172 582 Q174 588 182 586 L192 584 Q196 582 196 576 Z",
  bonnetBreak: "M102 184 Q160 168 218 184",
  roofBreak: "M124 298 Q160 282 196 298",
  sillBreak: "M124 440 Q160 458 196 440"
} as const;

export const BUYER_BODY_MAP_WHEELS = [
  { cx: 50, cy: 188, outerR: 28, innerR: 20 },
  { cx: 270, cy: 188, outerR: 28, innerR: 20 },
  { cx: 54, cy: 508, outerR: 28, innerR: 20 },
  { cx: 266, cy: 508, outerR: 28, innerR: 20 }
] as const;
