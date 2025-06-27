import Homey from 'homey';
import { AquatempAPI } from './aquatempAPI';

class HeatPumpDevice extends Homey.Device {

  public HVAC_MODE = '';
  private timer: NodeJS.Timeout | null = null;

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('HeatPumpDevice has been initialized');

    if (!this.hasCapability('alarm_pump_supply')) {
      console.log(`Adding capability alarm_pump_supply to device ${this.getName()}`);
      await this.addCapability('alarm_pump_supply');
    }

    this.registerCapabilityListener('target_temperature', async value => {
      this.setTemp(value);
    });
    this.registerCapabilityListener('onoff', async value => {
      this.setOnOff(value);
    });
    this.registerCapabilityListener('silent_mode', async value => {
      await this.setSilentOnOff(value);
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
    this.log(`HeatPumpDevice has been added with code ${this.getData().id}`);
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
    // Stop the timer if it is running
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null; // Reset the timer reference
    }
  }

  async getFreshData(): Promise<any> {
    const api = new AquatempAPI(this.getSetting('username'), this.getSetting('password'));
    const deviceCode = this.getDeviceCode();
    this.log('Fetching device data for device code', deviceCode);
    return api.getDeviceData(deviceCode);
  }

  private getDeviceCode() {
    return this.getData().id as string;
  }

  async setValues(result: any) {
    if (!this.hasCapability('silent_mode')) {
      await this.addCapability('silent_mode');
    }
    const isPowerOn = await this.extractValueByCode(result, 'Power') === 1;
    await this.setCapabilityValue('measure_voltage', this.extractValueByCode(result, 'T14')).catch(this.error);
    if (isPowerOn) {
      await this.setCapabilityValue('measure_frequency', this.extractValueByCode(result, 'T06')).catch(this.error);
      await this.setCapabilityValue('alarm_pump_supply', this.extractValueByCodeAndPosition(result, '2074', 6) === '1').catch(this.error);
    } else {
      await this.setCapabilityValue('measure_frequency', 0).catch(this.error);
      await this.setCapabilityValue('alarm_pump_supply', false).catch(this.error);
    }
    await this.setCapabilityValue('measure_current', this.extractValueByCode(result, 'T07')).catch(this.error);
    await this.setCapabilityValue('measure_power', Math.round(this.extractValueByCode(result, 'T14') * this.extractValueByCode(result, 'T07')));
    await this.setCapabilityValue('onoff', isPowerOn).catch(this.error);
    await this.setCapabilityValue('meter_power', (this.extractValueByCode(result, 'T14') * this.extractValueByCode(result, 'T07')) / 1000).catch(this.error);
    await this.setCapabilityValue('silent_mode', this.extractValueByCode(result, 'Manual-mute') === 1).catch(this.error);

    this.getHvacMode(result);
    await this.setCapabilityValue('thermostat_mode', this.HVAC_MODE);

    const targetTemp = this.getTargetTemp(this.HVAC_MODE, result);
    await this.setCapabilityValue('target_temperature', targetTemp).catch(this.error);

    await this.setCapabilityValue('measure_temperature.inlet', this.extractValueByCode(result, 'T02')).catch(this.error);
    await this.setCapabilityValue('measure_temperature.outlet', this.extractValueByCode(result, 'T03')).catch(this.error);
    await this.setCapabilityValue('measure_temperature.surrounding', this.extractValueByCode(result, 'T05')).catch(this.error);
    await this.setCapabilityValue('measure_temperature', this.extractValueByCode(result, 'T02')).catch(this.error);
    this.log('Done updating values');
  }

  private extractValueByCode(result: any, code: string) {
    const foundItem = result.data.objectResult.find((x: any) => x.code === code);
    if (!foundItem) {
      throw new Error(`Item with code "${code}" not found`);
    }
    return Number(foundItem.value);
  }

  private extractValueByCodeAndPosition(result: any, code: string, position: number) {
    const foundItem = result.data.objectResult.find((x: any) => x.code === code);
    if (!foundItem) {
      throw new Error(`Item with code "${code}" not found`);
    }
    return (foundItem.value as string).charAt(position);
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
      data = { param: [{ device_code: this.getDeviceCode(), protocol_code: 'power', value: '1' }] };
    } else {
      data = { param: [{ device_code: this.getDeviceCode(), protocol_code: 'power', value: '0' }] };
    }
    const res = await this.updateDeviceData(data);
    if (res.data.error_msg === 'Success') {
      this.HVAC_MODE = isTurnOn ? 'heat' : 'off';
      await this.setCapabilityValue('thermostat_mode', this.HVAC_MODE);
      this.log(`Turned to ${this.HVAC_MODE}`);
    }
  }

  async setSilentOnOff(isTurnOn: boolean) {
    let data = {};
    if (isTurnOn) {
      data = { param: [{ device_code: this.getDeviceCode(), protocol_code: 'Manual-mute', value: 1 }] };
    } else {
      data = { param: [{ device_code: this.getDeviceCode(), protocol_code: 'Manual-mute', value: 0 }] };
    }
    this.log(`Setting silent mode to: ${JSON.stringify(data)}`);
    await this.updateDeviceData(data);
  }

  private updateDeviceData(data: {}) {
    return new AquatempAPI(this.getSetting('username'), this.getSetting('password')).setDeviceData(
      this.getDeviceCode(),
      data,
    );
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
      default:
        mode = 'unknown';
        break;
    }
    if (power.value === '0') {
      this.HVAC_MODE = 'off';
    } else {
      this.HVAC_MODE = mode;
    }
  }

  async setHvacMode(newMode: string) {
    let value = '';
    let code = 'mode';
    if (this.HVAC_MODE === 'off' && newMode !== 'off') {
      const data = {
        param: [{
          device_code: this.getDeviceCode(),
          protocol_code: 'power',
          value: '1',
        }],
      };
      const res = await this.updateDeviceData(data);
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
    const data = {
      param: [{
        device_code: this.getDeviceCode(),
        protocol_code: code,
        value,
      }],
    };
    const res = await this.updateDeviceData(data);
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
    const data = {
      param:
          [
            {
              device_code: this.getDeviceCode(),
              protocol_code: mode,
              value: desiredTemp,
            },
            {
              device_code: this.getDeviceCode(),
              protocol_code: 'Set_Temp',
              value: desiredTemp,
            },
          ],
    };
    await this.updateDeviceData(data);
  }

}

module.exports = HeatPumpDevice;
