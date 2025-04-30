export class ApiEndpoints {

    public static readonly BASE_URL = 'https://cloud.linked-go.com:449/crmservice/api';
    public static readonly USER_LOGIN = `${this.BASE_URL}/app/user/login`;
    public static readonly DEVICE_LIST = `${this.BASE_URL}/app/device/deviceList`;
    public static readonly GET_DATA_BY_CODE = `${this.BASE_URL}/app/device/getDataByCode`;
    public static readonly CONTROL = `${this.BASE_URL}/app/device/control`;

}
