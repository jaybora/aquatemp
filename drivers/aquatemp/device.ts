import Homey, {Device} from 'homey';
import {ApiRequestError, AquatempAPI, AuthenticationError, DeviceOfflineError} from './aquatempAPI';
import { ApiRequestCodes } from './apirequestcodes';
interface HeatPumpDeviceSettings {
  enable_experimental_features: boolean;
  username: string;
  password: string;
  // Add any other settings your device uses
}

class HeatPumpDevice extends Homey.Device {

  private timer: NodeJS.Timeout | null = null;
  private lastPollTime: number | null = null;

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('HeatPumpDevice has been initialized');

    if (!this.hasCapability('silent_mode')) {
      console.log(`Adding capability silent_mode to device ${this.getName()}`);
      await this.addCapability('silent_mode');
    }
    if (!this.hasCapability('alarm_pump_supply')) {
      console.log(`Adding capability alarm_pump_supply to device ${this.getName()}`);
      await this.addCapability('alarm_pump_supply');
    }

    if (this.hasCapability('fan_speed_silent_mode')) {
      console.log('Removing capability fan_speed_silent_mode');
      await this.removeCapability('fan_speed_silent_mode');
    }

    if (this.hasCapability('frequency_setting')) {
      console.log('Removing capability frequency_setting');
      await this.removeCapability('frequency_setting');
    }

    if (this.hasCapability('outlet')) {
      this.log('Removing old outlet capability');
      await this.removeCapability('outlet');
    }

    if (!this.hasCapability('measure_temperature.outlet')) {
      this.log('Adding new measure_temperature.outlet capability');
      await this.addCapability('measure_temperature.outlet');
    }

    if (this.hasCapability('inlet')) {
      this.log('Removing old inlet capability');
      await this.removeCapability('inlet');
    }
    if (!this.hasCapability('measure_temperature.inlet')) {
      this.log('Adding new measure_temperature.inlet capability');
      await this.addCapability('measure_temperature.inlet');
    }
    if (!this.hasCapability('measure_temperature.exhaust')) {
      this.log('Adding new measure_temperature.exhaust capability');
      await this.addCapability('measure_temperature.exhaust');
    }
    if (!this.hasCapability('measure_temperature.coil')) {
      this.log('Adding new measure_temperature.coil capability');
      await this.addCapability('measure_temperature.coil');
    }
    if (!this.hasCapability('fan_speed')) {
      this.log('Adding new fan_speed capability');
      await this.addCapability('fan_speed');
    }
    if (!this.hasCapability('alarm_defrost')) {
      this.log('Adding new alarm_defrost capability');
      await this.addCapability('alarm_defrost');
    }

    await this.enableOrDisableExperimentalFeatures(this.getSettings().enable_experimental_features);

    this.registerCapabilityListener('target_temperature', async value => {
      await this.setTemp(value);
    });
    this.registerCapabilityListener('onoff', async value => {
      await this.setOnOff(value);
    });
    this.registerCapabilityListener('silent_mode', async value => {
      await this.setSilentOnOff(value);
    });
    this.registerCapabilityListener('thermostat_mode', async value => {
      await this.setHvacMode(value);
    });
    this.registerCapabilityListener('fan_speed_setting.max', async value => {
      await this.setFanSpeedMax(value);
    });
    this.registerCapabilityListener('fan_speed_setting.min', async value => {
      await this.setFanSpeedMin(value);
    });
    this.registerCapabilityListener('frequency_setting.heating_max', async value => {
      await this.setMaximumFrequencyHeating(value);
    });

    await this.updateData();

    this.timer = setInterval(async () => {
      await this.updateData();
    }, 30000);
  }

  private async enableOrDisableExperimentalFeatures(enable: Boolean = false) {
    if (enable === true) {
      this.log('Enabling experimental features...');
      if (!this.hasCapability('fan_speed_setting.max')) {
        this.log('Adding new fan_speed_setting.max capability');
        await this.addCapability('fan_speed_setting.max');
      }
      if (!this.hasCapability('fan_speed_setting.min')) {
        this.log('Adding new fan_speed_setting.min capability');
        await this.addCapability('fan_speed_setting.min');
      }
      if (!this.hasCapability('frequency_setting.heating_max')) {
        this.log('Adding new frequency_setting.heating_max capability');
        await this.addCapability('frequency_setting.heating_max');
      }
    } else {
      this.log('Disabling experimental features...');
      if (this.hasCapability('fan_speed_setting.max')) {
        this.log('Removing fan_speed_setting.max capability');
        await this.removeCapability('fan_speed_setting.max');
      }
      if (this.hasCapability('fan_speed_setting.min')) {
        this.log('Removing new fan_speed_setting.min capability');
        await this.removeCapability('fan_speed_setting.min');
      }
      if (this.hasCapability('frequency_setting.heating_max')) {
        this.log('Removing new frequency_setting.heating_max capability');
        await this.removeCapability('frequency_setting.heating_max');
      }
    }
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
  // eslint-disable-next-line no-empty-pattern
  async onSettings({oldSettings, newSettings, changedKeys}: {
    oldSettings: HeatPumpDeviceSettings;
    newSettings: HeatPumpDeviceSettings;
    changedKeys: string[];
  }): Promise<string | void> {
    // run when the user has changed the device's settings in Homey.
    // changedKeysArr contains an array of keys that have been changed
    // if the settings must not be saved for whatever reason:
    // throw new Error('Your error message');
    await this.enableOrDisableExperimentalFeatures(newSettings.enable_experimental_features);
    if (!changedKeys.includes('enable_experimental_features')) {
      // If we run updateData after disabling experimantal feature
      // it will try to update the capabilities that already has
      // been removed.
      await this.updateData();
    }
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

  async updateData() {
    const api = new AquatempAPI(this.getSetting('username'), this.getSetting('password'));
    const deviceCode = this.getDeviceCode();
    this.log('Fetching device data for device code', deviceCode);
    try {
      const deviceData = await api.getDeviceData(deviceCode);
      await this.setAvailable();
      await this.setValues(deviceData);
    } catch (e) {
      if (e instanceof AuthenticationError) {
        this.error(`Error fetching data from server: AuthenticationError - ${e.message}`);
        await this.setUnavailable('Cannot login. Update username and password in the app settings');
      } else if (e instanceof ApiRequestError) {
        this.error(`Error fetching data from server: ApiRequestError - ${e.message}`);
        await this.setUnavailable('Cannot connect to server. '
          + 'Check homeys connection to internet, or try restarting the app, or the homey');
      } else if (e instanceof DeviceOfflineError) {
        this.error(`${e.message}`);
        await this.setUnavailable(`Device ${deviceCode} is not online. Check the wifi module is connected to the internet, and that the heatpump has power. `);
      } else if (e instanceof Error) {
        this.error(`Error fetching data from server: ${e.message}`);
        await this.setUnavailable('Cannot connect to server: '
          + `${e.message}`);
        throw e;
      } else {
        // Something throw something thats not an error. Let the app crash then
        throw e;
      }
    }
  }

  private getDeviceCode() {
    return this.getData().id as string;
  }

  async setValues(result: any) {
    this.log('Values from server: ', result);
    const isPowerOn = this.extractValueByCode(result, ApiRequestCodes.CODES.POWER) === 1;
    await this.setCapabilityValue('measure_voltage', this.extractValueByCode(result, ApiRequestCodes.CODES.VOLTAGE)).catch(this.error);
    await this.setCapabilityValue('measure_frequency', this.extractValueByCode(result, ApiRequestCodes.CODES.FREQUENCY)).catch(this.error);
    if (isPowerOn) {
      await this.setCapabilityValue('alarm_pump_supply', this.extractValueByCodeAndPosition(result, ApiRequestCodes.CODES.FAILURE_STATUS_1, 9) === '1').catch(this.error);
    } else {
      await this.setCapabilityValue('alarm_pump_supply', false).catch(this.error);
    }
    const current = this.extractValueByCode(result, ApiRequestCodes.CODES.CURRENT) / 10;
    await this.setCapabilityValue('measure_current', current).catch(this.error);
    const watts = this.extractValueByCode(result, ApiRequestCodes.CODES.VOLTAGE) * current;
    await this.setCapabilityValue('measure_power', Math.round(watts));
    await this.setCapabilityValue('onoff', isPowerOn).catch(this.error);

    const now = Date.now();
    if (this.lastPollTime !== null && isPowerOn) {
      const elapsedHours = (now - this.lastPollTime) / 3_600_000;
      const energyAdded = (watts / 1000) * elapsedHours;
      const accumulated = (this.getCapabilityValue('meter_power') as number ?? 0) + energyAdded;
      await this.setCapabilityValue('meter_power', accumulated).catch(this.error);
    }
    this.lastPollTime = now;
    await this.setCapabilityValue('silent_mode', this.extractValueByCode(result, ApiRequestCodes.CODES.SILENT_MODE) === 1).catch(this.error);

    const hvacMode = this.getHvacMode(result);
    await this.setCapabilityValue('thermostat_mode', hvacMode);

    await this.setCapabilityValue('target_temperature', this.extractTargetTemperature(hvacMode, result)).catch(this.error);

    await this.setCapabilityValue('measure_temperature.inlet', this.extractValueByCode(result, ApiRequestCodes.CODES.WATER_INLET_TEMP)).catch(this.error);
    await this.setCapabilityValue('measure_temperature.outlet', this.extractValueByCode(result, ApiRequestCodes.CODES.WATER_OUTLET_TEMP)).catch(this.error);
    await this.setCapabilityValue('measure_temperature.surrounding', this.extractValueByCode(result, ApiRequestCodes.CODES.AMBIENT_TEMP)).catch(this.error);
    await this.setCapabilityValue('measure_temperature', this.extractValueByCode(result, ApiRequestCodes.CODES.WATER_INLET_TEMP)).catch(this.error);
    await this.setCapabilityValue('measure_temperature.coil', this.extractValueByCode(result, ApiRequestCodes.CODES.COIL_TEMP)).catch(this.error);
    await this.setCapabilityValue('measure_temperature.exhaust', this.extractValueByCode(result, ApiRequestCodes.CODES.EXHAUST_TEMP)).catch(this.error);
    await this.setCapabilityValue('fan_speed', this.extractValueByCode(result, ApiRequestCodes.CODES.FAN_MOTOR_SPEED)).catch(this.error);
    await this.setCapabilityValue('alarm_defrost', this.extractValueByCodeAndPosition(result, ApiRequestCodes.CODES.FAILURE_STATUS_1, 15) === '1').catch(this.error);
    if (this.getSetting('enable_experimental_features')) {
      await this.setCapabilityValue('fan_speed_setting.max', this.extractValueByCode(result, ApiRequestCodes.CODES.FAN_SPEED_MAX)).catch(this.error);
      await this.setCapabilityValue('fan_speed_setting.min', this.extractValueByCode(result, ApiRequestCodes.CODES.FAN_SPEED_MIN)).catch(this.error);
      await this.setCapabilityValue('frequency_setting.heating_max', this.extractValueByCode(result, ApiRequestCodes.CODES.MAX_FREQUENCY_HEATING)).catch(this.error);
    }
    this.log('Done updating values');
  }

  private extractValueByCode(result: any, code: string) {
    const foundItem = result.find((x: any) => x.code === code);
    if (!foundItem) {
      this.error();
      throw new Error(`Item with code "${code}" not found`);
    }
    return Number(foundItem.value);
  }

  private extractValueByCodeAndPosition(result: any, code: string, position: number) {
    const foundItem = result.find((x: any) => x.code === code);
    if (!foundItem) {
      this.error();
      throw new Error(`Item with code "${code}" not found`);
    }
    const str = foundItem.value as string;
    return str.charAt(str.length - 1 - position);
  }

  extractTargetTemperature(hvacMode: string, result: any) {
    let targetTemp = 0;
    switch (hvacMode) {
      case 'cool': {
        const cool = result.find((x: any) => x.code === ApiRequestCodes.CODES.COOL_TEMP_SETTING);
        targetTemp = cool ? Math.min(Number(cool.value), 35) : 0;
        break;
      }
      case 'auto': {
        const auto = result.find((x: any) => x.code === ApiRequestCodes.CODES.AUTO_TEMP_SETTING);
        targetTemp = auto ? Math.min(Number(auto.value), 35) : 0;
        break;
      }
      default: {
        const heat = result.find((x: any) => x.code === ApiRequestCodes.CODES.HEAT_TEMP_SETTING);
        targetTemp = heat ? Math.min(Number(heat.value), 35) : 0;
        break;
      }
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
    await this.updateDeviceData(data);
  }

  async setSilentOnOff(isTurnOn: boolean) {
    let data = {};
    if (isTurnOn) {
      data = { param: [{ device_code: this.getDeviceCode(), protocol_code: ApiRequestCodes.CODES.SILENT_MODE, value: 1 }] };
    } else {
      data = { param: [{ device_code: this.getDeviceCode(), protocol_code: ApiRequestCodes.CODES.SILENT_MODE, value: 0 }] };
    }
    this.log(`Setting silent mode to: ${JSON.stringify(data)}`);
    await this.updateDeviceData(data);
    await this.setCapabilityValue('silent_mode', isTurnOn);
  }

  async setFanSpeedMax(speed: number) {
    let data = {};
    data = { param: [{ device_code: this.getDeviceCode(), protocol_code: ApiRequestCodes.CODES.FAN_SPEED_MAX, value: speed }] };
    this.log(`Setting max fan speed to: ${JSON.stringify(data)}`);
    await this.updateDeviceData(data);
    await this.setCapabilityValue('fan_speed_setting.max', speed).catch(this.error);
  }

  async setFanSpeedMin(speed: number) {
    let data = {};
    data = { param: [{ device_code: this.getDeviceCode(), protocol_code: ApiRequestCodes.CODES.FAN_SPEED_MIN, value: speed }] };
    this.log(`Setting min fan speed to: ${JSON.stringify(data)}`);
    await this.updateDeviceData(data);
    await this.setCapabilityValue('fan_speed_setting.min', speed).catch(this.error);
  }

  async setMaximumFrequencyHeating(frequency: number) {
    let data = {};
    data = { param: [{ device_code: this.getDeviceCode(), protocol_code: ApiRequestCodes.CODES.MAX_FREQUENCY_HEATING, value: frequency }] };
    this.log(`Setting max frequency to: ${JSON.stringify(data)}`);
    await this.updateDeviceData(data);
    await this.setCapabilityValue('frequency_setting.heating_max', frequency).catch(this.error);
  }

  private updateDeviceData(data: {}) {
    this.log(`Updating device data: ${JSON.stringify(data)}`);
    return new AquatempAPI(this.getSetting('username'), this.getSetting('password'))
      .setDeviceData(data);
  }

  getHvacMode(result: any): string {
    let mode = '';
    const modeString = result.find((x: any) => x.code === ApiRequestCodes.CODES.MODE);
    switch (modeString?.value) {
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
    return mode;
  }

  async setHvacMode(newMode: string) {
    let value = '';
    const code = 'mode';
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
      default:
        throw new Error(`Unknown hvac mode: ${newMode}`);
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
      await this.setCapabilityValue('thermostat_mode', newMode).catch(this.error);
      await this.updateData();
    }
  }

  async setTemp(desiredTemp: number) {
    let mode = '';
    switch (this.getCapabilityValue('thermostat_mode') as string) {
      case 'cool':
        mode = ApiRequestCodes.CODES.COOL_TEMP_SETTING;
        break;
      case 'heat':
        mode = ApiRequestCodes.CODES.HEAT_TEMP_SETTING;
        break;
      default:
        mode = ApiRequestCodes.CODES.AUTO_TEMP_SETTING;
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
            protocol_code: ApiRequestCodes.CODES.SET_TEMPERATURE,
            value: desiredTemp,
          },
        ],
    };
    await this.updateDeviceData(data);
  }

}

module.exports = HeatPumpDevice;
