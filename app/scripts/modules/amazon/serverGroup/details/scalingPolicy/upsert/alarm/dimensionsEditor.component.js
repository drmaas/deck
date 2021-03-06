'use strict';

import {Observable, Subject} from 'rxjs';

const angular = require('angular');

require('./dimensionsEditor.component.less');

module.exports = angular
  .module('spinnaker.aws.serverGroup.details.scalingPolicy.dimensionEditor', [
    require('../../../../../../core/utils/lodash.js'),
    require('../../../../../../core/serverGroup/metrics/cloudMetrics.read.service.js'),
  ])
  .component('dimensionsEditor', {
    bindings: {
      alarm: '=',
      serverGroup: '=',
      updateAvailableMetrics: '&',
      namespaceUpdated: '=',
    },
    templateUrl: require('./dimensionsEditor.component.html'),
    controller: function (cloudMetricsReader, _) {

      this.viewState = {
        loadingDimensions: false
      };

      this.fetchDimensionOptions = () => {
        this.viewState.loadingDimensions = true;
        let filters = { namespace: this.alarm.namespace };
        return Observable
          .fromPromise(
          cloudMetricsReader.listMetrics('aws', this.serverGroup.account, this.serverGroup.region, filters)
        );
      };

      let dimensionSubject = new Subject();

      dimensionSubject
        .switchMap(this.fetchDimensionOptions)
        .subscribe((results) => {
          this.viewState.loadingDimensions = false;
          results = results || [];
          results.forEach(r => r.dimensions = r.dimensions || []);
          this.dimensionOptions = _.uniq(_.flatten(results.map(r => r.dimensions.map(d => d.name)))).sort();
        });

      this.updateDimensionOptions = () => {
        dimensionSubject.next();
      };

      this.removeDimension = (index) => {
        this.alarm.dimensions.splice(index, 1);
        this.updateAvailableMetrics();
      };

      this.$onInit = () => {
        this.updateDimensionOptions();
        this.namespaceUpdated.subscribe(() => {
          this.updateDimensionOptions();
        });
      };

    }
  });
