import {DataSourceConfig} from '../../core/application/service/applicationDataSource.ts';
import dataSourceRegistryModule from '../../core/application/service/applicationDataSource.registry.ts';

let angular = require('angular');

module.exports = angular
  .module('spinnaker.netflix.tableau.dataSource', [
    require('../../core/config/settings'),
    dataSourceRegistryModule
  ])
  .run(function($q, applicationDataSourceRegistry, settings) {
    if (settings.feature && settings.feature.tableau) {
      applicationDataSourceRegistry.registerDataSource(new DataSourceConfig({
        key: 'analytics',
        sref: '.analytics',
        optIn: true,
        optional: true,
      }));
    }
  });
