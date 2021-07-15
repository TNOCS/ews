import {
  Geometry,
  LineString,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Point,
  Polygon,
} from '@turf/turf';
import { DangerLevel, PriorityType, MessageType, ICbrnFeatureCollection, ICbrnFeature } from '../models';

/**
 * Create a GUID
 * @see https://stackoverflow.com/a/2117523/319711
 *
 * @returns RFC4122 version 4 compliant GUID
 */
export const uuid4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    // tslint:disable-next-line:no-bitwise
    const r = (Math.random() * 16) | 0;
    // tslint:disable-next-line:no-bitwise
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const uniquePlumeId = (id: string, p: ICbrnFeature) => `${id}_${Math.round((p.properties?.level || 0) * 1e8)}_${p.properties.deltaTime || 0}`;

/** Convert a GeoJSON geometry to an AVRO representation */
export const geometryToAvro: (
  geometry?:
    | Point
    | MultiPoint
    | LineString
    | MultiLineString
    | Polygon
    | MultiPolygon
) => Record<string, Geometry> | undefined = (
  geometry?:
    | Point
    | MultiPoint
    | LineString
    | MultiLineString
    | Polygon
    | MultiPolygon
) => {
    if (!geometry) {
      return;
    }
    return {
      [`nl.tno.assistance.geojson.geometry.${geometry.type}`]: {
        type: geometry.type,
        coordinates: geometry.coordinates,
      } as Geometry,
    };
  };

export const convertToxicityLevelToDangerLevel = (level: number | null = 0) => level === null || level < 1e-7
  ? DangerLevel.SAFE
  : level <= 1e-6
    ? DangerLevel.AT_RISK
    : level <= 5e-6
      ? DangerLevel.AT_HIGH_RISK
      : DangerLevel.AT_VERY_HIGH_RISK;

const dangerLevelToPriorityTable = {
  [DangerLevel.SAFE]: PriorityType.LOW,
  [DangerLevel.NEAR_DANGER]: PriorityType.MEDIUM,
  [DangerLevel.AT_RISK]: PriorityType.HIGH,
  [DangerLevel.AT_HIGH_RISK]: PriorityType.HIGH,
  [DangerLevel.AT_VERY_HIGH_RISK]: PriorityType.VERY_HIGH,
}
export const dangerLevelToPriority = (danger: DangerLevel) => dangerLevelToPriorityTable[danger];

const dangerLevelToMessageTypeTable = {
  [DangerLevel.SAFE]: MessageType.INFO,
  [DangerLevel.NEAR_DANGER]: MessageType.WARNING,
  [DangerLevel.AT_RISK]: MessageType.WARNING,
  [DangerLevel.AT_HIGH_RISK]: MessageType.DANGER,
  [DangerLevel.AT_VERY_HIGH_RISK]: MessageType.DANGER,
}
export const dangerLevelToMessageType = (danger: DangerLevel) => dangerLevelToMessageTypeTable[danger];

const dangerLevelToMessageTable = {
  [DangerLevel.SAFE]: () => `You have reached a safe area again.`,
  [DangerLevel.NEAR_DANGER]: () => `WATCH OUT: You are near a toxic area!`,
  [DangerLevel.AT_RISK]: () => `DANGER: You are at risk and exposed to a toxic chemical substance!`,
  [DangerLevel.AT_HIGH_RISK]: () => `DANGER: You are at high risk and exposed to a HIGH toxicity level!`,
  [DangerLevel.AT_VERY_HIGH_RISK]: () => `DANGER: You are exposed to a VERY HIGH toxicity level!`,
}
export const dangerLevelToMessage = (danger: DangerLevel) => dangerLevelToMessageTable[danger]();

export const preparePlume = (collection: any) => {
  if (!collection.features) return;
  for (const feature of collection.features) {
    if (feature.geometry[`nl.tno.assistance.geojson.geometry.Point`]) {
      feature.geometry = feature.geometry[`nl.tno.assistance.geojson.geometry.Point`];
    }
    else if (feature.geometry[`nl.tno.assistance.geojson.geometry.MultiPoint`]) {
      feature.geometry = feature.geometry[`nl.tno.assistance.geojson.geometry.MultiPoint`];
    }
    else if (feature.geometry[`nl.tno.assistance.geojson.geometry.LineString`]) {
      feature.geometry = feature.geometry[`nl.tno.assistance.geojson.geometry.LineString`];
    }
    else if (feature.geometry[`nl.tno.assistance.geojson.geometry.MultiLineString`]) {
      feature.geometry = feature.geometry[`nl.tno.assistance.geojson.geometry.MultiLineString`];
    }
    else if (feature.geometry[`nl.tno.assistance.geojson.geometry.Polygon`]) {
      feature.geometry = feature.geometry[`nl.tno.assistance.geojson.geometry.Polygon`];
    }
    else if (feature.geometry[`nl.tno.assistance.geojson.geometry.MultiPolygon`]) {
      feature.geometry = feature.geometry[`nl.tno.assistance.geojson.geometry.MultiPolygon`];
    }
  }
  return collection as ICbrnFeatureCollection;
}