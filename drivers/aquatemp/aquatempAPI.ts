import https from 'https';
import axios from 'axios';
import { ApiEndpoints } from './apiendpoints';
import { hashPassword } from '../../hasher';

export class AquatempAPI {

  private username: string | null;
  private plainPassword: string | null;
  private token: string | null = null;
  private hashedPassword: string | null;

  /**
   * Constructs an instance of the class with the provided username and plainPassword.
   *
   * @param {string | null} username - The username associated with the instance. Can be null.
   * @param {string | null} plainPassword - The plain-text password for the instance. Can be null.
   */
  constructor(username: string | null = null, plainPassword: string | null = null) {
    this.username = username;
    this.plainPassword = plainPassword;
    this.hashedPassword = plainPassword ? hashPassword(plainPassword.slice(0, 16)) : null;
  }

  /**
   * Retrieves an authentication token by sending a login request to the specified server.
   * The method requires a username and password to be set, hashes the password for security,
   * and performs a request to acquire the token. Throws an error if login fails or required
   * information is not set.
   *
   * @return {Promise<string>} The authentication token upon a successful login request.
   * @throws {Error} If the username or password is not set, or if the server login fails.
   */
  public async getToken(): Promise<string> {
    if (this.token) {
      return this.token;
    }
    if (!this.username || !this.plainPassword) {
      throw new Error('Username or password not set');
    }
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
        userName: this.username,
        password: this.hashedPassword,
      },
    });
    if (!result.data.isReusltSuc) {
      throw new Error('Login to aquatemp server failed. Username or password incorrect');
    }
    this.token = result.data.objectResult['x-token'];
    return this.token!!;
  }

  public async getDeviceList(): Promise<string[]> {
    const result = await this.getOwnDevices();

    //TODO: Get list of devices shared with user by first getting userId from getUserInfo endpoint
    //and then use the userId as payload in fetching list of shared devices


    const ownDevices: string[] = result.data.objectResult.map((x: any) => x.device_code);
    return ownDevices;
  }

  private async getOwnDevices() {
    const result = await axios({
      method: 'post',
      url: ApiEndpoints.DEVICE_LIST,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-token': await this.getToken(),
      },
    });
    if (!result.data.isReusltSuc) {
      throw new Error('Getting device list from aquatemp server failed.');
    }
    return result;
  }

  public async getDeviceData(deviceCode: string): Promise<any> {
    const result = await axios({
      method: 'post',
      url: ApiEndpoints.GET_DATA_BY_CODE,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-token': await this.getToken(),
      },
      data: {
        device_code: deviceCode,
        // TODO: Handle the codes better
        protocal_codes: ['Power', 'Mode', 'Manual-mute', 'T01', 'T02', '2074', '2075', '2076', '2077', 'H03', 'Set_Temp', 'R08', 'R09', 'R10', 'R11', 'R01', 'R02', 'R03', 'T03', '1158', '1159', 'F17', 'H02', 'T04', 'T05', 'T06', 'T07', 'T12', 'T14'],
      },
    });
    if (!result.data.isReusltSuc) {
      throw new Error('Getting device data from aquatemp server failed.');
    }
    return result;
  }

  public async setDeviceData(deviceCode: string, data: any): Promise<any> {
    return axios({
      method: 'post',
      url: ApiEndpoints.CONTROL,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-token': await this.getToken(),
      },
      data,
    });
  }

}
