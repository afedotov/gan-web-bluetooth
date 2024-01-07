
import * as def from './gan-cube-definitions';
import { GanGen2CubeEncrypter, GanGen3CubeEncrypter } from './gan-cube-encrypter';
import {
    BluetoothDeviceWithMAC,
    GanCubeConnection,
    GanCubeCommand,
    GanCubeEvent,
    GanCubeMove,
    GanCubeClassicConnection,
    GanGen2ProtocolDriver,
    GanGen3ProtocolDriver
} from './gan-cube-protocol';

/** Iterate over all known GAN cube CICs to find Manufacturer Specific Data */
function getManufacturerDataBytes(manufacturerData: BluetoothManufacturerData | DataView): DataView | undefined {
    // Workaround for Bluefy browser which may return DataView directly instead of Map
    if (manufacturerData instanceof DataView) {
        return manufacturerData;
    }
    for (var id of def.GAN_CIC_LIST) {
        if (manufacturerData.has(id)) {
            return manufacturerData.get(id);
        }
    }
    return;
}

/** Extract MAC from last 6 bytes of Manufacturer Specific Data */
function extractMAC(manufacturerData: BluetoothManufacturerData): string {
    var mac: Array<string> = [];
    var dataView = getManufacturerDataBytes(manufacturerData);
    if (dataView && dataView.byteLength >= 6) {
        for (let i = 1; i <= 6; i++) {
            mac.push(dataView.getUint8(dataView.byteLength - i).toString(16).toUpperCase().padStart(2, "0"));
        }
    }
    return mac.join(":");
}

/** If browser supports Web Bluetooth watchAdvertisements() API, try to retrieve MAC address automatically */
async function autoRetrieveMacAddress(device: BluetoothDevice): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        if (typeof device.watchAdvertisements != 'function') {
            reject("Unable to determine cube MAC address - no support for Web Bluetooth Advertisements API");
        }
        var abortController = new AbortController();
        var onAdvEvent = (evt: Event) => {
            device.removeEventListener("advertisementreceived", onAdvEvent);
            abortController.abort();
            var mac = extractMAC((evt as BluetoothAdvertisingEvent).manufacturerData);
            mac && resolve(mac) || reject("Unable to determine cube MAC address - no Manufacturer Specific Data found under known CICs");
        };
        device.addEventListener("advertisementreceived", onAdvEvent);
        device.watchAdvertisements({ signal: abortController.signal });
        setTimeout(() => {
            device.removeEventListener("advertisementreceived", onAdvEvent);
            abortController.abort();
            reject("Unable to determine cube MAC address - timeout waiting for advertisement packet from device");
        }, 10000);
    });
}

/**
 * Type representing function interface to implement custom MAC address provider
 */
type MacAddressProvider = (device: BluetoothDevice) => Promise<string | null>;

/**
 * Initiate new connection with the GAN Smart Cube device
 * @param customMacAddressProvider Optional custom provider for cube MAC address
 * @returns Object representing connection API and state
 */
async function connectGanCube(customMacAddressProvider?: MacAddressProvider): Promise<GanCubeConnection> {

    // Request user for the bluetooth device (popup selection dialog)
    var device: BluetoothDeviceWithMAC = await navigator.bluetooth.requestDevice(
        {
            filters: [
                { namePrefix: "GAN" },
                { namePrefix: "MG" },
                { namePrefix: "AiCube" }
            ],
            optionalServices: [def.GAN_GEN2_SERVICE, def.GAN_GEN3_SERVICE],
            optionalManufacturerData: def.GAN_CIC_LIST
        }
    );

    // Retrieve cube MAC address needed for key salting
    device.mac = customMacAddressProvider
        && await customMacAddressProvider(device)
        || await autoRetrieveMacAddress(device);

    // Create encryption salt from MAC address bytes placed in reverse order
    var salt = new Uint8Array(device.mac.split(/[:-\s]+/).map((c) => parseInt(c, 16)).reverse());

    // Connect to GATT and get device primary services
    var gatt = await device.gatt!.connect();
    var services = await gatt.getPrimaryServices();

    var conn: GanCubeConnection | null = null;

    // Resolve type of connected cube device and setup appropriate encryption / protocol driver
    for (let service of services) {
        let serviceUUID = service.uuid.toLowerCase();
        if (serviceUUID == def.GAN_GEN2_SERVICE) {
            let commandCharacteristic = await service.getCharacteristic(def.GAN_GEN2_COMMAND_CHARACTERISTIC);
            let stateCharacteristic = await service.getCharacteristic(def.GAN_GEN2_STATE_CHARACTERISTIC);
            let key = device.name?.startsWith('AiCube') ? def.GAN_ENCRYPTION_KEYS[1] : def.GAN_ENCRYPTION_KEYS[0];
            let encrypter = new GanGen2CubeEncrypter(new Uint8Array(key.key), new Uint8Array(key.iv), salt);
            let driver = new GanGen2ProtocolDriver();
            conn = await GanCubeClassicConnection.create(device, commandCharacteristic, stateCharacteristic, encrypter, driver);
            break;
        } else if (serviceUUID == def.GAN_GEN3_SERVICE) {
            let commandCharacteristic = await service.getCharacteristic(def.GAN_GEN3_COMMAND_CHARACTERISTIC);
            let stateCharacteristic = await service.getCharacteristic(def.GAN_GEN3_STATE_CHARACTERISTIC);
            let key = def.GAN_ENCRYPTION_KEYS[0];
            let encrypter = new GanGen3CubeEncrypter(new Uint8Array(key.key), new Uint8Array(key.iv), salt);
            let driver = new GanGen3ProtocolDriver();
            conn = await GanCubeClassicConnection.create(device, commandCharacteristic, stateCharacteristic, encrypter, driver);
            break;
        }
    }

    if (!conn)
        throw new Error("Can't find target BLE services - wrong or unsupported cube device model");

    return conn;

}

export {
    MacAddressProvider,
    GanCubeConnection,
    GanCubeCommand,
    GanCubeEvent,
    GanCubeMove,
    connectGanCube
}
