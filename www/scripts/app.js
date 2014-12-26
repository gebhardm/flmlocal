/**
 * Copyright (c) 2013 Bart Van Der Meerssche <bart@flukso.net>
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

angular.module('flmUiApp', ['ui.bootstrap'])
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
