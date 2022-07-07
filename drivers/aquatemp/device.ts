import Homey from 'homey';
var http = require('http.min');

class MyDevice extends Homey.Device {
  public MY_DEVICE_CODE = "";
  public HVAC_MODE = "";
  public X_TOKEN = "";
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('MyDevice has been initialized');
    this.registerCapabilityListener('target_temperature', async (value) => {
      this.setTemp(value);
    });
    this.registerCapabilityListener('onoff', async (value) => {
      this.setOnOff(value);
    });
    this.registerCapabilityListener('thermostat_mode', async (value) => {
      this.setHvacMode(value);
    });
    var result = await this.getFreshData();
    this.setValues(result);

    setInterval( async () => {
      let result = await this.getFreshData();
      this.setValues(result);
    }, 20000);
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('MyDevice has been added');
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
    var result = await this.getFreshData();
    this.setValues(result);
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name: string) {
    this.log('MyDevice was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('MyDevice has been deleted');
  }

  async getFreshData(){
    var optionsLogin = {
      uri: 'https://cloud.linked-go.com/cloudservice/api/app/user/login.json',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      json: {
        "user_name": this.homey.settings.get('username'),
        "password": this.homey.settings.get('password') ,
        "type":"2"
      }
    }
    var result = await http.post(optionsLogin);

    this.X_TOKEN = result.data.object_result['x-token'];

    var optionsGetDevices = {
      uri: 'https://cloud.linked-go.com/cloudservice/api/app/device/deviceList.json',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-token' : this.X_TOKEN
      }
    }
    var devicesResult = await http.post(optionsGetDevices);
    var jsonDeviceResult = await JSON.parse(devicesResult.data);

    this.MY_DEVICE_CODE = jsonDeviceResult.object_result[0].device_code;

    var optionsGetDeviceByCode = {
      uri: 'https://cloud.linked-go.com/cloudservice/api/app/device/getDataByCode.json',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-token' : this.X_TOKEN
      },
      json: {
        "device_code": this.MY_DEVICE_CODE,
        "protocal_codes": ["Power","Mode","Manual-mute","T01","T02","2074","2075","2076","2077","H03","Set_Temp","R08","R09","R10","R11","R01","R02","R03","T03","1158","1159","F17","H02","T04","T05","T06","T07","T12","T14"]
      }
    }
    var idResult = await http.post(optionsGetDeviceByCode);
    return idResult;
  }

  async setValues(result: any){
    this.setCapabilityValue('measure_temperature', Number(result.data.object_result[4].value)).catch(this.error);
    this.setCapabilityValue('measure_voltage', Number(result.data.object_result[28].value)).catch(this.error);
    let onoff = Number(result.data.object_result[0].value);
    this.setCapabilityValue('onoff', onoff == 1 ? true : false).catch(this.error);
    this.setCapabilityValue('meter_power', (Number(result.data.object_result[28].value * Number(result.data.object_result[26].value)) / 1000)).catch(this.error);

    this.getHvacMode(result);
    this.setCapabilityValue('thermostat_mode', this.HVAC_MODE);

    let targetTemp = this.getTargetTemp(this.HVAC_MODE, result);
    this.setCapabilityValue('target_temperature', targetTemp).catch(this.error);
  }

  getTargetTemp(hvacMode: string, result: any) {
    let targetTemp = 0;
    switch(hvacMode) {
      case 'cool':
        targetTemp = Number(result.data.object_result.find((x: any) => x.code === 'R01').value) > 35 ? 35 : (Number(result.data.object_result.find((x: any) => x.code === 'R01').value));
        break;
      case 'auto':
        targetTemp = Number(result.data.object_result.find((x: any) => x.code === 'R03').value) > 35 ? 35 : (Number(result.data.object_result.find((x: any) => x.code === 'R03').value));
        break;
      default:
        targetTemp = Number(result.data.object_result.find((x: any) => x.code === 'R02').value) > 35 ? 35 : (Number(result.data.object_result.find((x: any) => x.code === 'R02').value));
        break;
    }
    return targetTemp;
  }

  async setOnOff(isTurnOn: boolean){
    let data = {};
    if(isTurnOn){
      data = {"param":[{"device_code":this.MY_DEVICE_CODE,"protocol_code":"power","value":"1"}]}
    } else{
      data = {"param":[{"device_code":this.MY_DEVICE_CODE,"protocol_code":"power","value":"0"}]}
    }
    var optionsOnOff = {
      uri: 'https://cloud.linked-go.com/cloudservice/api/app/device/control.json',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-token' : this.X_TOKEN
      },
      json: data
    }
    let res = await http.post(optionsOnOff);
    if(res.data.error_msg === "Success"){
      isTurnOn ? this.HVAC_MODE = 'heat' : this.HVAC_MODE = 'off';
      this.setCapabilityValue('thermostat_mode', this.HVAC_MODE);
    }
  }

  getHvacMode(result: any){
    let mode = "";
    let modeString = result.data.object_result.find((x: any) => x.code === 'Mode');
    let power = result.data.object_result.find((x: any) => x.code === 'Power');
    switch(modeString.value){
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

  async setHvacMode(newMode: string){
    let value = "";
    let code = "mode";
    if(this.HVAC_MODE === 'off' && newMode !== 'off'){
      let data = {"param":[{"device_code":this.MY_DEVICE_CODE,"protocol_code":"power","value":"1"}]}
      var optionsOnOff = {
        uri: 'https://cloud.linked-go.com/cloudservice/api/app/device/control.json',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-token' : this.X_TOKEN
        },
        json: data
      }
      let res = await http.post(optionsOnOff);
      if(res.data.error_msg == "Success"){
        this.setCapabilityValue('onoff', true).catch(this.error);
      }
    }
    switch(newMode) {
      case 'cool':
        value = "0";
        break;
      case 'heat':
        value = "1";
        break;
      case 'auto':
        value = "2";
        break;
      case 'off':
        value = "0";
        code = "power";
        break;
    }
    let data = {"param":[{"device_code":this.MY_DEVICE_CODE,"protocol_code":code,"value":value}]}
    var optionsChangeHVAC = {
      uri: 'https://cloud.linked-go.com/cloudservice/api/app/device/control.json',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-token' : this.X_TOKEN
      },
      json: data
    }
    let res = await http.post(optionsChangeHVAC);
    if(res.data.error_msg == "Success"){
      this.setCapabilityValue('thermostat_mode', newMode).catch(this.error);
    }
  }

  async setTemp(desiredTemp: number){
    let mode = "";
    switch(this.HVAC_MODE) {
      case 'cool':
        mode = "R01"
        break;
      case 'heat':
        mode = "R02"
        break;
      default:
        mode = "R03"
        break;
    }
    var optionsSetTemp = {
      uri: 'https://cloud.linked-go.com/cloudservice/api/app/device/control.json',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-token' : this.X_TOKEN
      },
      json: {
        "param":
          [
            {
              "device_code": this.MY_DEVICE_CODE,
              "protocol_code": mode,
              "value": desiredTemp
            },
            {
              "device_code": this.MY_DEVICE_CODE,
              "protocol_code": "Set_Temp",
              "value": desiredTemp
            }
          ]
        }
    }
    await http.post(optionsSetTemp);
  }

}

module.exports = MyDevice;
