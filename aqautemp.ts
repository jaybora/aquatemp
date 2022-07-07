var http = require('http.min');
var EventEmitter = require('events');
var util = require('util');

const apiConsts = "";
const apiEndpoint = 'https://owner-api.teslamotors.com/';
const streamingEndpoint = 'streaming.vn.teslamotors.com/stream/';

function AquaTemp (this: any, options: any) {
    var self = this;
    EventEmitter.call(self)
    if (options == null) { options = {} }
    self.user = options.user
    self.password = options.password
    self.grant = options.grant || null
    self.cache = 1
    self.language = options.language || 'en'
  }

  AquaTemp.prototype.login = function () {
    var self = this
    return login(self.user, self.password)?.then(function (data: any) {
      //self.grant = grant
      //self.emit('grant', grant)
      return data;
    })
  }

  function login (user: string, password: string) {
    if (!user) return Promise.reject('no_username')
    if (!password) return Promise.reject('no_password')
  
    var options = {
      uri: `https://cloud.linked-go.com/cloudservice/api/app/user/login.json`,
      json: true,
      form: {
        user_name: 'ludwig.hallgren@gmail.com',
        password: "Hoppas123!",
        type: '2'
      }
    }
    return http.post(options).then(function (result: any) {
      if (result.data.response) return Promise.reject(result.data.response)
      if (!result.data.access_token) return Promise.reject('no_token')
      return result.data
    })
  }