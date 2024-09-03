import {$} from '../caching/GlobalCache';
import {Colony, ColonyStage} from '../Colony';
import {log} from '../console/log';
import {Mem} from '../memory/Memory';
import {UpgradingOverlord} from '../overlords/core/upgrader';
import {profile} from '../profiler/decorator';
import {Stats} from '../stats/stats';
import {hasMinerals} from '../utilities/utils';
import {HiveCluster} from './_HiveCluster';

interface UpgradeSiteMemory {
	stats: { downtime: number };
	speedFactor: number;		// Multiplier on upgrade parts for fast growth
}


/**
 * Upgrade sites group upgrade-related structures around a controller, such as an input link and energy container
 */
@profile
export class UpgradeSite extends HiveCluster {

	memory: UpgradeSiteMemory;
	upgradePowerNeeded: number;
	link: StructureLink | undefined;						// The primary object receiving energy for the site
	battery: StructureContainer | undefined; 				// The container to provide an energy buffer
	batteryPos: RoomPosition | undefined;
	overlord: UpgradingOverlord;
	// energyPerTick: number;

	static settings = {
		energyBuffer     : 100000,	// Number of upgrader parts scales with energy minus this value
		energyPerBodyUnit: 20000,	// Scaling factor: this much excess energy adds one extra body repetition // TODO: scaling needs to increase with new storage/terminal system
		minLinkDistance  : 10,		// Required distance to build link
		linksRequestBelow: 200,		// Links request energy when less than this amount
	};

	constructor(colony: Colony, controller: StructureController) {
		super(colony, controller, 'upgradeSite');
		this.memory = Mem.wrap(this.colony.memory, 'upgradeSite');
	}

	refresh() {
		this.memory = Mem.wrap(this.colony.memory, 'upgradeSite');
		this.upgradePowerNeeded = this.getUpgradePowerNeeded();
		// Register bettery
		const allowableContainers = _.filter(this.room.containers, container =>
			container.pos.findInRange(FIND_SOURCES, 1).length == 0); // only count containers that aren't near sources
		this.battery = this.pos.findClosestByLimitedRange(allowableContainers, 3);

		this.batteryPos = this.calculateBatteryPos();

		if (this.batteryPos) this.colony.destinations.push({pos: this.batteryPos, order: 0});
		// Register link
		this.link = this.pos.findClosestByLimitedRange(this.colony.availableLinks, 3);
		this.colony.linkNetwork.claimLink(this.link);

		// Compute stats
		this.stats();
	}

	spawnMoarOverlords() {
		// Register overlord
		this.overlord = new UpgradingOverlord(this);
	}

	findInputConstructionSite(): ConstructionSite | undefined {
		const nearbyInputSites = this.pos.findInRange(this.room.constructionSites, 4, {
			filter: (s: ConstructionSite) => s.structureType == STRUCTURE_CONTAINER ||
											 s.structureType == STRUCTURE_LINK,
		});
		return _.first(nearbyInputSites);
	}

	private getUpgradePowerNeeded(): number {
		if (!this.room.storage) return 0;

		const amountOver = Math.max(this.colony.assets.energy - UpgradeSite.settings.energyBuffer, 0);
		let upgradePower = 1 + Math.floor(amountOver / UpgradeSite.settings.energyPerBodyUnit);
		if (amountOver > 800000) {
			upgradePower *= 4; // double upgrade power if we have lots of surplus energy
		} else if (amountOver > 500000) {
			upgradePower *= 2;
		}
		if (this.colony.controller.level == 8) {
			if (this.colony.assets.energy < 30000) {
				upgradePower = 0;
			} else {
				upgradePower = Math.min(upgradePower, 15); // don't go above 15 work parts at RCL 8
			}
		} else if (this.colony.controller.level >= 6) {
			// Can set a room to upgrade at an accelerated rate manually
			upgradePower = this.memory.speedFactor != undefined ? upgradePower * this.memory.speedFactor : upgradePower;
		}
		
		return upgradePower;
	}

	init(): void {
		// Register energy requests
		if (this.link && this.link.energy < UpgradeSite.settings.linksRequestBelow) {
			this.colony.linkNetwork.requestReceive(this.link);
		}
		const inThreshold = this.colony.stage == ColonyStage.Larva ? 0.75 : 0.5;
		if (this.battery) {
			if (this.colony.stage == ColonyStage.Larva) {
				if (this.battery.energy < inThreshold * this.battery.storeCapacity) {
					const workers = this.colony.overlords.work.workers;
					const energyPerTick = UPGRADE_CONTROLLER_POWER * _.sum(workers, worker => worker.getBodyparts(WORK));
					this.colony.logisticsNetwork.requestInput(this.battery, {dAmountdt: energyPerTick});
				}
			} else {
				if (this.battery.energy < inThreshold * this.battery.storeCapacity) {
					const energyPerTick = UPGRADE_CONTROLLER_POWER * this.upgradePowerNeeded;
					this.colony.logisticsNetwork.requestInput(this.battery, {dAmountdt: energyPerTick});
				}
			}
			if (hasMinerals(this.battery.store)) { // get rid of any minerals in the container if present
				this.colony.logisticsNetwork.requestOutputMinerals(this.battery);
			}
		}
	}

	/**
	 * Calculate where the input will be built for this site
	 */
	private calculateBatteryPos(): RoomPosition | undefined {
		let originPos: RoomPosition | undefined;
		if (this.colony.storage) {
			originPos = this.colony.storage.pos;
		} else if (this.colony.roomPlanner.storagePos) {
			originPos = this.colony.roomPlanner.storagePos;
		} else {
			return;
		}
		// Find all positions at range 2 from controller
		let inputLocations: RoomPosition[] = [];
		for (const pos of this.pos.getPositionsAtRange(2)) {
			if (pos.isWalkable(true)) {
				inputLocations.push(pos);
			}
		}
		// Try to find locations where there is maximal standing room
		const maxNeighbors = _.max(_.map(inputLocations, pos => pos.availableNeighbors(true).length));
		inputLocations = _.filter(inputLocations,
								  pos => pos.availableNeighbors(true).length >= maxNeighbors);
		// Return location closest to storage by path
		const inputPos = originPos.findClosestByPath(inputLocations);
		if (inputPos) {
			return inputPos;
		}
	}

	/**
	 * Build a container output at the optimal location
	 */
	private buildBatteryIfMissing(): void {
		if (!this.battery && !this.findInputConstructionSite()) {
			const buildHere = this.batteryPos;
			if (buildHere) {
				const result = buildHere.createConstructionSite(STRUCTURE_CONTAINER);
				if (result == OK) {
					return;
				} else {
					log.warning(`Upgrade site at ${this.pos.print}: cannot build battery! Result: ${result}`);
				}
			}
		}
	}

	private stats() {
		const defaults = {
			downtime: 0,
		};
		if (!this.memory.stats) this.memory.stats = defaults;
		_.defaults(this.memory.stats, defaults);
		// Compute downtime
		this.memory.stats.downtime = (this.memory.stats.downtime * (CREEP_LIFE_TIME - 1) +
									  (this.battery ? +this.battery.isEmpty : 0)) / CREEP_LIFE_TIME;
		Stats.log(`colonies.${this.colony.name}.upgradeSite.downtime`, this.memory.stats.downtime);
	}

	run(): void {
		if (Game.time % 25 == 7 && this.colony.level >= 2) {
			this.buildBatteryIfMissing();
		}
	}

	visuals() {
		// let info = [];
		// if (this.colony.controller.level != 8) {
		// 	let progress = `${Math.floor(this.colony.controller.progress / 1000)}K`;
		// 	let progressTotal = `${Math.floor(this.colony.controller.progressTotal / 1000)}K`;
		// 	let percent = `${Math.floor(100 * this.colony.controller.progress / this.colony.controller.progressTotal)}`;
		// 	info.push(`Progress: ${progress}/${progressTotal} (${percent}%)`);
		//
		// }
		// info.push(`Downtime: ${this.memory.stats.downtime.toPercent()}`);
		// Visualizer.showInfo(info, this);
	}
}
