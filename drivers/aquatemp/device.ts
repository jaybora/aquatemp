import Homey from 'homey';
import { hashPassword } from '../../hasher';

const http = require('http.min');
const axios = require('axios');
const https = require('https');

class ApiEndpoints {

  public static readonly BASE_URL = 'https://cloud.linked-go.com:449/crmservice/api';
  public static readonly USER_LOGIN = `${this.BASE_URL}/app/user/login`;
  public static readonly DEVICE_LIST = `${this.BASE_URL}/app/device/deviceList`;
  public static readonly GET_DATA_BY_CODE = `${this.BASE_URL}/app/device/getDataByCode`;
  public static readonly CONTROL = `${this.BASE_URL}/app/device/control`;

}

class HeatPumpDevice extends Homey.Device {

  public MY_DEVICE_CODE = '';
  public HVAC_MODE = '';
  public X_TOKEN = '';
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('HeatPumpDevice has been initialized');
    this.registerCapabilityListener('target_temperature', async value => {
      this.setTemp(value);
    });
    this.registerCapabilityListener('onoff', async value => {
      this.setOnOff(value);
    });
    this.registerCapabilityListener('thermostat_mode', async value => {
      this.setHvacMode(value);
    });
    const result = await this.getFreshData();
    this.setValues(result);

    setInterval(async () => {
      const result = await this.getFreshData();
      this.setValues(result);
    }, 30000);
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('HeatPumpDevice has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings: {}, newSettings: {}, changedKeys: {} }): Promise<string|void> {
    const result = await this.getFreshData();
    this.setValues(result);
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name: string) {
    this.log('HeatPumpDevice was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('HeatPumpDevice has been deleted');
  }

  async getFreshData() {
    this.X_TOKEN = await this.authenticateUser();
    this.log('x-token:', this.X_TOKEN);

    const jsonDeviceResult = await axios({
      method: 'post',
      url: ApiEndpoints.DEVICE_LIST,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-token': this.X_TOKEN,
      },
    });
    // var devicesResult = await http.post(optionsGetDevices);
    this.MY_DEVICE_CODE = jsonDeviceResult.data.objectResult[0].device_code;
    this.log('MY_DEVICE_CODE:', this.MY_DEVICE_CODE);

    const idResult = await axios({
      method: 'post',
      url: ApiEndpoints.GET_DATA_BY_CODE,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-token': this.X_TOKEN,
      },
      data: {
        device_code: this.MY_DEVICE_CODE,
        // TODO: Handle the codes better
        protocal_codes: ['Power', 'Mode', 'Manual-mute', 'T01', 'T02', '2074', '2075', '2076', '2077', 'H03', 'Set_Temp', 'R08', 'R09', 'R10', 'R11', 'R01', 'R02', 'R03', 'T03', '1158', '1159', 'F17', 'H02', 'T04', 'T05', 'T06', 'T07', 'T12', 'T14'],
      },
    });
    return idResult;
  }

  private async authenticateUser(): Promise<string> {
    const username = this.homey.settings.get('username') as string | null;
    const plainPassword = (this.homey.settings.get('password') as string | null)?.slice(0, 16);

    if (!username || !plainPassword) {
      throw new Error('Username or password not set');
    }
    const hashedPassword = hashPassword(plainPassword);

    const agent = new https.Agent({
      rejectUnauthorized: false,
    });

    axios.defaults.httpsAgent = agent;
    const result = await axios({
      method: 'post',
      url: ApiEndpoints.USER_LOGIN,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      data: {
        userName: username,
        password: hashedPassword,
      },
    });
    if (!result.data.isReusltSuc) {
      throw new Error('Login to aquatemp server failed. Username or password incorrect');
    }
    return result.data.objectResult['x-token'];
  }

  async setValues(result: any) {
    this.setCapabilityValue('measure_voltage', Number(result.data.objectResult[28].value)).catch(this.error);
    this.setCapabilityValue('measure_power', (Number(result.data.objectResult[28].value * Number(result.data.objectResult[26].value))));
    const onoff = Number(result.data.objectResult[0].value);
    this.setCapabilityValue('onoff', onoff === 1).catch(this.error);
    this.setCapabilityValue('meter_power', (Number(result.data.objectResult[28].value * Number(result.data.objectResult[26].value)) / 1000)).catch(this.error);

    this.getHvacMode(result);
    this.setCapabilityValue('thermostat_mode', this.HVAC_MODE);

    const targetTemp = this.getTargetTemp(this.HVAC_MODE, result);
    this.setCapabilityValue('target_temperature', targetTemp).catch(this.error);

    const outletTemp = Number(result.data.objectResult.find((x: any) => x.code === 'T03').value);
    const inletTemp = Number(result.data.objectResult.find((x: any) => x.code === 'T02').value);
    this.setCapabilityValue('measure_temperature.inlet', inletTemp).catch(this.error);
    this.setCapabilityValue('measure_temperature.outlet', outletTemp).catch(this.error);
    this.setCapabilityValue('measure_temperature', inletTemp).catch(this.error);
    this.log('Done updating values');
  }

  getTargetTemp(hvacMode: string, result: any) {
    let targetTemp = 0;
    switch (hvacMode) {
      case 'cool':
        targetTemp = Number(result.data.objectResult.find((x: any) => x.code === 'R01').value) > 35 ? 35 : (Number(result.data.objectResult.find((x: any) => x.code === 'R01').value));
        break;
      case 'auto':
        targetTemp = Number(result.data.objectResult.find((x: any) => x.code === 'R03').value) > 35 ? 35 : (Number(result.data.objectResult.find((x: any) => x.code === 'R03').value));
        break;
      default:
        targetTemp = Number(result.data.objectResult.find((x: any) => x.code === 'R02').value) > 35 ? 35 : (Number(result.data.objectResult.find((x: any) => x.code === 'R02').value));
        break;
    }
    return targetTemp;
  }

  async setOnOff(isTurnOn: boolean) {
    let data = {};
    if (isTurnOn) {
      data = { param: [{ device_code: this.MY_DEVICE_CODE, protocol_code: 'power', value: '1' }] };
    } else {
      data = { param: [{ device_code: this.MY_DEVICE_CODE, protocol_code: 'power', value: '0' }] };
    }
    const optionsOnOff = {
      uri: ApiEndpoints.CONTROL,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-token': this.X_TOKEN,
      },
      json: data,
    };
    const res = await http.post(optionsOnOff);
    if (res.data.error_msg === 'Success') {
      this.HVAC_MODE = isTurnOn ? 'heat' : 'off';
      await this.setCapabilityValue('thermostat_mode', this.HVAC_MODE);
      this.log(`Turned to ${this.HVAC_MODE}`);
    }
  }

  getHvacMode(result: any) {
    let mode = '';
    const modeString = result.data.objectResult.find((x: any) => x.code === 'Mode');
    const power = result.data.objectResult.find((x: any) => x.code === 'Power');
    switch (modeString.value) {
      case '0':
        mode = 'cool';
        break;
      case '1':
        mode = 'heat';
        break;
      case '2':
        mode = 'auto';
        break;
    }
    power.value === '0' ? this.HVAC_MODE = 'off' : this.HVAC_MODE = mode;
  }

  async setHvacMode(newMode: string) {
    let value = '';
    let code = 'mode';
    if (this.HVAC_MODE === 'off' && newMode !== 'off') {
      const data = { param: [{ device_code: this.MY_DEVICE_CODE, protocol_code: 'power', value: '1' }] };
      const optionsOnOff = {
        uri: ApiEndpoints.CONTROL,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-token': this.X_TOKEN,
        },
        json: data,
      };
      const res = await http.post(optionsOnOff);
      if (res.data.error_msg === 'Success') {
        this.setCapabilityValue('onoff', true).catch(this.error);
      }
    }
    switch (newMode) {
      case 'cool':
        value = '0';
        break;
      case 'heat':
        value = '1';
        break;
      case 'auto':
        value = '2';
        break;
      case 'off':
        value = '0';
        code = 'power';
        break;
    }
    const data = { param: [{ device_code: this.MY_DEVICE_CODE, protocol_code: code, value }] };
    const optionsChangeHVAC = {
      uri: ApiEndpoints.CONTROL,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-token': this.X_TOKEN,
      },
      json: data,
    };
    const res = await http.post(optionsChangeHVAC);
    if (res.data.error_msg === 'Success') {
      this.setCapabilityValue('thermostat_mode', newMode).catch(this.error);
    }
  }

  async setTemp(desiredTemp: number) {
    let mode = '';
    switch (this.HVAC_MODE) {
      case 'cool':
        mode = 'R01';
        break;
      case 'heat':
        mode = 'R02';
        break;
      default:
        mode = 'R03';
        break;
    }
    const optionsSetTemp = {
      uri: ApiEndpoints.CONTROL,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-token': this.X_TOKEN,
      },
      json: {
        param:
          [
            {
              device_code: this.MY_DEVICE_CODE,
              protocol_code: mode,
              value: desiredTemp,
            },
            {
              device_code: this.MY_DEVICE_CODE,
              protocol_code: 'Set_Temp',
              value: desiredTemp,
            },
          ],
      },
    };
    await http.post(optionsSetTemp);
  }

}

module.exports = HeatPumpDevice;
