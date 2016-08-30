import {UtilsService} from "../../services/utils/UtilsService";
import {IMap} from "../../services/utils/IMap";
import {IServerGroup} from "../../services/server-group/IServerGroup";
import {ServerGroupService} from "../../services/server-group/ServerGroupService";
import {IServerAddress} from "../../services/server/IServerAddress";
import {JGroupsService} from "../../services/jgroups/JGroupsService";
import {IStateService} from "angular-ui-router";
import {AddNodeModalCtrl} from "./AddNodeModalCtrl";
import {ServerService} from "../../services/server/ServerService";
import {ConfirmationModalCtrl} from "./ConfirmationModalCtrl";
import {IRootScopeService} from "../../common/IRootScopeService";
import IModalService = angular.ui.bootstrap.IModalService;
import IModalServiceInstance = angular.ui.bootstrap.IModalServiceInstance;
import {DmrService} from "../../services/dmr/DmrService";

export class ServerGroupCtrl {
  static $inject: string[] = ["$rootScope", "$state", "$uibModal", "dmrService", "serverGroupService", "serverService",
    "jGroupsService", "utils", "serverGroup"];

  available: boolean = false;
  status: string = "DEGRADED";
  serverStatusMap: IMap<string> = {};
  serverInetMap: IMap<string> = {};
  coordinator: IServerAddress;
  hosts: string[];

  constructor(private $rootScope: IRootScopeService,
              private $state: IStateService,
              private $uibModal: IModalService,
              private dmrService: DmrService,
              private serverGroupService: ServerGroupService,
              private serverService: ServerService,
              private jGroupsService: JGroupsService,
              private utils: UtilsService,
              public serverGroup: IServerGroup) {
    this.fetchSGStatus();
    this.fetchSGCoordinator();
    this.fetchServerStatuses();
    this.fetchInetAddresses();
    this.hosts = this.filterUniqueHosts();
  }

  isCoordinator(server: IServerAddress): boolean {
    return this.coordinator.equals(server);
  }

  isServerStopped(server: IServerAddress): boolean {
    return false;
  }

  getSGStatus(): string {
    return this.status;
  }

  getServerStatus(server: IServerAddress): string {
    if (this.utils.isEmptyObject(this.serverStatusMap)) {
      return "";
    }
    return this.serverStatusMap[server.toString()];
  }

  getServerInetAddress(server: IServerAddress): string {
    if (this.utils.isEmptyObject(this.serverInetMap) || this.utils.isNullOrUndefined(server)) {
      return "";
    }
    return this.serverInetMap[server.toString()];
  }

  refresh(): void {
    this.dmrService.clearGetCache();
    this.$state.reload();
  }

  createServerModal(): void {
    let modal: IModalServiceInstance = this.$uibModal.open({
      templateUrl: "module/server-group/view/add-node-modal.html",
      controller: AddNodeModalCtrl,
      controllerAs: "ctrl",
      resolve: {
        hosts: (): string[] => {
          return this.hosts;
        }
      }
    });

    let bootModal: IModalServiceInstance = undefined;
    modal.result
      .then((newServer) => {
        newServer["server-group"] = this.serverGroup.name;
        newServer["socket-binding-group"] = this.serverGroup["socket-binding-group"];
        return this.serverService.createServer(newServer)
          .then(() => {
            bootModal = this.createBootingModal();
            return this.serverService.startServer(newServer);
          });
      })
      .finally(() => {
        if (this.utils.isNotNullOrUndefined(bootModal)) {
          bootModal.close();
        }
        this.refresh();
      });
  }

  createBootingModal(): IModalServiceInstance {
    return this.$uibModal.open({
      templateUrl: "module/server-group/view/booting-modal.html"
    });
  }

  createStoppingModal(): IModalServiceInstance {
    return this.$uibModal.open({
      templateUrl: "module/server-group/view/stopping-modal.html"
    });
  }

  createConfirmationModal(operation: string): void {
    let modal: IModalServiceInstance = this.$uibModal.open({
      templateUrl: "module/server-group/view/confirmation-modal.html",
      controller: ConfirmationModalCtrl,
      controllerAs: "ctrl",
      resolve: {
        operation: (): string => {
          return operation;
        }
      }
    });

    let bootModal: IModalServiceInstance = undefined;
    modal.result
      .then(() => {
        // If we get here, then we know the modal was submitted
        if (operation === "start") {
          bootModal = this.createBootingModal();
          return this.serverGroupService.startServers(this.serverGroup);
        } else {
          bootModal = this.createStoppingModal();
          return this.serverGroupService.stopServers(this.serverGroup);
        }
      })
      .then(() => {
        bootModal.close();
        this.refresh();
      })
      .catch((error) => this.$rootScope.openErrorModal(error));
  }

  private filterUniqueHosts(): string[] {
    return this.serverGroup.members
      .map((server) => server.host)
      .filter((item, post, array) => array.indexOf(item) === post);
  }

  private fetchServerStatuses(): void {
    this.serverGroupService.getServerStatuses(this.serverGroup).then((statusMap) => this.serverStatusMap = statusMap);
  }

  private fetchSGStatus(): void {
    this.serverGroupService.isGroupAvailable(this.serverGroup).then((result) => {
      this.available = result;
      this.status = result ? "STARTED" : "DEGRADED";
    });
  }

  private fetchSGCoordinator(): void {
    this.jGroupsService.getServerGroupCoordinator(this.serverGroup).then((coordinator) => this.coordinator = coordinator);
  }

  private fetchInetAddresses(): void {
    this.serverGroupService.getServerInetAddresses(this.serverGroup).then((inetMap) => this.serverInetMap = inetMap);
  }
}
