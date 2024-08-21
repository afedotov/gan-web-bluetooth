
/** GAN Gen2 protocol BLE service */
export const GAN_GEN2_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dc4179";
/** GAN Gen2 protocol BLE command characteristic */
export const GAN_GEN2_COMMAND_CHARACTERISTIC = "28be4a4a-cd67-11e9-a32f-2a2ae2dbcce4";
/** GAN Gen2 protocol BLE state characteristic */
export const GAN_GEN2_STATE_CHARACTERISTIC = "28be4cb6-cd67-11e9-a32f-2a2ae2dbcce4";

/** GAN Gen3 protocol BLE service */
export const GAN_GEN3_SERVICE = "8653000a-43e6-47b7-9cb0-5fc21d4ae340";
/** GAN Gen3 protocol BLE command characteristic */
export const GAN_GEN3_COMMAND_CHARACTERISTIC = "8653000c-43e6-47b7-9cb0-5fc21d4ae340";
/** GAN Gen3 protocol BLE state characteristic */
export const GAN_GEN3_STATE_CHARACTERISTIC = "8653000b-43e6-47b7-9cb0-5fc21d4ae340";

/** GAN Gen4 protocol BLE service */
export const GAN_GEN4_SERVICE = "00000010-0000-fff7-fff6-fff5fff4fff0";
/** GAN Gen4 protocol BLE command characteristic */
export const GAN_GEN4_COMMAND_CHARACTERISTIC = "0000fff5-0000-1000-8000-00805f9b34fb";
/** GAN Gen4 protocol BLE state characteristic */
export const GAN_GEN4_STATE_CHARACTERISTIC = "0000fff6-0000-1000-8000-00805f9b34fb";

/** List of Company Identifier Codes, fill with all values [0x0001, 0xFF01] possible for GAN cubes */
export const GAN_CIC_LIST = Array(256).fill(undefined).map((_v, i) => (i << 8) | 0x01);

/**  List of encryption keys */
export const GAN_ENCRYPTION_KEYS = [
    {   /** Key used by GAN Gen2, Gen3 and Gen4 cubes */
        key: [0x01, 0x02, 0x42, 0x28, 0x31, 0x91, 0x16, 0x07, 0x20, 0x05, 0x18, 0x54, 0x42, 0x11, 0x12, 0x53],
        iv: [0x11, 0x03, 0x32, 0x28, 0x21, 0x01, 0x76, 0x27, 0x20, 0x95, 0x78, 0x14, 0x32, 0x12, 0x02, 0x43]
    },
    {   /** Key used by MoYu AI 2023 */
        key: [0x05, 0x12, 0x02, 0x45, 0x02, 0x01, 0x29, 0x56, 0x12, 0x78, 0x12, 0x76, 0x81, 0x01, 0x08, 0x03],
        iv: [0x01, 0x44, 0x28, 0x06, 0x86, 0x21, 0x22, 0x28, 0x51, 0x05, 0x08, 0x31, 0x82, 0x02, 0x21, 0x06]
    }
];

