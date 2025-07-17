import Homey from 'homey';
import { ApiRequestError, AquatempAPI, AuthenticationError } from './aquatempAPI';

class MyDriver extends Homey.Driver {

  /**
     * onInit is called when the driver is initialized.
     */
  async onInit() {
    this.log('Aquatemp Driver has been initialized');

    this.homey.flow.getActionCard('set_silent_mode')
      .registerRunListener(async (args, state) => {
        this.log(`Setting silent mode to: ${args.silent_mode}`);
        await args.device.setSilentOnOff(args.silent_mode);
        return args.device.setCapabilityValue('silent_mode', args.silent_mode);
      });

    this.homey.flow.getActionCard('turn_silent_mode_on')
      .registerRunListener(async (args, state) => {
        this.log('Setting silent mode to on');
        await args.device.setSilentOnOff(true);
        return args.device.setCapabilityValue('silent_mode', true);
      });

    // Register action for turning silent mode off
    this.homey.flow.getActionCard('turn_silent_mode_off')
      .registerRunListener(async (args, state) => {
        this.log('Setting silent mode to off');
        await args.device.setSilentOnOff(false);
        return args.device.setCapabilityValue('silent_mode', false);
      });

    this.homey.flow.getActionCard('set_fan_speed_silent_mode')
      .registerRunListener(async (args, state) => {
        this.log(`Not setting fan speed in silent mode to: ${args.fan_speed}`);
        // await args.device.setFanSpeedInSilentMode(args.fan_speed);
        // return args.device.setCapabilityValue('fan_speed_silent_mode', args.fan_speed);
      });

    this.homey.flow.getDeviceTriggerCard('thermostat_mode_changed')
      .registerRunListener((args, state) => {
        this.log(`Thermostat mode changed to: ${args.device.getCapabilityValue('thermostat_mode')}`);
        return args.device.getCapabilityValue('thermostat_mode') === args.thermostat_mode;
      });

    this.homey.flow.getConditionCard('thermostat_mode_is')
      .registerRunListener((args, state) => {
        this.log(`Thermostat mode is: ${args.device.getCapabilityValue('thermostat_mode')}`);
        return args.device.getCapabilityValue('thermostat_mode') === args.thermostat_mode;
      });

    this.homey.flow.getActionCard('thermostat_mode_set')
      .registerRunListener(async (args, state) => {
        this.log(`Setting thermostat mode to: ${args.thermostat_mode}`);
        await args.device.setThermostatMode(args.thermostat_mode);
        return args.device.setCapabilityValue('thermostat_mode', args.thermostat_mode);
      });
  }

  async onPair(session: any) {
    let username: string | null = '';
    let password: string | null = '';
    session.setHandler('login', async (data: any) => {
      username = data.username as string | null;
      password = data.password as string | null;
      const api = new AquatempAPI(username, password);
      this.log(`Trying to login in with username: ${username} for adding device...`);
      try {
        await api.getToken();
      } catch (error) {
        if (error instanceof AuthenticationError) {
          this.log(`Could not login in with username: ${username}: '${error.message}' for adding device`);
          return false;
        }
        this.error(`Could not login in with username: ${username}: '${error}' for adding device`);
        throw error;
      }

      // return true to continue adding the device if the login succeeded
      // return false to indicate to the user the login attempt failed
      // thrown errors will also be shown to the user
      return true;
    });

    session.setHandler('list_devices', async () => {
      const api = new AquatempAPI(username, password);
      const devices = await api.getDeviceList();

      return devices.map(device => {
        return {
          name: `Heatpump ${device}`,
          data: {
            id: device,
          },
          settings: {
            // Store username & password in settings
            // so the user can change them later
            username,
            password,
          },
        };
      });
    });
  }

}

module.exports = MyDriver;
