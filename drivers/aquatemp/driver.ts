import Homey from 'homey';
import { AquatempAPI } from './aquatempAPI';

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
  }

  async onPair(session: any) {
    let username: string | null = '';
    let password: string | null = '';
    session.setHandler('login', async (data: any) => {
      username = data.username as string | null;
      password = data.password as string | null;
      const api = new AquatempAPI(username, password);
      await api.getToken();

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
