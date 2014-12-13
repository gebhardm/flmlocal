/**
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

/* ************************************************************
   Display gauges for the Fluksometer
************************************************************ */
// objects containing the actual sensor data as string and value
var gauge = {}, displays = {};
// create an array of sensor values to pass on to a graph
var numgauge = 0;

function onMessageArrived(message) {
	// split the received message at the slashes
	var topic = message.destinationName.split('/');
	var payload = message.payloadString;
	// pass sensor message to the html part
	$('#message').html(message.destinationName + ", '" + payload);
	// the sensor message type is the third value of the topic
	var msgType = topic[3]; // gauge or counter
	var sensor = topic[2]; // the sensor ID
	var value = JSON.parse(payload); // the transferred payload
	var unit = '';
	// now compute the gauge
	switch (msgType) {
	case 'gauge':
		// Sensor handling - transfer the current values from the payload
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
			default:
				break;
			}
		}
		// create and fill an array of last n gauge
		// also create the corresponding table row to show - only if it not yet exists
		if (displays[sensor] == null) {
			numgauge++;
			// put always two gauges into one table row
			var tabcell = '<div id="' + sensor + '"></div>';
			if (numgauge % 2 == 1) {
				var tabrow = '<tr>' +
					'<td id="gc' + numgauge + '" width=50%></td>' +
					'<td id="gc' + (numgauge + 1) + '" width=50%></td>' +
					'</tr>';
				$('#gauge').append(tabrow);
			};
			$('#gc' + numgauge).append(tabcell);
			var limit = 0, decimals = 0;
			if (unit == 'W')
				limit = 250;
			else if (unit == '°C') {
				limit = 50;
				decimals = 2;
			}
			else
				limit = 100;
			limit = (gauge[sensor]>limit?gauge[sensor]:limit);
			displays[sensor] = new JustGage({
					id : sensor,
					value : gauge[sensor],
					title : sensor,
					label : unit,
					min : 0,
					max : limit,
					decimals : decimals
				});
		};
		// now pass the data to the html part
		if (gauge[sensor] > displays[sensor].txtMaximum) {
			displays[sensor].refresh(gauge[sensor], gauge[sensor]);
		}
		displays[sensor].refresh(gauge[sensor]);
		break;
	case 'counter':
		break;
	default:
		break;
	}
};

$(function() { MQTTconnect(); });
