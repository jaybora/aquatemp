export class ApiRequestCodes {

  // Object with descriptive names as keys
  public static readonly CODES = {
    POWER: 'Power',
    MODE: 'Mode',
    SILENT_MODE: 'Manual-mute',
    SUCTION_TEMP: 'T01',
    WATER_INLET_TEMP: 'T02',
    WATER_OUTLET_TEMP: 'T03',
    COIL_TEMP: 'T04',
    AMBIENT_TEMP: 'T05',
    EXHAUST_TEMP: 'T06',
    CURRENT: 'T07',
    FAN_MOTOR_SPEED: 'T12',
    VOLTAGE: 'T14',
    LOW_AMBIENT_TEMP_START: 'H23',
    LOW_AMBIENT_TEMP_END: 'H24',
    MAX_FREQUENCY_LOW_AMBIENT: 'H25',
    HIGH_AMBIENT_TEMP_START: 'H26',
    HIGH_AMBIENT_TEMP_END: 'H27',
    MAX_FREQUENCY_HIGH_AMBIENT: 'H28',
    MAX_FREQUENCY_IN_SILENT_MODE: 'H33',
    EXHAUST_TEMP_SETTING: 'E07',
    FAN_MOTOR_TYPE: 'F01',
    COIL_TEMP_FAN_HIGH: 'F05',
    COIL_TEMP_FAN_LOW: 'F06',
    FAN_SPEED_SILENT_MODE: 'F16-r',
    FAN_SPEED_MANUEL: 'F18',
    FAN_SPEED_MAX: 'F11-r',
    FAN_SPEED_MIN: 'F13-r',
    FAILURE_STATUS_1: '2074',
    FAILURE_STATUS_2: '2075',
    FAILURE_STATUS_3: '2076',
    FAILURE_STATUS_4: '2077',
    SET_TEMPERATURE: 'Set_Temp',
    COOL_TEMP_SETTING: 'R01',
    HEAT_TEMP_SETTING: 'R02',
    AUTO_TEMP_SETTING: 'R03',
    TIMER1_ON: '1158',
    TIMER1_OFF: '1159',
    EEV_OUTPUT: 'O06',
    FREQUENCY: 'O07',
    IPM_TEMP: 'O09',
    MIN_FREQUENCY_HEATING: 'H06',
    MIN_FREQUENCY_COOLING: 'H07',
    MAX_FREQUENCY_HEATING: 'H08',
    MAX_FREQUENCY_COOLING: 'H09',
  };

  // For backward compatibility or when you need the array
  public static get REQUEST_CODES(): string[] {
    return Object.values(this.CODES);
  }

}
