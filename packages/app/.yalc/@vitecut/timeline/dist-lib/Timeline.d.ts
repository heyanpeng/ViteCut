import React from "react";
import type { TimelineProps, TimelineState } from "./types";
import "./Timeline.css";
export { timeToPixel as frameToPixel, pixelToTime as pixelToFrame, } from "./utils";
export declare const Timeline: React.ForwardRefExoticComponent<TimelineProps & React.RefAttributes<TimelineState>>;
