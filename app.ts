import Homey from 'homey';

class MyApp extends Homey.App {

  /**
     * onInit is called when the app is initialized.
     */
  async onInit() {
    this.log('Aquatemp app has been initialized');

    // // Register action for setting silent mode
    // const setAction = this.homey.flow.getActionCard('set_silent_mode');
    // setAction.registerRunListener(async (args, state) => {
    //   const { device, silent_mode } = args;
    //   return device.setCapabilityValue('silent_mode', silent_mode === 'true');
    // });

  }

}

module.exports = MyApp;
