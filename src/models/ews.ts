import { IMultiPolygon, IPolygon } from "./cbrn_geojson-value";
import { IResource } from "./resource-value";

export enum DangerLevel {
  SAFE = 0,
  NEAR_DANGER = 2,
  AT_RISK = 4,
  AT_HIGH_RISK = 8,
  AT_VERY_HIGH_RISK = 16,
}

export interface IEwsStatus {
  resource: IResource;
  danger: DangerLevel;
  /** Geometry of the area the resource is exposed to */
  areaId?: string;
  warningSent?: boolean;
}