const logger = require('../../../utils/logger');
const { EVENTS } = require('../../../utils/constants');
const { status, featureStatus, subStatus } = require('./mqtt');

/**
 * @description Handle a new message receive in MQTT.
 * @param {string} topic - MQTT topic.
 * @param {Object} message - The message sent.
 * @example
 * handleMqttMessage('stat/tasmota/POWER', 'ON');
 */
function handleMqttMessage(topic, message) {
  const splittedTopic = topic.split('/');
  const eventType = splittedTopic[2];
  const deviceExternalId = splittedTopic[1];
  const events = [];

  switch (eventType) {
    // Sensor status
    case 'SENSOR': {
      featureStatus(deviceExternalId, message, this.gladys.event, 'StatusSNS');
      break;
    }
    // Device global status
    case 'STATUS': {
      delete this.mqttDevices[deviceExternalId];
      const device = status(deviceExternalId, message, this.serviceId);
      this.pendingMqttDevices[deviceExternalId] = device;
      this.mqttService.device.publish(`cmnd/${deviceExternalId}/STATUS`, '11');
      break;
    }
    // Device secondary features
    case 'STATUS8': {
      let device = this.pendingMqttDevices[deviceExternalId];
      if (device) {
        subStatus(device, message, this.gladys.event);
        device = this.mergeWithExistingDevice(device);

        this.mqttDevices[deviceExternalId] = device;
        delete this.pendingMqttDevices[deviceExternalId];

        this.notifyNewDevice(device);
      }
      break;
    }
    // Device primary features
    case 'STATUS11': {
      const device = this.pendingMqttDevices[deviceExternalId];
      if (device) {
        subStatus(device, message, this.gladys.event);
        // Ask for secondary features
        this.mqttService.device.publish(`cmnd/${deviceExternalId}/STATUS`, '8');
      }
      break;
    }
    case 'RESULT':
    case 'STATE': {
      featureStatus(deviceExternalId, message, this.gladys.event, 'StatusSTS');
      break;
    }
    // Online status
    case 'LWT': {
      this.mqttService.device.publish(`cmnd/${deviceExternalId}/status`);
      break;
    }
    default: {
      logger.debug(`MQTT : Tasmota topic "${topic}" not handled.`);
    }
  }

  events.forEach((event) => this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, event));
  return null;
}

module.exports = {
  handleMqttMessage,
};
