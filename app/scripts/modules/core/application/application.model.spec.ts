import {Application} from './application.model.ts';
import modelBuilderModule, {ApplicationModelBuilder} from './applicationModel.builder.ts';
import {ApplicationDataSourceRegistry} from './service/applicationDataSource.registry.ts';

describe ('Application Model', function () {

  var application:Application;
  var securityGroupReader,
      loadBalancerReader,
      clusterService,
      securityGroupReader,
      $q: ng.IQService,
      $scope: ng.IScope,
      applicationModelBuilder: ApplicationModelBuilder,
      applicationDataSourceRegistry: ApplicationDataSourceRegistry;

  beforeEach(
    angular.mock.module(
      require('../securityGroup/securityGroup.dataSource'),
      require('../serverGroup/serverGroup.dataSource'),
      require('../loadBalancer/loadBalancer.dataSource'),
      modelBuilderModule
  ));

  beforeEach(
    angular.mock.inject(function (_securityGroupReader_, _clusterService_, _$q_, _loadBalancerReader_, $rootScope,
                            _applicationModelBuilder_, _applicationDataSourceRegistry_) {
      securityGroupReader = _securityGroupReader_;
      clusterService = _clusterService_;
      loadBalancerReader = _loadBalancerReader_;
      $q = _$q_;
      $scope = $rootScope.$new();
      applicationModelBuilder = _applicationModelBuilder_;
      applicationDataSourceRegistry = _applicationDataSourceRegistry_;
    })
  );


  function configureApplication(serverGroups: any[], loadBalancers: any[], securityGroupsByApplicationName: any[]) {
    spyOn(securityGroupReader, 'loadSecurityGroupsByApplicationName').and.returnValue($q.when(securityGroupsByApplicationName));
    spyOn(loadBalancerReader, 'loadLoadBalancers').and.returnValue($q.when(loadBalancers));
    spyOn(clusterService, 'loadServerGroups').and.returnValue($q.when(serverGroups));
    spyOn(securityGroupReader, 'loadSecurityGroups').and.returnValue($q.when([]));
    spyOn(securityGroupReader, 'getApplicationSecurityGroups').and.callFake(function(app, groupsByName) {
      return $q.when(groupsByName || []);
    });
    application = applicationModelBuilder.createApplication(applicationDataSourceRegistry.getDataSources());
    application.refresh();
    $scope.$digest();
  }

  describe('lazy dataSources', function () {

    beforeEach(function () {
      applicationDataSourceRegistry.registerDataSource({
        key: 'lazySource',
        lazy: true,
        loader: () => { application.getDataSource('lazySource').data = ['a']; return $q.when(null); },
        onLoad: () => $q.when(null)
      });
    });

    describe('activate', function () {
      it('refreshes section if not already active and not already loaded', function () {
        configureApplication([], [], []);
        spyOn(application.getDataSource('lazySource'), 'refresh').and.callThrough();

        application.getDataSource('lazySource').activate();
        $scope.$digest();
        expect((application.getDataSource('lazySource').refresh as any).calls.count()).toBe(1);
        expect(application.getDataSource('lazySource').active).toBe(true);
        expect(application.getDataSource('lazySource').loaded).toBe(true);

        application.getDataSource('lazySource').deactivate();
        expect(application.getDataSource('lazySource').active).toBe(false);
        application.getDataSource('lazySource').activate();
        // not refreshed since still loaded
        expect(application.getDataSource('lazySource').active).toBe(true);
        expect((application.getDataSource('lazySource').refresh as any).calls.count()).toBe(1);

        application.getDataSource('lazySource').deactivate();
        application.getDataSource('lazySource').loaded = false;
        application.getDataSource('lazySource').activate();
        expect((application.getDataSource('lazySource').refresh as any).calls.count()).toBe(2);
      });
    });

    describe('refresh behavior', function () {
      it('clears data on inactive lazy dataSources and sets loaded flag to false', function () {
        configureApplication([], [], []);

        expect(application.getDataSource('lazySource').active).toBeFalsy();

        application.getDataSource('lazySource').activate();
        $scope.$digest();
        expect(application.getDataSource('lazySource').active).toBe(true);
        expect(application.getDataSource('lazySource').loaded).toBe(true);
        expect(application.getDataSource('lazySource').data.length).toBe(1);

        application.getDataSource('lazySource').deactivate();
        application.refresh();
        $scope.$digest();

        expect(application.getDataSource('lazySource').data).toEqual([]);
        expect(application.getDataSource('lazySource').loaded).toBe(false);
      });
    });

    describe('application ready', function () {
      it('ignores lazy dataSources when determining if application is ready', function () {
        let isReady = false;
        configureApplication([], [], []);

        application.ready().then(() => isReady = true);
        $scope.$digest();
        expect(isReady).toBe(true);
      });
    });
  });

  describe('setting default credentials and regions', function () {
    it('sets default credentials and region from server group when only one account/region found', function () {
      var serverGroups = [{
          name: 'deck-test-v001',
          cluster: 'deck-test',
          account: 'test',
          region: 'us-west-2',
          type: 'aws',
          instances: [],
          instanceCounts: { up: 0, down: 0, starting: 0, unknown: 0, outOfService: 0 },
        }],
        loadBalancers = [],
        securityGroupsByApplicationName = [];

      configureApplication(serverGroups, loadBalancers, securityGroupsByApplicationName);
      expect(application.defaultCredentials.aws).toBe('test');
      expect(application.defaultRegions.aws).toBe('us-west-2');
    });

    it('sets default credentials and region from load balancer when only one account/region found', function () {
      var serverGroups = [],
        loadBalancers = [{name: 'deck-frontend', account: 'prod', type: 'gce', region: 'us-central-1', serverGroups: []}],
        securityGroupsByApplicationName = [];

      configureApplication(serverGroups, loadBalancers, securityGroupsByApplicationName);
      expect(application.defaultCredentials.gce).toBe('prod');
      expect(application.defaultRegions.gce).toBe('us-central-1');
    });

    it('sets default credentials and region from security group', function () {
      var serverGroups = [],
        loadBalancers = [],
        securityGroupsByApplicationName = [{name: 'deck-test', provider: 'cf', accountName: 'test', region: 'us-south-7'}];

      configureApplication(serverGroups, loadBalancers, securityGroupsByApplicationName);
      expect(application.defaultCredentials.cf).toBe('test');
      expect(application.defaultRegions.cf).toBe('us-south-7');
    });

    it('does not set defaults when multiple values found for the same provider', function () {
      var serverGroups = [],
        loadBalancers = [{name: 'deck-frontend', account: 'prod', type: 'aws', region: 'us-west-1', serverGroups: []}],
        securityGroupsByApplicationName = [{name: 'deck-test', provider: 'aws', accountName: 'test', region: 'us-east-1'}];

      configureApplication(serverGroups, loadBalancers, securityGroupsByApplicationName);
      expect(application.defaultCredentials.aws).toBeUndefined();
      expect(application.defaultRegions.aws).toBeUndefined();
    });

    it('sets default region or default credentials if possible', function () {
      var serverGroups = [],
        loadBalancers = [{name: 'deck-frontend', account: 'prod', type: 'aws', region: 'us-east-1', serverGroups: []}],
        securityGroupsByApplicationName = [{name: 'deck-test', provider: 'aws', accountName: 'test', region: 'us-east-1'}];

      configureApplication(serverGroups, loadBalancers, securityGroupsByApplicationName);
      expect(application.defaultCredentials.aws).toBeUndefined();
      expect(application.defaultRegions.aws).toBe('us-east-1');
    });

    it('sets default credentials, even if region cannot be set', function () {
      var serverGroups = [],
        loadBalancers = [{name: 'deck-frontend', account: 'test', type: 'aws', region: 'us-east-1', serverGroups: []}],
        securityGroupsByApplicationName = [{name: 'deck-test', provider: 'aws', accountName: 'test', region: 'us-west-1'}];

      configureApplication(serverGroups, loadBalancers, securityGroupsByApplicationName);
      expect(application.defaultCredentials.aws).toBe('test');
      expect(application.defaultRegions.aws).toBeUndefined();
    });

    it('should set defaults for multiple providers', function () {
      var serverGroups = [
          {
            name: 'deck-test-v001',
            account: 'test',
            region: 'us-west-2',
            provider: 'aws',
            instances: [],
            instanceCounts: { up: 0, down: 0, starting: 0, unknown: 0, outOfService: 0 },
          },
          {
            name: 'deck-gce-v001',
            account: 'gce-test',
            region: 'us-central-1',
            provider: 'gce',
            instances: [],
            instanceCounts: { up: 0, down: 0, starting: 0, unknown: 0, outOfService: 0 },
          }
        ],
        loadBalancers = [{name: 'deck-frontend', account: 'gce-test', type: 'gce', region: 'us-central-1', serverGroups: []}],
        securityGroupsByApplicationName = [{name: 'deck-test', provider: 'aws', accountName: 'test', region: 'us-west-2'}];

      configureApplication(serverGroups, loadBalancers, securityGroupsByApplicationName);
      expect(application.defaultCredentials.aws).toBe('test');
      expect(application.defaultRegions.aws).toBe('us-west-2');
      expect(application.defaultCredentials.gce).toBe('gce-test');
      expect(application.defaultRegions.gce).toBe('us-central-1');
    });
  });
});
