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
  };

  // For backward compatibility or when you need the array
  public static get REQUEST_CODES(): string[] {
    return Object.values(this.CODES);
  }

}
