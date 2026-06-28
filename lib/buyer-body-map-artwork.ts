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
    markerY: 56,
    path: "M110 42 Q160 27 210 42 Q216 44 216 51 L214 65 Q160 56 106 65 L104 51 Q104 44 110 42 Z"
  },
  {
    key: "bonnet",
    markerX: 160,
    markerY: 198,
    path: "M112 108 Q160 84 208 108 L220 180 Q214 234 190 292 L130 292 Q106 234 100 180 Z"
  },
  {
    key: "leftFrontGuard",
    markerX: 84,
    markerY: 188,
    path: "M80 116 Q60 126 52 152 L52 236 Q54 250 66 254 L92 254 L108 198 L102 138 Q98 120 80 116 Z"
  },
  {
    key: "rightFrontGuard",
    markerX: 236,
    markerY: 188,
    path: "M240 116 Q260 126 268 152 L268 236 Q266 250 254 254 L228 254 L212 198 L218 138 Q222 120 240 116 Z"
  },
  {
    key: "roof",
    markerX: 160,
    markerY: 356,
    path: "M126 304 Q160 286 194 304 L198 454 Q160 472 122 454 Z"
  },
  {
    key: "leftFrontDoor",
    markerX: 102,
    markerY: 324,
    path: "M72 262 Q76 256 84 256 L126 256 L126 392 L84 392 Q72 390 70 378 L68 278 Q68 266 72 262 Z"
  },
  {
    key: "rightFrontDoor",
    markerX: 218,
    markerY: 324,
    path: "M248 262 Q244 256 236 256 L194 256 L194 392 L236 392 Q248 390 250 378 L252 278 Q252 266 248 262 Z"
  },
  {
    key: "leftRearDoor",
    markerX: 102,
    markerY: 444,
    path: "M84 392 L126 392 L130 520 L94 522 Q78 518 76 504 L74 406 Q74 396 84 392 Z"
  },
  {
    key: "rightRearDoor",
    markerX: 218,
    markerY: 444,
    path: "M236 392 L194 392 L190 520 L226 522 Q242 518 244 504 L246 406 Q246 396 236 392 Z"
  },
  {
    key: "leftRearQuarter",
    markerX: 96,
    markerY: 540,
    path: "M92 520 L130 520 L136 564 L108 576 Q86 574 78 558 L70 532 Q68 524 76 522 Z"
  },
  {
    key: "rightRearQuarter",
    markerX: 224,
    markerY: 540,
    path: "M228 520 L190 520 L184 564 L212 576 Q234 574 242 558 L250 532 Q252 524 244 522 Z"
  },
  {
    key: "bootLid",
    markerX: 160,
    markerY: 500,
    path: "M124 444 Q160 426 196 444 L206 528 Q160 548 114 528 Z"
  },
  {
    key: "rearBumper",
    markerX: 160,
    markerY: 586,
    path: "M126 560 Q160 548 194 560 L206 594 Q160 604 114 594 Z"
  }
];

export const BUYER_BODY_MAP_OUTLINE_PATHS = {
  shell: "M114 94 Q128 82 146 78 L174 78 Q192 82 206 94 L220 116 Q230 132 232 154 L232 188 Q230 220 220 250 L204 296 Q198 308 198 330 L198 454 Q198 470 204 494 L214 532 Q218 548 214 562 L206 592 Q204 600 194 602 L126 602 Q116 600 114 592 L106 562 Q102 548 106 532 L116 494 Q122 470 122 454 L122 330 Q122 308 116 296 L100 250 Q90 220 88 188 L88 154 Q90 132 100 116 Z",
  frontGlassLeft: "M122 116 Q130 110 140 112 Q144 113 144 119 L142 130 Q140 134 134 134 L124 132 Q120 130 120 124 Z",
  frontGlassRight: "M198 116 Q190 110 180 112 Q176 113 176 119 L178 130 Q180 134 186 134 L196 132 Q200 130 200 124 Z",
  rearGlass: "M128 446 Q160 430 192 446 L188 504 Q160 514 132 504 Z",
  bonnetBreak: "M100 188 Q160 170 220 188",
  roofBreak: "M122 304 Q160 286 198 304",
  sillBreak: "M122 454 Q160 472 198 454"
} as const;

export const BUYER_BODY_MAP_WHEELS = [
  { cx: 50, cy: 184, outerR: 28, innerR: 20 },
  { cx: 270, cy: 184, outerR: 28, innerR: 20 },
  { cx: 54, cy: 532, outerR: 28, innerR: 20 },
  { cx: 266, cy: 532, outerR: 28, innerR: 20 }
] as const;
