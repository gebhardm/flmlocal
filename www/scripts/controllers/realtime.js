/*
The MIT License (MIT)

Copyright (c) 2016 Markus Gebhard <markus.gebhard@web.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
"use strict";

var RealtimeCtrl = function($scope) {
    $scope.debug = false;
    $scope.alerts = [];
    $scope.closeAlert = function(index) {
        $scope.alerts.splice(index, 1);
    };
    // the configuration section
    $scope.cfgCollapsed = false;
    var subscription = $('[name="subscription"]:checked').val();
    // link to the web server's IP address for MQTT socket connection
    var client;
    var reconnectTimeout = 2e3;
    // the FLM's web socket port from mosquitto
    var broker = location.hostname;
    var port = 8083;
    // prepare the chart display
    var ctx = document.getElementById("chart").getContext("2d");
    var myChart;
    var options = {
        responsive: true,
        scales: {
            yAxes: [ {
                ticks: {}
            } ]
        }
    };
    var datasets = [];
    // the web socket connect function
    function mqttConnect() {
        var wsID = "FLM" + parseInt(Math.random() * 100, 10);
        client = new Paho.MQTT.Client(broker, port, "", wsID);
        var options = {
            timeout: 3,
            onSuccess: onConnect,
            onFailure: function(message) {
                setTimeout(mqttConnect, reconnectTimeout);
            }
        };
        // define callback routines
        client.onConnectionLost = onConnectionLost;
        client.onMessageArrived = onMessageArrived;
        client.connect(options);
    }
    // event handler on connection established
    function onConnect() {
        if (subscription !== undefined) {
            client.subscribe(subscription);
        }
    }
    // event handler on connection lost
    function onConnectionLost(responseObj) {
        setTimeout(mqttConnect, reconnectTimeout);
        if (responseObj.errorCode !== 0) {
            console.log("onConnectionLost:" + responseObj.errorMessage);
        }
    }
    // handle the received message
    function onMessageArrived(mqttMsg) {
        var msg = {};
        var topic = mqttMsg.destinationName.split("/");
        var type = topic[topic.length - 2];
        var phase = topic[topic.length - 1];
        var payload = mqttMsg.payloadString;
        var label = type + "_L" + phase;
        var idx = 0;
        var index = -1;
        try {
            payload = JSON.parse(payload);
        } catch (error) {
            console.log("Error parsing JSON");
            return;
        }
        for (idx = 0; idx < datasets.length; idx++) {
            if (datasets[idx].label === label) index = idx;
        }
        if (index === -1) {
            var red = Math.floor(Math.random() * 255);
            var green = Math.floor(Math.random() * 255);
            var blue = Math.floor(Math.random() * 255);
            var dataset = {
                label: label,
                fill: false,
                borderColor: "rgba(" + red + "," + green + "," + blue + ",1)",
                data: payload[1]
            };
            datasets.push(dataset);
        } else {
            datasets[index].data = payload[1];
        }
        displayChart(datasets);
    }
    function displayChart(datasets) {
        var data;
        if (myChart === undefined) {
            var labels = [];
            for (var i = 0; i < 32; i++) labels.push(i);
            var data = {
                labels: labels,
                datasets: datasets
            };
            myChart = new Chart(ctx, {
                type: "line",
                data: data,
                options: options
            });
        }
        myChart.data.datasets = datasets;
        myChart.update();
    }
    $(document).on("click", '[name="subscription"]', function() {
        var sel = $(this).val();
        // reset subscription and chart display
        if (subscription !== undefined && client !== undefined) client.unsubscribe(subscription);
        datasets = [];
        if (myChart !== undefined) myChart.destroy();
        if (client !== undefined) client.subscribe(sel);
        subscription = sel;
    });
    mqttConnect();
};

// the part of the AngularJS application that handles the chart
RealtimeCtrl.$inject = [ "$scope" ];

angular.module("flmUiApp").controller("RealtimeCtrl", RealtimeCtrl);