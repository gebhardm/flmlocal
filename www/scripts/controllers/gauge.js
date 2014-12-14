/*
 * Copyright (c) 2014 Markus Gebhard <markus.gebhard@web.de>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

// link to the web server's IP address for MQTT socket connection
var client;
var reconnectTimeout = 2000;
var port = 8083; // the FLM's web socket port from mosquitto
var wsID = "FLM" + parseInt(Math.random() * 100, 10); // get "different" websocketIDs

var gauge = {}, display = {};

// the part of the AngularJS application that handles the gauges
var app = angular.module("flmUiApp");

app.controller("GaugeCtrl", function($scope) {
	$scope.debug = false;
	$scope.alerts = [];
	$scope.gauges = [];
	$scope.message = "";
    
	$scope.closeAlert = function(index) {
		$scope.alerts.splice(index, 1);
	};

	function pushError(error) {
		$scope.alerts.push({
			type: "error",
			msg: error
		});
	};

	// the web socket connect function
	function mqttConnect() {
		client = new Paho.MQTT.Client(location.hostname, port, "", wsID);
		var options = {
			timeout : 3,
			onSuccess : onConnect,
			onFailure : function(message) { setTimeout(mqttConnect, reconnectTimeout); }
		};
		// define callback routines
		client.onConnectionLost = onConnectionLost;
		client.onMessageArrived = onMessageArrived;
		client.connect(options);
	};

	// event handler on connection established
	function onConnect() {
		client.subscribe("/sensor/#");
	};

	// event handler on connection lost
	function onConnectionLost(responseObj) {
		setTimeout(mqttConnect, reconnectTimeout);
		if (responseObj.errorCode !== 0)
			console.log("onConnectionLost:" + responseObj.errorMessage);
	};

	function onMessageArrived(mqttMsg) {
		// split the received message at the slashes
		var topic = mqttMsg.destinationName.split('/');
		var payload = mqttMsg.payloadString;
		// pass sensor message to the html part
		$scope.$apply(function () {
			$scope.message = mqttMsg.destinationName + ", " + payload;
		});
		// the sensor message type is the third value of the topic
		var msgType = topic[3]; // gauge or counter
		var sensor = topic[2]; // the sensor ID
		var value = JSON.parse(payload); // the transferred payload
		var unit = '';
		// now comput the received mqttMessage
		switch (msgType) {
			case 'config' : break;
			case 'gauge' :
				// handle the payload to obtain gauge values
				if (value.length == null) {
					gauge[sensor] = value;
					unit = '';
				} else {
					switch (value.length) {
						case 1:
							gauge[sensor] = value[0];
							unit = '';
							break;
						case 2:
							gauge[sensor] = value[0];
							unit = value[1];
							break;
						case 3:
							var date = new Date(value[0] * 1000); // the timestamp
							var now = new Date().getTime();
							if ((now / 1000 - value[0]) > 60)
								value[1] = 0; // if too old, set to 0
							gauge[sensor] = value[1];
							unit = value[2];
							break;
						default: break;
					};
				};
				// now build the gauge display
				if (display[sensor] == null) {
					$scope.$apply(function() {
						$scope.gauges.push( { 
							id    : sensor,
							name  : sensor,
							unit  : unit
						});
					});
					var limit = 0, decimals = 0;
					if (unit == 'W')
						limit = 250;
					else if (unit == '°C') {
						limit = 50;
						decimals = 2;
					} else
						limit = 100;
					limit = (gauge[sensor]>limit?gauge[sensor]:limit);
					display[sensor] = new JustGage({
						id : sensor,
						value : gauge[sensor],
						title : sensor,
						label : unit,
						min : 0,
						max : limit,
						decimals : decimals
					});
				}
				// now show the current gauge value - set gaugeMax newly if required
				if (gauge[sensor] > display[sensor].txtMaximum) {
					display[sensor].refresh(gauge[sensor], gauge[sensor]);
				}
				display[sensor].refresh(gauge[sensor]);
				break;
			case 'counter' : break;
			default : break;
		};
	};

	mqttConnect();
});
