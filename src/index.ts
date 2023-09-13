import {
  TestBedAdapter,
  Logger,
  LogLevel,
  ProduceRequest,
  IAdapterMessage,
} from 'node-test-bed-adapter';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { IMessage, IPolygon, IResource, ICbrnFeature, IEwsStatus, DangerLevel } from './models';
import { IPoint } from './models/cbrn_geojson-value';
import { convertToxicityLevelToDangerLevel, dangerLevelToMessage, dangerLevelToMessageType, dangerLevelToPriority, geometryToAvro, preparePlume, uniquePlumeId, uuid4 } from './utils';

const clientId = 'EWS';
const MessageTopic = 'message';
const ResourceTopic = 'resource';
const PlumeTopic = 'cbrn_geojson';
const MESSAGE_ID_PREAMBLE = 'TNO_TEST_';
// const ChemicalIncidentTopic = 'chemical_incident';
const log = Logger.instance;
/** Check resource safety every EWS_INTERVAL sec */
const EWS_INTERVAL = 10;

const plumeStore = {} as { [id: string]: ICbrnFeature };
const resourceStore = {} as { [id: string]: IResource };
let ewsStatus = {} as { [id: string]: IEwsStatus };

let adapter: TestBedAdapter;

const startEws = () => {
  const hasLargeFileService = false;
  adapter = new TestBedAdapter({
    kafkaHost: process.env.KAFKA_HOST || 'localhost:3501',
    schemaRegistry: process.env.SCHEMA_REGISTRY || 'localhost:3502',
    // kafkaHost: process.env.KAFKA_HOST || 'driver-testbed.eu:3501',
    // schemaRegistry: process.env.SCHEMA_REGISTRY || 'driver-testbed.eu:3502',
    largeFileService: hasLargeFileService ? 'localhost:9090' : undefined,
    // sslOptions: {
    //   pfx: fs.readFileSync('../certs/other-tool-1-client.p12'),
    //   passphrase: 'changeit',
    //   ca: fs.readFileSync('../certs/test-ca.pem'),
    //   rejectUnauthorized: true,
    // },
    clientId,
    fetchAllSchemas: false,
    fetchAllVersions: false,
    // autoRegisterSchemas: true,
    autoRegisterSchemas: false,
    wrapUnions: 'auto',
    schemaFolder: process.env.SCHEMA_FOLDER || `${process.cwd()}/src/schemas`,
    consume: [
      { topic: PlumeTopic },
      { topic: ResourceTopic },
    ],
    produce: [MessageTopic],
    logging: {
      logToConsole: LogLevel.Info,
      logToKafka: LogLevel.Warn,
    },
  });
  adapter.on('error', (e) => console.error(e));
  adapter.on('message', (e) => handleMessage(e));
  adapter.on('ready', () => {
    log.info(`${clientId} is connected.`);
    verifyResourceSafety();
  });
  adapter.connect();
};

const verifyResourceSafety = () => {
  const plumeCount = Object.keys(plumeStore).length;
  const resourceCount = Object.keys(resourceStore).length;
  const resources = Object.values(resourceStore);
  const newEwsState = Object
    .entries(plumeStore)
    .filter(([_, f]) => f.geometry && f.geometry.type && /polygon/i.test(f.geometry.type))
    .reduce((acc, [areaId, f]) => {
      const { properties: { toxicityLevel } = {} } = f;
      const geometry = f.geometry as IPolygon;
      console.log(`toxicitylevel: ${toxicityLevel}`)
      const danger = convertToxicityLevelToDangerLevel(toxicityLevel);
      console.log(danger);
      resources
        .filter(r => r.geometry && /point/i.test(r.geometry.type || ''))
        .forEach(r => {
          const point = r.geometry as IPoint;
          const isInside = booleanPointInPolygon(point, geometry);
          console.log(isInside)
          if (isInside && (!acc[r._id] || acc[r._id].danger < danger)) acc[r._id] = { resource: r, danger, areaId, warningSent: false };
        })
      return acc;
    }, {} as { [id: string]: IEwsStatus });
  console.log(JSON.stringify(newEwsState, null, 2))
  sendWarnings(newEwsState);
  console.log(`${new Date().toLocaleTimeString()}: Finished checking ${resourceCount} resource(s) and ${plumeCount} plume(s).`);
  setTimeout(verifyResourceSafety, EWS_INTERVAL * 1000);
}

const handleMessage = (msg: IAdapterMessage) => {
  const { topic, value } = msg;
  switch (topic) {
    case ResourceTopic: {
      const { _id: id } = (value as IResource);
      resourceStore[id] = (value as IResource);
      break;
    }
    case PlumeTopic: {
      const fc = preparePlume(value);
      if (!fc) return;
      const { _id } = fc;
      fc.features?.forEach(f => {
        const id = uniquePlumeId(_id, f);
        plumeStore[id] = f;
      })
      break;
    }
    default:
      console.warn(`Received unexpected message on topic ${topic}...`);
      break;
  }
}

const sendWarnings = (newEwsStatus: { [id: string]: IEwsStatus }) => {
  const timestamp = Date.now();
  Object
    .entries(newEwsStatus)
    .filter(([id, s]) => !ewsStatus[id] || ewsStatus[id].danger !== s.danger)
    .forEach(([_, s]) => {
      // const { danger: oldDanger } = ewsStatus[id] || {};
      const { resource, areaId, danger } = s;
      const message = {
        _id: MESSAGE_ID_PREAMBLE + uuid4(),
        context: resource.context,
        sender: clientId,
        resource: resource._id,
        geometry: areaId ? plumeStore[areaId].geometry : undefined,
        priority: dangerLevelToPriority(danger),
        type: dangerLevelToMessageType(danger),
        text: dangerLevelToMessage(danger),
        attachments: [''],
        response: '',
        dueBy: timestamp,
        expires: timestamp,
        timestamp: timestamp,
      } as IMessage;
      console.log(`sending message: ${message}`)
      sendMessage(message);
      s.warningSent = true;
    });
  Object
    .entries(ewsStatus)
    .filter(([id, _]) => !newEwsStatus[id])
    .forEach(([_, s]) => {
      const { resource } = s;
      const danger = DangerLevel.SAFE;
      const message = {
        _id: MESSAGE_ID_PREAMBLE + uuid4(),
        context: resource.context,
        sender: clientId,
        resource: resource._id,
        geometry: resource.geometry,
        priority: dangerLevelToPriority(danger),
        type: dangerLevelToMessageType(danger),
        text: dangerLevelToMessage(danger),
        attachments: [''],
        response: '',
        dueBy: timestamp,
        expires: timestamp,
        timestamp: timestamp,
      } as IMessage;
      console.log(`sending message: ${message}`)
      sendMessage(message);
    });
  ewsStatus = newEwsStatus;
}

const sendMessage = (message: IMessage) => {
  if (message.geometry)
    message.geometry = geometryToAvro(message.geometry) as any;
  const payloads: ProduceRequest[] = [
    {
      topic: MessageTopic,
      messages: message,
      attributes: 1, // Gzip
    },
  ];
  adapter.send(payloads, (error, data) => {
    if (error) {
      log.error(error);
    }
    if (data) {
      log.info(data);
    }
  });
};

startEws();
