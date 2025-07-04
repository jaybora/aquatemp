import Homey from 'homey';

class MyApp extends Homey.App {

  /**
     * onInit is called when the app is initialized.
     */
  async onInit() {
    this.log('Aquatemp app has been initialized');
  }

}

module.exports = MyApp;
