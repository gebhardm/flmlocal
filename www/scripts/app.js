/**
 * Copyright (c) 2015 Bart Van Der Meerssche <bart@flukso.net>
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

angular.module('flmUiApp', [
    'ngRoute',
    'ui.bootstrap',
    'ui.grid',
    'ui.grid.edit',
    'ui.grid.rowEdit',
    'ui.grid.selection'
  ])
  .config(function ($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'views/main.html',
        controller: 'MainCtrl',
        tagName: null
      })
      .when('/sensor', {
        templateUrl: 'views/sensor.html',
        controller: 'SensorCtrl',
        tagName: 'sensor'
      })
      .when('/kube', {
        templateUrl: 'views/kube.html',
        controller: 'KubeCtrl',
        tagName: 'kube'
      })
      .when('/wifi', {
        templateUrl: 'views/wifi.html',
        controller: 'WifiCtrl',
        tagName: 'wifi'
      })
      .when('/status', {
        templateUrl: 'views/status.html',
        controller: 'StatusCtrl',
        tagName: 'status'
      })
      .when('/services', {
        templateUrl: 'views/services.html',
        controller: 'ServicesCtrl',
        tagName: 'services'
      })
      .when('/syslog', {
        templateUrl: 'views/syslog.html',
        controller: 'SyslogCtrl',
        tagName: 'syslog'
      })
      .when('/mqtt', {
        templateUrl: 'views/mqtt.html',
        controller: 'MqttCtrl',
        tagName: 'mqtt'
      })
      .when('/chart', {
        templateUrl: 'views/chart.html',
        controller: 'ChartCtrl',
        tagName: 'chart'
      })
      .when('/consumption', {
        templateUrl: 'views/consumption.html',
        controller: 'ConsumptionCtrl',
        tagName: 'consumption'
      })
      .when('/gauge', {
        templateUrl: 'views/gauge.html',
        controller: 'GaugeCtrl',
        tagName: 'gauge'
      })
      .when('/graph', {
        templateUrl: 'views/graph.html',
        controller: 'GraphCtrl',
        tagName: 'graph'
      })
      .when('/panel', {
        templateUrl: 'views/panel.html',
        controller: 'PanelCtrl',
        tagName: 'panel'
      })	  
      .otherwise({
        redirectTo: '/'
      });
  })
  .controller('MenuCtrl', function($scope) {
    $scope.menus = [
  {
    title: "configuration", 
    action: "#", 
    menus: [
      {
        title: "status",
        action: "#/status"
      },
      {
        title: "wifi",
        action: "#/wifi"
      },
      {
        title: "sensor",
        action: "#/sensor"
      },
      {
        title: "kube",
        action: "#/kube"
      },
      {
        title: "services",
        action: "#/services"
      },
      {
        title: "syslog",
        action: "#/syslog"
      },
      {
        title: "mqtt",
        action: "#/mqtt"
      }
    ]
  },
  {
    title: "visualization", 
    action: "#", 
    menus: [
      {
        title: "chart",
        action: "#/chart"
      },
      {
        title: "consumption",
        action: "#/consumption"
      },
      {
        title: "gauge",
        action: "#/gauge"
      },
      {
        title: "graph",
        action: "#/graph"
      },
      {
        title: "panel",
        action: "#/panel"
      }
    ]
  }
]
  })
  .run(function($rootScope, $route) {
    $rootScope.$on("$routeChangeSuccess", function(ngEvent, currRoute, prevRoute) {
      if (prevRoute && prevRoute.tagName) {
        angular.element(document).find(prevRoute.tagName)
          .parent().parent().removeClass("active");
      }

      if (currRoute && currRoute.tagName) {
        angular.element(document).find(currRoute.tagName)
          .parent().parent().addClass("active");
      }
    });
  });

angular.module('flmUiApp')
  .factory('flmRpc', function ($rootScope, $http, $location, $q) {
    return {
      call: function (endpoint, method, params) {
        var deferred = $q.defer();

        var url = "/cgi-bin/luci/rpc/" + endpoint  + "?auth=" + $rootScope.sysauth;
        var request = {
          "method": method,
          "params": params,
          "id": Date.now()
        };

        $http.post(url, request)
          .success(function(response) {
            if (response.error) {
              deferred.reject(response.error);
            } else {
              deferred.resolve(response.result);
            }
          })
          .error(function(response, status) {
            switch (status) {
            case 403:
                deferred.reject("Invalid session. Please log in.");
                break;
            case 500:
                deferred.reject(response);
                break;
            }
          });

        return deferred.promise;
      }
    };
  });
