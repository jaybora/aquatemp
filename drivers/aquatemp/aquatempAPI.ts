import https from 'https';
import axios from 'axios';
import {ApiEndpoints} from './apiendpoints';
import {ApiRequestCodes} from './apirequestcodes';
import {hashPassword} from '../../hasher';

export class AuthenticationError extends Error {

  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
    // This is necessary for proper stack traces in TypeScript
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }

}

export class ConfigurationError extends Error {

  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }

}

export class ApiRequestError extends Error {

  public statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, ApiRequestError.prototype);
  }

}

export class DeviceOfflineError extends Error {

  public statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'DeviceOfflineError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, DeviceOfflineError.prototype);
  }

}

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
   * Executes an API request by invoking the provided asynchronous function
   * and handles errors that may occur during the request. Specifically,
   * it processes Axios errors to provide improved error handling and
   * throws a custom `ApiRequestError` when applicable.
   *
   * @param {() => Promise<T>} requestFn - A function that returns a Promise for the API request.
   * @return {Promise<T>} A Promise resolving with the result of the API request, or rejecting with an error.
   * @throws {ApiRequestError} If the API request fails and it is an Axios-related error.
   * @throws {Error} If a non-Axios error occurs during request execution.
   */
  async executeApiRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    try {
      return await requestFn();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // The server responded with a status code outside the 2xx range
          const statusCode = error.response.status;
          const message = `Request failed with status code ${statusCode}`;
          throw new ApiRequestError(message, statusCode);
        } else if (error.request) {
          // The request was made but no response was received
          throw new ApiRequestError('No response received from the server', undefined);
        } else {
          // Something happened in setting up the request
          throw new ApiRequestError(`Error setting up the request: ${error.message}`, undefined);
        }
      }

      // Re-throw non-Axios errors
      throw new ApiRequestError(`Unknown error executing request: ${error}`, undefined);
    }
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
      throw new AuthenticationError('Username or password not set');
    }
    const agent = new https.Agent({
      rejectUnauthorized: false,
    });

    axios.defaults.httpsAgent = agent;
    const result = await this.executeApiRequest(async () => {
      return axios({
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
    });

    if (!result.data.isReusltSuc) {
      throw new AuthenticationError('Login to aquatemp server failed. Username or password incorrect');
    }
    this.token = result.data.objectResult['x-token'];
    return this.token!!;
  }

  public async getDeviceList(): Promise<string[]> {
    const result = await this.getOwnDevices();

    // TODO: Get list of devices shared with user by first getting userId from getUserInfo endpoint
    // and then use the userId as payload in fetching list of shared devices

    const ownDevices: string[] = result.data.objectResult.map((x: any) => x.device_code);
    return ownDevices;
  }

  private async getOwnDevices() {
    const result = await this.executeApiRequest(async () => {
      return axios({
        method: 'post',
        url: ApiEndpoints.DEVICE_LIST,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-token': await this.getToken(),
        },
      });
    });
    console.log('Server response:', JSON.stringify(result.data, null, 2));
    if (!result.data.isReusltSuc) {
      throw new ApiRequestError('Getting device list from aquatemp server failed.');
    }
    return result;
  }

  public async getDeviceData(deviceCode: string): Promise<any> {
    // Check device is online. We need to get list of devices for getting access to the device status
    const devices = await this.getOwnDevices();
    const device = devices.data.objectResult.find((x: any) => x.device_code === deviceCode);
    console.log(`Device found in list of devices: ${deviceCode} ${device}`);
    if (device.deviceStatus !== 'ONLINE') {
      throw new DeviceOfflineError(`Device ${deviceCode} is not online`);
    }
    console.log('Device is online, getting data from server: ', deviceCode, '')
    const result = await this.executeApiRequest(async () => {
      return axios({
        method: 'post',
        url: ApiEndpoints.GET_DATA_BY_CODE,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-token': await this.getToken(),
        },
        data: {
          device_code: deviceCode,
          protocal_codes: ApiRequestCodes.REQUEST_CODES,
        },
      });
    });

    if (result.data.objectResult.length === 0) {
      throw new ApiRequestError('Getting device data from aquatemp server failed. Reply from server is empty');
    }



    if (!result.data.isReusltSuc) {
      console.log(`Getting device data from server failed, isResultSec = false. 
      Returned data from server is ${result.data.objectResult}`);
      throw new ApiRequestError('Getting device data from aquatemp server failed.');
    }
    return result.data.objectResult;
  }

  public async setDeviceData(data: any): Promise<any> {
    return this.executeApiRequest(async () => {
      return axios({
        method: 'post',
        url: ApiEndpoints.CONTROL,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-token': await this.getToken(),
        },
        data,
      });
    });
  }

}
