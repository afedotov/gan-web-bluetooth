
import { Observable, Subject } from 'rxjs';

// GAN Smart Timer bluetooth service and characteristic UUIDs
const GAN_TIMER_SERVICE: string = '0000fff0-0000-1000-8000-00805f9b34fb';
const GAN_TIMER_TIME_CHARACTERISTIC: string = '0000fff2-0000-1000-8000-00805f9b34fb';
const GAN_TIMER_STATE_CHARACTERISTIC: string = '0000fff5-0000-1000-8000-00805f9b34fb';

enum GanTimerState {
    DISCONNECT = 0,
    GET_SET = 1,
    HANDS_OFF = 2,
    RUNNING = 3,
    STOPPED = 4,
    IDLE = 5,
    HANDS_ON = 6,
    FINISHED = 7
}

// Representation of time value
interface GanTimerTime {
    readonly minutes: number;
    readonly seconds: number;
    readonly milliseconds: number;
    readonly asTimestamp: number;
    toString(): string;
}

// Timer state event
interface GanTimerEvent {
    state: GanTimerState;
    recordedTime?: GanTimerTime;
}

// Representation of recorded in timer memory time values
interface GanTimerRecordedTimes {
    displayTime: GanTimerTime;
    previousTimes: [GanTimerTime, GanTimerTime, GanTimerTime];
}

// Connection object representing common timer API
interface GanTimerConnection {
    events$: Observable<GanTimerEvent>;
    getRecordedTimes(): Promise<GanTimerRecordedTimes>;
    disconnect(): void;
}

// Construct time object
function makeTime(min: number, sec: number, msec: number): GanTimerTime {
    return {
        minutes: min,
        seconds: sec,
        milliseconds: msec,
        asTimestamp: 60000 * min + 1000 * sec + msec,
        toString: () => `${min.toString(10)}:${sec.toString(10).padStart(2, '0')}.${msec.toString(10).padStart(3, '0')}`
    }
}

// Construct time object from raw event data
function makeTimeFromRaw(data: DataView, offset: number): GanTimerTime {
    var min = data.getUint8(offset);
    var sec = data.getUint8(offset + 1);
    var msec = data.getUint16(offset + 2, true);
    return makeTime(min, sec, msec);
}

// Construct time object from milliseconds timestamp
function makeTimeFromTimestamp(timestamp: number): GanTimerTime {
    var min = Math.trunc(timestamp / 60000);
    var sec = Math.trunc(timestamp % 60000 / 1000);
    var msec = Math.trunc(timestamp % 1000);
    return makeTime(min, sec, msec);
}

// Calculate ArrayBuffer checksum using CRC-16/CCIT-FALSE algorithm variation
function crc16ccit(buff: ArrayBuffer): number {
    var dataView = new DataView(buff);
    var crc: number = 0xFFFF;
    for (let i = 0; i < dataView.byteLength; ++i) {
        crc ^= dataView.getUint8(i) << 8;
        for (let j = 0; j < 8; ++j) {
            crc = (crc & 0x8000) > 0 ? (crc << 1) ^ 0x1021 : crc << 1;
        }
    }
    return crc & 0xFFFF;
}

// Ensure received timer event has valid data: check data magic and CRC
function validateEventData(data: DataView): boolean {
    try {
        if (data?.byteLength == 0 || data.getUint8(0) != 0xFE) {
            return false;
        }
        var eventCRC = data.getUint16(data.byteLength - 2, true);
        var calculatedCRC = crc16ccit(data.buffer.slice(2, data.byteLength - 2));
        return eventCRC == calculatedCRC;
    } catch (err) {
        return false;
    }
}

// Construct event object from raw data
function buildTimerEvent(data: DataView): GanTimerEvent {
    var evt: GanTimerEvent = {
        state: data.getUint8(3)
    };
    if (evt.state == GanTimerState.STOPPED) {
        evt.recordedTime = makeTimeFromRaw(data, 4);
    }
    return evt;
}

async function connectGanTimer(): Promise<GanTimerConnection> {

    // Request user for the bluetooth device (popup selection dialog)
    var device = await navigator.bluetooth.requestDevice(
        {
            filters: [
                { namePrefix: "GAN" },
                { namePrefix: "gan" },
                { namePrefix: "Gan" }
            ],
            optionalServices: [GAN_TIMER_SERVICE]
        }
    );

    // Connect to GATT server
    var server = await device.gatt!.connect();

    // Connect to main timer service and characteristics
    var service = await server.getPrimaryService(GAN_TIMER_SERVICE);
    var timeCharacteristic = await service.getCharacteristic(GAN_TIMER_TIME_CHARACTERISTIC);
    var stateCharacteristic = await service.getCharacteristic(GAN_TIMER_STATE_CHARACTERISTIC);

    // Subscribe to value updates of the timer state characteristic
    var eventSubject = new Subject<GanTimerEvent>();
    var onStateChanged = async (evt: Event) => {
        var chr: BluetoothRemoteGATTCharacteristic = <BluetoothRemoteGATTCharacteristic>evt.target;
        var data: DataView = chr.value!;
        if (validateEventData(data)) {
            eventSubject.next(buildTimerEvent(data));
        } else {
            eventSubject.error("Invalid event data received from Timer");
        }
    };
    stateCharacteristic.addEventListener('characteristicvaluechanged', onStateChanged);
    stateCharacteristic.startNotifications();

    // This action retrieves latest recorded times from timer
    var getRecordedTimesAction = async (): Promise<GanTimerRecordedTimes> => {
        var data = await timeCharacteristic.readValue();
        return data?.byteLength >= 16 ?
            Promise.resolve({
                displayTime: makeTimeFromRaw(data, 0),
                previousTimes: [makeTimeFromRaw(data, 4), makeTimeFromRaw(data, 8), makeTimeFromRaw(data, 12)]
            }) : Promise.reject("Invalid time characteristic value received from Timer");
    }

    // Handle unexpected disconnection
    var onTimerDisconnected = () => {
        device.removeEventListener('gattserverdisconnected', onTimerDisconnected);
        stateCharacteristic.removeEventListener('characteristicvaluechanged', onStateChanged);
        eventSubject.next({ state: GanTimerState.DISCONNECT });
        eventSubject.unsubscribe();
    }
    device.addEventListener('gattserverdisconnected', onTimerDisconnected);

    // Manual disconnect action
    var disconnectAction = async () => {
        device.removeEventListener('gattserverdisconnected', onTimerDisconnected);
        stateCharacteristic.removeEventListener('characteristicvaluechanged', onStateChanged);
        eventSubject.unsubscribe();
        await stateCharacteristic.stopNotifications();
        server.disconnect();
    }

    return {
        events$: eventSubject,
        getRecordedTimes: getRecordedTimesAction,
        disconnect: disconnectAction,
    };

}

export {
    connectGanTimer,
    makeTime,
    makeTimeFromTimestamp,
    GanTimerConnection,
    GanTimerEvent,
    GanTimerState,
    GanTimerTime,
    GanTimerRecordedTimes
}
