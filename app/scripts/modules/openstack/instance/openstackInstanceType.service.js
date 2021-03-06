'use strict';

let angular = require('angular');

module.exports = angular.module('spinnaker.openstack.instanceType.service', [
  require('../../core/api/api.service'),
  require('../../core/cache/deckCacheFactory.js'),
  require('../../core/utils/lodash.js'),
  require('../../core/config/settings.js'),
  require('../../core/cache/infrastructureCaches.js'),
])
  .factory('openstackInstanceTypeService', function ($http, $q, settings, _, API, infrastructureCaches) {
    var categories = [
      {
        type: 'custom',
        label: 'Custom Type',
        families: [],
        icon: 'asterisk'
      }
    ];

    function getCategories() {
      return $q.when(categories);
    }

    var getAllTypesByRegion = function getAllTypesByRegion() {
      var cached = infrastructureCaches.instanceTypes.get('openstack');
      if (cached) {
        return $q.when(cached);
      }
      return API.one('instanceTypes').get()
        .then(function (types) {
          var result = _(types)
            .map(function (type) {
              return { region: type.region, account: type.account, name: type.name, key: [type.region, type.account, type.name].join(':') };
            })
            .uniq('key')
            .groupBy('region')
            .valueOf();
          infrastructureCaches.instanceTypes.put('openstack', result);
          return result;
        });
    };

    function getAvailableTypesForRegions(availableRegions, selectedRegions) {
      selectedRegions = selectedRegions || [];
      var availableTypes = [];

      // prime the list of available types
      if (selectedRegions && selectedRegions.length) {
        availableTypes = _.pluck(availableRegions[selectedRegions[0]], 'name');
      }

      // this will perform an unnecessary intersection with the first region, which is fine
      selectedRegions.forEach(function(selectedRegion) {
        if (availableRegions[selectedRegion]) {
          availableTypes = _.intersection(availableTypes, _.pluck(availableRegions[selectedRegion], 'name'));
        }
      });

      return availableTypes.sort();
    }

    function filterInstanceTypesByVirtualizationType(instanceTypes/*, virtualizationType*/) {
      return instanceTypes;
    }

    return {
      getCategories: getCategories,
      getAvailableTypesForRegions: getAvailableTypesForRegions,
      getAllTypesByRegion: getAllTypesByRegion,
      filterInstanceTypesByVirtualizationType: filterInstanceTypesByVirtualizationType,
    };
  }
);
